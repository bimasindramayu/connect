/**
 * =====================================================================
 *  DATA ARAH KIBLAT - CRUD
 *  Sheet: DataKiblat (data masjid/musala yang dikalibrasi arah kiblatnya)
 *
 *  Yang disimpan hanya MASUKAN (nama, alamat, koordinat, tanggal & jam
 *  kalibrasi). Azimut kiblat, tabel data matahari, dan tanggal Hijriah
 *  dihitung di sisi klien (Dashboard.html) setiap kali dokumen dibuat.
 *
 *  Seperti Masjid.gs, semua pembacaan/penulisan memakai NAMA HEADER di
 *  baris 1, jadi urutan kolom tidak masalah dan kolom baru bisa
 *  ditambahkan di sebelah kanan tanpa merusak data yang sudah ada.
 * =====================================================================
 */

const KIBLAT_HEADERS_ = [
  'Id',
  'Jenis',
  'NamaMasjid',
  'Alamat',
  'Desa',
  'Kecamatan',
  'PenyelenggaraPendiri',
  'LintangDerajat',
  'LintangMenit',
  'LintangDetik',
  'LintangHemisfer',
  'BujurDerajat',
  'BujurMenit',
  'BujurDetik',
  'BujurHemisfer',
  'TanggalKalibrasi',
  'JamKalibrasi',
  'TanggalHijriah',
  'Petugas',
  'Saksi1',
  'Saksi2',
  'DibuatPada',
  'DiubahPada'
];

// Kolom yang disimpan sebagai TEKS (format "@"): mencegah Sheets mengubah
// "11:11" jadi jam, "2026-07-01" jadi tanggal (yang bisa bergeser hari
// karena zona waktu), atau teks berawalan "=" dianggap rumus.
const KIBLAT_TEXT_COLUMNS_ = [
  'Id', 'Jenis', 'NamaMasjid', 'Alamat', 'Desa', 'Kecamatan', 'PenyelenggaraPendiri',
  'LintangHemisfer', 'BujurHemisfer', 'TanggalKalibrasi', 'JamKalibrasi', 'TanggalHijriah',
  'Petugas', 'Saksi1', 'Saksi2'
];

/**
 * Menjamin sheet DataKiblat punya semua kolom yang dibutuhkan. Aman
 * dipanggil berkali-kali. Sheet kosong -> header lengkap ditulis; sheet yang
 * sudah ada -> hanya kolom yang belum ada ditambahkan di sebelah kanan.
 */
function ensureKiblatSchema_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, KIBLAT_HEADERS_.length).setValues([KIBLAT_HEADERS_]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  const missing = KIBLAT_HEADERS_.filter(function (h) {
    return headers.indexOf(h) === -1;
  });
  if (missing.length === 0) return;

  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  Logger.log('Skema DataKiblat diperbarui, kolom ditambahkan: ' + missing.join(', '));
}

function getKiblatSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_KIBLAT);
  if (!sheet) {
    throw new Error('Sheet "DataKiblat" belum ada. Jalankan setupDatabase() terlebih dahulu.');
  }
  ensureKiblatSchema_(sheet);
  return sheet;
}

function getKiblatHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
}

function kiblatCamel_(header) {
  return String(header).charAt(0).toLowerCase() + String(header).slice(1);
}

/** Jam "HH:mm" dari nilai sel: teks apa adanya; tipe jam/angka dikonversi. */
function kiblatJamTeks_(val, tz) {
  if (val instanceof Date) return Utilities.formatDate(val, tz, 'HH:mm');
  if (typeof val === 'number' && val >= 0 && val < 1) {
    const menit = Math.round(val * 1440);
    return ('0' + Math.floor(menit / 60)).slice(-2) + ':' + ('0' + (menit % 60)).slice(-2);
  }
  const s = String(val === null || val === undefined ? '' : val).trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : s;
}

/** Semua data arah kiblat sebagai array of object (nama field = header camelCase). */
function listKiblat() {
  const sheet = getKiblatSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const idCol = headers.indexOf('Id');
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[idCol]) continue; // lewati baris tanpa Id
    const obj = {};
    headers.forEach(function (h, idx) {
      if (!h) return;
      let val = row[idx];
      if (h === 'JamKalibrasi') {
        val = kiblatJamTeks_(val, tz);
      } else if (val instanceof Date) {
        // Tanggal kalibrasi = tanggal kalender murni (hindari pergeseran hari karena UTC);
        // kolom lain (DibuatPada/DiubahPada) = cap waktu -> ISO.
        val = h === 'TanggalKalibrasi' ? Utilities.formatDate(val, tz, 'yyyy-MM-dd') : val.toISOString();
      }
      obj[kiblatCamel_(h)] = val;
    });
    if (!obj.jenis) obj.jenis = 'masjid';
    rows.push(obj);
  }
  return rows;
}

function findKiblatRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const idCol = getKiblatHeaders_(sheet).indexOf('Id') + 1;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return null;
}

/** Angka dari nilai kiriman klien (boleh teks dengan koma desimal); NaN kalau bukan angka. */
function kiblatAngka_(v) {
  if (typeof v === 'number') return v;
  const s = String(v === null || v === undefined ? '' : v).trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
}

function kiblatTanggalValid_(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function kiblatJamValid_(text) {
  const m = /^(\d{2}):(\d{2})$/.exec(text);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Memeriksa satu koordinat derajat/menit/detik; mengembalikan pesan galat atau null. */
function kiblatCekKoordinat_(label, d, m, s, hemisfer, maksDerajat, hemisferValid) {
  if (!(isFinite(d) && Math.floor(d) === d && d >= 0 && d <= maksDerajat)) {
    return label + ': derajat harus bilangan bulat 0 sampai ' + maksDerajat + '.';
  }
  if (!(isFinite(m) && Math.floor(m) === m && m >= 0 && m <= 59)) {
    return label + ': menit harus bilangan bulat 0 sampai 59.';
  }
  if (!(isFinite(s) && s >= 0 && s < 60)) {
    return label + ': detik harus 0 sampai kurang dari 60.';
  }
  if (hemisferValid.indexOf(hemisfer) === -1) {
    return label + ': hemisfer harus salah satu dari ' + hemisferValid.join(' / ') + '.';
  }
  if (d === maksDerajat && (m > 0 || s > 0)) {
    return label + ' tidak boleh lebih dari ' + maksDerajat + ' derajat.';
  }
  return null;
}

function kiblatTeks_(v, maks) {
  return String(v === null || v === undefined ? '' : v).trim().substring(0, maks);
}

/**
 * Simpan data arah kiblat. data.id terisi -> perbarui baris itu; kosong ->
 * tambah baris baru dengan Id baru (UUID).
 */
function saveKiblat(data) {
  data = data || {};

  const jenis = String(data.jenis || '').trim().toLowerCase() === 'musola' ? 'musola' : 'masjid';
  const labelEntitas = jenis === 'musola' ? 'Musala' : 'Masjid';
  const nama = kiblatTeks_(data.namaMasjid, 200);
  const alamat = kiblatTeks_(data.alamat, 300);
  const desa = kiblatTeks_(data.desa, 100);
  const kecamatan = kiblatTeks_(data.kecamatan, 100);
  if (!nama) return { success: false, message: 'Nama ' + labelEntitas + ' wajib diisi.' };
  if (!alamat) return { success: false, message: 'Alamat wajib diisi.' };
  if (!kecamatan) return { success: false, message: 'Kecamatan wajib diisi.' };
  if (!desa) return { success: false, message: 'Desa wajib diisi.' };

  const lintangHem = String(data.lintangHemisfer || '').trim().toUpperCase();
  const bujurHem = String(data.bujurHemisfer || '').trim().toUpperCase();
  const lintang = [kiblatAngka_(data.lintangDerajat), kiblatAngka_(data.lintangMenit), kiblatAngka_(data.lintangDetik)];
  const bujur = [kiblatAngka_(data.bujurDerajat), kiblatAngka_(data.bujurMenit), kiblatAngka_(data.bujurDetik)];
  const galatLintang = kiblatCekKoordinat_('Lintang', lintang[0], lintang[1], lintang[2], lintangHem, 90, ['S', 'U']);
  if (galatLintang) return { success: false, message: galatLintang };
  const galatBujur = kiblatCekKoordinat_('Bujur', bujur[0], bujur[1], bujur[2], bujurHem, 180, ['T', 'B']);
  if (galatBujur) return { success: false, message: galatBujur };

  const tanggal = String(data.tanggalKalibrasi || '').trim();
  const jam = String(data.jamKalibrasi || '').trim();
  if (!kiblatTanggalValid_(tanggal)) return { success: false, message: 'Tanggal kalibrasi wajib diisi dengan benar.' };
  if (!kiblatJamValid_(jam)) return { success: false, message: 'Jam kalibrasi wajib diisi dengan format JJ:MM.' };

  const sheet = getKiblatSheet_();
  const headers = getKiblatHeaders_(sheet);
  const now = new Date();
  const r2 = function (x) { return Math.round(x * 100) / 100; };

  const fields = {
    'Jenis': jenis,
    'NamaMasjid': nama,
    'Alamat': alamat,
    'Desa': desa,
    'Kecamatan': kecamatan,
    'PenyelenggaraPendiri': kiblatTeks_(data.penyelenggaraPendiri, 200),
    'LintangDerajat': lintang[0],
    'LintangMenit': lintang[1],
    'LintangDetik': r2(lintang[2]),
    'LintangHemisfer': lintangHem,
    'BujurDerajat': bujur[0],
    'BujurMenit': bujur[1],
    'BujurDetik': r2(bujur[2]),
    'BujurHemisfer': bujurHem,
    'TanggalKalibrasi': tanggal,
    'JamKalibrasi': jam,
    'TanggalHijriah': kiblatTeks_(data.tanggalHijriah, 40),
    'Petugas': kiblatTeks_(data.petugas, 120),
    'Saksi1': kiblatTeks_(data.saksi1, 120),
    'Saksi2': kiblatTeks_(data.saksi2, 120),
    'DiubahPada': now
  };

  // Format teks untuk kolom bertipe teks pada baris yang akan ditulis.
  const formatTeks = function (rowIndex) {
    KIBLAT_TEXT_COLUMNS_.forEach(function (name) {
      const idx = headers.indexOf(name);
      if (idx !== -1) sheet.getRange(rowIndex, idx + 1).setNumberFormat('@');
    });
  };

  if (data.id) {
    const rowIndex = findKiblatRow_(sheet, data.id);
    if (!rowIndex) return { success: false, message: 'Data tidak ditemukan (mungkin sudah dihapus).' };
    const range = sheet.getRange(rowIndex, 1, 1, headers.length);
    const row = range.getValues()[0];
    Object.keys(fields).forEach(function (name) {
      const idx = headers.indexOf(name);
      if (idx !== -1) row[idx] = fields[name];
    });
    formatTeks(rowIndex);
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

  const newRow = sheet.getLastRow() + 1;
  if (newRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  formatTeks(newRow);
  sheet.getRange(newRow, 1, 1, headers.length).setValues([row]);
  return { success: true, id: id };
}

function deleteKiblat(id) {
  if (!id) return { success: false, message: 'Id tidak diberikan.' };
  const sheet = getKiblatSheet_();
  const rowIndex = findKiblatRow_(sheet, id);
  if (!rowIndex) return { success: false, message: 'Data arah kiblat tidak ditemukan (mungkin sudah dihapus).' };
  sheet.deleteRow(rowIndex);
  return { success: true };
}