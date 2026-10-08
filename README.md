# Jalin (Bimas Islam Kabupaten Indramayu): panduan untuk AI (baca ini dulu)

Dokumen ini dibuat agar AI (atau developer baru) cepat paham proyek ini tanpa membaca seluruh kode. Urutan baca yang disarankan:
`skills/readme.md` (ini) -> `bop.sql` (data + aturan) -> `supabase/functions/bop/index.ts` (server) -> `index.html` (tampilan) -> `PANDUAN-INSTALASI.md` (pemasangan).

## 1. Tujuan
Aplikasi web layanan 31 KUA (Kantor Urusan Agama) se-Kabupaten Indramayu. Modul utamanya **BOP** (Biaya Operasional Perkantoran), ditambah **Jaspro Transport** dan **BAST NR**.
Nama aplikasi **Jalin** (dari "menjalin": menghubungkan KUA dan Bimas Islam) dipakai di tiga tempat yang **harus sama**: `CFG.nama` di `index.html`, `APP_NAME` di `index.ts`, dan `APP_NAME` di `bop.mjs`
(nama folder master di Google Drive).

Alur BOP: admin menetapkan **Anggaran** tahunan per KUA -> operator KUA menyusun **RPD** (rencana penarikan dana) per bulan ->
operator mengisi **Realisasi** per bulan + unggah **LPJ** -> admin **memverifikasi** (status Dibayar wajib mencatat **nominal yang dibayarkan**) -> **Laporan** Excel/PDF.
Pembayaran lewat SAKTI (autopayment) hanya **Listrik dan Telepon/Internet**. Pengaturannya **global**: satu ceklis per KUA + POS di **Pengaturan SAKTI** (tanpa bulan/tahun berlaku).
POS yang dicentang tidak diisi operator: nominalnya diinput admin tiap bulan di **Realisasi SAKTI** dan dijumlahkan dengan Realisasi manual. Air adalah POS manual biasa.
Data dari sistem lama (Spreadsheet/Apps Script) dapat dibawa lewat menu **Impor Data Lama**, termasuk menyalin berkas LPJ ke struktur Google Drive baru.

## 2. Peta file (sengaja hanya satu file per jenis)
| File | Isi |
|---|---|
| `index.html` | Seluruh frontend (HTML+CSS+JS, tanpa build). Di-host GitHub Pages. |
| `bop.sql` | **Sumber kebenaran** skema database (idempotent). Tabel, fungsi, trigger, RLS, data awal (31 KUA, 11 POS, config). Aman dijalankan ulang; juga **mengonversi dan membersihkan struktur lama** (RPD/Realisasi per-POS, anggaran per KUA, SAKTI berversi, AutoPayment lama). Tidak ada file migrasi terpisah. |
| `supabase/functions/bop/index.ts` | **Satu** Edge Function (Deno). Aksi: `reset-password`, `upload`, `delete`, `list`, `file`, `impor-lpj`, `bast-upload`, `bast-file`, `bast-delete`. |
| `bop.mjs` | Skrip pemasangan sekali jalan (Node): `akun` (32 akun dengan username), `username` (ubah akun lama ke username), `drive` (token + folder master Google Drive), `bast` (impor BAST NR lama). |
| `PANDUAN-INSTALASI.md` | Panduan pemasangan dari nol dan prosedur upgrade untuk manusia. |

Tidak ada dependensi build. Library pihak ketiga dimuat dari CDN: Bootstrap 5 + Boxicons + supabase-js (awal), serta
SheetJS, jsPDF + AutoTable, pdf.js (hanya saat dibutuhkan, via `loadJs()`).

## 3. Arsitektur
```
Browser (index.html @ GitHub Pages)
  |-- supabase-js (kunci publishable) --> PostgREST + Auth (Supabase)   <- semua data lewat sini, dijaga RLS + trigger
  |-- fetch /functions/v1/bop?action=... (Bearer token login) --> Edge Function bop
  |                                                                |-- Supabase (service role, di server)
  |                                                                |-- Google Drive API (refresh token di Secrets)
  |-- fetch Web App Apps Script LAMA (hanya menu Impor Data Lama, hanya membaca)
Cloudflare Turnstile: captcha login (Site Key di index.html; Secret Key di pengaturan Auth Supabase)
```
Prinsip: **rahasia hanya di server** (Supabase Secrets / `.env` lokal). Browser hanya memegang URL, publishable key, Site Key.
**Aturan bisnis ditegakkan di database (trigger SECURITY DEFINER)**; UI hanya meniru agar pesannya cepat dan jelas.

**Login memakai username**, bukan email. Supabase Auth tetap membutuhkan email, jadi akun disimpan sebagai `<username>@<EMAIL_DOMAIN>`; pengguna tidak pernah mengetik domainnya
(`toEmail()` di `index.html` menambahkannya dari `CFG.domain`; email penuh yang diketik tetap diterima apa adanya). Operator: `kua_<kecamatan huruf kecil tanpa spasi>`, mis. `kua_anjatan`,
`kua_indramayu`, `kua_kedokanbunder`. `CFG.domain` (index.html) dan `EMAIL_DOMAIN` (.env untuk `bop.mjs`) harus sama.

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

## 5. Aturan bisnis (invariant) dan di mana ditegakkan
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

**Struktur Google Drive** (semua di bawah satu folder master = `DRIVE_ROOT_FOLDER_ID`, yang otomatis dinamai `APP_NAME` = Jalin):
```
Jalin / BOP / LPJ / <tahun> / Kecamatan <nama> / <MM Bulan> - <nama file>      contoh: 03 Maret - nota listrik.pdf
Jalin / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>
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
| BAST NR | baca/tulis (RLS `bast_*_admin`) | tidak ada akses |
| Reset password | operator mana pun (Edge `reset-password`) | ubah password sendiri |

## 7. Frontend (`index.html`)
Satu file; script inline di bawah. Peta kode:
- **Konfigurasi**: objek `CFG` (`nama`, `url`, `key`, `turnstile`, `domain`). Hanya ini yang perlu diisi per instalasi.
- **Auth**: login (username) + Turnstile; `toEmail()` menambahkan `@CFG.domain`; "Ingat saya" memakai adapter storage khusus (`localStorage` vs `sessionStorage`, kunci `bop.remember`/`bop.email`, yang disimpan = username); `boot()` memuat profil (`me.username` = bagian email sebelum `@`) lalu `route()`.
- **Routing**: hash (`#rpd`, `#realisasi`, ...). `pages` memetakan hash -> fungsi `pageXxx()`. Halaman admin-only: anggaran, verifikasi, metode, sakti, config, impor. `realisasi` khusus operator. Sidebar: menu **BOP** (details) berisi semua modul; **Pengaturan** di luar.
- **Helper**: `$` (getElementById), `esc` (WAJIB untuk teks pengguna di innerHTML), `note(teks, tipe)`, `rp()` (format 1.500.000), `num()`, `fmtIn()` (format saat mengetik, kursor tetap, **dipotong 10 digit**), `yearSel()`, `posLabel()` ("kode · nama"), `isum/sumT`, `ST` (status -> kelas badge + teks), `master()` (cache `kua`/`pos`/`config` di memori, `M`).
- **Server**: `api(query, opt)` memanggil `/functions/v1/bop`. `showDocs()` daftar dokumen (+hapus bila boleh).
- **Penampil dokumen**: `openViewer(files, idx, load)` dipakai di **semua menu** (Realisasi, Verifikasi, arsip BAST NR). `load(file)` mengembalikan `Response`; PDF/gambar dikenali dari `Content-Type`. Memakai dialog tersendiri `#vdlg` (dapat dibuka di atas dialog detail BAST). pdf.js; zoom Ctrl+scroll/pinch/tombol, geser, putar, posisi dijepit; **penunjuk halaman** "Halaman X dari N" = halaman dengan area tampak terbesar, dihitung di ruang dokumen sehingga benar di semua rotasi (`pageInd`).
- **Halaman**: pola "daftar dulu, tombol Detail membuka rincian" (RPD, Realisasi, Verifikasi) dengan fungsi `list()` dan `detail()` lokal; kalkulasi real-time di `calc()` yang menirukan trigger.
- **Laporan**: `buildReport()` (data JSON + Realisasi SAKTI), `buildSakti()` (rekap RPD vs Realisasi SAKTI/Manual/Total/Sisa dengan filter POS dan metode; metode = ceklis global), `toXlsx()`, `toPdf()`; pustaka dimuat malas lewat `loadJs()`; `fetchAll()` memecah halaman 1000 baris.
- **Komponen**: `multiSelect()` (select multiple bergaya chip tanpa library, dipakai di Config), `pwPair()` (dua kolom password + tombol mata).
- **SAKTI**: `pageMetode` (matriks KUA x 2 POS berisi ceklis; "centang semua" per kolom; hanya baris berubah yang dikirim), `pageSakti` (matriks yang sama dengan kolom nominal per bulan; sel KUA yang tidak dicentang terkunci; total kolom), `bopStat` (statistik beranda admin: "Belum diinput bulan ini"). Helper `metodeOf`, `saktiOf`, `saktiYear`, `SAKTI_POS`. Realisasi operator menampilkan POS SAKTI read-only dengan keterangan "Sudah dibayar SAKTI" / "Belum dibayar SAKTI".
- **Impor Data Lama**: `pageImpor` (form + pratinjau + eksekusi + hasil), `legacyFetch` (membaca Apps Script lama dengan `fetch` POST tanpa header, seperti `apiCall` lama), `legacyPlan(raw, m, opt)` (**murni**: ubah data lama menjadi baris Jalin; memetakan nama KUA dan rincian POS, membuang yang tidak dipakai), `legacyCall`. Urutan tulis: anggaran -> metode -> RPD -> Realisasi (+ salin berkas satu per satu lewat Edge `impor-lpj`) -> Realisasi SAKTI.
- **Halaman basi**: `EP` naik tiap pindah menu; tiap halaman async mengambil `const ep = EP` dan memeriksa `live(ep)` sesudah setiap `await` sebelum menyentuh DOM. Ini mencegah `TypeError: Cannot set properties of null` saat pengguna pindah menu ketika data masih dimuat.
Konvensi: teks UI dan komentar berbahasa Indonesia; tanpa `localStorage` untuk data bisnis (kecuali kenyamanan: ingat login, alamat sistem lama); tidak ada log aktivitas; query hanya kolom yang perlu.

## 8. Edge Function (`supabase/functions/bop/index.ts`)
`GET/POST /functions/v1/bop?action=<aksi>` dengan `Authorization: Bearer <token login>`. Dideploy dengan `--no-verify-jwt` karena fungsi memverifikasi
token (`auth.getUser`) dan peran dari tabel `profiles` sendiri (klien tidak dipercaya). CORS `*` (tanpa cookie).
Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_ROOT_FOLDER_ID` (dibuat `node bop.mjs drive`).
Scope Google `drive.file`: hanya folder/file buatan aplikasi, jadi root harus dibuat oleh `bop.mjs drive`. Sengaja **tanpa `console.*`** (hemat kuota log Supabase free).
- Pembantu Drive tingkat atas: `masterFolder()` (menamai folder master `APP_NAME` sekali per instance, kosmetik), `driveList()` (paginasi), `drivePath()` (folder bertingkat, dibuat bila perlu), `driveUpload()`, `lpjFolder()`.
- `impor-lpj` (admin, POST JSON `{kua, tahun, bulan, url, nama}`): menyalin **satu** file LPJ lama ke `BOP/LPJ/<tahun>/Kecamatan <nama>`. File lama dibagikan "siapa saja dengan link", jadi diunduh lewat tautan unduhan publik Google Drive (mengikuti pengalihan; `resourcekey` ikut bila ada di tautan) dan isinya dicek dari byte awal (halaman HTML "akses ditolak" tidak pernah tersimpan). Maks. 20 MB. **Idempoten**: file yang sudah disalin ditandai `appProperties.lama = <ID file lama>` dan tidak digandakan. Tidak memakai scope di luar `drive.file`.

## 9. Konvensi dan pantangan
- **Jangan** menaruh rahasia (service role/secret key, Google client secret/refresh token, Turnstile secret) di `index.html` atau repo.
- Perubahan database harus **idempotent** (`create ... if not exists`, `create or replace`, `drop ... if exists`). Jangan `drop table` data aktif tanpa pengaman: konversi struktur lama memakai pola *ganti nama menjadi `_lama` -> salin -> verifikasi -> hapus*, dan **dibatalkan** bila ada data yang belum sama (lihat bagian 11 dan 0a di `bop.sql`).
- **Satu file per jenis**: ubah `bop.sql` / `bop/index.ts` / `bop.mjs` langsung; jangan memecahnya lagi atau membuat file migrasi terpisah (upgrade = jalankan ulang `bop.sql`).
- Aturan baru ditulis di **trigger lebih dulu**, lalu cerminkan di UI (`calc()`, tombol) dan, bila menyangkut dokumen, di Edge Function.
- Hindari tabel log/audit dan cron (hemat kuota free plan). Jejak audit cukup `updated_by/at`, `submitted_*`, `verified_*`, `paid_at`.
- Zona waktu aturan = WIB (`Asia/Jakarta`) di server. Pesan error berbahasa Indonesia dan menyebut angka (batas, terpakai, dimasukkan, kelebihan).
- Jangan menyimpan data turunan yang bisa dihitung (mis. `total` boleh karena dijaga trigger; Realisasi SAKTI disimpan per bulan karena nominalnya nyata dan berubah tiap bulan, bukan turunan).
- Halaman yang memuat data async wajib memakai `ep`/`live(ep)` (lihat bagian 7); hasil `await` dari halaman lama tidak boleh menulis ke layar baru.
- Impor data lama membawa **hanya yang dipakai Jalin**. Jangan menambah bidang ke impor kecuali skema Jalin memakainya (akun/password lama, kuota API, ID, Total, metadata file, riwayat sengaja tidak dibawa).

## 10. Jika mengubah X, ubah juga Y
| Perubahan | Sinkronkan |
|---|---|
| Nama aplikasi | `CFG.nama` di `index.html` (judul tab, logo, dan teks halaman mengikuti otomatis), `APP_NAME` di `index.ts` dan `bop.mjs`, judul dokumen ini dan `PANDUAN-INSTALASI.md`; folder master Drive dinamai ulang otomatis oleh Edge Function |
| Menambah/mengubah POS | seed `pos` di `bop.sql`; cek `pos_sakti_ok` (SQL) dan `SAKTI_POS` (JS) bila POS boleh SAKTI; UI otomatis mengikuti `pos` (cache `master()`); pemetaan impor memakai `kode_pos` + `nama_rincian` |
| Aturan validasi Realisasi/RPD | trigger di `bop.sql` **dan** `calc()` di `pageRealisasi`/`pageRpd` |
| Batas digit nominal | `nominal_max()` di `bop.sql` **dan** `MAXD` di `index.html` (serta teks pesan "10 digit") |
| Kunci config baru | seed `config` di `bop.sql`, `pageConfig`, dan tempat yang membacanya (`m.cfg.<kunci>`, Edge Function bila relevan) |
| Aksi server baru | `bop/index.ts` (daftar aksi + metode di `Deno.serve`), lalu panggil lewat `api()` |
| Struktur folder Drive | `lpjFolder()`/`awalan()` dan `bastArsip()` di `index.ts`, bagian "Struktur Google Drive" di dokumen ini dan `PANDUAN-INSTALASI.md` |
| Format username | `usernameKua()` di `bop.mjs` (dan perintah `username` untuk akun yang sudah ada), `toEmail()`/`CFG.domain` di `index.html` |
| Kolom baru di `items`/tabel | `bop.sql` (DDL idempotent), `buildReport`, halaman terkait, `legacyPlan`/`impor_baris` bila ikut diimpor |
| Mengubah alat Jaspro Transport | `bop.sql` bagian 12 **dan** blok `Jaspro Transport` di `index.html` (`JX` = logika hitung/ekspor asli, `J*`/`jp*` = tampilan + simpan) |
| Mengubah BAST NR | `bop.sql` bagian 13, blok `BAST NR` di `index.html` (`BX` = kode lama script.js/pdf.js, `B`/`bn*`/`bb*`/`bp*` = tampilan), aksi `bast-*` di `bop/index.ts`, perintah `bast` di `bop.mjs` |
| Nama function/secret berubah | `PANDUAN-INSTALASI.md`, `bop.mjs` (teks cetak), pesan error di `api()` |
| Aturan SAKTI | `metode_guard`/`realisasi_sakti_guard`/`realisasi_guard` di `bop.sql`; `metodeOf`/`saktiOf`/`saktiYear` serta `calc()` di `index.html`; `buildSakti` bila laporan terpengaruh; `legacyPlan` bila pemetaan Auto Payment berubah |
| Bentuk data sistem lama berubah | `legacyFetch`/`legacyPlan` (satu-satunya tempat yang mengenal bentuk Apps Script lama) |

## 11. Cara memverifikasi (pengujian tidak disertakan sebagai file; cara menyusunnya)
- **SQL**: PostgreSQL 16 lokal + stub `auth` (`auth.users`, `auth.uid()` membaca `request.jwt.claim.sub`; peran `anon/authenticated/service_role`; hak bawaan skema `public` seperti Supabase).
  Jalankan `bop.sql` dua kali pada DB kosong, buat akun (trigger `handle_new_user`), lalu uji dengan `set role authenticated` + `set_config('request.jwt.claim.sub', uuid, false)`;
  bungkus tiap pernyataan dalam fungsi pembantu yang menangkap galat dan mencocokkan pesan. 111 pengecekan pada versi ini: anggaran 1 baris per tahun (gabung, 10 digit, tidak < RPD, operator hanya melihat KUA-nya, tanpa DELETE),
  RPD dan batasnya, SAKTI global (centang, Air ditolak, kembali ke MANUAL, satu sumber per bulan, periode depan, 10 digit), warisan POS SAKTI saat Realisasi ditolak diperbaiki, nominal dibayar (wajib, <= total, 10 digit, dikosongkan saat status lain),
  `akun_daftar`, dan `impor_baris` (lewati/timpa, tautan LPJ dilengkapi, penanda impor tidak bocor). Dijalankan pada pemasangan baru **dan** pada hasil upgrade dari skema lama.
  Upgrade: bangun DB dari `bop.sql` versi sebelumnya, isi data (anggaran per KUA, metode berversi termasuk versi masa depan, Realisasi SAKTI berstatus/tanggal, AutoPayment + penanda), jalankan `bop.sql` baru dua kali, lalu periksa data pindah dan kolom/objek lama hilang.
  Jalur pembatalan: Air bernominal (dibatalkan **sebelum mengubah apa pun**), arsip AutoPayment tanpa penanda dengan nominal (tabel dipertahankan).
- **Edge Function**: Node 22 menjalankan `index.ts` langsung (type stripping); ganti baris impor `npm:@supabase/supabase-js@2` dengan stub, tiru `Deno.serve/env`, Supabase (builder `select/eq/in/update/maybeSingle`), dan Google Drive (folder, pencarian + paginasi, unggah multipart, `appProperties`, unduhan publik).
  40 pengecekan: struktur folder, awalan bulan, batas file per bulan, isolasi bulan dan KUA (baca/hapus), `impor-lpj` (idempoten, HTML tidak tersimpan, > 20 MB, tautan tak dikenal), BAST NR.
- **Frontend**: jsdom dengan Supabase tiruan (builder rantai `eq/in/gt/range/upsert/update`, `rpc`), polyfill `showModal/close`, ukuran layout tiruan. 167 pengecekan: login username, `fmtIn` 10 digit, Anggaran/RPD/Realisasi/Verifikasi/Pengaturan SAKTI/Realisasi SAKTI/Laporan/statistik/Pengaturan,
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

## 13. Glosarium
**KUA** Kantor Urusan Agama (satu per kecamatan) · **BOP** Biaya Operasional Perkantoran · **RPD** Rencana Penarikan Dana (per bulan) ·
**LPJ** Laporan Pertanggungjawaban (dokumen bukti) · **POS/akun** kode belanja (521111, 522111, ...) · **Rincian** turunan POS (mis. ATK Kantor) ·
**SAKTI** sistem keuangan pemerintah (pembayaran otomatis/autopayment: Listrik dan Telepon/Internet) · **Pengaturan SAKTI** ceklis global KUA + POS · **Realisasi SAKTI** nominal bulanan yang diinput admin ·
**Nominal dibayar** jumlah yang dibayarkan admin saat status Dibayar · **Username** nama login (`kua_<kecamatan>`) · **WIB** UTC+7.

## 14. Modul Jaspro Transport (menu sidebar, khusus admin)
Alat "Laporan Nominatif PNBP NR" (Jasa Profesi dan Transport Penghulu), berjalan di browser. Tiga langkah: Input Laporan (.xlsx) -> Master Rekening -> Proses dan Unduh (Excel sheet JASPRO/TRANSPO, CSV Jaspro, CSV Transport).
- **Data**: tabel `jaspro_data` hanya punya **satu baris** (`id = 1`) berisi `master`, `laporan`, `settings` (jsonb). Setiap simpan menimpa data lama (upsert), tanpa riwayat/log/cron. Hanya admin (RLS). Trigger `jaspro_guard` membatasi bentuk dan ukuran (master <= 2000, laporan <= 5000 baris).
- **Kode**: `JX` (di dalam `index.html`) disalin apa adanya dari `jaspro.html` (pencocokan nama, klasifikasi golongan/PPh, pembuat workbook ExcelJS, CSV). `J`, `jp*`, `pageJaspro` = tampilan (gaya Sneat) dan penyimpanan. ExcelJS dimuat malas dari CDN (`CDN.exceljs`) saat dibutuhkan.
- Hasil "Cocokkan dan Pratinjau" (`J.rows`) dan suntingan manual di tabel tinjauan hanya di memori; yang tersimpan hanya master, laporan terakhir, dan pengaturan (debounce 0,8 detik).

## 15. Modul BAST NR (grup menu sidebar, khusus admin)
Berita Acara Serah Terima Sarana Administrasi NR, pindahan dari Apps Script/Spreadsheet. Halaman: Riwayat (ringkasan, filter, detail, arsip, status SIMKAH, PDF), Buat BA, Pegawai, Pengaturan BAST.
- **Data**: `bast_pegawai` (PK `nip`), `bast_ba` (unik `nomor_urut`+`tahun`; rincian pihak disimpan sebagai potret seperti sheet Master lama), `bast_setting` (key/value teks; `LAST_NUMBER`/`LAST_NUMBER_YEAR` dimajukan trigger). Trigger `bast_ba_guard` menjaga nomor ganda, porporasi tumpang-tindih, pihak/Kasi wajib. Jalur tanpa `auth.uid()` (skrip migrasi, SQL Editor) tidak diperiksa.
- **Migrasi**: `node --env-file=.env bop.mjs bast` membaca Web App lama lewat aksi GET dan memasukkan data ke tabel di atas (aman diulang, tidak menimpa). Arsip lama hanya menjadi `arsip_link` (tautan Drive); arsip yang diunggah lewat aplikasi punya `arsip_id` dan bisa dipratinjau/diganti/dihapus.
- **Arsip**: Edge Function `bop` aksi `bast-upload`/`bast-file`/`bast-delete` (admin). Folder Drive: `<master> / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>`. Pratinjau arsip memakai penampil dokumen yang sama dengan menu BOP.