# Prompt: Pengembangan Website BOP KUA Kabupaten Indramayu

Kamu adalah seorang **full-stack web developer berpengalaman** yang menguasai frontend, Supabase/PostgreSQL, JavaScript modern, keamanan web, dan integrasi Google Drive.

Saya ingin melanjutkan pengembangan sebuah website sistem pengelolaan **Biaya Operasional Perkantoran (BOP)** untuk seluruh KUA (Kantor Urusan Agama) se-Kabupaten Indramayu.

## 0. KONDISI PROJECT SAAT INI — WAJIB DIPAHAMI

Project ini **BUKAN project kosong**.

Saya sudah memiliki implementasi awal dan sudah melakukan setup database sebelumnya.

Saya akan menyertakan beberapa file sebagai baseline project:

* `index.html`
* file JavaScript module `*.mjs`
* file `*.sql` yang sebelumnya sudah saya jalankan di Supabase

### Aturan penting

1. **Jangan membangun ulang project dari nol.**
2. **Jangan menghapus atau mengganti struktur yang sudah berjalan tanpa alasan teknis yang jelas.**
3. File yang saya kirim harus terlebih dahulu dianalisis untuk memahami:

   * struktur HTML yang sudah ada,
   * login page,
   * dashboard,
   * fungsi JavaScript yang sudah tersedia,
   * koneksi Supabase,
   * tabel/database yang sudah dibuat,
   * autentikasi yang sudah digunakan,
   * role dan akun yang sudah tersedia.
4. **Pertahankan akun yang sudah saya generate.**
5. **Jangan membuat akun dummy baru**, kecuali benar-benar diperlukan untuk pengujian lokal dan tidak mengubah data produksi.
6. SQL yang sudah pernah dijalankan dianggap sebagai **baseline database**.
7. Jangan melakukan `DROP TABLE`, reset database, atau tindakan destruktif terhadap database yang sudah ada.
8. Bila ada perubahan struktur database yang diperlukan, buat **migration SQL tambahan** yang aman dan jelaskan perubahan tersebut.
9. Pertahankan fitur yang sudah bekerja dan lakukan perubahan secara incremental.
10. Sebelum mengubah kode, pahami terlebih dahulu kode yang sudah saya berikan.

---

# 1. ARSITEKTUR & TECH STACK

## Frontend

Website akan di-deploy secara gratis menggunakan:

**GitHub Pages**

Frontend harus bersifat static sehingga kompatibel dengan GitHub Pages.

Teknologi utama:

* HTML5
* CSS3
* JavaScript modern / ES Modules
* `.mjs` bila memang sudah digunakan oleh project
* Fetch API / Supabase JS client sesuai implementasi existing

Saya **tidak mewajibkan native vanilla JS**.

Apabila penggunaan library atau framework modern memang memberikan manfaat yang signifikan, diperbolehkan menggunakan:

* Vite
* framework frontend ringan lainnya
* library UI ringan

Namun:

> **Jangan melakukan migrasi dari native HTML/JS ke framework hanya demi mengganti teknologi.**

Prioritas utama adalah menjaga project yang sudah ada tetap sederhana, ringan, mudah dipelihara, dan mudah di-deploy melalui GitHub Pages.

Library tambahan hanya digunakan bila memang diperlukan, misalnya:

* export Excel
* export PDF
* PDF viewer
* date utility
* UI utility

Library yang berat dan tidak diperlukan harus dihindari.

---

# 2. BACKEND & DATABASE — SUPABASE

Backend dan database sudah menggunakan:

**Supabase**

Gunakan Supabase sebagai sumber data utama aplikasi.

Komponen yang dapat digunakan:

* Supabase PostgreSQL
* Supabase JS Client
* Row Level Security (RLS)
* Supabase Auth apabila memang sudah digunakan oleh project existing
* Supabase Edge Functions hanya apabila memang diperlukan untuk proses server-side yang tidak aman dilakukan dari frontend

### Sangat penting

Frontend yang di-host di GitHub Pages adalah public/static.

Karena itu:

### DILARANG keras menaruh:

* Supabase `service_role` key
* secret key
* private API credential
* Google service account private key
* OAuth client secret

di dalam:

* `index.html`
* `.js`
* `.mjs`
* repository GitHub
* file konfigurasi frontend yang dapat diakses publik

Frontend hanya boleh menggunakan credential yang memang aman untuk client-side, seperti **Supabase anon/publishable key**, dengan keamanan utama ditangani melalui RLS dan policy database.

---

# 3. KONDISI LOGIN & AUTENTIKASI

Saya **sudah memiliki login page dan dashboard di `index.html`**.

Jangan membuat login page baru apabila yang sekarang sudah dapat digunakan.

Analisis implementasi login yang ada dan lanjutkan dari sistem tersebut.

Role sistem:

1. `admin`
2. `operator`

Satu akun Operator terikat ke satu KUA.

## Captcha

Captcha sudah menggunakan **Cloudflare CAPTCHA/Turnstile** pada project existing.

Gunakan implementasi yang sudah ada dan jangan menggantinya dengan captcha lokal.

Captcha harus:

* ditampilkan pada login sesuai implementasi existing,
* divalidasi dengan mekanisme Cloudflare,
* tidak dibuat ulang menggunakan canvas/random captcha,
* tidak menggunakan layanan captcha lain.

## Password

Password tidak boleh disimpan dalam bentuk plain text.

Gunakan mekanisme autentikasi yang sudah terdapat pada project existing.

Apabila project telah menggunakan **Supabase Auth**, pertahankan Supabase Auth.

Jangan membuat sistem password custom baru apabila Supabase Auth sudah digunakan.

Apabila terdapat tabel user tambahan untuk informasi role/KUA, gunakan tabel tersebut sebagai metadata/otorisasi dan tetap sinkron dengan mekanisme autentikasi yang sudah berjalan.

---

# 4. MASTER DATA POS

Gunakan struktur berikut apa adanya.

### 521111 — Belanja Operasional Perkantoran

* ATK Kantor
* Jamuan Tamu
* Pramubakti
* Alat Rumah Tangga Kantor

### 521211 — Belanja Bahan

* Penggandaan / Penjilidan
* Spanduk

### 522111 — Belanja Langganan Listrik

Tidak memiliki rincian.

### 522112 — Belanja Langganan Telepon / Internet

Tidak memiliki rincian.

### 522113 — Belanja Langganan Air

Tidak memiliki rincian.

### 523111 — Belanja Pemeliharaan Gedung dan Bangunan

Tidak memiliki rincian.

### 523121 — Belanja Pemeliharaan Peralatan dan Mesin

Tidak memiliki rincian.

### Penting

Unit terkecil yang dipakai untuk input dan validasi RPD/Realisasi adalah:

* level rincian bila kode POS mempunyai rincian;
* level kode POS itu sendiri bila tidak mempunyai rincian.

Contoh:

`ATK Kantor`

harus dianggap sebagai item tersendiri untuk:

* RPD
* Realisasi
* total
* sisa anggaran
* validasi

Bukan menggunakan agregat kode POS induk sebagai unit input.

---

# 5. STRUKTUR DATABASE SUPABASE

Database utama menggunakan PostgreSQL pada Supabase.

Struktur harus menyesuaikan database yang **sudah saya buat melalui file SQL yang saya sertakan**.

Jangan langsung membuat tabel baru dengan nama berbeda apabila tabel existing sudah memiliki fungsi yang sama.

Secara konsep data yang diperlukan adalah:

## Users / Profiles

Minimal menyimpan informasi:

* user_id
* username/email sesuai mekanisme autentikasi existing
* role
* kua_id
* nama_lengkap
* status
* last_login atau informasi login terakhir apabila memang sudah digunakan

Password credential dikelola melalui sistem authentication, bukan disimpan plain text di tabel aplikasi.

---

## KUA

Field minimal:

* kua_id
* nama_kua
* kecamatan
* status

---

## POS

Field minimal:

* pos_id
* kode_pos
* nama_pos
* kode_rincian
* nama_rincian
* urutan

---

## AnggaranTahunan

Field minimal:

* id
* kua_id
* tahun
* nominal_total
* updated_by
* updated_at

---

## RPD

Field minimal:

* id
* kua_id
* tahun
* bulan
* pos_id
* nominal
* updated_by
* updated_at

---

## Realisasi

Field minimal:

* id
* kua_id
* tahun
* bulan
* pos_id
* nominal
* status
* is_autopayment
* file_lpj_url
* catatan_admin
* submitted_by
* submitted_at
* verified_by
* verified_at
* paid_at

Status:

* `waiting`
* `approved`
* `rejected`
* `paid`

---

## AutoPayment

Field minimal:

* id
* kua_id
* pos_id
* tahun
* bulan
* nominal
* input_by
* input_at

---

## Config

Field minimal:

* key
* value
* updated_by
* updated_at

Konfigurasi:

* wajib_lpj
* rpd_enabled
* realisasi_enabled
* max_file_size_mb
* max_file_count
* bulan_edit_rpd

---

# 6. LOG AKTIVITAS

**Tidak perlu membuat atau menyimpan LogAktivitas di database.**

Saya sengaja tidak ingin menyimpan log aktivitas ke Supabase karena ingin menghemat storage.

Karena itu:

* jangan membuat tabel `LogAktivitas`,
* jangan membuat tabel audit khusus,
* jangan menyimpan setiap aktivitas user sebagai row baru.

Untuk debugging gunakan seperlunya:

* `console.log`
* `console.warn`
* `console.error`
* Supabase/logging bawaan yang tersedia secara platform apabila diperlukan

Informasi audit penting tetap dapat diketahui dari field data yang sudah ada seperti:

* `updated_by`
* `updated_at`
* `submitted_by`
* `submitted_at`
* `verified_by`
* `verified_at`
* `paid_at`

Jangan menambahkan persistent activity log hanya untuk mencatat aktivitas biasa.

---

# 7. HAK AKSES ADMIN

Admin memiliki akses:

1. Input dan edit Anggaran Tahunan per KUA.
2. Melihat, mengedit, dan menghapus RPD milik seluruh KUA.
3. Melakukan verifikasi Realisasi seluruh KUA.
4. Approve Realisasi.
5. Reject Realisasi dengan catatan.
6. Menandai Realisasi sebagai `paid`.
7. Download laporan RPD dan Realisasi.
8. Kelola Config.
9. Kelola AutoPayment.
10. Mengubah password akun sendiri.
11. Reset password Operator KUA.
12. Melihat data seluruh KUA.

Admin tidak dibatasi oleh konfigurasi bulan edit RPD yang berlaku untuk Operator.

---

# 8. HAK AKSES OPERATOR KUA

Operator hanya boleh mengakses data milik KUA yang terhubung dengan akun tersebut.

Operator dapat:

1. Input RPD bulanan.
2. Edit RPD selama bulan tersebut dibuka.
3. Input Realisasi bulanan.
4. Upload/menambahkan dokumen LPJ sesuai Config.
5. Melihat status Realisasi.
6. Memperbaiki Realisasi yang ditolak.
7. Download laporan untuk KUA sendiri.
8. Mengubah password sendiri.

Operator **tidak boleh**:

* melihat data KUA lain,
* mengedit data KUA lain,
* mengubah anggaran KUA lain,
* memverifikasi Realisasi,
* mengubah status menjadi approved/paid,
* mengubah konfigurasi global.

Pembatasan harus diterapkan bukan hanya di UI, tetapi juga pada **Supabase RLS/policy dan validasi server-side**.

---

# 9. ANGGARAN TAHUNAN

Admin dapat memilih:

* KUA
* Tahun
* Nominal Anggaran

Dashboard harus menampilkan daftar seluruh KUA dengan status:

* sudah diset
* belum diset

Untuk tahun berjalan.

Operator hanya dapat melihat anggaran milik KUA sendiri.

---

# 10. RPD

## Operator

Operator mengisi RPD bulanan berdasarkan:

* tahun
* bulan
* POS/rincian

Tampilkan secara real-time:

**Total RPD tahun berjalan**

dibandingkan dengan:

**Anggaran Tahunan KUA**

Contoh:

`Total RPD: Rp 25.000.000`

`Anggaran Tahunan: Rp 30.000.000`

`Sisa: Rp 5.000.000`

RPD tidak boleh menyebabkan total RPD setahun melebihi Anggaran Tahunan.

## Pembatasan bulan

Operator hanya dapat mengedit bulan yang diperbolehkan oleh Config:

`bulan_edit_rpd`

Admin tidak terkena pembatasan tersebut.

---

# 11. REALISASI

Operator memilih:

* tahun
* bulan

kemudian mengisi nominal Realisasi per POS/rincian.

Tampilkan:

* RPD bulan tersebut
* Realisasi bulan berjalan
* sisa RPD
* sisa anggaran POS tahunan

Validasi harus dilakukan secara real-time.

Realisasi yang sudah:

* `approved`
* `paid`

tidak dapat diedit Operator.

Realisasi:

* `waiting`
* `rejected`

masih dapat diedit oleh Operator.

Setelah diperbaiki dan dikirim ulang:

`rejected → waiting`

---

# 12. GOOGLE DRIVE UNTUK DOKUMEN LPJ

Dokumen LPJ **tetap disimpan di Google Drive**.

Jangan memindahkan penyimpanan dokumen LPJ ke Supabase Storage kecuali saya meminta perubahan tersebut secara khusus.

Database hanya menyimpan informasi yang diperlukan, terutama:

`file_lpj_url`

atau metadata file yang memang diperlukan.

## Google Drive API

Saya sudah merencanakan penggunaan **Google Drive API dengan API key** untuk kebutuhan akses/preview dokumen.

Gunakan mekanisme integrasi Google Drive yang sudah tersedia di project apabila sudah ada.

### Keamanan sangat penting

Karena frontend di-host pada GitHub Pages:

* jangan menaruh credential privat Google di frontend,
* jangan menaruh service account private key di repository,
* jangan menaruh OAuth client secret di JavaScript,
* API key yang digunakan client-side harus dibatasi/restrict sesuai kebutuhan.

### Upload LPJ

Perhatikan bahwa **API key Google Drive bukan credential untuk melakukan upload file secara aman**.

Karena itu:

* apabila project existing sudah mempunyai mekanisme upload yang aman, pertahankan;
* apabila upload ke Google Drive belum tersedia dan memang membutuhkan akses tulis, gunakan mekanisme server-side yang aman seperti Supabase Edge Function atau mekanisme autentikasi Google yang sesuai;
* **jangan pernah memasukkan service account private key atau secret Google ke GitHub Pages/frontend.**

Untuk kebutuhan preview PDF/image, gunakan URL atau Google Drive API yang sudah disediakan oleh project.

---

# 13. AUTOPAYMENT

Fitur untuk pembayaran yang sudah dilakukan otomatis melalui SAKTI setiap bulan.

Contoh:

* listrik
* air
* telepon/internet

Alurnya:

### 1

Admin memilih kombinasi:

`KUA + POS`

yang menggunakan AutoPayment.

Bisa memilih banyak sekaligus.

### 2

Setiap bulan Admin memasukkan nominal AutoPayment.

### 3

Data AutoPayment otomatis menjadi Realisasi dengan:

`status = paid`

dan:

`is_autopayment = true`

### 4

Tidak masuk ke antrean verifikasi Admin.

### 5

Tidak memerlukan LPJ.

### 6

Pada form Realisasi Operator:

kombinasi KUA + POS + bulan yang sudah memiliki AutoPayment harus:

* tampil,
* read-only,
* diberi label **Dibayar otomatis**.

Operator tidak dapat mengisi manual.

### 7

AutoPayment tetap dihitung dalam:

* total Realisasi,
* validasi RPD,
* sisa anggaran POS,
* laporan.

---

# 14. STATUS REALISASI

Status utama:

`waiting → approved → paid`

atau:

`waiting → rejected → waiting`

Alur:

### Operator

Submit Realisasi:

`waiting`

### Admin

Approve:

`waiting → approved`

Reject:

`waiting → rejected`

Reject **wajib memberikan catatan alasan**.

### Operator

Memperbaiki data:

`rejected → waiting`

### Admin

Setelah benar-benar dibayarkan:

`approved → paid`

### AutoPayment

Langsung:

`paid`

dengan:

`is_autopayment = true`

---

# 15. ATURAN VALIDASI

Semua validasi wajib dilakukan pada:

1. frontend/client;
2. database/security/server-side.

Frontend bukan sumber kebenaran utama.

## 15.1 Realisasi

Realisasi untuk bulan `M` baru boleh disubmit mulai:

**tanggal 10 bulan M**

Contoh:

Realisasi September dapat mulai disubmit:

**10 September**

dan tetap boleh dilakukan pada bulan berikutnya.

## 15.2 Nominal

Nominal tidak boleh negatif.

## 15.3 Format Rupiah

Semua nominal menggunakan format Indonesia:

`1.500.000`

Tanpa desimal.

Format juga diterapkan ketika user sedang mengetik:

`format-as-you-type`

Kursor tidak boleh meloncat secara mengganggu.

## 15.4 Total RPD

Total seluruh RPD dalam satu tahun:

`≤ Anggaran Tahunan`

## 15.5 Total Realisasi Bulanan

Total Realisasi seluruh POS dalam satu bulan:

`≤ Total RPD bulan tersebut`

AutoPayment ikut dihitung.

## 15.6 Total Realisasi per POS

Akumulasi Realisasi satu POS/rincian sepanjang tahun:

`≤ Total RPD POS/rincian tersebut`

AutoPayment ikut dihitung.

Sisa anggaran harus ditampilkan secara real-time.

Submit harus dicegah jika hasil akhirnya negatif.

Pesan error harus menjelaskan:

* batas maksimal,
* nilai yang dimasukkan,
* nilai yang sudah digunakan,
* selisih kelebihan.

Jangan hanya menampilkan:

`Data tidak valid`.

---

# 16. CONFIG SISTEM

Admin dapat mengatur:

| Pengaturan                   | Tipe               |
| ---------------------------- | ------------------ |
| Wajib upload LPJ             | on/off             |
| Pengisian RPD Operator       | on/off             |
| Pengisian Realisasi Operator | on/off             |
| Maksimal ukuran file         | MB                 |
| Maksimal jumlah file         | angka              |
| Bulan dibuka untuk edit RPD  | multi-select bulan |

Config berlaku global kecuali nantinya project existing sudah mempunyai mekanisme berbeda.

---

# 17. LAPORAN

Laporan harus tersedia untuk:

### Admin

* 1 KUA
* seluruh KUA

### Operator

* hanya KUA sendiri

Filter:

### Periode

* 1 tahun
* 1 bulan

### Cakupan

* 1 KUA
* seluruh KUA

### Jenis nominal

* RPD
* Realisasi

### Format

* Excel `.xlsx`
* PDF

Tombol download terpisah.

---

# 18. LAPORAN PER TAHUN

Rekap satu baris per:

* POS/rincian

atau:

* KUA + POS/rincian jika memilih seluruh KUA.

Kolom nominal berisi total:

* RPD setahun

atau:

* Realisasi setahun.

---

# 19. LAPORAN DETAIL

Rincian berdasarkan:

* POS/rincian
* bulan

Format dapat berupa:

### Matrix

POS × Januari–Desember

atau:

### Tabel

POS + Bulan + Nominal

Data harus dapat digunakan untuk audit dan pengecekan detail.

---

# 20. EXPORT EXCEL & PDF

Karena frontend menggunakan GitHub Pages/static hosting, proses generate laporan sebaiknya dilakukan di client.

Gunakan library secara lazy-load hanya ketika user menekan tombol export.

Contoh:

### Excel

SheetJS / library XLSX sejenis.

### PDF

jsPDF + AutoTable atau library sejenis.

Jangan memuat library export besar pada initial page load apabila tidak diperlukan.

---

# 21. PERFORMA

Project harus hemat resource karena menggunakan layanan gratis.

Prioritas:

* minim request ke Supabase,
* query hanya kolom yang diperlukan,
* pagination bila data besar,
* caching master data di client bila aman,
* hindari query berulang,
* hindari render tabel ribuan row sekaligus,
* debounce/filter input bila diperlukan,
* lazy-load library berat,
* gunakan loading state,
* gunakan skeleton/loading indicator.

Data master seperti:

* KUA
* POS
* Config

dapat di-cache di memory/session/localStorage apabila sesuai dan tidak menimbulkan masalah keamanan/stale data.

---

# 22. UI/UX

Dashboard yang sudah ada harus dipertahankan dan ditingkatkan.

Prinsip:

* responsive,
* mobile-first,
* nyaman di HP,
* tablet,
* desktop.

Navigasi antar menu tidak boleh menyebabkan full page reload.

Gunakan:

* section show/hide,
* SPA sederhana,
* hash routing,
* atau mekanisme existing.

Tampilkan:

* loading state,
* empty state,
* error state,
* success toast,
* error toast,
* confirmation modal untuk aksi destruktif.

Contoh aksi destruktif:

* hapus RPD,
* reset password,
* aksi lain yang mengubah/menghapus data secara permanen.

---

# 23. KONTROL AKSES & RLS

Ini merupakan bagian yang sangat penting.

Supabase harus menggunakan **Row Level Security (RLS)** untuk membatasi data.

### Admin

Boleh mengakses data seluruh KUA sesuai kebutuhan.

### Operator

Hanya boleh:

`kua_id = kua_id akun yang sedang login`

RLS harus mencegah operator membaca atau memodifikasi data KUA lain walaupun user mencoba memanipulasi request secara manual melalui browser developer tools.

Jangan hanya mengandalkan:

* hidden button,
* role check di JavaScript,
* filter UI.

Security harus diterapkan pada database/backend.

---

# 24. OPTIMASI STORAGE SUPABASE

Karena saya menggunakan paket gratis, penggunaan storage harus dihemat.

Karena itu:

* jangan menyimpan file LPJ di Supabase Storage,
* jangan menyimpan log aktivitas,
* jangan membuat tabel duplikat yang tidak diperlukan,
* jangan menyimpan JSON besar yang sebenarnya dapat dihitung dari data utama,
* gunakan relasi/foreign key yang tepat,
* simpan data turunan hanya bila memang diperlukan.

Dokumen LPJ tetap berada di Google Drive.

---

# 25. STRUKTUR PROJECT

Karena project existing sudah memiliki `index.html` dan file `.mjs`, jangan memaksakan struktur baru.

Struktur akhir boleh seperti:

```text
/
├── index.html
├── *.mjs
├── css/
│   └── *.css
├── js/
│   └── *.js / *.mjs
├── assets/
├── libs/
└── sql/
    └── migration-*.sql
```

Bila project existing mempunyai struktur berbeda, **pertahankan struktur existing** selama masih baik.

Jangan memecah `index.html` menjadi `app.html` secara otomatis.

`index.html` saat ini sudah berisi:

* login page
* dashboard

dan harus tetap menjadi entry point utama aplikasi kecuali ada alasan teknis kuat.

---

# 26. API / DATA ACCESS

Karena menggunakan Supabase, tidak perlu lagi:

* Google Apps Script `doGet`
* Google Apps Script `doPost`
* router `action`
* Google Spreadsheet sebagai database.

Gunakan:

**Supabase client → PostgreSQL**

sesuai struktur database existing.

Gunakan query yang efisien dan hindari mengambil seluruh tabel apabila hanya membutuhkan sebagian data.

---

# 27. MIGRASI DARI PROMPT LAMA

Semua bagian yang sebelumnya menggunakan:

* Google Apps Script
* Google Spreadsheet
* `Code.gs`
* `Auth.gs`
* `RPD.gs`
* `Realisasi.gs`
* `Config.gs`
* `Laporan.gs`
* `LogAktivitas`

harus dianggap **sudah tidak digunakan**, kecuali ada kode existing yang memang masih diperlukan untuk integrasi tertentu.

Sumber data utama sekarang adalah:

**Supabase PostgreSQL**

Sumber dokumen LPJ:

**Google Drive**

Hosting frontend:

**GitHub Pages**

Captcha:

**Cloudflare**

---

# 28. ASUMSI YANG DIGUNAKAN

Gunakan asumsi berikut:

1. `index.html` yang saya kirim merupakan frontend existing dan harus menjadi baseline.
2. File `.mjs` yang saya kirim berisi sebagian atau seluruh logic aplikasi existing.
3. File `.sql` yang saya kirim merupakan SQL yang sudah pernah dijalankan di Supabase.
4. Database existing harus dipertahankan.
5. Akun yang sudah saya generate harus tetap digunakan.
6. Tidak perlu membuat sistem akun baru dari nol.
7. Supabase menjadi backend/database utama.
8. GitHub Pages menjadi hosting frontend.
9. Google Drive tetap menjadi lokasi penyimpanan dokumen LPJ.
10. Captcha tetap menggunakan Cloudflare.
11. Tidak ada tabel log aktivitas persisten karena saya ingin menghemat storage.
12. RLS wajib digunakan untuk keamanan data.
13. Admin dapat mengakses seluruh KUA.
14. Operator hanya dapat mengakses satu KUA.
15. AutoPayment langsung menjadi `paid`.
16. `approved → paid` dilakukan manual oleh Admin.
17. Config pengisian RPD, Realisasi, dan bulan edit RPD berlaku global.

---

# 29. ATURAN PENGERJAAN

Sebelum menulis kode:

### Tahap 1 — Audit Project Existing

Baca dan pahami:

* `index.html`
* file `.mjs`
* file `.sql`

Kemudian identifikasi:

* struktur UI,
* struktur dashboard,
* fungsi login,
* struktur role,
* koneksi Supabase,
* tabel existing,
* foreign key,
* RLS/policy,
* fungsi yang sudah tersedia,
* bagian yang belum selesai.

### Tahap 2 — Jangan merusak fitur existing

Pertahankan fungsi yang sudah bekerja.

Jangan mengganti implementasi yang sudah benar hanya karena ingin menggunakan pola kode yang berbeda.

### Tahap 3 — Tentukan gap

Buat daftar:

* fitur yang sudah tersedia,
* fitur yang masih kurang,
* bug yang harus diperbaiki,
* perubahan database yang diperlukan,
* perubahan frontend yang diperlukan.

### Tahap 4 — Implementasi

Implementasikan secara bertahap:

**Tahap 1**

Auth + role + struktur data + RLS

**Tahap 2**

RPD + Anggaran Tahunan

**Tahap 3**

Realisasi + LPJ + status verifikasi

**Tahap 4**

Admin verification + AutoPayment

**Tahap 5**

Config + laporan Excel/PDF

**Tahap 6**

Optimasi UI/UX + performa + security review

---

# 30. OUTPUT YANG SAYA INGINKAN

Setelah menganalisis file existing yang saya kirim, hasil pekerjaan harus mencakup:

### Frontend

Kode lengkap yang dapat langsung digunakan pada GitHub Pages.

Jangan hanya memberikan pseudocode.

### Supabase

SQL migration apabila memang dibutuhkan.

Jangan menghapus database existing.

Sertakan:

* tabel yang ditambahkan/diubah,
* index,
* foreign key,
* RLS,
* policy,
* function/trigger bila memang diperlukan.

### Google Drive

Implementasi integrasi sesuai arsitektur existing.

Pastikan tidak ada credential privat yang bocor ke frontend/GitHub.

### Dokumentasi

Berikan langkah setup yang jelas:

1. konfigurasi Supabase,
2. pengecekan database,
3. konfigurasi Cloudflare CAPTCHA,
4. konfigurasi Google Drive,
5. konfigurasi frontend,
6. deploy ke GitHub Pages.

---

# 31. ATURAN PALING PENTING

**JANGAN menganggap project ini sebagai project baru.**

Saya sudah memiliki:

* `index.html`
* JavaScript `.mjs`
* database Supabase
* SQL yang sudah pernah dijalankan
* akun yang sudah dibuat
* login page
* dashboard

Tugasmu adalah:

> **melanjutkan, memperbaiki, merapikan, dan melengkapi project existing tersebut.**

Bukan membuat project alternatif yang terpisah.

Sebelum membuat perubahan besar, gunakan struktur dan fungsi existing semaksimal mungkin.

Prioritas:

**Existing Code → Compatibility → Security → Functionality → Performance → UI Enhancement**

Dan bukan:

**Rewrite Everything From Scratch.**
