/**
 * BIMASATU - Modul Barang Milik Negara (BMN)
 *
 * Database: Spreadsheet aktif BIMASATU (sheet BMN_Data dan BMN_Setting).
 * Dokumen: Edge Function bop menyimpan file di folder master Drive / BMN.
 * Autentikasi: token Supabase diverifikasi Code.gs; hak menu "bmn" diperiksa router.
 *
 * Data lama dari entry dibaca dari Apps Script /exec dan fallback ke SS_ID asli yang sudah di-hardcode.
 * Impor hanya membaca sheet BMN_Data, mencegah ID ganda, dan menandai foto lama
 * sebagai pending agar disalin ke folder master melalui endpoint bmn-salin.
 */

var BMN_SHEET_ = 'BMN_Data';
var BMN_SETTING_SHEET_ = 'BMN_Setting';
var BMN_HEADERS_ = [
  'ID', 'Satker', 'Kode Barang', 'Nama Barang', 'Jenis', 'Tahun Perolehan',
  'Sumber Perolehan', 'Nilai Perolehan', 'Kondisi', 'Status', 'Lokasi Barang',
  'ID BMN', 'Keterangan', 'Fotos (JSON)', 'Created At', 'Updated At'
];
var BMN_SETTING_HEADERS_ = ['Key', 'Value', 'Keterangan', 'Updated By', 'Updated At'];
var BMN_MAX_FOTO_ = 12;
var BMN_JENIS_ = ['Tanah', 'Gedung/Bangunan', 'Kendaraan', 'Peralatan & Mesin', 'Aset Lainnya'];
var BMN_KONDISI_ = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
var BMN_STATUS_ = ['Digunakan', 'Tidak Digunakan', 'Diusulkan Penghapusan'];

function bmnActions_() {
  return {
    bmnList: { menu: 'bmn', run: function (p, user) { return bmnList_(p || {}, user); } },
    bmnStats: { menu: 'bmn', run: function (p, user) { return bmnStats_(user); } },
    bmnSettings: { menu: 'bmn', run: function () { return bmnSettings_(); } },
    bmnSave: { menu: 'bmn', write: true, run: function (p, user) { return bmnSave_(p.data || {}, user); } },
    bmnDelete: { admin: true, write: true, run: function (p) { return bmnDelete_(p.id); } },
    bmnSaveSetting: { admin: true, write: true, run: function (p, user) { return bmnSaveSetting_(p.key, p.value, user); } },
    bmnImportLegacy: { admin: true, write: true, run: function () { return bmnImportLegacy_(); } }
  };
}

function ensureBMNSchemas_(ss) {
  var sh = ss.getSheetByName(BMN_SHEET_);
  if (!sh) sh = ss.insertSheet(BMN_SHEET_);
  bmnEnsureHeaders_(sh, BMN_HEADERS_);
  var setting = ss.getSheetByName(BMN_SETTING_SHEET_);
  if (!setting) setting = ss.insertSheet(BMN_SETTING_SHEET_);
  bmnEnsureHeaders_(setting, BMN_SETTING_HEADERS_);
  if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);
  if (setting.getFrozenRows() < 1) setting.setFrozenRows(1);
  bmnSetDefaultSetting_(setting, 'allowDataEntry', 'true', 'Mengizinkan Operator KUA menambah dan mengubah data BMN.');
}

function bmnEnsureHeaders_(sh, desired) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, desired.length).setValues([desired]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return;
  }
  var last = Math.max(1, sh.getLastColumn());
  var existing = sh.getRange(1, 1, 1, last).getDisplayValues()[0].map(function (x) { return bmnNorm_(x); });
  var missing = desired.filter(function (h) { return existing.indexOf(bmnNorm_(h)) < 0; });
  if (missing.length) {
    sh.getRange(1, last + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

function bmnNorm_(v) {
  return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function bmnMap_(headers) {
  var out = {};
  headers.forEach(function (h, i) { out[bmnNorm_(h)] = i; });
  return out;
}

function bmnIndex_(map, names) {
  for (var i = 0; i < names.length; i++) {
    var k = bmnNorm_(names[i]);
    if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
  }
  return -1;
}

function bmnCell_(row, map, names) {
  var i = bmnIndex_(map, names);
  return i < 0 ? '' : row[i];
}

function bmnSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureBMNSchemas_(ss);
  return ss.getSheetByName(BMN_SHEET_);
}

function bmnSettingSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureBMNSchemas_(ss);
  return ss.getSheetByName(BMN_SETTING_SHEET_);
}

function bmnSetDefaultSetting_(sh, key, value, description) {
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === key) return;
  sh.appendRow([key, value, description, 'system', new Date()]);
}

function bmnReadSettings_() {
  var sh = bmnSettingSheet_(), rows = sh.getDataRange().getValues(), out = { allowDataEntry: true };
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === 'allowDataEntry') out.allowDataEntry = !/^(false|0|no)$/i.test(String(rows[i][1]).trim());
  }
  return out;
}

function bmnSettings_() {
  return { success: true, data: bmnReadSettings_() };
}

function bmnSaveSetting_(key, value, user) {
  if (key !== 'allowDataEntry') return { success: false, message: 'Pengaturan BMN tidak dikenal.' };
  var sh = bmnSettingSheet_(), rows = sh.getDataRange().getValues(), rowNo = -1;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === key) { rowNo = i + 1; break; }
  var val = value === true || String(value).toLowerCase() === 'true' ? 'true' : 'false';
  var data = [key, val, 'Mengizinkan Operator KUA menambah dan mengubah data BMN.', user.nama || 'Admin', new Date()];
  if (rowNo > 0) sh.getRange(rowNo, 1, 1, data.length).setValues([data]); else sh.appendRow(data);
  return { success: true, data: { key: key, value: val === 'true' } };
}

function bmnNormalSatker_(v) {
  return String(v || '').trim().toLowerCase()
    .replace(/^kua\s*(kec\.?|kecamatan)?\s*/i, '')
    .replace(/\s+/g, ' ');
}

function bmnIsOperator_(user) {
  return String(user.role || '').toLowerCase() === 'operator';
}

function bmnOwnSatker_(user) {
  return String(user.kua || '').trim();
}

function bmnRows_() {
  var sh = bmnSheet_(), values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var map = bmnMap_(values[0]);
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!bmnCell_(r, map, ['ID'])) continue;
    var photos = [];
    try {
      var raw = bmnCell_(r, map, ['Fotos (JSON)', 'FotosJson', 'Fotos']);
      photos = Array.isArray(raw) ? raw : JSON.parse(String(raw || '[]'));
      if (!Array.isArray(photos)) photos = [];
    } catch (e) { photos = []; }
    result.push({
      id: String(bmnCell_(r, map, ['ID']) || ''),
      satker: String(bmnCell_(r, map, ['Satker', 'KUA']) || ''),
      kodeBarang: String(bmnCell_(r, map, ['Kode Barang', 'KodeBarang']) || ''),
      namaBarang: String(bmnCell_(r, map, ['Nama Barang', 'NamaBarang']) || ''),
      jenis: String(bmnCell_(r, map, ['Jenis']) || ''),
      tahunPerolehan: String(bmnCell_(r, map, ['Tahun Perolehan', 'TahunPerolehan']) || ''),
      sumberPerolehan: String(bmnCell_(r, map, ['Sumber Perolehan', 'SumberPerolehan']) || ''),
      nilaiPerolehan: Number(bmnCell_(r, map, ['Nilai Perolehan', 'NilaiPerolehan']) || 0),
      kondisi: String(bmnCell_(r, map, ['Kondisi']) || ''),
      status: String(bmnCell_(r, map, ['Status']) || ''),
      lokasiBarang: String(bmnCell_(r, map, ['Lokasi Barang', 'LokasiBarang']) || ''),
      idBMN: String(bmnCell_(r, map, ['ID BMN', 'IdBMN']) || ''),
      keterangan: String(bmnCell_(r, map, ['Keterangan']) || ''),
      fotos: photos,
      createdAt: bmnCell_(r, map, ['Created At', 'CreatedAt']) || '',
      updatedAt: bmnCell_(r, map, ['Updated At', 'UpdatedAt']) || '',
      _row: i + 1
    });
  }
  return result;
}

function bmnList_(p, user) {
  var filters = p.filters || {}, rows = bmnRows_();
  if (bmnIsOperator_(user)) {
    var own = bmnNormalSatker_(bmnOwnSatker_(user));
    if (!own) return { success: false, message: 'Profil Operator KUA belum memiliki KUA. Hubungi Admin.' };
    rows = rows.filter(function (r) { return bmnNormalSatker_(r.satker) === own; });
  } else if (filters.satker) {
    rows = rows.filter(function (r) { return bmnNormalSatker_(r.satker) === bmnNormalSatker_(filters.satker); });
  }
  if (filters.jenis) rows = rows.filter(function (r) { return r.jenis === filters.jenis; });
  if (filters.kondisi) rows = rows.filter(function (r) { return r.kondisi === filters.kondisi; });
  if (filters.status) rows = rows.filter(function (r) { return r.status === filters.status; });
  if (filters.search) {
    var q = String(filters.search).toLowerCase();
    rows = rows.filter(function (r) {
      return [r.kodeBarang, r.namaBarang, r.idBMN, r.lokasiBarang, r.satker].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  rows.sort(function (a, b) { return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)); });
  return { success: true, data: rows.map(function (r) { delete r._row; return r; }) };
}

function bmnStats_(user) {
  var list = bmnList_({}, user);
  if (!list.success) return list;
  var rows = list.data, stats = {
    total: rows.length, baik: 0, rusakRingan: 0, rusakBerat: 0,
    digunakan: 0, tidakDigunakan: 0, byJenis: {}
  };
  rows.forEach(function (r) {
    if (r.kondisi === 'Baik') stats.baik++;
    if (r.kondisi === 'Rusak Ringan') stats.rusakRingan++;
    if (r.kondisi === 'Rusak Berat') stats.rusakBerat++;
    if (r.status === 'Digunakan') stats.digunakan++;
    if (r.status === 'Tidak Digunakan') stats.tidakDigunakan++;
    stats.byJenis[r.jenis] = (stats.byJenis[r.jenis] || 0) + 1;
  });
  return { success: true, data: stats };
}

function bmnSave_(data, user) {
  if (!data || typeof data !== 'object') return { success: false, message: 'Data BMN tidak valid.' };
  if (!bmnIsOperator_(user) && user.role !== 'admin') return { success: false, message: 'Peran Anda hanya memiliki akses baca BMN.' };
  if (bmnIsOperator_(user) && !bmnReadSettings_().allowDataEntry) {
    return { success: false, message: 'Input Data BMN sedang ditutup oleh Admin.' };
  }
  var nama = String(data.namaBarang || '').trim();
  var jenis = String(data.jenis || '').trim();
  var satker = bmnIsOperator_(user) ? bmnOwnSatker_(user) : String(data.satker || '').trim();
  if (!satker) return { success: false, message: 'Nama Satker/KUA wajib diisi.' };
  if (!nama) return { success: false, message: 'Nama barang wajib diisi.' };
  if (BMN_JENIS_.indexOf(jenis) < 0) return { success: false, message: 'Jenis barang tidak valid.' };
  if (data.kondisi && BMN_KONDISI_.indexOf(String(data.kondisi)) < 0) return { success: false, message: 'Kondisi barang tidak valid.' };
  if (data.status && BMN_STATUS_.indexOf(String(data.status)) < 0) return { success: false, message: 'Status penggunaan tidak valid.' };
  var photos = Array.isArray(data.fotos) ? data.fotos : [];
  if (photos.length > BMN_MAX_FOTO_) return { success: false, message: 'Maksimal ' + BMN_MAX_FOTO_ + ' foto/dokumen per barang.' };
  var sh = bmnSheet_(), values = sh.getDataRange().getValues(), map = bmnMap_(values[0]), rowNo = -1, old = null;
  if (data.id) {
    var all = bmnRows_();
    for (var i = 0; i < all.length; i++) if (all[i].id === String(data.id)) { old = all[i]; rowNo = all[i]._row; break; }
    if (rowNo > 0 && bmnIsOperator_(user) && bmnNormalSatker_(old.satker) !== bmnNormalSatker_(satker)) {
      return { success: false, message: 'Anda tidak berhak mengubah BMN Satker lain.' };
    }
    if (rowNo < 0) return { success: false, message: 'Data BMN tidak ditemukan.' };
  }
  var id = data.id ? String(data.id) : 'BMN-' + Utilities.getUuid().replace(/-/g, '').substring(0, 16).toUpperCase();
  var created = old ? old.createdAt : new Date(), now = new Date();
  var valuesByHeader = {
    'id': id, 'satker': satker, 'kodebarang': String(data.kodeBarang || '').trim(),
    'namabarang': nama, 'jenis': jenis, 'tahunperolehan': String(data.tahunPerolehan || '').trim(),
    'sumberperolehan': String(data.sumberPerolehan || '').trim(),
    'nilaiperolehan': Number(String(data.nilaiPerolehan || '0').replace(/[^\d.-]/g, '')) || 0,
    'kondisi': String(data.kondisi || 'Baik'), 'status': String(data.status || 'Digunakan'),
    'lokasibarang': String(data.lokasiBarang || '').trim(), 'idbmn': String(data.idBMN || '').trim(),
    'keterangan': String(data.keterangan || '').trim(), 'fotosjson': JSON.stringify(photos),
    'createdat': created, 'updatedat': now
  };
  var row = rowNo > 0 ? values[rowNo - 1].slice() : new Array(values[0].length).fill('');
  Object.keys(valuesByHeader).forEach(function (key) {
    var idx = bmnIndex_(map, [key]);
    if (idx >= 0) row[idx] = valuesByHeader[key];
  });
  if (rowNo > 0) sh.getRange(rowNo, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return { success: true, data: { id: id, satker: satker } };
}

function bmnDelete_(id) {
  id = String(id || '');
  if (!id) return { success: false, message: 'ID BMN tidak valid.' };
  var sh = bmnSheet_(), all = bmnRows_();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      sh.deleteRow(all[i]._row);
      return { success: true, data: { id: id } };
    }
  }
  return { success: false, message: 'Data BMN tidak ditemukan.' };
}

/**
 * Impor data lama dari spreadsheet project entry. File/foto lama tidak dijadikan
 * lokasi aktif; setiap foto disimpan sebagai legacyUrl agar admin dapat menyalinnya
 * ke folder master BIMASATU lewat fitur migrasi foto.
 */
// URL Web App Apps Script lama (repo entry). Dibaca melalui endpoint /exec,
// sehingga Apps Script BIMASATU tidak perlu diberi akses langsung ke Spreadsheet lama.
// Sumber asli BMN dari project entry (Google Apps Script/code-main.gs).
// SS_ID ini disalin persis dari konfigurasi asli repository bimasindramayu/entry.
var BMN_LEGACY_SPREADSHEET_ID_ = '1yz9IeOW9WSDRM9JHwBHYtwi5xmA9hIxJVFPX9G10pNw';
var BMN_LEGACY_EXEC_URL_ = 'https://script.google.com/macros/s/AKfycbwQZiSPbvdnz-814dlNsdI6seG4SQG43JAqbX23RuYaGZR2_-V8i1BlkONATP6ZbeSi/exec';

/**
 * Membaca data dari endpoint /exec BMN lama. Jika endpoint tidak mengembalikan
 * data valid, gunakan ID Spreadsheet SS_ID asli sebagai fallback langsung.
 */
function bmnReadLegacySource_() {
  var endpointError = '';
  try {
    var response = UrlFetchApp.fetch(BMN_LEGACY_EXEC_URL_, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ action: 'getBMNData', kua: '' }),
      muteHttpExceptions: true,
      followRedirects: true
    });
    var status = response.getResponseCode();
    var body = response.getContentText();
    if (status >= 200 && status < 300) {
      var payload = JSON.parse(body);
      if (payload && payload.success === true && Array.isArray(payload.data)) {
        return { data: payload.data, source: 'Apps Script /exec BMN lama' };
      }
      endpointError = String(payload && payload.message || 'Respons /exec tidak berisi data BMN.');
    } else {
      endpointError = 'HTTP ' + status + ': ' + body.substring(0, 180);
    }
  } catch (e) {
    endpointError = e.message || String(e);
  }

  // Fallback menggunakan SS_ID yang benar-benar didefinisikan di code-main.gs
  // repository entry. Urutan kolom mengikuti getBMNData() asli di code-bmn.gs.
  try {
    var ss = SpreadsheetApp.openById(BMN_LEGACY_SPREADSHEET_ID_);
    var sh = ss.getSheetByName('BMN_Data');
    if (!sh) throw new Error('Sheet BMN_Data tidak ditemukan pada Spreadsheet sumber.');
    var values = sh.getDataRange().getValues();
    var data = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row || row.every(function (v) { return v === '' || v === null; })) continue;
      var fotos = row[13] || '[]';
      if (typeof fotos === 'string') {
        try { fotos = JSON.parse(fotos); } catch (parseError) { fotos = []; }
      }
      data.push({
        id: row[0], kua: row[1], kodeBarang: row[2], namaBarang: row[3],
        jenis: row[4], tahunPerolehan: row[5], sumberPerolehan: row[6],
        nilaiPerolehan: row[7], kondisi: row[8], status: row[9],
        lokasiBarang: row[10], idBMN: row[11], keterangan: row[12],
        fotos: Array.isArray(fotos) ? fotos : [], createdAt: row[14], updatedAt: row[15]
      });
    }
    return { data: data, source: 'Spreadsheet BMN asli (' + BMN_LEGACY_SPREADSHEET_ID_ + ')', endpointWarning: endpointError };
  } catch (e) {
    throw new Error(
      'Gagal membaca sumber BMN lama. Endpoint /exec: ' + endpointError +
      '. Akses Spreadsheet ID asli (' + BMN_LEGACY_SPREADSHEET_ID_ + '): ' + e.message +
      '. Pastikan akun pemilik Apps Script BIMASATU memiliki akses Viewer ke Spreadsheet BMN lama.'
    );
  }
}

/**
 * Impor idempotent: ID yang sudah ada dilewati, data target tidak ditimpa.
 */
function bmnImportLegacy_() {
  var source = bmnReadLegacySource_();
  var old = source.data;
  var existing = {};
  bmnRows_().forEach(function (r) { existing[String(r.id)] = true; });

  var imported = 0, skipped = 0, fotoPending = 0, errors = [];
  for (var i = 0; i < old.length; i++) {
    var r = old[i] || {};
    var id = String(r.id || '').trim();
    if (!id || existing[id]) { skipped++; continue; }

    var photos = r.fotos;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos || '[]'); } catch (e) { photos = []; }
    }
    if (!Array.isArray(photos)) photos = [];
    photos = photos.map(function (f) {
      f = f || {};
      fotoPending++;
      var fileId = String(f.fileId || f.id || '');
      return {
        legacyFileId: fileId,
        legacyUrl: String(f.fileUrl || f.url || (fileId ? 'https://drive.google.com/file/d/' + fileId + '/view' : '')),
        fileName: String(f.fileName || f.name || 'Dokumen BMN'),
        fileSize: Number(f.fileSize || 0),
        mimeType: String(f.mimeType || f.type || ''),
        migrationStatus: 'pending'
      };
    });

    var satker = String(r.kua || r.satker || '').trim();
    if (satker && !/^(KUA\b|MIN\b|MTSN\b|MAN\b)/i.test(satker)) satker = 'KUA ' + satker;
    var jenis = String(r.jenis || '').trim();
    if (BMN_JENIS_.indexOf(jenis) < 0) jenis = 'Aset Lainnya';
    var kondisi = String(r.kondisi || 'Baik').trim();
    if (BMN_KONDISI_.indexOf(kondisi) < 0) kondisi = 'Baik';
    var statusBarang = String(r.status || 'Digunakan').trim();
    if (BMN_STATUS_.indexOf(statusBarang) < 0) statusBarang = 'Digunakan';

    var mapped = {
      id: id, satker: satker, kodeBarang: r.kodeBarang || '',
      namaBarang: r.namaBarang || '(Nama barang kosong)', jenis: jenis,
      tahunPerolehan: r.tahunPerolehan || '', sumberPerolehan: r.sumberPerolehan || '',
      nilaiPerolehan: r.nilaiPerolehan || 0, kondisi: kondisi, status: statusBarang,
      lokasiBarang: r.lokasiBarang || '', idBMN: r.idBMN || '',
      keterangan: r.keterangan || '', fotos: photos
    };

    var saved;
    try { saved = bmnSave_(mapped, { role: 'admin', nama: 'Migrasi BMN lama' }); }
    catch (e) { saved = { success: false, message: e.message }; }
    if (saved && saved.success) {
      imported++;
      existing[id] = true;
    } else {
      skipped++;
      if (errors.length < 10) errors.push(id + ': ' + String(saved && saved.message || 'gagal disimpan'));
    }
  }

  return {
    success: true,
    data: {
      source: source.source,
      endpointWarning: source.endpointWarning || '',
      sourceCount: old.length,
      imported: imported,
      skipped: skipped,
      fotoPending: fotoPending,
      errors: errors
    }
  };
}


function bmnExport_(p, user) {
  var result = bmnList_({ filters: p.filters || {} }, user);
  if (!result.success) return result;
  var rows = result.data || [];
  if (!rows.length) return { success: false, message: 'Tidak ada data BMN untuk diekspor.' };
  var headers = ['No', 'Satker', 'Kode Barang', 'Nama Barang', 'Jenis', 'Tahun', 'Nilai Perolehan', 'Kondisi', 'Status', 'Lokasi'];
  var data = rows.map(function (r, i) {
    return [i + 1, r.satker, r.kodeBarang, r.namaBarang, r.jenis, r.tahunPerolehan, r.nilaiPerolehan, r.kondisi, r.status, r.lokasiBarang];
  });
  var safe = 'BMN_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMMdd_HHmm');
  if (p.format === 'pdf') {
    var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var table = data.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('');
    var html = '<html><head><meta charset="utf-8"><style>body{font:10px Arial;padding:18px}h2{text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#e8eef7}thead{display:table-header-group}tr{page-break-inside:avoid}</style></head><body><h2>LAPORAN BARANG MILIK NEGARA</h2><p>Kementerian Agama Kabupaten Indramayu</p><table><thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + table + '</tbody></table></body></html>';
    var pdf = Utilities.newBlob(html, MimeType.HTML, 'bmn.html').getAs(MimeType.PDF).setName(safe + '.pdf');
    return { success: true, fileData: Utilities.base64Encode(pdf.getBytes()), fileName: pdf.getName(), mimeType: 'application/pdf' };
  }
  var tsv = [headers].concat(data).map(function (r) {
    return r.map(function (v) { return String(v == null ? '' : v).replace(/[\t\r\n]/g, ' '); }).join('\t');
  }).join('\n');
  var blob = Utilities.newBlob('\uFEFF' + tsv, 'application/vnd.ms-excel', safe + '.xls');
  return { success: true, fileData: Utilities.base64Encode(blob.getBytes()), fileName: blob.getName(), mimeType: 'application/vnd.ms-excel' };
}
