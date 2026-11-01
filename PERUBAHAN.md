# PERUBAHAN

Ringkasan untuk Anda yang memasang. Penjelasan teknis lengkap ada di `README.md` dan langkah pemasangan rinci di `PANDUAN-INSTALASI.md` (bagian 11).

## Pembaruan terbaru: Status Apps Script dihapus, penampil dokumen, Verifikasi, dan logo

### Ringkasan per permintaan

#### 1) Sertifikat: menu "Status Apps Script" dihapus
- Menu, halaman, dan kunci hak aksesnya (`sert-status`) dihapus dari sidebar, halaman Hak Akses Menu, dan daftar menu di database. `bop.sql` juga membersihkan hak lama yang masih tersimpan (aman diulang), jadi tidak ada sisa di tabel `hak_akses`.
- Hak bawaan peran Kemasjidan kini: Masjid / Musala, Arah Kiblat, dan Pengaturan Sertifikat. Admin dan peran lain tidak terpengaruh.
- Apps Script tidak diubah (tidak perlu deploy ulang).

#### 2) Penampil dokumen (LPJ BOP, Verifikasi, arsip BAST NR)
- **Putar tetap di halaman yang sedang dilihat dan zoom tidak berubah.** Dulu tombol putar menjalankan "pas layar": zoom mengecil dan tampilan kembali ke halaman pertama. Sekarang titik yang ada di tengah layar tetap di tengah setelah diputar (dekat tepi dokumen boleh bergeser sedikit, karena dokumen tidak diizinkan keluar dari layar).
- **Zoom maksimal jauh lebih besar**: 10 kali "pas lebar" (untuk gambar: sedikitnya 3 piksel layar untuk tiap piksel gambar asli), dan batas ini **sama sebelum dan sesudah diputar** (dulu batas atasnya ikut mengecil setelah PDF diputar).
- **Teks kecil terbaca**: saat di-zoom, bagian PDF yang tampak dirender ulang sesuai zoom, bukan gambar buram yang hanya diperbesar. Gambar (JPG/PNG) tampil setajam resolusi aslinya.
- Tombol **Pas layar** dan **Rincian** kini pas-lebar untuk halaman yang sedang dilihat (bukan selalu halaman pertama).

#### 3) Detail Verifikasi: semua POS tampil
- Rincian per POS di halaman detail Verifikasi, dan di panel Rincian pada penampil dokumen, kini memuat **semua POS**, juga POS yang tidak punya RPD maupun Realisasi pada bulan itu: angkanya tampil 0, sehingga tidak ada POS yang "hilang". Baris Total tetap jumlah semua POS.

#### 4) Logo dan ikon dari `assets/b-logo.png`
- Satu berkas dipakai untuk ikon tab peramban, ikon layar utama iOS (`apple-touch-icon`), logo di halaman masuk (tinggi 48 px), dan logo di sidebar (36 px). Ukuran diatur oleh CSS: gambar persegi maupun lebar tidak terpotong dan tidak melar, jadi **tidak perlu membuat banyak ukuran**.
- **`assets/b-logo.png` belum ada di repositori Anda dan tidak ada di paket ini** (berkasnya tidak dapat saya akses): **tambahkan sendiri**. Saran: PNG persegi 512 x 512 piksel, latar transparan, di bawah sekitar 100 KB (lihat `assets/README.md`). Sebelum berkas itu ada, aplikasi tetap rapi dengan ikon tautan bawaan.
- Nomor versi cache ikon ikut dinaikkan oleh `node bump-versi.mjs`.

#### 5) Verifikasi: total nominal di tabel
- Di bawah tabel Verifikasi ada baris **Total (N Realisasi)** yang menjumlahkan kolom Total dari baris yang **tampil** (mengikuti filter Kecamatan, Bulan, dan Status; urutan kolom tidak mengubahnya), bergaya sama dengan baris total di RPD. Bila ada Realisasi berstatus Dibayar, di kolom Status tampil jumlah **nominal yang dibayarkan** ("Dibayar: Rp ..."). Bila tidak ada hasil, hanya pesan "Tidak ada Realisasi untuk filter ini.".

### Berkas
**Diubah**: `bop.sql`, `index.html`, `css/app.css`, `js/app.js`, `js/core.js`, `js/akses.js`, `js/bop.js`, `js/sertifikat.js`, `assets/README.md`, `README.md`, `PANDUAN-INSTALASI.md`, `PERUBAHAN.md`.
**Tidak berubah**: `apps-script/` (tidak perlu deploy ulang), `supabase/functions/bop/index.ts` (tidak perlu deploy ulang), `bop.mjs`, `views/`, `package.json`, `bump-versi.mjs`.
**Sengaja tidak ada di paket (milik Anda, jangan sampai tertimpa)**: `js/config.js`, `js/sertifikat-dokumen-pdf.js`, `.gitignore`, `logo-data.js`, `assets/logo-kemenag.png`. Dan **`assets/b-logo.png`**: harus Anda tambahkan.

### Cara memasang (sekitar 10 menit)
1. **Database**: Supabase > SQL Editor > jalankan ulang seluruh `bop.sql` (aman diulang; menghapus menu Status Apps Script dari hak akses).
2. **Website**: salin berkas paket ke folder website Anda (timpa yang lama), **tambahkan `assets/b-logo.png`**, jalankan `node bump-versi.mjs`, lalu commit dan push.
3. Tidak perlu deploy ulang Apps Script maupun Edge Function.
4. Cek cepat: buka dokumen LPJ di Verifikasi, perbesar sampai teks kecil terbaca, lalu putar; buka Verifikasi dan lihat baris Total; periksa ikon di tab.

### Pengujian
Semua lulus (905 pemeriksaan otomatis): logika Jaspro 35; SQL 194 (termasuk upgrade dari versi yang masih punya menu Status Apps Script); Edge Function 143; Apps Script 58; Chromium ujung ke ujung 351 (Jaspro 44, peran 137, BOP 82 termasuk total/semua POS/penampil di aplikasi asli, BAST 41, Sertifikat 24, logo 23); dan penampil dokumen 124 (PDF 7 dan 40 halaman, ukuran campuran, gambar; rotasi di empat arah, zoom 10x, ketajaman kanvas). Penampil lama diuji sebagai **kontrol negatif** dan gagal tepat di keluhan Anda (putar mengubah zoom dan halaman, batas zoom runtuh), sehingga terbukti ujinya menangkap masalah itu.
Yang belum dapat diuji di sini: gambar `b-logo.png` Anda sendiri (diuji dengan gambar persegi dan lebar sebagai pengganti), Google Drive asli, dan perangkat sentuh sungguhan (iPhone/Android). Setelah dipasang, coba penampil dokumen sekali di ponsel.

### Penting: keamanan `akun.csv`
Repositori GitHub Anda (publik) memuat `akun.csv` berisi username dan password awal admin dan 31 Operator KUA. `.gitignore` tidak menolong karena berkas itu sudah pernah di-commit. Anggap semua password awal **sudah bocor**: reset password semua akun (Pengaturan > Daftar akun), lalu hapus berkas dari repositori (`git rm --cached akun.csv`, commit, push). Langkah lengkap ada di `PANDUAN-INSTALASI.md` bagian 4 langkah 3.

---

## Pembaruan sebelumnya: tujuh peran, Hak Akses Menu, arsip BAST di folder master, tarif Jaspro/Transport menurut tanggal, SAKTI melebihi RPD, dan pop-up di depan

Ringkasan untuk Anda yang memasang. Penjelasan teknis lengkap ada di `README.md` (bagian 3, 5, 6, 8, 14-17) dan langkah pemasangan rinci di `PANDUAN-INSTALASI.md` (bagian 11).

### 1. Ringkasan per permintaan

#### 1) Tujuh peran dan reset password oleh Admin
- Peran: **Admin, Operator KUA, Bendahara BOP, Verifikator BOP, BAST NR, Kemasjidan, PNBP NR** (nilai di database: `admin`, `operator`, `bendahara_bop`, `verifikator_bop`, `bast_nr`, `kemasjidan`, `pnbp_nr`). Operator KUA tetap terikat ke satu KUA; peran lain tidak punya KUA.
- Admin membuat akun semua peran, mengubah nama/peran/KUA, dan **mereset password akun peran mana pun** di **Pengaturan > Daftar akun** (Edge Function `buat-akun`, `ubah-akun`, `reset-password`). Password 8-72 karakter.
- Pengaman: password akun sendiri diganti lewat Pengaturan (bukan reset), peran akun sendiri tidak dapat diubah, dan Admin terakhir dijaga trigger database. Akun lama (admin dan operator) tetap berlaku tanpa perubahan.

#### 2) Menu Hak Akses Menu (khusus Admin)
- Halaman baru **Hak Akses Menu**: tabel peran dan menu. Centang menu yang boleh dibuka tiap peran, lalu **Simpan** (satu transaksi). Tombol "Kembalikan ke bawaan" hanya mencentang ulang; baru tersimpan setelah Simpan.
- Hak bawaan (diisi **sekali** oleh `bop.sql`, cocok dengan perilaku lama untuk Admin dan Operator KUA):

| Peran | Menu bawaan |
|---|---|
| Operator KUA | Halaman BOP, RPD, Realisasi, Laporan |
| Bendahara BOP | Halaman BOP, RPD (hanya lihat), Verifikasi, Realisasi SAKTI, Laporan |
| Verifikator BOP | Halaman BOP, RPD (hanya lihat), Verifikasi, Laporan |
| BAST NR | Riwayat, Buat BA, Pegawai, Pengaturan BAST |
| Kemasjidan | Masjid / Musala, Arah Kiblat, Pengaturan Sertifikat (menu Status Apps Script sudah dihapus pada pembaruan terbaru) |
| PNBP NR | Jaspro Transport |

- Aturan pemberian (ditolak database bila dilanggar): `akses` (Hak Akses Menu) dan `impor` (Impor Data Lama) khusus Admin; Operator KUA tidak dapat diberi `anggaran`, `verifikasi`, `metode`, `sakti`, `config`; `realisasi` hanya untuk Operator KUA. Admin selalu boleh semua menu, kecuali `realisasi` (mengisi Realisasi KUA sendiri khusus Operator KUA).
- Bukan sekadar menyembunyikan menu: hak ditegakkan di **database** (RLS/trigger), **Edge Function**, dan **Apps Script**. Perubahan hak berlaku langsung di database dan Edge Function, di tampilan saat halaman dimuat ulang atau login ulang, dan di Apps Script paling lama 5 menit.

#### 3) BAST NR > Riwayat: galat 403 pada unggah arsip, dan migrasi
- **Penyebab**: arsip diunggah Apps Script memakai token Google miliknya, sedangkan folder master dibuat aplikasi OAuth `bop.mjs drive` (scope `drive.file`, hanya dapat dipakai aplikasi itu). Unggahan ke folder master pun ditolak Drive (HTTP 403).
- **Perbaikan**: arsip BAST NR kini disimpan Edge Function `bop` (kredensial Google yang sama dengan LPJ BOP) **di dalam folder master**: `BIMASATU/BAST NR/<tahun>/<MM Bulan>/BAST KUA <kecamatan> - <nnn>-<tahun>.<ext>`. Apps Script hanya mencatat id dan tautan arsip di Spreadsheet (kolom `ArsipId`, `ArsipLink`, `ArsipMaster`). Mengganti arsip memindahkan yang lama ke Sampah Drive. Baris `DRIVE_MASTER_FOLDER_ID` di `Code.gs` dihapus.
- **Migrasi arsip lama**: **BAST NR > Pengaturan BAST > Arsip di folder master** menampilkan jumlah arsip yang masih di luar folder master (yang berisi file lama dan yang hanya punya tautan). Tombol pindah memprosesnya satu per satu: aman diulang (tidak menggandakan file), satu yang gagal tidak menghentikan yang lain, dapat dihentikan, dan ada pilihan membuang file lama ke Sampah Drive. Setelah pindah, arsip dilihat dari Riwayat seperti biasa.

#### 4) Jaspro Transport: tarif berubah menurut tanggal
- Di **Langkah 3: Proses & Unduh** ada pengaturan tarif: **tarif dasar** dan daftar **perubahan tarif** (tombol "Tambah perubahan tarif"). Tiap perubahan punya **tanggal mulai** (tanggal itu sendiri sudah memakai tarif baru) dan nominal Jaspro dan/atau Transport (kosong = tidak berubah). Boleh banyak perubahan (maksimum 100) dengan nominal yang berbeda-beda, dan Jaspro serta Transport boleh berubah di tanggal yang berbeda.
- Tarif tiap baris laporan ditentukan **kolom Tanggal** pada file laporan (opsional); bila tidak ada, memakai **tanggal acuan** (kosong = hari terakhir bulan laporan). Pratinjau menampilkan tarif tiap baris, dan Excel mencatat di bawah tabel bila tarif berubah di tengah bulan laporan. Perubahan tarif tersimpan bersama pengaturan (`settings.tarifRiwayat`) dan diperiksa trigger `jaspro_guard`.

#### 5) BOP > Realisasi SAKTI melebihi RPD
- **Admin dan Bendahara BOP**: nominal Realisasi SAKTI **tetap dapat disimpan** walau melebihi RPD (pembayaran SAKTI sudah terjadi). Baris yang melebihi ditandai kuning, dan muncul pemberitahuan bahwa nominal tetap tersimpan. Galat "total Realisasi ... melebihi RPD bulan ini" tidak lagi muncul untuk SAKTI.
- **Operator KUA** yang bersangkutan: tombol **Kirim nonaktif** selama Realisasi sebulan (manual + SAKTI) melebihi RPD bulan itu, atau sebuah POS melebihi RPD setahun (semua bulan, manual + SAKTI). Banner merah menampilkan POS, nominal terpakai (manual dan SAKTI), RPD setahun, dan **kelebihannya**. Aturan ini juga dijaga database (trigger `realisasi_guard`), bukan hanya tombolnya. Setelah RPD disesuaikan sehingga tidak ada kelebihan, operator dapat mengirim lagi.

#### 6) Pop-up selalu di paling depan
- Semua notifikasi (`jpToast`) kini tampil di lapisan paling atas browser (top layer), sehingga tidak tertutup dialog modal (konfirmasi, penampil dokumen LPJ/arsip, dialog Bootstrap). Berlaku di semua menu aplikasi (BOP, BAST NR, Jaspro Transport, Hak Akses Menu, Akun) karena semuanya memakai fungsi yang sama. Modul Sertifikat hanya memakai peringatan bawaan browser (`alert`) untuk galat hapus data, dan itu memang selalu tampil di depan.

### 2. Berkas

**Diubah**: `bop.sql`, `supabase/functions/bop/index.ts`, `apps-script/Code.gs`, `apps-script/Bast.gs`, `bop.mjs` (hanya teks bantuan), `index.html`, `css/app.css`, `js/core.js`, `js/akun.js`, `js/bop.js`, `js/jaspro.js`, `js/bast.js`, `js/sertifikat.js`, `README.md`, `PANDUAN-INSTALASI.md`.
**Baru**: `js/akses.js` (halaman Hak Akses Menu), `apps-script/appsscript.json` (manifes izin Apps Script; tidak ada di unggahan, padahal dokumentasi merujuknya), `PERUBAHAN.md` (berkas ini).
**Tidak berubah**: `js/app.js`, `js/arah-kiblat.js`, `js/pengaturan-sertifikat.js`, `js/sertifikat-*.js`, `apps-script/Masjid.gs`, `Kiblat.gs`, `Pengaturan.gs`, `views/`, `assets/`, `package.json`, `bump-versi.mjs`.
**`js/config.js`**: isinya templat (url, key, dan lainnya masih `ISI_...`); hanya nomor `APP_VERSI` yang dinaikkan oleh `bump-versi.mjs`. **Jangan menimpa `js/config.js` Anda dengan berkas ini**; cukup jalankan `node bump-versi.mjs` di folder website Anda sesudah berkas lain diganti. Paket ini sudah memuat nomor versi baru di `index.html`.

### 3. Cara memasang (satu jendela pemeliharaan, sekitar 30 menit)
Data tidak berubah. Urutan:
1. **Cadangan**: ekspor data Supabase dan buat salinan Spreadsheet (*File > Make a copy*).
2. **Database**: jalankan ulang seluruh `bop.sql` di SQL Editor Supabase (aman diulang).
3. **Edge Function**: `npx supabase functions deploy bop --no-verify-jwt`. Rahasia Google tidak berubah.
4. **Apps Script**: ganti isi `Code.gs` dan `Bast.gs` (`SUPABASE_URL` dan `SUPABASE_KEY` di bagian atas `Code.gs` sudah berisi nilai dari berkas Anda; pastikan masih sama dengan `js/config.js`), ganti isi `appsscript.json` dengan berkas dari paket ini (aktifkan dulu *Show "appsscript.json" manifest file* di Project Settings), jalankan `setupDatabase` lalu `authorizeAccess` (setujui izin bila diminta; daftar izin harus memuat `drive`), kemudian **Deploy > Manage deployments > Edit > Version: New version**. URL Web App tidak berubah.
5. **Website**: ganti berkas (kecuali `js/config.js`), jalankan `node bump-versi.mjs`, commit, dan push. Lakukan langkah 4 dan 5 berdekatan.
6. **Di aplikasi** (login Admin): periksa **Hak Akses Menu**, buat akun untuk peran baru di **Pengaturan > Daftar akun**, lalu pindahkan arsip lama di **BAST NR > Pengaturan BAST > Arsip di folder master**.

Bila website diperbarui sebelum `bop.sql` dijalankan, Admin melihat pita kuning "Database belum diperbarui" dan aplikasi memakai hak akses lama (Admin dan Operator KUA) sampai `bop.sql` dijalankan.

### 4. Perlu diketahui
- **Arsip lama tidak dihapus otomatis.** Berkas di Drive lama tetap ada sampai Anda memilih membuangnya saat migrasi (itu pun ke Sampah Drive, masih dapat dipulihkan).
- **Arsip lama yang tidak dapat dibaca** gagal dipindah dan dilaporkan di hasil migrasi. Migrasi membaca file lewat akun Apps Script; bila gagal, mencoba mengunduh dari tautannya (hanya berhasil bila dibagikan "siapa saja yang memiliki link"). Untuk yang tetap gagal, unggah ulang arsipnya dari Riwayat: arsip baru langsung masuk folder master.
- **Cache Apps Script 5 menit**: perubahan Hak Akses Menu bisa butuh waktu itu untuk berlaku di menu BAST NR dan Sertifikat. Database dan Edge Function langsung.
- **Hak bawaan hanya diisi sekali** per database. Menjalankan ulang `bop.sql` tidak menimpa pengaturan yang sudah Anda ubah.
- **Tidak ada pemberitahuan otomatis ke Operator KUA yang terblokir**; ia melihat banner saat membuka Realisasi. Batasan lain tercantum di `README.md` bagian 12.

### 5. Perbaikan tambahan (bug lama yang ditemukan saat uji)
- **`sertPage` (js/sertifikat.js)**: berpindah menu saat modul Sertifikat masih dimuat membuat modul berikutnya mencari elemen yang sudah dihapus (galat `addEventListener` pada `null` di `arah-kiblat.js`). Sekarang pemuatan mengikuti halaman yang sedang dibuka.
- **`boot()` (js/core.js)**: Supabase memicu `INITIAL_SESSION` dan `SIGNED_IN` hampir bersamaan, sehingga profil dan hak akses dimuat dua kali dan halaman digambar dua kali. Sekarang ada penjaga agar hanya satu yang berjalan.
- **`appsscript.json`** ditambahkan (lihat bagian 2).

### 6. Hasil pengujian
Semua lulus pada paket ini: logika tarif Jaspro 35; SQL (PostgreSQL 16) 164 pemasangan baru + 178 upgrade dari `bop.sql` versi unggahan; Edge Function 143; Apps Script (kode asli dijalankan di Node) 58; ujung ke ujung di Chromium 300 (Jaspro 44, peran dan Hak Akses Menu 137, BOP 58, BAST NR 41, Sertifikat 20). Pengujian berjalan terhadap PostgreSQL, PostgREST, Edge Function, dan kode Apps Script yang sungguhan; **Google Drive, Supabase Cloud, dan Cloudflare Turnstile ditiru**, jadi setelah memasang lakukan uji cepat di `PANDUAN-INSTALASI.md` bagian 9 (login, satu Realisasi, satu unggahan arsip BAST).
