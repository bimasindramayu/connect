-- =====================================================================================
-- Jalin (Bimas Islam Kabupaten Indramayu): SKEMA DATABASE LENGKAP (satu file)
--
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi file ini > Run.
-- Aman dijalankan berulang (idempotent). Cocok untuk:
--   (a) pemasangan baru (database kosong);
--   (b) database versi lama: struktur lama dikonversi otomatis, tabel lama dihapus setelah dipastikan datanya pindah:
--       RPD/Realisasi per-POS -> 1 record per bulan (JSON); Anggaran per KUA -> 1 baris per tahun;
--       Pengaturan SAKTI berversi per bulan -> ceklis global; Realisasi SAKTI tanpa status/tanggal/keterangan.
--
-- Isi: 0 Persiapan | 1 Profil dan hak akses | 2 KUA | 3 Fungsi bantu | 4 POS | 5 Config | 6 Anggaran |
--      7 (kosong) | 8 RPD | 9 Realisasi | 9b Pembayaran SAKTI | 9c Impor data lama | 10 Salin data lama |
--      11 Pembersihan | 12 Jaspro Transport | 13 BAST NR
--
-- Model data: Anggaran = 1 baris per TAHUN (items = {"<id KUA>": nominal}). RPD dan Realisasi = 1 record per KUA per bulan;
--   rincian POS disimpan di kolom JSON items = {"<id POS>": nominal, ...}. Total dihitung otomatis oleh trigger.
--   Pembayaran SAKTI hanya Listrik dan Telepon/Internet: ceklis global per KUA + POS (metode_pembayaran) dan nominal bulanan
--   yang diinput admin (realisasi_sakti); dijumlahkan dengan Realisasi manual pada validasi dan laporan.
--   Semua input nominal dibatasi 10 digit (Rp 9.999.999.999), ditegakkan di database (nominal_max) dan di index.html.
-- Keamanan: RLS membatasi operator ke KUA-nya; trigger SECURITY DEFINER menegakkan semua aturan di sisi server.
-- =====================================================================================

-- 0a) PERIKSA AWAL, sebelum ada yang diubah: Air (522113) tidak lagi dibayar lewat SAKTI. Dibatalkan bila Realisasi SAKTI Air
-- masih bernominal, supaya tidak ada uang yang hilang diam-diam dan database tidak berhenti di tengah pembaruan.
do $$
declare n bigint;
begin
  if to_regclass('public.realisasi_sakti') is not null and to_regclass('public.pos') is not null then
    select count(*) into n from public.realisasi_sakti s join public.pos p on p.id = s.pos_id
     where p.kode_pos = '522113' and s.nominal > 0;
    if n > 0 then
      raise exception 'Dibatalkan sebelum mengubah apa pun: ada % baris Realisasi SAKTI untuk Air (522113) bernominal > 0, padahal SAKTI hanya Listrik dan Telepon/Internet. Pindahkan nilainya ke Realisasi manual lebih dulu, lalu jalankan: delete from public.realisasi_sakti where pos_id = (select id from public.pos where kode_pos = ''522113'');', n;
    end if;
  end if;
end $$;

-- 0) PERSIAPAN: bila masih struktur lama (RPD/Realisasi per-POS), pindahkan dulu menjadi *_lama
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rpd' and column_name = 'pos_id') then
    drop trigger if exists rpd_guard on public.rpd;
    alter table public.rpd rename to rpd_lama;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'realisasi' and column_name = 'pos_id') then
    drop trigger if exists realisasi_a_lock on public.realisasi;
    drop trigger if exists realisasi_guard on public.realisasi;
    alter table public.realisasi rename to realisasi_lama;
  end if;
  -- Anggaran lama = 1 baris per KUA per tahun (kolom kua_id). Struktur baru = 1 baris per tahun; datanya disalin di bagian 10.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'anggaran' and column_name = 'kua_id') then
    drop trigger if exists anggaran_guard on public.anggaran;
    alter table public.anggaran rename to anggaran_lama;
  end if;
end $$;

-- 1) PROFIL AKUN DAN HAK AKSES -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  kua text,
  role text not null default 'operator' check (role in ('admin','operator')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- operator hanya melihat profilnya sendiri, admin melihat semua. Tanpa policy insert/update/delete: klien tidak bisa mengubah role.
drop policy if exists "baca profil sendiri atau admin" on public.profiles;
create policy "baca profil sendiri atau admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- profil dibuat otomatis saat akun dibuat (data dari user_metadata); kua_id dicari dari nama KUA
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nama, kua, kua_id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nama', new.email), new.raw_user_meta_data->>'kua',
    (select id from public.kua where nama_kua = new.raw_user_meta_data->>'kua'),
    case when new.raw_user_meta_data->>'role' = 'admin' then 'admin' else 'operator' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) KUA (31 kecamatan) ------------------------------------------------------------------
create table if not exists public.kua (
  id int generated by default as identity primary key,
  nama_kua text not null unique,
  kecamatan text not null,
  status text not null default 'aktif' check (status in ('aktif','nonaktif'))
);
insert into public.kua (nama_kua, kecamatan)
select 'KUA Kec. ' || k, k from unnest(array['Anjatan','Arahan','Balongan','Bangodua','Bongas','Cantigi','Cikedung',
  'Gabuswetan','Gantar','Haurgeulis','Indramayu','Jatibarang','Juntinyuat','Kandanghaur','Karangampel','Kedokan Bunder',
  'Kertasemaya','Krangkeng','Kroya','Lelea','Lohbener','Losarang','Pasekan','Patrol','Sindang','Sliyeg','Sukagumiwang',
  'Sukra','Terisi','Tukdana','Widasari']) as k
on conflict (nama_kua) do nothing;
alter table public.profiles add column if not exists kua_id int references public.kua(id);
update public.profiles p set kua_id = k.id from public.kua k where p.kua_id is null and p.kua = k.nama_kua;

create or replace function public.my_kua() returns int
language sql security definer stable set search_path = public as $$
  select kua_id from public.profiles where id = auth.uid();
$$;

alter table public.kua enable row level security;
drop policy if exists kua_read on public.kua;
create policy kua_read on public.kua for select to authenticated using (true);

-- Daftar akun beserta username (bagian email sebelum @). Hanya admin; auth.users tidak terbuka ke klien.
create or replace function public.akun_daftar() returns table (id uuid, username text, nama text, kua text, role text)
language sql security definer stable set search_path = public as $$
  select p.id, split_part(u.email, '@', 1), p.nama, p.kua, p.role
    from public.profiles p join auth.users u on u.id = p.id
   where public.is_admin()
   order by p.role, p.nama;
$$;
revoke execute on function public.akun_daftar() from public, anon;
grant execute on function public.akun_daftar() to authenticated;

-- 3) FUNGSI BANTU ------------------------------------------------------------------------
create or replace function public.rp(n bigint) returns text
language sql stable as $$ select 'Rp ' || replace(to_char(n, 'FM999,999,999,999,999'), ',', '.'); $$;

create or replace function public.nama_bulan(m int) returns text language sql immutable as $$
  select (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[m];
$$;

create or replace function public.items_total(p jsonb) returns bigint
language sql immutable as $$ select coalesce(sum(value::bigint), 0)::bigint from jsonb_each_text(p); $$;

-- Batas input nominal: maksimal 10 digit (Rp 9.999.999.999). Harus sama dengan MAXD di index.html.
create or replace function public.nominal_max() returns bigint language sql immutable as $$ select 9999999999::bigint; $$;

-- 4) POS: satu baris = satu unit input (rincian, atau kode POS itu sendiri bila tanpa rincian) -------------
create table if not exists public.pos (
  id int generated by default as identity primary key,
  kode_pos text not null,
  nama_pos text not null,
  nama_rincian text,
  urutan int not null unique
);
insert into public.pos (kode_pos, nama_pos, nama_rincian, urutan) values
 ('521111','Belanja Operasional Perkantoran','ATK Kantor',1),
 ('521111','Belanja Operasional Perkantoran','Jamuan Tamu',2),
 ('521111','Belanja Operasional Perkantoran','Pramubakti',3),
 ('521111','Belanja Operasional Perkantoran','Alat Rumah Tangga Kantor',4),
 ('521211','Belanja Bahan','Penggandaan / Penjilidan',5),
 ('521211','Belanja Bahan','Spanduk',6),
 ('522111','Belanja Langganan Listrik',null,7),
 ('522112','Belanja Langganan Telepon / Internet',null,8),
 ('522113','Belanja Langganan Air',null,9),
 ('523111','Belanja Pemeliharaan Gedung dan Bangunan',null,10),
 ('523121','Belanja Pemeliharaan Peralatan dan Mesin',null,11)
on conflict (urutan) do nothing;

create or replace function public.pos_label(p_id int) returns text
language sql stable set search_path = public as $$
  select kode_pos || ' ' || coalesce(nama_rincian, nama_pos) from pos where id = p_id;
$$;

-- Rapikan dan validasi rincian: kunci = id POS yang ada, nilai = bilangan bulat 0..9.999.999.999 (10 digit); nilai 0 dibuang
create or replace function public.norm_items(p jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare k text; v jsonb; r jsonb := '{}'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Format rincian POS tidak valid.'; end if;
  for k, v in select key, value from jsonb_each(p) loop
    if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[0-9]+$' then
      raise exception 'Nominal POS % harus bilangan bulat dan tidak negatif.', k; end if;
    if length(v #>> '{}') > 10 then
      raise exception 'Nominal POS % maksimal 10 digit (Rp 9.999.999.999).', k; end if;
    if not exists (select 1 from pos where id::text = k) then raise exception 'POS % tidak dikenal.', k; end if;
    if (v #>> '{}')::bigint > 0 then r := r || jsonb_build_object(k, (v #>> '{}')::bigint); end if;
  end loop;
  return r;
end $$;

alter table public.pos enable row level security;
drop policy if exists pos_read on public.pos;
create policy pos_read on public.pos for select to authenticated using (true);

-- 5) CONFIG global ---------------------------------------------------------------------------
create table if not exists public.config (
  key text primary key, value jsonb not null,
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.config (key, value) values
 ('rpd_enabled','true'),('realisasi_enabled','true'),
 ('max_file_size_mb','5'),('max_file_count','3'),('bulan_edit_rpd','[1,2,3,4,5,6,7,8,9,10,11,12]')
on conflict (key) do nothing;

-- Operator boleh edit RPD hanya jika rpd_enabled dan bulan ada di bulan_edit_rpd
create or replace function public.rpd_open(m int) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from config where key = 'rpd_enabled'), false)
     and exists (select 1 from config where key = 'bulan_edit_rpd' and value @> to_jsonb(m));
$$;

alter table public.config enable row level security;
drop policy if exists cfg_read on public.config;
create policy cfg_read on public.config for select to authenticated using (true);
drop policy if exists cfg_admin on public.config;
create policy cfg_admin on public.config for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 6) ANGGARAN TAHUNAN: 1 baris = 1 TAHUN ----------------------------------------------------------
-- items = {"<id KUA>": nominal} untuk semua KUA; total dihitung trigger. Operator tidak membaca tabel ini langsung
-- (satu baris memuat semua KUA): operator memakai anggaran_tahun(), admin menulis lewat set_anggaran().
create table if not exists public.anggaran (
  tahun int not null check (tahun between 2020 and 2100),
  items jsonb not null default '{}'::jsonb check (jsonb_typeof(items) = 'object'),
  total bigint not null default 0 check (total >= 0),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  constraint anggaran_tahun_pk primary key (tahun)
);

-- Rapikan (kunci = id KUA yang ada, nilai bilangan bulat 0..9.999.999.999, nol dibuang) dan jaga:
-- anggaran sebuah KUA tidak boleh diturunkan di bawah total RPD yang sudah diisi (pesan menyebut nama KUA).
create or replace function public.anggaran_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; r jsonb := '{}'::jsonb; n bigint; kid int; used bigint; nm text;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'object' then raise exception 'Format anggaran tidak valid.'; end if;
  for k, v in select key, value from jsonb_each(new.items) loop
    select nama_kua into nm from kua where id::text = k;
    if nm is null then raise exception 'KUA % tidak dikenal.', k; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[0-9]+$' then
      raise exception '%: anggaran harus bilangan bulat dan tidak negatif.', nm; end if;
    if length(v #>> '{}') > 10 then
      raise exception '%: anggaran maksimal 10 digit (Rp 9.999.999.999).', nm; end if;
    n := (v #>> '{}')::bigint;
    if n > 0 then r := r || jsonb_build_object(k, n); end if;
  end loop;
  new.items := r;
  -- kunci yang sama dengan guard RPD (KUA + tahun), selalu berurutan menurut id KUA
  for kid in select id from kua order by id loop perform pg_advisory_xact_lock(kid, new.tahun); end loop;
  for kid, used in select kua_id, sum(total) from rpd where tahun = new.tahun group by kua_id having sum(total) > 0 loop
    n := coalesce((r ->> kid::text)::bigint, 0);
    if n < used then
      raise exception '%: Anggaran % lebih kecil dari total RPD yang sudah diisi (%). Kurangi RPD lebih dulu.',
        (select nama_kua from kua where id = kid), rp(n), rp(used); end if;
  end loop;
  new.total := coalesce((select sum(value::bigint) from jsonb_each_text(r)), 0);
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists anggaran_guard on public.anggaran;
create trigger anggaran_guard before insert or update on public.anggaran
  for each row execute function public.anggaran_guard();

-- Anggaran satu tahun: {"<id KUA>": nominal}. Admin: semua KUA. Operator: hanya KUA-nya sendiri.
create or replace function public.anggaran_tahun(p_tahun int) returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce((select case
           when public.is_admin() then a.items
           when public.my_kua() is not null and a.items ? public.my_kua()::text
             then jsonb_build_object(public.my_kua()::text, a.items -> public.my_kua()::text)
           else '{}'::jsonb end
         from public.anggaran a where a.tahun = p_tahun), '{}'::jsonb);
$$;

-- Atur anggaran: hanya KUA yang dikirim yang berubah (digabung ke baris tahun itu; nilai 0 = hapus). Hanya admin.
create or replace function public.set_anggaran(p_tahun int, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengatur anggaran.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'object' then raise exception 'Format anggaran tidak valid.'; end if;
  perform 1 from anggaran where tahun = p_tahun for update;
  if found then update anggaran set items = items || p_items where tahun = p_tahun;
  else insert into anggaran (tahun, items) values (p_tahun, p_items); end if;
end $$;
revoke execute on function public.anggaran_tahun(int) from public, anon;
grant execute on function public.anggaran_tahun(int) to authenticated;
revoke execute on function public.set_anggaran(int, jsonb) from public, anon;
grant execute on function public.set_anggaran(int, jsonb) to authenticated;

alter table public.anggaran enable row level security;
drop policy if exists ang_read on public.anggaran;
drop policy if exists ang_admin on public.anggaran;
create policy ang_admin on public.anggaran for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.anggaran from anon;
revoke delete, truncate on public.anggaran from authenticated;

-- 7) (kosong) AutoPayment lama (nominal tetap) sudah digantikan SAKTI di bagian 9b. Sisa objek lamanya dibersihkan di bagian 11.

-- 8) RPD: 1 record = 1 KUA x 1 bulan -----------------------------------------------------------
create table if not exists public.rpd (
  id bigint generated by default as identity primary key,
  kua_id int not null references public.kua(id),
  tahun int not null check (tahun between 2020 and 2100),
  bulan int not null check (bulan between 1 and 12),
  items jsonb not null default '{}'::jsonb check (jsonb_typeof(items) = 'object'),
  total bigint not null default 0 check (total >= 0),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  unique (kua_id, tahun, bulan)
);

-- Total RPD setahun <= Anggaran Tahunan; operator hanya boleh menyentuh KUA-nya sendiri
create or replace function public.rpd_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap bigint; used bigint;
begin
  if not public.is_admin() and public.my_kua() is distinct from new.kua_id then
    raise exception 'Anda tidak berhak mengubah data KUA lain.'; end if;
  new.items := norm_items(new.items); new.total := items_total(new.items);
  perform pg_advisory_xact_lock(new.kua_id, new.tahun);
  select (items ->> new.kua_id::text)::bigint into cap from anggaran where tahun = new.tahun;
  if cap is null then raise exception 'Anggaran Tahunan % belum ditetapkan admin untuk KUA ini.', new.tahun; end if;
  select coalesce(sum(total), 0) into used from rpd where kua_id = new.kua_id and tahun = new.tahun and bulan <> new.bulan;
  if used + new.total > cap then
    raise exception 'Total RPD melebihi Anggaran Tahunan. Batas: %, sudah terpakai (bulan lain): %, dimasukkan: %, kelebihan: %.',
      rp(cap), rp(used), rp(new.total), rp(used + new.total - cap);
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists rpd_guard on public.rpd;
create trigger rpd_guard before insert or update on public.rpd for each row execute function public.rpd_guard();

alter table public.rpd enable row level security;
drop policy if exists rpd_read on public.rpd;
create policy rpd_read on public.rpd for select to authenticated using (public.is_admin() or kua_id = public.my_kua());
drop policy if exists rpd_write on public.rpd;
create policy rpd_write on public.rpd for all to authenticated
  using (public.is_admin() or (kua_id = public.my_kua() and public.rpd_open(bulan)))
  with check (public.is_admin() or (kua_id = public.my_kua() and public.rpd_open(bulan)));

-- 9) REALISASI: 1 record = 1 KUA x 1 bulan ------------------------------------------------------
create table if not exists public.realisasi (
  id bigint generated by default as identity primary key,
  kua_id int not null references public.kua(id),
  tahun int not null check (tahun between 2020 and 2100),
  bulan int not null check (bulan between 1 and 12),
  items jsonb not null default '{}'::jsonb check (jsonb_typeof(items) = 'object'),
  total bigint not null default 0 check (total >= 0),
  status text not null default 'waiting' check (status in ('waiting','approved','rejected','paid')),
  file_lpj_url text check (file_lpj_url is null or file_lpj_url ~ '^https://(drive|docs)\.google\.com/'),
  catatan_admin text,
  submitted_by uuid references auth.users(id), submitted_at timestamptz,
  verified_by uuid references auth.users(id), verified_at timestamptz,
  paid_at timestamptz,
  nominal_dibayar bigint check (nominal_dibayar is null or nominal_dibayar > 0),
  unique (kua_id, tahun, bulan)
);
-- (database lama: lengkapi kolom nominal yang dibayarkan admin; wajib diisi saat status Dibayar, dijaga trigger)
alter table public.realisasi add column if not exists nominal_dibayar bigint check (nominal_dibayar is null or nominal_dibayar > 0);
create index if not exists realisasi_filter on public.realisasi (tahun, status, kua_id);

-- Operator: hanya boleh membuat (belum ada) atau memperbaiki yang berstatus rejected; setelah dikirim jadi waiting dan terkunci.
-- Admin: boleh mengubah status apa pun kapan pun, tetapi TIDAK boleh mengubah nominal / dokumen LPJ. Status Dibayar wajib
-- menyertakan nominal yang dibayarkan (1 .. total Realisasi, maks 10 digit).
-- Impor data lama: hanya impor_baris() (admin) yang menyalakan penanda bop.impor. Aturan PROSES operator (kepemilikan, status,
-- jadwal tanggal 10, LPJ wajib, POS SAKTI) dilewati karena ini data historis; aturan HITUNGAN (RPD) tetap berlaku.
create or replace function public.realisasi_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare impor boolean := coalesce(current_setting('bop.impor', true), '') = 'on';
        sk jsonb; rpd_m bigint; sk_m bigint; ctx text; k text; v bigint; lama bigint; cap bigint; used bigint; pid int;
begin
  if not impor then
    if tg_op = 'UPDATE' and public.is_admin() then
      if (new.kua_id, new.tahun, new.bulan, new.items, new.total, new.file_lpj_url)
         is distinct from (old.kua_id, old.tahun, old.bulan, old.items, old.total, old.file_lpj_url) then
        raise exception 'Admin hanya dapat mengubah status dan catatan, bukan nominal atau dokumen LPJ.'; end if;
      if new.status = 'rejected' and btrim(coalesce(new.catatan_admin, '')) = '' then
        raise exception 'Alasan penolakan wajib diisi.'; end if;
      if new.status = 'paid' then
        if new.nominal_dibayar is null then
          raise exception 'Nominal yang dibayarkan wajib diisi untuk status Dibayar.'; end if;
        if new.nominal_dibayar <= 0 then
          raise exception 'Nominal yang dibayarkan harus lebih dari Rp 0.'; end if;
        if new.nominal_dibayar > nominal_max() then
          raise exception 'Nominal yang dibayarkan maksimal 10 digit (Rp 9.999.999.999).'; end if;
        if new.nominal_dibayar > new.total then
          raise exception 'Nominal yang dibayarkan (%) melebihi total Realisasi (%).', rp(new.nominal_dibayar), rp(new.total); end if;
      else
        new.nominal_dibayar := null;
      end if;
      if new.status <> old.status then
        new.verified_by := auth.uid(); new.verified_at := now();
        new.paid_at := case when new.status = 'paid' then now() end;
      end if;
      return new;
    end if;

    if public.my_kua() is distinct from new.kua_id then
      raise exception 'Anda tidak berhak mengubah data KUA lain.'; end if;
    if tg_op = 'UPDATE' then
      if old.status <> 'rejected' then
        raise exception 'Realisasi berstatus % tidak dapat diubah. Hanya Realisasi yang ditolak yang dapat diperbaiki.',
          case old.status when 'waiting' then 'Menunggu verifikasi' when 'approved' then 'Disetujui' else 'Dibayar' end; end if;
      if (new.kua_id, new.tahun, new.bulan) is distinct from (old.kua_id, old.tahun, old.bulan) then
        raise exception 'KUA, tahun, dan bulan tidak dapat diubah.'; end if;
      new.catatan_admin := old.catatan_admin; new.verified_by := old.verified_by; new.verified_at := old.verified_at;
    else
      new.catatan_admin := null; new.verified_by := null; new.verified_at := null;
    end if;
    new.paid_at := null; new.nominal_dibayar := null; new.status := 'waiting'; new.submitted_by := auth.uid(); new.submitted_at := now();
  end if;

  new.items := norm_items(new.items);
  select nama_kua into ctx from kua where id = new.kua_id;
  perform pg_advisory_xact_lock(new.kua_id, new.tahun);

  if not impor then
    -- POS yang dicentang SAKTI hanya diinput admin (tabel realisasi_sakti): operator tidak boleh mengisi atau mengubahnya.
    -- Nilai lama (warisan sebelum dicentang) dipertahankan, jadi Realisasi yang ditolak tetap dapat diperbaiki.
    for pid in select p.id from pos p where pos_sakti_ok(p.id) and metode_pos(new.kua_id, p.id) = 'SAKTI' loop
      k := pid::text;
      v := coalesce((new.items ->> k)::bigint, 0);
      lama := case when tg_op = 'UPDATE' then coalesce((old.items ->> k)::bigint, 0) else 0 end;
      if v > 0 and v <> lama then
        raise exception '%: POS % dibayar lewat SAKTI. Realisasinya diinput oleh Admin dan tidak dapat diisi manual.',
          ctx, pos_label(pid); end if;
      new.items := (new.items - k) || case when lama > 0 then jsonb_build_object(k, lama) else '{}'::jsonb end;
    end loop;
  end if;
  new.total := items_total(new.items);

  if not impor then
    if coalesce((select (value #>> '{}')::boolean from config where key = 'realisasi_enabled'), false) is not true then
      raise exception 'Pengisian Realisasi sedang ditutup oleh admin.'; end if;
    if (now() at time zone 'Asia/Jakarta')::date < make_date(new.tahun, new.bulan, 10) then
      raise exception 'Realisasi % % baru dapat disubmit mulai tanggal 10 %.', nama_bulan(new.bulan), new.tahun, nama_bulan(new.bulan); end if;
    if new.total > 0 and new.file_lpj_url is null then
      raise exception 'LPJ wajib dilampirkan (unggah file LPJ).'; end if;
  end if;

  sk := sakti_items(new.kua_id, new.tahun, new.bulan);
  select coalesce(sum(total), 0) into rpd_m from rpd where kua_id = new.kua_id and tahun = new.tahun and bulan = new.bulan;
  sk_m := items_total(sk);
  if new.total + sk_m > rpd_m then
    raise exception '%: total Realisasi bulan ini melebihi RPD bulan ini. Batas: %, SAKTI: %, dimasukkan: %, kelebihan: %.',
      ctx, rp(rpd_m), rp(sk_m), rp(new.total), rp(new.total + sk_m - rpd_m); end if;

  for k, v in select key, value::bigint from jsonb_each_text(new.items) loop
    select coalesce(sum((items ->> k)::bigint), 0) into cap from rpd where kua_id = new.kua_id and tahun = new.tahun;
    select coalesce(sum((items ->> k)::bigint), 0) + sakti_year(new.kua_id, k::int, new.tahun) into used
      from realisasi where kua_id = new.kua_id and tahun = new.tahun and bulan <> new.bulan;
    if used + v > cap then
      raise exception '%: Realisasi POS % melebihi total RPD setahun. Batas: %, terpakai (bulan lain + SAKTI): %, dimasukkan: %, kelebihan: %.',
        ctx, pos_label(k::int), rp(cap), rp(used), rp(v), rp(used + v - cap); end if;
  end loop;
  return new;
end $$;
drop trigger if exists realisasi_guard on public.realisasi;
create trigger realisasi_guard before insert or update on public.realisasi
  for each row execute function public.realisasi_guard();

-- aturan status dijaga trigger realisasi_guard agar pesan errornya jelas
alter table public.realisasi enable row level security;
drop policy if exists rl_read on public.realisasi;
create policy rl_read on public.realisasi for select to authenticated using (public.is_admin() or kua_id = public.my_kua());
drop policy if exists rl_ins on public.realisasi;
create policy rl_ins on public.realisasi for insert to authenticated with check (kua_id = public.my_kua());
drop policy if exists rl_upd on public.realisasi;
create policy rl_upd on public.realisasi for update to authenticated
  using (public.is_admin() or kua_id = public.my_kua())
  with check (public.is_admin() or kua_id = public.my_kua());

-- 9b) PEMBAYARAN SAKTI --------------------------------------------------------------------------------------
-- Hanya Listrik (522111) dan Telepon/Internet (522112) yang dibayar lewat SAKTI (autopayment). Pengaturannya GLOBAL: satu
-- ceklis per KUA + POS, tanpa bulan/tahun berlaku (tabel metode_pembayaran; belum diatur = MANUAL).
--   Tercentang (SAKTI) : admin menginput nominalnya tiap bulan di Realisasi SAKTI (tabel realisasi_sakti, 1 baris = KUA x POS x
--                        bulan, hanya nominal); operator tidak dapat mengisinya.
--   Tidak tercentang   : MANUAL, operator mengisi Realisasi seperti biasa.
-- Realisasi SAKTI dijumlahkan dengan Realisasi manual pada semua validasi dan laporan. Agar tidak terhitung ganda, satu bulan
-- hanya boleh punya satu sumber per POS: Realisasi SAKTI ditolak bila Realisasi manual bulan itu sudah memuat POS yang sama.
-- Tidak ada DELETE untuk siapa pun (data keuangan): koreksi dengan UPDATE (nominal dikosongkan = Rp 0).

create table if not exists public.metode_pembayaran (
  kua_id int not null references public.kua(id),
  pos_id int not null references public.pos(id),
  metode text not null check (metode in ('MANUAL','SAKTI')),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  primary key (kua_id, pos_id)
);

create table if not exists public.realisasi_sakti (
  id bigint generated by default as identity primary key,
  kua_id int not null references public.kua(id),
  pos_id int not null references public.pos(id),
  tahun int not null check (tahun between 2020 and 2100),
  bulan int not null check (bulan between 1 and 12),
  nominal bigint not null default 0 check (nominal >= 0),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  unique (kua_id, pos_id, tahun, bulan)
);
create index if not exists realisasi_sakti_filter on public.realisasi_sakti (tahun, bulan, kua_id);

-- Air (522113) tidak lagi dibayar lewat SAKTI: pengaturan dan baris Realisasi SAKTI-nya dibersihkan (Air tetap POS manual biasa).
-- Dibatalkan bila ada Realisasi SAKTI Air yang bernominal, supaya tidak ada uang yang hilang diam-diam.
do $$
declare air int; n bigint;
begin
  select id into air from public.pos where kode_pos = '522113';
  if air is null then return; end if;
  select count(*) into n from public.realisasi_sakti where pos_id = air and nominal > 0;
  if n > 0 then
    raise exception 'Dibatalkan: ada % baris Realisasi SAKTI untuk Air (522113) bernominal > 0, padahal SAKTI hanya Listrik dan Telepon/Internet. Pindahkan nilainya ke Realisasi manual lebih dulu, lalu jalankan: delete from public.realisasi_sakti where pos_id = %;', n, air;
  end if;
  delete from public.realisasi_sakti where pos_id = air;
  delete from public.metode_pembayaran where pos_id = air;
end $$;

-- (database lama) Pengaturan berversi per bulan -> satu baris global per KUA + POS: dipakai versi yang berlaku SAAT INI
-- (versi yang mulai berlakunya masih di masa depan dibuang). Kolom mulai, created_by, created_at dihapus.
do $$
declare pk text;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'metode_pembayaran' and column_name = 'mulai') then
    drop trigger if exists metode_guard on public.metode_pembayaran;
    delete from public.metode_pembayaran where mulai > date_trunc('month', now() at time zone 'Asia/Jakarta')::date;
    delete from public.metode_pembayaran a using public.metode_pembayaran b
     where a.kua_id = b.kua_id and a.pos_id = b.pos_id and a.mulai < b.mulai;
    select conname into pk from pg_constraint where conrelid = 'public.metode_pembayaran'::regclass and contype = 'p';
    execute format('alter table public.metode_pembayaran drop constraint %I', pk);
    alter table public.metode_pembayaran drop column mulai, drop column if exists created_by, drop column if exists created_at;
    alter table public.metode_pembayaran add primary key (kua_id, pos_id);
  end if;
end $$;

-- (database lama) Realisasi SAKTI tanpa status/tanggal/keterangan: baris "Belum dibayar" (Rp 0) dibuang, kolom yang tidak
-- berguna dihapus (status_bayar, tanggal_bayar, sumber, catatan, created_by, created_at).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'realisasi_sakti' and column_name = 'status_bayar') then
    drop trigger if exists realisasi_sakti_guard on public.realisasi_sakti;
    delete from public.realisasi_sakti where nominal = 0;
    alter table public.realisasi_sakti drop column status_bayar, drop column if exists tanggal_bayar, drop column if exists sumber,
      drop column if exists catatan, drop column if exists created_by, drop column if exists created_at;
  end if;
end $$;

create or replace function public.pos_sakti_ok(p_pos int) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from pos where id = p_pos and kode_pos in ('522111','522112'));
$$;

-- Metode KUA + POS (global): belum diatur = MANUAL
create or replace function public.metode_pos(p_kua int, p_pos int) returns text
language sql stable set search_path = public as $$
  select coalesce((select metode from metode_pembayaran where kua_id = p_kua and pos_id = p_pos), 'MANUAL');
$$;
drop function if exists public.metode_pos(int, int, int, int);

-- Realisasi SAKTI satu KUA pada satu bulan: {"<id POS>": nominal}. Nominal 0 (dikosongkan) tidak ikut.
create or replace function public.sakti_items(p_kua int, p_tahun int, p_bulan int) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(pos_id::text, nominal), '{}'::jsonb) from realisasi_sakti
   where kua_id = p_kua and tahun = p_tahun and bulan = p_bulan and nominal > 0;
$$;

create or replace function public.sakti_year(p_kua int, p_pos int, p_tahun int) returns bigint
language sql stable set search_path = public as $$
  select coalesce(sum(nominal), 0)::bigint from realisasi_sakti where kua_id = p_kua and pos_id = p_pos and tahun = p_tahun;
$$;

-- Hanya admin. Pengaturan global: mencentang SAKTI selalu boleh; mengembalikan ke MANUAL ditolak selama KUA + POS itu
-- masih punya Realisasi SAKTI bernominal (kosongkan dulu nominalnya di Realisasi SAKTI).
create or replace function public.metode_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare bad text; ctx text; y int;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengubah pengaturan SAKTI.'; end if;
  if new.kua_id is null or new.pos_id is null or new.metode is null then
    raise exception 'Data pengaturan SAKTI tidak lengkap.'; end if;
  if tg_op = 'UPDATE' and (new.kua_id, new.pos_id) is distinct from (old.kua_id, old.pos_id) then
    raise exception 'KUA dan POS tidak dapat diubah.'; end if;
  select nama_kua into ctx from kua where id = new.kua_id;
  if ctx is null then raise exception 'KUA tidak ditemukan.'; end if;
  if not pos_sakti_ok(new.pos_id) then
    raise exception 'SAKTI hanya dapat diatur untuk Listrik (522111) dan Telepon/Internet (522112).'; end if;
  -- kunci yang sama dengan guard Realisasi SAKTI (KUA + tahun) agar tidak berbalapan
  for y in select distinct tahun from realisasi_sakti where kua_id = new.kua_id order by 1 loop
    perform pg_advisory_xact_lock(new.kua_id, y);
  end loop;
  if new.metode = 'MANUAL' then
    select nama_bulan(s.bulan) || ' ' || s.tahun into bad from realisasi_sakti s
     where s.kua_id = new.kua_id and s.pos_id = new.pos_id and s.nominal > 0 order by s.tahun, s.bulan limit 1;
    if bad is not null then
      raise exception '%: POS % sudah punya Realisasi SAKTI (mulai %), jadi belum bisa dikembalikan ke MANUAL. Kosongkan dulu nominalnya di menu Realisasi SAKTI.',
        ctx, pos_label(new.pos_id), bad; end if;
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists metode_guard on public.metode_pembayaran;
create trigger metode_guard before insert or update on public.metode_pembayaran
  for each row execute function public.metode_guard();

-- Hanya admin; POS harus tercentang SAKTI; periode sudah berjalan (WIB); nominal 0..9.999.999.999.
-- Jumlahnya ikut aturan yang sama dengan Realisasi manual: (manual + SAKTI) sebulan <= RPD bulan itu, dan POS setahun <= RPD POS setahun.
create or replace function public.realisasi_sakti_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ctx text; rpd_m bigint; man_m bigint; sak_m bigint; cap bigint; used bigint; man_pos bigint;
begin
  if not public.is_admin() then raise exception 'Realisasi SAKTI hanya dapat diinput oleh Admin.'; end if;
  if new.kua_id is null or new.pos_id is null then raise exception 'KUA dan POS wajib diisi.'; end if;
  if tg_op = 'UPDATE' and (new.kua_id, new.pos_id, new.tahun, new.bulan) is distinct from (old.kua_id, old.pos_id, old.tahun, old.bulan) then
    raise exception 'KUA, POS, tahun, dan bulan tidak dapat diubah. Input data baru untuk periode lain.'; end if;
  if new.tahun is null or new.bulan is null or new.tahun not between 2020 and 2100 or new.bulan not between 1 and 12 then
    raise exception 'Tahun atau bulan tidak valid.'; end if;
  select nama_kua into ctx from kua where id = new.kua_id;
  if ctx is null then raise exception 'KUA tidak ditemukan.'; end if;
  if not pos_sakti_ok(new.pos_id) then
    raise exception '%: POS % tidak dapat dibayar lewat SAKTI. Hanya Listrik dan Telepon/Internet.', ctx, coalesce(pos_label(new.pos_id), new.pos_id::text); end if;
  if coalesce(new.nominal, -1) < 0 then raise exception 'Nominal tidak boleh negatif.'; end if;
  if new.nominal > nominal_max() then raise exception '%: nominal maksimal 10 digit (Rp 9.999.999.999).', ctx; end if;
  if metode_pos(new.kua_id, new.pos_id) <> 'SAKTI' then
    raise exception '%: POS % belum dicentang SAKTI di Pengaturan SAKTI.', ctx, pos_label(new.pos_id); end if;
  if make_date(new.tahun, new.bulan, 1) > date_trunc('month', now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Realisasi SAKTI % % belum dapat diinput karena periodenya belum berjalan.', nama_bulan(new.bulan), new.tahun; end if;

  perform pg_advisory_xact_lock(new.kua_id, new.tahun);
  if new.nominal > 0 and (tg_op = 'INSERT' or new.nominal is distinct from old.nominal) then
    select coalesce((items ->> new.pos_id::text)::bigint, 0) into man_pos from realisasi
     where kua_id = new.kua_id and tahun = new.tahun and bulan = new.bulan;
    if coalesce(man_pos, 0) > 0 then
      raise exception '%: POS % sudah punya Realisasi manual pada % %. Realisasi SAKTI tidak dapat diinput untuk bulan yang sudah diisi manual.',
        ctx, pos_label(new.pos_id), nama_bulan(new.bulan), new.tahun; end if;
    select coalesce(sum(total), 0) into rpd_m from rpd where kua_id = new.kua_id and tahun = new.tahun and bulan = new.bulan;
    select coalesce(sum(total), 0) into man_m from realisasi where kua_id = new.kua_id and tahun = new.tahun and bulan = new.bulan;
    select coalesce(sum(nominal), 0) into sak_m from realisasi_sakti
     where kua_id = new.kua_id and tahun = new.tahun and bulan = new.bulan and pos_id <> new.pos_id;
    if man_m + sak_m + new.nominal > rpd_m then
      raise exception '%: total Realisasi % melebihi RPD bulan ini. Batas: %, Manual: %, SAKTI POS lain: %, dimasukkan: %, kelebihan: %.',
        ctx, nama_bulan(new.bulan), rp(rpd_m), rp(man_m), rp(sak_m), rp(new.nominal), rp(man_m + sak_m + new.nominal - rpd_m); end if;
    select coalesce(sum((items ->> new.pos_id::text)::bigint), 0) into cap from rpd where kua_id = new.kua_id and tahun = new.tahun;
    select coalesce(sum((items ->> new.pos_id::text)::bigint), 0) into used from realisasi where kua_id = new.kua_id and tahun = new.tahun;
    select used + coalesce(sum(nominal), 0) into used from realisasi_sakti
     where kua_id = new.kua_id and pos_id = new.pos_id and tahun = new.tahun and bulan <> new.bulan;
    if used + new.nominal > cap then
      raise exception '%: Realisasi POS % melebihi total RPD setahun. Batas: %, terpakai (bulan lain): %, dimasukkan: %, kelebihan: %.',
        ctx, pos_label(new.pos_id), rp(cap), rp(used), rp(new.nominal), rp(used + new.nominal - cap); end if;
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists realisasi_sakti_guard on public.realisasi_sakti;
create trigger realisasi_sakti_guard before insert or update on public.realisasi_sakti
  for each row execute function public.realisasi_sakti_guard();

-- RLS: admin membaca dan menulis semua; operator hanya MEMBACA milik KUA-nya. Tanpa policy DELETE.
alter table public.metode_pembayaran enable row level security;
drop policy if exists mp_read on public.metode_pembayaran;
create policy mp_read on public.metode_pembayaran for select to authenticated using (public.is_admin() or kua_id = public.my_kua());
drop policy if exists mp_ins on public.metode_pembayaran;
create policy mp_ins on public.metode_pembayaran for insert to authenticated with check (public.is_admin());
drop policy if exists mp_upd on public.metode_pembayaran;
create policy mp_upd on public.metode_pembayaran for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.realisasi_sakti enable row level security;
drop policy if exists rs_read on public.realisasi_sakti;
create policy rs_read on public.realisasi_sakti for select to authenticated using (public.is_admin() or kua_id = public.my_kua());
drop policy if exists rs_ins on public.realisasi_sakti;
create policy rs_ins on public.realisasi_sakti for insert to authenticated with check (public.is_admin());
drop policy if exists rs_upd on public.realisasi_sakti;
create policy rs_upd on public.realisasi_sakti for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lapisan tambahan di atas RLS: tanpa DELETE/TRUNCATE untuk klien, dan anon tidak punya akses sama sekali
revoke all on public.metode_pembayaran, public.realisasi_sakti from anon;
revoke delete, truncate on public.metode_pembayaran, public.realisasi_sakti from authenticated;

-- 9c) IMPOR DATA LAMA (menu "Impor Data Lama", hanya admin) --------------------------------------------------------
-- Menulis data dari Spreadsheet/Apps Script lama ke tabel baru per baris; satu baris gagal tidak membatalkan yang lain
-- (alasannya dikembalikan). Semua aturan database tetap berlaku (batas anggaran/RPD, SAKTI), kecuali aturan PROSES operator
-- pada Realisasi (lihat realisasi_guard). p_jenis: anggaran | metode | rpd | realisasi | sakti.
--   p_timpa = false : baris yang sudah ada dilewati (data baru di Supabase tidak tertimpa). true : ditimpa.
-- Hasil: {"ok": n, "lewati": n, "gagal": [{"kua_id","tahun","bulan","pos_id","pesan"}]}
create or replace function public.impor_baris(p_jenis text, p_rows jsonb, p_timpa boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; ok int := 0; lewati int := 0; gagal jsonb := '[]'::jsonb; ada boolean;
        kid int; thn int; bln int; pid int;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengimpor data.'; end if;
  if p_jenis not in ('anggaran', 'metode', 'rpd', 'realisasi', 'sakti') then raise exception 'Jenis data impor tidak dikenal.'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Format data impor tidak valid.'; end if;
  if jsonb_array_length(p_rows) > 300 then raise exception 'Maksimal 300 baris per panggilan.'; end if;
  perform set_config('bop.impor', 'on', true);
  for r in select value from jsonb_array_elements(p_rows) loop
    begin
      kid := (r ->> 'kua_id')::int; thn := (r ->> 'tahun')::int; bln := (r ->> 'bulan')::int; pid := (r ->> 'pos_id')::int;
      if p_jenis = 'anggaran' then
        select exists (select 1 from anggaran where tahun = thn and items ? kid::text) into ada;
        if ada and not p_timpa then lewati := lewati + 1; continue; end if;
        perform public.set_anggaran(thn, jsonb_build_object(kid::text, (r ->> 'nominal')::bigint));

      elsif p_jenis = 'metode' then
        select exists (select 1 from metode_pembayaran where kua_id = kid and pos_id = pid) into ada;
        if ada and not p_timpa then lewati := lewati + 1; continue; end if;
        update metode_pembayaran set metode = r ->> 'metode' where kua_id = kid and pos_id = pid;
        if not found then insert into metode_pembayaran (kua_id, pos_id, metode) values (kid, pid, r ->> 'metode'); end if;

      elsif p_jenis = 'rpd' then
        select exists (select 1 from rpd where kua_id = kid and tahun = thn and bulan = bln) into ada;
        if ada and not p_timpa then lewati := lewati + 1; continue; end if;
        update rpd set items = r -> 'items' where kua_id = kid and tahun = thn and bulan = bln;
        if not found then insert into rpd (kua_id, tahun, bulan, items) values (kid, thn, bln, r -> 'items'); end if;

      elsif p_jenis = 'realisasi' then
        select exists (select 1 from realisasi where kua_id = kid and tahun = thn and bulan = bln) into ada;
        if ada and not p_timpa then
          -- sudah ada: hanya lengkapi tautan folder LPJ bila masih kosong (berkas yang gagal disalin pertama kali)
          if r ->> 'file_lpj_url' is not null then
            update realisasi set file_lpj_url = r ->> 'file_lpj_url' where kua_id = kid and tahun = thn and bulan = bln and file_lpj_url is null;
          end if;
          lewati := lewati + 1; continue;
        end if;
        update realisasi set items = r -> 'items', status = r ->> 'status', file_lpj_url = coalesce(r ->> 'file_lpj_url', file_lpj_url),
               catatan_admin = nullif(btrim(coalesce(r ->> 'catatan_admin', '')), ''),
               submitted_at = coalesce((r ->> 'submitted_at')::timestamptz, submitted_at, now()),
               verified_at = (r ->> 'verified_at')::timestamptz, paid_at = (r ->> 'paid_at')::timestamptz,
               nominal_dibayar = null
         where kua_id = kid and tahun = thn and bulan = bln;
        if not found then
          insert into realisasi (kua_id, tahun, bulan, items, status, file_lpj_url, catatan_admin, submitted_at, verified_at, paid_at)
          values (kid, thn, bln, r -> 'items', r ->> 'status', r ->> 'file_lpj_url',
                  nullif(btrim(coalesce(r ->> 'catatan_admin', '')), ''),
                  coalesce((r ->> 'submitted_at')::timestamptz, now()), (r ->> 'verified_at')::timestamptz, (r ->> 'paid_at')::timestamptz);
        end if;

      else  -- sakti
        select exists (select 1 from realisasi_sakti where kua_id = kid and pos_id = pid and tahun = thn and bulan = bln and nominal > 0) into ada;
        if ada and not p_timpa then lewati := lewati + 1; continue; end if;
        update realisasi_sakti set nominal = (r ->> 'nominal')::bigint where kua_id = kid and pos_id = pid and tahun = thn and bulan = bln;
        if not found then insert into realisasi_sakti (kua_id, pos_id, tahun, bulan, nominal) values (kid, pid, thn, bln, (r ->> 'nominal')::bigint); end if;
      end if;
      ok := ok + 1;
    exception when others then
      gagal := gagal || jsonb_build_array(jsonb_build_object('kua_id', kid, 'tahun', thn, 'bulan', bln, 'pos_id', pid, 'pesan', sqlerrm));
    end;
  end loop;
  perform set_config('bop.impor', 'off', true);
  return jsonb_build_object('ok', ok, 'lewati', lewati, 'gagal', gagal);
end $$;
revoke execute on function public.impor_baris(text, jsonb, boolean) from public, anon;
grant execute on function public.impor_baris(text, jsonb, boolean) to authenticated;

-- 10) SALIN DATA LAMA (hanya bila tabel lama ada dan tabel baru masih kosong) --------------------------
-- Baris AutoPayment lama tidak disalin (digantikan SAKTI, bagian 9b).
-- Anggaran per KUA (anggaran_lama) -> 1 baris per tahun. Lebih dulu dari RPD karena RPD dibatasi anggaran.
do $$ begin
  if to_regclass('public.anggaran_lama') is not null and not exists (select 1 from public.anggaran) then
    insert into public.anggaran (tahun, items)
    select tahun, coalesce(jsonb_object_agg(kua_id::text, nominal_total) filter (where nominal_total > 0), '{}'::jsonb)
      from public.anggaran_lama group by tahun;
  end if;
end $$;
do $$ begin
  if to_regclass('public.rpd_lama') is not null and not exists (select 1 from public.rpd) then
    insert into public.rpd (kua_id, tahun, bulan, items, total, updated_by, updated_at)
    select kua_id, tahun, bulan,
           coalesce(jsonb_object_agg(pos_id::text, nominal) filter (where nominal > 0), '{}'::jsonb),
           sum(nominal), (array_agg(updated_by))[1], max(updated_at)
      from public.rpd_lama group by kua_id, tahun, bulan;
  end if;
  if to_regclass('public.realisasi_lama') is not null and not exists (select 1 from public.realisasi) then
    insert into public.realisasi (kua_id, tahun, bulan, items, total, status, file_lpj_url, catatan_admin,
                                  submitted_by, submitted_at, verified_by, verified_at, paid_at)
    select kua_id, tahun, bulan,
           coalesce(jsonb_object_agg(pos_id::text, nominal) filter (where nominal > 0), '{}'::jsonb), sum(nominal),
           case when bool_or(status = 'rejected') then 'rejected' when bool_or(status = 'waiting') then 'waiting'
                when bool_or(status = 'approved') then 'approved' else 'paid' end,
           max(file_lpj_url), max(catatan_admin), (array_agg(submitted_by))[1], max(submitted_at),
           (array_agg(verified_by))[1], max(verified_at), max(paid_at)
      from public.realisasi_lama where not is_autopayment group by kua_id, tahun, bulan;
  end if;
end $$;

-- 11) PEMBERSIHAN: penerbitan otomatis lama, AutoPayment lama, dan tabel lama ---------------------------
do $$ begin perform cron.unschedule('autopayment-harian'); exception when others then null; end $$;
drop function if exists public.generate_autopayment(int, int);
drop function if exists public.realisasi_month_lock();

-- Hapus rpd_lama / realisasi_lama. Pengaman: dibatalkan bila ada bulan lama yang belum punya record baru.
do $$
declare hilang int;
begin
  if to_regclass('public.rpd_lama') is not null then
    select count(*) into hilang from (select distinct kua_id, tahun, bulan from public.rpd_lama) l
     where not exists (select 1 from public.rpd n where n.kua_id = l.kua_id and n.tahun = l.tahun and n.bulan = l.bulan);
    if hilang > 0 then
      raise exception 'Dibatalkan: % bulan RPD lama belum ada di tabel baru. Jalankan migration-07 lebih dulu.', hilang;
    end if;
  end if;
  if to_regclass('public.realisasi_lama') is not null then
    select count(*) into hilang from (select distinct kua_id, tahun, bulan from public.realisasi_lama where not is_autopayment) l
     where not exists (select 1 from public.realisasi n where n.kua_id = l.kua_id and n.tahun = l.tahun and n.bulan = l.bulan);
    if hilang > 0 then
      raise exception 'Dibatalkan: % bulan Realisasi lama belum ada di tabel baru. Jalankan migration-07 lebih dulu.', hilang;
    end if;
  end if;
end $$;

drop table if exists public.rpd_lama;
drop table if exists public.realisasi_lama;

-- Hapus anggaran_lama (struktur per KUA). Pengaman: dibatalkan bila ada anggaran lama yang belum sama di tabel baru.
do $$
declare hilang int;
begin
  if to_regclass('public.anggaran_lama') is not null then
    select count(*) into hilang from public.anggaran_lama l
     where l.nominal_total > 0
       and coalesce((select (a.items ->> l.kua_id::text)::bigint from public.anggaran a where a.tahun = l.tahun), 0) <> l.nominal_total;
    if hilang > 0 then
      raise exception 'Dibatalkan: % anggaran lama belum sama di tabel anggaran yang baru.', hilang;
    end if;
  end if;
end $$;
drop table if exists public.anggaran_lama;

-- AutoPayment lama (nominal tetap) sudah digantikan SAKTI: hapus fungsi, tabel arsip, dan penanda migrasinya.
-- Pengaman: tabel arsip hanya dihapus bila migrasi ke SAKTI pernah berjalan (penanda ada) atau tabelnya tidak berisi nominal.
drop trigger if exists autopayment_pos_guard on public.autopayment_pos;
do $$ begin
  if to_regclass('public.autopayment_pos') is not null then
    if exists (select 1 from public.config where key = 'sakti_migrasi_autopayment')
       or not exists (select 1 from public.autopayment_pos where nominal > 0) then
      drop table public.autopayment_pos;
    else
      raise notice 'autopayment_pos masih berisi nominal dan belum pernah dimigrasikan ke SAKTI: tabel DIBIARKAN. Pindahkan datanya lewat menu Impor Data Lama atau Realisasi SAKTI, lalu jalankan ulang file ini.';
    end if;
  end if;
end $$;
drop function if exists public.autopayment_pos_guard();
drop function if exists public.auto_items(int, int, int);
drop function if exists public.auto_year(int, int, int);
drop function if exists public.set_autopayment(jsonb);
delete from public.config where key in ('sakti_migrasi_autopayment', 'wajib_lpj');
-- 12) JASPRO TRANSPORT (alat sekali pakai: Laporan Nominatif PNBP NR) ---------------------------------------
-- Hemat kuota: HANYA SATU baris (id = 1). Setiap simpan menimpa kolom yang dikirim; tanpa riwayat, log, atau tabel per bulan.
-- master = Master Rekening [{id,nama,namaPemilik,noRekening}] | laporan = {fileName, rows:[...]} terakhir (null = belum ada)
-- settings = periode, tarif, PPh, blok tanda tangan. Hanya admin yang boleh membaca dan menulis (RLS).
create table if not exists public.jaspro_data (
  id         int primary key default 1 check (id = 1),
  master     jsonb not null default '[]'::jsonb,
  laporan    jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create or replace function public.jaspro_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if jsonb_typeof(new.master) is distinct from 'array' then raise exception 'Master Rekening harus berupa daftar.'; end if;
  if jsonb_array_length(new.master) > 2000 then raise exception 'Master Rekening maksimal 2000 data.'; end if;
  if new.laporan is not null then
    if jsonb_typeof(new.laporan) is distinct from 'object' or jsonb_typeof(new.laporan->'rows') is distinct from 'array' then
      raise exception 'Laporan Nominatif tidak valid.'; end if;
    if jsonb_array_length(new.laporan->'rows') > 5000 then raise exception 'Laporan Nominatif maksimal 5000 baris.'; end if;
  end if;
  if jsonb_typeof(new.settings) is distinct from 'object' then raise exception 'Pengaturan Jaspro tidak valid.'; end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists jaspro_guard on public.jaspro_data;
create trigger jaspro_guard before insert or update on public.jaspro_data for each row execute function public.jaspro_guard();

alter table public.jaspro_data enable row level security;
drop policy if exists jaspro_admin on public.jaspro_data;
create policy jaspro_admin on public.jaspro_data for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.jaspro_data from anon;
grant select, insert, update on public.jaspro_data to authenticated;
insert into public.jaspro_data (id) values (1) on conflict (id) do nothing;

-- 13) BAST NR (Berita Acara Serah Terima Sarana Administrasi NR) -------------------------------------------------
-- Pindahan dari Google Spreadsheet/Apps Script. Hanya admin (RLS). Data lama dipindahkan dengan: node --env-file=.env bop.mjs bast
-- bast_ba menyimpan "potret" pihak pertama/kedua (nama, jabatan, alamat) seperti sheet Master lama; arsip dokumen ada di Google Drive
-- (arsip_id = file yang diunggah lewat aplikasi; arsip_link saja = arsip lama dari Apps Script, hanya tautan).
create table if not exists public.bast_pegawai (
  nip      text primary key,
  nama     text not null,
  kategori text not null check (kategori in ('Bimas Islam', 'KUA')),
  jabatan  text not null,
  kua      text not null default '',
  alamat   text not null
);
create table if not exists public.bast_ba (
  id                  bigint generated always as identity primary key,
  nomor_urut          int  not null check (nomor_urut > 0),
  tahun               int  not null check (tahun between 2000 and 2100),
  bln_srt             int,
  hari                text not null default '', tgl text not null default '', bln text not null default '',
  pihak_satu_nip      text not null default '', pihak_satu_nama   text not null default '',
  pihak_satu_jabatan  text not null default '', pihak_satu_alamat text not null default '',
  pihak_kedua_nip     text not null default '', pihak_kedua_nama   text not null default '',
  pihak_kedua_jabatan text not null default '', pihak_kedua_alamat text not null default '',
  banyak_na_buku int, banyak_n int, banyak_nb int,
  no_seri             text not null default '',
  porporasi           text not null default '',          -- rentang sebagai teks, mis. "115827401- 115827600" (format data lama)
  kasi_nama           text not null default '', kasi_nip text not null default '',
  status_simkah       text not null default 'Belum' check (status_simkah in ('Sudah', 'Belum')),
  arsip_id            text,
  arsip_link          text,
  updated_by          uuid references auth.users(id),
  updated_at          timestamptz not null default now(),
  unique (nomor_urut, tahun)
);
create table if not exists public.bast_setting (
  key   text primary key,   -- KASI_NAMA, KASI_NIP, NOMOR_AWAL_SURAT, KODE_KANTOR, KODE_KLASIFIKASI, NOMOR_FORMAT_TEMPLATE, ALAMAT_BIMAS_LENGKAP, LAST_NUMBER, LAST_NUMBER_YEAR
  value text not null default ''
);

-- Aturan penyimpanan BA baru (dijaga di database): nomor tidak ganda, porporasi tidak tumpang-tindih, pihak dan Kasi terisi,
-- LAST_NUMBER hanya maju. auth.uid() kosong = jalur server tepercaya (skrip migrasi / SQL Editor) -> tidak diperiksa.
create or replace function public.bast_ba_guard() returns trigger
language plpgsql set search_path = public as $$
declare a bigint; b bigint; m text[]; r record; v_last int; v_year text;
begin
  if auth.uid() is null then return new; end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  if tg_op = 'UPDATE' then return new; end if;
  perform pg_advisory_xact_lock(7001);
  if exists (select 1 from bast_ba where nomor_urut = new.nomor_urut and tahun = new.tahun) then
    raise exception 'Nomor Urut % untuk tahun % sudah dipakai. Muat ulang halaman untuk usulan nomor terbaru.', new.nomor_urut, new.tahun; end if;
  if new.pihak_satu_nip = '' or new.pihak_kedua_nip = '' then raise exception 'Pihak Pertama dan Pihak Kedua wajib dipilih.'; end if;
  if new.kasi_nama = '' or new.kasi_nip = '' then raise exception 'Data Kepala Seksi (Mengetahui) wajib diisi: periksa Pengaturan BAST.'; end if;
  m := regexp_match(new.porporasi, '(\d+)\s*-\s*(\d+)');
  if m is null then raise exception 'Nomor porporasi awal dan akhir wajib diisi dengan angka.'; end if;
  a := m[1]::bigint; b := m[2]::bigint;
  if b < a then raise exception 'Nomor porporasi akhir tidak boleh lebih kecil dari awal.'; end if;
  for r in select nomor_urut, porporasi from bast_ba where porporasi ~ '\d+\s*-\s*\d+' loop
    m := regexp_match(r.porporasi, '(\d+)\s*-\s*(\d+)');
    if a <= m[2]::bigint and b >= m[1]::bigint then
      raise exception 'Nomor porporasi sudah digunakan pada BA Nomor % (rentang %).', lpad(r.nomor_urut::text, 3, '0'), r.porporasi; end if;
  end loop;
  select value::int into v_last from bast_setting where key = 'LAST_NUMBER' and value ~ '^\d+$';
  select value into v_year from bast_setting where key = 'LAST_NUMBER_YEAR';
  if v_year is distinct from new.tahun::text or new.nomor_urut > coalesce(v_last, 0) then
    insert into bast_setting (key, value) values ('LAST_NUMBER', new.nomor_urut::text), ('LAST_NUMBER_YEAR', new.tahun::text)
    on conflict (key) do update set value = excluded.value;
  end if;
  return new;
end $$;
drop trigger if exists bast_ba_guard on public.bast_ba;
create trigger bast_ba_guard before insert or update on public.bast_ba for each row execute function public.bast_ba_guard();

do $$ declare t text; begin
  foreach t in array array['bast_pegawai', 'bast_ba', 'bast_setting'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;