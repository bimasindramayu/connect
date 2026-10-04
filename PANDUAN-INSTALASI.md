# Panduan Instalasi BOP KUA Kabupaten Indramayu (dari awal)

Panduan ini membawa Anda dari nol sampai aplikasi berjalan di GitHub Pages. **Ikuti urutannya, jangan melompat.**
`bop.sql` sudah diuji di PostgreSQL 16 (pemasangan baru, dijalankan dua kali, dan upgrade dari versi lama). Untuk gambaran teknis proyek, baca `skills/readme.md`.

> **Sudah memakai versi lama** (migration 01 sampai 08, fungsi `lpj` / `reset-password`)? Lompat ke **bagian 14**.

---

## 0. Gambaran sistem

| Bagian | Teknologi | Fungsi |
|---|---|---|
| Tampilan | `index.html` (satu file) di GitHub Pages | Login, menu BOP (Anggaran, RPD, Realisasi, Verifikasi, Pengaturan SAKTI, Realisasi SAKTI, Config, Laporan), Pengaturan |
| Database dan login | Supabase (PostgreSQL, Auth, RLS) | Data, hak akses admin/operator, semua aturan divalidasi di sisi server |
| Captcha login | Cloudflare Turnstile | Mencegah login otomatis |
| Dokumen LPJ dan reset password | Edge Function `bop` (satu fungsi) | Unggah/hapus/pratinjau LPJ ke satu folder pusat Google Drive; admin mereset password operator |

Prinsip keamanan: **kunci rahasia hanya ada di komputer Anda dan di Supabase Secrets.** Yang ada di GitHub hanyalah kunci publik
(URL Supabase, publishable key, Site Key Turnstile).

## 1. Persiapan

### 1.1 Akun (semua gratis)
GitHub, Supabase, Cloudflare, dan akun Google (pemilik folder LPJ di Drive).

### 1.2 Alat di komputer
- **Node.js 22** (minimal 20.6) dari nodejs.org. Cek: `node --version`.
- Git itu opsional: file bisa diunggah lewat web GitHub.

### 1.3 Isi paket
```
bop-kua/
├── index.html                    <- diunggah ke GitHub Pages
├── bop.sql                       <- SATU file SQL: seluruh skema database
├── migration-sakti.sql           <- hanya untuk database yang sudah berjalan (modul SAKTI, bagian 14b)
├── bop.mjs                       <- SATU skrip: buat akun + siapkan Google Drive
├── supabase/functions/bop/index.ts   <- SATU Edge Function (LPJ + reset password)
├── skills/readme.md              <- penjelasan proyek untuk AI/developer
├── PANDUAN-INSTALASI.md          <- file ini
└── .gitignore
```

### 1.4 Rahasia yang TIDAK boleh masuk GitHub
`.env`, `akun.csv`, Secret key/service_role Supabase, Google Client Secret, Refresh Token Google, Secret Key Turnstile.
`.gitignore` di paket ini sudah mencegah `.env` dan `akun.csv` ikut terunggah.

---

## 2. Buat project Supabase
1. Buka supabase.com, **New project**. Nama bebas (misal `bop-kua`), isi dan simpan *Database Password*, region terdekat (Southeast Asia/Singapore), plan **Free**.
2. Tunggu project siap, lalu catat tiga hal:
   - **Project URL**: `https://<ref>.supabase.co` (Project Settings, Data API). Bagian `<ref>` disebut *project ref*.
   - **Publishable key**: `sb_publishable_...` (Project Settings, API Keys). Kunci publik, aman di `index.html`.
   - **Secret key** (`sb_secret_...`) atau `service_role` (tab Legacy API Keys). **RAHASIA**, hanya untuk `.env` di komputer Anda.

## 3. Cloudflare Turnstile (captcha)
1. Masuk dash.cloudflare.com, menu **Turnstile**, **Add widget**.
2. Isi nama widget. Pada *Hostname* tambahkan `<username-github>.github.io` dan (untuk uji lokal) `localhost`. Mode: **Managed**.
3. Catat **Site Key** (publik, untuk `index.html`) dan **Secret Key** (rahasia, untuk Supabase pada langkah 4).

## 4. Pengaturan Auth di Supabase
Dashboard Supabase, menu **Authentication**:
1. **Sign In / Providers**: pastikan *Email* aktif. **Matikan "Allow new users to sign up"** (akun hanya dibuat admin). Atur *Minimum password length* menjadi 8.
2. **Attack Protection**: aktifkan **CAPTCHA protection**, provider **Cloudflare Turnstile**, isi **Secret Key** dari langkah 3.
3. (Opsional) **URL Configuration**: isi *Site URL* dengan alamat GitHub Pages Anda (langkah 10).

## 5. Database: jalankan `bop.sql` (sekali)
Dashboard Supabase, **SQL Editor**, **New query**. Buka `bop.sql`, salin **seluruh isinya**, tempel, klik **Run**. Pastikan hasilnya *Success*.

`bop.sql` membuat semuanya: tabel `profiles`, `kua` (31), `pos` (11), `config`, `anggaran`, `rpd`, `realisasi`, `metode_pembayaran`, `realisasi_sakti`, `autopayment_pos` (arsip), `jaspro_data`, `bast_pegawai`, `bast_ba`, `bast_setting`, fungsi, trigger validasi, dan RLS.
Aman dijalankan berulang kali (idempotent), dan jika database masih memakai struktur lama, datanya dikonversi otomatis.

**Cek hasil** (jalankan di SQL Editor):
```sql
select (select count(*) from kua) as kua, (select count(*) from pos) as pos, (select count(*) from config) as config;
-- harapan: 31 | 11 | 6
select table_name from information_schema.tables where table_schema = 'public' order by 1;
-- harapan: anggaran, autopayment_pos, bast_ba, bast_pegawai, bast_setting, config, jaspro_data, kua, metode_pembayaran, pos, profiles, realisasi, realisasi_sakti, rpd
```

## 6. Buat akun (1 admin + 31 operator)
1. Buka terminal di folder `bop-kua`, jalankan sekali: `npm install @supabase/supabase-js`
2. Buat file **`.env`** di folder yang sama:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SERVICE_ROLE_KEY=<Secret key atau service_role dari langkah 2>
   ADMIN_EMAIL=admin@contoh.go.id
   ADMIN_PASSWORD=<password admin, minimal 8 karakter>
   EMAIL_DOMAIN=contoh.go.id
   ```
3. Jalankan: `node --env-file=.env bop.mjs akun`
4. Hasilnya `akun.csv` berisi email dan password tiap akun (operator berpola `kua.<namakecamatan>@<EMAIL_DOMAIN>`, misal `kua.kedokanbunder@...`).
   **Simpan rapi, bagikan ke tiap operator, lalu hapus filenya. Jangan diunggah ke GitHub.**
5. Cek di Supabase, **Table Editor**, tabel `profiles`: harus ada 32 baris, dan kolom `kua_id` terisi untuk operator.

**Menambah akun belakangan:** Authentication, Users, *Add user* (centang auto-confirm). Lalu atur profilnya di SQL Editor:
```sql
update public.profiles
   set nama = 'Operator KUA Contoh', kua = 'KUA Kec. Contoh', role = 'operator',
       kua_id = (select id from public.kua where nama_kua = 'KUA Kec. Contoh')
 where id = '<uuid-user-dari-halaman-Users>';
```

## 7. Google Drive untuk dokumen LPJ
Semua file LPJ masuk ke **satu folder pusat** milik akun Google yang Anda pilih. Strukturnya dibuat otomatis:
`BOP KUA - LPJ / <tahun> / <nama KUA> / Realisasi / <MM Bulan> / <file>`.

**7a. Google Cloud Console** (console.cloud.google.com):
1. Buat project baru, lalu aktifkan **Google Drive API** (APIs & Services, Library).
2. **OAuth consent screen / Google Auth Platform**: tipe *External* (atau *Internal* bila memakai Google Workspace). Isi nama aplikasi dan email. Pada *Data Access* tambahkan scope `https://www.googleapis.com/auth/drive.file`.
3. **Publish app** (status *In production*). Bila dibiarkan *Testing*, token kedaluwarsa dalam 7 hari. Scope `drive.file` tidak memerlukan verifikasi Google.
4. **Credentials**, *Create credentials*, *OAuth client ID*, jenis **Desktop app**. Salin **Client ID** dan **Client Secret**, tambahkan ke `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

**7b. Ambil izin akses dan buat folder pusat:**
```
node --env-file=.env bop.mjs drive
```
Buka URL yang tampil di browser, login dengan akun Google pemilik folder (kuota Drive akun ini yang terpakai), lalu izinkan.
(Jika muncul peringatan *Google hasn't verified this app*, pilih Advanced lalu *Go to ... (unsafe)*.)
Skrip membuat folder **BOP KUA - LPJ** dan mencetak satu baris perintah `npx supabase secrets set ...`. **Simpan baris itu untuk langkah 8.**

Catatan:
- Ingin memakai folder buatan sendiri? Tambahkan `DRIVE_FOLDER_ID=<id folder>` di `.env` sebelum menjalankan perintah di atas (skrip memakai scope `drive`).
- Admin membuka dokumen lewat pratinjau di aplikasi (tidak perlu akses Drive). Untuk membuka foldernya langsung, gunakan akun Google pemilik folder, atau bagikan folder ke akun lain.
- Operator hanya bisa mengunggah PDF/JPG/PNG (batas ukuran dan jumlah diatur di BOP, Config). File yang dihapus operator dipindahkan ke Sampah Google Drive.

## 8. Deploy Edge Function `bop`
Di terminal, folder `bop-kua`:
```
npx supabase login
npx supabase init
npx supabase link --project-ref <ref>
<tempel baris "npx supabase secrets set ..." dari langkah 7b>
npx supabase functions deploy bop --no-verify-jwt
```
- `init` cukup sekali. Jika ditanya pengaturan VS Code/IntelliJ, jawab `N`. Jika `link` meminta password database, isi password dari langkah 2 (atau kosongkan).
- `--no-verify-jwt` **wajib**. Tanpa opsi ini platform Supabase menolak permintaan awal CORS (preflight `OPTIONS` tidak membawa token), dan browser menampilkan error
  *blocked by CORS policy ... does not have HTTP ok status* pada menu Realisasi/dokumen. Aman karena fungsi memeriksa sendiri token login dan peran pengguna.
- Agar tidak terlupa saat deploy berikutnya, tambahkan di `supabase/config.toml` (dibuat oleh `supabase init`):
  ```toml
  [functions.bop]
  verify_jwt = false
  ```
  Bila fungsi dideploy lewat dashboard Supabase, matikan opsi *Verify JWT* pada pengaturan fungsi `bop`.
- Uji dari terminal (ganti `<ref>`): `curl -i -X OPTIONS "https://<ref>.supabase.co/functions/v1/bop?action=list" -H "Origin: https://<username>.github.io" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization,apikey"`.
  Hasil sehat: `200` dengan header `access-control-allow-origin`. `401` = Verify JWT masih menyala; `404` = fungsi belum di-deploy.
- Jika muncul pesan butuh Docker, tambahkan `--use-api` pada perintah deploy.
- `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` disediakan otomatis oleh Supabase; hanya 4 secret Google yang perlu Anda isi.
- Reset password operator tetap berfungsi walau langkah Google Drive belum dilakukan; hanya fitur LPJ yang butuh secret Google.

## 9. Isi konfigurasi `index.html`
Buka `index.html`, cari blok `CFG` di bagian script, lalu isi tiga nilai:
```js
const CFG = {
  url: 'https://<ref>.supabase.co',     // Project URL
  key: 'sb_publishable_...',            // Publishable key
  turnstile: '<Site Key Turnstile>'     // Site Key (bukan Secret Key)
};
```

## 10. Publikasi di GitHub Pages
1. Di github.com buat repository baru (misal `bop-kua`). GitHub Pages gratis memerlukan repository **publik**; `index.html` hanya berisi kunci publik sehingga aman.
2. Unggah `index.html` (Add file, Upload files, Commit). File lain tidak perlu dipublikasikan; simpan di komputer atau repository privat.
3. **Settings, Pages, Build and deployment**: Source **Deploy from a branch**, Branch **main**, folder **/ (root)**, Save.
4. Tunggu 1 sampai 2 menit. Alamatnya `https://<username>.github.io/<nama-repo>/`.
5. Pastikan `<username>.github.io` sudah ada di *Hostname* Turnstile (langkah 3), jika belum tambahkan.

## 11. Uji coba pertama (checklist)
1. Buka alamat GitHub Pages, login sebagai **admin** (selesaikan captcha).
2. **BOP, Anggaran**: isi anggaran tahun berjalan untuk beberapa KUA, klik *Simpan Anggaran* (satu tombol untuk semua).
3. **BOP, Config**: periksa batas file, saklar RPD/Realisasi, dan **Bulan yang dibuka untuk edit RPD** (pilih lewat kotak pilihan, bisa mengetik untuk mencari).
4. **BOP, Pengaturan SAKTI**: pilih metode MANUAL atau SAKTI per KUA untuk Listrik/Telepon-Internet/Air (yang belum diatur = MANUAL), lalu **BOP, Realisasi SAKTI**: pilih bulan dan input status, nominal, serta tanggal pembayaran tiap KUA.
5. Logout, login sebagai **operator**: **BOP, RPD**, Detail bulan, isi, simpan.
6. Operator **Realisasi** (boleh dikirim mulai tanggal 10 bulan berjalan; gunakan filter bulan bila perlu): isi nominal, unggah LPJ (PDF/JPG/PNG), kirim.
7. Admin: **Verifikasi**, filter kecamatan/tahun/bulan/status, Detail, lihat dokumen (zoom/putar), ubah status.
8. Coba **Laporan** (Excel dan PDF), lalu **Pengaturan**: Daftar akun, *Reset password* operator.
9. Admin: menu **Jaspro Transport**: unggah laporan nominatif (.xlsx), isi Master Rekening, *Cocokkan dan Pratinjau*, lalu unduh Excel/CSV. Hanya satu set data yang disimpan; unggahan baru menimpa yang lama.
10. Admin: grup menu **BAST NR**: Pegawai, Pengaturan BAST, Buat BA, lalu Riwayat (Detail, unggah arsip, PDF).

## 12. Pemeliharaan dan kuota gratis
- **Update tampilan:** ubah `index.html`, unggah ulang ke GitHub.
- **Update Edge Function:** ubah `bop/index.ts`, jalankan lagi `npx supabase functions deploy bop --no-verify-jwt`.
- **Update database:** jalankan ulang `bop.sql` yang terbaru (aman, tidak menghapus data aktif).
- **Project Free dijeda** Supabase bila tidak ada aktivitas sekitar 1 minggu: buka dashboard lalu *Restore project*.
- **Backup:** plan Free tidak menyediakan backup otomatis. Ekspor data penting berkala (Table Editor, Export CSV) atau unduh Laporan Excel.
- **Hemat kuota log dan storage:** aplikasi tidak menyimpan log aktivitas, tidak memakai cron, dan fungsi `bop` tidak menulis log. RPD dan Realisasi hanya 12 record per KUA per tahun.
  Log bawaan Supabase (permintaan API dan pemanggilan function) tetap ada. Hindari membuka halaman *Logs* di dashboard berulang-ulang.

## 13. Pemecahan masalah
| Gejala | Penyebab | Solusi |
|---|---|---|
| "Login gagal: ... captcha tidak valid" | Hostname belum ada di Turnstile / Secret Key salah di Supabase | Cek langkah 3 dan 4 |
| "Profil akun tidak ditemukan" | Profil belum terisi | Jalankan `bop.sql` lagi (otomatis membuat profil yang hilang) atau SQL pada langkah 6 |
| "Anggaran Tahunan ... belum ditetapkan" | Admin belum mengisi anggaran | BOP, Anggaran |
| "Realisasi ... baru dapat disubmit mulai tanggal 10" | Aturan: boleh dikirim mulai tanggal 10 bulan tersebut | Tunggu tanggalnya |
| "Hanya Realisasi yang ditolak yang dapat diperbaiki" | Status sudah Menunggu/Disetujui/Dibayar | Admin mengubah status ke Ditolak bila perlu perbaikan |
| "Tidak dapat menghubungi server ... Edge Function bop" | Function belum di-deploy | Langkah 8 |
| "Gagal terhubung ke Google Drive" atau `invalid_grant` | Refresh token kedaluwarsa (app masih Testing) atau secret salah | *Publish app*, ulangi langkah 7b dan 8 |
| "Gagal membuat folder ... DRIVE_ROOT_FOLDER_ID" | Folder bukan buatan `bop.mjs drive` (scope `drive.file`) atau ID salah | Pakai folder dari skrip, atau lihat catatan folder sendiri di langkah 7 |
| "isi file tidak sesuai ekstensinya" | File bukan PDF/JPG/PNG asli | Unggah file yang benar |
| "new row violates row-level security policy" pada RPD | Bulan ditutup di Config / data KUA lain | Admin membuka bulan di BOP, Config |
| SQL error saat menjalankan `bop.sql` | Salinan tidak lengkap | Salin ulang seluruh isi file, jalankan lagi |
| Browser: *blocked by CORS policy ... Response to preflight request doesn't pass access control check: It does not have HTTP ok status* (menu Realisasi, dokumen LPJ) | Fungsi `bop` belum di-deploy, atau di-deploy dengan *Verify JWT* menyala sehingga platform menolak preflight sebelum kode berjalan | Deploy ulang `npx supabase functions deploy bop --no-verify-jwt` (lihat langkah 8 untuk uji `curl`) |
| "Realisasi SAKTI hanya dapat diinput oleh Admin" / "POS ... bermetode SAKTI pada ..." | Operator mengisi POS yang diatur SAKTI | Wajar: minta admin menginput di BOP, Realisasi SAKTI |
| "... bermetode MANUAL pada ... Realisasi SAKTI hanya untuk POS bermetode SAKTI" | Admin menginput SAKTI untuk POS yang masih MANUAL | Atur dulu di BOP, Pengaturan SAKTI |
| "... sudah punya Realisasi manual (atau SAKTI) pada ..., jadi belum bisa ..." | Mengganti metode untuk bulan yang sudah ada datanya | Pilih "Berlaku mulai" sesudah bulan tersebut |
| `Cannot set properties of null` di konsol browser | Pindah menu saat data masih dimuat (versi lama) | Pakai `index.html` terbaru (hasil await dari halaman lama kini diabaikan) |

## 14. Sudah memakai versi lama?
Jika database Anda sudah dibuat dengan migration terpisah (01 sampai 08) dan fungsi `lpj` / `reset-password`:
1. SQL Editor: jalankan `bop.sql` sekali. Aman: struktur sudah sesuai, tabel lama (`rpd_lama`, `realisasi_lama`) dihapus bila ada dan datanya sudah pindah.
2. Deploy fungsi baru: `npx supabase functions deploy bop --no-verify-jwt`. Secret Google yang lama dipakai ulang (secret berlaku untuk seluruh project).
3. Ganti `index.html` di GitHub dengan versi terbaru (sekarang memanggil fungsi `bop`).
4. Opsional, hapus fungsi lama: `npx supabase functions delete lpj` dan `npx supabase functions delete reset-password`.

## 14b. Menambahkan modul SAKTI ke database yang sudah berjalan
1. **Cadangkan** dulu: BOP, Laporan (Excel) atau ekspor tabel penting dari Table Editor.
2. SQL Editor: jalankan `migration-sakti.sql` sekali (atau `bop.sql` terbaru; hasilnya sama). Aman diulang. Hasil migrasi muncul sebagai pesan `NOTICE`
   (jumlah versi metode, baris Realisasi SAKTI, dan bulan yang bentrok) serta tersimpan di tabel `config` dengan kunci `sakti_migrasi_autopayment`.
3. Migrasi sekali dari AutoPayment lama: tiap versi AutoPayment menjadi metode SAKTI sejak bulan berlaku, dan tiap bulan yang sudah berjalan menjadi satu baris Realisasi SAKTI
   berstatus *Sudah dibayar* dengan nominal yang sama (tanpa tanggal pembayaran), sehingga total bulan-bulan lalu **tidak berubah**. Tabel `autopayment_pos` dibiarkan sebagai arsip.
4. Ganti `index.html` di GitHub (menu AutoPayment diganti Pengaturan SAKTI dan Realisasi SAKTI). Edge Function tidak berubah.
5. Mulai bulan berikutnya SAKTI **tidak terisi otomatis**: admin menginput nominal sebenarnya di BOP, Realisasi SAKTI. Selama belum diinput, POS SAKTI berstatus Belum dibayar (Rp 0).

## 15. Ringkasan aturan aplikasi
Aturan lengkap beserta tempat penegakannya ada di `skills/readme.md` (bagian 5). Intinya:
- **Admin** melihat semua KUA; **operator** hanya KUA-nya (dijaga RLS dan trigger, bukan hanya tampilan).
- **RPD dan Realisasi** = 1 record per KUA per bulan, rincian POS berupa JSON. Kode akun POS selalu tampil.
- Total RPD setahun <= Anggaran. Realisasi: mulai tanggal 10, LPJ wajib, total sebulan <= RPD bulan itu, tiap POS setahun <= RPD POS itu.
- Operator hanya bisa membuat atau memperbaiki Realisasi yang **Ditolak**; setelah dikirim, nominal dan LPJ terkunci. Admin mengubah **status** kapan saja (bukan nominal/LPJ).
- **Pembayaran SAKTI**: Listrik, Telepon/Internet, Air dapat diatur MANUAL atau SAKTI per KUA (berlaku mulai bulan yang dipilih; belum diatur = MANUAL). POS SAKTI tidak diisi operator; admin menginput Realisasi SAKTI (status, nominal, tanggal, keterangan) dan jumlahnya ikut batas RPD, validasi, dan laporan. Metode dan Realisasi SAKTI tidak bisa dihapus; koreksi lewat ubah status ke Belum dibayar.
## 16. Memindahkan BAST NR dari Apps Script
1. SQL Editor: jalankan `bop.sql` terbaru (menambah tabel `bast_*`, aman diulang).
2. Deploy ulang fungsi (ada aksi arsip baru): `npx supabase functions deploy bop --no-verify-jwt`.
3. Tambahkan ke `.env`: `BAST_WEB_APP_URL=<URL Web App BAST NR lama, berakhiran /exec>`, lalu jalankan `node --env-file=.env bop.mjs bast`. Baca daftar PERINGATAN yang tercetak (baris yang dilewati).
4. Unggah `index.html` **dan `logo-data.js`** ke GitHub (logo kop PDF dimuat dari file ini).
5. Cek di menu BAST NR: jumlah Berita Acara dan Pegawai sama dengan sistem lama, buka satu Detail, unduh PDF-nya.
6. Setelah yakin, nonaktifkan deployment Apps Script lama (Deploy, Manage deployments, Archive): URL-nya terbuka untuk siapa pun yang tahu alamatnya.