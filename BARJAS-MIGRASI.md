# Integrasi BARJAS ke BIMASATU CONNECT

## Cakupan

Modul BARJAS dari repository `purbaperdanajati/proc` ditempatkan di folder `barjas/` dan dirender sebagai modul di dalam BIMASATU melalui menu **BARJAS** pada sidebar utama. BARJAS tidak memiliki login, sidebar, atau shell aplikasi terpisah.

Fitur pengadaan tetap dipertahankan: Beranda, Paket Pengadaan, Satuan Kerja, Penugasan & Pagu, Penyedia, Pejabat, Pengaturan, HPS/RAB, dokumen paket, generator dokumen, Migrasi Data, dan Monev. Backend menggunakan Supabase. Data berada pada tabel `barjas_*` dan berkas baru tersimpan di bucket privat `barjas-files`.

## Persiapan Supabase

1. Buka Supabase Dashboard → SQL Editor.
2. Jalankan `bop.sql` versi terbaru (seperti instalasi BIMASATU biasa).
3. Jalankan file `barjas.sql` setelah `bop.sql`.
4. Deploy Edge Functions:

```bash
npx supabase functions deploy bop --no-verify-jwt
npx supabase functions deploy barjas --no-verify-jwt
```

Edge Function BARJAS memakai environment bawaan Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Service-role key tidak dikirim ke browser. Bucket `barjas-files` dibuat privat oleh SQL.

Jika skema SIPADU lama pernah digunakan, `barjas.sql` akan mengganti nama tabel `sipadu_*` dan sequence menjadi `barjas_*`, serta memindahkan hak menu lama `sipadu` ke `barjas` tanpa menghapus isi tabel. Bucket lama `sipadu-files` tidak dihapus; Edge Function BARJAS tetap dapat membaca berkas lama. Semua unggahan baru menggunakan `barjas-files`.

## Akun dan hak akses

- Login, profil, sesi Supabase, identitas pengguna, dan logout sepenuhnya menggunakan BIMASATU.
- Tidak ada halaman **Pengguna**, CRUD akun, reset password, atau login kedua khusus BARJAS.
- Admin BIMASATU otomatis dapat membuka semua menu, termasuk BARJAS.
- Untuk peran lain, Admin membuka **Hak Akses Menu** di BIMASATU lalu mencentang **BARJAS** pada peran yang dikehendaki. Akses BARJAS tidak lagi dibatasi pada peran khusus.
- Pengguna BARJAS memakai akun BIMASATU yang sama. Satker yang dapat dikelola tetap ditentukan oleh tabel `barjas_penugasan` per tahun.

## Migrasi data dari SIPADU lama

1. Masuk ke BIMASATU sebagai Admin.
2. Buka menu **BARJAS → Migrasi Data** pada sidebar utama.
3. Masukkan URL Web App Apps Script lama (akhiri dengan `/exec`) dan kredensial Admin SIPADU lama. Kredensial sumber hanya dipakai selama sesi migrasi.
4. Setelah data lama terbaca, hubungkan masing-masing pengguna SIPADU ke akun BIMASATU yang sudah ada. Akun dan password lama tidak dibuat ulang atau disalin; pengguna tetap menggunakan password BIMASATU.
5. Jalankan migrasi. Data master, penugasan, paket semua tahun, HPS, Monev, metadata dokumen, dan company profile diproses.
6. Periksa jumlah data dan buka sampel dokumen dari beberapa paket sebelum beralih sepenuhnya.

Migrasi dapat dijalankan ulang. ID lama digunakan sebagai kunci sehingga master dan paket tidak diduplikasi. Berkas yang dapat diunduh dari endpoint lama disalin ke Supabase Storage. Apabila Google Drive lama tidak dapat dibaca, metadata dan URL lama tetap disimpan sebagai rujukan.

**Jangan hapus** Spreadsheet, deployment Apps Script, atau folder Google Drive lama sampai hasil migrasi diverifikasi. Data lama tidak diubah atau dihapus oleh fitur migrasi.

## Pengujian setelah deploy

- Login sebagai Admin BIMASATU, lalu buka BARJAS dari sidebar utama.
- Berikan akses BARJAS melalui **Hak Akses Menu** kepada satu peran yang dipilih dan uji dengan akun peran tersebut.
- Pastikan akun tanpa akses BARJAS ditolak oleh router, Edge Function, dan RLS.
- Uji navigasi dari/ke menu BIMASATU lainnya tanpa login ulang atau kehilangan sesi.
- Uji tambah/ubah data satker, pejabat, penyedia, penugasan, paket, HPS/RAB, dan Monev sesuai hak masing-masing.
- Uji unggah, pratinjau, unduh, serta hapus dokumen pada bucket privat `barjas-files`.
- Jalankan migrasi pada data uji lebih dari sekali, cocokkan jumlah data serta sampel dokumen hasil migrasi.

## Catatan kompatibilitas

- Password dan salt dari tabel Users SIPADU lama tidak diimpor.
- Penugasan untuk pengguna lama yang tidak dipetakan akan tersimpan tanpa `user_id`; Admin dapat memperbaikinya melalui halaman Penugasan & Pagu.
- Company profile dan dokumen yang belum bisa diunduh tetap memiliki metadata/URL sumber sebagai referensi.

## Integrasi BIMASATU

BARJAS dimuat dari `index.html`, memakai klien dan sesi Supabase yang sama, serta mengikuti sub-rute `#barjas/<halaman>` di router utama. CSS dan elemen DOM BARJAS dibatasi pada `#barjas-root` agar tidak memengaruhi halaman lain. Shell standalone `barjas/app.html` dan pengelolaan pengguna khusus BARJAS dihapus.
