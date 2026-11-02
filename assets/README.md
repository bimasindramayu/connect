# assets/

## Logo dan ikon website

| Berkas | Dipakai untuk |
|---|---|
| `b-logo.png` | Ikon tab peramban (favicon), logo di halaman masuk (tinggi 48 px) dan logo di sidebar (tinggi 36 px). **Persegi 192 x 192 px, latar transparan, lambang dipangkas dari ruang kosong.** |
| `apple-touch-icon.png` | Ikon layar utama iOS ("Tambah ke Layar Utama"). 180 x 180 px dengan **latar putih** (iOS mengisi bagian transparan dengan hitam). |
| `b-logo-asli.png` | Gambar asli (450 x 360 px) sebelum dipangkas. Hanya arsip: tidak dipakai aplikasi, boleh dihapus. |

**Mengapa dipangkas?** Gambar asli punya ruang transparan yang besar di sekelilingnya: lambang "B" hanya sekitar sepertiga lebarnya. Ditampilkan apa adanya, lambang tampak sangat kecil di sidebar (sekitar 16 px) dan nyaris tak terlihat di tab. Karena itu `b-logo.png` kini berisi lambangnya saja (146 x 166 px, ukuran asli, tanpa diperbesar) di tengah kanvas persegi 192 x 192 px. Ukuran tampil diatur CSS (`css/app.css`, kelas `.brand-logo`), jadi satu berkas cukup untuk logo dan ikon tab.

**Mengganti logo** (agar tetap pas):
- Pangkas ruang kosong di sekeliling lambang, buat kanvas **persegi**, latar transparan, **192 x 192 px atau lebih** (disarankan 192 sampai 512 px, di bawah sekitar 100 KB), lalu simpan sebagai `b-logo.png`. Gambar yang jauh lebih besar (mis. 3000 px, beberapa MB) tetap tampil benar tetapi memperlambat halaman masuk. Gambar yang masih berisi ruang kosong akan tampak kecil.
- Buat juga `apple-touch-icon.png` (180 x 180 px, latar putih, lambang sekitar 70% tinggi kanvas).
- Logo lebar tetap aman (tinggi dikunci, lebar dibatasi 80 px di halaman masuk dan 64 px di sidebar; tidak terpotong dan tidak melar), tetapi akan tampak kecil. Untuk hasil terbaik pakai versi persegi (lambangnya saja).
- Berkas belum ada atau rusak: aplikasi otomatis kembali ke ikon tautan bawaan (tidak muncul gambar rusak) dan nama aplikasi tetap tampil.
- Setelah mengganti gambar: jalankan `node bump-versi.mjs` lalu unggah ulang `index.html`, supaya peramban memuat ikon baru dan bukan versi lama dari cache. Ikon tab paling lambat berganti; tutup dan buka lagi tabnya.

## logo-kemenag.png — kop surat PDF BAST NR

Letakkan **logo-kemenag.png** (logo Kementerian Agama, PNG) di sini agar kop surat PDF BAST NR memuat logo.
Tanpa berkas ini PDF tetap jadi, hanya tanpa logo. (Dokumen Sertifikat memuat logonya sendiri di dalam kodenya.)
