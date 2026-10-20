# Panduan Instalasi BIMASATU (dari nol)

Panduan ini membangun **seluruh sistem dari awal**, dengan anggapan semua yang tersimpan di Supabase, Apps Script/Spreadsheet, dan Google Drive sudah hilang atau belum pernah ada.
Ikuti berurutan: bagian 2 sampai 9. Waktu sekitar 1 sampai 2 jam. Nama menu di dashboard Supabase, Google, dan Cloudflare dapat sedikit berbeda dari yang tertulis; yang penting nilai yang diisi sama.

## 1. Gambaran dan prasyarat

| Bagian | Dipakai untuk | Tempat |
|---|---|---|
| Website (HTML/JS) | Tampilan semua menu | GitHub Pages |
| Supabase | Login, BOP, Jaspro Transport | supabase.com (gratis) |
| Edge Function `bop` | Unggah/baca dokumen LPJ, reset password | Supabase |
| Apps Script + Spreadsheet | Sertifikat Masjid/Musala, Arah Kiblat, BAST NR | akun Google |
| Google Drive | Dokumen LPJ (BOP) dan arsip BAST NR | akun Google yang sama |
| Cloudflare Turnstile | Captcha di halaman login | cloudflare.com (gratis) |

Yang perlu disiapkan:
- Satu **akun Google** yang akan memiliki folder Drive, Spreadsheet, dan Apps Script. **Harus akun yang sama** untuk ketiganya (bagian 5 dan 7).
- Akun **Supabase**, **Cloudflare**, dan **GitHub**.
- Komputer dengan **Node.js 22 atau lebih baru** dan Git.

Isi folder proyek ini (lihat `README.md` bagian 2 untuk penjelasan tiap berkas): `index.html`, `css/`, `js/`, `views/`, `bop.sql`, `bop.mjs`, `supabase/functions/bop/`, `apps-script/`, `assets/`.

## 2. Supabase: proyek dan database

1. supabase.com > **New project**. Pilih region terdekat (Singapore), buat password database dan **simpan**. Tunggu proyek selesai dibuat.
2. **Project Settings > API (atau API Keys)**. Catat:
   - **Project URL** (`https://xxxx.supabase.co`) dan **Project ref** (bagian `xxxx`).
   - **Publishable key** (`sb_publishable_...`): aman dipasang di website.
   - **Secret key** (`sb_secret_...`, atau `service_role` pada tampilan lama): **RAHASIA**, hanya untuk `.env` di komputer Anda.
3. **SQL Editor > New query**: tempel **seluruh isi `bop.sql`** > **Run**. Hasil `Success`. Aman dijalankan ulang kapan pun. Ini membuat tabel, aturan (trigger), hak akses (RLS), dan data awal (31 KUA, 11 POS, pengaturan bawaan).
4. **Authentication > Sign In / Providers** (di tampilan lama: *Settings*): matikan **Allow new users to sign up**. **Wajib.** Semua akun dibuat oleh admin lewat `bop.mjs`. Bila pendaftaran dibiarkan terbuka, siapa pun yang tahu URL dan publishable key bisa mendaftar dengan `role=admin` di metadata dan otomatis menjadi admin.
5. **Authentication > URL Configuration**: isi **Site URL** dengan alamat website nanti, mis. `https://bimasindramayu.github.io/connect/`.

## 3. Cloudflare Turnstile (captcha login)

1. dash.cloudflare.com > **Turnstile** > **Add widget**. Hostname: `bimasindramayu.github.io` (sesuaikan dengan alamat GitHub Pages Anda, hanya nama host) dan `localhost` (untuk uji lokal). Mode **Managed**.
2. Catat **Site Key** (dipasang di `js/config.js`) dan **Secret Key** (dipasang di Supabase).
3. Supabase > **Authentication > Attack Protection** (di tampilan lama: *Bot and Abuse Protection*) > aktifkan **CAPTCHA protection**, provider **Turnstile**, isi **Secret Key** > Save.

## 4. Siapkan komputer dan buat akun

1. Di folder proyek: `npm install` (memasang `@supabase/supabase-js` untuk `bop.mjs`).
2. Salin `.env.example` menjadi `.env` lalu isi: `SUPABASE_URL`, `SERVICE_ROLE_KEY` (Secret key), `EMAIL_DOMAIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (minimal 8 karakter).
   - `EMAIL_DOMAIN` (mis. `kemenag-indramayu.go.id`) hanya "domain bayangan" di balik username; pengguna tidak pernah mengetiknya. **Harus sama** dengan `CFG.domain` di `js/config.js`.
   - **Jangan unggah `.env`** ke GitHub (sudah masuk `.gitignore`).
3. `node --env-file=.env bop.mjs akun` membuat 1 admin + 31 operator. Hasilnya **`akun.csv`** berisi username dan password awal. Username operator berpola `kua_<kecamatan>` (mis. `kua_anjatan`, `kua_kedokanbunder`). Bagikan password ke tiap KUA, lalu **hapus `akun.csv`** dari komputer (jangan diunggah). Operator dapat mengganti passwordnya sendiri di menu Pengaturan; admin dapat mereset password operator.

## 5. Google Drive (dokumen LPJ dan arsip BAST NR)

Gunakan **akun Google yang akan memiliki Spreadsheet dan Apps Script** (bagian 7).

1. console.cloud.google.com > buat **project** baru > **APIs & Services > Library** > aktifkan **Google Drive API**.
2. **OAuth consent screen**: tipe External, isi nama aplikasi dan email. Tambahkan scope `.../auth/drive.file`. Lalu klik **Publish app** (status *In production*). Bila dibiarkan *Testing*, token Google kedaluwarsa tiap 7 hari dan unggah LPJ berhenti.
3. **Credentials > Create credentials > OAuth client ID**, jenis **Desktop app**. Salin **Client ID** dan **Client secret** ke `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
4. `node --env-file=.env bop.mjs drive`. Buka URL yang dicetak, izinkan akses dengan akun Google tadi. Skrip membuat folder master bernama **BIMASATU** di Drive Anda dan mencetak satu baris perintah `npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... DRIVE_ROOT_FOLDER_ID=...`.
   **Simpan nilai `DRIVE_ROOT_FOLDER_ID`**: dipakai lagi di Apps Script (bagian 7).

## 6. Edge Function `bop`

```
npx supabase login
npx supabase link --project-ref <PROJECT-REF>
<tempel baris "npx supabase secrets set ..." dari bagian 5>
npx supabase functions deploy bop --no-verify-jwt
```
`--no-verify-jwt` aman: fungsi memeriksa token login dan peran sendiri. Bila CLI meminta `config.toml`, jalankan `npx supabase init` sekali (jawab tidak untuk pertanyaan tambahan), lalu ulangi.

## 7. Apps Script dan Spreadsheet (Sertifikat dan BAST NR)

Dengan **akun Google yang sama** seperti bagian 5.

1. sheets.google.com > **Spreadsheet baru** (mis. "BIMASATU Data"). Sheet apa pun yang ada boleh dibiarkan.
2. **Extensions > Apps Script**. Beri nama proyek, mis. "BIMASATU API".
3. Buat lima berkas skrip (**+ > Script**; nama persis, tanpa `.gs`) dan tempel isi dari folder `apps-script/`: **Code**, **Masjid**, **Kiblat**, **Pengaturan**, **Bast**. Kosongkan berkas `Code` bawaan lalu isi dengan `Code.gs` dari folder ini.
4. **Project Settings** (ikon roda gigi) > centang **Show "appsscript.json" manifest file in editor**. Buka `appsscript.json` dan ganti seluruh isinya dengan `apps-script/appsscript.json`.
5. Di bagian paling atas **Code.gs** isi tiga konstanta:
   - `SUPABASE_URL`: Project URL (bagian 2).
   - `SUPABASE_KEY`: **Publishable key** (bukan secret key).
   - `DRIVE_MASTER_FOLDER_ID`: nilai `DRIVE_ROOT_FOLDER_ID` dari bagian 5.
6. Pilih fungsi **`setupDatabase`** > **Run**. Setujui izin (bila muncul "Google hasn't verified this app": *Advanced > Go to ... (unsafe)*; ini skrip milik Anda sendiri). Hasilnya enam sheet: `DataMasjid`, `DataKiblat`, `Pengaturan`, `BastPegawai`, `BastBA`, `BastSetting`.
7. Pilih fungsi **`authorizeAccess`** > **Run**, lalu buka **Execution log**. Harus tampil: `Supabase Auth: HTTP 200`, akun Drive (email Anda), dan `Folder master Drive: HTTP 200` dengan nama `BIMASATU`. Bila folder master gagal dibaca, akun Apps Script berbeda dari akun yang menjalankan `bop.mjs drive`.
8. **Deploy > New deployment** > jenis **Web app**: *Execute as* **Me**, *Who has access* **Anyone** > Deploy. **Salin URL Web App** (`https://script.google.com/macros/s/.../exec`).
9. Buka URL itu di tab browser: harus tampil JSON `{"status":"ok", ...}` dengan daftar `deployedActions`.

> Setiap kali kode Apps Script diubah: **Deploy > Manage deployments > ikon pensil > Version: New version > Deploy**. Tanpa itu kode lama tetap berjalan.

## 8. Website

1. Buka `js/config.js` dan isi:
   - `nama`: `BIMASATU` (sama dengan `APP_NAME` di `supabase/functions/bop/index.ts` dan `bop.mjs`).
   - `url`: Project URL; `key`: Publishable key.
   - `turnstile`: **Site Key** Cloudflare (bagian 3).
   - `gas`: URL Web App Apps Script (bagian 7).
   - `domain`: sama dengan `EMAIL_DOMAIN` di `.env`.
2. (Opsional) letakkan `assets/logo-kemenag.png` agar PDF BAST NR memuat logo.
3. Unggah semua berkas ke repositori GitHub (kecuali yang ada di `.gitignore`). **Settings > Pages** > *Deploy from a branch* > `main` / `(root)`. Alamat situs: `https://<akun>.github.io/<repositori>/`.
4. Uji di komputer sendiri (bila perlu) lewat server statis, bukan dobel klik: `npx serve .` lalu buka alamat `localhost` yang tampil. Peta dan GPS membutuhkan `https://` atau `localhost`.

Bila `js/config.js` masih berisi nilai contoh, halaman menampilkan pita merah "js/config.js belum lengkap" yang menyebut bagian mana yang kurang.

## 9. Uji dan isi data awal

Login sebagai admin (username dan password dari `akun.csv`), lalu:

1. **Sertifikat > Status Apps Script**: harus "Tersambung" dengan peran admin. Bila gagal, lihat bagian 12.
2. **BOP**: menu *Config* (buka/tutup RPD dan Realisasi, batas ukuran/jumlah file), lalu **Anggaran** tahun berjalan per KUA. Operator baru bisa menyusun RPD setelah anggaran ada.
3. **BAST NR**: *Pengaturan BAST* (nama dan NIP Kepala Seksi, nomor awal surat, kode kantor, kode klasifikasi, alamat), lalu *Pegawai* (pegawai Bimas Islam dan pegawai tiap KUA). Buat satu BA uji, unggah satu arsip, dan buka pratinjaunya.
4. **Sertifikat > Pengaturan Sertifikat**: nama dan NIP Kepala Kantor, Kepala Seksi Bimas Islam, Petugas Ukur, dan tanda tangan (PNG/JPEG). Lalu tambah satu masjid dan cetak Piagam; tambah satu pengukuran Arah Kiblat dan cetak dokumennya.
5. Keluar, login sebagai satu operator (mis. `kua_anjatan`): hanya menu BOP KUA itu yang tampil; menu BAST NR dan Sertifikat tidak bisa dibuka.

## 10. Memasukkan data lama (opsional)

- **BOP**: menu **Impor Data Lama** (anggaran, RPD, Realisasi, dan berkas LPJ) dari sistem Apps Script/Spreadsheet lama; aman diulang.
- **BAST NR dan Sertifikat**: bila Anda masih punya cadangan Spreadsheet, tempel barisnya ke sheet yang sama (judul kolom harus sama persis dengan yang dibuat `setupDatabase`). Untuk `BastBA`, kolom `Id` harus angka unik; kolom NIP dan tanggal tetap berformat teks.

## 11. Pembaruan rutin

| Yang berubah | Langkah |
|---|---|
| Berkas website (`index.html`, `js/`, `views/`, `css/`) | Ganti berkasnya, **`node bump-versi.mjs`**, commit dan push. Jangan menimpa `js/config.js` Anda. |
| Apps Script | Tempel kode baru, **Manage deployments > Edit > New version**. |
| Edge Function | `npx supabase functions deploy bop --no-verify-jwt` |
| Database | Jalankan ulang `bop.sql` (aman). |

**Memperbarui dari versi satu-file (`index.html` besar):** salin nilai `CFG` dari `index.html` lama (url, key, turnstile, domain, gas) ke `js/config.js`, ganti seluruh berkas website dengan versi ini, jalankan `node bump-versi.mjs`, lalu push. Data tidak berubah.

## 12. Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Pita merah "js/config.js belum lengkap" | Nilai `url`, `key`, atau `turnstile` masih contoh. Isi sesuai bagian 8. |
| Login: "Invalid login credentials" | Username/password salah, atau `CFG.domain` berbeda dari `EMAIL_DOMAIN` saat `bop.mjs akun` dijalankan. |
| Captcha tidak muncul atau login ditolak karena captcha | Hostname situs belum ada di widget Turnstile, Site Key salah, atau Secret Key belum dipasang di Supabase. |
| Menu Sertifikat/BAST: "Sesi tidak valid ... (HTTP 401: ...)" | Token ditolak Supabase. Muat ulang halaman atau login ulang. Bila terus berulang, periksa `SUPABASE_URL` dan `SUPABASE_KEY` di Code.gs. |
| "Supabase menolak SUPABASE_KEY di Code.gs" | `SUPABASE_KEY` di Apps Script bukan publishable key proyek yang sama dengan `CFG.key`. Perbaiki, lalu **New version**. |
| "Menu ini hanya untuk admin" | Akun yang dipakai bukan admin. Menu ini memang khusus admin. |
| "Aksi tidak dikenali: ..." | Deployment Apps Script masih versi lama: **Manage deployments > Edit > New version**. Atau `CFG.gas` menunjuk deployment lain. |
| "CFG.gas ... belum diisi" / gagal menghubungi Apps Script | Isi `CFG.gas`. Web App harus *Who has access: Anyone*, dan URL harus yang berakhiran `/exec`. |
| "DRIVE_MASTER_FOLDER_ID ... belum diisi" / arsip BAST gagal | Isi konstanta itu di Code.gs dan jalankan `authorizeAccess` untuk memastikan folder terbaca. |
| Unggah LPJ gagal setelah beberapa hari | Aplikasi Google masih *Testing* (token 7 hari). Publish app, jalankan ulang `bop.mjs drive`, perbarui secrets, deploy ulang. |
| `Server sedang menyimpan data lain` | Dua penyimpanan bersamaan di Spreadsheet; ulangi sebentar lagi. |
| Peta kosong / GPS ditolak | Buka lewat `https://` atau `localhost`, izinkan lokasi. Lapisan OpenStreetMap kadang kosong; pakai Satelit/Jalan. |
| Logo tidak muncul di PDF BAST | Letakkan `assets/logo-kemenag.png`. |
| Halaman lama tampil setelah pembaruan | `node bump-versi.mjs`, push, lalu muat ulang paksa (Ctrl+F5). |
| Semua menu gagal tiba-tiba | Proyek Supabase gratis dijeda setelah ±1 minggu tanpa aktivitas: buka dashboard dan *Restore project*. |

## 13. Cadangan dan pemulihan

- **Spreadsheet** (Sertifikat dan BAST NR): satu-satunya salinan datanya. Buat salinan berkala (*File > Make a copy*), dan manfaatkan *Version history*. Sheet `Pengaturan` memuat tanda tangan; jangan terhapus.
- **Supabase** (BOP, Jaspro, akun): paket gratis tidak punya cadangan otomatis. Ekspor berkala (dump dengan `pg_dump` lewat connection string di *Project Settings > Database*, atau ekspor tabel ke CSV).
- **Google Drive**: dokumen LPJ dan arsip BAST ada di folder master `BIMASATU` dan tidak terhapus saat data dihapus.
- **Pemulihan total**: ulangi bagian 2 sampai 8, lalu kembalikan data dari cadangan (bagian 10). Berkas `bop.sql`, `bop.mjs`, `apps-script/`, dan kode website ini adalah semua yang dibutuhkan untuk membangun ulang.
