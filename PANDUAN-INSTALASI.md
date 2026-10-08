# Panduan Instalasi Jalin (Bimas Islam Kabupaten Indramayu), dari awal

Panduan ini membawa Anda dari nol sampai aplikasi berjalan di GitHub Pages. **Ikuti urutannya, jangan melompat.**
`bop.sql` sudah diuji di PostgreSQL 16 (pemasangan baru, dijalankan dua kali, dan upgrade dari versi lama). Untuk gambaran teknis proyek, baca `skills/readme.md`.

> **Sudah menjalankan versi sebelumnya** (login dengan email, anggaran per KUA, SAKTI berversi, folder Drive lama)? Lompat ke **bagian 14** (urutan upgrade).

---

## 0. Gambaran sistem

| Bagian | Teknologi | Fungsi |
|---|---|---|
| Tampilan | `index.html` (satu file) di GitHub Pages | Login (username), menu BOP (Anggaran, RPD, Realisasi, Verifikasi, Pengaturan SAKTI, Realisasi SAKTI, Config, Impor Data Lama, Laporan), Jaspro Transport, BAST NR, Pengaturan |
| Database dan login | Supabase (PostgreSQL, Auth, RLS) | Data, hak akses admin/operator, semua aturan divalidasi di sisi server |
| Captcha login | Cloudflare Turnstile | Mencegah login otomatis |
| Dokumen LPJ, arsip BAST, reset password, impor LPJ lama | Edge Function `bop` (satu fungsi) | Unggah/hapus/pratinjau dokumen ke satu folder master Google Drive bernama **Jalin**; admin mereset password operator dan menyalin LPJ lama |

Prinsip keamanan: **kunci rahasia hanya ada di komputer Anda dan di Supabase Secrets.** Yang ada di GitHub hanyalah kunci publik
(URL Supabase, publishable key, Site Key Turnstile) dan nama domain email internal.

## 1. Persiapan

### 1.1 Akun (semua gratis)
GitHub, Supabase, Cloudflare, dan akun Google (pemilik folder LPJ di Drive).

### 1.2 Alat di komputer
- **Node.js 22** (minimal 20.6) dari nodejs.org. Cek: `node --version`.
- Git itu opsional: file bisa diunggah lewat web GitHub.

### 1.3 Isi paket
```
jalin/
├── index.html                    <- diunggah ke GitHub Pages
├── bop.sql                       <- SATU file SQL: seluruh skema database (juga dipakai untuk upgrade)
├── bop.mjs                       <- SATU skrip: buat akun, ubah ke username, siapkan Google Drive, impor BAST
├── supabase/functions/bop/index.ts   <- SATU Edge Function (dokumen + reset password + impor LPJ lama)
├── skills/readme.md              <- penjelasan proyek untuk AI/developer
├── PANDUAN-INSTALASI.md          <- file ini
└── .gitignore
```
(`migration-sakti.sql` dari versi sebelumnya sudah tidak dipakai dan boleh dihapus: seluruh pembaruan cukup lewat `bop.sql`.)

### 1.4 Rahasia yang TIDAK boleh masuk GitHub
`.env`, `akun.csv`, `username.csv`, Secret key/service_role Supabase, Google Client Secret, Refresh Token Google, Secret Key Turnstile.
`.gitignore` di paket ini sudah mencegah `.env` dan `akun.csv` ikut terunggah (tambahkan `username.csv`).

---

## 2. Buat project Supabase
1. Buka supabase.com, **New project**. Nama bebas (misal `jalin`), isi dan simpan *Database Password*, region terdekat (Southeast Asia/Singapore), plan **Free**.
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

`bop.sql` membuat semuanya: tabel `profiles`, `kua` (31), `pos` (11), `config`, `anggaran` (1 baris per tahun), `rpd`, `realisasi`, `metode_pembayaran`, `realisasi_sakti`, `jaspro_data`, `bast_pegawai`, `bast_ba`, `bast_setting`, fungsi, trigger validasi, dan RLS.
Aman dijalankan berulang kali (idempotent), dan jika database masih memakai struktur lama, datanya dikonversi otomatis lalu objek lama dihapus.

**Cek hasil** (jalankan di SQL Editor):
```sql
select (select count(*) from kua) as kua, (select count(*) from pos) as pos, (select count(*) from config) as config;
-- harapan: 31 | 11 | 5
select table_name from information_schema.tables where table_schema = 'public' order by 1;
-- harapan: anggaran, bast_ba, bast_pegawai, bast_setting, config, jaspro_data, kua, metode_pembayaran, pos, profiles, realisasi, realisasi_sakti, rpd
```

## 6. Buat akun (1 admin + 31 operator) dengan username
Login memakai **username**, bukan email. Operator: `kua_<nama kecamatan>` (huruf kecil, tanpa spasi), misal `kua_anjatan`, `kua_indramayu`, `kua_kedokanbunder`. Supabase tetap menyimpan akun sebagai email
`<username>@<EMAIL_DOMAIN>`, tetapi pengguna **tidak pernah mengetik domainnya**. Gunakan domain yang valid (mis. domain instansi). Tidak perlu kotak surat sungguhan karena aplikasi tidak mengirim email ke alamat itu; yang penting domainnya sama di `.env` dan `index.html`.

1. Buka terminal di folder `jalin`, jalankan sekali: `npm install @supabase/supabase-js`
2. Buat file **`.env`** di folder yang sama:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SERVICE_ROLE_KEY=<Secret key atau service_role dari langkah 2>
   EMAIL_DOMAIN=contoh.go.id
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<password admin, minimal 8 karakter>
   ```
   (`ADMIN_USERNAME` boleh dikosongkan: bawaannya `admin`. Bila admin ingin memakai email sendiri, isi `ADMIN_EMAIL=nama@kantor.go.id`; saat login ia mengetik email lengkap itu.)
3. Jalankan: `node --env-file=.env bop.mjs akun`
4. Hasilnya `akun.csv` berisi **username** dan password tiap akun (kolom: `username,password,nama,instansi,role`).
   **Simpan rapi, bagikan ke tiap operator, lalu hapus filenya. Jangan diunggah ke GitHub.**
5. Cek di Supabase, **Table Editor**, tabel `profiles`: harus ada 32 baris, dan kolom `kua_id` terisi untuk operator.

**Menambah akun belakangan:** Authentication, Users, *Add user* (centang auto-confirm) dengan email `<username>@<EMAIL_DOMAIN>`. Lalu atur profilnya di SQL Editor:
```sql
update public.profiles
   set nama = 'Operator KUA Contoh', kua = 'KUA Kec. Contoh', role = 'operator',
       kua_id = (select id from public.kua where nama_kua = 'KUA Kec. Contoh')
 where id = '<uuid-user-dari-halaman-Users>';
```

## 7. Google Drive untuk dokumen LPJ dan arsip
Semua file masuk ke **satu folder master bernama Jalin** milik akun Google yang Anda pilih. Strukturnya dibuat otomatis oleh Edge Function:
```
Jalin / BOP / LPJ / <tahun> / Kecamatan <nama> / <MM Bulan> - <nama file>      contoh: Jalin / BOP / LPJ / 2026 / Kecamatan Anjatan / 03 Maret - nota listrik.pdf
Jalin / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>
```
Aturannya: master (nama aplikasi) -> nama menu -> jenis dokumen -> tahun -> kecamatan. Bulan dibedakan oleh awalan nama file (`03 Maret - `), sehingga di Drive file otomatis terurut menurut bulan.

**7a. Google Cloud Console** (console.cloud.google.com):
1. Buat project baru, lalu aktifkan **Google Drive API** (APIs & Services, Library).
2. **OAuth consent screen / Google Auth Platform**: tipe *External* (atau *Internal* bila memakai Google Workspace). Isi nama aplikasi dan email. Pada *Data Access* tambahkan scope `https://www.googleapis.com/auth/drive.file`.
3. **Publish app** (status *In production*). Bila dibiarkan *Testing*, token kedaluwarsa dalam 7 hari. Scope `drive.file` tidak memerlukan verifikasi Google.
4. **Credentials**, *Create credentials*, *OAuth client ID*, jenis **Desktop app**. Salin **Client ID** dan **Client Secret**, tambahkan ke `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

**7b. Ambil izin akses dan buat folder master:**
```
node --env-file=.env bop.mjs drive
```
Buka URL yang tampil di browser, login dengan akun Google pemilik folder (kuota Drive akun ini yang terpakai), lalu izinkan.
(Jika muncul peringatan *Google hasn't verified this app*, pilih Advanced lalu *Go to ... (unsafe)*.)
Skrip membuat folder **Jalin** dan mencetak satu baris perintah `npx supabase secrets set ...`. **Simpan baris itu untuk langkah 8.**

Catatan:
- Ingin memakai folder buatan sendiri? Tambahkan `DRIVE_FOLDER_ID=<id folder>` di `.env` sebelum menjalankan perintah di atas (skrip memakai scope `drive`). Folder itu akan **dinamai ulang menjadi "Jalin"** otomatis oleh Edge Function saat pertama dipakai.
- Admin membuka dokumen lewat penampil di aplikasi (tidak perlu akses Drive). Untuk membuka foldernya langsung, gunakan akun Google pemilik folder, atau bagikan folder ke akun lain.
- Operator hanya bisa mengunggah PDF/JPG/PNG (batas ukuran dan jumlah file **per bulan** diatur di BOP, Config). File yang dihapus operator dipindahkan ke Sampah Google Drive.

## 8. Deploy Edge Function `bop`
Di terminal, folder `jalin`:
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
- Reset password operator tetap berfungsi walau langkah Google Drive belum dilakukan; hanya fitur dokumen yang butuh secret Google.

## 9. Isi konfigurasi `index.html`
Buka `index.html`, cari blok `CFG` di bagian script, lalu isi nilainya:
```js
const CFG = {
  nama: 'Jalin',                          // nama aplikasi (sama dengan APP_NAME di index.ts dan bop.mjs)
  url: 'https://<ref>.supabase.co',       // Project URL
  key: 'sb_publishable_...',              // Publishable key
  turnstile: '<Site Key Turnstile>',      // Site Key (bukan Secret Key)
  domain: 'contoh.go.id'                  // SAMA dengan EMAIL_DOMAIN di .env
};
```
`domain` penting: ia ditambahkan otomatis di belakang username saat login. Jika berbeda dengan `EMAIL_DOMAIN`, login selalu gagal.

## 10. Publikasi di GitHub Pages
1. Di github.com buat repository baru (misal `jalin`). GitHub Pages gratis memerlukan repository **publik**; `index.html` hanya berisi kunci publik sehingga aman.
2. Unggah `index.html` (Add file, Upload files, Commit). File lain tidak perlu dipublikasikan; simpan di komputer atau repository privat.
3. **Settings, Pages, Build and deployment**: Source **Deploy from a branch**, Branch **main**, folder **/ (root)**, Save.
4. Tunggu 1 sampai 2 menit. Alamatnya `https://<username>.github.io/<nama-repo>/`.
5. Pastikan `<username>.github.io` sudah ada di *Hostname* Turnstile (langkah 3), jika belum tambahkan.

## 11. Uji coba pertama (checklist)
1. Buka alamat GitHub Pages, login sebagai **admin** (ketik `admin`, bukan email) dan selesaikan captcha.
2. **BOP, Anggaran**: isi anggaran tahun berjalan untuk beberapa KUA (maksimal 10 digit per KUA), klik *Simpan Anggaran* (satu tombol untuk semua; di database seluruh anggaran satu tahun hanya 1 baris).
3. **BOP, Config**: periksa batas file, saklar RPD/Realisasi, dan **Bulan yang dibuka untuk edit RPD** (pilih lewat kotak pilihan, bisa mengetik untuk mencari).
4. **BOP, Pengaturan SAKTI**: **centang** KUA yang Listrik atau Telepon/Internet-nya dibayar lewat SAKTI (berlaku untuk semua bulan; yang tidak dicentang tetap manual). Lalu **BOP, Realisasi SAKTI**: pilih tahun dan bulan, isi **nominal** tiap KUA yang dicentang.
5. Logout, login sebagai **operator** (mis. `kua_anjatan`): **BOP, RPD**, Detail bulan, isi, simpan.
6. Operator **Realisasi** (boleh dikirim mulai tanggal 10 bulan berjalan; gunakan filter bulan bila perlu): isi nominal, unggah LPJ (PDF/JPG/PNG), kirim. POS yang dicentang SAKTI tampil terkunci dengan keterangan "Sudah dibayar SAKTI".
7. Admin: **Verifikasi**, filter kecamatan/tahun/bulan/status, Detail, lihat dokumen (penampil menampilkan "Halaman X dari N", zoom, putar), ubah status. Untuk **Dibayar**, isi **nominal yang dibayarkan**.
8. Coba **Laporan** (Excel dan PDF), lalu **Pengaturan**: Daftar akun (ada kolom Username), *Reset password* operator.
9. Admin: menu **Jaspro Transport**: unggah laporan nominatif (.xlsx), isi Master Rekening, *Cocokkan dan Pratinjau*, lalu unduh Excel/CSV. Hanya satu set data yang disimpan; unggahan baru menimpa yang lama.
10. Admin: grup menu **BAST NR**: Pegawai, Pengaturan BAST, Buat BA, lalu Riwayat (Detail, unggah arsip, PDF). Pratinjau arsip memakai penampil yang sama dengan menu BOP.

## 12. Pemeliharaan dan kuota gratis
- **Update tampilan:** ubah `index.html`, unggah ulang ke GitHub.
- **Update Edge Function:** ubah `bop/index.ts`, jalankan lagi `npx supabase functions deploy bop --no-verify-jwt`.
- **Update database:** jalankan ulang `bop.sql` yang terbaru (aman, tidak menghapus data aktif).
- **Project Free dijeda** Supabase bila tidak ada aktivitas sekitar 1 minggu: buka dashboard lalu *Restore project*.
- **Backup:** plan Free tidak menyediakan backup otomatis. Ekspor data penting berkala (Table Editor, Export CSV) atau unduh Laporan Excel.
- **Hemat kuota log dan storage:** aplikasi tidak menyimpan log aktivitas, tidak memakai cron, dan fungsi `bop` tidak menulis log. Anggaran hanya 1 baris per tahun; RPD dan Realisasi hanya 12 record per KUA per tahun.
  Log bawaan Supabase (permintaan API dan pemanggilan function) tetap ada. Hindari membuka halaman *Logs* di dashboard berulang-ulang.

## 13. Pemecahan masalah
| Gejala | Penyebab | Solusi |
|---|---|---|
| "Login gagal: username atau password salah, atau captcha tidak valid" | Username/password salah; `CFG.domain` tidak sama dengan `EMAIL_DOMAIN`; hostname belum ada di Turnstile / Secret Key salah di Supabase | Periksa `CFG.domain` (langkah 9), lalu langkah 3 dan 4. Akun lama yang masih berpola `kua.<nama>@...` dapat diubah dengan `bop.mjs username` (bagian 14) |
| "Profil akun tidak ditemukan" | Profil belum terisi | Jalankan `bop.sql` lagi (otomatis membuat profil yang hilang) atau SQL pada langkah 6 |
| "Anggaran Tahunan ... belum ditetapkan" | Admin belum mengisi anggaran KUA itu | BOP, Anggaran |
| "Anggaran ... lebih kecil dari total RPD yang sudah diisi" | Anggaran diturunkan di bawah RPD | Kurangi RPD KUA itu lebih dulu |
| "... maksimal 10 digit (Rp 9.999.999.999)" | Nominal lebih dari 10 digit | Isian dibatasi 10 digit; periksa angkanya |
| "Realisasi ... baru dapat disubmit mulai tanggal 10" | Aturan: boleh dikirim mulai tanggal 10 bulan tersebut | Tunggu tanggalnya |
| "Hanya Realisasi yang ditolak yang dapat diperbaiki" | Status sudah Menunggu/Disetujui/Dibayar | Admin mengubah status ke Ditolak bila perlu perbaikan |
| "Nominal yang dibayarkan wajib diisi untuk status Dibayar" / "... melebihi total Realisasi" | Status Dibayar tanpa nominal, atau nominal > total Realisasi | Isi nominal (1 sampai total Realisasi) pada Verifikasi |
| "Tidak dapat menghubungi server ... Edge Function bop" | Function belum di-deploy | Langkah 8 |
| "Gagal terhubung ke Google Drive" atau `invalid_grant` | Refresh token kedaluwarsa (app masih Testing) atau secret salah | *Publish app*, ulangi langkah 7b dan 8 |
| "Gagal membuat folder ... DRIVE_ROOT_FOLDER_ID" | Folder bukan buatan `bop.mjs drive` (scope `drive.file`) atau ID salah | Pakai folder dari skrip, atau lihat catatan folder sendiri di langkah 7 |
| "isi file tidak sesuai ekstensinya" | File bukan PDF/JPG/PNG asli | Unggah file yang benar |
| "Maksimal N file per bulan" | Batas jumlah file dihitung **per bulan** | Naikkan di BOP, Config atau hapus file lama |
| "new row violates row-level security policy" pada RPD | Bulan ditutup di Config / data KUA lain | Admin membuka bulan di BOP, Config |
| SQL error saat menjalankan `bop.sql` | Salinan tidak lengkap | Salin ulang seluruh isi file, jalankan lagi |
| `bop.sql` berhenti: "Dibatalkan sebelum mengubah apa pun: ada N baris Realisasi SAKTI untuk Air" | Ada nominal SAKTI Air, padahal SAKTI hanya Listrik dan Telepon/Internet | Pindahkan nilainya ke Realisasi manual, jalankan `delete` yang tercetak di pesan, lalu jalankan `bop.sql` lagi (belum ada yang berubah) |
| Browser: *blocked by CORS policy ... Response to preflight request doesn't pass access control check: It does not have HTTP ok status* (menu Realisasi, dokumen LPJ) | Fungsi `bop` belum di-deploy, atau di-deploy dengan *Verify JWT* menyala sehingga platform menolak preflight sebelum kode berjalan | Deploy ulang `npx supabase functions deploy bop --no-verify-jwt` (lihat langkah 8 untuk uji `curl`) |
| "POS ... dibayar lewat SAKTI. Realisasinya diinput oleh Admin" / "Realisasi SAKTI hanya dapat diinput oleh Admin" | Operator mengisi POS yang dicentang SAKTI | Wajar: minta admin menginput di BOP, Realisasi SAKTI |
| "... belum dicentang SAKTI di Pengaturan SAKTI" | Admin menginput Realisasi SAKTI untuk POS yang belum dicentang | Centang dulu di BOP, Pengaturan SAKTI |
| "... sudah punya Realisasi manual pada ... Realisasi SAKTI tidak dapat diinput untuk bulan yang sudah diisi manual" | Bulan itu sudah diisi manual oleh operator untuk POS yang sama | Satu bulan hanya satu sumber per POS: pakai bulan lain, atau minta admin menolak dan operator mengosongkan POS itu |
| "... sudah punya Realisasi SAKTI ..., jadi belum bisa dikembalikan ke MANUAL" | Mencabut centang padahal masih ada nominal SAKTI | Kosongkan dulu nominalnya di Realisasi SAKTI, lalu cabut centang |
| Impor: "File lama tidak dapat diunduh" | Berbagi "Siapa saja yang memiliki link" di Drive lama sudah dicabut, atau file dihapus | Aktifkan kembali berbagi lalu jalankan impor lagi (yang sudah tersalin tidak digandakan) |
| Impor: "Balasan Apps Script lama bukan JSON" | Alamat Web App salah atau aksesnya bukan "Siapa saja" | Gunakan alamat `/exec` dari deployment yang aksesnya *Anyone* |
| "Could not find the function public.anggaran_tahun ... in the schema cache" (atau `set_anggaran`, `akun_daftar`, `impor_baris`) | Cache skema API belum memuat fungsi baru setelah `bop.sql` | SQL Editor: `select pg_notify('pgrst', 'reload schema');` lalu muat ulang halaman |
| `Cannot set properties of null` di konsol browser | Pindah menu saat data masih dimuat (versi lama) | Pakai `index.html` terbaru (hasil await dari halaman lama kini diabaikan) |

## 14. Upgrade dari versi sebelumnya (urutannya penting)
Untuk database dan penginstalan yang **sudah berjalan** dengan versi sebelumnya (login dengan email, anggaran per KUA, SAKTI berversi per bulan, folder Drive `BOP KUA - LPJ`).
Perubahan di versi ini: nama aplikasi **Jalin**; login dengan **username**; anggaran **1 baris per tahun**; nominal **maksimal 10 digit**; SAKTI **hanya Listrik dan Telepon/Internet**, **ceklis global**, Realisasi SAKTI **hanya nominal**;
Dibayar **wajib mencatat nominal**; penampil dokumen yang sama di semua menu dengan **penunjuk halaman**; struktur **Drive baru**; menu **Impor Data Lama**.

1. **Cadangkan** dulu: BOP, Laporan (Excel) atau ekspor tabel penting dari Table Editor.
2. **Database**: SQL Editor, jalankan `bop.sql` yang baru. Aman diulang. Yang terjadi otomatis:
   - `anggaran` per KUA menjadi 1 baris per tahun (datanya dipindah, tabel lama dihapus setelah dipastikan sama);
   - pengaturan SAKTI berversi menjadi ceklis global (dipakai versi yang berlaku **saat ini**; versi yang mulai berlakunya di masa depan dibuang); Air dikeluarkan dari SAKTI;
   - Realisasi SAKTI kehilangan kolom status/tanggal/sumber/catatan (baris "Belum dibayar" Rp 0 dibuang, nominal yang ada tetap); kolom `nominal_dibayar` ditambahkan ke `realisasi` (Realisasi berstatus Dibayar lama tampil "nominal belum dicatat" sampai diisi);
   - sisa AutoPayment lama (fungsi, penanda migrasi, kunci `wajib_lpj`) dihapus; tabel arsip `autopayment_pos` ikut dihapus bila migrasi ke SAKTI pernah berjalan (atau tabelnya tanpa nominal), bila tidak ia dibiarkan dan muncul pesan.
   Bila berhenti dengan pesan "Dibatalkan sebelum mengubah apa pun ... Air", ikuti petunjuk di pesan itu (lihat tabel bagian 13).
3. **Edge Function**: `npx supabase functions deploy bop --no-verify-jwt` (struktur folder Drive baru dan aksi `impor-lpj`). Secret Google yang lama dipakai ulang.
4. **index.html**: ubah blok `CFG` (`nama` dan `domain`). **`domain` harus sama dengan domain email akun Anda yang sekarang** (bagian setelah `@` pada email operator lama), lalu unggah ke GitHub.
5. **Akun**: tambahkan `EMAIL_DOMAIN` (domain yang sama dengan langkah 4) di `.env`, lalu jalankan `node --env-file=.env bop.mjs username`. Skrip mengubah `kua.<nama>@domain` menjadi `kua_<nama>@domain` untuk semua operator. **Password tidak berubah**;
   hasil `username.csv` (tanpa password) dibagikan ke operator. Untuk admin, isi `ADMIN_USERNAME=admin` bila ingin akun admin ikut diubah menjadi `admin@<EMAIL_DOMAIN>`; tanpa itu admin tetap login dengan email lengkap lamanya (tetap diterima).
6. **Google Drive**: folder master `BOP KUA - LPJ` otomatis dinamai ulang menjadi **Jalin** saat pertama dipakai. Folder lama di dalamnya (`<tahun>/<nama KUA>/Realisasi/<MM Bulan>`) **tidak dibaca lagi**: hapus saja di Drive.
   Dokumen LPJ yang sudah ada di struktur lama tidak tampil lagi di aplikasi (data Realisasi tetap ada). Salin ulang dari sistem lama lewat menu **Impor Data Lama** (bagian 17) bila dibutuhkan.
7. Cek cepat: login dengan username baru; BOP, Anggaran memuat angka tahun berjalan; Pengaturan SAKTI hanya 2 kolom; Realisasi SAKTI hanya kolom nominal.

## 15. Ringkasan aturan aplikasi
Aturan lengkap beserta tempat penegakannya ada di `skills/readme.md` (bagian 5). Intinya:
- **Admin** melihat semua KUA; **operator** hanya KUA-nya (dijaga RLS dan trigger, bukan hanya tampilan).
- **Anggaran** = 1 baris per tahun. **RPD dan Realisasi** = 1 record per KUA per bulan, rincian POS berupa JSON. Kode akun POS selalu tampil. Semua nominal **maksimal 10 digit**.
- Total RPD setahun <= Anggaran. Realisasi: mulai tanggal 10, LPJ wajib, total sebulan <= RPD bulan itu, tiap POS setahun <= RPD POS itu.
- Operator hanya bisa membuat atau memperbaiki Realisasi yang **Ditolak**; setelah dikirim, nominal dan LPJ terkunci. Admin mengubah **status** kapan saja (bukan nominal/LPJ); status **Dibayar** wajib disertai nominal yang dibayarkan.
- **Pembayaran SAKTI**: hanya Listrik dan Telepon/Internet. Admin mencentang KUA yang dibayar lewat SAKTI (**global**, tanpa bulan/tahun). POS yang dicentang tidak diisi operator; admin menginput **nominal** per bulan di Realisasi SAKTI
  (ikut batas RPD, validasi, dan laporan). Satu bulan hanya satu sumber per POS. Anggaran, pengaturan, dan Realisasi SAKTI tidak bisa dihapus; koreksi dengan mengosongkan nominal.

## 16. Memindahkan BAST NR dari Apps Script
1. SQL Editor: jalankan `bop.sql` terbaru (menambah tabel `bast_*`, aman diulang).
2. Deploy ulang fungsi (ada aksi arsip): `npx supabase functions deploy bop --no-verify-jwt`.
3. Tambahkan ke `.env`: `BAST_WEB_APP_URL=<URL Web App BAST NR lama, berakhiran /exec>`, lalu jalankan `node --env-file=.env bop.mjs bast`. Baca daftar PERINGATAN yang tercetak (baris yang dilewati).
4. Unggah `index.html` **dan `logo-data.js`** ke GitHub (logo kop PDF dimuat dari file ini).
5. Cek di menu BAST NR: jumlah Berita Acara dan Pegawai sama dengan sistem lama, buka satu Detail, unduh PDF-nya.

## 17. Impor Data Lama BOP (dari Spreadsheet/Apps Script ke Jalin)
Menu **BOP, Impor Data Lama** (khusus admin) mengambil data dari Web App Apps Script sistem BOP lama, menuliskannya ke Jalin, dan **menyalin berkas LPJ** ke `Jalin / BOP / LPJ / <tahun> / Kecamatan <nama>`.

**Prasyarat**
- Web App lama masih aktif dengan akses *Anyone* (sama seperti saat dipakai aplikasi lama). Alamatnya = `SCRIPT_URL` di `config.js` lama (berakhiran `/exec`).
- Berkas LPJ lama dibagikan "siapa saja yang memiliki link" (bawaan sistem lama). Edge Function sudah di-deploy (bagian 8) dan akses Google Drive sudah diatur (bagian 7).

**Langkah**
1. Buka menu, tempel alamat Web App (diingat di browser ini), pilih **Tahun** (atau Semua tahun), pilih **Data yang sudah ada**: *Lewati (aman)* tidak menyentuh data yang sudah ada di Jalin; *Timpa* menimpanya.
2. Centang yang dibawa: Anggaran, RPD, Realisasi + berkas LPJ, SAKTI (ceklis + nominal). Klik **Ambil data & pratinjau**: tampil jumlah per jenis, jumlah berkas, dan **peringatan** (KUA/POS tidak dikenali, data ganda, dll.). Belum ada yang ditulis.
3. Klik **Impor sekarang**. Urutan: Anggaran, ceklis SAKTI, RPD, Realisasi (berkas disalin satu per satu, ±3 detik per berkas, **biarkan tab terbuka**), Realisasi SAKTI. Tombol **Hentikan** berhenti dengan rapi; jalankan lagi untuk melanjutkan.
4. Baca tabel hasil. Baris atau berkas yang gagal dicantumkan beserta alasannya (misal RPD melebihi anggaran, berkas tidak dapat diunduh). Perbaiki penyebabnya, lalu jalankan lagi: yang sudah masuk tidak digandakan.

**Yang dibawa:** anggaran per KUA per tahun; RPD per KUA per bulan (rincian per POS); Realisasi per KUA per bulan (rincian per POS, status, catatan admin, waktu diajukan/diverifikasi, dan berkas LPJ); ceklis dan nominal Auto Payment (menjadi Pengaturan dan Realisasi SAKTI).
**Yang tidak dibawa** karena tidak dipakai Jalin: akun dan password pengguna (buat lewat `bop.mjs akun`), kuota API, konfigurasi lama, riwayat/log, ID dan Total (dihitung ulang), nama pengunggah/verifikator, metadata file, nilai Rp 0 dan baris kosong, KUA/POS yang tidak dikenali, dan nominal Auto Payment untuk KUA/POS yang tidak dicentang.
**Catatan Auto Payment:** pada sistem lama, nilai POS Listrik/Telepon untuk KUA yang dicentang Auto Payment diambil dari nominal Auto Payment, bukan dari isian Realisasi. Jalin meniru itu: nilai POS tersebut di Realisasi **tidak dibawa** dan digantikan Realisasi SAKTI, sehingga total tidak terhitung dua kali.
**Realisasi yang sudah dibuat operator di Jalin** (mode Lewati) tidak disentuh dan berkas lamanya tidak disalin ke bulan itu.