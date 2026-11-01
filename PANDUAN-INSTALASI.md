# Panduan Instalasi BIMASATU (dari nol)

Panduan ini membangun **seluruh sistem dari awal**, dengan anggapan semua yang tersimpan di Supabase, Apps Script/Spreadsheet, dan Google Drive sudah hilang atau belum pernah ada.
Ikuti berurutan: bagian 2 sampai 9. Waktu sekitar 1 sampai 2 jam. Nama menu di dashboard Supabase, Google, dan Cloudflare dapat sedikit berbeda dari yang tertulis; yang penting nilai yang diisi sama.

## 1. Gambaran dan prasyarat

| Bagian | Dipakai untuk | Tempat |
|---|---|---|
| Website (HTML/JS) | Tampilan semua menu | GitHub Pages |
| Supabase | Login, peran dan hak akses menu, BOP, Jaspro Transport | supabase.com (gratis) |
| Edge Function `bop` | Akun (buat, ubah, reset password), unggah/baca dokumen LPJ, arsip BAST NR | Supabase |
| Apps Script + Spreadsheet | Data Sertifikat Masjid/Musala, Arah Kiblat, dan BAST NR | akun Google |
| Google Drive | Dokumen LPJ (BOP) dan arsip BAST NR, **satu folder master** | akun Google yang menjalankan `bop.mjs drive` |
| Cloudflare Turnstile | Captcha di halaman login | cloudflare.com (gratis) |

Yang perlu disiapkan:
- Satu **akun Google** yang akan memiliki folder Drive, Spreadsheet, dan Apps Script. Disarankan akun yang sama untuk ketiganya (bagian 5 dan 7). Semua berkas yang ditulis aplikasi ke Drive (LPJ dan arsip BAST NR) lewat Edge Function ke satu folder master; Apps Script tidak lagi menulis ke Drive.
- Akun **Supabase**, **Cloudflare**, dan **GitHub**.
- Komputer dengan **Node.js 22 atau lebih baru** dan Git.

### Urutan pemasangan (ringkas): SQL, lalu MJS, lalu TS, lalu GS, lalu website

| Urut | Berkas | Dijalankan di | Menghasilkan | Dibutuhkan oleh |
|---|---|---|---|---|
| 1 | `bop.sql` | Supabase > SQL Editor | tabel, aturan (trigger), peran dan hak akses menu (bawaan), data awal | langkah 3: `bop.mjs akun` butuh tabel `profiles` dan trigger-nya |
| 2 | (pengaturan dashboard) | Supabase dan Cloudflare | pendaftaran mandiri mati, captcha Turnstile | keamanan dan login |
| 3 | `bop.mjs akun` | terminal | 1 admin + 31 Operator KUA (`akun.csv`); akun peran lain dibuat di aplikasi | login pertama |
| 4 | `bop.mjs drive` | terminal | folder master Drive, `DRIVE_ROOT_FOLDER_ID`, token Google | langkah 5 (rahasia Edge Function) |
| 5 | `supabase/functions/bop/index.ts` | terminal (`supabase functions deploy`) | Edge Function: akun, LPJ, dan arsip BAST NR di Drive | menu BOP (LPJ), Daftar akun, arsip BAST NR |
| 6 | `apps-script/*.gs` + `appsscript.json` | editor Apps Script | URL Web App | `CFG.gas` di `js/config.js` |
| 7 | `js/config.js`, lalu push ke GitHub | GitHub Pages | situs hidup | pengguna |

Urutan ini tidak boleh dibalik: `bop.mjs akun` sebelum `bop.sql` gagal (tabel belum ada); Edge Function sebelum `bop.mjs drive` tidak punya rahasia Google; website paling akhir karena butuh URL Web App. Apps Script tidak lagi memerlukan id folder Drive, jadi langkah 6 tidak bergantung pada langkah 4. Bagian 2 sampai 8 di bawah mengikuti urutan yang sama.

Isi folder proyek ini (lihat `README.md` bagian 2 untuk penjelasan tiap berkas): `index.html`, `css/`, `js/`, `views/`, `bop.sql`, `bop.mjs`, `supabase/functions/bop/`, `apps-script/`, `assets/`.

## 2. Supabase: proyek dan database

1. supabase.com > **New project**. Pilih region terdekat (Singapore), buat password database dan **simpan**. Tunggu proyek selesai dibuat.
2. **Project Settings > API (atau API Keys)**. Catat:
   - **Project URL** (`https://xxxx.supabase.co`) dan **Project ref** (bagian `xxxx`).
   - **Publishable key** (`sb_publishable_...`): aman dipasang di website.
   - **Secret key** (`sb_secret_...`, atau `service_role` pada tampilan lama): **RAHASIA**, hanya untuk `.env` di komputer Anda.
3. **SQL Editor > New query**: tempel **seluruh isi `bop.sql`** > **Run**. Hasil `Success`. Aman dijalankan ulang kapan pun. Ini membuat tabel, aturan (trigger), hak akses (RLS), tujuh peran, hak akses menu bawaan tiap peran, dan data awal (31 KUA, 11 POS, pengaturan bawaan). Hak akses menu bawaan hanya diisi **sekali**: menjalankan ulang `bop.sql` tidak mengembalikan menu yang sudah Anda cabut di halaman Hak Akses Menu.
4. **Authentication > Sign In / Providers** (di tampilan lama: *Settings*): matikan **Allow new users to sign up**. **Wajib.** Semua akun dibuat oleh admin (lewat `bop.mjs` atau menu Pengaturan di aplikasi). Bila pendaftaran dibiarkan terbuka, siapa pun yang tahu URL dan publishable key bisa mendaftar dengan peran apa pun (termasuk `role=admin`) di metadata dan otomatis memilikinya.
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
   - Berkas harus bernama persis `.env` dan berada di folder yang sama dengan `bop.mjs`; `bop.mjs` membacanya otomatis (tidak perlu `--env-file`). Format tiap baris `NAMA=nilai`, tanpa spasi di sekitar `=`.
3. `node bop.mjs akun` membuat 1 admin + 31 Operator KUA. Hasilnya **`akun.csv`** berisi username dan password awal. Username operator berpola `kua_<kecamatan>` (mis. `kua_anjatan`, `kua_kedokanbunder`). Bagikan password ke tiap KUA, lalu **hapus `akun.csv`** dari komputer (jangan diunggah). Setiap akun dapat mengganti passwordnya sendiri di menu Pengaturan; admin dapat mereset password akun peran **mana pun**.
   - **PERINGATAN: jangan pernah mengunggah `akun.csv` ke GitHub.** `.gitignore` sudah memuat `*.csv`, tetapi aturan itu **tidak berlaku untuk berkas yang sudah pernah di-commit**. Buka halaman repositori Anda dan periksa apakah `akun.csv` ada di daftar berkas. Bila ada dan repositori Anda publik, anggap semua password awal (admin dan 31 Operator KUA) **sudah bocor**:
     1. **Ganti password semua akun** (inilah langkah yang menentukan): login admin > **Pengaturan > Daftar akun** > **Reset password** untuk admin dan setiap Operator KUA, dengan password baru yang berbeda-beda, lalu bagikan lewat jalur tertutup.
     2. **Hapus berkas dari repositori** (berkas di komputer Anda tetap ada): `git rm --cached akun.csv`, lalu `git commit -m "hapus akun.csv"` dan `git push`. Setelah itu `.gitignore` mencegahnya ter-commit lagi.
     3. Riwayat commit lama masih menyimpan isi berkas itu. Karena passwordnya sudah diganti (langkah 1), isinya tidak lagi berguna. Bila ingin riwayatnya ikut bersih: `git filter-repo --path akun.csv --invert-paths`, lalu `git push --force` (semua yang pernah mengunduh repositori harus mengunduh ulang).
4. Akun peran lain (**Bendahara BOP, Verifikator BOP, BAST NR, Kemasjidan, PNBP NR**) dibuat admin di aplikasi, bukan lewat `bop.mjs`: login sebagai admin > **Pengaturan > Daftar akun > Tambah akun** (username, nama, peran, password; untuk Operator KUA pilih KUA-nya). Menu yang dapat dibuka tiap peran diatur di menu **Hak Akses Menu** (lihat bagian 9).

## 5. Google Drive (dokumen LPJ dan arsip BAST NR)

Gunakan akun Google yang akan menjadi **pemilik folder arsip**; disarankan akun yang sama dengan pemilik Spreadsheet dan Apps Script (bagian 7).

1. console.cloud.google.com > buat **project** baru > **APIs & Services > Library** > aktifkan **Google Drive API**.
2. **OAuth consent screen**: tipe External, isi nama aplikasi dan email. Tambahkan scope `.../auth/drive.file`. Lalu klik **Publish app** (status *In production*). Bila dibiarkan *Testing*, token Google kedaluwarsa tiap 7 hari dan unggah LPJ berhenti.
3. **Credentials > Create credentials > OAuth client ID**, jenis **Desktop app**. Salin **Client ID** dan **Client secret** ke `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
4. `node bop.mjs drive`. Buka URL yang dicetak, izinkan akses dengan akun Google tadi. Skrip membuat folder master bernama **BIMASATU** di Drive Anda dan mencetak satu baris perintah `npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... DRIVE_ROOT_FOLDER_ID=...`.
   Folder master ini menampung **semua arsip dalam satu folder**: `BIMASATU / BOP / LPJ / <tahun> / Kecamatan <nama>` untuk LPJ BOP dan `BIMASATU / BAST NR / <tahun> / <MM Bulan>` untuk arsip BAST NR (folder dibuat otomatis saat dipakai). Nilai `DRIVE_ROOT_FOLDER_ID` cukup dipasang sebagai rahasia Edge Function (bagian 6); **tidak** perlu dimasukkan ke Apps Script.

## 6. Edge Function `bop`

```
npx supabase login
npx supabase link --project-ref <PROJECT-REF>
<tempel baris "npx supabase secrets set ..." dari bagian 5>
npx supabase functions deploy bop --no-verify-jwt
```
Seluruh kode server Supabase ada di **satu berkas**, `supabase/functions/bop/index.ts` (aksi akun: `reset-password`, `buat-akun`, `ubah-akun`; LPJ BOP: `upload`, `delete`, `list`, `file`, `impor-lpj`; arsip BAST NR: `bast-upload`, `bast-salin`, `bast-file`, `bast-hapus`); hanya satu fungsi bernama `bop` yang perlu dideploy.
Bila di proyek Supabase Anda masih ada fungsi lama bernama `upload-lpj`, `lpj`, atau `reset-password` (dari versi awal), semuanya sudah tergantikan dan boleh dihapus: `npx supabase functions delete <nama>`.
`--no-verify-jwt` aman: fungsi memeriksa token login dan peran sendiri. Bila CLI meminta `config.toml`, jalankan `npx supabase init` sekali (jawab tidak untuk pertanyaan tambahan), lalu ulangi.

## 7. Apps Script dan Spreadsheet (Sertifikat dan BAST NR)

Dengan **akun Google yang sama** seperti bagian 5.

1. sheets.google.com > **Spreadsheet baru** (mis. "BIMASATU Data"). Sheet apa pun yang ada boleh dibiarkan.
2. **Extensions > Apps Script**. Beri nama proyek, mis. "BIMASATU API".
3. Buat lima berkas skrip (**+ > Script**; nama persis, tanpa `.gs`) dan tempel isi dari folder `apps-script/`: **Code**, **Masjid**, **Kiblat**, **Pengaturan**, **Bast**. Kosongkan berkas `Code` bawaan lalu isi dengan `Code.gs` dari folder ini.
4. **Project Settings** (ikon roda gigi) > centang **Show "appsscript.json" manifest file in editor**. Buka `appsscript.json` dan ganti seluruh isinya dengan `apps-script/appsscript.json`. Berkas ini memuat tiga izin: `spreadsheets`, `script.external_request` (Supabase), dan `drive`. Izin `drive` hanya dipakai untuk **membaca arsip BAST NR lama** yang dulu diunggah akun ini (selama belum dipindah ke folder master); tanpa izin itu Drive menjawab HTTP 403.
5. Di bagian paling atas **Code.gs** isi dua konstanta:
   - `SUPABASE_URL`: Project URL (bagian 2).
   - `SUPABASE_KEY`: **Publishable key** (bukan secret key).
   (Tidak ada lagi `DRIVE_MASTER_FOLDER_ID`: arsip baru ditulis Edge Function ke folder master.)
6. Pilih fungsi **`setupDatabase`** > **Run**. Setujui izin (bila muncul "Google hasn't verified this app": *Advanced > Go to ... (unsafe)*; ini skrip milik Anda sendiri). Hasilnya enam sheet: `DataMasjid`, `DataKiblat`, `Pengaturan`, `BastPegawai`, `BastBA`, `BastSetting`.
7. Pilih fungsi **`authorizeAccess`** > **Run**, lalu buka **Execution log**. Harus tampil: `Supabase Auth: HTTP 200`, akun Drive yang dipakai Apps Script (email Anda), dan daftar izin pada token yang memuat `https://www.googleapis.com/auth/drive`. Bila daftar izin tidak memuat `drive`, isi `appsscript.json` belum terpasang (langkah 4).
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
2. Tambahkan **`assets/b-logo.png`**: logo dan ikon website (ikon tab peramban, ikon layar utama iOS, logo di halaman masuk dan sidebar). Cukup **satu berkas**; ukuran tampil diatur otomatis oleh aplikasi (tinggi 48 px di halaman masuk, 36 px di sidebar), jadi tidak perlu membuat beberapa ukuran. Saran: PNG persegi 512 x 512 piksel, latar transparan, di bawah sekitar 100 KB (lihat `assets/README.md`). Tanpa berkas ini aplikasi tetap berjalan dengan ikon tautan bawaan.
3. (Opsional) letakkan `assets/logo-kemenag.png` agar PDF BAST NR memuat logo.
4. Unggah semua berkas ke repositori GitHub (kecuali yang ada di `.gitignore`). **Settings > Pages** > *Deploy from a branch* > `main` / `(root)`. Alamat situs: `https://<akun>.github.io/<repositori>/`.
5. Uji di komputer sendiri (bila perlu) lewat server statis, bukan dobel klik: `npx serve .` lalu buka alamat `localhost` yang tampil. Peta dan GPS membutuhkan `https://` atau `localhost`.

Bila `js/config.js` masih berisi nilai contoh, halaman menampilkan pita merah "js/config.js belum lengkap" yang menyebut bagian mana yang kurang.

## 9. Uji dan isi data awal

Login sebagai admin (username dan password dari `akun.csv`), lalu:

1. **Sertifikat > Masjid / Musala**: daftar harus termuat tanpa galat (ini sekaligus menguji sambungan ke Apps Script dan Spreadsheet). Bila gagal, lihat bagian 12. Cara cepat lain: buka URL Web App (`CFG.gas`) di tab baru; harus tampil JSON `{"status":"ok", ...}`.
2. **BOP**: menu *Config* (buka/tutup RPD dan Realisasi, batas ukuran/jumlah file), lalu **Anggaran** tahun berjalan per KUA. Operator baru bisa menyusun RPD setelah anggaran ada.
3. **BAST NR**: *Pengaturan BAST* (nama dan NIP Kepala Seksi, nomor awal surat, kode kantor, kode klasifikasi, alamat), lalu *Pegawai* (pegawai Bimas Islam dan pegawai tiap KUA). Buat satu BA uji, unggah satu arsip, dan buka pratinjaunya. Di Google Drive, arsip itu harus berada di `BIMASATU / BAST NR / <tahun> / <MM Bulan>`, satu folder induk dengan `BOP / LPJ`.
4. **Sertifikat > Pengaturan Sertifikat**: nama dan NIP Kepala Kantor, Kepala Seksi Bimas Islam, Petugas Ukur, dan tanda tangan (PNG/JPEG). Lalu tambah satu masjid dan cetak Piagam; tambah satu pengukuran Arah Kiblat dan cetak dokumennya.
5. **Hak Akses Menu** (menu khusus admin): periksa centang bawaan tiap peran dan sesuaikan dengan struktur kantor Anda, lalu **Simpan**. Bawaan: Operator KUA = BOP, RPD, Realisasi, Laporan; Bendahara BOP = BOP, RPD (hanya melihat), Verifikasi, Realisasi SAKTI, Laporan; Verifikator BOP = BOP, RPD (hanya melihat), Verifikasi, Laporan; BAST NR = semua menu BAST NR; Kemasjidan = semua menu Sertifikat; PNBP NR = Jaspro Transport. Menu Hak Akses Menu dan Impor Data Lama tidak dapat diberikan ke peran lain; Realisasi (mengisi) hanya untuk Operator KUA.
6. **Akun peran lain**: di **Pengaturan > Daftar akun > Tambah akun**, buat satu akun untuk tiap peran yang dipakai, lalu login dengan masing-masing dan pastikan hanya menu yang diberikan yang tampil. Bila password terlupa, admin memakai tombol **Reset password** di baris akun itu.
7. Keluar, login sebagai satu operator (mis. `kua_anjatan`): hanya menu BOP KUA itu yang tampil; menu BAST NR dan Sertifikat tidak bisa dibuka (alamat langsung ke menu itu dialihkan ke halaman awal, dan server tetap menolak).
8. **Jaspro Transport** (admin atau PNBP NR), langkah 3 *Proses dan Unduh*: isi **tarif dasar** Jasa Profesi dan Transport, lalu **Tambah perubahan tarif** bila tarif berganti pada tanggal tertentu (tanggal mulai + nominal baru). Perubahan berlaku mulai tanggal itu (tanggal itu sendiri sudah memakai tarif baru); Jasa Profesi dan Transport boleh berubah sendiri-sendiri (kosongkan yang tidak berubah), boleh berkali-kali dengan nominal berbeda. File laporan (.xlsx) boleh memuat kolom **Tanggal** (tanggal peristiwa): tiap baris memakai tarif pada tanggalnya; baris tanpa tanggal memakai **tanggal acuan** (bawaan: hari terakhir bulan laporan). Tarif per baris tampil di tinjauan, dan Excel memberi catatan bila tarif berubah di tengah bulan.
9. **Realisasi SAKTI**: pembayaran SAKTI sudah terjadi, jadi nominal yang melebihi RPD tetap tersimpan (baris ditandai kuning dan muncul peringatan). Operator KUA terkait tidak dapat mengirim Realisasi sampai RPD-nya disesuaikan (tombol Kirim nonaktif dan kelebihannya ditampilkan).

## 10. Memasukkan data lama (opsional)

- **BOP**: menu **Impor Data Lama** (anggaran, RPD, Realisasi, dan berkas LPJ) dari sistem Apps Script/Spreadsheet lama; aman diulang.
- **BAST NR dan Sertifikat**: bila Anda masih punya cadangan Spreadsheet, tempel barisnya ke sheet yang sama (judul kolom harus sama persis dengan yang dibuat `setupDatabase`). Untuk `BastBA`, kolom `Id` harus angka unik; kolom NIP dan tanggal tetap berformat teks.
- **Arsip BAST NR lama** (diunggah versi sebelumnya ke folder Drive lain): buka **BAST NR > Pengaturan BAST > Arsip di folder master**. Kartu itu menghitung arsip yang belum di folder master dan memindahkannya satu per satu: berurutan, aman diulang (yang sudah dipindah tidak digandakan), dan tab harus tetap terbuka (±6 detik per arsip). Pilihan **Buang file lama ke Sampah Google Drive** bersifat opsional; bawaannya file lama dibiarkan. Arsip yang hanya punya tautan disalin dari tautan publiknya ("siapa saja yang memiliki link", maks. 20 MB); yang tidak dapat diunduh dilaporkan dan perlu diunggah ulang dari Riwayat BAST. Satu arsip juga dapat dipindahkan dari Detail di Riwayat. Hasilnya: `BIMASATU / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nomor>-<tahun>.<ekstensi>`.

## 11. Pembaruan rutin

| Yang berubah | Langkah |
|---|---|
| Berkas website (`index.html`, `js/`, `views/`, `css/`) | Ganti berkasnya, **`node bump-versi.mjs`**, commit dan push. Jangan menimpa `js/config.js` Anda. |
| Logo dan ikon (`assets/b-logo.png`) | Ganti berkasnya, **`node bump-versi.mjs`**, commit dan push. Ikon tab paling lambat berganti: tutup lalu buka lagi tabnya. |
| Apps Script | Tempel kode baru, **Manage deployments > Edit > New version**. |
| Edge Function | `npx supabase functions deploy bop --no-verify-jwt` |
| Database | Jalankan ulang `bop.sql` (aman). |
| Hak akses menu | Diatur di aplikasi (menu **Hak Akses Menu**), tanpa deploy. Tampilan mengikuti saat pengguna memuat ulang halaman atau login ulang; Apps Script paling lama 5 menit; database dan Edge Function langsung. |

**Memperbarui dari versi tujuh peran ke versi ini** (menu Status Apps Script dihapus, penampil dokumen baru, total di Verifikasi, semua POS di detail Verifikasi, logo dan ikon). **Tanpa** deploy ulang Apps Script maupun Edge Function:
1. **Database**: jalankan ulang `bop.sql` di SQL Editor (aman diulang). Menghapus kunci menu Status Apps Script dari daftar menu dan dari hak akses semua peran; tidak ada data yang hilang.
2. **Website**: ganti berkas yang ada di paket ini (paket sengaja **tidak** memuat `js/config.js` dan `js/sertifikat-dokumen-pdf.js` Anda), **tambahkan `assets/b-logo.png`**, jalankan `node bump-versi.mjs`, commit, dan push.
Bila website diperbarui sebelum `bop.sql` dijalankan, aplikasi tetap berjalan (kunci menu yang sudah tidak dikenal diabaikan); jalankan `bop.sql` sesudahnya.

**Memperbarui dari versi sebelum tujuh peran dan Hak Akses Menu** (satu jendela pemeliharaan, sekitar 30 menit). Data tidak berubah dan akun lama (admin dan operator) tetap berlaku. Ikuti urutan ini:
1. **Cadangan**: ekspor data Supabase (bagian 13) dan buat salinan Spreadsheet (*File > Make a copy*).
2. **Database**: jalankan ulang seluruh `bop.sql` di SQL Editor (aman). Ini menambah tujuh peran, tabel `hak_akses` (diisi bawaan satu kali), dan aturan baru (Realisasi SAKTI tidak lagi dibatasi RPD tetapi menutup pengiriman Operator KUA bila melebihi RPD; tarif Jaspro/Transport menurut tanggal).
3. **Edge Function**: `npx supabase functions deploy bop --no-verify-jwt` (menambah `buat-akun`, `ubah-akun`, dan `bast-*`; reset password kini untuk peran mana pun). Rahasia Google tidak berubah.
4. **Apps Script**: ganti isi `Code.gs` dan `Bast.gs` (`SUPABASE_URL` dan `SUPABASE_KEY` di berkas paket ini sudah berisi nilai dari berkas Anda sebelumnya; pastikan masih sama dengan `js/config.js`; baris `DRIVE_MASTER_FOLDER_ID` boleh dihapus), ganti isi `appsscript.json` dengan berkas dari paket ini, jalankan `setupDatabase` (menambah kolom `ArsipMaster`) dan `authorizeAccess` (setujui izin bila diminta), lalu **Deploy > Manage deployments > Edit > Version: New version**. URL Web App tidak berubah.
5. **Website**: ganti berkas (kecuali `js/config.js`), jalankan `node bump-versi.mjs`, commit, dan push. Lakukan langkah 4 dan 5 berdekatan: halaman baru memanggil aksi arsip baru di Apps Script, sedangkan Apps Script baru tidak lagi punya aksi unggah arsip yang lama.
6. **Di aplikasi** (login admin): periksa **Hak Akses Menu**, buat akun peran baru di **Pengaturan > Daftar akun**, lalu pindahkan arsip BAST NR lama di **BAST NR > Pengaturan BAST > Arsip di folder master**.

Bila website diperbarui sebelum `bop.sql` dijalankan, admin melihat pita kuning "Database belum diperbarui" dan aplikasi berjalan dengan hak akses lama (Admin dan Operator KUA) sampai `bop.sql` dijalankan.

**Memperbarui dari versi satu-file (`index.html` besar):** salin nilai `CFG` dari `index.html` lama (url, key, turnstile, domain, gas) ke `js/config.js`, ganti seluruh berkas website dengan versi ini, jalankan `node bump-versi.mjs`, lalu push. Data tidak berubah.

## 12. Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Pita merah "js/config.js belum lengkap" | Nilai `url`, `key`, atau `turnstile` masih contoh. Isi sesuai bagian 8. |
| `bop.mjs`: "Isi GOOGLE_CLIENT_ID ..." (atau SUPABASE_URL ...) padahal sudah diisi | `.env` tidak terbaca: periksa namanya persis `.env` (bukan `.env.txt`; di Mac lihat dengan `ls -a`), letaknya satu folder dengan `bop.mjs`, format `NAMA=nilai`, dan jalankan dari folder proyek. Pada Node lama (di bawah 20.12) pakai `node --env-file=.env bop.mjs ...`. |
| Login: "Invalid login credentials" | Username/password salah, atau `CFG.domain` berbeda dari `EMAIL_DOMAIN` saat `bop.mjs akun` dijalankan. |
| Captcha tidak muncul atau login ditolak karena captcha | Hostname situs belum ada di widget Turnstile, Site Key salah, atau Secret Key belum dipasang di Supabase. |
| Menu Sertifikat/BAST: "Sesi tidak valid ... (HTTP 401: ...)" | Token ditolak Supabase. Muat ulang halaman atau login ulang. Bila terus berulang, periksa `SUPABASE_URL` dan `SUPABASE_KEY` di Code.gs. |
| "Supabase menolak SUPABASE_KEY di Code.gs" | `SUPABASE_KEY` di Apps Script bukan publishable key proyek yang sama dengan `CFG.key`. Perbaiki, lalu **New version**. |
| "Peran Anda belum diberi hak akses untuk menu ini" (Apps Script), atau menu tidak tampil di sidebar | Peran akun itu belum diberi menu tersebut. Admin mengaturnya di **Hak Akses Menu**. Tampilan mengikuti setelah halaman dimuat ulang atau login ulang; Apps Script paling lama 5 menit (cache pemeriksaan login). Menu Hak Akses Menu dan Impor Data Lama memang khusus admin. |
| Pita kuning "Database belum diperbarui" (admin) | `bop.sql` versi terbaru belum dijalankan. Jalankan seluruh isinya di SQL Editor Supabase, lalu muat ulang. |
| Tambah akun: "Profil akun tidak terbentuk sesuai peran" | `bop.sql` di database masih versi lama (belum mengenal peran baru). Jalankan `bop.sql` terbaru, lalu ulangi. Akun yang gagal dibuat otomatis dibatalkan. |
| Operator KUA: "Realisasi ... sudah melebihi RPD setahun, jadi Realisasi baru belum dapat dikirim" (tombol Kirim nonaktif) | Realisasi SAKTI yang diinput admin/bendahara (sudah dibayar) membuat Realisasi sebuah POS melebihi RPD setahun, atau sebuah bulan melebihi RPD bulannya. Ini disengaja. Tombol terbuka lagi setelah admin menyesuaikan (menambah) RPD POS/bulan itu di menu RPD. |
| "Aksi tidak dikenali: ..." (mis. `bastArsipSet` setelah website diperbarui) | Deployment Apps Script masih versi lama: **Manage deployments > Edit > New version**. Atau `CFG.gas` menunjuk deployment lain. |
| "CFG.gas ... belum diisi" / gagal menghubungi Apps Script | Isi `CFG.gas`. Web App harus *Who has access: Anyone*, dan URL harus yang berakhiran `/exec`. |
| Arsip BAST NR lama: "Google Drive menolak permintaan (HTTP 403) untuk arsip lama ini" | Hanya terjadi pada arsip LAMA (belum di folder master). Pastikan `appsscript.json` dari paket ini sudah terpasang (izin `drive`; periksa lewat `authorizeAccess`) dan Web App sudah New version. Bila file lamanya memang tidak dapat dibuka akun Apps Script, unggah ulang arsipnya dari Riwayat BAST: arsip baru disimpan di folder master. Unggahan BARU tidak lagi lewat Apps Script, jadi tidak mungkin terkena 403 ini. |
| "Gagal terhubung ke Google Drive" atau "Gagal membuat folder di Google Drive" saat mengunggah LPJ atau arsip BAST | Rahasia Google di Edge Function bermasalah: token kedaluwarsa (aplikasi Google masih *Testing*), izin dicabut, atau `DRIVE_ROOT_FOLDER_ID` salah. Jalankan ulang `bop.mjs drive`, pasang ulang secrets (bagian 5 dan 6), lalu deploy ulang Edge Function. |
| Unggah LPJ atau arsip BAST gagal setelah beberapa hari | Aplikasi Google masih *Testing* (token 7 hari). Publish app, jalankan ulang `bop.mjs drive`, perbarui secrets, deploy ulang. |
| Migrasi arsip BAST: sebagian "gagal" | Arsip yang hanya punya tautan harus masih dibagikan "Siapa saja yang memiliki link" di Drive lama dan berukuran maks. 20 MB; selain itu unggah ulang dari Riwayat BAST. Jalankan migrasi lagi: yang sudah masuk tidak digandakan. |
| `Server sedang menyimpan data lain` | Dua penyimpanan bersamaan di Spreadsheet; ulangi sebentar lagi. |
| Peta kosong / GPS ditolak | Buka lewat `https://` atau `localhost`, izinkan lokasi. Lapisan OpenStreetMap kadang kosong; pakai Satelit/Jalan. |
| Logo tidak muncul di PDF BAST | Letakkan `assets/logo-kemenag.png`. |
| Halaman lama tampil setelah pembaruan | `node bump-versi.mjs`, push, lalu muat ulang paksa (Ctrl+F5). |
| Semua menu gagal tiba-tiba | Proyek Supabase gratis dijeda setelah ±1 minggu tanpa aktivitas: buka dashboard dan *Restore project*. |

## 13. Cadangan dan pemulihan

- **Spreadsheet** (Sertifikat dan BAST NR): satu-satunya salinan datanya. Buat salinan berkala (*File > Make a copy*), dan manfaatkan *Version history*. Sheet `Pengaturan` memuat tanda tangan; jangan terhapus.
- **Supabase** (BOP, Jaspro, akun, peran, dan hak akses menu): paket gratis tidak punya cadangan otomatis. Ekspor berkala (dump dengan `pg_dump` lewat connection string di *Project Settings > Database*, atau ekspor tabel ke CSV).
- **Google Drive**: dokumen LPJ dan arsip BAST ada di folder master `BIMASATU` dan tidak terhapus saat data dihapus.
- **Pemulihan total**: ulangi bagian 2 sampai 8, lalu kembalikan data dari cadangan (bagian 10). Berkas `bop.sql`, `bop.mjs`, `apps-script/`, dan kode website ini adalah semua yang dibutuhkan untuk membangun ulang.
