# assets/

## b-logo.png — logo dan ikon website

Letakkan **b-logo.png** di folder ini (`assets/b-logo.png`). Satu berkas dipakai untuk semuanya:

| Dipakai di | Ukuran tampil |
|---|---|
| Ikon tab peramban (favicon) | mengikuti peramban (16–32 px) |
| Ikon layar utama iOS (apple-touch-icon) | mengikuti iOS (sekitar 180 px) |
| Logo di halaman masuk | tinggi 48 px |
| Logo di sidebar | tinggi 36 px |

Ukuran tampil diatur oleh CSS (`css/app.css`, kelas `.brand-logo`), bukan oleh berkas, sehingga **tidak perlu membuat beberapa ukuran**. Yang perlu diperhatikan:

- **Saran: PNG persegi 512 × 512 piksel, latar transparan, di bawah ± 100 KB.** Gambar yang jauh lebih besar (misalnya 3000 piksel, beberapa MB) tetap tampil benar tetapi membuat halaman masuk dan ikon tab lambat dimuat; kecilkan dulu (mis. di squoosh.app) bila lebih besar dari 1024 piksel.
- **Logo lebar juga aman**: tinggi dikunci, lebar mengikuti gambar tetapi dibatasi 80 px (halaman masuk) dan 64 px (sidebar). Gambar tidak pernah terpotong atau melar. Untuk hasil terbaik sediakan versi persegi (lambangnya saja) karena logo lebar jadi kecil.
- **Berkas belum ada atau rusak**: aplikasi otomatis kembali ke ikon tautan bawaan (tidak muncul gambar rusak) dan nama aplikasi tetap tampil.
- **Setelah mengganti gambar**: jalankan `node bump-versi.mjs` lalu unggah ulang `index.html`, supaya peramban memuat ikon baru dan bukan versi lama dari cache. Ikon tab biasanya paling lambat berganti; tutup dan buka lagi tabnya.

## logo-kemenag.png — kop surat PDF BAST NR

Letakkan **logo-kemenag.png** (logo Kementerian Agama, PNG) di sini agar kop surat PDF BAST NR memuat logo.
Tanpa berkas ini PDF tetap jadi, hanya tanpa logo. (Dokumen Sertifikat memuat logonya sendiri di dalam kodenya.)
