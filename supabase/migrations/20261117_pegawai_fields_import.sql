-- Pendataan Pegawai KUA: field tambahan dan dukungan impor XLSX.
-- Aman dijalankan berulang kali; tidak menghapus atau mengganti data pegawai yang sudah ada.
alter table public.pegawai
  add column if not exists usia_pensiun integer,
  add column if not exists tmt_kua date,
  add column if not exists tmt_kepala_kua date,
  add column if not exists operator_simkah boolean not null default false,
  add column if not exists operator_bop boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.pegawai'::regclass and conname='pegawai_usia_pensiun_cek') then
    alter table public.pegawai add constraint pegawai_usia_pensiun_cek check (usia_pensiun is null or usia_pensiun between 40 and 75);
  end if;
end $$;

comment on column public.pegawai.usia_pensiun is 'Usia pensiun dalam tahun; saran berdasarkan jabatan dan NIP, dapat diperiksa manual.';
comment on column public.pegawai.tmt_kua is 'TMT pegawai bertugas di KUA saat ini; untuk PNS, PPPK, dan PPPK Paruh Waktu.';
comment on column public.pegawai.tmt_kepala_kua is 'TMT pertama kali menjabat Kepala KUA.';
comment on column public.pegawai.operator_simkah is 'Penugasan tambahan sebagai Operator SIMKAH; dapat dirangkap Kepala KUA.';
comment on column public.pegawai.operator_bop is 'Penugasan tambahan sebagai Operator BOP; dapat dirangkap Kepala KUA.';
