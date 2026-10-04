-- =====================================================================================
-- BOP KUA Kabupaten Indramayu: MIGRATION PEMBAYARAN SAKTI (MANUAL / SAKTI per KUA + POS)
--
-- Untuk database yang SUDAH berjalan. Supabase > SQL Editor > New query > tempel seluruh isi > Run.
-- Aman dijalankan berulang (idempotent) dan tidak menghapus data. Isi yang sama sudah ada di bop.sql terbaru
-- (bagian 9 dan 9b), jadi pemasangan baru cukup memakai bop.sql.
--
-- Yang dilakukan:
--   1. Tabel baru metode_pembayaran (metode per KUA + POS, berversi per bulan berlaku; belum diatur = MANUAL).
--   2. Tabel baru realisasi_sakti (Realisasi SAKTI per KUA + POS + bulan; hanya admin yang menulis).
--   3. realisasi_guard diganti: POS bermetode SAKTI tidak bisa diisi operator, dan Realisasi SAKTI ikut dihitung
--      pada batas RPD bulanan dan tahunan (menggantikan perhitungan AutoPayment nominal tetap).
--   4. Migrasi sekali: AutoPayment lama (autopayment_pos) menjadi metode SAKTI + baris Realisasi SAKTI "Sudah dibayar"
--      untuk bulan-bulan yang sudah berjalan, jadi total bulan lalu tidak berubah. Tabel autopayment_pos disimpan sebagai arsip.
--
-- Pembatalan (bila perlu): jalankan kembali realisasi_guard dari bop.sql lama; tabel baru boleh dibiarkan.
-- =====================================================================================

do $$ begin
  if to_regclass('public.realisasi') is null or to_regclass('public.autopayment_pos') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'realisasi' and column_name = 'items') then
    raise exception 'Skema dasar belum ada atau masih versi lama. Jalankan bop.sql terlebih dahulu, lalu migration ini.';
  end if;
end $$;

-- A) realisasi_guard (menggantikan fungsi lama; trigger realisasi_guard yang sudah ada otomatis memakainya)
create or replace function public.realisasi_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare sk jsonb; rpd_m bigint; sk_m bigint; ctx text; k text; v bigint; cap bigint; used bigint;
begin
  if tg_op = 'UPDATE' and public.is_admin() then
    if (new.kua_id, new.tahun, new.bulan, new.items, new.total, new.file_lpj_url)
       is distinct from (old.kua_id, old.tahun, old.bulan, old.items, old.total, old.file_lpj_url) then
      raise exception 'Admin hanya dapat mengubah status dan catatan, bukan nominal atau dokumen LPJ.'; end if;
    if new.status = 'rejected' and btrim(coalesce(new.catatan_admin, '')) = '' then
      raise exception 'Alasan penolakan wajib diisi.'; end if;
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
  new.paid_at := null; new.status := 'waiting'; new.submitted_by := auth.uid(); new.submitted_at := now();
  new.items := norm_items(new.items); new.total := items_total(new.items);

  if coalesce((select (value #>> '{}')::boolean from config where key = 'realisasi_enabled'), false) is not true then
    raise exception 'Pengisian Realisasi sedang ditutup oleh admin.'; end if;
  if (now() at time zone 'Asia/Jakarta')::date < make_date(new.tahun, new.bulan, 10) then
    raise exception 'Realisasi % % baru dapat disubmit mulai tanggal 10 %.', nama_bulan(new.bulan), new.tahun, nama_bulan(new.bulan); end if;
  if new.total > 0 and new.file_lpj_url is null then
    raise exception 'LPJ wajib dilampirkan (unggah file LPJ).'; end if;

  select nama_kua into ctx from kua where id = new.kua_id;
  perform pg_advisory_xact_lock(new.kua_id, new.tahun);
  -- POS bermetode SAKTI pada bulan itu hanya diinput admin (tabel realisasi_sakti), tidak boleh diisi operator
  for k in select jsonb_object_keys(new.items) loop
    if metode_pos(new.kua_id, k::int, new.tahun, new.bulan) = 'SAKTI' then
      raise exception '%: POS % bermetode SAKTI pada % %. Realisasinya diinput oleh Admin dan tidak dapat diisi manual.',
        ctx, pos_label(k::int), nama_bulan(new.bulan), new.tahun; end if;
  end loop;
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

-- 9b) PEMBAYARAN SAKTI --------------------------------------------------------------------------------------
-- Tiap KUA + POS punya metode pembayaran: MANUAL (operator mengisi Realisasi) atau SAKTI (admin menginput Realisasi SAKTI;
-- operator tidak bisa mengisinya). Hanya Listrik 522111, Telepon/Internet 522112, dan Air 522113 yang dapat memakai SAKTI.
-- KUA + POS yang belum diatur = MANUAL (perilaku lama tidak berubah).
-- Konfigurasi berversi per bulan berlaku (mulai): metode suatu bulan = versi terbaru dengan mulai <= bulan itu. Mengganti
-- metode hanya mengubah bulan sejak berlaku; Realisasi bulan sebelumnya (manual maupun SAKTI) tidak disentuh.
-- Realisasi SAKTI disimpan terpisah (realisasi_sakti, 1 baris = KUA x POS x bulan) dan dijumlahkan dengan Realisasi manual
-- pada semua validasi dan laporan. Tidak ada DELETE untuk siapa pun (data keuangan): koreksi dengan UPDATE.

create table if not exists public.metode_pembayaran (
  kua_id int not null references public.kua(id),
  pos_id int not null references public.pos(id),
  metode text not null check (metode in ('MANUAL','SAKTI')),
  mulai date not null check (extract(day from mulai) = 1 and mulai between date '2020-01-01' and date '2100-12-01'),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  primary key (kua_id, pos_id, mulai)
);

create table if not exists public.realisasi_sakti (
  id bigint generated by default as identity primary key,
  kua_id int not null references public.kua(id),
  pos_id int not null references public.pos(id),
  tahun int not null check (tahun between 2020 and 2100),
  bulan int not null check (bulan between 1 and 12),
  nominal bigint not null default 0 check (nominal >= 0),
  status_bayar text not null default 'BELUM_DIBAYAR' check (status_bayar in ('BELUM_DIBAYAR','SUDAH_DIBAYAR')),
  tanggal_bayar date,
  sumber text not null default 'SAKTI' check (sumber = 'SAKTI'),
  catatan text check (catatan is null or char_length(catatan) <= 500),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  unique (kua_id, pos_id, tahun, bulan),
  check (status_bayar = 'SUDAH_DIBAYAR' or (nominal = 0 and tanggal_bayar is null))
);
create index if not exists realisasi_sakti_filter on public.realisasi_sakti (tahun, bulan, kua_id);

create or replace function public.pos_sakti_ok(p_pos int) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from pos where id = p_pos and kode_pos in ('522111','522112','522113'));
$$;

-- Metode yang berlaku untuk KUA + POS pada suatu bulan (belum ada konfigurasi = MANUAL)
create or replace function public.metode_pos(p_kua int, p_pos int, p_tahun int, p_bulan int) returns text
language sql stable set search_path = public as $$
  select coalesce((select metode from metode_pembayaran
                    where kua_id = p_kua and pos_id = p_pos and mulai <= make_date(p_tahun, p_bulan, 1)
                    order by mulai desc limit 1), 'MANUAL');
$$;

-- Realisasi SAKTI satu KUA pada satu bulan: {"<id POS>": nominal}. Belum dibayar bernominal 0, jadi tidak ikut.
create or replace function public.sakti_items(p_kua int, p_tahun int, p_bulan int) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(pos_id::text, nominal), '{}'::jsonb) from realisasi_sakti
   where kua_id = p_kua and tahun = p_tahun and bulan = p_bulan and nominal > 0;
$$;

create or replace function public.sakti_year(p_kua int, p_pos int, p_tahun int) returns bigint
language sql stable set search_path = public as $$
  select coalesce(sum(nominal), 0)::bigint from realisasi_sakti where kua_id = p_kua and pos_id = p_pos and tahun = p_tahun;
$$;

-- Hanya admin. Versi baru tidak boleh bertabrakan dengan data yang sudah ada pada bulan-bulan yang metodenya berubah:
--   MANUAL -> SAKTI ditolak bila sudah ada Realisasi manual untuk POS itu; SAKTI -> MANUAL ditolak bila sudah ada Realisasi SAKTI.
create or replace function public.metode_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim date; bad text; ctx text; y int; yr int := extract(year from now() at time zone 'Asia/Jakarta')::int;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengubah metode pembayaran.'; end if;
  if new.kua_id is null or new.pos_id is null or new.mulai is null or new.metode is null then
    raise exception 'Data metode pembayaran tidak lengkap.'; end if;
  if tg_op = 'UPDATE' and (new.kua_id, new.pos_id, new.mulai) is distinct from (old.kua_id, old.pos_id, old.mulai) then
    raise exception 'KUA, POS, dan bulan berlaku tidak dapat diubah.'; end if;
  select nama_kua into ctx from kua where id = new.kua_id;
  if ctx is null then raise exception 'KUA tidak ditemukan.'; end if;
  if not pos_sakti_ok(new.pos_id) then
    raise exception 'Metode pembayaran hanya dapat diatur untuk Listrik (522111), Telepon/Internet (522112), dan Air (522113).'; end if;
  -- kunci yang sama dengan guard Realisasi (KUA + tahun) agar tidak berbalapan dengan operator
  for y in extract(year from new.mulai)::int .. greatest(extract(year from new.mulai)::int, yr) loop
    perform pg_advisory_xact_lock(new.kua_id, y);
  end loop;
  select min(mulai) into lim from metode_pembayaran where kua_id = new.kua_id and pos_id = new.pos_id and mulai > new.mulai;
  if new.metode = 'SAKTI' then
    select nama_bulan(r.bulan) || ' ' || r.tahun into bad from realisasi r
     where r.kua_id = new.kua_id and coalesce((r.items ->> new.pos_id::text)::bigint, 0) > 0
       and make_date(r.tahun, r.bulan, 1) >= new.mulai and (lim is null or make_date(r.tahun, r.bulan, 1) < lim)
     order by r.tahun, r.bulan limit 1;
    if bad is not null then
      raise exception '%: POS % sudah punya Realisasi manual pada %, jadi belum bisa SAKTI mulai % %. Pilih bulan berlaku sesudahnya.',
        ctx, pos_label(new.pos_id), bad, nama_bulan(extract(month from new.mulai)::int), extract(year from new.mulai)::int; end if;
  else
    select nama_bulan(s.bulan) || ' ' || s.tahun into bad from realisasi_sakti s
     where s.kua_id = new.kua_id and s.pos_id = new.pos_id and s.nominal > 0
       and make_date(s.tahun, s.bulan, 1) >= new.mulai and (lim is null or make_date(s.tahun, s.bulan, 1) < lim)
     order by s.tahun, s.bulan limit 1;
    if bad is not null then
      raise exception '%: POS % sudah punya Realisasi SAKTI pada %, jadi belum bisa MANUAL mulai % %. Pilih bulan berlaku sesudahnya.',
        ctx, pos_label(new.pos_id), bad, nama_bulan(extract(month from new.mulai)::int), extract(year from new.mulai)::int; end if;
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now();
  else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists metode_guard on public.metode_pembayaran;
create trigger metode_guard before insert or update on public.metode_pembayaran
  for each row execute function public.metode_guard();

-- Hanya admin; POS harus bermetode SAKTI pada bulan itu; periode sudah berjalan (WIB); Belum dibayar = Rp 0; Sudah dibayar wajib bertanggal.
-- Jumlahnya ikut aturan yang sama dengan Realisasi manual: (manual + SAKTI) sebulan <= RPD bulan itu, dan POS setahun <= RPD POS itu setahun.
create or replace function public.realisasi_sakti_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ctx text; rpd_m bigint; man_m bigint; sak_m bigint; cap bigint; used bigint;
        today date := (now() at time zone 'Asia/Jakarta')::date;
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
    raise exception '%: POS % tidak dapat dibayar lewat SAKTI. Hanya Listrik, Telepon/Internet, dan Air.', ctx, coalesce(pos_label(new.pos_id), new.pos_id::text); end if;
  if coalesce(new.nominal, -1) < 0 then raise exception 'Nominal tidak boleh negatif.'; end if;
  if metode_pos(new.kua_id, new.pos_id, new.tahun, new.bulan) <> 'SAKTI' then
    raise exception '%: POS % bermetode MANUAL pada % %. Realisasi SAKTI hanya untuk POS bermetode SAKTI.',
      ctx, pos_label(new.pos_id), nama_bulan(new.bulan), new.tahun; end if;
  if make_date(new.tahun, new.bulan, 1) > date_trunc('month', now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Realisasi SAKTI % % belum dapat diinput karena periodenya belum berjalan.', nama_bulan(new.bulan), new.tahun; end if;
  if coalesce(new.status_bayar, '') not in ('BELUM_DIBAYAR', 'SUDAH_DIBAYAR') then raise exception 'Status pembayaran tidak valid.'; end if;
  if new.status_bayar = 'BELUM_DIBAYAR' then
    if new.nominal <> 0 or new.tanggal_bayar is not null then
      raise exception 'Realisasi berstatus Belum dibayar harus bernominal Rp 0 dan tanpa tanggal pembayaran.'; end if;
  else
    if new.tanggal_bayar is null then raise exception 'Tanggal pembayaran wajib diisi untuk Realisasi yang sudah dibayar.'; end if;
    if new.tanggal_bayar > today then raise exception 'Tanggal pembayaran tidak boleh melebihi hari ini.'; end if;
  end if;
  new.catatan := nullif(btrim(coalesce(new.catatan, '')), '');

  perform pg_advisory_xact_lock(new.kua_id, new.tahun);
  if new.nominal > 0 and (tg_op = 'INSERT' or new.nominal is distinct from old.nominal) then
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
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now();
  else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.sumber := 'SAKTI'; new.updated_by := auth.uid(); new.updated_at := now();
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

-- Migrasi SEKALI dari AutoPayment lama (nominal tetap) agar angka bulan-bulan yang sudah berjalan tidak berubah:
--   * tiap versi autopayment_pos menjadi metode SAKTI mulai bulan itu (dan MANUAL setelah versi ditutup);
--   * tiap bulan yang tercakup (sampai bulan berjalan) menjadi satu baris Realisasi SAKTI berstatus Sudah dibayar.
-- Sesudahnya bulan baru TIDAK terisi otomatis lagi: admin menginput realisasi SAKTI yang sebenarnya tiap bulan.
-- Penanda di config mencegah pengulangan (dan menyimpan ringkasan hasil). Tabel autopayment_pos dibiarkan sebagai arsip.
do $$
declare cur date := date_trunc('month', now() at time zone 'Asia/Jakarta')::date; n_ver int := 0; n_row int := 0; n_bentrok int := 0;
begin
  if exists (select 1 from public.config where key = 'sakti_migrasi_autopayment') then return; end if;
  if exists (select 1 from public.autopayment_pos where nominal > 0) then
    alter table public.metode_pembayaran disable trigger metode_guard;
    alter table public.realisasi_sakti disable trigger realisasi_sakti_guard;

    insert into public.metode_pembayaran (kua_id, pos_id, metode, mulai)
    select kua_id, pos_id, case when bool_or(m = 'SAKTI') then 'SAKTI' else 'MANUAL' end, bln
      from (select kua_id, pos_id, mulai as bln, 'SAKTI' as m from public.autopayment_pos where nominal > 0
            union all
            select kua_id, pos_id, (sampai + interval '1 month')::date, 'MANUAL' from public.autopayment_pos
             where nominal > 0 and sampai is not null) e
     group by kua_id, pos_id, bln
    on conflict (kua_id, pos_id, mulai) do nothing;
    get diagnostics n_ver = row_count;

    insert into public.realisasi_sakti (kua_id, pos_id, tahun, bulan, nominal, status_bayar, catatan)
    select a.kua_id, a.pos_id, extract(year from (a.mulai + make_interval(months => g)))::int,
           extract(month from (a.mulai + make_interval(months => g)))::int, a.nominal, 'SUDAH_DIBAYAR',
           'Migrasi dari AutoPayment (nominal tetap)'
      from public.autopayment_pos a
     cross join lateral generate_series(0, ((extract(year from least(coalesce(a.sampai, cur), cur)) - extract(year from a.mulai)) * 12
            + extract(month from least(coalesce(a.sampai, cur), cur)) - extract(month from a.mulai))::int) g
     where a.nominal > 0 and a.mulai <= cur
    on conflict (kua_id, pos_id, tahun, bulan) do nothing;
    get diagnostics n_row = row_count;

    alter table public.metode_pembayaran enable trigger metode_guard;
    alter table public.realisasi_sakti enable trigger realisasi_sakti_guard;

    -- bulan yang sudah punya Realisasi manual DAN SAKTI untuk POS yang sama (warisan aturan lama): hanya dilaporkan, tidak diubah
    select count(*) into n_bentrok from public.realisasi r
      cross join lateral jsonb_each(r.items) i
      join public.realisasi_sakti s on s.kua_id = r.kua_id and s.tahun = r.tahun and s.bulan = r.bulan and s.pos_id::text = i.key
     where s.nominal > 0 and (i.value #>> '{}')::bigint > 0;
  end if;
  insert into public.config (key, value)
  values ('sakti_migrasi_autopayment', jsonb_build_object('waktu', now(), 'versi_metode', n_ver, 'baris_realisasi_sakti', n_row, 'bentrok_dengan_manual', n_bentrok))
  on conflict (key) do nothing;
  raise notice 'Migrasi AutoPayment -> SAKTI: % versi metode, % baris Realisasi SAKTI, % bulan bentrok dengan Realisasi manual.', n_ver, n_row, n_bentrok;
end $$;
