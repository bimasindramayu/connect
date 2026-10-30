/* =====================================================================================
   bast.js: menu BAST NR (menu bast, bast-buat, bast-pegawai, bast-setting; diatur di Hak Akses Menu)
   Data di Spreadsheet lewat Apps Script (gas() di core.js; backend: apps-script/Bast.gs). BX = logika asli yang disalin apa adanya.
   ARSIP dokumen tertandatangan disimpan di FOLDER MASTER Google Drive (satu folder dengan LPJ BOP) oleh Edge Function bop (api() di
   core.js: bast-upload, bast-file, bast-hapus, bast-salin); Apps Script hanya mencatat id-nya (bastArsipSet). Arsip lama (diunggah
   versi sebelumnya ke folder lain) tetap terbaca dan dapat dipindahkan ke folder master dari Pengaturan BAST.
   ===================================================================================== */

/* ====== BAST NR: Berita Acara Serah Terima Sarana Administrasi NR ======
   Data: Spreadsheet + Apps Script (Bast.gs; sheet BastPegawai, BastBA, BastSetting). Arsip dokumen: folder master Google Drive lewat Edge Function.
   BX = kode lama (script.js + pdf.js) yang disalin apa adanya: format nomor surat, alamat lengkap, dan PDF resmi. */
const BX = (() => {
  let _settingsCache = {}, _pegawaiCache = [];
const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const JABATAN_BIMAS = [
  'Kepala Seksi Bimas', 'Penyuluh Agama Kristen', 'Penyuluh Agama Katolik',
  'JFU', 'JFT', 'Badan Penyelenggara Jaminan Produk Halal', 'Pengelola Pengadaan Barang dan Jasa'
];
const JABATAN_KUA = [
  'Kepala KUA', 'Plt. Kepala KUA', 'Penghulu', 'Penyuluh Agama Islam', 'JFU',
  'Pengadministrasi', 'Pengelola Umum Operasional', 'Penata Layanan Operasional',
  'Operator Layanan Operasional', 'Operator KUA', 'Tenaga Administrasi', 'Staf KUA', 'Honorer'
];
const ALAMAT_BIMAS_DEFAULT = 'Jl. Olah Raga No. 03, Kelurahan Karanganyar, Kecamatan Indramayu, Kabupaten Indramayu';
const KUA_LIST = [
  { nama: 'Anjatan', alamat: 'Jl. Raya Cilandak No. 31, Kecamatan Anjatan, Kabupaten Indramayu' },
  { nama: 'Arahan', alamat: 'Jl. Raya Cidempet, Kecamatan Arahan, Kabupaten Indramayu' },
  { nama: 'Balongan', alamat: 'Jl. Raya Tegalurung KM. 06, Kecamatan Balongan, Kabupaten Indramayu' },
  { nama: 'Bangodua', alamat: 'Jl. Raya Curug-Tegalgirang No. 68, Kecamatan Bangodua, Kabupaten Indramayu' },
  { nama: 'Bongas', alamat: 'Jl. Kertajaya No. 01, Kecamatan Bongas, Kabupaten Indramayu' },
  { nama: 'Cantigi', alamat: 'Jl. Raya Cantigi Kulon, Desa Cantigi Kulon, Kecamatan Cantigi, Kabupaten Indramayu' },
  { nama: 'Cikedung', alamat: 'Jl. Raya Cikedung, Kecamatan Cikedung, Kabupaten Indramayu' },
  { nama: 'Gabuswetan', alamat: 'Jl. PU Saradan No. 371, Kecamatan Gabuswetan, Kabupaten Indramayu' },
  { nama: 'Gantar', alamat: 'Jl. Raya Gantar KM. 07, Kecamatan Gantar, Kabupaten Indramayu' },
  { nama: 'Haurgeulis', alamat: 'Jl. Jendral Sudirman No. 35, Kecamatan Haurgeulis, Kabupaten Indramayu' },
  { nama: 'Indramayu', alamat: 'Jl. Wiralodra No. 09, Kelurahan Lemah Mekar, Kecamatan Indramayu, Kabupaten Indramayu' },
  { nama: 'Jatibarang', alamat: 'Jl. Raya Jatisawit Blok Karang Malang, Kecamatan Jatibarang, Kabupaten Indramayu' },
  { nama: 'Juntinyuat', alamat: 'Jl. Raya Juntinyuat No. 6, Kecamatan Juntinyuat, Kabupaten Indramayu' },
  { nama: 'Kandanghaur', alamat: 'Jl. Raya Ilir Kandanghaur No. 14, Kecamatan Kandanghaur, Kabupaten Indramayu' },
  { nama: 'Karangampel', alamat: 'Jl. Raya Dampuawang No. 131, Kecamatan Karangampel, Kabupaten Indramayu' },
  { nama: 'Kedokan Bunder', alamat: 'Jl. Raya Cangkingan KM. 3,5, Kecamatan Kedokan Bunder, Kabupaten Indramayu' },
  { nama: 'Kertasemaya', alamat: 'Jl. Raya Bondan No. 09, Kecamatan Kertasemaya, Kabupaten Indramayu' },
  { nama: 'Krangkeng', alamat: 'Jl. Raya Krangkeng No. 06, Kecamatan Krangkeng, Kabupaten Indramayu' },
  { nama: 'Kroya', alamat: 'Jl. Raya Pejaten, Kecamatan Kroya, Kabupaten Indramayu' },
  { nama: 'Lelea', alamat: 'Jl. Raya Lelea-Tugu No. 13, Kecamatan Lelea, Kabupaten Indramayu' },
  { nama: 'Lohbener', alamat: 'Jl. Raya Lohbener No. 10, Kecamatan Lohbener, Kabupaten Indramayu' },
  { nama: 'Losarang', alamat: 'Jl. Turangga Bahari No. 2, Desa Jangga, Kecamatan Losarang, Kabupaten Indramayu' },
  { nama: 'Pasekan', alamat: 'Jl. Pattimura No. 2003, Karanganyar, Kecamatan Pasekan, Kabupaten Indramayu' },
  { nama: 'Patrol', alamat: 'Jl. Raya Patrol KM. 46, Kecamatan Patrol, Kabupaten Indramayu' },
  { nama: 'Sindang', alamat: 'Jl. Singalodra No. 4, Kecamatan Sindang, Kabupaten Indramayu' },
  { nama: 'Sliyeg', alamat: 'Jl. Siliwangi No. 133, Kecamatan Sliyeg, Kabupaten Indramayu' },
  { nama: 'Sukagumiwang', alamat: 'Jl. Raya Sukagumiwang, Kecamatan Sukagumiwang, Kabupaten Indramayu' },
  { nama: 'Sukra', alamat: 'Jl. Raya Pantura, Bogeg 005/001, Karanglayung, Kecamatan Sukra, Kabupaten Indramayu' },
  { nama: 'Terisi', alamat: 'Jl. Raya Rajasinga No. 030, Kecamatan Terisi, Kabupaten Indramayu' },
  { nama: 'Tukdana', alamat: 'Jl. Raya Karangkerta No. 06, RT 03/RW 02, Desa Karangkerta, Kecamatan Tukdana, Kabupaten Indramayu' },
  { nama: 'Widasari', alamat: 'Jl. Komplek Masjid Jami\' Miftahul Jannah, Desa Kongsijaya No. 1, Kecamatan Widasari, Kabupaten Indramayu' }
];
const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
function getIndonesianDayName(date) { return HARI_ID[date.getDay()]; }
function getIndonesianMonthName(date) { return BULAN_ID[date.getMonth()]; }
function pad3(n) { return String(n).padStart(3, '0'); }
function buildNomorSuratLengkap(nomorUrut, bulanSurat, tahun, settings) {
  const s = settings || _settingsCache || {};
  const template = s.NOMOR_FORMAT_TEMPLATE ||
    'B.{NOMOR}/{KODE_KANTOR}/{BULAN_ROMAWI}/{KODE_KLASIFIKASI}/{BULAN_ANGKA}/{TAHUN}';
  const bulanNum = parseInt(bulanSurat, 10);
  return template
    .replace('{NOMOR}', pad3(parseInt(nomorUrut, 10)))
    .replace('{KODE_KANTOR}', s.KODE_KANTOR || '')
    .replace('{BULAN_ROMAWI}', ROMAN_NUMERALS[bulanNum] || '')
    .replace('{KODE_KLASIFIKASI}', s.KODE_KLASIFIKASI || '')
    .replace('{BULAN_ANGKA}', String(bulanNum).padStart(2, '0'))
    .replace('{TAHUN}', String(tahun));
}
function resolveKuaNamaUntukPihakKedua_(pihakKeduaNip, pihakKeduaJabatan) {
  const p = _pegawaiCache.find((x) => x.nip === pihakKeduaNip);
  if (p && p.kua) return p.kua;
  const jabatanUpper = String(pihakKeduaJabatan || '').toUpperCase();
  const found = KUA_LIST.find((k) => jabatanUpper.indexOf(k.nama.toUpperCase()) !== -1);
  return found ? found.nama : '';
}
function getKuaLabelForRecord_(r) {
  return resolveKuaNamaUntukPihakKedua_(r.pihakKeduaNip, r.pihakKeduaJabatan);
}
function getTempatKerjaLabel_(nip, jabatanFallback, kategoriKonteks) {
  const p = _pegawaiCache.find((x) => x.nip === nip);
  if (p && p.kategori === 'KUA') return 'KUA Kecamatan ' + (p.kua || '(kecamatan tidak diketahui)');
  if (p && p.kategori === 'Bimas Islam') return 'Seksi Bimas Islam';

  if (kategoriKonteks === 'Bimas Islam') return 'Seksi Bimas Islam';
  if (kategoriKonteks === 'KUA') {
    const kuaNama = resolveKuaNamaUntukPihakKedua_(nip, jabatanFallback);
    return kuaNama ? ('KUA Kecamatan ' + kuaNama) : 'KUA Kecamatan (tidak diketahui)';
  }
  return '-';
}
function alamatSudahLengkap_(alamat) {
  const upper = String(alamat || '').toUpperCase();
  return upper.indexOf('KECAMATAN') !== -1 && upper.indexOf('KABUPATEN') !== -1;
}
function resolveAlamatLengkapPihakKedua_(record) {
  const raw = String(record.pihakKeduaAlamat || '').trim();
  const kuaNama = resolveKuaNamaUntukPihakKedua_(record.pihakKeduaNip, record.pihakKeduaJabatan);
  const kuaData = KUA_LIST.find((k) => k.nama === kuaNama);
  if (kuaData) return kuaData.alamat;
  if (raw && alamatSudahLengkap_(raw)) return raw;
  if (raw && kuaNama) return raw + ', Kecamatan ' + kuaNama + ', Kabupaten Indramayu';
  return raw || '-';
}
function resolveAlamatLengkapPihakSatu_(record) {
  const raw = String(record.pihakSatuAlamat || '').trim();
  if (raw && alamatSudahLengkap_(raw)) return raw;
  const fallback = (_settingsCache && _settingsCache.ALAMAT_BIMAS_LENGKAP) || '';
  if (fallback) return fallback;
  return raw || ALAMAT_BIMAS_DEFAULT;
}
/* ---- pdf.js (apa adanya) ---- */
/**
 * pdf.js
 * ============================================================================
 * Menghasilkan PDF Berita Acara Serah Terima Sarana Administrasi NR yang
 * tampilannya mengikuti contoh dokumen resmi (kop surat, tabel, tanda
 * tangan). Dipakai dari halaman Riwayat (tombol Download PDF / Lihat).
 *
 * Bergantung pada jsPDF + jsPDF-AutoTable (dimuat via CDN di index.html)
 * dan pada beberapa fungsi/konstanta global dari script.js: ROMAN_NUMERALS,
 * buildNomorSuratLengkap(), pad3(), _settingsCache. File ini HARUS dimuat
 * setelah script.js.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// Loader jsPDF/AutoTable dengan fallback multi-CDN.
// ----------------------------------------------------------------------------
// index.html sudah memuat kedua pustaka lewat <script> statis (cdnjs) supaya
// siap lebih cepat — tapi beberapa jaringan kantor/instansi memblokir domain
// CDN tertentu, jadi kalau itu gagal (window.jspdf belum ada saat tombol
// diklik), fungsi ini mencoba memuat ULANG secara dinamis dari cdnjs lalu
// jsdelivr (penyedia infrastruktur berbeda) sebelum benar-benar menyerah.
function loadScriptOnce_(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat ' + url));
    document.head.appendChild(script);
  });
}

function hasAutoTable_() {
  return !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && typeof window.jspdf.jsPDF.API.autoTable === 'function');
}

async function ensureJsPdfLoaded_() {
  if (hasAutoTable_()) return; // sudah lengkap (dari <script> statis di index.html atau percobaan sebelumnya)

  if (!window.jspdf) {
    const jsPdfSources = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'
    ];
    for (const src of jsPdfSources) {
      try { await loadScriptOnce_(src); if (window.jspdf) break; } catch (e) { /* coba sumber berikutnya */ }
    }
    if (!window.jspdf) {
      throw new Error('Gagal memuat pustaka jsPDF dari cdnjs.cloudflare.com maupun cdn.jsdelivr.net. ' +
        'Kemungkinan jaringan ini memblokir kedua domain tsb — coba jaringan lain, atau minta admin IT membuka akses ke keduanya.');
    }
  }

  if (!hasAutoTable_()) {
    const autoTableSources = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
    ];
    for (const src of autoTableSources) {
      try { await loadScriptOnce_(src); if (hasAutoTable_()) break; } catch (e) { /* coba sumber berikutnya */ }
    }
    if (!hasAutoTable_()) {
      throw new Error('Gagal memuat pustaka jsPDF-AutoTable dari cdnjs.cloudflare.com maupun cdn.jsdelivr.net.');
    }
  }
}

// Kop surat butuh logo Kemenag. Dicoba berurutan, paling andal duluan:
//
//  1. Konstanta LOGO_BASE64 dari logo-data.js — dihasilkan sekali lewat
//     assets/logo-converter.html. Ini PALING ANDAL karena logo sudah jadi
//     bagian dari kode (bukan file yang perlu dimuat saat runtime), jadi
//     tidak mungkin kena masalah file:// apa pun. Ini cara yang disarankan
//     — kalau logo tidak muncul, inilah yang seharusnya dijalankan dulu.
//  2. fetch() ke assets/logo-kemenag.png — TERBUKTI selalu diblokir CORS
//     oleh Chrome dkk. saat aplikasi dibuka lewat file:// ("Cross origin
//     requests are only supported for protocol schemes: chrome, ... " —
//     skema "file" memang tidak masuk daftar yang diizinkan sama sekali).
//     Jadi langkah ini SENGAJA DILEWATI kalau halaman sedang berjalan dari
//     file://, supaya tidak memunculkan error CORS di console yang sudah
//     pasti gagal — hanya dicoba kalau aplikasi suatu saat di-hosting via
//     http/https, di mana fetch() ini justru bisa berhasil.
//  3. <img> + canvas — cara paling lama, tapi browser tertentu memperlakukan
//     tiap URL file:// sebagai origin unik sehingga canvas.toDataURL() bisa
//     gagal walau gambarnya berhasil TAMPIL sebagai <img>.
//
// Kalau ketiganya gagal, mengembalikan null (bukan melempar error) supaya
// PDF tetap bisa dibuat tanpa logo daripada gagal total.
async function loadLogoAsDataUrl_(path) {
  if (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) {
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = LOGO_BASE64;
    });
    if (dims) return { dataUrl: LOGO_BASE64, width: dims.width, height: dims.height };
  }

  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('gagal membaca blob logo'));
          reader.readAsDataURL(blob);
        });
        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = dataUrl;
        });
        if (dims) return { dataUrl: dataUrl, width: dims.width, height: dims.height };
      }
    } catch (e) {
      // lanjut ke cara 3
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
      } catch (e) {
        resolve(null); // kedua cara gagal -> PDF tetap dibuat tanpa logo
      }
    };
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

function pdfWriteWrapped_(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// Menulis baris "Label : Nilai" sejajar kolon, meniru gaya contoh dokumen
// ("Nama : TIEN JUNIARSIH", "NIP. : 197906..."). Kalau Nilai lebih panjang
// dari sisa ruang sampai maxRightX, dibungkus ke baris berikutnya — baris
// lanjutan tetap RATA dengan awal Nilai (bukan rata Label), dan berhenti
// TEPAT di maxRightX yang sama dipakai teks lain di dokumen ini (lihat
// pdfWriteWrapped_ untuk paragraf Pembuka/Penutup, dipanggil dengan batas
// kanan yang sama: pageWidth - marginRight).
//
// PERBAIKAN BUG: sebelum ini, fungsi hanya doc.text(nilai, x, y) tanpa
// maxWidth sama sekali — aman selama Nilai selalu pendek, tapi begitu
// Alamat mulai mencantumkan Kecamatan+Kabupaten (lihat
// resolveAlamatLengkapPihak...()), banyak Alamat jadi cukup panjang untuk
// meluber melewati batas kanan yang dipakai paragraf lain di halaman yang
// sama, membuat baris Alamat terlihat "nyeberang" / tidak sejajar dengan
// sisa dokumen. splitTextToSize() dulu sebelum ditulis (persis seperti
// pdfWriteWrapped_) memastikan baris SELALU berhenti di batas yang sama.
function pdfWriteFieldLine_(doc, label, value, x, y, labelWidth, maxRightX) {
  const valueX = x + labelWidth + 3;
  doc.text(label, x, y);
  doc.text(':', x + labelWidth, y);
  const text = String(value === undefined || value === null || value === '' ? '-' : value);
  const lines = doc.splitTextToSize(text, maxRightX - valueX);
  doc.text(lines, valueX, y);
  return y + lines.length * 5;
}

// Data Pegawai menyimpan Jabatan bersih ("JFU") terpisah dari unit
// kerjanya (Kategori/KUA) — pemisahan itu perlu untuk combobox & filter
// dropdown, tapi dokumen resmi perlu mencetak keduanya sekaligus, persis
// seperti data lama ("JFU Pada Seksi Bimas Islam"). Fungsi ini merakitnya
// kembali KHUSUS untuk dicetak, tanpa mengubah data Pegawai yang tersimpan.
//
// PERBAIKAN BUG: sebagian data Jabatan (entri lama/migrasi atau yang
// diketik manual) TERNYATA sudah menyertakan nama unit kerjanya sendiri,
// mis. "Penghulu KUA Patrol" atau "JFU Pada Seksi Bimas Islam". Kalau
// akhirannya ditempel begitu saja tanpa dicek, hasilnya dobel ("...Pada
// Seksi Bimas Islam Pada Seksi Bimas Islam"). Jadi sebelum menempelkan
// akhiran, cek dulu apakah teks jabatan SUDAH menyebut unit kerja terkait
// — kalau sudah, biarkan apa adanya.
function formatJabatanUntukCetak_(nip, jabatanMentah) {
  const cache = (typeof _pegawaiCache !== 'undefined') ? _pegawaiCache : [];
  const pegawai = cache.find((p) => p.nip === nip);
  const jabatan = jabatanMentah || '-';
  if (!pegawai) return jabatan;
  const jabatanUpper = jabatan.toUpperCase();
  if (pegawai.kategori === 'Bimas Islam') {
    if (jabatanUpper.indexOf('BIMAS ISLAM') !== -1) return jabatan;
    return jabatan + ' Pada Seksi Bimas Islam';
  }
  if (pegawai.kategori === 'KUA') {
    const kua = pegawai.kua || '';
    // Hanya cek nama kecamatan KUA-nya sendiri (bukan cek kata "KUA" secara
    // umum) — supaya jabatan bersih yang memang mengandung kata "KUA" apa
    // adanya (mis. "Operator KUA") tetap ditempeli lokasi seperti biasa.
    if (kua && jabatanUpper.indexOf(kua.toUpperCase()) !== -1) return jabatan;
    return jabatan + ' Pada KUA ' + kua;
  }
  return jabatan;
}

/**
 * record: objek dari Api.getBeritaAcara() (satu baris) — lihat bentuknya di
 * getBeritaAcara() pada Code.gs.
 * Mengembalikan instance jsPDF (dipanggil dari script.js untuk .save() atau
 * diambil sebagai blob untuk diunggah ke Drive).
 */
async function generateBeritaAcaraPdf(record) {
  await ensureJsPdfLoaded_();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = 210;
  const marginLeft = 20, marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const settings = _settingsCache || {};
  let y = 10;

  const logo = await loadLogoAsDataUrl_('assets/logo-kemenag.png');

// ---------------- KOP SURAT ----------------
if (logo) {
  const maxLogoW = 24, maxLogoH = 22;
  let logoW = maxLogoW;
  let logoH = logoW * (logo.height / logo.width);

  if (logoH > maxLogoH) {
    logoH = maxLogoH;
    logoW = logoH * (logo.width / logo.height);
  }

  doc.addImage(logo.dataUrl, 'PNG', marginLeft, y - 3, logoW, logoH);
}

const headerX = pageWidth / 2 + 8;

// Nama instansi
doc.setFont('times', 'bold');
doc.setFontSize(13);
doc.text(
  'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
  headerX, y,
  { align: 'center' }
);

y += 5;
doc.setFontSize(13);
doc.text(
  'KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU',
  headerX, y,
  { align: 'center' }
);

// Alamat
y += 5;
doc.setFont('times', 'normal');
doc.setFontSize(11);
doc.text(
  'Jalan Olahraga Nomor 3 Indramayu 45213',
  headerX, y,
  { align: 'center' }
);

y += 4.5;
doc.text(
  'Telp. (0234) 272033, 272073, Faximile (0234) 272033',
  headerX, y,
  { align: 'center' }
);

// Email
y += 4.5;
doc.setFont('times', 'bolditalic');
doc.setFontSize(11);
doc.text(
  'Email : bimasindramayu@gmail.com',
  headerX, y,
  { align: 'center' }
);

y += 3;

  doc.setLineWidth(0.8);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 1.1;
  doc.setLineWidth(0.2);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // ---------------- JUDUL ----------------
  const nomorLengkap = buildNomorSuratLengkap(record.nomorUrut, record.blnSrt, record.tahun, settings);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(14);
  doc.text('BERITA ACARA SERAH TERIMA SARANA ADMINISTRASI NR', pageWidth / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFontSize(12);
  doc.text('NOMOR : ' + nomorLengkap, pageWidth / 2, y, { align: 'center' });
  y += 9;

  // ---------------- PEMBUKA ----------------
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  const pembuka = 'Pada hari ini ' + record.hari + ' tanggal ' + record.tgl + ' Bulan ' + record.bln +
    ' tahun ' + record.tahun + ', kami yang bertanda tangan di bawah ini :';
  y = pdfWriteWrapped_(doc, pembuka, marginLeft, y, contentWidth, 5) + 3;

  // ---------------- PIHAK PERTAMA ----------------
  const fieldMaxRightX = pageWidth - marginRight; // batas kanan yang sama dipakai pdfWriteWrapped_ di atas & bawah
  y = pdfWriteFieldLine_(doc, 'Nama', record.pihakSatuNama, marginLeft, y, 22, fieldMaxRightX);
  y = pdfWriteFieldLine_(doc, 'NIP.', record.pihakSatuNip, marginLeft, y, 22, fieldMaxRightX);
  y = pdfWriteFieldLine_(doc, 'Jabatan', formatJabatanUntukCetak_(record.pihakSatuNip, record.pihakSatuJabatan), marginLeft, y, 22, fieldMaxRightX);
  // Alamat dirakit lewat resolveAlamatLengkapPihakSatu_() (script.js), BUKAN
  // langsung record.pihakSatuAlamat — supaya PASTI menyertakan Kecamatan &
  // Kabupaten walau data pegawai yang tersimpan (banyak berasal dari migrasi
  // Master lama) masih versi pendek. Lihat komentar lengkap di script.js.
  y = pdfWriteFieldLine_(doc, 'Alamat', resolveAlamatLengkapPihakSatu_(record), marginLeft, y, 22, fieldMaxRightX);
  y += 3;
  doc.text('SELANJUTNYA DISEBUT PIHAK PERTAMA :', marginLeft, y);
  y += 7;

  // ---------------- PIHAK KEDUA ----------------
  y = pdfWriteFieldLine_(doc, 'Nama', record.pihakKeduaNama, marginLeft, y, 22, fieldMaxRightX);
  y = pdfWriteFieldLine_(doc, 'NIP.', record.pihakKeduaNip, marginLeft, y, 22, fieldMaxRightX);
  y = pdfWriteFieldLine_(doc, 'Jabatan', formatJabatanUntukCetak_(record.pihakKeduaNip, record.pihakKeduaJabatan), marginLeft, y, 22, fieldMaxRightX);
  // Sama seperti Pihak Pertama di atas — resolveAlamatLengkapPihakKedua_()
  // mengutamakan alamat resmi dari KUA_LIST (sudah pasti lengkap dengan
  // Kecamatan+Kabupaten) berdasarkan KUA pegawainya, bukan teks Alamat lama
  // yang tersimpan apa adanya.
  y = pdfWriteFieldLine_(doc, 'Alamat', resolveAlamatLengkapPihakKedua_(record), marginLeft, y, 22, fieldMaxRightX);
  y += 3;
  doc.text('SELANJUTNYA DISEBUT PIHAK KEDUA .', marginLeft, y);
  y += 8;

  doc.text('PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA berupa sarana NR sebanyak :', marginLeft, y);
  y += 4;

  // ---------------- TABEL ----------------
  // Struktur baru per arahan langsung: satu baris PER KOMPONEN (NA/N/NB —
  // komponen DN sudah tidak dipakai lagi), bukan satu baris dengan kolom
  // terpisah untuk tiap komponen seperti template lama. "Pasang" tidak
  // pernah tercatat di data manapun untuk komponen apa pun, jadi selalu
  // "-"; nilai yang diinput selalu masuk ke sub-kolom "Buku". Seri & Nomor
  // Porporasi hanya dicetak SEKALI, di baris pertama yang muncul (nilainya
  // memang satu untuk seluruh BA, bukan per komponen) — baris berikutnya
  // "-". Komponen dengan nilai kosong/nol tidak dibuatkan barisnya sama
  // sekali (kalau cuma NA yang diisi, tabel hanya 1 baris).
  const komponenRows = [];
  if (record.banyakNaBuku) komponenRows.push({ label: 'NA', jumlah: record.banyakNaBuku });
  if (record.banyakN) komponenRows.push({ label: 'N', jumlah: record.banyakN });
  if (record.banyakNb) komponenRows.push({ label: 'NB', jumlah: record.banyakNb });
  if (!komponenRows.length) komponenRows.push({ label: '-', jumlah: '-' });

  const tableBody = komponenRows.map((k, i) => [
    String(i + 1),
    k.label,
    '-',
    String(k.jumlah),
    i === 0 ? (record.noSeri || '-') : '-',
    i === 0 ? (record.porporasi || '-') : '-',
    '-'
  ]);

  doc.autoTable({
    startY: y,
    margin: { left: marginLeft, right: marginRight },
    styles: { font: 'times', fontSize: 10, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
    theme: 'grid',
    head: [
      [
        { content: 'No', rowSpan: 2 },
        { content: 'Komponen', rowSpan: 2 },
        { content: 'Banyaknya', colSpan: 2 },
        { content: 'Seri', rowSpan: 2 },
        { content: 'Nomor Porporasi', rowSpan: 2 },
        { content: 'Ket', rowSpan: 2 }
      ],
      [
        { content: 'Pasang' }, { content: 'Buku' }
      ]
    ],
    body: tableBody
  });
  y = doc.lastAutoTable.finalY + 6;

  // ---------------- PENUTUP ----------------
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  y = pdfWriteWrapped_(doc, 'PIHAK KEDUA telah menerima barang tersebut sesuai dengan jumlah dan kondisi sebagaimana di atas.', marginLeft, y, contentWidth, 5) + 3;
  y = pdfWriteWrapped_(doc, 'Demikian Berita Acara serah terima ini dibuat rangkap 2 (dua) selanjutnya ditandatangani oleh PIHAK-PIHAK yang berkepentingan untuk dipergunakan sebagaimana mestinya.', marginLeft, y, contentWidth, 5) + 10;

  // Pindah halaman kalau ruang tanda tangan tidak cukup lagi.
  if (y > 250) { doc.addPage(); y = 20; }

  // ---------------- TANDA TANGAN ----------------
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  const colRightX = pageWidth / 2 + 10;
  doc.text('Yang menerima,', marginLeft, y);
  doc.text('Yang menyerahkan,', colRightX, y);
  y += 5;
  doc.text('PIHAK KEDUA', marginLeft, y);
  doc.text('PIHAK PERTAMA', colRightX, y);
  y += 22;
  doc.setFont('times', 'bold');
  doc.text(String(record.pihakKeduaNama || ''), marginLeft, y);
  doc.text(String(record.pihakSatuNama || ''), colRightX, y);
  y += 5;
  doc.setFont('times', 'normal');
  doc.text('NIP. ' + record.pihakKeduaNip, marginLeft, y);
  doc.text('NIP. ' + record.pihakSatuNip, colRightX, y);
  y += 14;

  // ---------------- MENGETAHUI ----------------
  doc.text('Mengetahui,', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Kepala Seksi Bimas Islam,', pageWidth / 2, y, { align: 'center' });
  y += 22;
  doc.setFont('times', 'bold');
  doc.text(String(record.kasiNama || ''), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('times', 'normal');
  doc.text('NIP. ' + record.kasiNip, pageWidth / 2, y, { align: 'center' });

  return doc;
}

async function downloadBeritaAcaraPdf(record) {
  const doc = await generateBeritaAcaraPdf(record);
  const fileName = 'BA_' + pad3(parseInt(record.nomorUrut, 10)) + '_' + record.tahun + '.pdf';
  doc.save(fileName);
}
  return { set: (s, p) => { _settingsCache = s; _pegawaiCache = p; }, BULAN_ID, KUA_LIST, JABATAN_BIMAS, JABATAN_KUA, ALAMAT_BIMAS_DEFAULT, pad3,
    buildNomorSuratLengkap, getIndonesianDayName, getIndonesianMonthName, getKuaLabelForRecord_, getTempatKerjaLabel_,
    resolveAlamatLengkapPihakSatu_, resolveAlamatLengkapPihakKedua_, downloadBeritaAcaraPdf };
})();

const B = { on: false, peg: [], ba: [], set: {}, q: '', thn: '', bln: '', kua: '', sim: '', pg: 1 };
const BDEF = { KASI_NAMA: '', KASI_NIP: '', NOMOR_AWAL_SURAT: '1', KODE_KANTOR: 'Kk.10.12', KODE_KLASIFIKASI: 'PW.01',
  NOMOR_FORMAT_TEMPLATE: 'B.{NOMOR}/{KODE_KANTOR}/{BULAN_ROMAWI}/{KODE_KLASIFIKASI}/{BULAN_ANGKA}/{TAHUN}', ALAMAT_BIMAS_LENGKAP: BX.ALAMAT_BIMAS_DEFAULT,
  LAST_NUMBER: '0', LAST_NUMBER_YEAR: '' };
const bnOut = r => {   // baris database (snake_case) -> bentuk lama (camelCase) yang dipakai kode PDF/alamat
  const o = {}; for (const k in r) o[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = r[k] ?? '';
  return Object.assign(o, { tahun: String(r.tahun), noSurat: BX.pad3(r.nomor_urut) });
};
const bnReset = () => Object.assign(B, { on: false, peg: [], ba: [], set: {} });
const bnHead = (t, s, btn = '') => `<div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4"><div><h4 class="mb-1">${t}</h4><p class="mb-0">${s}</p></div>${btn}</div><div id="bmsg"></div>`;
const bnById = id => B.ba.find(r => r.id == id);
const bnB64Blob = (b64, mime) => { const t = atob(b64), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return new Blob([u], { type: mime }); };
/* ---- Arsip dokumen tertandatangan ----
   Jenis menurut kolom ArsipId / ArsipLink / ArsipMaster di Spreadsheet:
     master = arsipId terisi dan arsipMaster '1'  : sudah di folder master (dibaca/dihapus/diganti lewat Edge Function bop)
     lama   = arsipId terisi, arsipMaster kosong  : unggahan versi sebelumnya di folder lain (dibaca lewat Apps Script; dapat dipindah)
     tautan = hanya arsipLink Google Drive        : data lama tanpa id (dibuka lewat tautan; dapat disalin bila dibagikan "siapa saja")
     kosong = belum ada arsip */
const BN_DRIVE = /^https:\/\/(drive|docs)\.google\.com\//;
const bnArsipJenis = r => r.arsipId ? (r.arsipMaster === '1' ? 'master' : 'lama') : (BN_DRIVE.test(r.arsipLink || '') ? 'tautan' : 'kosong');
const bnArsipIkon = r => ({
  master: '<i class="bx bx-paperclip text-success" role="img" aria-label="Arsip di folder master" title="Arsip di folder master"></i>',
  lama: '<i class="bx bx-paperclip text-warning" role="img" aria-label="Arsip lama, belum di folder master" title="Arsip lama (belum di folder master)"></i>',
  tautan: '<i class="bx bx-link text-warning" role="img" aria-label="Tautan arsip lama, belum di folder master" title="Tautan arsip lama (belum di folder master)"></i>',
  kosong: '' })[bnArsipJenis(r)];
const BN_MAX_ARSIP = 5 * 1024 * 1024;   // sama dengan MAX_BAST di Edge Function
// Penentu folder dan nama file di Drive: BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext> (bulan 0 = tidak dikenal)
const bnTarget = r => ({ tahun: r.tahun, bulan: BX.BULAN_ID.findIndex(b => b.toUpperCase() === String(r.bln || '').trim().toUpperCase()) + 1,
  nomor: r.nomorUrut, kua: BX.getKuaLabelForRecord_(r) || 'Tanpa KUA', ba: r.id });
const bnKirim = async (file, t, extra = {}) => {   // unggah satu file ke folder master -> { ok, id, link, ada? }
  const fd = new FormData(); fd.append('file', file);
  Object.entries({ ...t, ...extra }).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
  return (await api({ action: 'bast-upload' }, { method: 'POST', body: fd })).json();
};
const bnArsipLoad = async r => {   // bentuk yang diminta openViewer: objek dengan blob()
  if (r.arsipMaster === '1') return api({ action: 'bast-file', id: r.arsipId });   // folder master: dibaca server BIMASATU
  const j = await gas('bastArsipFile', { id: r.id }), blob = bnB64Blob(j.base64, j.mime);   // arsip lama: dibaca Apps Script
  return { blob: async () => blob };
};
// Pindahkan SATU arsip lama ke folder master dan catat di Berita Acara. Arsip lama dengan id: dibaca lewat Apps Script lalu diunggah;
// bila Apps Script tidak dapat membacanya (atau hanya ada tautan): disalin server dari tautan Drive yang dibagikan "siapa saja".
// Aman diulang: file yang sudah pernah disalin dikenali server (tidak digandakan). buang = file lama dibuang ke Sampah setelah berhasil.
async function bnPindah(r, buang) {
  const t = bnTarget(r);
  let j = null, galat = '';
  if (r.arsipId && r.arsipMaster !== '1') {
    try {
      const f = await gas('bastArsipFile', { id: r.id }), ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[f.mime] || 'pdf';
      j = await bnKirim(new File([bnB64Blob(f.base64, f.mime)], 'arsip.' + ext, { type: f.mime }), t, { lama: r.arsipId });
    } catch (e) { galat = e.message; }
  }
  if (!j && BN_DRIVE.test(r.arsipLink || '')) {
    try { j = await (await api({ action: 'bast-salin' }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: r.arsipLink, ...t }) })).json(); }
    catch (e) { galat = galat ? `${galat} Disalin dari tautan: ${e.message}` : e.message; }
  }
  if (!j) throw new Error(galat || 'Arsip lama tidak dapat dibaca.');
  const s = await gas('bastArsipSet', { id: r.id, arsipId: j.id, buangLama: !!buang && !!r.arsipId && r.arsipMaster !== '1' });
  Object.assign(r, { arsipId: j.id, arsipLink: j.link || s.link, arsipMaster: '1' });
  return j;
}
const bnSim = r => `<span class="badge bg-label-${r.statusSimkah === 'Sudah' ? 'success' : 'warning'}">${esc(r.statusSimkah)}</span>`;
const bnRange = t => { const m = /(\d+)\s*-\s*(\d+)/.exec(t || ''); return m ? [+m[1], +m[2]] : null; };
const bnNext = y => B.set.LAST_NUMBER_YEAR === y ? (parseInt(B.set.LAST_NUMBER, 10) || 0) + 1 : (parseInt(B.set.NOMOR_AWAL_SURAT, 10) || 1);
const bnDlg = (h, wire, w) => {
  const d = $('dlg'); d.style.width = w ? '100%' : ''; d.style.maxWidth = w || '';
  d.addEventListener('close', () => { d.style.width = d.style.maxWidth = ''; }, { once: true });
  jpDlg(h, wire);
};
async function bnLoad(force) {   // dimuat sekali per sesi (3 permintaan), selanjutnya dari memori
  if (B.on && !force) return true;
  let j;
  try { j = await gas('bastInit'); }
  catch (e) { $('view').insertAdjacentHTML('afterbegin', note('Gagal memuat data BAST NR: ' + e.message)); return false; }
  Object.assign(B, { peg: j.pegawai, ba: j.ba.map(bnOut), set: { ...BDEF, ...Object.fromEntries(j.setting.map(x => [x.key, x.value])) }, on: true });
  BX.set(B.set, B.peg); return true;
}
async function bnPdf(r) {
  jpToast('Menyiapkan PDF…', 'warning');
  try { await loadJs('logo-data.js').catch(() => 0); BX.set(B.set, B.peg); await BX.downloadBeritaAcaraPdf(r); }
  catch (e) { jpToast(e.message, 'danger'); }
}

/* ---- Riwayat (+ ringkasan) ---- */
async function pageBast() {
  $('view').innerHTML = `<div class="jp" id="broot">${bnHead('BAST NR', 'Berita Acara Serah Terima Sarana Administrasi NR: riwayat, arsip, dan status SIMKAH.', '<a class="btn btn-primary" href="#bast-buat"><i class="bx bx-plus"></i> Buat Berita Acara</a>')}<div id="bst">Memuat…</div></div>`;
  if (!await bnLoad()) return;
  Object.assign(B, { q: '', thn: '', bln: '', kua: '', sim: '', pg: 1 });
  const r = $('broot'), now = new Date(), mn = BX.BULAN_ID[now.getMonth()].toUpperCase();
  r.onclick = bnClick; r.oninput = r.onchange = bnFilter;
  const ini = B.ba.filter(x => x.tahun === String(now.getFullYear()) && String(x.bln).toUpperCase().startsWith(mn)).length;
  const thn = [...new Set(B.ba.map(x => x.tahun))].sort().reverse();
  $('bst').innerHTML = `<div class="row g-3 mb-4">${jpCard('bx-file', 'primary', B.ba.length, 'Total Berita Acara')}${jpCard('bx-calendar-check', 'success', ini, 'BA bulan ini')}${jpCard('bx-group', 'info', B.peg.length, 'Pegawai')}${jpCard('bx-hash', 'warning', esc(B.set.LAST_NUMBER), 'Nomor terakhir')}</div>
    <div class="card"><div class="card-body">
      <div class="row g-2 mb-3"><div class="col-lg-4"><div class="input-group"><span class="input-group-text"><i class="bx bx-search"></i></span><input id="bq" type="search" class="form-control" placeholder="Cari nomor, nama, KUA, porporasi…"></div></div>
        <div class="col-6 col-lg-2"><select id="bthn" class="form-select"><option value="">Semua Tahun</option>${thn.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
        <div class="col-6 col-lg-2"><select id="bbln" class="form-select"><option value="">Semua Bulan</option>${BX.BULAN_ID.map(b => `<option>${b}</option>`).join('')}</select></div>
        <div class="col-6 col-lg-2"><select id="bkua" class="form-select"><option value="">Semua KUA</option>${BX.KUA_LIST.map(k => `<option>${esc(k.nama)}</option>`).join('')}</select></div>
        <div class="col-6 col-lg-2"><select id="bsim" class="form-select"><option value="">Semua SIMKAH</option><option>Sudah</option><option>Belum</option></select></div></div>
      <div class="scroll"><table class="table table-hover align-middle mb-0"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Pihak Kedua</th><th>KUA</th><th>Porporasi</th><th>SIMKAH</th><th>Arsip</th><th></th></tr></thead><tbody id="btb"></tbody></table></div>
      <div id="bpg" class="d-flex align-items-center justify-content-between mt-3"></div></div></div>`;
  bnRows();
}
function bnRows() {
  const q = B.q.trim().toLowerCase(), kua = r => BX.getKuaLabelForRecord_(r);
  const L = B.ba.filter(r => (!B.thn || r.tahun === B.thn) && (!B.bln || String(r.bln).toUpperCase().startsWith(B.bln.toUpperCase())) && (!B.kua || kua(r) === B.kua) && (!B.sim || r.statusSimkah === B.sim)
    && (!q || [r.noSurat, r.tahun, r.pihakSatuNama, r.pihakKeduaNama, kua(r), r.porporasi, r.hari, r.bln].join(' ').toLowerCase().includes(q)));
  const n = Math.max(1, Math.ceil(L.length / 15)); B.pg = Math.min(B.pg, n);
  $('btb').innerHTML = L.slice((B.pg - 1) * 15, B.pg * 15).map(r => `<tr><td class="fw-semibold">${r.noSurat}/${esc(r.tahun)}</td><td>${esc(r.hari)}, ${esc(r.tgl)} ${esc(r.bln)}</td><td>${esc(r.pihakKeduaNama)}</td><td>${esc(kua(r))}</td><td>${esc(r.porporasi)}</td><td>${bnSim(r)}</td><td>${bnArsipIkon(r)}</td>
    <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-act="bdet" data-k="${r.id}">Detail</button> <button class="btn btn-sm btn-outline-secondary px-2" data-act="bpdf" data-k="${r.id}" title="Unduh PDF"><i class="bx bx-download"></i></button></td></tr>`).join('')
    || '<tr><td colspan="8" class="text-center py-4">Tidak ada Berita Acara yang cocok.</td></tr>';
  $('bpg').innerHTML = `<span>${L.length} data · halaman ${B.pg}/${n}</span><span><button class="btn btn-sm btn-outline-secondary" data-act="bprev"${B.pg <= 1 ? ' disabled' : ''}>‹</button> <button class="btn btn-sm btn-outline-secondary" data-act="bnext"${B.pg >= n ? ' disabled' : ''}>›</button></span>`;
}
function bnFilter(e) {
  const k = { bq: 'q', bthn: 'thn', bbln: 'bln', bkua: 'kua', bsim: 'sim' }[e.target.id];
  if (k) { B[k] = e.target.value; B.pg = 1; bnRows(); }
}
function bnClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, r = bnById(b.dataset.k);
  if (a === 'bdet') bnDetail(r); else if (a === 'bpdf') bnPdf(r);
  else if (a === 'bprev') { B.pg--; bnRows(); } else if (a === 'bnext') { B.pg++; bnRows(); }
}
function bnDetail(r) {
  if (!r) return;
  const nx = r.statusSimkah === 'Sudah' ? 'Belum' : 'Sudah', jenis = bnArsipJenis(r);
  const kv = (l, v) => `<div class="col-sm-6"><small class="d-block text-uppercase">${l}</small>${esc(v) || '-'}</div>`;
  const pihak = (t, p, kat, al) => `<h6 class="mt-4 mb-2">${t}</h6><div class="row g-2">${kv('Nama', r[p + 'Nama'])}${kv('NIP', r[p + 'Nip'])}${kv('Jabatan', r[p + 'Jabatan'])}${kv('Tempat Kerja', BX.getTempatKerjaLabel_(r[p + 'Nip'], r[p + 'Jabatan'], kat))}<div class="col-12"><small class="d-block text-uppercase">Alamat</small>${esc(al)}</div></div>`;
  bnDlg(`<div class="d-flex justify-content-between align-items-start"><div><h5 class="mb-1">Berita Acara ${r.noSurat}/${esc(r.tahun)}</h5><div>${esc(BX.buildNomorSuratLengkap(r.nomorUrut, r.blnSrt, r.tahun))}</div></div>${bnSim(r)}</div>
    <div class="row g-2 mt-2">${kv('Hari, Tanggal', `${r.hari}, ${r.tgl} ${r.bln} ${r.tahun}`)}${kv('Mengetahui (Kasi)', r.kasiNama)}</div>
    ${pihak('Pihak Pertama', 'pihakSatu', 'Bimas Islam', BX.resolveAlamatLengkapPihakSatu_(r))}${pihak('Pihak Kedua', 'pihakKedua', 'KUA', BX.resolveAlamatLengkapPihakKedua_(r))}
    <h6 class="mt-4 mb-2">Data Sarana</h6><div class="row g-2">${kv('Banyaknya Buku NA', r.banyakNaBuku)}${kv('N', r.banyakN)}${kv('NB', r.banyakNb)}${kv('No. Seri', r.noSeri)}${kv('Nomor Porporasi', r.porporasi)}</div>
    <h6 class="mt-4 mb-2">Arsip dokumen tertandatangan${jenis === 'master' ? ' <span class="badge bg-label-success ms-1">Folder master</span>' : jenis === 'kosong' ? '' : ' <span class="badge bg-label-warning ms-1">Arsip lama</span>'}</h6>
    <div class="d-flex flex-wrap gap-2 mb-2">${r.arsipId ? '<button class="btn btn-sm btn-outline-primary" data-a="view"><i class="bx bx-show"></i> Lihat arsip</button><button class="btn btn-sm btn-outline-danger" data-a="adel"><i class="bx bx-trash"></i> Hapus arsip</button>' : ''}${
      jenis === 'tautan' ? `<a class="btn btn-sm btn-outline-primary" target="_blank" rel="noopener" href="${esc(r.arsipLink)}"><i class="bx bx-link-external"></i> Buka arsip lama (Drive)</a>` : ''}${
      jenis === 'lama' || jenis === 'tautan' ? '<button class="btn btn-sm btn-outline-success" data-a="pindah"><i class="bx bx-transfer"></i> Pindahkan ke folder master</button>' : ''}${
      jenis === 'kosong' ? '<span class="small">Belum ada arsip.</span>' : ''}</div>
    <input type="file" id="bfa" class="form-control form-control-sm" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"><small>PDF/JPG/PNG, maksimal 5 MB. Disimpan di folder master Google Drive (BAST NR / tahun / bulan). Mengunggah file baru menggantikan arsip yang ada.</small>
    <div class="d-flex flex-wrap justify-content-between gap-2 mt-4"><div class="d-flex gap-2"><button class="btn btn-outline-danger" data-a="del"><i class="bx bx-trash"></i> Hapus BA</button><button class="btn btn-outline-secondary" data-a="sim">Ubah SIMKAH ke ${nx}</button></div>
      <div class="d-flex gap-2"><button class="btn btn-outline-secondary" data-a="pdf"><i class="bx bx-download"></i> PDF</button><button class="btn btn-primary" data-x>Tutup</button></div></div>`,
  d => {
    const on = (a, f) => { const b = d.querySelector(`[data-a=${a}]`); if (b) b.onclick = f; };
    d.querySelector('[data-x]').onclick = () => d.close();
    on('pdf', () => bnPdf(r));
    on('sim', () => jpAsk('Ubah status SIMKAH?', `Status BA ${r.noSurat}/${r.tahun} diubah menjadi "${nx}".`, 'Ubah', async () => {
      try { await gas('bastStatus', { id: r.id, status: nx }); } catch (e) { return jpToast(e.message, 'danger'); }
      r.statusSimkah = nx; bnRows(); jpToast('Status SIMKAH diperbarui.');
    }));
    on('del', () => jpAsk('Hapus Berita Acara?', `BA ${r.noSurat}/${r.tahun} dihapus permanen. File arsip di Google Drive (bila ada) tidak ikut terhapus.`, 'Hapus', async () => {
      try { await gas('bastDeleteBA', { id: r.id }); } catch (e) { return jpToast(e.message, 'danger'); }
      B.ba = B.ba.filter(x => x.id !== r.id); bnRows(); jpToast('Berita Acara dihapus.');
    }, true));
    on('view', () => openViewer([{ name: `Berita Acara ${r.noSurat}/${r.tahun}` }], 0, () => bnArsipLoad(r)));   // penampil yang sama dengan menu BOP (dialog tersendiri, detail BA tetap terbuka)
    on('adel', () => jpAsk('Hapus arsip?', 'File arsip dipindah ke Sampah Google Drive.', 'Hapus', async () => {
      try {
        const j = await gas('bastArsipHapus', { id: r.id });   // arsip lama dibuang Apps Script; arsip di folder master dibuang server di bawah ini
        r.arsipId = r.arsipLink = r.arsipMaster = ''; bnRows();
        if (j.master && j.arsipId) {
          try { await api({ action: 'bast-hapus', id: j.arsipId }, { method: 'POST' }); }
          catch (e) { return jpToast('Arsip dilepas dari Berita Acara, tetapi file di Google Drive gagal dibuang: ' + e.message, 'warning'); }
        }
        jpToast('Arsip dihapus.');
      } catch (e) { jpToast(e.message, 'danger'); }
    }, true));
    on('pindah', async () => {
      const b = d.querySelector('[data-a=pindah]'); b.disabled = true; jpToast('Memindahkan arsip ke folder master…', 'info');
      try { await bnPindah(r, false); d.close(); bnRows(); jpToast('Arsip dipindahkan ke folder master.'); }
      catch (e) { b.disabled = false; jpToast(e.message, 'danger'); }
    });
    $('bfa').onchange = async e => {   // unggah ke folder master (server), lalu catat id-nya di Berita Acara; arsip sebelumnya dibuang SESUDAH yang baru tercatat
      const inp = e.target, f = inp.files[0]; if (!f) return;
      if (f.size > BN_MAX_ARSIP) { inp.value = ''; return jpToast('Ukuran file melebihi 5 MB.', 'danger'); }
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { inp.value = ''; return jpToast('Hanya PDF, JPG, atau PNG.', 'danger'); }
      inp.disabled = true; jpToast('Mengunggah arsip ke folder master…', 'info');
      const sebelumnya = r.arsipMaster === '1' ? r.arsipId : '', lama = jenis === 'lama';
      let j;
      try { j = await bnKirim(f, bnTarget(r)); }
      catch (x) { inp.disabled = false; inp.value = ''; return jpToast(x.message, 'danger'); }
      try { await gas('bastArsipSet', { id: r.id, arsipId: j.id, buangLama: lama }); }
      catch (x) {
        api({ action: 'bast-hapus', id: j.id }, { method: 'POST' }).catch(() => 0);   // file yang gagal dicatat tidak dibiarkan menggantung di folder master
        inp.disabled = false; inp.value = '';
        return jpToast('Arsip terunggah tetapi gagal dicatat pada Berita Acara: ' + x.message + ' Silakan unggah ulang.', 'danger');
      }
      if (sebelumnya && sebelumnya !== j.id) api({ action: 'bast-hapus', id: sebelumnya }, { method: 'POST' }).catch(() => 0);   // arsip lama di folder master ke Sampah (tidak menghalangi)
      Object.assign(r, { arsipId: j.id, arsipLink: j.link, arsipMaster: '1' }); d.close(); bnRows(); jpToast('Arsip diunggah ke folder master.');
    };
  }, 'min(760px,95vw)');
}

/* ---- Buat Berita Acara ---- */
async function pageBastBuat() {
  $('view').innerHTML = `<div class="jp" id="broot">${bnHead('Buat Berita Acara', 'Nomor urut diusulkan otomatis dan baru dipakai setelah Berita Acara disimpan.')}<div id="bbf">Memuat…</div></div>`;
  if (!await bnLoad()) return;
  const t = new Date(), p2 = n => String(n).padStart(2, '0'), today = `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
  const pg = (kat) => B.peg.filter(p => p.kategori === kat).map(p => `<option value="${esc(p.nip)}">${esc(p.nama)} — ${esc(p.jabatan)}</option>`).join('');
  const num = (id, l, ex = '') => `<div class="col-sm-6 col-lg-3"><label class="form-label">${l}</label><input type="number" min="0" id="${id}" class="form-control" ${ex}></div>`;
  $('bbf').innerHTML = `<div class="row g-4">
    <div class="col-lg-6"><div class="card h-100"><div class="card-body"><h5 class="mb-3">Tanggal &amp; Nomor Surat</h5>
      <label class="form-label">Tanggal pelaksanaan</label><input type="date" id="bb-tgl" class="form-control" value="${today}"><div id="bb-sum" class="small mt-1 mb-3"></div>
      <div class="row g-3"><div class="col-sm-6"><label class="form-label">Bulan Surat</label><select id="bb-bs" class="form-select">${BX.BULAN_ID.map((b, i) => `<option value="${i + 1}">${b}</option>`).join('')}</select></div>
        <div class="col-sm-6"><label class="form-label">Nomor Urut</label><input type="number" min="1" id="bb-no" class="form-control"></div></div>
      <label class="form-label mt-3">Nomor Surat Lengkap</label><input id="bb-ns" class="form-control" readonly></div></div></div>
    <div class="col-lg-6"><div class="card h-100"><div class="card-body"><h5 class="mb-3">Para Pihak</h5>
      <label class="form-label">Pihak Pertama (Seksi Bimas Islam)</label><select id="bb-p1" class="form-select"><option value="">— Pilih —</option>${pg('Bimas Islam')}</select>
      <label class="form-label mt-3">Pihak Kedua: KUA Kecamatan</label><select id="bb-kua" class="form-select"><option value="">— Pilih KUA —</option>${BX.KUA_LIST.map(k => `<option>${esc(k.nama)}</option>`).join('')}</select>
      <label class="form-label mt-3">Pihak Kedua: Pegawai</label><select id="bb-p2" class="form-select" disabled><option value="">— Pilih KUA dulu —</option></select><div id="bb-p2i" class="small mt-1"></div></div></div></div>
    <div class="col-12"><div class="card"><div class="card-body"><h5 class="mb-3">Data Sarana</h5><div class="row g-3">
      ${num('bb-pa', 'Porporasi awal')}${num('bb-pb', 'Porporasi akhir')}${num('bb-na', 'Banyaknya Buku NA', 'readonly')}
      <div class="col-sm-6 col-lg-3 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="bb-auto" checked><label class="form-check-label" for="bb-auto">Hitung otomatis dari porporasi</label></div></div>
      ${num('bb-n', 'Banyaknya N')}${num('bb-nb', 'Banyaknya NB')}
      <div class="col-sm-6 col-lg-3"><label class="form-label">No. Seri</label><input id="bb-seri" class="form-control" placeholder="PS / JB"></div>
      <div class="col-sm-6 col-lg-3"><label class="form-label">Status Stok SIMKAH</label><select id="bb-sim" class="form-select"><option>Belum</option><option>Sudah</option></select></div></div>
      <div id="bb-por" class="mt-3"></div>
      <div class="mt-3 small">Mengetahui: <b>${esc(B.set.KASI_NAMA) || '(belum diatur di Pengaturan BAST)'}</b> ${esc(B.set.KASI_NIP)}</div>
      <div class="d-flex justify-content-end mt-4"><button class="btn btn-primary" id="bb-save"><i class="bx bx-save"></i> Simpan Berita Acara</button></div></div></div></div></div>`;
  const r = $('broot'); r.oninput = r.onchange = bbEvent; $('bb-save').onclick = bbSave; bbDate(true);
}
function bbDate(force) {
  const v = $('bb-tgl').value; if (!v) return;
  const [y, m, d] = v.split('-').map(Number), dt = new Date(y, m - 1, d);
  $('bb-sum').innerHTML = `Pada hari ini <b>${BX.getIndonesianDayName(dt)}</b>, tanggal <b>${String(d).padStart(2, '0')}</b> bulan <b>${BX.getIndonesianMonthName(dt)}</b> tahun <b>${y}</b>`;
  if (!$('bb-bs').dataset.u) $('bb-bs').value = m;
  if (force || $('bb-no').dataset.y !== String(y)) { $('bb-no').dataset.y = y; $('bb-no').value = bnNext(String(y)); }
  bbPreview();
}
function bbPreview() {
  const y = $('bb-tgl').value.split('-')[0], bs = +$('bb-bs').value, no = +$('bb-no').value;
  $('bb-ns').value = y && bs && no ? BX.buildNomorSuratLengkap(no, bs, y, B.set) : '';
}
function bbPor() {
  const a = parseInt($('bb-pa').value, 10), b = parseInt($('bb-pb').value, 10), ok = !isNaN(a) && !isNaN(b);
  if ($('bb-auto').checked && ok && b >= a) $('bb-na').value = b - a + 1;
  let m = '';
  if (ok && b < a) m = note('Nomor porporasi akhir tidak boleh lebih kecil dari awal.', 'warning');
  else if (ok) {
    const x = B.ba.find(r => { const g = bnRange(r.porporasi); return g && a <= g[1] && b >= g[0]; });
    if (x) m = note(`Nomor porporasi sudah digunakan pada BA Nomor ${x.noSurat} (rentang ${x.porporasi}).`, 'warning');
  }
  $('bb-por').innerHTML = m;
}
function bbEvent(e) {
  const id = e.target.id;
  if (id === 'bb-tgl') bbDate();
  else if (id === 'bb-bs') { e.target.dataset.u = 1; bbPreview(); }
  else if (id === 'bb-no') bbPreview();
  else if (id === 'bb-kua') {
    const L = B.peg.filter(p => p.kategori === 'KUA' && p.kua === e.target.value);
    $('bb-p2').disabled = !L.length;
    $('bb-p2').innerHTML = `<option value="">${L.length ? '— Pilih —' : '— Belum ada pegawai —'}</option>` + L.map(p => `<option value="${esc(p.nip)}">${esc(p.nama)} — ${esc(p.jabatan)}</option>`).join('');
    $('bb-p2i').textContent = e.target.value && !L.length ? 'KUA ini belum punya pegawai terdaftar. Tambahkan di menu Pegawai.' : '';
  }
  else if (id === 'bb-auto') { $('bb-na').readOnly = e.target.checked; bbPor(); }
  else if (id === 'bb-pa' || id === 'bb-pb') bbPor();
}
async function bbSave() {
  const v = id => $(id).value.trim(), n = id => v(id) === '' ? null : parseInt(v(id), 10);
  const p1 = B.peg.find(p => p.nip === v('bb-p1')), p2 = B.peg.find(p => p.nip === v('bb-p2'));
  if (!p1 || !p2) return jpToast('Pilih Pihak Pertama dan Pihak Kedua.', 'danger');
  if (!n('bb-no')) return jpToast('Nomor Urut wajib diisi.', 'danger');
  const [y, m, d] = v('bb-tgl').split('-').map(Number), a = n('bb-pa'), b = n('bb-pb');
  if (!y || a == null || b == null) return jpToast('Tanggal dan nomor porporasi awal & akhir wajib diisi.', 'danger');
  const dt = new Date(y, m - 1, d), btn = $('bb-save');
  const row = { nomor_urut: n('bb-no'), tahun: y, bln_srt: +v('bb-bs'), hari: BX.getIndonesianDayName(dt), tgl: String(d).padStart(2, '0'), bln: BX.getIndonesianMonthName(dt),
    pihak_satu_nip: p1.nip, pihak_satu_nama: p1.nama, pihak_satu_jabatan: p1.jabatan, pihak_satu_alamat: p1.alamat,
    pihak_kedua_nip: p2.nip, pihak_kedua_nama: p2.nama, pihak_kedua_jabatan: p2.jabatan, pihak_kedua_alamat: p2.alamat,
    banyak_na_buku: n('bb-na'), banyak_n: n('bb-n'), banyak_nb: n('bb-nb'), no_seri: v('bb-seri'), porporasi: `${a}- ${b}`,
    kasi_nama: B.set.KASI_NAMA, kasi_nip: B.set.KASI_NIP, status_simkah: v('bb-sim') };
  btn.disabled = true;
  let data;
  try { data = (await gas('bastSaveBA', { row })).data; }
  catch (e) { btn.disabled = false; return jpToast(e.message, 'danger'); }
  btn.disabled = false;
  B.ba.unshift(bnOut(data));
  if (String(y) !== B.set.LAST_NUMBER_YEAR || row.nomor_urut > (+B.set.LAST_NUMBER || 0)) Object.assign(B.set, { LAST_NUMBER: String(row.nomor_urut), LAST_NUMBER_YEAR: String(y) });
  jpToast(`Berita Acara Nomor ${BX.pad3(row.nomor_urut)}/${y} disimpan.`); pageBastBuat();
}

/* ---- Pegawai ---- */
async function pageBastPegawai() {
  $('view').innerHTML = `<div class="jp" id="broot">${bnHead('Pegawai BAST NR', 'Staf Bimas Islam (Pihak Pertama) dan staf KUA (Pihak Kedua).', '<button class="btn btn-primary" data-act="padd"><i class="bx bx-plus"></i> Tambah Pegawai</button>')}
    <div class="card"><div class="card-body"><div class="row g-2 mb-3"><div class="col-lg-5"><div class="input-group"><span class="input-group-text"><i class="bx bx-search"></i></span><input id="bpq" type="search" class="form-control" placeholder="Cari nama, NIP, jabatan, KUA…"></div></div>
      <div class="col-lg-3"><select id="bpk" class="form-select"><option value="">Semua Kategori</option><option>Bimas Islam</option><option>KUA</option></select></div></div>
      <div class="scroll"><table class="table table-hover align-middle mb-0"><thead><tr><th>Nama</th><th>NIP</th><th>Kategori</th><th>Jabatan</th><th>Unit Kerja</th><th></th></tr></thead><tbody id="bpt"></tbody></table></div><div id="bpc" class="mt-2"></div></div></div></div>`;
  if (!await bnLoad()) return;
  const r = $('broot'); r.oninput = r.onchange = bpRows;
  r.onclick = e => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act; if (a === 'padd') bnPegForm(); else if (a === 'pedit') bnPegForm(b.dataset.k); else if (a === 'pdel') bnPegDel(b.dataset.k); };
  bpRows();
}
function bpRows() {
  const q = $('bpq').value.toLowerCase(), k = $('bpk').value;
  const L = B.peg.filter(p => (!k || p.kategori === k) && (!q || [p.nama, p.nip, p.jabatan, p.kua].join(' ').toLowerCase().includes(q)));
  $('bpt').innerHTML = L.map(p => `<tr><td>${esc(p.nama)}</td><td>${esc(p.nip)}</td><td><span class="badge bg-label-${p.kategori === 'KUA' ? 'info' : 'primary'}">${esc(p.kategori)}</span></td><td>${esc(p.jabatan)}</td><td>${p.kategori === 'KUA' ? 'KUA ' + esc(p.kua) : 'Seksi Bimas Islam'}</td>
    <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary px-2" data-act="pedit" data-k="${esc(p.nip)}" aria-label="Ubah"><i class="bx bx-edit"></i></button> <button class="btn btn-sm btn-outline-danger px-2" data-act="pdel" data-k="${esc(p.nip)}" aria-label="Hapus"><i class="bx bx-trash"></i></button></td></tr>`).join('')
    || '<tr><td colspan="6" class="text-center py-4">Belum ada pegawai.</td></tr>';
  $('bpc').textContent = `Total: ${B.peg.length} pegawai${L.length !== B.peg.length ? ' · ' + L.length + ' cocok' : ''}`;
}
function bnPegForm(nip) {
  const p = B.peg.find(x => x.nip === nip) || { kategori: 'Bimas Islam', nip: '', nama: '', jabatan: '', kua: '', alamat: BX.ALAMAT_BIMAS_DEFAULT };
  const f = (id, l, v, ex = '') => `<div class="mb-3"><label class="form-label">${l}</label><input id="${id}" class="form-control" value="${esc(v)}" ${ex}></div>`;
  bnDlg(`<h5 class="mb-3">${nip ? 'Ubah' : 'Tambah'} Pegawai</h5><div id="bfe"></div>
    <label class="form-label">Kategori</label><select id="pf-kat" class="form-select mb-3"><option${p.kategori === 'Bimas Islam' ? ' selected' : ''}>Bimas Islam</option><option${p.kategori === 'KUA' ? ' selected' : ''}>KUA</option></select>
    ${f('pf-nip', 'NIP (minimal 18 digit)', p.nip)}${f('pf-nama', 'Nama', p.nama)}${f('pf-jab', 'Jabatan', p.jabatan, 'list="pf-jl"')}<datalist id="pf-jl"></datalist>
    <div id="pf-kw" class="mb-3"><label class="form-label">KUA Kecamatan</label><select id="pf-kua" class="form-select"><option value="">— Pilih KUA —</option>${BX.KUA_LIST.map(k => `<option${k.nama === p.kua ? ' selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></div>
    <div class="mb-3"><label class="form-label">Alamat</label><textarea id="pf-al" class="form-control" rows="2">${esc(p.alamat)}</textarea></div>
    <div class="d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary" data-x>Batal</button><button class="btn btn-primary" data-ok>Simpan</button></div>`,
  d => {
    const kat = () => $('pf-kat').value, sync = () => {
      $('pf-jl').innerHTML = (kat() === 'KUA' ? BX.JABATAN_KUA : BX.JABATAN_BIMAS).map(j => `<option value="${esc(j)}">`).join('');
      $('pf-kw').classList.toggle('d-none', kat() !== 'KUA');
    };
    sync();
    $('pf-kat').onchange = () => { sync(); if (kat() === 'Bimas Islam' && !$('pf-al').value.trim()) $('pf-al').value = BX.ALAMAT_BIMAS_DEFAULT; };
    $('pf-kua').onchange = () => { const k = BX.KUA_LIST.find(x => x.nama === $('pf-kua').value); if (k) $('pf-al').value = k.alamat; };
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = async () => {
      const v = { nip: $('pf-nip').value.trim(), nama: $('pf-nama').value.trim(), kategori: kat(), jabatan: $('pf-jab').value.trim(), kua: kat() === 'KUA' ? $('pf-kua').value : '', alamat: $('pf-al').value.trim() };
      const err = v.nip.replace(/\D/g, '').length < 18 ? 'NIP minimal 18 digit.' : !v.nama || !v.jabatan || !v.alamat ? 'Nama, Jabatan, dan Alamat wajib diisi.' : v.kategori === 'KUA' && !v.kua ? 'KUA Kecamatan wajib dipilih untuk kategori KUA.' : '';
      if (err) return $('bfe').innerHTML = note(err, 'warning');
      try { await gas('bastSavePegawai', { nip: nip || '', data: v }); } catch (e) { return $('bfe').innerHTML = note(e.message); }
      B.peg = (nip ? B.peg.map(x => x.nip === nip ? v : x) : [...B.peg, v]).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      BX.set(B.set, B.peg); d.close(); bpRows(); jpToast('Pegawai disimpan.');
    };
  }, 'min(560px,95vw)');
}
function bnPegDel(nip) {
  const p = B.peg.find(x => x.nip === nip); if (!p) return;
  jpAsk('Hapus pegawai?', `${p.nama} (${p.nip}) dihapus dari daftar. Berita Acara lama tetap menyimpan datanya.`, 'Hapus', async () => {
    try { await gas('bastDeletePegawai', { nip }); } catch (e) { return jpToast(e.message, 'danger'); }
    B.peg = B.peg.filter(x => x.nip !== nip); BX.set(B.set, B.peg); bpRows(); jpToast('Pegawai dihapus.');
  }, true);
}

/* ---- Pengaturan BAST ---- */
async function pageBastSetting() {
  $('view').innerHTML = `<div class="jp" id="broot">${bnHead('Pengaturan BAST NR', 'Format nomor surat, pejabat yang mengetahui, dan alamat kantor untuk PDF.')}<div id="bsf">Memuat…</div></div>`;
  if (!await bnLoad()) return;
  const F = [['KASI_NAMA', 'Nama Kepala Seksi (Mengetahui)'], ['KASI_NIP', 'NIP Kepala Seksi'], ['NOMOR_AWAL_SURAT', 'Nomor awal surat (tiap tahun)'], ['KODE_KANTOR', 'Kode kantor'], ['KODE_KLASIFIKASI', 'Kode klasifikasi'],
    ['NOMOR_FORMAT_TEMPLATE', 'Format nomor surat'], ['ALAMAT_BIMAS_LENGKAP', 'Alamat lengkap kantor Bimas Islam']];
  $('bsf').innerHTML = `<div class="card"><div class="card-body"><div class="row g-3">${F.map(([k, l]) => `<div class="${k.length > 16 ? 'col-12' : 'col-md-6'}"><label class="form-label">${l}</label><input class="form-control" data-k="${k}" value="${esc(B.set[k])}"></div>`).join('')}</div>
    <p class="small mt-3 mb-1">Placeholder format: {NOMOR} {KODE_KANTOR} {BULAN_ROMAWI} {KODE_KLASIFIKASI} {BULAN_ANGKA} {TAHUN}</p>
    <p class="small">Nomor terakhir terpakai: <b>${esc(B.set.LAST_NUMBER)}</b> (tahun ${esc(B.set.LAST_NUMBER_YEAR) || '-'}). Nomor berikutnya mengikuti otomatis dan kembali ke nomor awal tiap tahun baru.</p>
    <div class="d-flex justify-content-end"><button class="btn btn-primary" id="bs-save"><i class="bx bx-save"></i> Simpan Pengaturan</button></div></div></div>
    <div class="card mt-4"><div class="card-body" id="bmig"></div></div>`;
  $('bs-save').onclick = async () => {
    const rows = [...document.querySelectorAll('#bsf [data-k]')].map(i => ({ key: i.dataset.k, value: i.value.trim() }));
    try { await gas('bastSaveSetting', { rows }); } catch (e) { return jpToast(e.message, 'danger'); }
    rows.forEach(x => { B.set[x.key] = x.value; }); BX.set(B.set, B.peg); jpToast('Pengaturan disimpan.');
  };
  bnMig();
}

/* ---- Pindahkan arsip lama ke folder master ----
   Semua arsip dokumen tertandatangan kini disimpan di folder master Google Drive (satu folder dengan LPJ BOP). Arsip yang diunggah versi
   sebelumnya ada di folder lain (milik akun Apps Script): kartu ini menghitungnya dan memindahkannya satu per satu (berurutan, aman diulang;
   yang sudah di folder master dilewati dan file tidak digandakan). Kegagalan satu arsip tidak menghentikan yang lain. */
let bnMigStop = false;
function bnMig() {
  const el = $('bmig'); if (!el) return;
  const c = { master: 0, lama: 0, tautan: 0, kosong: 0 };
  B.ba.forEach(r => c[bnArsipJenis(r)]++);
  const sisa = c.lama + c.tautan;
  el.innerHTML = `<h5 class="mb-1">Arsip di folder master</h5>
    <p class="mb-3">Arsip dokumen tertandatangan disimpan di folder master Google Drive: <code>${esc(CFG.nama)} / BAST NR / tahun / bulan</code>, satu folder induk dengan LPJ BOP. Arsip yang diunggah dengan versi sebelumnya masih berada di folder lain; pindahkan ke folder master di sini.</p>
    <div class="row g-3 mb-3">${jpCard('bx-folder', 'success', c.master, 'Sudah di folder master')}${jpCard('bx-transfer', sisa ? 'warning' : 'secondary', sisa, 'Arsip lama (perlu dipindah)')}${jpCard('bx-file', 'secondary', c.kosong, 'Belum ada arsip')}</div>
    ${sisa ? `<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="bm-buang"><label class="form-check-label" for="bm-buang">Buang file lama ke Sampah Google Drive setelah berhasil disalin <span class="small">(bawaan: file lama dibiarkan; tidak berlaku bagi arsip yang hanya punya tautan)</span></label></div>
      <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary" id="bm-go"><i class="bx bx-transfer"></i> Pindahkan ${sisa} arsip ke folder master</button><button class="btn btn-outline-secondary d-none" id="bm-stop">Hentikan</button></div>
      <p class="small mt-2 mb-0">Perkiraan ±${Math.max(1, Math.ceil(sisa * 6 / 60))} menit. Biarkan tab ini terbuka sampai selesai. Arsip dapat juga dipindahkan satu per satu dari Detail di Riwayat.</p>` : note('Semua arsip sudah berada di folder master.', 'success')}
    <div id="bm-log" class="small mt-3" aria-live="polite"></div><div id="bm-res" class="mt-2"></div>`;
  if (sisa) {
    $('bm-go').onclick = bnMigJalan;
    $('bm-stop').onclick = () => { bnMigStop = true; $('bm-stop').disabled = true; $('bm-log').textContent = 'Menghentikan setelah arsip ini selesai…'; };
  }
}
async function bnMigJalan() {
  const ep = EP, buang = $('bm-buang').checked;
  const L = B.ba.filter(r => ['lama', 'tautan'].includes(bnArsipJenis(r))).sort((a, b) => a.tahun - b.tahun || a.nomorUrut - b.nomorUrut);
  bnMigStop = false; $('bm-go').disabled = true; $('bm-buang').disabled = true; $('bm-stop').disabled = false; $('bm-stop').classList.remove('d-none'); $('bm-res').innerHTML = '';
  let ok = 0, ada = 0; const gagal = [];
  for (let i = 0; i < L.length && !bnMigStop; i++) {
    if (!live(ep)) return;   // pindah halaman: berhenti (yang sudah berhasil tetap tercatat)
    const r = L[i];
    $('bm-log').textContent = `Memindahkan ${i + 1} dari ${L.length}: Berita Acara ${r.noSurat}/${r.tahun}…`;
    try { const j = await bnPindah(r, buang); if (j.ada) ada++; else ok++; }
    catch (e) { gagal.push({ r, pesan: e.message }); }
  }
  if (!live(ep)) return;
  const henti = bnMigStop && ok + ada + gagal.length < L.length;
  const ringkas = `${ok} arsip dipindahkan${ada ? `, ${ada} sudah ada di folder master (hanya dicatat)` : ''}${gagal.length ? `, ${gagal.length} gagal` : ''}${henti ? ' (dihentikan)' : ''}.`;
  bnMig();   // hitung ulang kartu dari data terbaru
  $('bm-res').innerHTML = note(ringkas, gagal.length ? 'warning' : 'success') + (gagal.length
    ? `<div class="small">Yang gagal (perbaiki lalu jalankan lagi; yang sudah masuk tidak digandakan):<ul class="mb-0">${
      gagal.slice(0, 40).map(g => `<li>BA ${esc(g.r.noSurat)}/${esc(g.r.tahun)} (${esc(BX.getKuaLabelForRecord_(g.r) || '-')}): ${esc(g.pesan)}</li>`).join('')}${gagal.length > 40 ? '<li>… dan lainnya.</li>' : ''}</ul></div>` : '');
  jpToast(ringkas, gagal.length ? 'warning' : 'success');
}


// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { bast: pageBast, "bast-buat": pageBastBuat, "bast-pegawai": pageBastPegawai, "bast-setting": pageBastSetting });
