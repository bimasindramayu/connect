/**
 * =====================================================================
 *  DATA MASJID & MUSALA - CRUD
 *  Sheet: DataMasjid (dipakai bersama; dibedakan lewat kolom "Jenis")
 *
 *  Semua pembacaan/penulisan memakai NAMA HEADER di baris 1 (bukan nomor
 *  kolom tetap), jadi urutan kolom di sheet tidak masalah dan kolom baru
 *  bisa ditambahkan tanpa merusak data yang sudah ada.
 * =====================================================================
 */

// Susunan kolom untuk sheet BARU. Sheet lama tidak diubah urutannya --
// kolom yang belum ada saja yang ditambahkan di sebelah kanan
// (lihat ensureMasjidSchema_).
const MASJID_HEADERS_ = [
  'Id',
  'Jenis',
  'NoIdNasional',
  'NamaMasjid',
  'JenisTipologi',
  'Alamat',
  'Desa',
  'Kecamatan',
  'TahunBerdiri',
  'LembagaOrgMasyarakat',
  'UrlProfil',
  'TanggalTerbitSimas',
  'DibuatPada',
  'DiubahPada'
];

// Kolom yang WAJIB ada supaya aplikasi berfungsi. Kalau sheet lama belum
// punya salah satunya, ensureMasjidSchema_ menambahkannya otomatis.
const MASJID_REQUIRED_HEADERS_ = MASJID_HEADERS_;

// Nilai valid untuk kolom Jenis -- 'masjid' dipakai sebagai default kalau
// data lama belum punya kolom ini (sel kosong) atau kirim nilai di luar ini.
const JENIS_MASJID_ = 'masjid';
const JENIS_MUSOLA_ = 'musola';

// Tipologi Musala: WAJIB salah satu dari daftar ini (harus sama persis
// dengan TIPOLOGI_MUSOLA di Dashboard.html).
const TIPOLOGI_MUSOLA_VALID_ = [
  'Mushalla Tempat Publik',
  'Mushalla Perkantoran',
  'Mushalla Pendidikan',
  'Mushalla Perumahan / Pemukiman'
];

/**
 * Menjamin sheet DataMasjid punya semua kolom yang dibutuhkan. Aman
 * dipanggil berkali-kali -- tidak melakukan apa-apa kalau semuanya sudah
 * ada. Dipanggil dari setupDatabase() dan otomatis setiap kali sheet
 * dibuka lewat getMasjidSheet_(), jadi instalasi lama tidak perlu
 * migrasi manual:
 *
 *  - Kolom "Jenis" yang belum ada ditambahkan, dan semua baris lama
 *    ditandai 'masjid' (sebelum fitur Musala, semua data pasti masjid).
 *  - Kolom "TanggalTerbitSimas" yang belum ada ditambahkan (kosong).
 *    Kolom lama "BulanTerbit"/"TahunTerbit" DIBIARKAN apa adanya (tidak
 *    dihapus) -- isinya tetap tampil sebagai petunjuk di form Edit
 *    sampai tanggal lengkapnya diisi.
 *
 * Kolom baru selalu ditambahkan di sebelah kanan, tanpa menggeser kolom
 * yang sudah ada.
 */
function ensureMasjidSchema_(sheet) {
  if (sheet.getLastRow() === 0) {
    // Sheet kosong total: tulis header lengkap.
    sheet.getRange(1, 1, 1, MASJID_HEADERS_.length).setValues([MASJID_HEADERS_]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });

  const missing = MASJID_REQUIRED_HEADERS_.filter(function (h) {
    return headers.indexOf(h) === -1;
  });
  if (missing.length === 0) return;

  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');

  // Data lama yang belum punya kolom "Jenis" -> semuanya masjid.
  if (missing.indexOf('Jenis') !== -1) {
    const jenisCol = lastCol + 1 + missing.indexOf('Jenis');
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const n = lastRow - 1;
      const values = [];
      for (let i = 0; i < n; i++) values.push([JENIS_MASJID_]);
      sheet.getRange(2, jenisCol, n, 1).setValues(values);
    }
  }
  Logger.log('Skema DataMasjid diperbarui, kolom ditambahkan: ' + missing.join(', '));
}

function getMasjidSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_MASJID);
  if (!sheet) {
    throw new Error('Sheet "DataMasjid" belum ada. Jalankan setupDatabase() terlebih dahulu.');
  }
  ensureMasjidSchema_(sheet);
  return sheet;
}

/** Header baris 1 sheet -> array string (sesuai urutan kolom saat ini). */
function getMasjidHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
}

function camelizeHeader_(header) {
  // Header sheet berbentuk PascalCase (mis. "NamaMasjid"); ubah huruf
  // pertama jadi kecil supaya jadi camelCase ("namaMasjid") agar konsisten
  // dengan penamaan field di JS/JSON.
  return String(header).charAt(0).toLowerCase() + String(header).slice(1);
}

/**
 * Mengembalikan semua data masjid/musala sebagai array of object, memakai
 * baris header sheet sebagai nama field.
 */
function listMasjid() {
  const sheet = getMasjidSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const idCol = headers.indexOf('Id');
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[idCol]) continue; // lewati baris tanpa Id (baris kosong)
    const obj = {};
    headers.forEach(function (h, idx) {
      if (!h) return;
      let val = row[idx];
      if (val instanceof Date) {
        // Tanggal terbit = tanggal kalender murni -> "yyyy-MM-dd" menurut zona
        // waktu spreadsheet (toISOString() bisa menggeser harinya karena UTC).
        // Kolom lain (DibuatPada/DiubahPada) adalah cap waktu -> ISO.
        val = h === 'TanggalTerbitSimas' ? Utilities.formatDate(val, tz, 'yyyy-MM-dd') : val.toISOString();
      }
      obj[camelizeHeader_(h)] = val;
    });
    if (!obj.jenis) obj.jenis = JENIS_MASJID_; // data lama tanpa nilai Jenis
    rows.push(obj);
  }
  return rows;
}

function findMasjidRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const idCol = getMasjidHeaders_(sheet).indexOf('Id') + 1;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return null;
}

/** Tanggal kalender valid berbentuk "yyyy-MM-dd"? */
function isValidIsoDate_(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Simpan data masjid/musala. Kalau data.id diisi -> update baris yang sudah
 * ada; kalau kosong -> tambah baris baru dengan Id baru (UUID).
 */
function saveMasjid(data) {
  data = data || {};

  const jenis = String(data.jenis || '').trim().toLowerCase() === JENIS_MUSOLA_ ? JENIS_MUSOLA_ : JENIS_MASJID_;
  const namaMasjid = String(data.namaMasjid || '').trim();
  const noIdNasional = String(data.noIdNasional || '').trim();
  const alamat = String(data.alamat || '').trim();
  const desa = String(data.desa || '').trim();
  const kecamatan = String(data.kecamatan || '').trim();
  const jenisTipologi = String(data.jenisTipologi || '').trim();
  const tanggalTerbit = String(data.tanggalTerbitSimas || '').trim();

  const labelEntitas = jenis === JENIS_MUSOLA_ ? 'Musala' : 'Masjid';
  if (!noIdNasional) return { success: false, message: 'No. ID Nasional wajib diisi.' };
  if (!namaMasjid) return { success: false, message: 'Nama ' + labelEntitas + ' wajib diisi.' };
  if (!alamat) return { success: false, message: 'Alamat wajib diisi.' };
  if (!kecamatan) return { success: false, message: 'Kecamatan wajib diisi.' };
  if (!desa) return { success: false, message: 'Desa wajib diisi.' };
  // Musala: tipologi wajib dari daftar baku. Masjid: dibiarkan longgar supaya
  // data lama (mis. "Jami") tetap bisa disimpan ulang.
  if (jenis === JENIS_MUSOLA_ && TIPOLOGI_MUSOLA_VALID_.indexOf(jenisTipologi) === -1) {
    return {
      success: false,
      message: 'Jenis Tipologi Musala wajib salah satu dari: ' + TIPOLOGI_MUSOLA_VALID_.join(', ') + '.'
    };
  }
  if (tanggalTerbit && !isValidIsoDate_(tanggalTerbit)) {
    return { success: false, message: 'Tanggal Diterbitkan di Simas tidak valid.' };
  }

  const sheet = getMasjidSheet_();
  const headers = getMasjidHeaders_(sheet);
  const now = new Date();

  // Nilai per nama header. Kolom lain di sheet (mis. kolom lama
  // BulanTerbit/TahunTerbit) tidak disentuh.
  const fields = {
    'Jenis': jenis,
    'NoIdNasional': noIdNasional,
    'NamaMasjid': namaMasjid,
    'JenisTipologi': jenisTipologi,
    'Alamat': alamat,
    'Desa': desa,
    'Kecamatan': kecamatan,
    'TahunBerdiri': data.tahunBerdiri ? Number(data.tahunBerdiri) : '',
    'LembagaOrgMasyarakat': String(data.lembagaOrgMasyarakat || '').trim(),
    'UrlProfil': String(data.urlProfil || '').trim(),
    'TanggalTerbitSimas': tanggalTerbit,
    'DiubahPada': now
  };

  const tanggalCol = headers.indexOf('TanggalTerbitSimas') + 1;

  if (data.id) {
    const rowIndex = findMasjidRow_(sheet, data.id);
    if (!rowIndex) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus).' };

    const range = sheet.getRange(rowIndex, 1, 1, headers.length);
    const row = range.getValues()[0];
    Object.keys(fields).forEach(function (name) {
      const idx = headers.indexOf(name);
      if (idx !== -1) row[idx] = fields[name];
    });
    // Tanggal terbit disimpan sebagai TEKS "yyyy-MM-dd" supaya Sheets tidak
    // mengubahnya jadi tipe tanggal (yang bisa bergeser hari karena zona waktu).
    sheet.getRange(rowIndex, tanggalCol).setNumberFormat('@');
    range.setValues([row]);
    return { success: true, id: data.id };
  }

  const id = Utilities.getUuid();
  const row = headers.map(function () { return ''; });
  row[headers.indexOf('Id')] = id;
  Object.keys(fields).forEach(function (name) {
    const idx = headers.indexOf(name);
    if (idx !== -1) row[idx] = fields[name];
  });
  row[headers.indexOf('DibuatPada')] = now;

  // Baris baru ditulis ke baris kosong pertama; format kolom tanggal diatur
  // jadi teks SEBELUM nilainya ditulis (alasannya sama seperti di atas).
  const newRow = sheet.getLastRow() + 1;
  if (newRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  sheet.getRange(newRow, tanggalCol).setNumberFormat('@');
  sheet.getRange(newRow, 1, 1, headers.length).setValues([row]);
  return { success: true, id: id };
}

function deleteMasjid(id) {
  if (!id) return { success: false, message: 'Id tidak diberikan.' };
  const sheet = getMasjidSheet_();
  const rowIndex = findMasjidRow_(sheet, id);
  if (!rowIndex) return { success: false, message: 'Data masjid tidak ditemukan (mungkin sudah dihapus).' };
  sheet.deleteRow(rowIndex);
  return { success: true };
}

/**
 * Utilitas ambil satu data masjid berdasarkan id. Tidak dipanggil oleh
 * router doPost manapun saat ini (pembuatan PDF sudah sepenuhnya di sisi
 * klien, memakai data yang sudah diambil lewat listMasjid) -- disimpan
 * sebagai utilitas untuk pengembangan fitur lain ke depannya.
 */
function getMasjidById_(id) {
  const all = listMasjid();
  for (let i = 0; i < all.length; i++) {
    if (String(all[i].id) === String(id)) return all[i];
  }
  return null;
}