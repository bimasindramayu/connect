/* BARJAS - migrasi data dari Google Apps Script/Spreadsheet lama ke Supabase.
   Login lama hanya dipakai selama halaman ini terbuka; kredensial tidak disimpan. */
(function (w) {
  'use strict';
  var $ = w.$, esc = w.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  var state = { url: '', token: '', master: null, details: [], sourceUsers: [], targetUsers: [], ready: false, running: false };

  function gasCall(action, data, token) {
    return fetch(state.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: token || '', data: data || {} })
    }).then(function (r) {
      if (!r.ok) throw new Error('Server SIPADU lama menjawab HTTP ' + r.status + '.');
      return r.json();
    }).then(function (r) {
      if (!r || r.ok !== true) throw new Error((r && r.error) || 'Balasan server SIPADU lama tidak valid.');
      return r.data;
    });
  }
  function log(text, type) {
    var box = $('#sm-log'); if (!box) return;
    var p = document.createElement('div');
    p.className = 'small py-1' + (type === 'bad' ? ' text-danger' : type === 'ok' ? ' text-success' : ' text-body-secondary');
    p.textContent = new Date().toLocaleTimeString('id-ID') + ' · ' + text;
    box.prepend(p);
  }
  function setProgress(done, total, label) {
    var bar = $('#sm-progress'), txt = $('#sm-progress-text');
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    if (txt) txt.textContent = label || (done + ' / ' + total);
  }
  function chunks(items, size) {
    var out = []; for (var i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out;
  }
  function blobFromBase64(base64, mime) {
    var raw = atob(base64), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/octet-stream' });
  }
  function sourceId(x) { return String(x && x.id != null ? x.id : ''); }

  async function loadPackageDetails() {
    var years = (state.master.tahun || []).map(function (t) { return String(t.id || t); });
    var current = String(App.state.tahun || new Date().getFullYear());
    if (years.indexOf(current) < 0) years.push(current);
    var all = [];
    for (var y = 0; y < years.length; y++) {
      var list = await gasCall('paketList', { tahun: years[y] }, state.token);
      (list || []).forEach(function (p) { all.push(p); });
    }
    var details = [];
    var groups = chunks(all, 4);
    for (var g = 0; g < groups.length; g++) {
      var rows = await Promise.all(groups[g].map(function (p) {
        return gasCall('paketDetail', { id: p.id }, state.token)
          .then(function (detail) { return detail; })
          .catch(function (e) { log('Detail paket ' + (p.nama || p.id) + ' tidak terbaca: ' + e.message, 'bad'); return null; });
      }));
      rows.filter(Boolean).forEach(function (r) { details.push(r); });
      setProgress(details.length, all.length, 'Memuat detail paket ' + details.length + ' / ' + all.length);
    }
    state.details = details;
    return details;
  }

  function drawMapping() {
    var target = state.targetUsers || [], source = state.sourceUsers || [];
    var opts = '<option value="">Lewati (tanpa penugasan)</option>' + target.map(function (u) {
      return '<option value="' + esc(u.id) + '">' + esc(u.nama) + ' · ' + esc(u.username || u.email || u.id) + ' · ' + esc(u.role === 'admin' ? 'Admin' : 'Pengelola Pengadaan') + '</option>';
    }).join('');
    $('#sm-users').innerHTML = source.length ? '<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Akun SIPADU lama</th><th>Hubungkan ke akun CONNECT</th></tr></thead><tbody>' +
      source.map(function (u, i) {
        var match = target.find(function (t) {
          return String(t.username || '').toLowerCase() === String(u.username || '').toLowerCase()
            || String(t.email || '').toLowerCase() === String(u.email || '').toLowerCase();
        });
        return '<tr><td><b>' + esc(u.nama) + '</b><div class="small text-body-secondary">' + esc(u.username) + ' · ' + esc(u.role) + (u.aktif === false ? ' · nonaktif' : '') + '</div></td>' +
          '<td><select class="form-select form-select-sm" data-sm-user="' + i + '">' + opts.replace('value="' + esc(match ? match.id : '') + '"', 'value="' + esc(match ? match.id : '') + '" selected') + '</select></td></tr>';
      }).join('') + '</tbody></table></div>' :
      '<p class="small text-body-secondary">Tidak ada akun lama yang ditemukan.</p>';
  }

  async function connectOld() {
    var url = $('#sm-url').value.trim();
    var username = $('#sm-username').value.trim();
    var password = $('#sm-password').value;
    if (!/\/exec$/.test(url)) throw new Error('URL Web App lama harus diakhiri /exec.');
    if (!username || !password) throw new Error('Isi username dan password Admin SIPADU lama.');
    state.url = url;
    state.ready = false;
    state.master = null;
    state.details = [];
    state.sourceUsers = [];
    $('#sm-connect').disabled = true;
    try {
      var login = await gasCall('login', { username: username, password: password }, '');
      state.token = login.token;
      var master = await gasCall('bootstrap', { tahun: App.state.tahun }, state.token);
      if (!master || typeof master !== 'object' || Array.isArray(master)) {
        throw new Error('Server SIPADU lama tidak mengembalikan data master. Periksa URL Web App dan respons bootstrap, lalu coba hubungkan kembali.');
      }
      state.master = master;
      state.sourceUsers = Array.isArray(master.users) ? master.users : [];
      state.targetUsers = (App.state.master && App.state.master.users) || [];
      await loadPackageDetails();
      drawMapping();
      state.ready = true;
      $('#sm-run').disabled = false;
      $('#sm-result').classList.remove('d-none');
      $('#sm-stats').innerHTML = [
        ['Satuan kerja', (state.master.satker || []).length],
        ['Pejabat', (state.master.pejabat || []).length],
        ['Penyedia', (state.master.penyedia || []).length],
        ['Penugasan', (state.master.penugasan || []).length],
        ['Paket', state.details.length],
        ['Berkas', state.details.reduce(function (n, x) { return n + ((x.dokumen || []).length); }, 0)]
      ].map(function (x) {
        return '<div class="col-6 col-md-4 col-xl-2"><div class="border rounded p-3 h-100"><div class="small text-body-secondary">' + esc(x[0]) + '</div><div class="fs-4 fw-semibold">' + esc(x[1]) + '</div></div></div>';
      }).join('');
      log('Koneksi SIPADU lama berhasil. Master dan detail paket sudah dibaca.', 'ok');
      log('Cocokkan akun lama dengan akun CONNECT. Password lama tidak dipindahkan; akun Supabase memakai password baru.', 'info');
    } finally {
      $('#sm-connect').disabled = false;
    }
  }

  function getUserMap() {
    return state.sourceUsers.map(function (u, i) {
      var sel = $('#sm-users').querySelector('[data-sm-user="' + i + '"]');
      return { legacy_id: String(u.id), auth_user_id: sel && sel.value || '', legacy_username: u.username || '' };
    }).filter(function (x) { return x.auth_user_id; });
  }

  async function migrateMaster(userMap, master, details) {
    var payload = {
      config: master.config || {},
      satker: master.satker || [],
      pejabat: master.pejabat || [],
      penyedia: master.penyedia || [],
      penugasan: master.penugasan || [],
      user_map: userMap,
      paket: [], hps: [], monev: [],
    };
    var result = await API.call('importBatch', payload, { jsonp: false });
    log('Master diimpor: ' + result.satker + ' satker, ' + result.pejabat + ' pejabat, ' + result.penyedia + ' penyedia, ' + result.penugasan + ' penugasan.', 'ok');

    var blocks = chunks(details, 20);
    for (var b = 0; b < blocks.length; b++) {
      var packetRows = [], hpsRows = [], monevRows = [];
      blocks[b].forEach(function (detail) {
        if (!detail || !detail.paket) return;
        packetRows.push(detail.paket);
        if (detail.hps != null) hpsRows.push({
          paket_id: detail.paket.id, payload: JSON.stringify(detail.hps),
          total: Number(detail.hps.total || detail.hps.totalAkhir || 0), updated_at: detail.paket.updated_at || new Date().toISOString()
        });
        if (detail.monev != null) monevRows.push({
          paket_id: detail.paket.id, payload: JSON.stringify(detail.monev), updated_at: new Date().toISOString()
        });
      });
      var batch = await API.call('importBatch', {
        paket: packetRows, hps: hpsRows, monev: monevRows,
        config: {}, satker: [], pejabat: [], penyedia: [], penugasan: [], user_map: []
      }, { jsonp: false });
      log('Paket: ' + (b * 20 + packetRows.length) + ' / ' + details.length + ' selesai. HPS tersimpan: ' + batch.hps + ', Monev: ' + batch.monev + '.', 'ok');
    }
  }

  async function migrateDocuments(master, details) {
    var stateNow = await API.call('importState', {}, { jsonp: false });
    var stored = new Set((stateNow.dokumen || []).filter(function (x) { return x.storage_path; }).map(function (x) { return x.id; }));
    var storedProviders = new Set((stateNow.penyedia || []).filter(function (x) { return x.cp_storage_path; }).map(function (x) { return x.id; }));
    var documents = [];
    details.forEach(function (detail) { (detail.dokumen || []).forEach(function (doc) { documents.push(doc); }); });
    var total = documents.length + (master.penyedia || []).filter(function (p) { return p.cp_file_id; }).length;
    var done = 0, moved = 0, linked = 0, failed = 0;

    for (var i = 0; i < documents.length; i++) {
      var doc = documents[i];
      if (stored.has(String(doc.id))) { done++; setProgress(done, total, 'Berkas ' + done + ' / ' + total); continue; }
      try {
        var file = null;
        try { file = await gasCall('fileGet', { file_id: doc.file_id }, state.token); } catch (e) { /* fallback metadata/link */ }
        if (file && file.data) {
          var blob = blobFromBase64(file.data, file.mime || doc.mime);
          var upload = new File([blob], file.nama || doc.nama_file || 'berkas', { type: file.mime || doc.mime || 'application/octet-stream' });
          await Unggah.kirim(upload, {
            paket_id: doc.paket_id, kode: doc.kode, sub: doc.sub || '',
            nama_file: doc.nama_file || file.nama, mime: file.mime || doc.mime,
            size: Number(file.size || doc.size || upload.size), keterangan: doc.keterangan || '',
            legacy_id: String(doc.id), legacy_file_id: doc.file_id || ''
          });
          moved++;
        } else {
          await API.call('importDocLink', { legacy_id: String(doc.id), doc: doc }, { jsonp: false });
          linked++;
        }
      } catch (e) {
        failed++; log('Berkas ' + (doc.nama_file || doc.id) + ' gagal: ' + e.message, 'bad');
        try { await API.call('importDocLink', { legacy_id: String(doc.id), doc: doc }, { jsonp: false }); linked++; } catch (ignored) { }
      }
      done++; setProgress(done, total, 'Memindahkan berkas ' + done + ' / ' + total);
    }

    var providers = (master.penyedia || []).filter(function (p) { return p.cp_file_id; });
    for (var j = 0; j < providers.length; j++) {
      var provider = providers[j];
      if (storedProviders.has(String(provider.id))) { done++; setProgress(done, total, 'Berkas ' + done + ' / ' + total); continue; }
      try {
        var cp = null;
        try { cp = await gasCall('fileGet', { file_id: provider.cp_file_id }, state.token); } catch (e) { /* metadata fallback */ }
        if (cp && cp.data) {
          var cpBlob = blobFromBase64(cp.data, cp.mime || 'application/octet-stream');
          var cpFile = new File([cpBlob], cp.nama || ('CompanyProfile-' + provider.nama), { type: cp.mime || 'application/octet-stream' });
          await Unggah.kirim(cpFile, {
            penyedia_id: provider.id, nama_file: cp.nama || cpFile.name,
            mime: cp.mime || cpBlob.type, size: Number(cp.size || cpFile.size),
            legacy_file_id: provider.cp_file_id
          });
          moved++;
        } else {
          await API.call('importProviderLink', { id: provider.id, legacy_file_id: provider.cp_file_id, url: provider.cp_url || '' }, { jsonp: false });
          linked++;
        }
      } catch (e) {
        failed++; log('Company profile ' + provider.nama + ' gagal: ' + e.message, 'bad');
        try { await API.call('importProviderLink', { id: provider.id, legacy_file_id: provider.cp_file_id, url: provider.cp_url || '' }, { jsonp: false }); linked++; } catch (ignored) { }
      }
      done++; setProgress(done, total, 'Memindahkan berkas ' + done + ' / ' + total);
    }
    return { total: total, moved: moved, linked: linked, failed: failed };
  }

  async function runMigration() {
    var master = state.master;
    var details = state.details.slice();
    if (!state.ready || !master || typeof master !== 'object' || Array.isArray(master)) {
      throw new Error('Data master sumber belum tersedia. Klik "Hubungkan & baca data" dan tunggu sampai pratinjau data tampil sebelum memulai migrasi.');
    }
    if (!state.token) throw new Error('Sesi sumber SIPADU lama sudah tidak aktif. Hubungkan kembali sebelum memulai migrasi.');
    var userMap = getUserMap();
    if (state.sourceUsers.length && !userMap.some(function (x) { return state.sourceUsers.some(function (u) { return String(u.id) === x.legacy_id && u.role === 'admin'; }); })) {
      throw new Error('Hubungkan setidaknya akun Admin SIPADU lama ke akun Admin CONNECT.');
    }
    state.running = true;
    $('#sm-run').disabled = true;
    $('#sm-clear').disabled = true;
    try {
      $('#sm-progress-wrap').classList.remove('d-none');
      setProgress(0, 1, 'Mengimpor data master…');
      await migrateMaster(userMap, master, details);
      setProgress(0, 1, 'Memindahkan berkas…');
      var files = await migrateDocuments(master, details);
      setProgress(1, 1, 'Migrasi selesai.');
      log('Selesai. Berkas dipindahkan ke Supabase Storage: ' + files.moved + ', metadata/link lama: ' + files.linked + ', gagal total: ' + files.failed + '.', files.failed ? 'bad' : 'ok');
      log('Migrasi dapat dijalankan ulang. ID lama dipertahankan dan data yang sudah tersalin tidak digandakan.', 'ok');
      if (files.linked) log('Sebagian berkas tetap berupa tautan lama karena endpoint fileGet/Google Drive tidak dapat membacanya. Periksa URL pada riwayat dokumen.', 'info');
    } finally {
      state.running = false;
      $('#sm-run').disabled = !state.ready;
      $('#sm-clear').disabled = false;
    }
  }

  function page(host) {
    App.setJudul('Migrasi Data BARJAS', 'Pindahkan data lama ke database dan penyimpanan Supabase');
    if (!Auth.isAdmin()) {
      host.innerHTML = '<div class="kartu"><p class="tegas">Khusus Admin</p><p class="mini">Hanya Admin CONNECT yang dapat menjalankan migrasi data.</p></div>';
      return;
    }
    host.innerHTML = '<div class="kartu mb-3"><header><h2>Sumber data lama</h2></header><div class="badan">' +
      '<p class="mini">Masukkan URL Web App SIPADU lama dan akun Admin lama. Password hanya dipakai untuk membaca data saat sesi ini, tidak disimpan ke database maupun browser.</p>' +
      '<div class="rapi"><label class="field"><span class="lbl">URL Web App Apps Script (akhiri dengan /exec)</span><input class="inp" id="sm-url" type="url" placeholder="https://script.google.com/macros/s/.../exec"></label>' +
      '<div class="baris"><label class="field" style="flex:1"><span class="lbl">Username Admin lama</span><input class="inp" id="sm-username" autocomplete="username"></label>' +
      '<label class="field" style="flex:1"><span class="lbl">Password Admin lama</span><input class="inp" id="sm-password" type="password" autocomplete="current-password"></label></div>' +
      '<button class="btn primary" id="sm-connect" type="button">Hubungkan & baca data</button></div></div></div>' +
      '<div class="kartu mb-3 d-none" id="sm-result"><header><h2>Pratinjau data yang ditemukan</h2></header><div class="badan">' +
      '<div class="row g-2 mb-3" id="sm-stats"></div><h3 class="h6 mt-3">Pemetaan akun pengguna</h3>' +
      '<p class="mini">Akun lama tidak disalin bersama hash password-nya. Buat akun Pengelola Pengadaan di menu Manajemen Pengguna lebih dulu, lalu hubungkan setiap akun lama ke akun Supabase yang sesuai. Penugasan yang tidak dipetakan akan diimpor tanpa penanggung jawab.</p>' +
      '<div id="sm-users" class="mb-3"></div><div class="d-flex flex-wrap gap-2"><button class="btn primary" id="sm-run" type="button">Mulai migrasi data</button>' +
      '<button class="btn" id="sm-clear" type="button">Bersihkan sesi lama</button></div>' +
      '<div id="sm-progress-wrap" class="mt-3 d-none"><div class="d-flex justify-content-between small mb-1"><span>Progres</span><span id="sm-progress-text"></span></div><div class="meter"><i id="sm-progress" style="width:0%"></i></div></div>' +
      '<div class="border rounded p-3 mt-3" style="max-height:260px;overflow:auto" id="sm-log" aria-live="polite"></div></div></div>' +
      '<div class="kartu"><div class="badan"><h3 class="h6">Catatan migrasi</h3><ul class="mini mb-0">' +
      '<li>Master satuan kerja, pejabat, penyedia, konfigurasi, penugasan, paket, HPS, dan Monev dipindahkan ke tabel Supabase BARJAS.</li>' +
      '<li>Dokumen diunduh dari Google Drive lama lalu diunggah ke bucket privat <code>barjas-files</code>. Jika sumber tidak bisa dibaca, metadata dan URL lamanya tetap disimpan sebagai rujukan.</li>' +
      '<li>Jalankan migrasi ulang untuk melanjutkan. Data menggunakan ID lama sebagai kunci sehingga proses bersifat idempoten.</li>' +
      '<li>Jangan hapus Spreadsheet, Apps Script, atau folder Drive lama sampai jumlah data dan sampel dokumen sudah diverifikasi.</li>' +
      '</ul></div></div>';

    $('#sm-connect').onclick = function () {
      $('#sm-log').innerHTML = '';
      connectOld().catch(function (e) { log(e.message, 'bad'); });
    };
    $('#sm-run').onclick = function () {
      if (!confirm('Jalankan migrasi data BARJAS ke Supabase? Data lama tidak akan dihapus.')) return;
      runMigration().catch(function (e) { log('Migrasi berhenti: ' + e.message, 'bad'); });
    };
    $('#sm-clear').onclick = function () {
      if (state.running) return;
      state.ready = false;
      state.token = ''; state.master = null; state.details = []; state.sourceUsers = [];
      $('#sm-run').disabled = true;
      $('#sm-result').classList.add('d-none'); $('#sm-password').value = '';
      log('Sesi sumber dihapus dari halaman ini.', 'ok');
    };
  }

  w.BarjasMigrasi = { page: page };
})(window);
