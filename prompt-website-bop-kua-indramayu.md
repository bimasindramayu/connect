# Prompt: Pengembangan Website BOP KUA Kabupaten Indramayu

Kamu adalah seorang full-stack web developer berpengalaman. Bangunkan saya sebuah website sistem pengelolaan **Biaya Operasional Perkantoran (BOP)** untuk seluruh KUA (Kantor Urusan Agama) se-Kabupaten Indramayu, sesuai spesifikasi lengkap di bawah ini. Jika ada bagian yang ambigu, buat asumsi yang masuk akal, sebutkan asumsinya secara eksplisit, lalu tetap lanjutkan — jangan berhenti hanya untuk bertanya hal kecil.

## 1. Tech Stack & Prinsip Utama

- **Frontend**: HTML, CSS, JavaScript native (vanilla). Tanpa framework berat (tanpa React/Vue/Angular, tanpa Bootstrap penuh). Library eksternal hanya dipakai untuk kebutuhan spesifik yang memang butuh (export Excel/PDF), itu pun dimuat lazy (hanya saat dibutuhkan).
- **Backend**: Google Apps Script sebagai REST-like API (`doGet`/`doPost` dengan parameter `action` sebagai router).
- **Database**: Google Spreadsheet (multi-sheet, lihat bagian 4).
- **Prinsip non-fungsional yang wajib dijaga di semua fitur:**
  - *Ringan* — minim dependency, minim request ke Apps Script, cache data referensi (master POS, daftar KUA) di client.
  - *Responsive* — nyaman dipakai di HP, tablet, dan desktop (mobile-first).
  - *Smooth* — tidak ada full page reload antar-menu, ada loading state/skeleton tiap fetch data, transisi antar-tampilan halus.

## 2. Role & Autentikasi

Dua role: **Admin** dan **Operator KUA** (satu akun Operator terikat ke satu KUA).

- Login: username + password + **captcha lokal** — di-generate dan divalidasi sepenuhnya di client (misalnya kode acak di `<canvas>` dengan sedikit noise/distorsi), tanpa API/layanan captcha eksternal.
- Password disimpan ter-hash (misalnya SHA-256 + salt lewat `Utilities.computeDigest` di Apps Script, karena Apps Script tidak punya bcrypt native), tidak pernah disimpan plain text.
- Sesi login: gunakan token yang disimpan di `CacheService`/`PropertiesService` (dengan expiry) atau di sheet `Sessions`, dikirim client lewat parameter di tiap request, dan disimpan di client di `localStorage` (bukan cookie, karena web app Apps Script tidak jalan di domain sendiri).

### 2.1 Hak Akses Admin
1. Input & edit Anggaran Tahunan per KUA.
2. Lihat, edit, hapus RPD milik KUA mana pun (semua bulan, semua pos).
3. Verifikasi Realisasi (approve / reject / tandai paid) milik KUA mana pun.
4. Download Laporan RPD & Realisasi (Excel dan PDF).
5. Kelola Config sistem.
6. Kelola AutoPayment.
7. Ubah password akun sendiri.
8. Reset password akun Operator KUA mana pun.

### 2.2 Hak Akses Operator KUA
1. Input RPD bulanan — hanya untuk KUA-nya sendiri.
2. Input Realisasi bulanan (termasuk upload LPJ sesuai Config) — hanya untuk KUA-nya sendiri.
3. Download Laporan RPD & Realisasi (Excel dan PDF) — hanya untuk KUA-nya sendiri.
4. Ubah password akun sendiri.

## 3. Master Data POS (Akun Belanja)

Gunakan struktur berikut apa adanya:

- **521111** — Belanja Operasional Perkantoran
  - a. ATK Kantor
  - b. Jamuan Tamu
  - c. Pramubakti
  - d. Alat Rumah Tangga Kantor
- **521211** — Belanja Bahan
  - a. Penggandaan / Penjilidan
  - b. Spanduk
- **522111** — Belanja Langganan Listrik
- **522112** — Belanja Langganan Telepon / Internet
- **522113** — Belanja Langganan Air
- **523111** — Belanja Pemeliharaan Gedung dan Bangunan
- **523121** — Belanja Pemeliharaan Peralatan dan Mesin

**Penting:** unit terkecil yang dipakai untuk input & validasi RPD/Realisasi adalah level **rincian** (a/b/c/d) jika kode itu punya rincian, atau level **kode POS itu sendiri** jika tidak punya rincian — bukan agregat di level kode 6 digit induk. Jadi "ATK Kantor", "Jamuan Tamu", dst masing-masing punya baris RPD/Realisasi dan sisa-anggaran sendiri.

## 4. Struktur Data (Google Spreadsheet)

Usulan 1 spreadsheet dengan sheet-sheet berikut:

**Sheet `Users`**: user_id, username, password_hash, salt, role (`admin`/`operator`), kua_id (kosong untuk admin), nama_lengkap, status (aktif/nonaktif), last_login.

**Sheet `KUA`**: kua_id, nama_kua, kecamatan, status.

**Sheet `POS`** (master akun, sesuai bagian 3): pos_id, kode_pos, nama_pos, kode_rincian (kosong jika tidak ada), nama_rincian, urutan.

**Sheet `AnggaranTahunan`**: id, kua_id, tahun, nominal_total, updated_by, updated_at.

**Sheet `RPD`**: id, kua_id, tahun, bulan, pos_id, nominal, updated_by, updated_at.

**Sheet `Realisasi`**: id, kua_id, tahun, bulan, pos_id, nominal, status (`waiting`/`approved`/`rejected`/`paid`), is_autopayment (TRUE/FALSE), file_lpj_url, catatan_admin, submitted_by, submitted_at, verified_by, verified_at, paid_at.

**Sheet `AutoPayment`**: id, kua_id, pos_id, tahun, bulan, nominal, input_by, input_at.

**Sheet `Config`**: key, value, updated_by, updated_at — baris: wajib_lpj, rpd_enabled, realisasi_enabled, max_file_size_mb, max_file_count, bulan_edit_rpd.

**Sheet `LogAktivitas`** (opsional, praktik baik untuk audit): id, timestamp, user, aksi, detail.

## 5. Fitur Admin (Detail)

- **Anggaran Tahunan**: form pilih KUA + tahun + nominal; list semua KUA dengan status "sudah/belum diset" untuk tahun berjalan.
- **RPD semua KUA**: tabel/browsable per KUA → tahun → bulan → pos, dengan aksi edit & hapus per baris. Perubahan oleh Admin tidak terikat Config "Bulan Dibuka untuk Edit RPD" (itu hanya berlaku untuk Operator).
- **Verifikasi Realisasi**: daftar Realisasi masuk (default filter status `waiting`), buka detail (termasuk lampiran LPJ), lalu approve / reject (reject wajib isi catatan alasan) / tandai paid (untuk yang sudah approved). Entri AutoPayment tidak muncul di antrian ini karena langsung berstatus `paid` (lihat bagian 7).
- **Laporan**: lihat bagian 9.
- **Config**: lihat bagian 10.
- **AutoPayment**: lihat bagian 7.
- **Manajemen akun**: ubah password sendiri; reset password akun Operator KUA mana pun (set password baru).

## 6. Fitur Operator KUA (Detail)

- **Input RPD bulanan**: pilih bulan (dibatasi Config "Bulan Dibuka untuk Edit RPD"), isi nominal per pos/rincian. Tampilkan total RPD tahun berjalan vs Anggaran Tahunan KUA tsb secara real-time (progress/sisa).
- **Input Realisasi bulanan**: pilih bulan (tunduk aturan tanggal 10, lihat bagian 11), isi nominal per pos/rincian, upload LPJ jika diwajibkan Config. Pos yang sudah ditangani AutoPayment untuk bulan itu tampil read-only dengan label "Dibayar otomatis" dan tidak bisa diisi manual. Tampilkan sisa anggaran per pos (RPD setahun pos dikurangi total Realisasi pos sejauh ini) secara real-time saat mengisi, dan cegah submit bila ada pos yang jadi minus.
- Realisasi hanya bisa diedit Operator selama statusnya `waiting` atau `rejected`; setelah `approved`/`paid`, terkunci dari Operator.
- **Download Laporan**: sama seperti Admin (bagian 9) tapi otomatis terbatas ke KUA-nya sendiri (tanpa opsi "semua KUA").
- **Ubah password sendiri.**

## 7. AutoPayment

Fitur untuk tagihan yang sudah dibayar otomatis lewat Sakti tiap bulan (mis. listrik, air, telepon/internet), sehingga tidak perlu diinput manual oleh Operator. (Nama fitur ini bebas diganti — misalnya "Pembayaran Otomatis" — asal fungsinya tetap sama.)

Alur:
1. Admin memilih kombinasi **KUA + pos** yang mau pakai AutoPayment (bisa pilih banyak sekaligus, lewat checklist).
2. Tiap bulan, Admin input **nominal** AutoPayment untuk tiap kombinasi KUA+pos yang aktif.
3. Nominal itu otomatis menjadi nilai **Realisasi** bulan tsb untuk KUA & pos terkait — berstatus `paid` langsung, ditandai `is_autopayment = true`, tanpa perlu LPJ dan tanpa lewat alur waiting/approve.
4. Di form input Realisasi milik Operator, kombinasi KUA+pos+bulan yang sudah dicover AutoPayment otomatis tampil read-only ("Dibayar otomatis") — Operator tidak bisa dan tidak perlu mengisi manual.
5. Nominal AutoPayment tetap dihitung dalam semua validasi (total bulanan, sisa anggaran pos tahunan) dan tetap muncul di Laporan seperti Realisasi biasa.

## 8. Status Realisasi & Alur Verifikasi

Status: `waiting` → `approved` atau `rejected` → (dari `approved`) → `paid`.

1. Operator submit Realisasi (+ LPJ jika wajib) → status `waiting`.
2. Admin review: **Approve** → `approved`, atau **Reject** (wajib isi catatan) → `rejected` (Operator bisa edit & submit ulang → balik ke `waiting`).
3. Admin menandai **paid** setelah pembayaran benar-benar diproses (transisi dari `approved`).
4. Entri AutoPayment langsung `paid` sejak dibuat, di luar alur di atas (lihat bagian 7).

## 9. Laporan (Download RPD/Realisasi)

Filter yang tersedia:
- **Periode**: 1 tahun, atau 1 bulan tertentu.
- **Cakupan KUA**: 1 KUA tertentu, atau semua KUA (tetap 1 file, hanya kolomnya menyesuaikan — misalnya ditambah kolom "Nama KUA" saat pilih semua KUA, dihilangkan saat pilih 1 KUA).
- **Jenis nominal**: RPD atau Realisasi.
- **Format**: Excel (.xlsx) dan PDF, masing-masing tombol unduh terpisah.

Dua jenis laporan:
1. **Laporan per Tahun** — rekap satu baris per pos/rincian (atau per KUA+pos bila semua KUA), kolom Total RPD atau Total Realisasi setahun. Untuk ringkasan cepat.
2. **Laporan Detail** — rincian per pos/rincian per bulan (matrix pos x 12 bulan, atau baris per pos+bulan), nominal RPD atau Realisasi sesuai pilihan. Untuk keperluan audit/cek detail.

Saran teknis: ambil data dari Apps Script sebagai JSON, lalu generate file di client memakai library ringan yang dimuat lazy (contoh: SheetJS/xlsx.js untuk Excel, jsPDF + autotable untuk PDF) — supaya proses cepat, tidak membebani quota Apps Script, dan tidak memperberat ukuran halaman utama.

## 10. Config

| Pengaturan | Tipe |
|---|---|
| Wajib upload LPJ (PDF/Image) saat submit Realisasi | on/off |
| Pengisian RPD oleh Operator | on/off |
| Pengisian Realisasi oleh Operator | on/off |
| Maksimal ukuran file | angka (MB) |
| Maksimal jumlah file | angka |
| Bulan dibuka untuk edit RPD (Operator) | pilih bulan mana saja yang aktif |

## 11. Validasi & Aturan Bisnis

Semua ini wajib divalidasi di **client maupun server** (server sebagai validasi final, jangan percaya client saja), dan setiap pelanggaran harus menampilkan pesan yang jelas — sebutkan batasnya, nilai yang diinput, dan selisih kelebihannya, bukan sekadar "tidak valid":

1. Submit Realisasi untuk bulan **M** hanya bisa mulai tanggal 10 bulan **M** (boleh dilakukan kapan pun setelahnya, termasuk di bulan-bulan berikutnya).
2. Nominal tidak boleh negatif.
3. Semua field nominal ditampilkan dengan separator ribuan format Indonesia (mis. `1.500.000`), **termasuk saat sedang diketik** di input field (format-as-you-type, kursor tidak boleh meloncat).
4. Total RPD yang diinput Operator dalam 1 tahun (seluruh bulan, seluruh pos) tidak boleh melebihi Anggaran Tahunan KUA tsb.
5. Total Realisasi dalam 1 bulan (seluruh pos, termasuk AutoPayment) tidak boleh melebihi Total RPD bulan yang sama.
6. Total Realisasi 1 pos/rincian (akumulasi seluruh bulan dalam 1 tahun, termasuk AutoPayment) tidak boleh melebihi Total RPD pos/rincian tsb dalam 1 tahun — tampilkan sisa anggaran pos secara real-time saat input Realisasi, dan cegah submit bila akan jadi minus.

## 12. UI/UX & Performa

- Format angka Rupiah konsisten di semua tempat (tabel, form, laporan): `Rp` + separator titik ribuan, tanpa desimal.
- Indikator sisa anggaran (per pos, per KUA) ditampilkan jelas — beri warna berbeda saat mendekati atau melewati batas.
- Loading indicator di setiap fetch ke Apps Script (API Apps Script cenderung agak lambat).
- Navigasi antar-menu tanpa reload halaman penuh (show/hide section atau routing sederhana berbasis hash).
- Modal konfirmasi sebelum aksi destruktif (hapus RPD, reset password).
- Notifikasi toast untuk sukses/gagal.
- Mobile-first dengan breakpoint jelas untuk tablet & desktop.

## 13. Arsitektur & Struktur File (Usulan)

**Frontend**
- `index.html` — halaman login (+ captcha lokal)
- `app.html` — shell utama setelah login, render konten sesuai role via JS
- `/css/style.css` (boleh dipecah: base, components, admin, operator)
- `/js/api.js` — wrapper fetch ke Apps Script
- `/js/auth.js`, `/js/admin.js`, `/js/operator.js`, `/js/utils.js` (format angka, validasi), `/js/captcha.js`

**Backend (Google Apps Script, 1 project)**
- `Code.gs` — entry point `doGet`/`doPost`, router berdasar `action`
- `Auth.gs`, `RPD.gs`, `Realisasi.gs`, `AutoPayment.gs`, `Laporan.gs`, `Config.gs`, `Utils.gs`

**Database**: 1 Google Spreadsheet sesuai bagian 4.

## 14. Asumsi yang Diambil (mohon dikoreksi bila salah)

- Transisi status `approved` → `paid` dilakukan manual oleh Admin, terpisah dari aksi approve.
- Toggle "Pengisian RPD" dan "Pengisian Realisasi" di Config berlaku global untuk semua KUA, bukan per-KUA.
- "Bulan Dibuka untuk Edit RPD" adalah pengaturan global (berlaku sama untuk semua KUA), bisa diubah Admin kapan saja.
- Definisi "Laporan per Tahun" vs "Laporan Detail" mengikuti penjelasan di bagian 9 — sesuaikan jika yang dimaksud berbeda.

## 15. Yang Harus Dihasilkan

- Kode frontend (HTML/CSS/JS) lengkap dan siap pakai.
- Kode backend Apps Script lengkap (siap paste ke Apps Script Editor) + struktur Spreadsheet (nama sheet & kolom sesuai bagian 4).
- Petunjuk singkat setup: cara buat Spreadsheet, cara deploy Apps Script sebagai Web App, cara hubungkan ke frontend.
- Mengingat scope-nya besar, boleh dibangun bertahap: (1) Auth + struktur data dasar → (2) RPD & Realisasi Operator → (3) Verifikasi & Laporan Admin → (4) AutoPayment & Config.
