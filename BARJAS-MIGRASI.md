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

Jika file SQL SIPADU versi sebelumnya pernah dijalankan, `barjas.sql` akan mengganti nama tabel `sipadu_*` dan sequence menjadi `barjas_*`, serta memindahkan hak menu lama `sipadu` ke `barjas` tanpa menghapus isi tabel. Bucket lama `sipadu-files` tidak dihapus; Edge Function BARJAS tetap dapat membaca dan menghapus berkas lama di sana. Semua unggahan baru disimpan ke `barjas-files`.

Edge Function BARJAS memakai environment bawaan Supabase: \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, dan \`SUPABASE_SERVICE_ROLE_KEY\`. Tidak ada service-role key yang ditaruh di browser. Bucket \`barjas-files\` dibuat privat oleh SQL.

## Akun dan hak akses

- Admin BIMASATU otomatis dapat membuka menu BARJAS.
- Untuk pengelola, buka **Manajemen Pengguna**, buat akun dengan peran **Pengelola Pengadaan**, dan gunakan email akun yang valid.
- Peran **Pengelola Pengadaan** hanya dapat diberi menu BARJAS. Hak ini disediakan otomatis oleh \`barjas.sql\`.
- Pengelola Pengadaan tidak terikat pada KUA CONNECT. Satker yang dapat dibuka di BARJAS ditentukan oleh tabel \`barjas_penugasan\` per tahun.
- Buat/aktifkan akun baru terlebih dahulu sebelum menghubungkan pengguna lama pada halaman migrasi.

## Migrasi data dari SIPADU lama

1. Masuk ke CONNECT sebagai Admin.
2. Buka menu **BARJAS → Migrasi Data** pada sidebar BIMASATU.
3. Masukkan URL Web App Apps Script lama (akhiri dengan \`/exec\`) dan kredensial Admin lama.
4. Setelah data lama terbaca, cocokkan masing-masing pengguna SIPADU lama dengan akun BIMASATU yang sudah ada. Password/hash SIPADU lama tidak dipindahkan; pengguna tetap memakai password BIMASATU.
5. Jalankan migrasi. Data master, penugasan, paket semua tahun, HPS, Monev, metadata dokumen, dan company profile diproses.
6. Periksa jumlah data dan buka beberapa dokumen dari paket yang berbeda sebelum beralih sepenuhnya.

Migrasi dapat dijalankan ulang. ID lama digunakan sebagai kunci sehingga master/paket tidak diduplikasi. Berkas yang dapat diunduh dari endpoint lama disalin ke Supabase Storage. Apabila Google Drive lama tidak dapat dibaca, metadata dan URL lama tetap disimpan agar berkas tidak hilang dari daftar. Pastikan endpoint \`fileGet\` dan izin baca Drive lama masih aktif untuk memaksimalkan pemindahan berkas.

**Jangan hapus** Spreadsheet, deployment Apps Script, atau folder Google Drive lama sampai hasil migrasi diverifikasi. Data lama tidak diubah atau dihapus oleh fitur migrasi.

## Pengujian setelah deploy

- Login ke BIMASATU sebagai Admin dan buka BARJAS dari sidebar utama.
- Berikan izin BARJAS melalui Hak Akses Menu kepada salah satu peran yang dipilih, lalu pastikan pengguna tersebut dapat membuka BARJAS tanpa login ulang.
- Pastikan pengguna tanpa izin BARJAS ditolak oleh router, Edge Function, dan RLS.
- Buat satker/penugasan, paket baru, HPS/RAB, dan Monev.
- Unggah PDF/gambar, pratinjau file, hapus file, dan cek bucket privat \`barjas-files\`.
- Jalankan migrasi ke data uji, cocokkan jumlah paket dan berkas, lalu jalankan ulang untuk memastikan tidak ada data ganda.

## Catatan kompatibilitas

- Password dan salt dari tabel Users lama tidak diimpor. Otentikasi baru sepenuhnya melalui Supabase Auth.
- Penugasan untuk pengguna yang tidak dipetakan akan tersimpan tanpa \`user_id\`; Admin dapat memperbaikinya setelah migrasi melalui menu Penugasan & Pagu.
- Company profile dan dokumen yang belum bisa diunduh tetap memiliki metadata/URL sumber sebagai referensi.


## Integrasi BIMASATU

BARJAS dimuat dari `index.html` dan memakai sesi Supabase yang sama dengan BIMASATU. Hash halaman menggunakan pola `#barjas/<halaman>` sehingga subhalaman tetap berada di router utama. CSS dan elemen DOM BARJAS dibatasi pada `#barjas-root` agar tidak memengaruhi tampilan menu lain. Halaman standalone `barjas/app.html` dan manajemen pengguna BARJAS dihapus.
