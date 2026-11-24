-- BARJAS / Procurement Indramayu -> BIMASATU CONNECT
-- Jalankan SETELAH bop.sql pada Supabase SQL Editor.
-- Aman dijalankan ulang: skema, policy, bucket, dan hak akses dibuat secara idempoten.

begin;

-- 1. Pertahankan daftar peran lama untuk kompatibilitas. BARJAS diberikan melalui hak_akses BIMASATU.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','operator','bendahara_bop','verifikator_bop','bast_nr','kemasjidan','pnbp_nr','pengadaan'));

alter table public.hak_akses drop constraint if exists hak_akses_role_check;
alter table public.hak_akses add constraint hak_akses_role_check
  check (role in ('operator','bendahara_bop','verifikator_bop','bast_nr','kemasjidan','pnbp_nr','pengadaan'));

-- 0) Kompatibilitas rename dari skema SIPADU yang mungkin sudah pernah diterapkan.
-- Data lama dipertahankan: tabel dan sequence hanya diganti nama, tidak dihapus.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('sipadu_config','barjas_config'),
      ('sipadu_user_map','barjas_user_map'),
      ('sipadu_pejabat','barjas_pejabat'),
      ('sipadu_satker','barjas_satker'),
      ('sipadu_penugasan','barjas_penugasan'),
      ('sipadu_penyedia','barjas_penyedia'),
      ('sipadu_paket','barjas_paket'),
      ('sipadu_dokumen','barjas_dokumen'),
      ('sipadu_hps','barjas_hps'),
      ('sipadu_monev','barjas_monev'),
      ('sipadu_log','barjas_log')
    ) as x(old_name, new_name)
  loop
    if to_regclass('public.' || r.old_name) is not null
       and to_regclass('public.' || r.new_name) is null then
      execute format('alter table public.%I rename to %I', r.old_name, r.new_name);
    end if;
  end loop;

  if to_regclass('public.sipadu_log_id_seq') is not null
     and to_regclass('public.barjas_log_id_seq') is null then
    alter sequence public.sipadu_log_id_seq rename to barjas_log_id_seq;
  end if;
end $$;

-- Alihkan hak menu yang sebelumnya bernama "sipadu" ke kunci baru "barjas".
insert into public.hak_akses (role, menu, updated_by, updated_at)
select role, 'barjas', updated_by, updated_at
from public.hak_akses
where menu = 'sipadu'
on conflict (role, menu) do nothing;
delete from public.hak_akses where menu = 'sipadu';

create or replace function public.menu_keys() returns text[] language sql immutable as $$
  select array['dashboard','pegawai','bop','anggaran','rpd','realisasi','verifikasi','metode','sakti','config','impor','laporan',
               'bast','bast-buat','bast-pegawai','bast-setting','sert-masjid','sert-kiblat','sert-pengaturan','jaspro','bmn','akses','barjas'];
$$;

create or replace function public.peran_label(p_role text) returns text language sql immutable as $$
  select case p_role when 'admin' then 'Admin' when 'operator' then 'Operator KUA'
    when 'bendahara_bop' then 'Bendahara BOP' when 'verifikator_bop' then 'Verifikator BOP'
    when 'bast_nr' then 'BAST NR' when 'kemasjidan' then 'Kemasjidan'
    when 'pnbp_nr' then 'PNBP NR' when 'pengadaan' then 'Pengelola Pengadaan' else p_role end;
$$;

-- Trigger ini mengganti versi pada bop.sql agar akun Pengelola Pengadaan dibuat tanpa ikatan KUA.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := case when new.raw_user_meta_data->>'role' in
    ('admin','bendahara_bop','verifikator_bop','bast_nr','kemasjidan','pnbp_nr','pengadaan')
    then new.raw_user_meta_data->>'role' else 'operator' end;
  k text := case when r = 'operator' then new.raw_user_meta_data->>'kua' end;
begin
  insert into public.profiles (id, nama, kua, role, kua_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    k,
    r,
    case when r = 'operator' then (select id from public.kua where nama_kua = k) end
  );
  return new;
end $$;

-- 2. Tabel BARJAS. ID lama dipertahankan agar impor ulang tidak menggandakan data.
create table if not exists public.barjas_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.barjas_user_map (
  legacy_id text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  legacy_username text,
  migrated_at timestamptz not null default now(),
  unique (auth_user_id, legacy_id)
);

create table if not exists public.barjas_pejabat (
  id text primary key,
  nama text,
  nip text,
  pangkat text,
  jabatan text,
  satker_id text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barjas_satker (
  id text primary key,
  kode_satker text,
  nama text not null,
  singkatan text,
  jenis text,
  alamat text,
  kecamatan text,
  kode_pos text,
  telp text,
  email text,
  website text,
  kepala text,
  nip_kepala text,
  jabatan_kpa text,
  folder_id text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barjas_penugasan (
  id text primary key,
  tahun integer not null,
  satker_id text not null references public.barjas_satker(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  sp_dipa text,
  tgl_dipa date,
  ada_pengadaan boolean not null default true,
  kpa_id text,
  ppk_id text,
  pp_id text,
  catatan text,
  unique (tahun, satker_id)
);

create table if not exists public.barjas_penyedia (
  id text primary key,
  nama text not null,
  bentuk text,
  direktur text,
  jabatan_direktur text,
  alamat text,
  npwp text,
  telp text,
  email text,
  cp_file_id text,
  cp_url text,
  cp_storage_path text,
  cp_legacy_file_id text,
  aktif boolean not null default true,
  nomor_hp text,
  no_rekening text,
  nama_rekening text,
  bank text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barjas_paket (
  id text primary key,
  tahun integer not null,
  satker_id text not null references public.barjas_satker(id) on delete restrict,
  jenis text,
  nama text not null,
  pagu numeric(20,2) not null default 0,
  nilai numeric(20,2) not null default 0,
  penyedia_id text references public.barjas_penyedia(id) on delete set null,
  metode text,
  jenis_kontrak text,
  jangka_waktu text,
  sumber_dana text,
  lokasi text,
  ada_pph boolean not null default false,
  status text,
  kpa_id text,
  ppk_id text,
  pp_id text,
  meta jsonb not null default '{}'::jsonb,
  folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barjas_dokumen (
  id text primary key,
  paket_id text references public.barjas_paket(id) on delete cascade,
  kode integer,
  sub text,
  nama_file text not null,
  file_id text,
  legacy_file_id text,
  storage_path text,
  url text,
  mime text,
  size bigint not null default 0,
  keterangan text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.barjas_hps (
  id text primary key,
  paket_id text not null references public.barjas_paket(id) on delete cascade,
  part integer not null default 0,
  payload text not null,
  total numeric(20,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (paket_id, part)
);

create table if not exists public.barjas_monev (
  id text primary key,
  paket_id text not null unique references public.barjas_paket(id) on delete cascade,
  payload text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.barjas_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  aksi text not null,
  detail text
);

create index if not exists barjas_penugasan_user_tahun_idx on public.barjas_penugasan(user_id, tahun);
create index if not exists barjas_penugasan_satker_tahun_idx on public.barjas_penugasan(satker_id, tahun);
create index if not exists barjas_paket_tahun_satker_idx on public.barjas_paket(tahun, satker_id);
create index if not exists barjas_paket_penyedia_idx on public.barjas_paket(penyedia_id);
create index if not exists barjas_dokumen_paket_kode_idx on public.barjas_dokumen(paket_id, kode);
create index if not exists barjas_dokumen_legacy_file_idx on public.barjas_dokumen(legacy_file_id);

-- 3. Otorisasi per satker/tahun untuk RLS.
create or replace function public.barjas_can_satker(p_satker_id text, p_tahun integer default null)
returns boolean
language sql security definer stable set search_path = public as $$
  select public.can_menu('barjas') and (
    public.is_admin()
    or exists (
      select 1 from public.barjas_penugasan t
      where t.user_id = auth.uid()
        and t.satker_id = p_satker_id
        and (p_tahun is null or t.tahun = p_tahun)
    )
  );
$$;
revoke all on function public.barjas_can_satker(text, integer) from public, anon;
grant execute on function public.barjas_can_satker(text, integer) to authenticated;

-- 4. RLS semua tabel.
alter table public.barjas_config enable row level security;
alter table public.barjas_user_map enable row level security;
alter table public.barjas_pejabat enable row level security;
alter table public.barjas_satker enable row level security;
alter table public.barjas_penugasan enable row level security;
alter table public.barjas_penyedia enable row level security;
alter table public.barjas_paket enable row level security;
alter table public.barjas_dokumen enable row level security;
alter table public.barjas_hps enable row level security;
alter table public.barjas_monev enable row level security;
alter table public.barjas_log enable row level security;

-- Hapus policy bernama lama setelah tabel SIPADU diganti nama.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('barjas_config','sipadu_config_read'),
      ('barjas_config','sipadu_config_admin'),
      ('barjas_user_map','sipadu_user_map_admin'),
      ('barjas_pejabat','sipadu_pejabat_access'),
      ('barjas_satker','sipadu_satker_read'),
      ('barjas_satker','sipadu_satker_update'),
      ('barjas_satker','sipadu_satker_insert'),
      ('barjas_satker','sipadu_satker_delete'),
      ('barjas_penugasan','sipadu_penugasan_read'),
      ('barjas_penugasan','sipadu_penugasan_admin'),
      ('barjas_penyedia','sipadu_penyedia_access'),
      ('barjas_paket','sipadu_paket_access'),
      ('barjas_dokumen','sipadu_dokumen_access'),
      ('barjas_hps','sipadu_hps_access'),
      ('barjas_monev','sipadu_monev_access'),
      ('barjas_log','sipadu_log_read'),
      ('barjas_log','sipadu_log_insert')
    ) as x(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', r.policy_name, r.table_name);
  end loop;
  execute 'drop policy if exists sipadu_storage_read on storage.objects';
  execute 'drop policy if exists sipadu_storage_insert on storage.objects';
  execute 'drop policy if exists sipadu_storage_update on storage.objects';
  execute 'drop policy if exists sipadu_storage_delete on storage.objects';
end $$;

drop function if exists public.sipadu_can_satker(text, integer);

drop policy if exists barjas_config_read on public.barjas_config;
create policy barjas_config_read on public.barjas_config for select to authenticated
  using (public.can_menu('barjas'));
drop policy if exists barjas_config_admin on public.barjas_config;
create policy barjas_config_admin on public.barjas_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists barjas_user_map_admin on public.barjas_user_map;
create policy barjas_user_map_admin on public.barjas_user_map for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists barjas_pejabat_access on public.barjas_pejabat;
create policy barjas_pejabat_access on public.barjas_pejabat for all to authenticated
  using (public.can_menu('barjas')) with check (public.can_menu('barjas'));

drop policy if exists barjas_satker_read on public.barjas_satker;
create policy barjas_satker_read on public.barjas_satker for select to authenticated
  using (public.barjas_can_satker(id, null));
drop policy if exists barjas_satker_update on public.barjas_satker;
create policy barjas_satker_update on public.barjas_satker for update to authenticated
  using (public.barjas_can_satker(id, null)) with check (public.barjas_can_satker(id, null));
drop policy if exists barjas_satker_insert on public.barjas_satker;
create policy barjas_satker_insert on public.barjas_satker for insert to authenticated
  with check (public.is_admin());
drop policy if exists barjas_satker_delete on public.barjas_satker;
create policy barjas_satker_delete on public.barjas_satker for delete to authenticated
  using (public.is_admin());

drop policy if exists barjas_penugasan_read on public.barjas_penugasan;
create policy barjas_penugasan_read on public.barjas_penugasan for select to authenticated
  using (public.can_menu('barjas') and (public.is_admin() or user_id = auth.uid()));
drop policy if exists barjas_penugasan_admin on public.barjas_penugasan;
create policy barjas_penugasan_admin on public.barjas_penugasan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists barjas_penyedia_access on public.barjas_penyedia;
create policy barjas_penyedia_access on public.barjas_penyedia for all to authenticated
  using (public.can_menu('barjas')) with check (public.can_menu('barjas'));

drop policy if exists barjas_paket_access on public.barjas_paket;
create policy barjas_paket_access on public.barjas_paket for all to authenticated
  using (public.barjas_can_satker(satker_id, tahun))
  with check (public.barjas_can_satker(satker_id, tahun));

drop policy if exists barjas_dokumen_access on public.barjas_dokumen;
create policy barjas_dokumen_access on public.barjas_dokumen for all to authenticated
  using (exists (
    select 1 from public.barjas_paket p
    where p.id = barjas_dokumen.paket_id and public.barjas_can_satker(p.satker_id, p.tahun)
  ))
  with check (exists (
    select 1 from public.barjas_paket p
    where p.id = barjas_dokumen.paket_id and public.barjas_can_satker(p.satker_id, p.tahun)
  ));

drop policy if exists barjas_hps_access on public.barjas_hps;
create policy barjas_hps_access on public.barjas_hps for all to authenticated
  using (exists (
    select 1 from public.barjas_paket p
    where p.id = barjas_hps.paket_id and public.barjas_can_satker(p.satker_id, p.tahun)
  ))
  with check (exists (
    select 1 from public.barjas_paket p
    where p.id = barjas_hps.paket_id and public.barjas_can_satker(p.satker_id, p.tahun)
  ));

drop policy if exists barjas_monev_access on public.barjas_monev;
create policy barjas_monev_access on public.barjas_monev for all to authenticated
  using (exists (
    select 1 from public.barjas_paket p
    where p.id = barjas_monev.paket_id and public.barjas_can_satker(p.satker_id, p.tahun)
  ))
  with check (exists (
    select 1 from public.barjas_paket p
    where p.id = barjas_monev.paket_id and public.barjas_can_satker(p.satker_id, p.tahun)
  ));

drop policy if exists barjas_log_read on public.barjas_log;
create policy barjas_log_read on public.barjas_log for select to authenticated
  using (public.is_admin());
drop policy if exists barjas_log_insert on public.barjas_log;
create policy barjas_log_insert on public.barjas_log for insert to authenticated
  with check (public.can_menu('barjas') and (user_id is null or user_id = auth.uid()));

grant select, insert, update, delete on public.barjas_config to authenticated;
grant select, insert, update, delete on public.barjas_user_map to authenticated;
grant select, insert, update, delete on public.barjas_pejabat to authenticated;
grant select, insert, update, delete on public.barjas_satker to authenticated;
grant select, insert, update, delete on public.barjas_penugasan to authenticated;
grant select, insert, update, delete on public.barjas_penyedia to authenticated;
grant select, insert, update, delete on public.barjas_paket to authenticated;
grant select, insert, update, delete on public.barjas_dokumen to authenticated;
grant select, insert, update, delete on public.barjas_hps to authenticated;
grant select, insert, update, delete on public.barjas_monev to authenticated;
grant select, insert on public.barjas_log to authenticated;
grant usage, select on sequence public.barjas_log_id_seq to authenticated;

-- Hak bawaan: akun baru Pengelola Pengadaan langsung mendapat menu BARJAS saja.
insert into public.hak_akses (role, menu)
values ('pengadaan', 'barjas')
on conflict (role, menu) do nothing;

-- Hapus hak akses BARJAS yang mungkin pernah dicentang untuk peran selain Pengadaan.
-- Admin selalu boleh; akses role lain tetap dapat diatur sesuai kebijakan admin, sehingga tidak dihapus.

-- 5. Penyimpanan berkas privat. File lama yang belum berhasil disalin tetap disimpan sebagai URL referensi.
insert into storage.buckets (id, name, public, file_size_limit)
values ('barjas-files', 'barjas-files', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists barjas_storage_read on storage.objects;
create policy barjas_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'barjas-files'
  and public.can_menu('barjas')
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = 'penyedia'
    or exists (
      select 1 from public.barjas_paket p
      where p.id = (storage.foldername(name))[1]
        and public.barjas_can_satker(p.satker_id, p.tahun)
    )
  )
);

drop policy if exists barjas_storage_insert on storage.objects;
create policy barjas_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'barjas-files'
  and public.can_menu('barjas')
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = 'penyedia'
    or exists (
      select 1 from public.barjas_paket p
      where p.id = (storage.foldername(name))[1]
        and public.barjas_can_satker(p.satker_id, p.tahun)
    )
  )
);

drop policy if exists barjas_storage_update on storage.objects;
create policy barjas_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'barjas-files' and public.can_menu('barjas')
  and (public.is_admin() or (storage.foldername(name))[1] = 'penyedia'
    or exists (select 1 from public.barjas_paket p where p.id = (storage.foldername(name))[1]
      and public.barjas_can_satker(p.satker_id, p.tahun)))
)
with check (
  bucket_id = 'barjas-files' and public.can_menu('barjas')
  and (public.is_admin() or (storage.foldername(name))[1] = 'penyedia'
    or exists (select 1 from public.barjas_paket p where p.id = (storage.foldername(name))[1]
      and public.barjas_can_satker(p.satker_id, p.tahun)))
);

drop policy if exists barjas_storage_delete on storage.objects;
create policy barjas_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'barjas-files' and public.can_menu('barjas')
  and (public.is_admin() or (storage.foldername(name))[1] = 'penyedia'
    or exists (select 1 from public.barjas_paket p where p.id = (storage.foldername(name))[1]
      and public.barjas_can_satker(p.satker_id, p.tahun)))
);

-- Akses tabel BARJAS hanya melalui peran yang sah; anon tidak diberi akses.
revoke all on public.barjas_config, public.barjas_user_map, public.barjas_pejabat,
  public.barjas_satker, public.barjas_penugasan, public.barjas_penyedia, public.barjas_paket,
  public.barjas_dokumen, public.barjas_hps, public.barjas_monev, public.barjas_log from anon;


-- Hak menu: role Pengelola Pengadaan hanya boleh memiliki menu BARJAS.
create or replace function public.set_hak_akses(p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r text; m text; menus text[];
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengatur hak akses menu.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Format hak akses tidak valid.'; end if;
  for r in select key from jsonb_each(p_data) loop
    if r not in ('operator','bendahara_bop','verifikator_bop','bast_nr','kemasjidan','pnbp_nr','pengadaan') then
      raise exception 'Peran % tidak dikenal atau tidak dapat diubah (Admin selalu memiliki semua menu).', r; end if;
    if jsonb_typeof(p_data -> r) <> 'array' then raise exception 'Daftar menu untuk % tidak valid.', public.peran_label(r); end if;
    select coalesce(array_agg(distinct x), '{}'::text[]) into menus from jsonb_array_elements_text(p_data -> r) x;
    foreach m in array menus loop
      if not (m = any (public.menu_keys())) then raise exception 'Menu % tidak dikenal.', m; end if;
      if m in ('akses','impor') then
        raise exception 'Menu % khusus Admin dan tidak dapat diberikan ke peran lain.', m; end if;
      if r = 'operator' and m in ('anggaran','verifikasi','metode','sakti','config') then
        raise exception 'Menu % tidak dapat diberikan ke Operator KUA: operator hanya boleh mengakses data KUA-nya sendiri.', m; end if;
      if r <> 'operator' and m in ('realisasi','dashboard') then
        raise exception 'Menu % hanya untuk Operator KUA.', m; end if;
remove role lock in barjas.sql    end loop;
    delete from public.hak_akses where role = r;
    insert into public.hak_akses (role, menu, updated_by) select r, x, auth.uid() from unnest(menus) x;
  end loop;
end $$;
revoke execute on function public.set_hak_akses(jsonb) from public, anon;
grant execute on function public.set_hak_akses(jsonb) to authenticated;


commit;
