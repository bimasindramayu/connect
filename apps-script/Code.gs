/**
 * =====================================================================
 *  BIMASATU API - Google Apps Script (Spreadsheet sebagai database)
 *  Melayani menu Sertifikat Masjid/Musala, Sertifikat Arah Kiblat, dan
 *  Pengaturan Sertifikat, serta BAST NR (Bast.gs). Drive TIDAK lagi dipakai untuk
 *  arsip baru: semua dokumen berada di folder master BIMASATU yang dikelola
 *  Edge Function "bop" (lihat Bast.gs).
 * =====================================================================
 *
 *  Website BIMASATU memanggil Web App ini lewat fetch(). Login TIDAK dikelola
 *  di sini: website mengirim token login Supabase (field "token"), lalu Apps
 *  Script menanyakan ke Supabase siapa pemilik token itu dan menu apa saja yang
 *  boleh dibuka perannya (fungsi akses_saya; diatur admin di halaman "Hak Akses
 *  Menu"). Tiap aksi di bawah menyebut menu yang diperlukannya: akun yang
 *  perannya tidak diberi menu itu ditolak. Admin selalu boleh.
 *  Hasil pemeriksaan disimpan di cache 5 menit, jadi Supabase hanya terkena
 *  beberapa permintaan kecil; perubahan role, hak akses menu, atau pencabutan
 *  sesi berlaku paling lama 5 menit. Sheet "Users" dan password lama tidak
 *  dipakai lagi.
 *
 *  Pemasangan / pembaruan (project Apps Script yang sama dengan sertifikat):
 *   1. Ganti isi Code.gs dan Bast.gs dengan file ini. Masjid.gs, Kiblat.gs, dan
 *      Pengaturan.gs tidak berubah. Hapus Dokumen.gs bila masih ada. Setelah
 *      menempel Code.gs, pastikan SUPABASE_URL dan SUPABASE_KEY di bawah masih benar.
 *   2. Project Settings > centang "Show appsscript.json manifest file in
 *      editor", lalu ganti isi appsscript.json dengan berkas dari paket ini.
 *   3. Jalankan setupDatabase (aman diulang), lalu authorizeAccess. Setujui
 *      izin yang diminta dan baca hasilnya di Execution log.
 *   4. Deploy > New deployment > Web app: Execute as "Me", Who has access
 *      "Anyone". Salin URL-nya. Deployment lama tidak ikut berubah, jadi portal
 *      lama tetap jalan selama pengujian. Untuk pembaruan kode berikutnya:
 *      Deploy > Manage deployments > ikon pensil > Version: New version.
 *   5. Buka URL Web App di tab baru: harus tampil JSON {"status":"ok", ...}.
 */

/* ===================== KONFIGURASI (isi di sini saja) ===================== */

// Sama dengan CFG.url dan CFG.key di js/config.js (kunci "publishable" memang publik).
const SUPABASE_URL = 'https://lpfwkitppdnlcakkncov.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AfVmUT86ttPMaiO3iUmJew_u3l3IBPF';

// (DRIVE_MASTER_FOLDER_ID sudah tidak dipakai: arsip BAST NR kini disimpan Edge Function "bop" ke folder master
// BIMASATU dengan akun Google yang sama dengan LPJ BOP. Bila baris itu masih ada di salinan Anda, boleh dihapus.)

/* ========================================================================== */

const VERSI_ = '1.2 (hak akses menu per peran; arsip BAST NR lewat folder master)';

const SHEET_MASJID = 'DataMasjid';
const SHEET_PENGATURAN = 'Pengaturan';
const SHEET_KIBLAT = 'DataKiblat';

const CACHE_LOGIN_DETIK_ = 300; // lama hasil pemeriksaan token disimpan
const CACHE_GAGAL_DETIK_ = 60; // token yang ditolak Supabase diingat sebentar, agar tidak ditanyakan berulang
const PESAN_SESI_ = 'Sesi tidak valid atau sudah berakhir. Silakan login ulang.';

/* =========================== API ROUTER =========================== */

/**
 * Tabel aksi. Tiap aksi: run(payload, user) -> objek hasil. write:true = menulis
 * data, dijalankan dengan kunci agar dua admin tidak menulis bersamaan.
 * Modul tambahan (Bast.gs) mendaftarkan aksinya lewat fungsi
 * bastActions_() dengan bentuk yang sama, jadi Code.gs tidak perlu diubah.
 */
function actions_() {
  // menu: satu kunci menu atau daftar kunci (salah satu cukup); tanpa menu = semua akun yang sudah login. admin:true = khusus admin.
  const dasar = {
    whoami: {
      run: function (p, user) {
        return { success: true, nama: user.nama, role: user.role, menus: user.menus };
      }
    },
    listMasjid: {
      menu: 'sert-masjid',
      run: function () {
        return { success: true, data: listMasjid() };
      }
    },
    saveMasjid: {
      menu: 'sert-masjid',
      write: true,
      run: function (p) {
        return saveMasjid(p.data);
      }
    },
    deleteMasjid: {
      menu: 'sert-masjid',
      write: true,
      run: function (p) {
        return deleteMasjid(p.id);
      }
    },
    listKiblat: {
      menu: 'sert-kiblat',
      run: function () {
        return { success: true, data: listKiblat() };
      }
    },
    saveKiblat: {
      menu: 'sert-kiblat',
      write: true,
      run: function (p) {
        return saveKiblat(p.data);
      }
    },
    deleteKiblat: {
      menu: 'sert-kiblat',
      write: true,
      run: function (p) {
        return deleteKiblat(p.id);
      }
    },
    getPengaturan: {   // data penanda tangan dipakai juga saat mencetak sertifikat Masjid dan Arah Kiblat
      menu: ['sert-pengaturan', 'sert-masjid', 'sert-kiblat'],
      run: function () {
        return { success: true, data: getPengaturan() };
      }
    },
    savePengaturan: {
      menu: 'sert-pengaturan',
      write: true,
      run: function (p) {
        return savePengaturan(p.data);
      }
    }
  };
  const tambahan = typeof bastActions_ === 'function' ? bastActions_() : {};
  return Object.assign({}, dasar, tambahan);
}

/**
 * Semua aksi data lewat POST dengan body JSON:
 *   { "action": "listMasjid", "token": "<token login Supabase>", ... }
 * Body dikirim frontend dengan Content-Type text/plain (bukan application/json)
 * supaya browser tidak mengirim preflight CORS (OPTIONS) yang tidak ditangani
 * Apps Script. Isinya tetap JSON valid.
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ success: false, code: 'BAD_REQUEST', message: 'Format permintaan tidak valid (bukan JSON).' });
  }
  if (!payload || typeof payload !== 'object') {
    return json_({ success: false, code: 'BAD_REQUEST', message: 'Format permintaan tidak valid.' });
  }

  let hasil;
  try {
    hasil = tangani_(payload);
  } catch (err) {
    hasil = { success: false, code: (err && err.code) || 'ERROR', message: err && err.message ? err.message : String(err) };
  }
  return json_(hasil);
}

function tangani_(payload) {
  const daftar = actions_();
  const nama = String(payload.action || '');
  if (!Object.prototype.hasOwnProperty.call(daftar, nama)) {
    return { success: false, code: 'UNKNOWN_ACTION', message: 'Aksi tidak dikenali: ' + nama.substring(0, 40) };
  }

  const user = periksaToken_(payload.token);
  const aksi = daftar[nama];
  izinkan_(aksi, user);
  if (!aksi.write) return aksi.run(payload, user);

  const kunci = LockService.getScriptLock();
  try {
    kunci.waitLock(20000);
  } catch (err) {
    throw galat_('BUSY', 'Server sedang menyimpan data lain. Coba lagi sebentar lagi.');
  }
  try {
    return aksi.run(payload, user);
  } finally {
    kunci.releaseLock();
  }
}

/**
 * Buka URL Web App langsung di tab browser untuk memastikan deployment aktif.
 * Kalau "deployedActions" belum memuat aksi yang baru, deployment masih
 * menjalankan versi kode lama: Deploy > Manage deployments > ikon pensil >
 * Version: New version.
 */
function doGet() {
  return json_({
    status: 'ok',
    app: 'BIMASATU API',
    versi: VERSI_,
    login: 'token Supabase; menu yang boleh dibuka mengikuti Hak Akses Menu per peran',
    konfigurasiSupabase: !!(SUPABASE_URL && SUPABASE_KEY),
    deployedActions: Object.keys(actions_()),
    message: 'API BIMASATU aktif. Aksi data hanya lewat POST dengan token login.'
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function galat_(kode, pesan) {
  const e = new Error(pesan);
  e.code = kode;
  return e;
}

/* ============================ OTENTIKASI ============================ */

/**
 * Menolak aksi bila peran pemanggil tidak diberi menu yang diperlukan aksi itu (user.menus datang dari Supabase,
 * bukan dari kiriman halaman). aksi.admin = khusus admin; aksi.menu = satu kunci atau daftar (salah satu cukup);
 * tanpa keduanya = semua akun yang sudah login.
 */
function izinkan_(aksi, user) {
  if (aksi.admin) {
    if (user.role !== 'admin') throw galat_('FORBIDDEN', 'Aksi ini hanya untuk admin.');
    return;
  }
  if (!aksi.menu || user.role === 'admin') return;
  const perlu = Array.isArray(aksi.menu) ? aksi.menu : [aksi.menu];
  if (perlu.some(function (m) { return user.menus.indexOf(m) !== -1; })) return;
  throw galat_('FORBIDDEN', 'Peran Anda belum diberi hak akses untuk menu ini. Hubungi admin untuk mengaturnya di Hak Akses Menu.');
}

/**
 * Memeriksa token login Supabase dengan SATU permintaan ke fungsi akses_saya() memakai token itu sendiri, jalur yang
 * sama dengan yang dipakai website: Supabase menolak token palsu/kedaluwarsa (HTTP 401) dan fungsi itu hanya
 * mengembalikan profil pemegang token (id diambil dari isi token yang sudah diverifikasi Supabase itu) beserta
 * daftar menu yang boleh dibuka perannya. Hasil di-cache sebesar sisa umur token (maks. CACHE_LOGIN_DETIK_);
 * token yang ditolak di-cache singkat. Alasan penolakan dari Supabase ikut dilaporkan di pesan galat agar mudah ditelusuri.
 * Mengembalikan { id, nama, role, menus: [kunci menu] }.
 */
function periksaToken_(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw galat_('CONFIG', 'SUPABASE_URL dan SUPABASE_KEY di bagian atas Code.gs belum diisi.');
  }
  if (typeof token !== 'string' || token.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    throw galat_('AUTH', PESAN_SESI_ + ' (token tidak terkirim atau rusak)');
  }
  const isi = jwtIsi_(token), sekarang = Math.floor(Date.now() / 1000);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(isi.sub || ''))) {
    throw galat_('AUTH', PESAN_SESI_ + ' (isi token tidak dikenali)');
  }
  if (isi.exp && Number(isi.exp) <= sekarang) throw galat_('AUTH', PESAN_SESI_ + ' (token kedaluwarsa)');

  const cache = CacheService.getScriptCache();
  const kunci = 'sb2_' + sha256Hex_(token);   // awalan sb2_: isi cache berubah bentuk (ada menus), jadi cache versi lama tidak terbaca
  const ada = cache.get(kunci);
  if (ada === 'x') throw galat_('AUTH', PESAN_SESI_ + ' (token ditolak Supabase beberapa saat lalu)');
  if (ada) return JSON.parse(ada);

  const resp = tanyaSupabase_('/rest/v1/rpc/akses_saya', token);
  const kode = resp.getResponseCode(), badan = bacaJson_(resp), alasan = alasanSupabase_(badan, kode);
  if (kode === 401) {
    if (/api key|apikey/i.test(alasan)) {
      throw galat_('CONFIG', 'Supabase menolak SUPABASE_KEY di Code.gs (' + alasan + '). Samakan SUPABASE_URL dan SUPABASE_KEY dengan CFG.url dan CFG.key di js/config.js yang dipakai di produksi.');
    }
    cache.put(kunci, 'x', CACHE_GAGAL_DETIK_);
    throw galat_('AUTH', PESAN_SESI_ + ' (' + alasan + ')');
  }
  if (kode === 404 && badan && badan.code === 'PGRST202') {
    throw galat_('CONFIG', 'Fungsi akses_saya belum ada di Supabase. Jalankan bop.sql versi terbaru di SQL Editor Supabase, lalu coba lagi.');
  }
  if (kode !== 200) {
    throw galat_('SUPABASE', 'Server login (Supabase) tidak merespons dengan benar (' + alasan + '). Coba lagi sebentar lagi.');
  }
  if (!badan || Array.isArray(badan) || typeof badan !== 'object' || !badan.role) throw galat_('FORBIDDEN', 'Profil akun tidak ditemukan.');

  const menus = Array.isArray(badan.menus) ? badan.menus.map(String) : [];
  const info = { id: isi.sub, nama: String(badan.nama || ''), role: String(badan.role || ''), menus: menus };
  const ttl = Math.min(CACHE_LOGIN_DETIK_, (Number(isi.exp) || 0) - sekarang - 5);
  if (ttl >= 5) cache.put(kunci, JSON.stringify(info), ttl);
  return info;
}

function alasanSupabase_(badan, kode) {
  const t = badan && !Array.isArray(badan) ? badan.message || badan.msg || badan.error_description || badan.error || '' : '';
  return 'HTTP ' + kode + (t ? ': ' + String(t).substring(0, 100) : '');
}

function tanyaSupabase_(path, token) {   // fungsi database (RPC) dipanggil dengan POST, isi {}
  try {
    return UrlFetchApp.fetch(SUPABASE_URL + path, {
      method: 'post',
      contentType: 'application/json',
      payload: '{}',
      muteHttpExceptions: true,
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, Accept: 'application/json' }
    });
  } catch (err) {
    throw galat_('SUPABASE', 'Server login (Supabase) tidak dapat dihubungi. Coba lagi sebentar lagi.');
  }
}

function bacaJson_(resp) {
  try {
    return JSON.parse(resp.getContentText());
  } catch (err) {
    return null;
  }
}

/** Isi (payload) JWT sebagai objek, {} bila tidak terbaca. Hanya untuk membaca sub dan exp; keabsahan token diperiksa Supabase. */
function jwtIsi_(token) {
  try {
    const bagian = token.split('.')[1];
    const rata = bagian + '='.repeat((4 - (bagian.length % 4)) % 4);
    return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(rata)).getDataAsString()) || {};
  } catch (err) {
    return {};
  }
}

function sha256Hex_(teks) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, teks, Utilities.Charset.UTF_8)
    .map(function (b) {
      return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
    })
    .join('');
}

/* ============================== DATABASE ============================== */

/**
 * JALANKAN MANUAL dari editor Apps Script (pilih setupDatabase > Run). Membuat sheet
 * "DataMasjid", "DataKiblat", dan "Pengaturan" bila belum ada; pada sheet yang sudah
 * ada hanya kolom/baris yang belum ada yang ditambahkan (data lama tidak diubah).
 * Aman dijalankan ulang setiap kali ada pembaruan kode.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- DataMasjid (Masjid & Musala dibedakan lewat kolom "Jenis") ---
  let masjid = ss.getSheetByName(SHEET_MASJID);
  const masjidBaru = !masjid;
  if (!masjid) masjid = ss.insertSheet(SHEET_MASJID);
  ensureMasjidSchema_(masjid);
  if (masjidBaru) masjid.autoResizeColumns(1, MASJID_HEADERS_.length);
  Logger.log('DataMasjid: ' + (masjidBaru ? 'dibuat.' : 'sudah ada, skema diperiksa.'));

  // --- DataKiblat (masjid/musala yang dikalibrasi arah kiblatnya) ---
  let kiblat = ss.getSheetByName(SHEET_KIBLAT);
  const kiblatBaru = !kiblat;
  if (!kiblat) kiblat = ss.insertSheet(SHEET_KIBLAT);
  ensureKiblatSchema_(kiblat);
  if (kiblatBaru) kiblat.autoResizeColumns(1, KIBLAT_HEADERS_.length);
  Logger.log('DataKiblat: ' + (kiblatBaru ? 'dibuat.' : 'sudah ada, skema diperiksa.'));

  // --- Pengaturan (baris 1-6, lihat Pengaturan.gs; isi kolom B tidak disentuh) ---
  let setelan = ss.getSheetByName(SHEET_PENGATURAN);
  const setelanBaru = !setelan;
  if (!setelan) setelan = ss.insertSheet(SHEET_PENGATURAN);
  ensurePengaturanSchema_(setelan);
  if (setelanBaru) {
    setelan.setColumnWidth(1, 330);
    setelan.setColumnWidth(2, 320);
  }
  Logger.log('Pengaturan: ' + (setelanBaru ? 'dibuat. Isi lewat menu Pengaturan Sertifikat di BIMASATU.' : 'sudah ada, baris baru dilengkapi bila perlu.'));

  // Modul tambahan (Bast.gs) menyiapkan sheet-nya sendiri bila ada.
  if (typeof ensureBastSchemas_ === 'function') ensureBastSchemas_(ss);

  if (ss.getSheetByName('Users')) {
    Logger.log('Sheet "Users" tidak lagi dipakai (login lewat Supabase). Boleh dihapus setelah portal lama dipensiunkan.');
  }
}

/**
 * JALANKAN MANUAL sekali setelah menempel Code.gs dan appsscript.json: memicu
 * layar persetujuan izin (Spreadsheet, Drive, dan koneksi keluar), lalu
 * mencatat apakah Supabase dan Drive terjangkau serta akun Google mana yang
 * dipakai. Hasilnya ada di Execution log.
 */
function authorizeAccess() {
  Logger.log('Spreadsheet: ' + SpreadsheetApp.getActiveSpreadsheet().getName());

  const sb = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/settings', {
    headers: { apikey: SUPABASE_KEY },
    muteHttpExceptions: true
  });
  Logger.log('Supabase Auth: HTTP ' + sb.getResponseCode() + (sb.getResponseCode() === 200 ? ' (terjangkau)' : ' (periksa SUPABASE_URL dan SUPABASE_KEY)'));

  const token = ScriptApp.getOAuthToken();
  const auth = { Authorization: 'Bearer ' + token };
  const drive = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
    headers: auth,
    muteHttpExceptions: true
  });
  Logger.log('Akun Drive yang dipakai Apps Script: HTTP ' + drive.getResponseCode() + ' ' + drive.getContentText());
  Logger.log('Catatan: arsip BAST NR yang BARU disimpan Edge Function ke folder master BIMASATU (akun Google pemilik folder itu). ' +
    'Akun Apps Script di atas hanya dipakai membaca arsip LAMA saat dimigrasi (menu Pengaturan BAST > Pindahkan arsip ke folder master).');

  const info = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  Logger.log('Izin yang melekat pada token: ' + (bacaJson_(info) || {}).scope);
}
