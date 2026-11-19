-- Pendataan Pegawai KUA: field tambahan dan normalisasi data.
-- Aman dijalankan berulang kali; tidak menghapus atau mengganti data pegawai yang sudah ada.
alter table public.pegawai
  add column if not exists usia_pensiun integer,
  add column if not exists sumber_usia_pensiun text,
  add column if not exists tmt_kua date,
  add column if not exists tmt_kepala_kua date,
  add column if not exists operator_simkah boolean not null default false,
  add column if not exists operator_bop boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.pegawai'::regclass and conname='pegawai_usia_pensiun_cek') then
    alter table public.pegawai add constraint pegawai_usia_pensiun_cek check (usia_pensiun is null or usia_pensiun between 40 and 75);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.pegawai'::regclass and conname='pegawai_sumber_usia_cek') then
    alter table public.pegawai add constraint pegawai_sumber_usia_cek check (sumber_usia_pensiun is null or sumber_usia_pensiun in ('AUTO','MANUAL'));
  end if;
end $$;

create or replace function public.pegawai_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare tr boolean := coalesce(current_setting('bop.pegawai_transfer', true), '') = 'on';
        gk int; kn text; gn text; tb text;
        romawi text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII'];
begin
  if tg_op = 'UPDATE' and new.kua_id is distinct from old.kua_id and not tr then raise exception 'KUA pegawai tidak dapat diubah langsung. Gunakan Transfer.'; end if;
  if auth.uid() is not null and not tr and not public.is_admin() then
    if not public.can_menu('pegawai') then raise exception 'Anda tidak berhak mengelola data pegawai.'; end if;
    if public.my_kua() is null or public.my_kua() is distinct from new.kua_id or (tg_op = 'UPDATE' and public.my_kua() is distinct from old.kua_id) then raise exception 'Anda hanya dapat mengelola pegawai KUA Anda sendiri.'; end if;
  end if;
  new.nama := upper(btrim(regexp_replace(coalesce(new.nama, ''), '\s+', ' ', 'g')));
  if new.nama = '' then raise exception 'Nama lengkap wajib diisi.'; end if;
  if char_length(new.nama) > 150 then raise exception 'Nama lengkap maksimal 150 karakter.'; end if;
  new.jabatan := btrim(regexp_replace(coalesce(new.jabatan, ''), '\s+', ' ', 'g'));
  if new.jabatan = '' then raise exception 'Jabatan wajib diisi.'; end if;
  if char_length(new.jabatan) > 100 then raise exception 'Jabatan maksimal 100 karakter.'; end if;
  if (tg_op = 'INSERT' or new.jabatan is distinct from old.jabatan) and new.jabatan ~* 'kepala\s+(kua\y|kantor\s+urusan\s+agama\y)' then raise exception 'Kepala KUA dan Plt. Kepala KUA adalah jabatan tambahan. Isi kolom Jabatan dengan jabatan fungsional pegawai (mis. Penghulu atau Penyuluh), lalu pilih Kepala KUA di Jabatan Tambahan.'; end if;
  if new.jenis_asn is null or new.jenis_asn not in ('PNS','PPPK','PPPK Paruh Waktu','Honor') then raise exception 'Jenis ASN harus PNS, PPPK, PPPK Paruh Waktu, atau Honor.'; end if;
  new.jabatan_tambahan := nullif(btrim(regexp_replace(coalesce(new.jabatan_tambahan, ''), '\s+', ' ', 'g')), '');
  if new.jabatan_tambahan is not null then
    tb := lower(regexp_replace(new.jabatan_tambahan, '[\s.]+', '', 'g'));
    new.jabatan_tambahan := case tb when 'kepalakua' then 'Kepala KUA' when 'pltkepalakua' then 'Plt. Kepala KUA' else null end;
    if new.jabatan_tambahan is null then raise exception 'Jabatan tambahan hanya boleh Kepala KUA atau Plt. Kepala KUA.'; end if;
    if new.jenis_asn not in ('PNS','PPPK') then raise exception 'Jabatan tambahan % hanya untuk pegawai PNS atau PPPK.', new.jabatan_tambahan; end if;
  end if;
  -- Nomor HP wajib untuk data baru/perubahan. Data lama yang sejak awal kosong tetap
  -- boleh dipertahankan saat pembaruan nama/kolom lain; jangan mengarang nomor.
  if nullif(btrim(coalesce(new.no_hp, '')), '') is null then
    if tg_op = 'INSERT' then
      raise exception 'Nomor HP/WA wajib diisi dan harus valid (08xxxxxxxxxx).';
    elsif old.no_hp is not null then
      raise exception 'Nomor HP/WA wajib diisi dan harus valid (08xxxxxxxxxx).';
    else
      new.no_hp := null;
    end if;
  else
    new.no_hp := regexp_replace(coalesce(new.no_hp, ''), '[\s().-]', '', 'g');
    new.no_hp := regexp_replace(new.no_hp, '^\+?62', '0');
    if new.no_hp ~ '^8' then new.no_hp := '0' || new.no_hp; end if;
    if new.no_hp !~ '^08[0-9]{8,12}$' then
      raise exception 'Nomor HP/WA tidak valid. Gunakan format 08xxxxxxxxxx.';
    end if;
  end if;
  if new.usia_pensiun is not null and new.usia_pensiun not between 40 and 75 then raise exception 'Usia pensiun harus antara 40 sampai 75 tahun.'; end if;
  new.sumber_usia_pensiun := upper(nullif(btrim(coalesce(new.sumber_usia_pensiun, '')), ''));
  if new.sumber_usia_pensiun is not null and new.sumber_usia_pensiun not in ('AUTO','MANUAL') then raise exception 'Sumber usia pensiun hanya AUTO atau MANUAL.'; end if;
  if new.usia_pensiun is null then new.sumber_usia_pensiun := null; elsif new.sumber_usia_pensiun is null then new.sumber_usia_pensiun := 'MANUAL'; end if;
  new.nip := nullif(regexp_replace(coalesce(new.nip, ''), '\s', '', 'g'), '');
  new.pangkat_golongan := nullif(btrim(coalesce(new.pangkat_golongan, '')), '');
  if new.jenis_asn = 'Honor' then
    if new.nip is not null then raise exception 'Pegawai Honor tidak memiliki NIP. Kosongkan kolom NIP.'; end if;
    if new.pangkat_golongan is not null then raise exception 'Pegawai Honor tidak memiliki pangkat/golongan.'; end if;
  else
    if new.nip is null then if new.jenis_asn <> 'PPPK Paruh Waktu' then raise exception 'NIP wajib diisi untuk pegawai %.', new.jenis_asn; end if;
    else
      if new.nip !~ '^[0-9]{18}$' then raise exception 'NIP harus 18 angka (spasi diabaikan). Yang diisi: % angka.', char_length(new.nip); end if;
      select g.kua_id, k.nama_kua, g.nama into gk, kn, gn from public.pegawai g join public.kua k on k.id = g.kua_id where g.nip = new.nip and g.id is distinct from new.id;
      if found then if gk = new.kua_id then raise exception 'NIP % sudah terdaftar di KUA ini atas nama %.', new.nip, gn; end if; raise exception 'NIP % sudah terdaftar di %. Bila pegawai ini pindah tugas, minta Operator KUA tersebut memindahkannya (Transfer) ke KUA Anda.', new.nip, kn; end if;
    end if;
    if new.jenis_asn = 'PNS' and (new.pangkat_golongan is null or new.pangkat_golongan !~ '^((I|II|III)/[a-d]|IV/[a-e])$') then raise exception 'Pangkat/golongan PNS wajib dipilih (I/a sampai IV/e).'; end if;
    if new.jenis_asn = 'PPPK' and (new.pangkat_golongan is null or not (new.pangkat_golongan = any (romawi))) then raise exception 'Golongan PPPK wajib dipilih (I sampai XVII).'; end if;
    if new.jenis_asn = 'PPPK Paruh Waktu' and new.pangkat_golongan is not null and not (new.pangkat_golongan = any (romawi)) then raise exception 'Golongan PPPK Paruh Waktu tidak valid (I sampai XVII). Kosongkan bila belum ada.'; end if;
  end if;
  if new.jabatan_tambahan is not null then
    select g.nama into gn from public.pegawai g where g.kua_id = new.kua_id and g.jabatan_tambahan = new.jabatan_tambahan and g.id is distinct from new.id limit 1;
    if found then raise exception '% di KUA ini sudah dijabat oleh %. Lepaskan jabatan tambahan itu dari % terlebih dahulu (ubah data pegawainya), lalu tetapkan di sini.', new.jabatan_tambahan, regexp_replace(gn, '\.+$', ''), gn; end if;
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now(); end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;

-- Tugas operator dan TMT KUA melekat pada KUA asal; reset saat transfer.

create or replace function public.pegawai_transfer(p_id bigint, p_kua int) returns void
language plpgsql security definer set search_path = public as $$
declare g public.pegawai; tujuan public.kua;
begin
  select * into g from public.pegawai where id = p_id for update;
  if not found then raise exception 'Pegawai tidak ditemukan (mungkin sudah dihapus atau dipindahkan).'; end if;
  if auth.uid() is not null and not public.is_admin()
     and not coalesce(public.can_menu('pegawai') and public.my_kua() = g.kua_id, false) then
    raise exception 'Anda hanya dapat memindahkan pegawai KUA Anda sendiri.'; end if;
  select * into tujuan from public.kua where id = p_kua;
  if not found then raise exception 'KUA tujuan tidak ditemukan.'; end if;
  if tujuan.status <> 'aktif' then raise exception '% tidak aktif sehingga tidak dapat menerima pegawai.', tujuan.nama_kua; end if;
  if g.kua_id = p_kua then raise exception '% sudah berada di %.', g.nama, tujuan.nama_kua; end if;
  perform set_config('bop.pegawai_transfer', 'on', true);
  update public.pegawai set kua_id = p_kua, jabatan_tambahan = null, tmt_kua = null, tmt_kepala_kua = null,
    operator_simkah = false, operator_bop = false where id = p_id;
  perform set_config('bop.pegawai_transfer', 'off', true);
end $$;
revoke execute on function public.pegawai_transfer(bigint, int) from public, anon;
grant execute on function public.pegawai_transfer(bigint, int) to authenticated;
