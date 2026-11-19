-- Ubah nama pegawai yang telanjur seluruhnya HURUF BESAR menjadi format Title Case.
-- Jalankan setelah migration 20261119_pegawai_nama_mixed_case.sql.
--
-- CATATAN PENTING:
-- Ini normalisasi perkiraan, bukan pemulihan ejaan asli secara persis. Kapitalisasi asli
-- tidak dapat ditebak dari teks yang sudah diubah menjadi uppercase. Untuk pemulihan persis,
-- gunakan backup Supabase sebelum perubahan lalu pulihkan kolom nama berdasarkan id.
--
-- Hanya baris yang seluruh teksnya uppercase yang diubah. Gelar bertitik umum akan
-- menjadi format seperti "Drs. H. Ahmad Fauzi, M.Ag." dan "S.Pd.I.".

begin;

with kandidat as (
  select
    id,
    initcap(lower(btrim(regexp_replace(coalesce(nama, ''), '\s+', ' ', 'g')))) as nama_title
  from public.pegawai
  where nama is not null
    and btrim(nama) <> ''
    and nama = upper(nama)
),
format as (
  select
    id,
    -- Beberapa singkatan lazim dipertahankan kapitalnya.
    regexp_replace(
      regexp_replace(nama_title, '\mKh\.', 'KH.', 'g'),
      '\mS\.Ip\.', 'S.IP.', 'g'
    ) as nama_baru
  from kandidat
)
update public.pegawai p
set nama = f.nama_baru
from format f
where p.id = f.id
  and p.nama is distinct from f.nama_baru;

commit;
