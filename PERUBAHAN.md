# PERUBAHAN

Ringkasan untuk Anda yang memasang. Penjelasan teknis lengkap ada di `README.md` dan langkah pemasangan rinci di `PANDUAN-INSTALASI.md` (bagian 11).

## Pembaruan terbaru (patch keempat): PPPK Paruh Waktu dan jabatan tambahan Kepala/Plt. Kepala KUA

Paket ini **kumulatif**: berisi semua berkas yang diubah patch ketiga juga, jadi dapat dipasang baik sudah maupun belum memasang patch ketiga.

### Ringkasan per permintaan

#### 1) Jenis pegawai baru: **PPPK Paruh Waktu (PW)**
- Jenis ASN kini empat: **PNS, PPPK, PPPK Paruh Waktu, Honor**. Keempatnya muncul di formulir (empat pilihan), kartu angka, penyaring, tab **Rekap per KUA**, Excel, dan Statistik SDM di Dashboard. Di tabel dan kartu ditulis singkat **PPPK PW** (nama lengkapnya tampil saat kursor diarahkan) dan diberi warna ungu sendiri.
- **NIP boleh belum ada** (banyak PPPK Paruh Waktu belum memilikinya). Bila diisi, tetap harus 18 angka dan tidak boleh sama dengan pegawai lain di KUA mana pun.
- **Golongan boleh dikosongkan**; bila diisi, golongan PPPK I sampai XVII.
- PPPK Paruh Waktu tidak dapat diberi jabatan tambahan (lihat nomor 2).

#### 2) **Kepala KUA dan Plt. Kepala KUA adalah jabatan tambahan**
- Jabatan pokok pegawai (kolom **Jabatan**) kini jabatan fungsional: Penghulu, Penyuluh, dan seterusnya. Kepala KUA atau Plt. Kepala KUA dipilih di isian baru **Jabatan Tambahan** (Tidak ada / Kepala KUA / Plt. Kepala KUA) dan tampil sebagai lencana di bawah jabatan pokok pada daftar.
- **Aturannya**: hanya untuk PNS dan PPPK (tidak untuk PPPK Paruh Waktu dan Honor); **satu orang untuk tiap jabatan di tiap KUA** (satu Kepala dan satu Plt. boleh ada bersamaan); mengetik "Kepala KUA" di kolom Jabatan **ditolak** dengan petunjuk yang jelas; daftar usulan jabatan tidak lagi memuat Kepala KUA dan Plt. Kepala KUA.
- **Formulir**: di bawah pilihan Jabatan Tambahan tertulis siapa yang kini menjabat di KUA itu ("(pegawai ini)" bila yang sedang diubah adalah pemegangnya). Bila bentrok dengan orang lain, tampil peringatan merah beserta langkahnya ("Lepaskan jabatan tambahan itu dari ... terlebih dahulu").
- **Daftar dan Dashboard**: daftar diurut Kepala KUA, Plt. Kepala KUA, lalu jenis, golongan tertinggi, dan nama. Nama Kepala KUA di Profil KUA (Dashboard) dan di Rekap per KUA kini diambil dari jabatan tambahan (Plt. dipakai bila belum ada Kepala dan diberi tanda). Statistik "Jabatan" di Dashboard menghitung jabatan fungsional.
- **Transfer**: jabatan tambahan melekat pada KUA, bukan pada orangnya, jadi **dikosongkan** saat pegawai dipindahkan (dialog Transfer memberi peringatan, Riwayat mencatat "jabatan tambahan ... dilepas"). Operator KUA asal menetapkan penggantinya.
- **Data lama otomatis dikonversi satu kali**: pegawai PNS/PPPK yang jabatannya tertulis "Kepala KUA" atau "Plt. Kepala KUA" diberi jabatan tambahan itu saat `bop.sql` dijalankan. Teks di kolom Jabatan **tidak diubah** karena jabatan fungsionalnya tidak diketahui dari data lama: barisnya diberi tanda **Perlu dilengkapi**; Operator KUA tinggal klik **Ubah**, mengisi jabatan fungsionalnya (formulir sudah membantu: kolom Jabatan dikosongkan dan jabatan tambahan sudah terpilih), lalu menyimpan.

### Tafsiran yang saya pakai (mohon dicek; semuanya mudah diubah)
- **Jabatan tambahan hanya dua**: Kepala KUA dan Plt. Kepala KUA. Bila ada jabatan tambahan lain (mis. Bendahara), tambahkan di `PEG_TAMBAHAN` (`js/pegawai.js`) dan constraint `pegawai_tambahan_cek` (`bop.sql`); beri tahu saya bila ingin saya yang menambahkan.
- **Satu orang per jabatan per KUA**, jadi satu Kepala dan satu Plt. boleh bersamaan, tetapi tidak dua Kepala. Untuk mengganti, lepaskan dari pegawai lama (Ubah > Tidak ada), lalu tetapkan pada pegawai baru.
- **Plt. dari KUA lain** (pegawai KUA A yang menjabat Plt. di KUA B) **belum didukung**, sebab satu pegawai hanya terdaftar di satu KUA. Bila ini umum di Indramayu, itu perlu kolom tambahan "KUA tugas tambahan"; beri tahu saya.
- **Honor dan PPPK Paruh Waktu tidak dapat menjabat Kepala/Plt.** (hanya PNS dan PPPK): ini tafsiran saya, bukan kutipan aturan; ubah di `PEG_TAMBAHAN_JENIS` (`js/pegawai.js`) dan `pegawai_guard` (`bop.sql`) bila kenyataannya berbeda.
- **Konversi data lama berjalan sekali**, memilih pegawai yang tercatat lebih dulu bila ada dua yang tertulis Kepala di satu KUA; yang kedua dan yang berstatus Honor dilewati dan tetap bertanda "Perlu dilengkapi" (tetapkan jabatan tambahannya sendiri lewat **Ubah**). Menjalankan ulang `bop.sql` tidak mengulang konversi dan tidak menimpa perubahan Operator KUA.
- **PPPK Paruh Waktu**: NIP dan golongan boleh kosong tetapi tetap divalidasi bila diisi; kode di tabel "PPPK PW" dan warna ungu hanya tampilan.

### Berkas
**Diubah dibanding patch ketiga**: `bop.sql` (bagian 13), `js/pegawai.js`, `js/dashboard.js`, `js/akses.js` (keterangan menu), `css/app.css`, `index.html` (nomor versi untuk cache), `README.md`, `PANDUAN-INSTALASI.md`, `PERUBAHAN.md`. `js/core.js` sama dengan patch ketiga dan tetap disertakan supaya paket ini lengkap.
**Tidak ada perubahan** pada Apps Script maupun Edge Function: tidak perlu deploy ulang. **Sengaja tidak ada di paket (milik Anda, jangan sampai tertimpa)**: `js/config.js`, `js/sertifikat-dokumen-pdf.js`, `.gitignore`, `logo-data.js`, `assets/logo-kemenag.png`, `akun.csv`.

### Cara memasang (sekitar 10 menit)
1. **Database lebih dulu**: Supabase > SQL Editor > jalankan ulang seluruh `bop.sql` (aman diulang; tidak ada data yang hilang). Ini menambah kolom jabatan tambahan, jenis PPPK Paruh Waktu, aturan baru, dan mengonversi data lama satu kali.
2. **Website**: salin berkas paket ke folder website Anda (timpa yang lama), jalankan `node bump-versi.mjs`, lalu commit dan push.
3. Tidak perlu deploy ulang Apps Script maupun Edge Function. Bila website terlanjur lebih dulu, halaman Pegawai KUA serta kartu Statistik SDM dan Profil KUA di Dashboard menampilkan pesan "Database belum diperbarui ..." (kartu Realisasi dan anggaran tetap normal, tidak ada data yang rusak) sampai `bop.sql` dijalankan dan halaman dimuat ulang.
4. Cek cepat: login sebagai satu operator (mis. `kua_anjatan`) dan buka **Pegawai KUA**. Pegawai yang dulu tertulis Kepala KUA kini bertanda **Perlu dilengkapi**: klik **Ubah**, isi jabatan fungsionalnya (mis. Penghulu Ahli Muda), lalu simpan; lencana Kepala KUA tetap menempel. Tambahkan satu pegawai **PPPK Paruh Waktu** tanpa NIP, lalu lihat Dashboard: nama Kepala dan statistik keempat jenis terisi.
5. Beri tahu para Operator KUA agar melengkapi baris bertanda "Perlu dilengkapi" dan menambahkan pegawai PPPK Paruh Waktu KUA mereka.

### Pengujian
Semua lulus (1.408 pemeriksaan otomatis): logika Jaspro 35; SQL 404; Edge Function 143; Apps Script 58; Chromium ujung ke ujung 644 (Pegawai KUA dan Dashboard 248, website baru di atas database patch ketiga 15, website baru di atas database lama 9, Jaspro 44, peran 139, BOP 94, BAST 41, Sertifikat 24, logo 30); penampil dokumen 124.
Yang baru diuji: empat jenis ASN di database dan tampilan (formulir, kartu angka, penyaring, Rekap, Excel, Dashboard); PPPK Paruh Waktu dengan dan tanpa NIP/golongan; semua aturan jabatan tambahan (dua nilai saja, hanya PNS/PPPK, satu orang per jabatan per KUA termasuk simpan bersamaan, penulisan dirapikan, Kepala KUA di kolom Jabatan ditolak hanya pada isian baru atau saat jabatan diubah); transfer yang melepas jabatan tambahan beserta peringatan dan Riwayatnya; urutan daftar; label "PPPK PW" yang tetap muat di layar 1440 px; **upgrade dari database patch ketiga** (data utuh, Kepala/Plt. terkonversi sekali, menjalankan ulang tidak menimpa perubahan, baris kembar dan Honor dilewati); dan **website baru di atas database patch ketiga** (halaman tidak rusak dan hanya menampilkan pesan "Database belum diperbarui").
**Kontrol negatif**: saya sengaja merusak aturan-aturan baru itu satu per satu, **16 kali di database** (mis. indeks unik Plt. dibuang, penanda sekali-jalan konversi dibuang, transfer tidak melepas jabatan tambahan) dan **16 kali di tampilan** (mis. urutan daftar, petunjuk pemegang jabatan, label pendek), dan semuanya langsung membuat uji gagal; tiga celah uji yang sempat lolos (penanda sekali-jalan, indeks unik Plt., dan urutan daftar) saya perkuat dulu.
**Temuan saat menguji yang sudah diperbaiki**: pesan bentrok jabatan sempat berakhir dengan dua titik setelah gelar "M.Ag."; petunjuk di formulir sempat menyebut jabatan "belum ada" padahal yang sedang diubah adalah pemegangnya; label "PPPK Paruh Waktu" sempat menyorong tombol Hapus keluar layar 1440 px (kini "PPPK PW"); dan Dashboard di database lama sempat menulis "Belum diisi" untuk Kepala (kini pesan "Database belum diperbarui").
Database diuji di PostgreSQL 16 + PostgREST (mesin yang sama dengan Supabase), bukan di proyek Supabase Anda. Yang belum dapat diuji di sini: perangkat sentuh sungguhan (iPhone/Android) dan data pegawai asli Anda (diuji dengan data contoh).

### Pengingat keamanan
`akun.csv` (username dan password awal admin dan 31 Operator KUA) masih ikut tercatat di repositori GitHub Anda yang **publik**. Reset semua password lewat Pengaturan > Daftar akun, lalu `git rm --cached akun.csv`, commit, dan push (langkah lengkap di bagian "Penting: keamanan `akun.csv`" di bawah dan `PANDUAN-INSTALASI.md` bagian 4 langkah 3).

---

## Pembaruan sebelumnya (patch ketiga): menu Pegawai KUA dan Dashboard Operator KUA

### Ringkasan per permintaan

#### 1) Menu baru **Pegawai KUA** (pendataan pegawai KUA)
- **Data pokok** tiap pegawai: **nama lengkap + gelar**, **NIP**, **jenis ASN** (PNS, PPPK, Honor), **pangkat/golongan**, **jabatan**, dan **nomor HP/WA aktif**.
  - **Jabatan** berupa combobox: klik kolomnya untuk memilih jabatan yang biasa ada di KUA (Kepala KUA, Plt. Kepala KUA, Penghulu Ahli Pertama/Muda/Madya, Penyuluh Agama Islam Ahli Pertama/Muda/Madya/Non PNS, Penata dan Pengelola Layanan Operasional, Pengadministrasi Perkantoran, Pengelola Keuangan, Bendahara Pengeluaran Pembantu, Operator SIMKAH, Pranata Komputer, Arsiparis, Pelaksana, Pramubakti, Petugas Kebersihan, Petugas Keamanan, Pengemudi), atau **ketik jabatan lain sendiri**.
  - **NIP**: 18 angka (spasi boleh; tampil berkelompok), wajib untuk PNS dan PPPK, dikosongkan untuk Honor, dan **tidak boleh sama** dengan pegawai lain di KUA mana pun.
  - **Pangkat/golongan**: PNS dari I/a sampai IV/e (dengan nama pangkatnya, mis. "Penata Muda Tk. I (III/b)"); PPPK golongan I sampai XVII; Honor tidak memakainya.
  - **HP/WA**: boleh ditulis `0812...`, `+62812...`, atau dengan spasi/strip; disimpan sebagai `08xxxxxxxxxx` dan di daftar menjadi tautan WhatsApp.
- **Admin** melihat pegawai **seluruh KUA**: daftar dengan pencarian dan penyaring KUA/jenis ASN, serta tab **Rekap per KUA** (Kepala KUA, jumlah PNS/PPPK/Honor, total, dan penanda KUA yang belum mengisi; klik nama KUA untuk melihat daftarnya).
- **Operator KUA** mengelola pegawai **KUA-nya sendiri**: tambah (ada "Simpan dan tambah lagi"), **ubah**, **hapus**, dan **transfer** pegawai ke KUA lain.
- **Transfer** berlaku langsung: pegawai pindah ke KUA tujuan dan hilang dari daftar KUA asal; operator KUA tujuan langsung melihatnya (dan dapat memindahkannya kembali bila salah alamat).
- **Riwayat**: setiap tambah, ubah, transfer, dan hapus tercatat otomatis (siapa, kapan, apa; yang dihapus menyimpan salinan lengkap datanya). Operator KUA melihat riwayat yang menyangkut KUA-nya ("Pindah masuk dari ..." dan "Dipindahkan ke ...").
- Tombol **Unduh Excel** (mengikuti pencarian dan penyaring yang sedang dipakai; NIP dan HP berformat teks supaya tidak berubah menjadi angka ilmiah).
- Peran lain (mis. Bendahara) tidak mendapat menu ini kecuali Admin memberinya di Hak Akses Menu, dan itu **hanya-lihat** (semua KUA).

#### 2) **Dashboard Operator KUA** (halaman awal Operator KUA)
- **Realisasi bulan ini**: "Sudah realisasi", "Belum realisasi", atau "Realisasi ditolak" (dengan catatan verifikator), beserta status verifikasinya (menunggu, disetujui, dibayar), RPD dan Realisasi bulan ini, nominal yang sudah dibayar, dan tombol langsung ke halaman Realisasi. Sebelum tanggal 10 tertulis bahwa Realisasi baru dapat dikirim mulai tanggal 10; bila Admin menutup pengisian, tertulis demikian.
- **Realisasi dibanding anggaran BOP tahun ini**: total Realisasi tahun ini (Realisasi manual semua status ditambah SAKTI), persentase terhadap anggaran, batang progres, sisa anggaran (bila melebihi: batang penuh berwarna merah dan tertulis "Melebihi anggaran"), dan rincian per status. Bila anggaran belum ditetapkan Admin, tampil peringatan, bukan persentase.
- **Profil KUA**: nama KUA, **nama Kepala KUA** (diambil dari pegawai berjabatan Kepala KUA; Plt. diberi tanda; lengkap dengan NIP dan tautan WhatsApp), dan **alamat KUA**, yang diisi dan diubah operator lewat tombol di kartu itu (maksimal 300 karakter).
- **Statistik SDM**: total pegawai, jumlah dan persentase PNS/PPPK/Honor (angka dan batang), jabatan terbanyak, dan sebaran golongan PNS.
- Setiap Operator KUA hanya melihat angka KUA-nya sendiri (dijaga di database, bukan hanya di tampilan). Admin tidak memiliki Dashboard.

#### 3) Hak Akses Menu
- Dua kunci menu baru: `dashboard` (khusus Operator KUA) dan `pegawai`, di kelompok baru **KUA** pada matriks Hak Akses Menu. Operator KUA mendapat keduanya **satu kali** saat `bop.sql` dijalankan; bila Admin kemudian mencabutnya, menjalankan ulang `bop.sql` tidak mengembalikannya.
- Tautan logo di sidebar kini membuka halaman awal akun yang sedang masuk (Dashboard untuk Operator KUA).

### Tafsiran yang saya pakai (mohon dicek; semuanya mudah diubah)
- **Admin juga dapat menambah, mengubah, menghapus, dan memindahkan pegawai KUA mana pun** (tercatat di Riwayat), bukan hanya melihat. Permintaan hanya menyebut Admin "melihat keseluruhan"; bila Anda ingin Admin hanya-lihat, beri tahu saya.
- **Transfer langsung berlaku** tanpa persetujuan KUA tujuan, dan tercatat di Riwayat. Kalau Anda ingin alur "diajukan, lalu diterima atau ditolak operator tujuan", itu dapat ditambahkan.
- **Kepala KUA** diambil dari pegawai yang jabatannya "Kepala KUA" (yang bukan Plt. diutamakan). Bila belum ada, Dashboard menampilkan "Belum diisi" dengan petunjuknya. Karena berdasar teks jabatan, pilih jabatan dari daftar.
- **Honor** tidak memakai NIP dan pangkat/golongan; **PPPK** memakai golongan I sampai XVII.
- **"Sudah realisasi"** berarti ada Realisasi bulan ini yang sudah dikirim (menunggu, disetujui, atau dibayar). Realisasi yang ditolak ditampilkan sebagai "Realisasi ditolak". **Total tahun ini** menjumlahkan Realisasi manual semua status (yang ditolak diberi lencana sendiri di rincian) ditambah SAKTI, angka yang sama dengan halaman Realisasi.
- **Daftar usulan jabatan** adalah jabatan yang umum di KUA (Permenag tidak memberi nomenklatur baku untuk daftar ini); ubah di `PEG_JABATAN` pada `js/pegawai.js` bila perlu. Isian bebas tetap diterima.

### Berkas
**Diubah**: `bop.sql` (bagian 13 baru), `index.html`, `css/app.css`, `js/core.js`, `js/akses.js`, `README.md`, `PANDUAN-INSTALASI.md`, `PERUBAHAN.md`.
**Baru**: `js/pegawai.js`, `js/dashboard.js`.
**Tidak ada perubahan** pada Apps Script maupun Edge Function: tidak perlu deploy ulang. **Sengaja tidak ada di paket (milik Anda, jangan sampai tertimpa)**: `js/config.js`, `js/sertifikat-dokumen-pdf.js`, `.gitignore`, `logo-data.js`, `assets/logo-kemenag.png`.

### Cara memasang (sekitar 10 menit)
1. **Database**: Supabase > SQL Editor > jalankan ulang seluruh `bop.sql` (aman diulang; data tidak berubah). Ini menambah kolom alamat KUA, tabel pegawai dan riwayatnya, dan dua menu baru.
2. **Website**: salin berkas paket ke folder website Anda (timpa yang lama), jalankan `node bump-versi.mjs`, lalu commit dan push.
3. Tidak perlu deploy ulang Apps Script maupun Edge Function. Urutan 1 dan 2 tidak kritis: bila website lebih dulu, aplikasi berjalan seperti sebelumnya dan menu baru baru muncul setelah `bop.sql` dijalankan.
4. Cek cepat: login sebagai satu operator (mis. `kua_anjatan`): halaman awalnya Dashboard; buka **Pegawai KUA**, tambahkan Kepala KUA dan satu pegawai lain, isi **Alamat KUA** di Dashboard, lalu lihat Dashboard terisi. Login sebagai admin: **Pegawai KUA** menampilkan semua KUA dan tab Rekap.
5. Beri tahu para Operator KUA agar mengisi Pegawai KUA (mulai dari Kepala KUA) dan alamat KUA mereka.

### Pengujian
Semua lulus (1.237 pemeriksaan otomatis): logika Jaspro 35; SQL 330; Edge Function 143; Apps Script 58; Chromium ujung ke ujung 547 (Pegawai KUA dan Dashboard 166, website baru di atas database lama 9, Jaspro 44, peran 139, BOP 94, BAST 41, Sertifikat 24, logo 30); penampil dokumen 124. Yang baru diuji: semua aturan isian pegawai (NIP 18 angka dan unik antar KUA, Honor tanpa NIP/pangkat, HP dalam berbagai tulisan, pangkat PNS/PPPK), hak akses tiap peran di **database** (operator KUA sendiri dan KUA lain, bendahara dengan dan tanpa menu, akun tanpa login), transfer beserta batas kewenangannya (termasuk formulir basi dan KUA tujuan nonaktif), riwayat otomatis, alamat KUA, upgrade dari database versi sebelumnya (operator mendapat dua menu baru satu kali), serta tampilan: Rekap, Excel, dan **Dashboard** pada tiap keadaan (kosong, sebelum tanggal 10, pengisian ditutup, tiap status Realisasi, melebihi anggaran, Kepala KUA/Plt., banyak jabatan, menu dicabut, tanpa KUA) termasuk layar ponsel 390 px. **Kontrol negatif**: saya sengaja merusak tiga aturan (cek KUA pada transfer, kebijakan baca data pegawai, dan hitungan SAKTI di total dashboard) dan uji langsung gagal, jadi ujinya terbukti menangkap masalahnya. Uji Pegawai KUA juga diulang berkali-kali, termasuk di bawah beban CPU, tanpa hasil yang berubah.
Database diuji di PostgreSQL 16 + PostgREST (mesin yang sama dengan Supabase), bukan di proyek Supabase Anda. Yang belum dapat diuji di sini: perangkat sentuh sungguhan (iPhone/Android) dan data pegawai asli Anda (diuji dengan data contoh).

### Pengingat keamanan
`akun.csv` (username dan password awal admin dan 31 Operator KUA) masih ikut tercatat di repositori GitHub Anda yang **publik**. Reset semua password lewat Pengaturan > Daftar akun, lalu `git rm --cached akun.csv`, commit, dan push (langkah lengkap di bagian "Penting: keamanan `akun.csv`" di bawah dan `PANDUAN-INSTALASI.md` bagian 4 langkah 3).

---

## Pembaruan sebelumnya (patch kedua): kolom RPD di panel Rincian, dan logo disesuaikan

### Ringkasan per permintaan

#### 1) Penampil dokumen Realisasi: nominal RPD tiap POS di panel Rincian (`id="vwa"`)
- Panel **Rincian** di kiri dokumen kini punya kolom **RPD (Rp)** di samping **Realisasi (Rp)** untuk setiap POS, jadi Anda dapat membandingkan RPD dan Realisasi langsung sambil membaca dokumen LPJ. Berlaku di dua tempat: halaman **Realisasi** (Operator KUA, memakai isian form saat ini) dan **Detail Verifikasi**.
- Baris **Total** memuat total RPD dan total Realisasi. Ringkasan di bawah tabel tetap ada (Manual, SAKTI, RPD bulan ini).
- Realisasi yang **melebihi RPD POS itu** (dan totalnya bila melebihi RPD bulan itu) ditandai **merah**, dengan keterangan di bawah tabel. Ini hanya penanda untuk membantu membandingkan, bukan aturan baru (aturan batas tetap seperti sebelumnya). Realisasi yang di bawah atau sama dengan RPD tidak ditandai.
- Semua POS tetap tampil (RPD dan Realisasi 0 bila tidak ada). Panel dilebarkan dari 300 ke 370 px agar tiga kolom muat; di layar sempit dan ponsel panel menimpa dokumen (lebar sampai 94%). Nominal tidak pernah turun baris.

#### 2) Logo asli disesuaikan ukurannya
- Setelah `assets/b-logo.png` ada di repositori, terlihat gambarnya 450 x 360 px dengan **ruang transparan yang besar**: lambang "B" hanya sekitar sepertiga lebarnya, sehingga tampil sangat kecil (sekitar 22 px di halaman masuk dan 16 px di sidebar) dan nyaris tak terlihat di tab.
- Perbaikan: `assets/b-logo.png` kini berisi lambang yang **dipangkas** (ukuran asli, tanpa diperbesar) di kanvas persegi **192 x 192 px**; di layar lambangnya sekarang sekitar 41 px dari kotak 48 px (halaman masuk) dan 31 px dari 36 px (sidebar). **Gambar asli Anda disimpan utuh sebagai `assets/b-logo-asli.png`** (boleh dihapus; hanya arsip).
- Ikon iOS: `assets/apple-touch-icon.png` baru (180 x 180 px, **latar putih**, karena iOS mengisi bagian transparan dengan hitam). `index.html` menunjuk ke berkas ini untuk ikon layar utama.
- Gambar asli hanya 450 x 360 px (lambang 146 x 166 px), jadi 192 x 192 px sudah resolusi aslinya. Bila Anda punya versi yang lebih besar atau vektor, pangkas rapat, buat persegi, dan simpan 192 sampai 512 px sebagai `b-logo.png` (lihat `assets/README.md`).

### Berkas
**Diubah**: `js/bop.js` (panel Rincian), `css/app.css` (lebar panel), `index.html` (rujukan ikon iOS dan nomor versi), `assets/b-logo.png` (dipangkas), `assets/README.md`, `README.md`, `PANDUAN-INSTALASI.md`, `PERUBAHAN.md`.
**Baru**: `assets/apple-touch-icon.png`, `assets/b-logo-asli.png`.
**Tidak ada perubahan** pada database, Apps Script, maupun Edge Function: tidak perlu menjalankan `bop.sql` atau deploy ulang apa pun. `js/config.js` dan berkas milik Anda lainnya tidak ada di paket.

### Cara memasang (sekitar 5 menit)
1. Salin berkas paket ke folder website Anda (timpa yang lama).
2. Jalankan `node bump-versi.mjs`, lalu commit dan push.
3. Cek: buka dokumen LPJ di Realisasi (Operator KUA) atau Detail Verifikasi, tekan **Rincian**, dan lihat kolom RPD; buka halaman masuk dan lihat logo yang lebih besar. Ikon tab paling lambat berganti: tutup lalu buka lagi tabnya.

### Pengujian
Semua lulus (924 pemeriksaan otomatis): logika Jaspro 35; SQL 194; Edge Function 143; Apps Script 58; Chromium ujung ke ujung 370 (Jaspro 44, peran 137, BOP 94, BAST 41, Sertifikat 24, logo 30); penampil dokumen 124. Yang baru: kolom RPD di panel Rincian pada halaman Realisasi dan Detail Verifikasi (angka tiap POS, total, penanda merah, tata letak di layar 1440, 800, dan 375 px) dan uji logo asli proyek. Kontrol negatif: kode panel patch pertama gagal di 11 pemeriksaan baru, dan gambar logo asli yang belum dipangkas gagal di 5 pemeriksaan logo, jadi ujinya terbukti menangkap masalahnya.
Yang belum dapat diuji di sini: perangkat sentuh sungguhan (iPhone/Android) dan Google Drive asli.

---

## Pembaruan sebelumnya lagi (patch pertama): Status Apps Script dihapus, penampil dokumen, Verifikasi, dan logo

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
- `assets/b-logo.png` kemudian Anda tambahkan ke repositori. Gambarnya ternyata berruang kosong besar sehingga lambang tampak kecil; itu diperbaiki di patch kedua (di atas): gambar dipangkas dan disimpan ulang sebagai `b-logo.png`.
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

## Pembaruan sebelum itu: tujuh peran, Hak Akses Menu, arsip BAST di folder master, tarif Jaspro/Transport menurut tanggal, SAKTI melebihi RPD, dan pop-up di depan

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
