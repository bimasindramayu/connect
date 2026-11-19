-- Normalisasi nama pegawai dan penghapusan permanen fitur Riwayat Pegawai.
-- Aman dijalankan setelah 20261117_pegawai_fields_import.sql.

-- Kolom no_hp tetap nullable agar data lama yang belum memiliki nomor HP tidak hilang.
-- Trigger mewajibkan nomor HP untuk data baru/perubahan nomor, tetapi mengizinkan nilai NULL lama tetap dipertahankan.

-- Putuskan seluruh dependensi fitur riwayat sebelum menghapus tabelnya.
drop trigger if exists pegawai_log on public.pegawai;
drop function if exists public.pegawai_log();
drop table if exists public.pegawai_riwayat cascade;

-- Pastikan database juga memaksa kapitalisasi, termasuk jika data ditulis melalui API selain form.
create or replace function public.pegawai_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare tr boolean := coalesce(current_setting('bop.pegawai_transfer', true), '') = 'on';
        gk int; kn text; gn text; tb text;
        romawi text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII'];
begin
  if tg_op = 'UPDATE' and new.kua_id is distinct from old.kua_id and not tr then
    raise exception 'KUA pegawai tidak dapat diubah langsung. Gunakan Transfer.'; end if;
  if auth.uid() is not null and not tr and not public.is_admin() then
    if not public.can_menu('pegawai') then raise exception 'Anda tidak berhak mengelola data pegawai.'; end if;
    if public.my_kua() is null or public.my_kua() is distinct from new.kua_id
       or (tg_op = 'UPDATE' and public.my_kua() is distinct from old.kua_id) then
      raise exception 'Anda hanya dapat mengelola pegawai KUA Anda sendiri.'; end if;
  end if;

  new.nama := upper(btrim(regexp_replace(coalesce(new.nama, ''), '\s+', ' ', 'g')));
  if new.nama = '' then raise exception 'Nama lengkap wajib diisi.'; end if;
  if char_length(new.nama) > 150 then raise exception 'Nama lengkap maksimal 150 karakter.'; end if;
  new.jabatan := btrim(regexp_replace(coalesce(new.jabatan, ''), '\s+', ' ', 'g'));
  if new.jabatan = '' then raise exception 'Jabatan wajib diisi.'; end if;
  if char_length(new.jabatan) > 100 then raise exception 'Jabatan maksimal 100 karakter.'; end if;
  -- Kepala KUA adalah jabatan TAMBAHAN. Data lama yang masih bertuliskan Kepala KUA di kolom jabatan tidak ditolak selama jabatannya
  -- tidak diubah (agar tetap dapat disimpan sampai dilengkapi), tetapi pengisian baru dan perubahan jabatan wajib jabatan fungsional.
  if (tg_op = 'INSERT' or new.jabatan is distinct from old.jabatan) and new.jabatan ~* 'kepala\s+(kua\y|kantor\s+urusan\s+agama\y)' then
    raise exception 'Kepala KUA dan Plt. Kepala KUA adalah jabatan tambahan. Isi kolom Jabatan dengan jabatan fungsional pegawai (mis. Penghulu atau Penyuluh), lalu pilih Kepala KUA di Jabatan Tambahan.'; end if;
  if new.jenis_asn is null or new.jenis_asn not in ('PNS','PPPK','PPPK Paruh Waktu','Honor') then
    raise exception 'Jenis ASN harus PNS, PPPK, PPPK Paruh Waktu, atau Honor.'; end if;

  -- jabatan tambahan: hanya Kepala KUA atau Plt. Kepala KUA (huruf besar/kecil, spasi, dan titik dirapikan), khusus PNS atau PPPK
  new.jabatan_tambahan := nullif(btrim(regexp_replace(coalesce(new.jabatan_tambahan, ''), '\s+', ' ', 'g')), '');
  if new.jabatan_tambahan is not null then
    tb := lower(regexp_replace(new.jabatan_tambahan, '[\s.]+', '', 'g'));
    new.jabatan_tambahan := case tb when 'kepalakua' then 'Kepala KUA' when 'pltkepalakua' then 'Plt. Kepala KUA' else null end;
    if new.jabatan_tambahan is null then raise exception 'Jabatan tambahan hanya boleh Kepala KUA atau Plt. Kepala KUA.'; end if;
    if new.jenis_asn not in ('PNS','PPPK') then
      raise exception 'Jabatan tambahan % hanya untuk pegawai PNS atau PPPK.', new.jabatan_tambahan; end if;
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

  if new.usia_pensiun is not null and new.usia_pensiun not between 40 and 75 then
    raise exception 'Usia pensiun harus antara 40 sampai 75 tahun.'; end if;
  new.sumber_usia_pensiun := upper(nullif(btrim(coalesce(new.sumber_usia_pensiun, '')), ''));
  if new.sumber_usia_pensiun is not null and new.sumber_usia_pensiun not in ('AUTO','MANUAL') then
    raise exception 'Sumber usia pensiun hanya AUTO atau MANUAL.'; end if;
  if new.usia_pensiun is null then new.sumber_usia_pensiun := null;
  elsif new.sumber_usia_pensiun is null then new.sumber_usia_pensiun := 'MANUAL'; end if;

  -- NIP: PNS dan PPPK wajib 18 angka (spasi diabaikan); PPPK Paruh Waktu boleh belum punya NIP, tetapi bila diisi harus 18 angka;
  -- NIP tidak boleh kembar; Honor tidak punya NIP
  new.nip := nullif(regexp_replace(coalesce(new.nip, ''), '\s', '', 'g'), '');
  new.pangkat_golongan := nullif(btrim(coalesce(new.pangkat_golongan, '')), '');
  if new.jenis_asn = 'Honor' then
    if new.nip is not null then raise exception 'Pegawai Honor tidak memiliki NIP. Kosongkan kolom NIP.'; end if;
    if new.pangkat_golongan is not null then raise exception 'Pegawai Honor tidak memiliki pangkat/golongan.'; end if;
  else
    if new.nip is null then
      if new.jenis_asn <> 'PPPK Paruh Waktu' then raise exception 'NIP wajib diisi untuk pegawai %.', new.jenis_asn; end if;
    else
      if new.nip !~ '^[0-9]{18}$' then raise exception 'NIP harus 18 angka (spasi diabaikan). Yang diisi: % angka.', char_length(new.nip); end if;
      select g.kua_id, k.nama_kua, g.nama into gk, kn, gn
        from public.pegawai g join public.kua k on k.id = g.kua_id where g.nip = new.nip and g.id is distinct from new.id;
      if found then
        if gk = new.kua_id then raise exception 'NIP % sudah terdaftar di KUA ini atas nama %.', new.nip, gn; end if;
        raise exception 'NIP % sudah terdaftar di %. Bila pegawai ini pindah tugas, minta Operator KUA tersebut memindahkannya (Transfer) ke KUA Anda.', new.nip, kn;
      end if;
    end if;
    if new.jenis_asn = 'PNS' and (new.pangkat_golongan is null or new.pangkat_golongan !~ '^((I|II|III)/[a-d]|IV/[a-e])$') then
      raise exception 'Pangkat/golongan PNS wajib dipilih (I/a sampai IV/e).'; end if;
    if new.jenis_asn = 'PPPK' and (new.pangkat_golongan is null or not (new.pangkat_golongan = any (romawi))) then
      raise exception 'Golongan PPPK wajib dipilih (I sampai XVII).'; end if;
    if new.jenis_asn = 'PPPK Paruh Waktu' and new.pangkat_golongan is not null and not (new.pangkat_golongan = any (romawi)) then
      raise exception 'Golongan PPPK Paruh Waktu tidak valid (I sampai XVII). Kosongkan bila belum ada.'; end if;
  end if;

  -- satu orang untuk tiap jabatan tambahan di tiap KUA (indeks unik pegawai_kepala_unik dan pegawai_plt_unik menjaga balapan simpan bersamaan)
  if new.jabatan_tambahan is not null then
    select g.nama into gn from public.pegawai g
      where g.kua_id = new.kua_id and g.jabatan_tambahan = new.jabatan_tambahan and g.id is distinct from new.id limit 1;
    if found then
      -- titik penutup nama (gelar "M.Ag.") dibuang di kalimat pertama supaya tidak menjadi dua titik
      raise exception '% di KUA ini sudah dijabat oleh %. Lepaskan jabatan tambahan itu dari % terlebih dahulu (ubah data pegawainya), lalu tetapkan di sini.', new.jabatan_tambahan, regexp_replace(gn, '\.+$', ''), gn; end if;
  end if;

  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now(); end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;

-- Ubah seluruh nama lama menjadi huruf kapital dan rapikan spasi.
update public.pegawai
   set nama = upper(btrim(regexp_replace(coalesce(nama, ''), '\s+', ' ', 'g')))
 where nama is distinct from upper(btrim(regexp_replace(coalesce(nama, ''), '\s+', ' ', 'g')));
