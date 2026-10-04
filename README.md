# BOP KUA Kabupaten Indramayu: panduan untuk AI (baca ini dulu)

Dokumen ini dibuat agar AI (atau developer baru) cepat paham proyek ini tanpa membaca seluruh kode. Urutan baca yang disarankan:
`skills/readme.md` (ini) -> `bop.sql` (data + aturan) -> `supabase/functions/bop/index.ts` (server) -> `index.html` (tampilan) -> `PANDUAN-INSTALASI.md` (pemasangan).

## 1. Tujuan
Aplikasi web pengelolaan **Biaya Operasional Perkantoran (BOP)** 31 KUA (Kantor Urusan Agama) se-Kabupaten Indramayu.
Alur: admin menetapkan **Anggaran** tahunan per KUA -> operator KUA menyusun **RPD** (rencana penarikan dana) per bulan ->
operator mengisi **Realisasi** per bulan + unggah **LPJ** -> admin **memverifikasi** -> **Laporan** Excel/PDF.
Pembayaran lewat SAKTI (listrik, telepon/internet, air) diatur per KUA + POS lewat **metode pembayaran** MANUAL atau SAKTI. POS bermetode SAKTI tidak diisi operator:
realisasinya diinput admin sebagai **Realisasi SAKTI** dan dijumlahkan dengan Realisasi manual (menggantikan AutoPayment nominal tetap yang lama).

## 2. Peta file (sengaja hanya satu file per jenis)
| File | Isi |
|---|---|
| `index.html` | Seluruh frontend (HTML+CSS+JS, tanpa build). Di-host GitHub Pages. |
| `bop.sql` | **Sumber kebenaran** skema database (idempotent). Tabel, fungsi, trigger, RLS, data awal (31 KUA, 11 POS, config), termasuk modul SAKTI (bagian 9b). Aman dijalankan ulang; juga mengonversi/membersihkan struktur lama. |
| `migration-sakti.sql` | Hanya untuk database yang **sudah berjalan**: salinan mandiri bagian 9 (`realisasi_guard`) dan 9b (SAKTI) dari `bop.sql`, tanpa menjalankan ulang seluruh skema. Bila berbeda dengan `bop.sql`, ubah keduanya. |
| `supabase/functions/bop/index.ts` | **Satu** Edge Function (Deno). Aksi: `reset-password`, `upload`, `delete`, `list`, `file`. |
| `bop.mjs` | Skrip pemasangan sekali jalan (Node): `akun` (buat 32 akun) dan `drive` (token + folder Google Drive). |
| `PANDUAN-INSTALASI.md` | Panduan pemasangan dari nol untuk manusia. |

Tidak ada dependensi build. Library pihak ketiga dimuat dari CDN: Bootstrap 5 + Boxicons + supabase-js (awal), serta
SheetJS, jsPDF + AutoTable, pdf.js (hanya saat dibutuhkan, via `loadJs()`).

## 3. Arsitektur
```
Browser (index.html @ GitHub Pages)
  |-- supabase-js (kunci publishable) --> PostgREST + Auth (Supabase)   <- semua data lewat sini, dijaga RLS + trigger
  |-- fetch /functions/v1/bop?action=... (Bearer token login) --> Edge Function bop
                                                                   |-- Supabase (service role, di server)
                                                                   |-- Google Drive API (refresh token di Secrets)
Cloudflare Turnstile: captcha login (Site Key di index.html; Secret Key di pengaturan Auth Supabase)
```
Prinsip: **rahasia hanya di server** (Supabase Secrets / `.env` lokal). Browser hanya memegang URL, publishable key, Site Key.
**Aturan bisnis ditegakkan di database (trigger SECURITY DEFINER)**; UI hanya meniru agar pesannya cepat dan jelas.

## 4. Model data (lihat `bop.sql`)
| Tabel | Kunci/kolom penting |
|---|---|
| `profiles` | `id` (=auth.users.id), `nama`, `kua` (teks), `kua_id`, `role` (`admin`/`operator`). Dibuat otomatis oleh trigger `handle_new_user` dari `user_metadata`. Klien tidak bisa menulis. |
| `kua` | 31 baris. `nama_kua` berpola `KUA Kec. <Kecamatan>`. |
| `pos` | 11 baris = 11 **unit input**: rincian bila ada (ATK Kantor, Jamuan Tamu, Pramubakti, Alat Rumah Tangga, Penggandaan/Penjilidan, Spanduk) atau kode POS itu sendiri (522111 Listrik, 522112 Telepon/Internet, 522113 Air, 523111 Pemeliharaan Gedung, 523121 Pemeliharaan Peralatan). `kode_pos` = **kode akun**, selalu ditampilkan di UI. |
| `config` | Pasangan `key`/`value` (jsonb): `rpd_enabled`, `realisasi_enabled`, `max_file_size_mb`, `max_file_count`, `bulan_edit_rpd` (array bulan). (`wajib_lpj` tidak dipakai: LPJ selalu wajib.) |
| `anggaran` | `(kua_id, tahun)` unik, `nominal_total`. |
| `rpd` | **1 record = 1 KUA x 1 bulan**: `(kua_id, tahun, bulan)` unik, `items` jsonb, `total`. |
| `realisasi` | **1 record = 1 KUA x 1 bulan**: sama seperti RPD + `status`, `file_lpj_url`, `catatan_admin`, `submitted_*`, `verified_*`, `paid_at`. |
| `metode_pembayaran` | Metode per KUA + POS: `(kua_id, pos_id, mulai)` kunci utama, `metode` (`MANUAL`/`SAKTI`), audit `created_*`/`updated_*`. Hanya POS 522111/522112/522113. Berversi per bulan berlaku. |
| `realisasi_sakti` | **1 record = 1 KUA x 1 POS x 1 bulan** (unik): `nominal`, `status_bayar` (`BELUM_DIBAYAR`/`SUDAH_DIBAYAR`), `tanggal_bayar`, `sumber` (selalu `SAKTI`), `catatan`, audit. Hanya admin yang menulis. |
| `autopayment_pos` | **ARSIP** (tidak dipakai validasi lagi): AutoPayment lama, sudah dimigrasikan sekali ke SAKTI. `(kua_id, pos_id, mulai)`, `nominal`, `sampai`. |

Bentuk `items`: `{"<pos.id>": nominal}`, kunci = id POS sebagai string, nilai bilangan bulat rupiah > 0 (nol dibuang). Contoh:
`{"1": 1500000, "7": 300000}`. `total` dihitung trigger (`items_total`), jangan diisi manual.
Semua uang = bilangan bulat rupiah (bigint), tanpa desimal. Bulan = 1..12.

**Pembayaran SAKTI** (hanya POS 522111 Listrik, 522112 Telepon/Internet, 522113 Air). Metode suatu bulan = versi `metode_pembayaran` terbaru dengan `mulai` <= bulan itu;
belum diatur = MANUAL (SQL `metode_pos`, JS `metodeOf`). Mengganti metode hanya mengubah bulan sejak berlaku sehingga riwayat tidak berubah, dan ditolak bila bertabrakan dengan data
yang sudah ada (MANUAL->SAKTI bila ada Realisasi manual POS itu; SAKTI->MANUAL bila ada Realisasi SAKTI bernominal). `realisasi_sakti` menyimpan nominal nyata per bulan
(`BELUM_DIBAYAR` wajib Rp 0 tanpa tanggal; `SUDAH_DIBAYAR` wajib `tanggal_bayar`). Jumlah SAKTI sebulan/setahun (SQL `sakti_items`/`sakti_year`, JS `saktiOf`/`saktiYear`)
dijumlahkan dengan Realisasi manual pada validasi dan laporan. Tidak ada DELETE untuk siapa pun (koreksi: UPDATE ke Belum dibayar). `created_by/updated_by/sumber` diisi server.
Penanda `config.sakti_migrasi_autopayment` = migrasi sekali dari AutoPayment lama sudah dijalankan (angka bulan-bulan lalu tetap sama).

## 5. Aturan bisnis (invariant) dan di mana ditegakkan
| # | Aturan | Server | UI |
|---|---|---|---|
| 1 | Total RPD setahun <= Anggaran Tahunan; tanpa anggaran RPD ditolak | trigger `rpd_guard` | `pageRpd` |
| 2 | Anggaran tidak boleh < total RPD yang sudah ada | trigger `anggaran_guard` | pesan error |
| 3 | Operator mengedit RPD hanya jika `rpd_enabled` dan bulan ada di `bulan_edit_rpd`; admin bebas | RLS `rpd_write` + `rpd_open()` | tombol terkunci |
| 4 | Realisasi boleh dikirim mulai tanggal 10 bulan tersebut (WIB) | `realisasi_guard` | `okDate` |
| 5 | Total Realisasi sebulan (manual + SAKTI) <= RPD bulan itu | `realisasi_guard`, `realisasi_sakti_guard` | `calc()` |
| 6 | Realisasi satu POS setahun (bulan lain + SAKTI + ini) <= RPD POS itu setahun | `realisasi_guard`, `realisasi_sakti_guard` | `calc()` |
| 7 | POS bermetode SAKTI pada bulan itu tidak boleh diisi operator (diisi admin lewat `realisasi_sakti`) | `realisasi_guard` (`metode_pos`) | input disabled + badge SAKTI |
| 8 | LPJ wajib: `total > 0` mensyaratkan `file_lpj_url` | `realisasi_guard` | cek jumlah dokumen |
| 9 | Operator hanya boleh **membuat** (belum ada) atau **memperbaiki yang berstatus `rejected`**. Setelah dikirim jadi `waiting` dan terkunci (nominal + dokumen). `approved`/`paid` juga terkunci | `realisasi_guard` + Edge `upload`/`delete` | `edit` flag |
| 10 | Admin boleh mengubah status ke status apa pun kapan pun; `rejected` wajib `catatan_admin`. Admin **tidak** boleh mengubah `items/total/file_lpj_url/kua/tahun/bulan` | `realisasi_guard` | `pageVerifikasi` |
| 11 | Operator hanya menyentuh KUA-nya (dicek lebih dulu agar pesan error tidak membocorkan data KUA lain) | `my_kua()` di guard + RLS | - |
| 12 | Metode SAKTI hanya POS 522111/522112/522113 | `metode_guard`, `realisasi_sakti_guard` (`pos_sakti_ok`) | kolom tetap 3 |
| 13 | Dokumen LPJ: PDF/JPG/PNG (ekstensi + magic bytes), ukuran/jumlah dari `config`, hanya operator KUA itu, hanya saat belum dikirim atau `rejected`; hapus = pindah ke Sampah Drive | Edge `bop` | `pageRealisasi` |
| 14 | Pratinjau/daftar dokumen hanya untuk admin atau operator KUA tersebut; `id` file harus berada di folder bulan itu | Edge `bop` (`list`/`file`) | viewer |
| 15 | Metode pembayaran: hanya admin; belum diatur = MANUAL; berlaku per bulan; operator hanya membaca KUA-nya | `metode_guard` + RLS `mp_*` | `pageMetode` |
| 16 | Ganti metode ditolak bila bertabrakan dengan data bulan terdampak (lihat bagian 4) | `metode_guard` | pesan error |
| 17 | Realisasi SAKTI: hanya admin; POS harus SAKTI pada bulan itu; periode sudah berjalan (WIB); Belum dibayar = Rp 0 tanpa tanggal; Sudah dibayar wajib tanggal <= hari ini; unik per KUA+POS+bulan; kunci baris tidak bisa diubah | `realisasi_sakti_guard`, unique, RLS `rs_*` | `pageSakti` |
| 18 | Tanpa DELETE untuk metode dan Realisasi SAKTI (admin pun tidak) | `revoke delete, truncate` + tanpa policy delete | - |
| 19 | Identitas pengubah (`created_by/updated_by`) dan `sumber` diisi server dari `auth.uid()`, bukan dari klien | trigger guard | - |

Status: `waiting` (Menunggu verifikasi), `approved` (Disetujui), `rejected` (Ditolak), `paid` (Dibayar).
Struktur Drive: `DRIVE_ROOT_FOLDER_ID / <tahun> / <nama KUA> / Realisasi / <MM Bulan> / file`. `file_lpj_url` = link folder bulan itu (penanda "LPJ ada"; folder privat).

## 6. Hak akses
| | Admin | Operator |
|---|---|---|
| Anggaran | tulis semua KUA | baca KUA sendiri |
| RPD | tulis/baca semua KUA (filter Semua Kecamatan) | tulis/baca KUA sendiri, hanya bulan yang dibuka |
| Realisasi | baca semua; ubah **status** saja | buat/perbaiki (lihat aturan 9) KUA sendiri |
| Pengaturan SAKTI, Realisasi SAKTI, Config | tulis | tidak ada akses tulis (operator hanya membaca metode dan Realisasi SAKTI KUA-nya; Config: konfigurasi umum) |
| Reset password | operator mana pun (Edge `reset-password`) | ubah password sendiri |

## 7. Frontend (`index.html`)
Satu file; script inline di bawah. Peta kode:
- **Konfigurasi**: objek `CFG` (`url`, `key`, `turnstile`). Hanya ini yang perlu diisi per instalasi.
- **Auth**: login + Turnstile; "Ingat saya" memakai adapter storage khusus (`localStorage` vs `sessionStorage`, kunci `bop.remember`/`bop.email`); `boot()` memuat profil lalu `route()`.
- **Routing**: hash (`#rpd`, `#realisasi`, ...). `pages` memetakan hash -> fungsi `pageXxx()`. Halaman admin-only: anggaran, verifikasi, metode, sakti, config. `realisasi` khusus operator. Sidebar: menu **BOP** (details) berisi semua modul; **Pengaturan** di luar.
- **Helper**: `$` (getElementById), `esc` (WAJIB untuk teks pengguna di innerHTML), `note(teks, tipe)`, `rp()` (format 1.500.000), `num()`, `fmtIn()` (format saat mengetik, kursor tetap), `yearSel()`, `posLabel()` ("kode · nama"), `isum/sumT`, `ST` (status -> kelas badge + teks), `master()` (cache `kua`/`pos`/`config` di memori, `M`).
- **Server**: `api(query, opt)` memanggil `/functions/v1/bop`. `showDocs()` daftar dokumen (+hapus bila boleh), `openViewer()` pratinjau (pdf.js; zoom Ctrl+scroll/pinch/tombol, geser, putar, posisi dijepit agar dokumen tak hilang).
- **Halaman**: pola "daftar dulu, tombol Detail membuka rincian" (RPD, Realisasi, Verifikasi) dengan fungsi `list()` dan `detail()` lokal; kalkulasi real-time di `calc()` yang menirukan trigger.
- **Laporan**: `buildReport()` (data JSON + Realisasi SAKTI), `buildSakti()` (rekap RPD vs Realisasi SAKTI/Manual/Total/Sisa dengan filter POS, metode, status pembayaran; filter berlaku per sel KUA+POS+bulan), `toXlsx()`, `toPdf()`; pustaka dimuat malas lewat `loadJs()`; `fetchAll()` memecah halaman 1000 baris.
- **Komponen**: `multiSelect()` (select multiple bergaya chip tanpa library, dipakai di Config), `pwPair()` (dua kolom password + tombol mata).
- **SAKTI**: `pageMetode` (matriks KUA x 3 POS, berlaku mulai bulan terpilih), `pageSakti` (grid input per bulan: status, nominal, tanggal, keterangan; hanya baris berubah yang dikirim, satu transaksi), `bopStat` (statistik beranda admin). Helper `metodeOf`, `saktiOf`, `saktiYear`, `SAKTI_POS`, `SB`. Halaman Realisasi operator menampilkan POS SAKTI read-only (badge, status, tanggal).
- **Halaman basi**: `EP` naik tiap pindah menu; tiap halaman async mengambil `const ep = EP` dan memeriksa `live(ep)` sesudah setiap `await` sebelum menyentuh DOM. Ini mencegah `TypeError: Cannot set properties of null` saat pengguna pindah menu ketika data masih dimuat.
Konvensi: teks UI dan komentar berbahasa Indonesia; tanpa `localStorage` untuk data bisnis; tidak ada log aktivitas; query hanya kolom yang perlu.

## 8. Edge Function (`supabase/functions/bop/index.ts`)
`GET/POST /functions/v1/bop?action=<aksi>` dengan `Authorization: Bearer <token login>`. Dideploy dengan `--no-verify-jwt` karena fungsi memverifikasi
token (`auth.getUser`) dan peran dari tabel `profiles` sendiri (klien tidak dipercaya). CORS `*` (tanpa cookie).
Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_ROOT_FOLDER_ID` (dibuat `node bop.mjs drive`).
Scope Google `drive.file`: hanya folder/file buatan aplikasi, jadi root harus dibuat oleh `bop.mjs drive`. Sengaja **tanpa `console.*`** (hemat kuota log Supabase free).

## 9. Konvensi dan pantangan
- **Jangan** menaruh rahasia (service role/secret key, Google client secret/refresh token, Turnstile secret) di `index.html` atau repo.
- Perubahan database harus **non-destruktif dan idempotent** (`create ... if not exists`, `create or replace`, `drop ... if exists`). Jangan `drop table` data aktif.
- **Satu file per jenis**: ubah `bop.sql` / `bop/index.ts` / `bop.mjs` langsung; jangan memecahnya lagi. Pengecualian: `migration-sakti.sql` adalah salinan bagian SAKTI untuk database lama; ubah bersama `bop.sql`.
- Aturan baru ditulis di **trigger lebih dulu**, lalu cerminkan di UI (`calc()`, tombol) dan, bila menyangkut dokumen, di Edge Function.
- Hindari tabel log/audit dan cron (hemat kuota free plan). Jejak audit cukup `updated_by/at`, `submitted_*`, `verified_*`, `paid_at`.
- Zona waktu aturan = WIB (`Asia/Jakarta`) di server. Pesan error berbahasa Indonesia dan menyebut angka (batas, terpakai, dimasukkan, kelebihan).
- Jangan menyimpan data turunan yang bisa dihitung (mis. `total` boleh karena dijaga trigger; Realisasi SAKTI disimpan per bulan karena nominalnya nyata dan berubah tiap bulan, bukan turunan).
- Halaman yang memuat data async wajib memakai `ep`/`live(ep)` (lihat bagian 7); hasil `await` dari halaman lama tidak boleh menulis ke layar baru.

## 10. Jika mengubah X, ubah juga Y
| Perubahan | Sinkronkan |
|---|---|
| Menambah/mengubah POS | seed `pos` di `bop.sql`; cek `pos_sakti_ok` (SQL) dan `SAKTI_POS` (JS) bila POS boleh SAKTI; UI otomatis mengikuti `pos` (cache `master()`) |
| Aturan validasi Realisasi/RPD | trigger di `bop.sql` **dan** `calc()` di `pageRealisasi`/`pageRpd` |
| Kunci config baru | seed `config` di `bop.sql`, `pageConfig`, dan tempat yang membacanya (`m.cfg.<kunci>`, Edge Function bila relevan) |
| Aksi server baru | `bop/index.ts` (daftar aksi + metode di `Deno.serve`), lalu panggil lewat `api()` |
| Kolom baru di `items`/tabel | `bop.sql` (DDL idempotent), `buildReport`, halaman terkait |
| Nama function/secret berubah | `PANDUAN-INSTALASI.md`, `bop.mjs` (teks cetak), pesan error di `api()` |
| Aturan metode/Realisasi SAKTI | `metode_guard`/`realisasi_sakti_guard` di `bop.sql` **dan** `migration-sakti.sql`; `metodeOf`/`saktiOf`/`saktiYear` serta `calc()` di `index.html`; `buildSakti` bila laporan terpengaruh |

## 11. Cara memverifikasi (pengujian tidak disertakan sebagai file; cara menyusunnya)
- **SQL**: PostgreSQL 16 lokal + stub `auth` (`auth.users`, `auth.uid()` membaca `request.jwt.claim.sub`; peran `anon/authenticated/service_role`).
  Jalankan `bop.sql` dua kali pada DB kosong, buat akun, lalu uji dengan `set role authenticated` + `set_config('request.jwt.claim.sub', uuid, true)`.
  Skenario inti: JSON tidak valid, melebihi anggaran/RPD, tanpa LPJ, tanggal < 10, edit saat `waiting`, admin ubah nominal ditolak, admin ubah status bebas,
  RLS antar-KUA, AutoPayment berversi, dan upgrade dari struktur lama (per-POS). (63 pengecekan pada versi terakhir.)
- **Edge Function**: bundel dengan esbuild, ganti impor `npm:@supabase/supabase-js@2` dengan stub, tiru `Deno.serve/env`, `fetch` Google Drive, lalu panggil handler dengan `Request`. (45 pengecekan.)
- **Frontend**: jsdom dengan Supabase tiruan (builder rantai `eq/in/...`), `showModal/close` dan `fetch` ditiru; periksa alur halaman, filter, viewer, multi-select. (91 pengecekan.)
- **SAKTI** (versi ini): SQL 14 kasus wajib + RLS (121 pengecekan, dijalankan pada pemasangan baru dan pada upgrade dari `bop.sql` lama; skema kedua jalur identik); migrasi AutoPayment (50 pengecekan, angka tiap bulan identik sebelum/sesudah); frontend dengan `supabase-js` asli + PostgREST + jsdom (62 pengecekan, termasuk reproduksi error `Cannot set properties of null`).

## 12. Batasan yang diketahui / ide lanjutan
- RPD masih bisa diturunkan di bawah Realisasi yang sudah masuk (belum ada penjagaan sebaliknya); admin belum bisa menghapus RPD.
- Realisasi SAKTI tidak terisi otomatis: admin menginput nominal sebenarnya tiap bulan. Migrasi hanya mengisi bulan yang sudah berjalan dari AutoPayment lama (Sudah dibayar, tanpa tanggal). Batas yang dijaga sama dengan Realisasi manual (total sebulan <= RPD bulan itu; per POS setahun <= RPD POS itu); belum ada batas per POS per bulan.
- Metode dan Realisasi SAKTI sengaja tidak bisa dihapus; koreksi lewat UPDATE (Belum dibayar = Rp 0). Fungsi lama `auto_items`/`auto_year`/`set_autopayment` dan tabel `autopayment_pos` masih ada sebagai arsip.
- Laporan dibuat di browser (cukup untuk 31 KUA). File LPJ milik akun Google yang menjalankan `bop.mjs drive`; refresh token tidak berlaku bila app Google masih *Testing* (7 hari) atau izin dicabut.
- Plan Free Supabase: project dijeda setelah ~1 minggu tanpa aktivitas, tanpa backup otomatis.

## 13. Glosarium
**KUA** Kantor Urusan Agama (satu per kecamatan) · **BOP** Biaya Operasional Perkantoran · **RPD** Rencana Penarikan Dana (per bulan) ·
**LPJ** Laporan Pertanggungjawaban (dokumen bukti) · **POS/akun** kode belanja (521111, 522111, ...) · **Rincian** turunan POS (mis. ATK Kantor) ·
**SAKTI** sistem keuangan pemerintah (pembayaran otomatis) · **AutoPayment** (lama, kini arsip) pembayaran rutin nominal tetap via SAKTI · **Metode pembayaran** MANUAL atau SAKTI per KUA + POS · **WIB** UTC+7.