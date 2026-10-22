# BIMASATU (Bimas Islam Kabupaten Indramayu): panduan untuk AI (baca ini dulu)

Dokumen ini dibuat agar AI (atau developer baru) cepat paham proyek ini tanpa membaca seluruh kode. Urutan baca yang disarankan:
`README.md` (ini) -> `bop.sql` (data BOP + aturan) -> `supabase/functions/bop/index.ts` (server Supabase) -> `apps-script/Code.gs` (server Apps Script) -> `js/core.js` lalu berkas menu di `js/` -> `PANDUAN-INSTALASI.md` (pemasangan dari nol).

**Urutan pemasangan:** `bop.sql` (SQL Editor Supabase) -> `bop.mjs akun` -> `bop.mjs drive` -> `supabase/functions/bop/index.ts` (deploy; satu-satunya berkas TypeScript) -> `apps-script/*.gs` -> `js/config.js` dan push ke GitHub Pages. Alasan urutannya ada di PANDUAN-INSTALASI.md bagian 1.

## 1. Tujuan
Aplikasi web layanan 31 KUA (Kantor Urusan Agama) se-Kabupaten Indramayu dan Seksi Bimas Islam. Modul: **BOP** (Biaya Operasional Perkantoran, inti), **Jaspro Transport**, **BAST NR**,
**Sertifikat Masjid/Musala**, **Sertifikat Arah Kiblat**, dan manajemen akun. Satu website, **dua backend**: Supabase (BOP + Jaspro) dan Apps Script + Spreadsheet (Sertifikat + BAST NR), supaya kuota Supabase hemat.
Nama aplikasi **BIMASATU** dipakai di tiga tempat yang **harus sama**: `CFG.nama` di `js/config.js`, `APP_NAME` di `supabase/functions/bop/index.ts`, dan `APP_NAME` di `bop.mjs` (nama folder master di Google Drive).

Alur BOP: admin menetapkan **Anggaran** tahunan per KUA -> operator KUA menyusun **RPD** (rencana penarikan dana) per bulan ->
operator mengisi **Realisasi** per bulan + unggah **LPJ** -> admin **memverifikasi** (status Dibayar wajib mencatat **nominal yang dibayarkan**) -> **Laporan** Excel/PDF.
Pembayaran lewat SAKTI (autopayment) hanya **Listrik dan Telepon/Internet**. Pengaturannya **global**: satu ceklis per KUA + POS di **Pengaturan SAKTI** (tanpa bulan/tahun berlaku).
POS yang dicentang tidak diisi operator: nominalnya diinput admin tiap bulan di **Realisasi SAKTI** dan dijumlahkan dengan Realisasi manual. Air adalah POS manual biasa.
Data dari sistem lama (Spreadsheet/Apps Script) dapat dibawa lewat menu **Impor Data Lama**, termasuk menyalin berkas LPJ ke struktur Google Drive baru.

## 2. Peta berkas (satu berkas per menu; tanpa build)
| Berkas | Isi |
|---|---|
| `index.html` | Kerangka: layar login, sidebar, wadah `#view` dan `#sertView`, dialog, dan **urutan pemuatan skrip**. Tidak berisi logika. |
| `css/app.css`, `css/sertifikat.css` | Gaya dasar (di atas tema Sneat dari CDN) dan gaya khusus menu Sertifikat. |
| `js/config.js` | `CFG` (nama, url, key, turnstile, gas, domain) dan `APP_VERSI`. **Satu-satunya berkas yang diisi per instalasi.** |
| `js/core.js` | Inti: sesi dan Supabase (`sb`), helper (`$`, `esc`, `note`, `rp`), router (`route`, `pages`), `boot`, klien Edge Function (`api`) dan Apps Script (`gas`, `gasRaw`), pemuat pustaka (`loadJs`), penampil dokumen (`openViewer`), komponen bersama (`jpToast`, `jpDlg`, `jpAsk`, `jpCard`). |
| `js/bop.js` | Menu **BOP**: RPD, Realisasi, Verifikasi, Laporan, Anggaran, Pengaturan dan Realisasi SAKTI, Config, Impor Data Lama. |
| `js/akun.js` | **Manajemen akun**: Pengaturan akun sendiri (ganti password) dan reset password operator oleh admin. |
| `js/jaspro.js` | Menu **Jaspro Transport** (`JX` = logika asli, `J`/`jp*` = tampilan + simpan). |
| `js/bast.js` | Menu **BAST NR** (`BX` = logika asli, `B`/`bn*`/`bb*`/`bp*` = tampilan); data lewat Apps Script. |
| `js/sertifikat.js` | Pintu masuk menu **Sertifikat**: halaman Status Apps Script dan **pemuat** modul Sertifikat (dimuat malas). |
| `js/sertifikat-masjid.js`, `js/arah-kiblat.js`, `js/pengaturan-sertifikat.js` | Menu **Sertifikat Masjid/Musala**, **Sertifikat Arah Kiblat**, **Pengaturan Sertifikat** (dimuat malas, berurutan, satu lingkup global). |
| `js/sertifikat-dokumen-pdf.js`, `js/sertifikat-hitung-kiblat.js`, `js/sertifikat-wilayah.js` | Mesin PDF (jsPDF), perhitungan kiblat/matahari/Hijriah (murni), daftar kecamatan-desa. Dipakai menu Sertifikat. |
| `js/app.js` | Pemicu saat halaman dimuat (judul, Turnstile, login, logout, sidebar, hashchange) + pemeriksaan `config.js`. **Dimuat paling akhir.** |
| `views/*.html` | Tampilan HTML menu Sertifikat (tabel, form, dialog); diambil `fetch` oleh `sertifikat.js`. |
| `bop.sql` | **Sumber kebenaran** skema database Supabase (BOP + Jaspro; idempotent): tabel, fungsi, trigger, RLS, data awal (31 KUA, 11 POS, config). Aman dijalankan ulang; juga mengonversi struktur lama. |
| `supabase/functions/bop/index.ts` | **Satu** Edge Function (Deno): `reset-password`, `upload`, `delete`, `list`, `file`, `impor-lpj` (LPJ BOP di Google Drive). |
| `apps-script/Code.gs`, `Masjid.gs`, `Kiblat.gs`, `Pengaturan.gs`, `Bast.gs`, `appsscript.json` | Backend Apps Script (Spreadsheet): router + pemeriksaan login (`Code.gs`), Sertifikat, BAST NR. Lihat bagian 17. |
| `bop.mjs` | Skrip pemasangan sekali jalan (Node): `akun` (32 akun), `username` (ubah akun lama), `drive` (token + folder master Google Drive). Membaca `.env` di foldernya otomatis (`node bop.mjs akun`). |
| `bump-versi.mjs` | Menaikkan nomor versi (`?v=` di `index.html`, `APP_VERSI`) agar peramban memuat berkas terbaru. |
| `.env.example`, `.gitignore`, `package.json` | Templat `.env` (rahasia, tidak diunggah), daftar yang tidak boleh diunggah, dependensi `bop.mjs`. |
| `PANDUAN-INSTALASI.md` | Pemasangan dari nol, pembaruan, cadangan, dan pemecahan masalah untuk manusia. |

Tanpa dependensi build. Pustaka pihak ketiga dari CDN: Sneat (CSS), Boxicons, supabase-js, Cloudflare Turnstile (awal); SheetJS, ExcelJS, jsPDF 2.5.1 + AutoTable, pdf.js (hanya saat dibutuhkan, via `loadJs()`);
Bootstrap JS, jsPDF 4.2.1, qrcode-generator, Leaflet (hanya saat menu Sertifikat dibuka).

## 3. Arsitektur
```
Browser (index.html @ GitHub Pages; js/*.js dimuat berurutan)
  |-- supabase-js (kunci publishable) --> PostgREST + Auth (Supabase)    <- BOP + Jaspro; dijaga RLS + trigger
  |-- fetch /functions/v1/bop?action=... (Bearer token login) --> Edge Function bop
  |                                                         |-- Supabase (service role, di server)
  |                                                         |-- Google Drive API (LPJ BOP; refresh token di Secrets)
  |-- fetch Web App Apps Script (POST text/plain, JSON + token login Supabase)  --> Apps Script (khusus admin)
  |                                                         |-- memeriksa token ke Supabase (tabel profiles, di-cache 5 menit)
  |                                                         |-- Spreadsheet: DataMasjid, DataKiblat, Pengaturan, BastPegawai, BastBA, BastSetting
  |                                                         |-- Google Drive API (arsip BAST NR)
  |-- fetch Web App Apps Script LAMA (hanya menu Impor Data Lama BOP, hanya membaca)
Cloudflare Turnstile: captcha login (Site Key di js/config.js; Secret Key di pengaturan Auth Supabase)
```
Prinsip: **rahasia hanya di server** (Supabase Secrets / `.env` lokal / Apps Script). Browser hanya memegang URL, publishable key, Site Key, dan URL Web App.
**Aturan bisnis BOP ditegakkan di database (trigger SECURITY DEFINER)**; **aturan BAST NR ditegakkan di `apps-script/Bast.gs`** di bawah kunci skrip. UI hanya meniru agar pesannya cepat dan jelas.
**Login hanya satu** (Supabase). Apps Script tidak punya login sendiri: ia menerima token login Supabase, memeriksanya, dan hanya melayani peran `admin`.

**Login memakai username**, bukan email. Supabase Auth tetap membutuhkan email, jadi akun disimpan sebagai `<username>@<EMAIL_DOMAIN>`; pengguna tidak pernah mengetik domainnya
(`toEmail()` di `js/core.js` menambahkannya dari `CFG.domain`; email penuh yang diketik tetap diterima apa adanya). Operator: `kua_<kecamatan huruf kecil tanpa spasi>`, mis. `kua_anjatan`,
`kua_indramayu`, `kua_kedokanbunder`. `CFG.domain` (`js/config.js`) dan `EMAIL_DOMAIN` (`.env` untuk `bop.mjs`) harus sama.
**Keamanan wajib:** pendaftaran mandiri Supabase harus **dimatikan** (Authentication > Allow new users to sign up = off). Trigger `handle_new_user` mengangkat akun yang membawa `role=admin` di metadata menjadi admin; bila pendaftaran terbuka, siapa pun yang tahu URL dan publishable key dapat mengangkat dirinya sendiri.

## 4. Model data (lihat `bop.sql`)
| Tabel | Kunci/kolom penting |
|---|---|
| `profiles` | `id` (=auth.users.id), `nama`, `kua` (teks), `kua_id`, `role` (`admin`/`operator`). Dibuat otomatis oleh trigger `handle_new_user` dari `user_metadata`. Klien tidak bisa menulis. Username tidak disimpan: ia bagian email sebelum `@` (admin membacanya lewat RPC `akun_daftar()`). |
| `kua` | 31 baris. `nama_kua` berpola `KUA Kec. <Kecamatan>`; `kecamatan` dipakai untuk username dan nama folder Drive. |
| `pos` | 11 baris = 11 **unit input**: rincian bila ada (ATK Kantor, Jamuan Tamu, Pramubakti, Alat Rumah Tangga, Penggandaan/Penjilidan, Spanduk) atau kode POS itu sendiri (522111 Listrik, 522112 Telepon/Internet, 522113 Air, 523111 Pemeliharaan Gedung, 523121 Pemeliharaan Peralatan). `kode_pos` = **kode akun**, selalu ditampilkan di UI. |
| `config` | Pasangan `key`/`value` (jsonb): `rpd_enabled`, `realisasi_enabled`, `max_file_size_mb`, `max_file_count`, `bulan_edit_rpd` (array bulan). LPJ selalu wajib (tidak ada kunci untuk itu). |
| `anggaran` | **1 baris = 1 tahun**: `tahun` (kunci utama), `items` jsonb `{"<kua.id>": nominal}`, `total` (dihitung trigger). Operator tidak membaca tabel ini (satu baris memuat semua KUA): operator memanggil RPC `anggaran_tahun(tahun)` (hanya KUA-nya), admin menulis lewat RPC `set_anggaran(tahun, items)` yang **menggabungkan** hanya KUA yang dikirim (nilai 0 = hapus). |
| `rpd` | **1 record = 1 KUA x 1 bulan**: `(kua_id, tahun, bulan)` unik, `items` jsonb, `total`. |
| `realisasi` | **1 record = 1 KUA x 1 bulan**: sama seperti RPD + `status`, `file_lpj_url`, `catatan_admin`, `submitted_*`, `verified_*`, `paid_at`, `nominal_dibayar` (nominal yang dibayarkan admin; terisi hanya saat status `paid`). |
| `metode_pembayaran` | **Ceklis global** per KUA + POS: `(kua_id, pos_id)` kunci utama, `metode` (`MANUAL`/`SAKTI`), `updated_by/at`. Hanya POS 522111/522112. Belum ada baris = MANUAL. |
| `realisasi_sakti` | **1 record = 1 KUA x 1 POS x 1 bulan** (unik): hanya `nominal` (+ `updated_by/at`). Tanpa status, tanggal, sumber, atau keterangan. Hanya admin yang menulis. |

Fungsi yang dipanggil klien (RPC): `anggaran_tahun`, `set_anggaran`, `akun_daftar` (admin), `impor_baris` (admin). Semuanya `SECURITY DEFINER` dengan `execute` dicabut dari `anon`.

Bentuk `items`: `{"<pos.id>": nominal}`, kunci = id POS sebagai string, nilai bilangan bulat rupiah > 0 (nol dibuang). Contoh:
`{"1": 1500000, "7": 300000}`. `total` dihitung trigger (`items_total`), jangan diisi manual.
Semua uang = bilangan bulat rupiah (bigint), tanpa desimal, **maksimal 10 digit (Rp 9.999.999.999)** per isian (`nominal_max()` di SQL, `MAXD` di JS). Bulan = 1..12.

**Pembayaran SAKTI.** `metode_pos(kua, pos)` (SQL) / `metodeOf(vers, kid, pid)` (JS): baris ada -> nilainya, tidak ada -> MANUAL. Jumlah SAKTI sebulan/setahun (`sakti_items`/`sakti_year`, JS `saktiOf`/`saktiYear`)
dijumlahkan dengan Realisasi manual pada validasi dan laporan. Satu bulan hanya boleh punya **satu sumber per POS**: Realisasi SAKTI ditolak bila Realisasi manual bulan itu sudah memuat POS yang sama.
Karena pengaturan global, Realisasi manual lama (sebelum POS dicentang) tidak dihapus: operator tidak bisa mengisi/mengubahnya, tetapi nilai lamanya **dipertahankan** server saat Realisasi yang ditolak diperbaiki.
Tidak ada DELETE untuk siapa pun (koreksi: kosongkan nominal = Rp 0). `updated_by` diisi server.

## 5. Aturan bisnis BOP (invariant) dan di mana ditegakkan
| # | Aturan | Server | UI |
|---|---|---|---|
| 1 | Total RPD setahun <= anggaran KUA itu (`anggaran.items`); tanpa anggaran RPD ditolak | trigger `rpd_guard` | `pageRpd` |
| 2 | Anggaran sebuah KUA tidak boleh < total RPD KUA itu pada tahun itu (mengosongkan pun ditolak) | trigger `anggaran_guard` (mengunci semua KUA tahun itu) | pesan error |
| 3 | Operator mengedit RPD hanya jika `rpd_enabled` dan bulan ada di `bulan_edit_rpd`; admin bebas | RLS `rpd_write` + `rpd_open()` | tombol terkunci |
| 4 | Realisasi boleh dikirim mulai tanggal 10 bulan tersebut (WIB) | `realisasi_guard` | `okDate` |
| 5 | Total Realisasi sebulan (manual + SAKTI) <= RPD bulan itu | `realisasi_guard`, `realisasi_sakti_guard` | `calc()` |
| 6 | Realisasi satu POS setahun (bulan lain + SAKTI + ini) <= RPD POS itu setahun | `realisasi_guard`, `realisasi_sakti_guard` | `calc()` |
| 7 | POS yang dicentang SAKTI tidak boleh diisi/diubah operator; nilai lama (bila ada) dipertahankan | `realisasi_guard` (`metode_pos`) | input disabled + keterangan "Sudah/Belum dibayar SAKTI" |
| 8 | LPJ wajib: `total > 0` mensyaratkan `file_lpj_url` | `realisasi_guard` | cek jumlah dokumen |
| 9 | Operator hanya boleh **membuat** (belum ada) atau **memperbaiki yang berstatus `rejected`**. Setelah dikirim jadi `waiting` dan terkunci (nominal + dokumen). `approved`/`paid` juga terkunci | `realisasi_guard` + Edge `upload`/`delete` | `edit` flag |
| 10 | Admin boleh mengubah status ke status apa pun kapan pun; `rejected` wajib `catatan_admin`; `paid` **wajib `nominal_dibayar`** (> 0, <= total Realisasi, maks. 10 digit), status lain mengosongkannya. Admin **tidak** boleh mengubah `items/total/file_lpj_url/kua/tahun/bulan` | `realisasi_guard` | `pageVerifikasi` |
| 11 | Operator hanya menyentuh KUA-nya (dicek lebih dulu agar pesan error tidak membocorkan data KUA lain) | `my_kua()` di guard + RLS | - |
| 12 | SAKTI hanya POS 522111 (Listrik) dan 522112 (Telepon/Internet) | `metode_guard`, `realisasi_sakti_guard` (`pos_sakti_ok`) | kolom tetap 2 |
| 13 | Dokumen LPJ: PDF/JPG/PNG (ekstensi + magic bytes), ukuran dari `config`, **jumlah per bulan** dari `config`, hanya operator KUA itu, hanya saat belum dikirim atau `rejected`; hapus = pindah ke Sampah Drive | Edge `bop` | `pageRealisasi` |
| 14 | Pratinjau/daftar/hapus dokumen hanya untuk admin atau operator KUA tersebut; `id` file harus berada di folder KUA-tahun itu **dan** berawalan bulan yang diminta | Edge `bop` (`list`/`file`/`delete`) | penampil |
| 15 | Pengaturan SAKTI: hanya admin; global; belum diatur = MANUAL; operator hanya membaca KUA-nya | `metode_guard` + RLS `mp_*` | `pageMetode` |
| 16 | Mengembalikan ke MANUAL ditolak selama KUA + POS itu punya Realisasi SAKTI bernominal; Realisasi SAKTI ditolak untuk bulan yang sudah punya Realisasi manual POS itu | `metode_guard`, `realisasi_sakti_guard` | pesan error |
| 17 | Realisasi SAKTI: hanya admin; POS harus dicentang; periode sudah berjalan (WIB); nominal 0..10 digit; unik per KUA+POS+bulan; kunci baris tidak bisa diubah | `realisasi_sakti_guard`, unique, RLS `rs_*` | `pageSakti` |
| 18 | Tanpa DELETE untuk anggaran, metode, dan Realisasi SAKTI (admin pun tidak) | `revoke delete, truncate` + tanpa policy delete | - |
| 19 | Identitas pengubah (`updated_by`) diisi server dari `auth.uid()`, bukan dari klien | trigger guard | - |
| 20 | **Semua nominal maksimal 10 digit** (Rp 9.999.999.999): rincian POS, anggaran per KUA, Realisasi SAKTI, nominal dibayar | `nominal_max()` di `norm_items`, `anggaran_guard`, `realisasi_sakti_guard`, `realisasi_guard` | `MAXD` di `fmtIn` |
| 21 | Impor data lama hanya admin, per baris (satu gagal tidak membatalkan yang lain), lewat `impor_baris`. Penanda `bop.impor` (hanya berlaku di dalam transaksi fungsi itu) melewati aturan **proses** operator pada Realisasi (kepemilikan, status, tanggal 10, LPJ, POS SAKTI); aturan **hitungan** (RPD) tetap berlaku | `impor_baris` + `realisasi_guard` | `pageImpor` |

Status: `waiting` (Menunggu verifikasi), `approved` (Disetujui), `rejected` (Ditolak), `paid` (Dibayar).

**Struktur Google Drive** (semua di bawah satu folder master = `DRIVE_ROOT_FOLDER_ID`, yang otomatis dinamai `APP_NAME` = BIMASATU):
```
BIMASATU / BOP / LPJ / <tahun> / Kecamatan <nama> / <MM Bulan> - <nama file>      contoh: 03 Maret - nota listrik.pdf
BIMASATU / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>      (dibuat Apps Script: apps-script/Bast.gs)
```
Aturannya: master -> nama menu -> (jenis dokumen) -> tahun -> ... File LPJ satu KUA satu tahun berada dalam satu folder; **bulan dibedakan oleh awalan nama file** (`MM Bulan - `, terurut di Drive).
`file_lpj_url` = link folder `Kecamatan <nama>` (penanda "LPJ ada"; folder privat). Folder dan file lama (struktur `<tahun>/<nama KUA>/Realisasi/<MM Bulan>`) tidak dibaca lagi dan boleh dihapus di Drive.

## 6. Hak akses
| | Admin | Operator |
|---|---|---|
| Anggaran | tulis semua KUA (RPC `set_anggaran`) | baca KUA sendiri (RPC `anggaran_tahun`) |
| RPD | tulis/baca semua KUA (filter Semua Kecamatan) | tulis/baca KUA sendiri, hanya bulan yang dibuka |
| Realisasi | baca semua; ubah **status** (dan nominal dibayar) saja | buat/perbaiki (lihat aturan 9) KUA sendiri |
| Pengaturan SAKTI, Realisasi SAKTI, Config, Impor Data Lama | tulis | tidak ada akses tulis (operator hanya membaca pengaturan dan Realisasi SAKTI KUA-nya; Config: konfigurasi umum) |
| Jaspro Transport | baca/tulis (RLS `jaspro_admin`) | tidak ada akses |
| BAST NR | semua (Apps Script memeriksa peran `admin` dari token Supabase) | tidak ada akses |
| Sertifikat Masjid/Musala, Arah Kiblat, Pengaturan Sertifikat | semua (sama seperti BAST NR) | tidak ada akses |
| Reset password | operator mana pun (Edge `reset-password`) | ubah password sendiri |

Menu admin-only dijaga dua lapis: `route()` di `js/core.js` (daftar halaman admin dan awalan `sert-`) dan server (RLS/trigger, Edge Function, `requireAdmin_` di Apps Script).

## 7. Frontend (`index.html` + `js/` + `views/` + `css/`)
**Cara kerja berkas.** Semuanya skrip klasik (bukan ES module) dimuat berurutan oleh `index.html`: `config` -> `core` -> `bop` -> `akun` -> `jaspro` -> `bast` -> `sertifikat` -> `app`. Semua berkas berbagi **satu lingkup global**
(`const`/`let`/`function` tingkat atas saling terlihat; nama tidak boleh kembar antarberkas). Aturan pemuatan:
- Kode yang berjalan **saat dimuat** (di luar badan fungsi) hanya boleh memakai nama dari berkas yang dimuat lebih dulu. Karena itu `pages` di `core.js` dimulai kosong (`const pages = {}`) dan **tiap berkas menu mendaftarkan halamannya di akhir berkasnya**: `Object.assign(pages, { ... })`.
- Pernyataan pemicu (event, `onAuthStateChange`, `hashchange`) berada di `app.js` yang dimuat paling akhir. Jangan menambah pemicu semacam itu di berkas lain.
- Pemanggilan antarberkas **di dalam fungsi** bebas (mis. `core.js` memanggil `jpReset`/`bnReset` saat logout), karena saat dijalankan semua berkas sudah termuat.
- Menu **Sertifikat** dimuat malas oleh `sertifikat.js`: pustaka CDN + mesin PDF + `views/*.html` diunduh saat menu pertama dibuka, lalu `sertifikat-masjid.js`, `arah-kiblat.js`, `pengaturan-sertifikat.js` dimuat **berurutan** (berbagi variabel) dan `loadMasjidList/loadKiblatList/loadPengaturan` dipanggil. Kegagalan jaringan dapat diulang tanpa memasang ulang tampilan.
- Pembusukan cache: setiap rilis jalankan `node bump-versi.mjs` (menaikkan `?v=` di `index.html` dan `APP_VERSI` yang dipakai berkas yang dimuat malas).
- Menambah menu baru: buat `js/<menu>.js` (fungsi `pageXxx`, daftarkan lewat `Object.assign(pages, ...)` di akhir berkas), tambahkan `<script>` di `index.html` sebelum `app.js`, tautan di sidebar, dan nama halaman admin-only di `route()` bila perlu.

Lokasi fungsi: halaman BOP (`pageRpd`, `pageRealisasi`, `pageVerifikasi`, `pageLaporan`, `pageAnggaran`, `pageMetode`, `pageSakti`, `pageConfig`, `pageImpor`, `legacy*`, `build*`, `multiSelect`) di `js/bop.js`; `pagePengaturan`, `openReset`, `pwPair` di `js/akun.js`;
`JX`, `J`, `jp*`, `pageJaspro` di `js/jaspro.js`; `BX`, `B`, `bn*`, `bb*`, `bp*`, `pageBast*` di `js/bast.js`; sisanya (helper, router, auth, `api`, `gas`, `openViewer`, `loadJs`) di `js/core.js`. Nama fungsi sama dengan versi satu-file.

Peta kode (fungsi tetap bernama sama):
- **Konfigurasi**: `CFG` dan `APP_VERSI` di `js/config.js` (`nama`, `url`, `key`, `turnstile`, `gas`, `domain`). Hanya ini yang perlu diisi per instalasi; `app.js` menampilkan peringatan bila masih berisi nilai contoh.
- **Auth**: login (username) + Turnstile; `toEmail()` menambahkan `@CFG.domain`; "Ingat saya" memakai adapter storage khusus (`localStorage` vs `sessionStorage`, kunci `bop.remember`/`bop.email`, yang disimpan = username); `boot()` memuat profil (`me.username` = bagian email sebelum `@`) lalu `route()`.
- **Routing**: hash (`#rpd`, `#realisasi`, ...). `pages` memetakan hash -> fungsi `pageXxx()`. Halaman admin-only: anggaran, verifikasi, metode, sakti, config, impor. `realisasi` khusus operator. Sidebar: menu **BOP** (details) berisi semua modul; **Pengaturan** di luar.
- **Helper**: `$` (getElementById), `esc` (WAJIB untuk teks pengguna di innerHTML), `note(teks, tipe)`, `rp()` (format 1.500.000), `num()`, `fmtIn()` (format saat mengetik, kursor tetap, **dipotong 10 digit**), `yearSel()`, `posLabel()` ("kode · nama"), `isum/sumT`, `ST` (status -> kelas badge + teks), `master()` (cache `kua`/`pos`/`config` di memori, `M`).
- **Server**: `api(query, opt)` memanggil `/functions/v1/bop`. `showDocs()` daftar dokumen (+hapus bila boleh).
- **Penampil dokumen**: `openViewer(files, idx, load, side)` dipakai di **semua menu** (Realisasi, Verifikasi, arsip BAST NR). `load(file)` mengembalikan `Response`; PDF/gambar dikenali dari `Content-Type`. Memakai dialog tersendiri `#vdlg` (dapat dibuka di atas dialog detail BAST). pdf.js; zoom Ctrl+scroll/pinch/tombol, geser, putar, posisi dijepit; **penunjuk halaman** "Halaman X dari N" = halaman dengan area tampak terbesar, dihitung di ruang dokumen sehingga benar di semua rotasi (`pageInd`). `side` (HTML atau fungsi, opsional) = panel **Rincian Realisasi per POS** di KIRI dokumen sebagai pembanding (`realisasiSide()`): Realisasi operator mengisinya dari **isian form saat ini** (belum tentu tersimpan), Verifikasi dari data tersimpan; POS yang dibayar lewat SAKTI berwarna biru; tombol "Rincian" menyembunyikan/menampilkan (layar sempit: panel menimpa dokumen, tersembunyi awalnya). Arsip BAST NR tidak memakai panel. **Semua id di penampil berawalan `vw` dan harus unik di seluruh dokumen**: `getElementById` mengambil elemen PERTAMA di halaman, jadi id yang sama dengan halaman di belakangnya (dulu `vst` = pilihan status di Verifikasi) membuat zoom/geser/ukuran mengenai elemen yang salah (dokumen tidak bergerak dan kotak status membesar setelah penampil ditutup).
- **Halaman**: pola "daftar dulu, tombol Detail membuka rincian" (RPD, Realisasi, Verifikasi) dengan fungsi `list()` dan `detail()` lokal; kalkulasi real-time di `calc()` yang menirukan trigger.
- **Verifikasi**: tabel dapat diurutkan per kolom (Kecamatan, Periode, Total, Status; `aria-sort`, dapat lewat keyboard): klik = naik, klik lagi = turun, klik ketiga = urutan awal; `data-i` tetap indeks asli sehingga Detail selalu membuka baris yang benar, dan urutan dipertahankan saat Kembali. Detail: POS yang dibayar lewat SAKTI diwarnai biru (`table-info`) + label SAKTI (pengaturan global ditambah nominal SAKTI bulan itu), kolom Realisasi = Manual + SAKTI, dan ringkasan "Realisasi Manual (operator) · Realisasi SAKTI (diinput Admin) · Total Realisasi (Manual + SAKTI) · RPD bulan ini".
- **Unggah LPJ (operator)**: `#lfile` dan tombol kirim terkunci bila Realisasi ditutup oleh `config` atau belum tanggal 10 (server menolak juga); blok unggah tetap tampil selama Realisasi masih boleh dibuat/diperbaiki (belum ada atau `rejected`).
- **Menu samping**: `#burger` tampil di semua ukuran layar. Layar lebar: menyembunyikan/menampilkan `#side` lewat `body.side-off` (pilihan diingat di `localStorage`, kunci `jalin.side`); layar sempit: `#side.open`. `#side` dapat digulir (`overflow-y:auto`) bila submenu yang dibuka lebih panjang daripada layar; saat tersembunyi `visibility:hidden` sehingga tidak dapat difokus keyboard.
- **Laporan**: `buildReport()` (data JSON + Realisasi SAKTI), `buildSakti()` (rekap RPD vs Realisasi SAKTI/Manual/Total/Sisa dengan filter POS dan metode; metode = ceklis global), `toXlsx()`, `toPdf()`; pustaka dimuat malas lewat `loadJs()`; `fetchAll()` memecah halaman 1000 baris.
- **Komponen**: `multiSelect()` (select multiple bergaya chip tanpa library, dipakai di Config), `pwPair()` (dua kolom password + tombol mata).
- **SAKTI**: `pageMetode` (matriks KUA x 2 POS berisi ceklis; "centang semua" per kolom; hanya baris berubah yang dikirim), `pageSakti` (matriks yang sama dengan kolom nominal per bulan; sel KUA yang tidak dicentang terkunci; total kolom), `bopStat` (statistik beranda admin: "Belum diinput bulan ini"). Helper `metodeOf`, `saktiOf`, `saktiYear`, `SAKTI_POS`. Realisasi operator menampilkan POS SAKTI read-only dengan keterangan "Sudah dibayar SAKTI" / "Belum dibayar SAKTI".
- **Impor Data Lama**: `pageImpor` (form + pratinjau + eksekusi + hasil), `legacyFetch` (membaca Apps Script lama dengan `fetch` POST tanpa header, seperti `apiCall` lama), `legacyPlan(raw, m, opt)` (**murni**: ubah data lama menjadi baris BIMASATU; memetakan nama KUA dan rincian POS, membuang yang tidak dipakai), `legacyCall`. Urutan tulis: anggaran -> metode -> RPD -> Realisasi (+ salin berkas satu per satu lewat Edge `impor-lpj`) -> Realisasi SAKTI.
- **Halaman basi**: `EP` naik tiap pindah menu; tiap halaman async mengambil `const ep = EP` dan memeriksa `live(ep)` sesudah setiap `await` sebelum menyentuh DOM. Ini mencegah `TypeError: Cannot set properties of null` saat pengguna pindah menu ketika data masih dimuat.
Konvensi: teks UI dan komentar berbahasa Indonesia; tanpa `localStorage` untuk data bisnis (kecuali kenyamanan: ingat login, alamat sistem lama); tidak ada log aktivitas; query hanya kolom yang perlu. **Id elemen harus unik di seluruh dokumen** (halaman + dialog + penampil yang terbuka bersamaan); penampil memakai awalan `vw`. Uji pengaman: render setiap rute dan periksa tidak ada id ganda.

## 8. Edge Function (`supabase/functions/bop/index.ts`)
`GET/POST /functions/v1/bop?action=<aksi>` dengan `Authorization: Bearer <token login>`. Dideploy dengan `--no-verify-jwt` karena fungsi memverifikasi
token (`auth.getUser`) dan peran dari tabel `profiles` sendiri (klien tidak dipercaya). CORS `*` (tanpa cookie).
Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_ROOT_FOLDER_ID` (dibuat `node bop.mjs drive`).
Scope Google `drive.file`: hanya folder/file buatan aplikasi, jadi root harus dibuat oleh `bop.mjs drive`. Sengaja **tanpa `console.*`** (hemat kuota log Supabase free).
- Pembantu Drive tingkat atas: `masterFolder()` (menamai folder master `APP_NAME` sekali per instance, kosmetik), `driveList()` (paginasi), `drivePath()` (folder bertingkat, dibuat bila perlu), `driveUpload()`, `lpjFolder()`.
- `impor-lpj` (admin, POST JSON `{kua, tahun, bulan, url, nama}`): menyalin **satu** file LPJ lama ke `BOP/LPJ/<tahun>/Kecamatan <nama>`. File lama dibagikan "siapa saja dengan link", jadi diunduh lewat tautan unduhan publik Google Drive (mengikuti pengalihan; `resourcekey` ikut bila ada di tautan) dan isinya dicek dari byte awal (halaman HTML "akses ditolak" tidak pernah tersimpan). Maks. 20 MB. **Idempoten**: file yang sudah disalin ditandai `appProperties.lama = <ID file lama>` dan tidak digandakan. Tidak memakai scope di luar `drive.file`.

## 9. Konvensi dan pantangan
- **Jangan** menaruh rahasia (service role/secret key, Google client secret/refresh token, Turnstile secret) di berkas frontend, `apps-script/`, atau repo. `.env`, `akun.csv`, `username.csv` ada di `.gitignore`.
- Perubahan database harus **idempotent** (`create ... if not exists`, `create or replace`, `drop ... if exists`). Jangan `drop table` data aktif tanpa pengaman: konversi struktur lama memakai pola *ganti nama menjadi `_lama` -> salin -> verifikasi -> hapus*, dan **dibatalkan** bila ada data yang belum sama (lihat bagian 11).
- **Satu berkas per menu** di frontend dan satu berkas per modul di Apps Script; `bop.sql`, `bop/index.ts`, dan `bop.mjs` tetap satu berkas masing-masing: ubah langsung, jangan membuat file migrasi terpisah (upgrade database = jalankan ulang `bop.sql`).
- Kode lama yang dipindahkan dari proyek lain (`JX`, `BX`, mesin PDF Sertifikat, perhitungan kiblat) **disalin apa adanya**; tampilan dan penyimpanan dibuat terpisah. Ubah seperlunya, jangan menulis ulang tanpa alasan.
- Aturan baru ditulis di **server lebih dulu** (trigger SQL untuk BOP, `Bast.gs` untuk BAST), lalu cerminkan di UI (`calc()`, tombol) dan, bila menyangkut dokumen, di Edge Function.
- Hindari tabel log/audit dan cron (hemat kuota free plan). Jejak audit cukup `updated_by/at`, `submitted_*`, `verified_*`, `paid_at`; di Spreadsheet kolom `DiubahPada`.
- Zona waktu aturan = WIB (`Asia/Jakarta`). Pesan error berbahasa Indonesia dan menyebut angka (batas, terpakai, dimasukkan, kelebihan).
- Jangan menyimpan data turunan yang bisa dihitung (mis. `total` boleh karena dijaga trigger; azimut kiblat dan data matahari dihitung di klien tiap dokumen dibuat, bukan disimpan).
- Halaman yang memuat data async wajib memakai `ep`/`live(ep)` (lihat bagian 7); hasil `await` dari halaman lama tidak boleh menulis ke layar baru.
- Impor data lama membawa **hanya yang dipakai BIMASATU**. Jangan menambah bidang ke impor kecuali skema memakainya (akun/password lama, kuota API, ID, Total, metadata file, riwayat sengaja tidak dibawa).
- Setiap perubahan kode Apps Script butuh **Deploy > Manage deployments > Edit > New version** agar berlaku; frontend butuh `node bump-versi.mjs`; Edge Function butuh `npx supabase functions deploy bop --no-verify-jwt`.

## 10. Jika mengubah X, ubah juga Y
| Perubahan | Sinkronkan |
|---|---|
| Nama aplikasi | `CFG.nama` di `js/config.js` (judul tab, logo, dan teks halaman mengikuti otomatis), `APP_NAME` di `supabase/functions/bop/index.ts` dan `bop.mjs`, judul dokumen ini dan `PANDUAN-INSTALASI.md`; folder master Drive dinamai ulang otomatis oleh Edge Function |
| Alamat Supabase / kunci publishable | `js/config.js` **dan** `SUPABASE_URL`/`SUPABASE_KEY` di `apps-script/Code.gs` (Apps Script memeriksa login ke Supabase), lalu Deploy New version |
| Alamat Web App Apps Script | `CFG.gas` di `js/config.js` |
| Folder master Google Drive | `DRIVE_ROOT_FOLDER_ID` (Supabase Secrets) **dan** `DRIVE_MASTER_FOLDER_ID` (`apps-script/Code.gs`) harus folder yang sama; akun Google pemilik Spreadsheet/Apps Script harus akun yang menjalankan `bop.mjs drive` |
| Menambah/mengubah POS | seed `pos` di `bop.sql`; cek `pos_sakti_ok` (SQL) dan `SAKTI_POS` (JS) bila POS boleh SAKTI; UI otomatis mengikuti `pos` (cache `master()`); pemetaan impor memakai `kode_pos` + `nama_rincian` |
| Aturan validasi Realisasi/RPD | trigger di `bop.sql` **dan** `calc()` di `pageRealisasi`/`pageRpd` (`js/bop.js`) |
| Batas digit nominal | `nominal_max()` di `bop.sql` **dan** `MAXD` di `js/bop.js` (serta teks pesan "10 digit") |
| Kunci config baru (BOP) | seed `config` di `bop.sql`, `pageConfig`, dan tempat yang membacanya (`m.cfg.<kunci>`, Edge Function bila relevan) |
| Aksi Edge Function baru | `bop/index.ts` (daftar aksi + metode di `Deno.serve`), lalu panggil lewat `api()` |
| Aksi Apps Script baru | tambah ke `actions_()` (`Code.gs`) atau ke `bastActions_()` (`Bast.gs`); panggil lewat `gas('namaAksi', {...})`; tulis data = `write: true`; Deploy New version |
| Kolom baru di sheet BAST | `BAST_DEF_` di `Bast.gs` (judul kolom, nama field, tipe), lalu `setupDatabase`; `BCOL`/`bnOut` di `js/bast.js` bila tampil |
| Struktur folder Drive | `lpjFolder()`/`awalan()` di `index.ts` (LPJ) atau `bastArsipUnggah_` di `Bast.gs` (BAST), bagian "Struktur Google Drive" di dokumen ini dan `PANDUAN-INSTALASI.md` |
| Format username | `usernameKua()` di `bop.mjs` (dan perintah `username` untuk akun yang sudah ada), `toEmail()` di `js/core.js`, `CFG.domain` |
| Mengubah alat Jaspro Transport | `bop.sql` bagian 12 **dan** `js/jaspro.js` (`JX` = logika hitung/ekspor asli, `J*`/`jp*` = tampilan + simpan) |
| Mengubah BAST NR | `apps-script/Bast.gs` (aturan + data + arsip), `js/bast.js` (`BX` = kode lama script.js/pdf.js, `B`/`bn*`/`bb*`/`bp*` = tampilan) |
| Mengubah Sertifikat Masjid/Musala atau Arah Kiblat | `apps-script/Masjid.gs`/`Kiblat.gs`/`Pengaturan.gs` (kolom sheet), `js/sertifikat-masjid.js`/`arah-kiblat.js`/`pengaturan-sertifikat.js`, tampilan di `views/*.html` (id elemen harus tetap sama dengan yang dipakai JS), dokumen di `js/sertifikat-dokumen-pdf.js` |
| Daftar tipologi masjid/musala | `TIPOLOGI_MASJID`/`TIPOLOGI_MUSOLA` di `js/sertifikat-masjid.js` **dan** `TIPOLOGI_MUSOLA_VALID_` di `apps-script/Masjid.gs` (harus sama persis) |
| Nama function/secret berubah | `PANDUAN-INSTALASI.md`, `bop.mjs` (teks cetak), pesan error di `api()` |
| Aturan SAKTI | `metode_guard`/`realisasi_sakti_guard`/`realisasi_guard` di `bop.sql`; `metodeOf`/`saktiOf`/`saktiYear` serta `calc()` di `js/bop.js`; `buildSakti` bila laporan terpengaruh; `legacyPlan` bila pemetaan Auto Payment berubah |
| Bentuk data sistem lama berubah | `legacyFetch`/`legacyPlan` di `js/bop.js` (satu-satunya tempat yang mengenal bentuk Apps Script lama) |

## 11. Cara memverifikasi (pengujian tidak disertakan sebagai file; cara menyusunnya)
- **Pemisahan frontend (monolit -> berkas per menu)**, diuji tiga lapis: (1) **statis**: parser JS (acorn) memetakan tiap pernyataan tingkat atas ke menu pemiliknya lewat jangkauan dari fungsi halaman; ESLint `no-undef` pada seluruh berkas dengan daftar global gabungan harus bersih;
  tidak ada nama tingkat atas kembar antarberkas; tiap rujukan saat-muat harus mengarah ke berkas yang dimuat lebih dulu. (2) **Perbandingan perilaku**: jsdom memuat versi satu-file dan versi berkas-per-menu dengan Supabase/fetch tiruan, memicu `boot()` sebagai admin,
  membuka setiap rute (termasuk memuat modul Sertifikat), lalu membandingkan isi `#view`/`#sertView` (dinormalkan) dan daftar galat: harus identik. (3) Pemuat malas Sertifikat diuji dengan `sertMuat` diganti pemuat dari disk.
- **Apps Script**: berkas `.gs` dijalankan di Node (`vm`) dengan layanan tiruan (`SpreadsheetApp` dalam memori, `CacheService`, `LockService`, `UrlFetchApp` untuk Supabase dan Google Drive, `Utilities`).
  `Code.gs`: admin lolos dengan satu permintaan ke `profiles` dan hasilnya di-cache, operator ditolak, 401 dilaporkan dengan alasan, kunci Supabase salah dilaporkan sebagai `CONFIG`, token cacat/kedaluwarsa ditolak tanpa memanggil Supabase, kunci skrip untuk aksi tulis.
  `Bast.gs`: impor (id dibawa, tidak menimpa), semua aturan nomor/porporasi/LAST_NUMBER, pegawai, pengaturan, dan arsip Drive (struktur folder, nama berkas, ganti arsip, validasi isi/ukuran).
- Pengujian versi satu-file (Jalin) yang masih relevan untuk bagian BOP:
- **SQL**: PostgreSQL 16 lokal + stub `auth` (`auth.users`, `auth.uid()` membaca `request.jwt.claim.sub`; peran `anon/authenticated/service_role`; hak bawaan skema `public` seperti Supabase).
  Jalankan `bop.sql` dua kali pada DB kosong, buat akun (trigger `handle_new_user`), lalu uji dengan `set role authenticated` + `set_config('request.jwt.claim.sub', uuid, false)`;
  bungkus tiap pernyataan dalam fungsi pembantu yang menangkap galat dan mencocokkan pesan. 111 pengecekan pada versi ini: anggaran 1 baris per tahun (gabung, 10 digit, tidak < RPD, operator hanya melihat KUA-nya, tanpa DELETE),
  RPD dan batasnya, SAKTI global (centang, Air ditolak, kembali ke MANUAL, satu sumber per bulan, periode depan, 10 digit), warisan POS SAKTI saat Realisasi ditolak diperbaiki, nominal dibayar (wajib, <= total, 10 digit, dikosongkan saat status lain),
  `akun_daftar`, dan `impor_baris` (lewati/timpa, tautan LPJ dilengkapi, penanda impor tidak bocor). Dijalankan pada pemasangan baru **dan** pada hasil upgrade dari skema lama.
  Upgrade: bangun DB dari `bop.sql` versi sebelumnya, isi data (anggaran per KUA, metode berversi termasuk versi masa depan, Realisasi SAKTI berstatus/tanggal, AutoPayment + penanda), jalankan `bop.sql` baru dua kali, lalu periksa data pindah dan kolom/objek lama hilang.
  Jalur pembatalan: Air bernominal (dibatalkan **sebelum mengubah apa pun**), arsip AutoPayment tanpa penanda dengan nominal (tabel dipertahankan).
- **Edge Function**: Node 22 menjalankan `index.ts` langsung (type stripping); ganti baris impor `npm:@supabase/supabase-js@2` dengan stub, tiru `Deno.serve/env`, Supabase (builder `select/eq/in/update/maybeSingle`), dan Google Drive (folder, pencarian + paginasi, unggah multipart, `appProperties`, unduhan publik).
  40 pengecekan: struktur folder, awalan bulan, batas file per bulan, isolasi bulan dan KUA (baca/hapus), `impor-lpj` (idempoten, HTML tidak tersimpan, > 20 MB, tautan tak dikenal), BAST NR.
- **Frontend**: jsdom dengan Supabase tiruan (builder rantai `eq/in/gt/range/upsert/update`, `rpc`), polyfill `showModal/close`, ukuran layout tiruan. **269 pengecekan** dalam enam berkas: dasar (8: aplikasi tampil tanpa galat, nama dan menu Impor, mengganti `CFG.nama` cukup di satu tempat), halaman (80: login username, `fmtIn` 10 digit, Anggaran/RPD/Realisasi/Verifikasi/Pengaturan SAKTI/Realisasi SAKTI/Laporan/statistik/Pengaturan), penampil dokumen (28; penunjuk halaman dibandingkan dengan **oracle geometri** yang membaca transform CSS asli: 1.680 posisi di 4 rotasi), Impor Data Lama (59: transformasi murni, lewati/timpa, hentikan, kegagalan, salin berkas), perbaikan terbaru (72: **regresi bentrok id** dengan membuka penampil dari detail Verifikasi, urut kolom, warna POS SAKTI dan ringkasan Manual/SAKTI, kunci `#lfile`, menu samping, panel rincian), dan jaring pengaman id (22: 20 rute tanpa id ganda + awalan `vw`). Catatan: jsdom tidak menghitung layout CSS, jadi aturan visual (gulir menu, tata letak panel) diperiksa lewat isi CSS dan struktur DOM, bukan piksel.
  penampil dokumen (penunjuk halaman dibandingkan dengan **oracle geometri** yang membaca transform CSS asli: 1.680 posisi di 4 rotasi), dan seluruh alur Impor Data Lama (transformasi murni, lewati/timpa, hentikan, kegagalan, salin berkas).
- **Ujung ke ujung (tanpa tiruan)**: biner rilis resmi PostgREST 12 dijalankan terhadap database hasil `bop.sql`, `auth.uid()` membaca klaim `request.jwt.claims` seperti di Supabase, JWT HS256 sungguhan untuk admin dan dua operator, dan **`@supabase/supabase-js` asli**
  (`fetch` hanya membuang awalan `/rest/v1`). 39 pengecekan: bentuk RPC jsonb (`anggaran_tahun` mengembalikan objek berisi angka), `set_anggaran` (void), `akun_daftar`, `impor_baris`, `upsert` dengan `onConflict` pada RPD/Realisasi/Pengaturan SAKTI/Realisasi SAKTI,
  RLS, pesan galat trigger sampai ke klien, dan warisan POS SAKTI lewat jalur `INSERT ... ON CONFLICT`. Buat ulang database dengan `drop database ... with (force)` pada tiap putaran (PostgREST menahan koneksi).
- **Semantik upsert di SQL**: 14 pengecekan tambahan (`INSERT ... ON CONFLICT DO UPDATE` seperti yang dikirim PostgREST; trigger BEFORE INSERT jalan lebih dulu pada baris yang sudah ada; satu pernyataan gagal = semua batal).
- **`bop.mjs`**: modul `@supabase/supabase-js` tiruan di `node_modules` lokal; 20 pengecekan (`akun`, `username` termasuk > 200 akun, bentrok email, idempoten).

## 12. Batasan yang diketahui / ide lanjutan
- RPD masih bisa diturunkan di bawah Realisasi yang sudah masuk (belum ada penjagaan sebaliknya); admin belum bisa menghapus RPD.
- Realisasi SAKTI tidak terisi otomatis: admin menginput nominal sebenarnya tiap bulan. Batas yang dijaga sama dengan Realisasi manual (total sebulan <= RPD bulan itu; per POS setahun <= RPD POS itu); belum ada batas per POS per bulan.
- Pengaturan SAKTI global: tidak ada riwayat kapan sebuah KUA mulai SAKTI. Bulan lama yang sudah berisi Realisasi manual tidak diubah; satu sumber per POS per bulan dijaga di Realisasi SAKTI.
- Nominal yang dibayarkan admin tidak memengaruhi batas RPD/anggaran (hanya dicatat dan dibatasi <= total Realisasi). Baris `paid` lama (sebelum fitur ini) tampil "nominal belum dicatat" sampai admin mengisinya.
- Impor data lama: file LPJ diunduh lewat tautan publik Google Drive. Bila berbagi "siapa saja dengan link" di Drive lama sudah dicabut, berkas gagal (dilaporkan, baris datanya tetap masuk tanpa tautan). Salin berkas berurutan (±3 detik per berkas), halaman harus tetap terbuka; aman diulang.
- Laporan dibuat di browser (cukup untuk 31 KUA). File LPJ milik akun Google yang menjalankan `bop.mjs drive`; refresh token tidak berlaku bila app Google masih *Testing* (7 hari) atau izin dicabut.
- Plan Free Supabase: project dijeda setelah ~1 minggu tanpa aktivitas, tanpa backup otomatis.
- Apps Script: tiap panggilan 1 sampai 3 detik (jaringan + Spreadsheet); halaman BAST memuat semua data dalam satu panggilan (`bastInit`). Kuota harian akun Google (UrlFetch dan waktu eksekusi) cukup untuk beberapa admin, bukan untuk penggunaan massal.
- Perubahan peran atau pencabutan sesi baru berlaku di Apps Script setelah cache pemeriksaan login habis (maksimal 5 menit). Peran admin dibaca dari tabel `profiles`.
- Spreadsheet adalah satu-satunya salinan data Sertifikat dan BAST NR: aktifkan riwayat versi, buat salinan berkala (lihat PANDUAN-INSTALASI.md bagian Cadangan). Arsip BAST NR di Drive tidak ikut terhapus saat Berita Acara dihapus.
- Kolom `Nip`, tanggal, dan porporasi di Spreadsheet berformat teks; jangan mengubah formatnya atau menyunting angka panjang langsung di sheet.
- Logo kop PDF BAST NR membaca `assets/logo-kemenag.png` (opsional). Dokumen Sertifikat membawa logonya sendiri di kodenya.


## 13. Glosarium
**KUA** Kantor Urusan Agama (satu per kecamatan) · **BOP** Biaya Operasional Perkantoran · **RPD** Rencana Penarikan Dana (per bulan) ·
**LPJ** Laporan Pertanggungjawaban (dokumen bukti) · **POS/akun** kode belanja (521111, 522111, ...) · **Rincian** turunan POS (mis. ATK Kantor) ·
**SAKTI** sistem keuangan pemerintah (pembayaran otomatis/autopayment: Listrik dan Telepon/Internet) · **Pengaturan SAKTI** ceklis global KUA + POS · **Realisasi SAKTI** nominal bulanan yang diinput admin ·
**Nominal dibayar** jumlah yang dibayarkan admin saat status Dibayar · **Username** nama login (`kua_<kecamatan>`) · **WIB** UTC+7.
**BAST NR** Berita Acara Serah Terima Sarana Administrasi (blanko/buku NR) · **Porporasi** nomor seri blanko yang diserahterimakan (rentang awal-akhir) · **Kasi Bimas** Kepala Seksi Bimas Islam ·
**Simas** Sistem Informasi Masjid (tanggal terbit sertifikat) · **Kiblat/azimut** arah kiblat dari titik masjid · **Kalibrasi** pengukuran ulang arah kiblat oleh Petugas Ukur · **GAS** Google Apps Script · **Web App** URL Apps Script yang dipanggil browser.

## 14. Modul Jaspro Transport (menu sidebar, khusus admin)
Alat "Laporan Nominatif PNBP NR" (Jasa Profesi dan Transport Penghulu), berjalan di browser. Tiga langkah: Input Laporan (.xlsx) -> Master Rekening -> Proses dan Unduh (Excel sheet JASPRO/TRANSPO, CSV Jaspro, CSV Transport).
- **Data**: tabel `jaspro_data` hanya punya **satu baris** (`id = 1`) berisi `master`, `laporan`, `settings` (jsonb). Setiap simpan menimpa data lama (upsert), tanpa riwayat/log/cron. Hanya admin (RLS). Trigger `jaspro_guard` membatasi bentuk dan ukuran (master <= 2000, laporan <= 5000 baris).
- **Kode**: `JX` (di `js/jaspro.js`) disalin apa adanya dari `jaspro.html` (pencocokan nama, klasifikasi golongan/PPh, pembuat workbook ExcelJS, CSV). `J`, `jp*`, `pageJaspro` = tampilan (gaya Sneat) dan penyimpanan. ExcelJS dimuat malas dari CDN (`CDN.exceljs`) saat dibutuhkan.
- Hasil "Cocokkan dan Pratinjau" (`J.rows`) dan suntingan manual di tabel tinjauan hanya di memori; yang tersimpan hanya master, laporan terakhir, dan pengaturan (debounce 0,8 detik).

## 15. Modul BAST NR (grup menu sidebar, khusus admin)
Berita Acara Serah Terima Sarana Administrasi NR. Halaman: Riwayat (ringkasan, filter, detail, arsip, status SIMKAH, PDF), Buat BA, Pegawai, Pengaturan BAST. Kode: `js/bast.js`; backend: `apps-script/Bast.gs`.
- **Data (Spreadsheet)**: `BastPegawai` (kunci `Nip`), `BastBA` (unik `NomorUrut`+`Tahun`; rincian pihak disimpan sebagai potret; `Id` numerik berurutan), `BastSetting` (Key/Value teks; `LAST_NUMBER`/`LAST_NUMBER_YEAR` dimajukan oleh `Bast.gs`). Judul kolom dan nama field didefinisikan di `BAST_DEF_`; frontend memakai nama field bergaya `snake_case`.
- **Aturan** (dijaga `Bast.gs` di bawah kunci skrip, pesan Indonesia): nomor urut unik per tahun, Pihak Pertama/Kedua dan Kasi wajib, porporasi wajib berpola `awal- akhir` dan **tidak tumpang-tindih** dengan BA lain, `LAST_NUMBER` hanya maju (reset saat tahun berganti), status SIMKAH `Sudah`/`Belum`.
- **Aksi Apps Script**: `bastInit` (pegawai + BA + pengaturan sekaligus), `bastSaveBA`, `bastStatus`, `bastDeleteBA`, `bastSavePegawai`, `bastDeletePegawai`, `bastSaveSetting`, `bastArsipUnggah`, `bastArsipFile`, `bastArsipHapus`, `bastImpor` (impor idempoten; tidak dipakai UI).
- **Arsip**: file diunggah sebagai base64 (maks. 5 MB; PDF/JPG/PNG dicek ekstensi + byte awal) ke `<folder master>/BAST NR/<tahun>/<MM Bulan>/BAST KUA <KUA> - <nnn>-<tahun>.<ext>`. Mengganti arsip memindahkan yang lama ke Sampah Drive; menghapus BA **tidak** menghapus arsipnya.
  Pratinjau: `bastArsipFile` mengembalikan base64, `bnArsipLoad` mengubahnya menjadi `Blob` untuk `openViewer`.
- **PDF**: dibuat di browser (jsPDF 2.5.1 + AutoTable via `loadJs`); kop surat mencoba `LOGO_BASE64`, lalu `assets/logo-kemenag.png`, lalu gambar+canvas; tanpa logo PDF tetap jadi.
- Riwayat: BAST NR semula Apps Script/Spreadsheet, sempat di Supabase, lalu kembali ke Spreadsheet (satu Spreadsheet dan satu proyek Apps Script bersama menu Sertifikat) untuk menghemat kuota Supabase. Supabase **tidak** menyimpan apa pun tentang BAST NR.

## 16. Modul Sertifikat (grup menu sidebar, khusus admin)
Menu: **Masjid / Musala** (data + cetak Piagam, Surat Keterangan, Surat Rekomendasi), **Arah Kiblat** (data pengukuran + cetak Sertifikat Kalibrasi, Data Verifikasi, Berita Acara), **Pengaturan Sertifikat**, **Status Apps Script** (uji sambungan). Dipindahkan dari proyek "portal sertifikat" (kode disalin apa adanya).
- **Data (Spreadsheet)**: `DataMasjid` (Masjid dan Musala dibedakan kolom `Jenis`), `DataKiblat` (satu baris = satu pengukuran: koordinat derajat-menit-detik, tanggal/jam kalibrasi, petugas, saksi), `Pengaturan` (baris 1-6 tetap: Kepala Kantor, Kasi Bimas, Petugas Ukur, tanda tangan PNG/JPEG sebagai data URL). Hanya **masukan** yang disimpan; azimut, tabel matahari, dan Hijriah dihitung di klien.
- **Aksi Apps Script**: `listMasjid/saveMasjid/deleteMasjid`, `listKiblat/saveKiblat/deleteKiblat`, `getPengaturan/savePengaturan`, `whoami`. Semuanya admin saja.
- **Frontend**: `sertifikat.js` memuat pustaka CDN, mesin PDF, dan `views/*.html`, lalu `sertifikat-masjid.js`, `arah-kiblat.js`, `pengaturan-sertifikat.js` berurutan (satu lingkup global; saling memakai: pemilih wilayah, dialog cetak, cache pengaturan). Modul memanggil `callApi(action, params)` yang diarahkan ke `gasRaw()`.
- **PDF 100% di browser** (jsPDF **4.2.1**, dikurung terpisah dari jsPDF 2.5.1 milik BOP/BAST: `window.jspdf` disimpan dan dikembalikan sehingga tidak saling menimpa). Mesin PDF berbentuk pabrik `buatDokumenGenerator(jspdf)` yang menerima jsPDF dari luar.
  Elemen tanda tangan dicetak literal (`${nomor_naskah}`, `${tanggal_naskah}`, `${ttd_pengirim}`, `${nama_pengirim}`) untuk diganti saat TTE. QR code dibuat lokal (qrcode-generator) berisi URL profil Simas.
- **Perhitungan**: arah kiblat = azimut busur lingkaran besar ke Ka'bah (21°25′22″ LU, 39°49′34″ BT) dengan `atan2`; posisi matahari mengikuti sheet Excel referensi; Hijriah = kalender sipil/tabular (bisa beda ±1 hari dari ketetapan Kemenag; kolom Hijriah dapat diubah manual).
- **Peta/GPS**: Leaflet (Satelit/Jalan/OSM); GPS butuh `https://` atau `localhost`. Titik di luar perkiraan Kabupaten Indramayu diberi peringatan.
- Daftar kecamatan/desa (`js/sertifikat-wilayah.js`, 31 kecamatan) dipakai dropdown berantai; nilai lama di luar daftar dipertahankan sebagai "(data lama)".

## 17. Backend Apps Script (`apps-script/`)
Satu proyek Apps Script **terikat** pada satu Spreadsheet (`SpreadsheetApp.getActiveSpreadsheet()`), dideploy sebagai Web App (**Execute as: Me, Who has access: Anyone**). Manifes `appsscript.json` mengunci izin: `spreadsheets`, `drive` (membaca folder master + arsip buatan Edge Function), `script.external_request`.
- **Konfigurasi di bagian paling atas `Code.gs`**: `SUPABASE_URL`, `SUPABASE_KEY` (publishable; sama dengan `js/config.js`), `DRIVE_MASTER_FOLDER_ID`.
- **Protokol**: POST dengan `Content-Type: text/plain` (menghindari preflight CORS) berisi JSON `{ "action": "...", "token": "<access token Supabase>", ... }`. Jawaban `{ success: true, ... }` atau `{ success: false, code, message }`; `code`: `AUTH`, `FORBIDDEN`, `CONFIG`, `SUPABASE`, `BUSY`, `BAD_REQUEST`, `UNKNOWN_ACTION`, `ERROR`.
  `GET` mengembalikan JSON status (versi, `deployedActions`, apakah konfigurasi Supabase terisi): cara cepat memastikan deployment aktif.
- **Login**: `periksaToken_` membaca isi JWT (`sub`, `exp`; keabsahan diperiksa Supabase), lalu **satu** permintaan `GET /rest/v1/profiles?select=nama,role&id=eq.<sub>` memakai token itu (jalur yang sama dengan BOP). 401 = sesi tidak sah (alasan Supabase ikut dilaporkan); 401 "Invalid API key" = `SUPABASE_KEY` salah (`CONFIG`).
  Hasil di-cache sebesar sisa umur token (maks. 5 menit); token ditolak di-cache 60 detik. Hanya `role = admin` yang lolos (`requireAdmin_`).
- **Router**: `actions_()` menggabungkan aksi dasar (`Code.gs`) dengan `bastActions_()` (`Bast.gs`) bila ada. Aksi `write: true` dijalankan di bawah `LockService` (tunggu maks. 20 detik; lewat = `BUSY`).
- **Setup**: `setupDatabase()` (aman diulang) membuat/menambah sheet dan kolom tanpa mengubah data; `authorizeAccess()` memicu izin dan mencatat akun Drive, keterjangkauan Supabase, dan folder master.
- **Deployment** tidak otomatis ikut kode: setiap perubahan butuh *Manage deployments > Edit > Version: New version*. Deployment lama tetap menjalankan versinya sendiri.
