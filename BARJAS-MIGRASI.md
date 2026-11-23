# Integrasi BARJAS ke BIMASATU CONNECT

## Cakupan

Modul BARJAS dari repository \`purbaperdanajati/proc\` ditempatkan di \`barjas/\` dan dibuka dari menu **BARJAS · Pengadaan** pada CONNECT. Antarmuka dan alur pengadaan dipertahankan: Beranda, Paket Pengadaan, Satuan Kerja, Penugasan & Pagu, Penyedia, Pejabat, Pengguna, Pengaturan, HPS/RAB, dokumen paket, generator dokumen, dan Monev.

Backend Apps Script/Spreadsheet diganti dengan Supabase. Data BARJAS berada pada tabel \`barjas_*\`, terpisah dari tabel BOP, BAST NR, BMN, Jaspro, dan modul CONNECT lainnya. Berkas baru tersimpan di bucket privat \`barjas-files\`.

## Persiapan Supabase

1. Pastikan perubahan utama CONNECT sudah diterapkan.
2. Buka Supabase Dashboard → SQL Editor.
3. Jalankan \`bop.sql\` (seperti instalasi CONNECT biasa), lalu jalankan file **\`barjas.sql\`** dari repository ini.
4. Deploy kedua Edge Function:

\`\`\`bash
npx supabase functions deploy bop --no-verify-jwt
npx supabase functions deploy barjas --no-verify-jwt
\`\`\`

Edge Function BARJAS memakai environment bawaan Supabase: \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, dan \`SUPABASE_SERVICE_ROLE_KEY\`. Tidak ada service-role key yang ditaruh di browser. Bucket \`barjas-files\` dibuat privat oleh SQL.

## Akun dan hak akses

- Admin CONNECT otomatis dapat membuka menu BARJAS.
- Untuk pengelola, buka **Manajemen Pengguna**, buat akun dengan peran **Pengelola Pengadaan**, dan gunakan email akun yang valid.
- Peran **Pengelola Pengadaan** hanya dapat diberi menu BARJAS. Hak ini disediakan otomatis oleh \`barjas.sql\`.
- Pengelola Pengadaan tidak terikat pada KUA CONNECT. Satker yang dapat dibuka di BARJAS ditentukan oleh tabel \`barjas_penugasan\` per tahun.
- Buat/aktifkan akun baru terlebih dahulu sebelum menghubungkan pengguna lama pada halaman migrasi.

## Migrasi data dari SIPADU lama

1. Masuk ke CONNECT sebagai Admin.
2. Buka menu **BARJAS · Pengadaan**, lalu pilih **Migrasi Data** di sidebar BARJAS.
3. Masukkan URL Web App Apps Script lama (akhiri dengan \`/exec\`) dan kredensial Admin lama.
4. Setelah data lama terbaca, cocokkan masing-masing pengguna SIPADU lama dengan akun Supabase CONNECT. Akun lama tidak membawa password/hash lama; pengguna memakai password akun CONNECT yang dibuat Admin.
5. Jalankan migrasi. Data master, penugasan, paket semua tahun, HPS, Monev, metadata dokumen, dan company profile diproses.
6. Periksa jumlah data dan buka beberapa dokumen dari paket yang berbeda sebelum beralih sepenuhnya.

Migrasi dapat dijalankan ulang. ID lama digunakan sebagai kunci sehingga master/paket tidak diduplikasi. Berkas yang dapat diunduh dari endpoint lama disalin ke Supabase Storage. Apabila Google Drive lama tidak dapat dibaca, metadata dan URL lama tetap disimpan agar berkas tidak hilang dari daftar. Pastikan endpoint \`fileGet\` dan izin baca Drive lama masih aktif untuk memaksimalkan pemindahan berkas.

**Jangan hapus** Spreadsheet, deployment Apps Script, atau folder Google Drive lama sampai hasil migrasi diverifikasi. Data lama tidak diubah atau dihapus oleh fitur migrasi.

## Pengujian setelah deploy

- Login sebagai Admin CONNECT dan buka BARJAS.
- Buat akun Pengelola Pengadaan, berikan menu BARJAS, lalu pastikan akun tersebut tidak melihat menu CONNECT lain.
- Buat satker/penugasan, paket baru, HPS/RAB, dan Monev.
- Unggah PDF/gambar, pratinjau file, hapus file, dan cek bucket privat \`barjas-files\`.
- Jalankan migrasi ke data uji, cocokkan jumlah paket dan berkas, lalu jalankan ulang untuk memastikan tidak ada data ganda.

## Catatan kompatibilitas

- Password dan salt dari tabel Users lama tidak diimpor. Otentikasi baru sepenuhnya melalui Supabase Auth.
- Penugasan untuk pengguna yang tidak dipetakan akan tersimpan tanpa \`user_id\`; Admin dapat memperbaikinya setelah migrasi melalui menu Penugasan & Pagu.
- Company profile dan dokumen yang belum bisa diunduh tetap memiliki metadata/URL sumber sebagai referensi.
