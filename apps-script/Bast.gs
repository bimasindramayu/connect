/**
 * =====================================================================
 *  BAST NR (Berita Acara Serah Terima Sarana Administrasi NR)
 *  Data di Spreadsheet yang sama dengan Sertifikat; arsip dokumen di Google Drive.
 *  Sheet: BastPegawai, BastBA, BastSetting (dibuat oleh setupDatabase).
 *
 *  Aksi didaftarkan ke router Code.gs lewat bastActions_(). Tiap aksi menyebut menu yang diperlukannya
 *  (bast, bast-buat, bast-pegawai, bast-setting; diatur admin di Hak Akses Menu) dan diperiksa di Code.gs.
 *  Aturan yang dulu dijaga trigger Supabase kini dijaga di sini dan berjalan di bawah kunci skrip
 *  (lihat write:true): nomor urut tidak ganda, porporasi tidak tumpang-tindih, Pihak dan Kasi terisi,
 *  LAST_NUMBER hanya maju.
 *
 *  ARSIP: berkasnya TIDAK diunggah dari sini. Edge Function "bop" menyimpannya ke folder master BIMASATU
 *    <folder master> / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>
 *  memakai akun Google yang sama dengan LPJ BOP (akun Apps Script berbeda dan ditolak Drive dengan HTTP 403).
 *  Di sini hanya dicatat id-nya: kolom ArsipId, ArsipLink, dan ArsipMaster ("1" = sudah di folder master).
 *  Arsip LAMA (ArsipMaster kosong; diunggah versi sebelumnya ke folder lain) masih bisa dibaca memakai akun
 *  Apps Script sampai dipindahkan lewat Pengaturan BAST > "Pindahkan arsip ke folder master".
 * =====================================================================
 */

const BAST_TIPE_ARSIP_ = ['application/pdf', 'image/jpeg', 'image/png']; // jenis file arsip yang boleh dibaca
const BAST_KEY_ = ['KASI_NAMA', 'KASI_NIP', 'NOMOR_AWAL_SURAT', 'KODE_KANTOR', 'KODE_KLASIFIKASI', 'NOMOR_FORMAT_TEMPLATE', 'ALAMAT_BIMAS_LENGKAP', 'LAST_NUMBER', 'LAST_NUMBER_YEAR'];
const BAST_DRIVE_ = 'https://www.googleapis.com/drive/v3/files';

// Kolom tiap sheet: [judul kolom di sheet, nama field (snake_case, sama dengan tabel Supabase dulu), tipe: s teks | n angka | d waktu]
const BAST_DEF_ = {
  pegawai: {
    sheet: 'BastPegawai', kunci: 'nip',
    kol: [['Nip', 'nip', 's'], ['Nama', 'nama', 's'], ['Kategori', 'kategori', 's'], ['Jabatan', 'jabatan', 's'], ['Kua', 'kua', 's'], ['Alamat', 'alamat', 's']]
  },
  ba: {
    sheet: 'BastBA', kunci: 'id',
    kol: [['Id', 'id', 'n'], ['NomorUrut', 'nomor_urut', 'n'], ['Tahun', 'tahun', 'n'], ['BlnSrt', 'bln_srt', 'n'], ['Hari', 'hari', 's'], ['Tgl', 'tgl', 's'], ['Bln', 'bln', 's'],
      ['PihakSatuNip', 'pihak_satu_nip', 's'], ['PihakSatuNama', 'pihak_satu_nama', 's'], ['PihakSatuJabatan', 'pihak_satu_jabatan', 's'], ['PihakSatuAlamat', 'pihak_satu_alamat', 's'],
      ['PihakKeduaNip', 'pihak_kedua_nip', 's'], ['PihakKeduaNama', 'pihak_kedua_nama', 's'], ['PihakKeduaJabatan', 'pihak_kedua_jabatan', 's'], ['PihakKeduaAlamat', 'pihak_kedua_alamat', 's'],
      ['BanyakNaBuku', 'banyak_na_buku', 'n'], ['BanyakN', 'banyak_n', 'n'], ['BanyakNb', 'banyak_nb', 'n'], ['NoSeri', 'no_seri', 's'], ['Porporasi', 'porporasi', 's'],
      ['KasiNama', 'kasi_nama', 's'], ['KasiNip', 'kasi_nip', 's'], ['StatusSimkah', 'status_simkah', 's'], ['ArsipId', 'arsip_id', 's'], ['ArsipLink', 'arsip_link', 's'], ['ArsipMaster', 'arsip_master', 's'], ['DiubahPada', 'diubah_pada', 'd']]
  },
  setting: { sheet: 'BastSetting', kunci: 'key', kol: [['Key', 'key', 's'], ['Value', 'value', 's']] }
};

function bastActions_() {
  const semuaMenuBast = ['bast', 'bast-buat', 'bast-pegawai', 'bast-setting'];
  return {
    bastInit: { menu: semuaMenuBast, run: function () { return bastInit_(); } },   // semua halaman BAST memuat datanya dari sini
    bastSaveBA: { menu: 'bast-buat', write: true, run: function (p) { return bastSaveBA_(p.row); } },
    bastStatus: { menu: 'bast', write: true, run: function (p) { return bastStatus_(p.id, p.status); } },
    bastDeleteBA: { menu: 'bast', write: true, run: function (p) { return bastDeleteBA_(p.id); } },
    bastSavePegawai: { menu: 'bast-pegawai', write: true, run: function (p) { return bastSavePegawai_(p.nip, p.data); } },
    bastDeletePegawai: { menu: 'bast-pegawai', write: true, run: function (p) { return bastDeletePegawai_(p.nip); } },
    bastSaveSetting: { menu: 'bast-setting', write: true, run: function (p) { return bastSaveSetting_(p.rows); } },
    bastArsipFile: { menu: ['bast', 'bast-setting'], run: function (p) { return bastArsipFile_(p.id); } },   // hanya arsip LAMA (di luar folder master)
    bastArsipSet: { menu: ['bast', 'bast-setting'], write: true, run: function (p) { return bastArsipSet_(p.id, p.arsipId, p.buangLama === true); } },
    bastArsipHapus: { menu: 'bast', write: true, run: function (p) { return bastArsipHapus_(p.id); } },
    bastImpor: { admin: true, write: true, run: function (p) { return bastImpor_(p); } }   // pemindahan sekali jalan dari Supabase
  };
}

/* ============================ SHEET ============================ */

function bastGagal_(pesan) {
  return { success: false, message: pesan };
}

function bastPad3_(n) {
  return ('00' + n).slice(-3);
}

/** Dipanggil setupDatabase(): membuat sheet BAST bila belum ada; sheet yang sudah ada hanya ditambah kolom yang kurang. */
function ensureBastSchemas_(ss) {
  Object.keys(BAST_DEF_).forEach(function (k) {
    const def = BAST_DEF_[k], judul = def.kol.map(function (c) { return c[0]; });
    let sh = ss.getSheetByName(def.sheet);
    const baru = !sh;
    if (!sh) sh = ss.insertSheet(def.sheet);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, judul.length).setValues([judul]).setFontWeight('bold');
      sh.setFrozenRows(1);
      def.kol.forEach(function (c, i) {
        if (c[2] === 's') sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@'); // NIP, tanggal, porporasi tetap teks
      });
      sh.autoResizeColumns(1, judul.length);
    } else {
      const ada = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      const kurang = judul.filter(function (h) { return ada.indexOf(h) === -1; });
      if (kurang.length) sh.getRange(1, sh.getLastColumn() + 1, 1, kurang.length).setValues([kurang]).setFontWeight('bold');
    }
    Logger.log(def.sheet + ': ' + (baru ? 'dibuat.' : 'sudah ada, skema diperiksa.'));
  });
}

function bastLembar_(def) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.sheet);
  if (!sh) throw new Error('Sheet "' + def.sheet + '" belum ada. Jalankan setupDatabase di editor Apps Script.');
  return sh;
}

function bastJudul_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** Semua baris sebagai objek (field snake_case) + _baris (nomor baris di sheet). Baris tanpa kunci dilewati. */
function bastBaca_(def) {
  const sh = bastLembar_(def), n = sh.getLastRow();
  if (n < 2) return [];
  const nilai = sh.getRange(1, 1, n, sh.getLastColumn()).getValues(), idx = {}, out = [];
  nilai[0].forEach(function (h, i) { idx[String(h).trim()] = i; });
  for (let r = 1; r < nilai.length; r++) {
    const o = { _baris: r + 1 };
    def.kol.forEach(function (c) {
      let v = idx[c[0]] === undefined ? '' : nilai[r][idx[c[0]]];
      if (c[2] === 'n') v = v === '' || v === null ? null : Number(v);
      else if (c[2] === 'd') v = v instanceof Date ? v.toISOString() : String(v || '');
      else v = v === null || v === undefined ? '' : String(v);
      o[c[1]] = v;
    });
    if (o[def.kunci] !== null && String(o[def.kunci]) !== '') out.push(o);
  }
  return out;
}

function bastBersih_(o) {
  const b = {};
  Object.keys(o).forEach(function (k) { if (k !== '_baris') b[k] = o[k]; });
  return b;
}

/** Tulis satu objek ke baris `baris` (perbarui, kolom lain dipertahankan) atau tambah baris baru bila baris kosong. */
function bastTulis_(def, baris, obj) {
  const sh = bastLembar_(def), judul = bastJudul_(sh);
  let baru = false;
  if (!baris) { baris = sh.getLastRow() + 1; baru = true; if (baris > sh.getMaxRows()) sh.insertRowAfter(sh.getMaxRows()); }
  const rng = sh.getRange(baris, 1, 1, judul.length);
  const row = baru ? judul.map(function () { return ''; }) : rng.getValues()[0];
  def.kol.forEach(function (c) {
    const i = judul.indexOf(c[0]);
    if (i !== -1) row[i] = obj[c[1]] === null || obj[c[1]] === undefined ? '' : obj[c[1]];
  });
  if (baru) rng.setNumberFormats([judul.map(function (h) { const c = def.kol.filter(function (x) { return x[0] === h; })[0]; return c && c[2] === 's' ? '@' : 'General'; })]);
  rng.setValues([row]);
}

/** Tambah banyak baris sekaligus (satu kali tulis). */
function bastTambahBanyak_(def, daftar) {
  if (!daftar.length) return;
  const sh = bastLembar_(def), judul = bastJudul_(sh), awal = sh.getLastRow() + 1, akhir = awal + daftar.length - 1;
  while (akhir > sh.getMaxRows()) sh.insertRowAfter(sh.getMaxRows());
  const rng = sh.getRange(awal, 1, daftar.length, judul.length);
  rng.setNumberFormats(daftar.map(function () {
    return judul.map(function (h) { const c = def.kol.filter(function (x) { return x[0] === h; })[0]; return c && c[2] === 's' ? '@' : 'General'; });
  }));
  rng.setValues(daftar.map(function (obj) {
    return judul.map(function (h) {
      const c = def.kol.filter(function (x) { return x[0] === h; })[0], v = c ? obj[c[1]] : '';
      return v === null || v === undefined ? '' : v;
    });
  }));
}

function bastTeks_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function bastAngka_(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ============================ AKSI DATA ============================ */

function bastInit_() {
  const peg = bastBaca_(BAST_DEF_.pegawai).map(bastBersih_).sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  const ba = bastBaca_(BAST_DEF_.ba).map(bastBersih_).sort(function (a, b) { return b.tahun - a.tahun || b.nomor_urut - a.nomor_urut; });
  const set = bastBaca_(BAST_DEF_.setting).map(function (x) { return { key: x.key, value: x.value }; });
  return { success: true, pegawai: peg, ba: ba, setting: set };
}

function bastSetSetting_(pasangan) {
  const def = BAST_DEF_.setting, ada = {};
  bastBaca_(def).forEach(function (x) { ada[x.key] = x._baris; });
  pasangan.forEach(function (p) { bastTulis_(def, ada[p.key] || 0, { key: p.key, value: p.value }); ada[p.key] = ada[p.key] || 1; });
}

function bastSaveBA_(r) {
  r = r || {};
  const s = function (k) { return bastTeks_(r[k]); }, n = function (k) { return bastAngka_(r[k]); };
  const urut = n('nomor_urut'), tahun = n('tahun');
  if (!Number.isInteger(urut) || urut <= 0) return bastGagal_('Nomor Urut wajib diisi dengan angka lebih dari 0.');
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) return bastGagal_('Tahun tidak valid.');
  if (['Sudah', 'Belum'].indexOf(s('status_simkah')) === -1) return bastGagal_('Status SIMKAH harus Sudah atau Belum.');

  const semua = bastBaca_(BAST_DEF_.ba);
  if (semua.some(function (x) { return x.nomor_urut === urut && x.tahun === tahun; })) {
    return bastGagal_('Nomor Urut ' + urut + ' untuk tahun ' + tahun + ' sudah dipakai. Muat ulang halaman untuk usulan nomor terbaru.');
  }
  if (!s('pihak_satu_nip') || !s('pihak_kedua_nip')) return bastGagal_('Pihak Pertama dan Pihak Kedua wajib dipilih.');
  if (!s('kasi_nama') || !s('kasi_nip')) return bastGagal_('Data Kepala Seksi (Mengetahui) wajib diisi: periksa Pengaturan BAST.');
  const m = /(\d+)\s*-\s*(\d+)/.exec(s('porporasi'));
  if (!m) return bastGagal_('Nomor porporasi awal dan akhir wajib diisi dengan angka.');
  const a = BigInt(m[1]), b = BigInt(m[2]);
  if (b < a) return bastGagal_('Nomor porporasi akhir tidak boleh lebih kecil dari awal.');
  for (let i = 0; i < semua.length; i++) {
    const q = /(\d+)\s*-\s*(\d+)/.exec(semua[i].porporasi);
    if (q && a <= BigInt(q[2]) && b >= BigInt(q[1])) {
      return bastGagal_('Nomor porporasi sudah digunakan pada BA Nomor ' + bastPad3_(semua[i].nomor_urut) + ' (rentang ' + semua[i].porporasi + ').');
    }
  }

  const baris = {};
  BAST_DEF_.ba.kol.forEach(function (c) { baris[c[1]] = c[2] === 'n' ? n(c[1]) : s(c[1]); });
  baris.id = semua.reduce(function (mx, x) { return Math.max(mx, x.id); }, 0) + 1;
  baris.arsip_id = ''; baris.arsip_link = ''; baris.arsip_master = ''; baris.diubah_pada = new Date();
  bastTulis_(BAST_DEF_.ba, 0, baris);

  const set = {};
  bastBaca_(BAST_DEF_.setting).forEach(function (x) { set[x.key] = x.value; });
  const terakhir = /^\d+$/.test(set.LAST_NUMBER || '') ? Number(set.LAST_NUMBER) : 0;
  if (set.LAST_NUMBER_YEAR !== String(tahun) || urut > terakhir) {
    bastSetSetting_([{ key: 'LAST_NUMBER', value: String(urut) }, { key: 'LAST_NUMBER_YEAR', value: String(tahun) }]);
  }
  baris.diubah_pada = baris.diubah_pada.toISOString();
  return { success: true, data: baris };
}

function bastCari_(id) {
  const x = bastBaca_(BAST_DEF_.ba).filter(function (r) { return String(r.id) === String(id); })[0];
  if (!x) throw new Error('Berita Acara tidak ditemukan (mungkin sudah dihapus).');
  return x;
}

function bastStatus_(id, status) {
  if (['Sudah', 'Belum'].indexOf(status) === -1) return bastGagal_('Status SIMKAH harus Sudah atau Belum.');
  const x = bastCari_(id);
  x.status_simkah = status; x.diubah_pada = new Date();
  bastTulis_(BAST_DEF_.ba, x._baris, x);
  return { success: true };
}

function bastDeleteBA_(id) {
  const x = bastCari_(id);
  bastLembar_(BAST_DEF_.ba).deleteRow(x._baris); // arsip di Drive sengaja tidak ikut terhapus
  return { success: true };
}

function bastSavePegawai_(nipLama, d) {
  d = d || {};
  const v = { nip: bastTeks_(d.nip), nama: bastTeks_(d.nama), kategori: bastTeks_(d.kategori), jabatan: bastTeks_(d.jabatan), kua: bastTeks_(d.kua), alamat: bastTeks_(d.alamat) };
  if (v.nip.replace(/\D/g, '').length < 18) return bastGagal_('NIP minimal 18 digit.');
  if (!v.nama || !v.jabatan || !v.alamat) return bastGagal_('Nama, Jabatan, dan Alamat wajib diisi.');
  if (['Bimas Islam', 'KUA'].indexOf(v.kategori) === -1) return bastGagal_('Kategori harus Bimas Islam atau KUA.');
  if (v.kategori === 'KUA' && !v.kua) return bastGagal_('KUA Kecamatan wajib dipilih untuk pegawai KUA.');
  if (v.kategori !== 'KUA') v.kua = '';

  const semua = bastBaca_(BAST_DEF_.pegawai), lama = nipLama ? bastTeks_(nipLama) : '';
  const target = lama ? semua.filter(function (x) { return x.nip === lama; })[0] : null;
  if (lama && !target) return bastGagal_('Pegawai tidak ditemukan (mungkin sudah dihapus).');
  if (semua.some(function (x) { return x.nip === v.nip && (!target || x._baris !== target._baris); })) return bastGagal_('NIP ' + v.nip + ' sudah terdaftar.');
  bastTulis_(BAST_DEF_.pegawai, target ? target._baris : 0, v);
  return { success: true };
}

function bastDeletePegawai_(nip) {
  const x = bastBaca_(BAST_DEF_.pegawai).filter(function (r) { return r.nip === bastTeks_(nip); })[0];
  if (!x) return bastGagal_('Pegawai tidak ditemukan (mungkin sudah dihapus).');
  bastLembar_(BAST_DEF_.pegawai).deleteRow(x._baris);
  return { success: true };
}

function bastSaveSetting_(rows) {
  if (!Array.isArray(rows) || !rows.length) return bastGagal_('Tidak ada pengaturan yang dikirim.');
  const pasangan = [];
  for (let i = 0; i < rows.length; i++) {
    const k = bastTeks_(rows[i] && rows[i].key);
    if (BAST_KEY_.indexOf(k) === -1) return bastGagal_('Kunci pengaturan tidak dikenal: ' + k.substring(0, 40));
    pasangan.push({ key: k, value: bastTeks_(rows[i].value).substring(0, 2000) });
  }
  bastSetSetting_(pasangan);
  return { success: true };
}

/* ============================ ARSIP (GOOGLE DRIVE) ============================ */

// Akun Apps Script TIDAK menulis ke Drive lagi. Yang tersisa hanya membaca/membuang arsip LAMA yang dulu diunggah akun ini
// (sebelum arsip dipindah ke folder master), supaya bisa ditampilkan dan disalin oleh fitur migrasi.

function bastDrive_(url, opsi) {
  opsi = opsi || {};
  opsi.muteHttpExceptions = true;
  opsi.headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  const r = UrlFetchApp.fetch(url, opsi);
  if (r.getResponseCode() >= 300) {
    throw new Error('Google Drive menolak permintaan (HTTP ' + r.getResponseCode() + ') untuk arsip lama ini. Akun Apps Script tidak dapat mengaksesnya; ' +
      'unggah ulang arsipnya dari Riwayat BAST (akan disimpan di folder master).');
  }
  return r;
}

function bastIdValid_(id) {
  return /^[\w-]{10,100}$/.test(String(id || ''));
}

function bastLink_(id) {
  return 'https://drive.google.com/file/d/' + id + '/view';
}

function bastBuang_(fileId) {
  bastDrive_(BAST_DRIVE_ + '/' + fileId + '?supportsAllDrives=true', { method: 'patch', contentType: 'application/json', payload: JSON.stringify({ trashed: true }) });
}

/** Pastikan sheet BastBA punya semua kolom (mis. ArsipMaster) walau setupDatabase belum dijalankan ulang setelah pembaruan. */
function bastKolomAda_(def) {
  const sh = bastLembar_(def), ada = bastJudul_(sh);
  const kurang = def.kol.map(function (c) { return c[0]; }).filter(function (h) { return ada.indexOf(h) === -1; });
  if (kurang.length) sh.getRange(1, sh.getLastColumn() + 1, 1, kurang.length).setValues([kurang]).setFontWeight('bold');
}

/**
 * Membaca arsip LAMA (belum di folder master) memakai akun Apps Script: untuk pratinjau sebelum dimigrasi dan sebagai sumber salinan
 * saat migrasi. Arsip di folder master dibaca lewat Edge Function bop (di sini ditolak, jadi id sembarang dari halaman tidak bisa
 * dipakai membaca file lain milik akun Apps Script).
 */
function bastArsipFile_(id) {
  const ba = bastCari_(id);
  if (ba.arsip_master === '1') return bastGagal_('Arsip ini sudah di folder master Google Drive; dibaca lewat server BIMASATU, bukan Apps Script.');
  if (!bastIdValid_(ba.arsip_id)) return bastGagal_('Arsip belum ada.');
  const meta = JSON.parse(bastDrive_(BAST_DRIVE_ + '/' + ba.arsip_id + '?fields=mimeType,trashed&supportsAllDrives=true').getContentText());
  if (meta.trashed || BAST_TIPE_ARSIP_.indexOf(meta.mimeType) === -1) return bastGagal_('Arsip tidak ditemukan di Google Drive.');
  const isi = bastDrive_(BAST_DRIVE_ + '/' + ba.arsip_id + '?alt=media&supportsAllDrives=true').getContent();
  return { success: true, mime: meta.mimeType, base64: Utilities.base64Encode(isi) };
}

/**
 * Mencatat arsip yang SUDAH tersimpan di folder master (diunggah Edge Function bop) pada Berita Acara: cukup id file; tautannya dibuat di sini.
 * buangLama: bila arsip sebelumnya adalah arsip lama di luar folder master (milik akun Apps Script), file itu dibuang ke Sampah (kegagalan
 * tidak menghalangi). Arsip sebelumnya yang sudah di folder master dibuang oleh Edge Function (parameter "ganti"), bukan di sini.
 */
function bastArsipSet_(id, arsipId, buangLama) {
  if (!bastIdValid_(arsipId)) return bastGagal_('ID arsip tidak valid.');
  bastKolomAda_(BAST_DEF_.ba);
  const ba = bastCari_(id), lama = ba.arsip_master === '1' ? '' : ba.arsip_id;
  ba.arsip_id = arsipId; ba.arsip_link = bastLink_(arsipId); ba.arsip_master = '1'; ba.diubah_pada = new Date();
  bastTulis_(BAST_DEF_.ba, ba._baris, ba);
  let dibuang = false;
  if (buangLama && bastIdValid_(lama) && lama !== arsipId) {
    try { bastBuang_(lama); dibuang = true; } catch (err) { /* file lama gagal dibuang: arsip baru tetap tercatat */ }
  }
  return { success: true, link: ba.arsip_link, lamaDibuang: dibuang };
}

/**
 * Mengosongkan arsip pada Berita Acara. Arsip lama (di luar folder master) langsung dibuang ke Sampah di sini; arsip di folder master
 * dibuang oleh Edge Function (halaman memanggilnya sesudah ini), jadi id-nya dikembalikan.
 */
function bastArsipHapus_(id) {
  bastKolomAda_(BAST_DEF_.ba);
  const ba = bastCari_(id), master = ba.arsip_master === '1', sebelumnya = ba.arsip_id;
  ba.arsip_id = ''; ba.arsip_link = ''; ba.arsip_master = ''; ba.diubah_pada = new Date();
  bastTulis_(BAST_DEF_.ba, ba._baris, ba);
  if (!master && bastIdValid_(sebelumnya)) { try { bastBuang_(sebelumnya); } catch (err) { /* abaikan */ } }
  return { success: true, master: master, arsipId: master ? sebelumnya : '' };
}

/* ============================ PINDAH DARI SUPABASE (sekali jalan, aman diulang) ============================ */

/**
 * Menerima potongan data dari halaman "Pindahkan dari Supabase": { pegawai, ba, setting } (salah satunya boleh kosong).
 * Yang sudah ada tidak ditimpa (pegawai menurut NIP, BA menurut nomor urut + tahun, pengaturan menurut kunci).
 * Id Berita Acara dibawa agar arsip dan rujukan lama tetap cocok.
 */
function bastImpor_(p) {
  p = p || {};
  const hasil = { pegawai: { baru: 0, ada: 0 }, ba: { baru: 0, ada: 0 }, setting: { baru: 0, ada: 0 } };

  const nip = {};
  bastBaca_(BAST_DEF_.pegawai).forEach(function (x) { nip[x.nip] = 1; });
  const pegBaru = [];
  (p.pegawai || []).forEach(function (x) {
    const k = bastTeks_(x.nip);
    if (!k) return;
    if (nip[k]) { hasil.pegawai.ada++; return; }
    nip[k] = 1; hasil.pegawai.baru++;
    pegBaru.push({ nip: k, nama: bastTeks_(x.nama), kategori: bastTeks_(x.kategori), jabatan: bastTeks_(x.jabatan), kua: bastTeks_(x.kua), alamat: bastTeks_(x.alamat) });
  });
  bastTambahBanyak_(BAST_DEF_.pegawai, pegBaru);

  const lama = bastBaca_(BAST_DEF_.ba), pakai = {}, id = {};
  let maks = 0;
  lama.forEach(function (x) { pakai[x.nomor_urut + '/' + x.tahun] = 1; id[x.id] = 1; maks = Math.max(maks, x.id); });
  const baBaru = [];
  (p.ba || []).forEach(function (x) {
    const urut = bastAngka_(x.nomor_urut), tahun = bastAngka_(x.tahun);
    if (!urut || !tahun) return;
    if (pakai[urut + '/' + tahun]) { hasil.ba.ada++; return; }
    pakai[urut + '/' + tahun] = 1; hasil.ba.baru++;
    const o = {};
    BAST_DEF_.ba.kol.forEach(function (c) { o[c[1]] = c[2] === 'n' ? bastAngka_(x[c[1]]) : bastTeks_(x[c[1]]); });
    let baru = bastAngka_(x.id);
    if (!Number.isInteger(baru) || baru <= 0 || id[baru]) baru = maks + 1;
    id[baru] = 1; maks = Math.max(maks, baru);
    o.id = baru; o.diubah_pada = new Date();
    baBaru.push(o);
  });
  bastTambahBanyak_(BAST_DEF_.ba, baBaru);

  const kunci = {};
  bastBaca_(BAST_DEF_.setting).forEach(function (x) { kunci[x.key] = 1; });
  const setBaru = [];
  (p.setting || []).forEach(function (x) {
    const k = bastTeks_(x.key);
    if (BAST_KEY_.indexOf(k) === -1) return;
    if (kunci[k]) { hasil.setting.ada++; return; }
    kunci[k] = 1; hasil.setting.baru++;
    setBaru.push({ key: k, value: bastTeks_(x.value) });
  });
  bastTambahBanyak_(BAST_DEF_.setting, setBaru);

  return { success: true, hasil: hasil };
}
