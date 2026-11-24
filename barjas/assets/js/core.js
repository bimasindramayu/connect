/* BARJAS - inti: DOM, transport, cache, sesi, router, komponen UI.
   Tanpa framework, tanpa dependensi luar. */
(function (w) {
  'use strict';
  var C = w.CONFIG;

  /* ---------- DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, kids) {
    var parts = tag.split(/([.#])/), node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i += 2) {
      if (parts[i] === '.') node.classList.add(parts[i + 1]);
      else node.id = parts[i + 1];
    }
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') { for (var d in v) node.dataset[d] = v[d]; }
      else node.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- format ---------- */
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  var Fmt = {
    num: function (n, dec) {
      n = Number(n) || 0;
      return n.toLocaleString('id-ID', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec });
    },
    rp: function (n) { return 'Rp ' + Fmt.num(Math.round(Number(n) || 0), 0); },
    rpShort: function (n) {
      n = Number(n) || 0;
      if (n >= 1e9) return 'Rp ' + Fmt.num(n / 1e9, 2) + ' M';
      if (n >= 1e6) return 'Rp ' + Fmt.num(n / 1e6, 1) + ' jt';
      return Fmt.rp(n);
    },
    parseNum: function (s) {
      if (typeof s === 'number') return s;
      if (!s && s !== 0) return 0;
      s = String(s).replace(/[^\d,.\-]/g, '');
      if (!s || s === '-' || s === '.' || s === ',') return 0;
      var hasKoma = s.indexOf(',') > -1, hasTitik = s.indexOf('.') > -1;
      if (hasKoma && hasTitik) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) { s = s.replace(/\./g, '').replace(/,/g, '.'); }
        else { s = s.replace(/,/g, ''); }
        var ps = s.split('.');
        if (ps.length > 2) s = ps.slice(0, -1).join('') + '.' + ps[ps.length - 1];
      } else if (hasKoma) {
        if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else {
          s = s.replace(/,/g, '.');
          var ks = s.split('.');
          if (ks.length > 2) s = ks.slice(0, -1).join('') + '.' + ks[ks.length - 1];
        }
      } else if (hasTitik) {
        var nTitik = (s.match(/\./g) || []).length;
        if (nTitik > 1) { s = s.replace(/\./g, ''); }
        else if (/^-?\d{1,3}\.\d{3}$/.test(s)) { s = s.replace(/\./g, ''); }
        else {
          var bel = (s.split('.')[1] || '');
          if (bel.length >= 3) s = s.replace(/\./g, '');
        }
      }
      var n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    },
    tanggal: function (v) {
      var d = Fmt.toDate(v); if (!d) return '-';
      return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    },
    tanggalHari: function (v) {
      var d = Fmt.toDate(v); if (!d) return '-';
      return HARI[d.getDay()] + ', ' + Fmt.tanggal(d);
    },
    iso: function (v) {
      var d = Fmt.toDate(v); if (!d) return '';
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    tglAngka: function (v) {
      var d = Fmt.toDate(v); if (!d) return '';
      return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear();
    },
    toDate: function (v) {
      if (!v) return null;
      if (v instanceof Date) return isNaN(v) ? null : v;
      var d = new Date(v);
      return isNaN(d) ? null : d;
    },
    bytes: function (n) {
      n = Number(n) || 0;
      if (n > 1048576) return Fmt.num(n / 1048576, 1) + ' MB';
      if (n > 1024) return Fmt.num(n / 1024, 0) + ' KB';
      return n + ' B';
    },
    terbilang: function (n) {
      n = Math.floor(Math.abs(Number(n) || 0));
      var satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
      function rec(x) {
        if (x < 12) return satuan[x];
        if (x < 20) return rec(x - 10) + ' belas';
        if (x < 100) return rec(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + rec(x % 10) : '');
        if (x < 200) return 'seratus' + (x % 100 ? ' ' + rec(x % 100) : '');
        if (x < 1000) return rec(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + rec(x % 100) : '');
        if (x < 2000) return 'seribu' + (x % 1000 ? ' ' + rec(x % 1000) : '');
        if (x < 1e6) return rec(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + rec(x % 1000) : '');
        if (x < 1e9) return rec(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + rec(x % 1e6) : '');
        if (x < 1e12) return rec(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + rec(x % 1e9) : '');
        return rec(Math.floor(x / 1e12)) + ' triliun' + (x % 1e12 ? ' ' + rec(x % 1e12) : '');
      }
      if (n === 0) return 'nol';
      return rec(n).replace(/\s+/g, ' ').trim();
    },
    kapital: function (s) {
      return String(s || '').replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    },
    hariText: function (v) { var d = Fmt.toDate(v); return d ? HARI[d.getDay()] : ''; },
    bulanText: function (i) { return BULAN[i]; }
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- transport ----------
     Apps Script tidak menangani preflight OPTIONS. Karena itu permintaan
     dikirim sebagai "simple request": POST + Content-Type text/plain.
     Bila fetch gagal (jaringan menyaring POST lintas domain), aksi baca
     otomatis dicoba ulang lewat JSONP yang tidak pernah kena CORS. */
  var API = {
    url: function () { return C.EDGE_URL; },
    setUrl: function () {},
    busy: 0,
    _bar: null,
    _tick: function (delta) {
      API.busy = Math.max(0, API.busy + delta);
      if (!API._bar) API._bar = $('#bar');
      if (API._bar) API._bar.classList.toggle('on', API.busy > 0);
    },
    call: function (action, data, opt) {
      opt = opt || {};
      API._tick(1);
      return BARJAS_SB.auth.getSession().then(function (r) {
        var session = r && r.data && r.data.session;
        if (!session) { var e = new Error('Sesi CONNECT berakhir. Silakan masuk kembali.'); e.code = 'AUTH'; throw e; }
        return fetch(C.EDGE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': C.SUPABASE_KEY,
            'Authorization': 'Bearer ' + session.access_token
          },
          body: JSON.stringify({ action: action, data: data || {} })
        });
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || payload.ok !== true) {
            var error = new Error(payload && payload.error ? payload.error : 'Permintaan BARJAS ditolak.');
            error.code = payload && payload.code ? payload.code : (response.status === 401 ? 'AUTH' : 'ERROR');
            throw error;
          }
          return payload.data;
        });
      }).then(function (result) {
        API._tick(-1); return result;
      }).catch(function (error) {
        API._tick(-1);
        if (error && error.code === 'AUTH') Auth.expire();
        throw error;
      });
    },
    upload: function (file, meta, onProg) {
      meta = meta || {};
      if (file.size > C.MAX_UPLOAD_MB * 1048576)
        return Promise.reject(new Error('Ukuran berkas melebihi ' + C.MAX_UPLOAD_MB + ' MB.'));
      var name = String(file.name || meta.nama_file || 'berkas').replace(/[\\/:*?"<>|]/g, '_').slice(0, 160);
      var folder = meta.penyedia_id ? 'penyedia/' + meta.penyedia_id : String(meta.paket_id || '');
      if (!folder) return Promise.reject(new Error('Paket atau penyedia berkas tidak ditentukan.'));
      var path = folder + '/' + crypto.randomUUID() + '-' + name;
      if (onProg) onProg(0.15);
      return BARJAS_SB.storage.from('barjas-files').upload(path, file, {
        upsert: false, contentType: file.type || meta.mime || 'application/octet-stream'
      }).then(function (upload) {
        if (upload.error) throw new Error(upload.error.message);
        if (onProg) onProg(0.75);
        var info = Object.assign({}, meta, {
          nama_file: meta.nama_file || name,
          mime: file.type || meta.mime || 'application/octet-stream',
          size: file.size
        });
        return API.call('registerFile', { path: path, meta: info }, { jsonp: false }).then(function (row) {
          if (onProg) onProg(1);
          return row;
        }).catch(function (error) {
          BARJAS_SB.storage.from('barjas-files').remove([path]).catch(function () {});
          throw error;
        });
      });
    },
    jsonp: function () { return Promise.reject(new Error('JSONP tidak digunakan pada backend Supabase.')); }
  };
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- cache lokal ---------- */
  /* Namespace versi baru agar cache kosong/lama sebelum migrasi tidak menutupi data Supabase. */
  var CACHE_PREFIX = 'barjas.cache.v2.';
  var Store = {
    get: function (key, maxAge) {
      try {
        var raw = sessionStorage.getItem(CACHE_PREFIX + key); if (!raw) return null;
        var o = JSON.parse(raw);
        if (maxAge && Date.now() - o.t > maxAge) return null;
        return o.v;
      } catch (e) { return null; }
    },
    set: function (key, val) {
      try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: val })); } catch (e) { }
      return val;
    },
    drop: function (key) { sessionStorage.removeItem(CACHE_PREFIX + key); },
    dropAll: function () {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('barjas.') === 0) sessionStorage.removeItem(k); });
    },
    /* baca cache dulu, perbarui di belakang layar */
    swr: function (key, loader, onFresh) {
      var cached = Store.get(key, C.CACHE_TTL);
      var p = loader().then(function (v) { Store.set(key, v); if (cached && onFresh) onFresh(v); return v; });
      return cached ? Promise.resolve(cached) : p;
    }
  };

  /* ---------- sesi ---------- */
  var Auth = {
    session: null,
    load: function () {
      if (Auth.session) return Auth.session;
      try { Auth.session = JSON.parse(localStorage.getItem(C.SESSION_KEY) || 'null'); }
      catch (e) { Auth.session = null; }
      return Auth.session;
    },
    save: function (s) { Auth.session = s; localStorage.setItem(C.SESSION_KEY, JSON.stringify(s)); },
    token: function () { var s = Auth.load(); return s ? s.token : ''; },
    user: function () { var s = Auth.load(); return s ? s.user : null; },
    isAdmin: function () { var u = Auth.user(); return !!u && u.role === 'admin'; },
    clear: function () { Auth.session = null; localStorage.removeItem(C.SESSION_KEY); Store.dropAll(); },
    expire: function () {
      Auth.clear();
      location.href = '../index.html?s=habis';
    },
    guard: function () {
      var s = Auth.load();
      if (!s || !s.token || (s.exp && Date.now() > s.exp)) { Auth.expire(); return false; }
      return true;
    }
  };

  /* ---------- komponen UI ---------- */
  async function openViewer(files, idx, load) {
    const V_GAP = 8, V_ZOOM = 10, V_MAXPX = 16e6, V_MAXSIDE = 8192;
    const d = $('#vdlg'), btn = (k, label, title) => `<button type="button" class="vw-btn" data-v="${k}" aria-label="${title}" title="${title}">${label}</button>`;
    d.className = 'wide';
    d.innerHTML = `<div class="vw-shell">
      <header class="vw-head">
        ${files.length > 1
          ? `<select id="vwf" class="vw-select">${files.map((f, i) => `<option value="${i}"${i === idx ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>`
          : `<div class="vw-title" title="${esc(files[idx].name)}">${esc(files[idx].name)}</div>`}
        <span id="vwg" class="vw-page" aria-live="polite"></span>
        <div class="vw-controls">
          ${btn('out', '−', 'Perkecil')}${btn('in', '+', 'Perbesar')}${btn('fit', 'Pas layar', 'Pas layar')}${btn('ccw', '↶', 'Putar kiri')}${btn('cw', '↻', 'Putar kanan')}
        </div>
        <button type="button" class="vw-close" id="vwx">Tutup</button>
      </header>
      <div class="vw-stage-wrap">
        <div id="vwp">
          <div id="vws"><div id="vwi"></div></div>
          <div id="vwm" role="status" aria-live="polite"></div>
        </div>
      </div>
      <footer class="vw-hint">Geser dengan klik-tahan atau scroll. Ctrl + scroll, pinch, atau dua kali klik untuk zoom.</footer>
    </div>`;
    d.showModal();
    const vp = $('#vwp'), st = $('#vws'), inn = $('#vwi'), P = new Map();
    // Ruang dokumen: lebar halaman = W. Tiap halaman punya "kotak" (ukuran asli W x h, diputar dengan transform) di dalam "slot" (ukuran
    // halaman SETELAH diputar, ditaruh di tumpukan). hl[k] = { h, doc (halaman pdf.js, null untuk gambar), slot, box, sc (satuan dokumen per titik PDF),
    // l, t, w, hh (letak dan ukuran slot), tile (kanvas tajam yang sudah jadi), task dan pend (render tajam yang sedang jalan dan cakupannya) }.
    // s, x, y = zoom dan posisi panggung (#vws) di layar: titik panggung (a, b) tampil di (x + a * s, y + b * s).
    let W = 0, SW = 0, SH = 0, LW = 0, LH = 0, NW = 0, rot = 0, s = 1, x = 0, y = 0, gen = 0, pdf = null, url = null, io = null, cur = -1, tm = 0, hl = [];
    // titik di slot (sudah diputar) <-> titik di kotak halaman (ukuran asli); h = tinggi asli halaman
    const toBox = (p, q, h) => [[p, q], [q, h - p], [W - p, h - q], [W - q, p]][rot / 90];
    const toSlot = (u, v, h) => [[u, v], [h - v, u], [W - u, h - v], [v, W - u]][rot / 90];
    const layout = () => {   // susun ulang halaman ke bawah menurut rotasi sekarang (halaman lebih sempit dari tumpukan ditaruh di tengah)
      const sw = rot % 180;
      SW = hl.reduce((m, p) => Math.max(m, sw ? p.h : W), 0);
      let t = 0;
      hl.forEach(p => {
        p.w = sw ? p.h : W; p.hh = sw ? W : p.h; p.l = (SW - p.w) / 2; p.t = t; t += p.hh + V_GAP;
        Object.assign(p.slot.style, { left: p.l + 'px', top: p.t + 'px', width: p.w + 'px', height: p.hh + 'px' });
        p.box.style.transform = ['', `translate(${p.h}px,0) rotate(90deg)`, `translate(${W}px,${p.h}px) rotate(180deg)`, `translate(0,${W}px) rotate(270deg)`][rot / 90];
      });
      SH = Math.max(0, t - V_GAP);
      inn.style.width = SW + 'px'; inn.style.height = SH + 'px';
    };
    // Batas zoom TIDAK bergantung pada rotasi (dulu dihitung dari tumpukan yang sedang diputar, jadi batas atasnya runtuh setelah PDF
    // banyak halaman diputar). LW/LH = ukuran tumpukan terbesar di rotasi mana pun. Batas atas = V_ZOOM kali "pas lebar", dan untuk gambar
    // paling sedikit 3 piksel layar per piksel asli (foto dokumen beresolusi tinggi bisa diperbesar sampai hurufnya terbaca).
    const lim = () => {
      const vw = vp.clientWidth, vh = vp.clientHeight;
      return [Math.max(0.9 * Math.min(vw / LW, vh / LH), 0.15 * vw / LW), Math.max(V_ZOOM * vw / W, 3 * NW / W)];
    };
    const pageInd = () => {   // halaman yang paling banyak terlihat; halaman selalu tersusun ke bawah, jadi cukup dihitung di sumbu tegak
      const el = $('#vwg');
      if (!el) return;
      if (!pdf || !W) { el.classList.add('d-none'); cur = -1; return; }
      const a = -y / s, b = (vp.clientHeight - y) / s;
      let best = 0, bo = -Infinity;
      hl.forEach((p, k) => { const o = Math.min(b, p.t + p.hh) - Math.max(a, p.t); if (o > bo) { bo = o; best = k; } });
      if (best !== cur || el.classList.contains('d-none')) { cur = best; el.textContent = `Halaman ${best + 1} dari ${hl.length}`; el.classList.remove('d-none'); }
    };
    const apply = () => {   // jepit zoom dan posisi: dokumen selalu terlihat (kecil = di tengah, besar = tepi tak keluar layar)
      const vw = vp.clientWidth, vh = vp.clientHeight;
      if (!W || !vw || !vh) return;
      const [lo, hi] = lim();
      s = Math.min(hi, Math.max(lo, s));
      x = SW * s <= vw ? (vw - SW * s) / 2 : Math.min(0, Math.max(vw - SW * s, x));
      y = SH * s <= vh ? (vh - SH * s) / 2 : Math.min(0, Math.max(vh - SH * s, y));
      st.style.width = SW + 'px'; st.style.height = SH + 'px';
      st.style.transform = `translate(${x}px,${y}px) scale(${s})`;
      pageInd();
      clearTimeout(tm); tm = setTimeout(sharp, 150);   // kanvas tajam digambar setelah zoom/geser berhenti
    };
    const anchor = () => {   // titik di tengah layar: halaman terdekat dan letaknya di kotak halaman (tak diputar), agar bisa dikembalikan setelah tata letak berubah
      const a = (vp.clientWidth / 2 - x) / s, b = (vp.clientHeight / 2 - y) / s;
      let k = 0, best = Infinity;
      hl.forEach((p, i) => { const g = Math.max(p.t - b, b - p.t - p.hh, 0); if (g < best) { best = g; k = i; } });
      const p = hl[k], [u, v] = toBox(a - p.l, Math.min(p.hh, Math.max(0, b - p.t)), p.h);
      return { k, u, v };
    };
    const turn = by => {   // putar: zoom tetap, halaman dan titik yang tadi di tengah layar tetap di tengah layar
      const an = anchor(), p = hl[an.k];
      rot = (rot + by) % 360; layout();
      const [a, b] = toSlot(an.u, an.v, p.h);
      x = vp.clientWidth / 2 - (p.l + a) * s; y = vp.clientHeight / 2 - (p.t + b) * s;
      apply();
    };
    const fit = k => {   // pas lebar, bagian atas halaman k di atas layar (tanpa k: halaman yang sedang dilihat)
      if (!W) return;
      if (k == null) k = anchor().k;
      s = vp.clientWidth / SW; x = 0; y = -hl[k].t * s; apply();
    };
    const zoomAt = (cx, cy, k) => {
      if (!W) return;
      const n = Math.min(lim()[1], Math.max(lim()[0], s * k)), f = n / s;
      x = cx - (cx - x) * f; y = cy - (cy - y) * f; s = n;
    };
    d.onclick = e => {
      if (e.target === d) { d.close(); return; }
      const b = e.target.closest('[data-v]'); if (!b) return;
      if (!W) return;
      const k = b.dataset.v, c = [vp.clientWidth / 2, vp.clientHeight / 2];
      if (k === 'fit') return fit();
      if (k === 'cw' || k === 'ccw') return turn(k === 'cw' ? 90 : 270);
      zoomAt(c[0], c[1], k === 'in' ? 1.4 : 1 / 1.4); apply();
    };
    vp.onpointerdown = e => { vp.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); };
    vp.onpointermove = e => {
      if (!P.has(e.pointerId) || !W) return;
      const r = vp.getBoundingClientRect(), a = [...P.values()];
      P.set(e.pointerId, [e.clientX, e.clientY]);
      const b = [...P.values()];
      if (b.length === 1) { x += b[0][0] - a[0][0]; y += b[0][1] - a[0][1]; }
      else {   // dua jari: geser mengikuti titik tengah + zoom mengikuti jarak
        const d0 = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), d1 = Math.hypot(b[0][0] - b[1][0], b[0][1] - b[1][1]);
        const cx = (b[0][0] + b[1][0]) / 2 - r.left, cy = (b[0][1] + b[1][1]) / 2 - r.top;
        x += cx - ((a[0][0] + a[1][0]) / 2 - r.left); y += cy - ((a[0][1] + a[1][1]) / 2 - r.top);
        if (d0 > 0) zoomAt(cx, cy, d1 / d0);
      }
      apply();
    };
    vp.onpointerup = vp.onpointercancel = e => P.delete(e.pointerId);
    vp.addEventListener('wheel', e => {   // scroll = geser; Ctrl+scroll dan pinch trackpad (Chrome/Firefox/Edge) = zoom
      e.preventDefault();
      const r = vp.getBoundingClientRect(), u = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * u * 0.01));
      else { x -= e.deltaX * u; y -= e.deltaY * u; }
      apply();
    }, { passive: false });
    let g0 = 1;   // pinch trackpad Safari
    vp.addEventListener('gesturestart', e => { e.preventDefault(); g0 = s; });
    vp.addEventListener('gesturechange', e => {
      e.preventDefault();
      if (P.size < 2) { const r = vp.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, g0 * e.scale / s); apply(); }
    });
    vp.ondblclick = e => {
      const r = vp.getBoundingClientRect(), base = vp.clientWidth / (SW || 1);
      if (s > base * 1.2) fit(); else { zoomAt(e.clientX - r.left, e.clientY - r.top, base * 2.5 / s); apply(); }
    };
    const ro = new ResizeObserver(apply); ro.observe(vp);
  
    // ---- PDF: render dasar (sekali, saat halaman mendekati layar) dan kanvas tajam (bagian yang tampak, sesuai zoom) ----
    const paint = async p => {
      const v = p.doc.getViewport({ scale: p.sc * Math.min(window.devicePixelRatio || 1, 1.5) }), c = document.createElement('canvas');
      c.width = v.width; c.height = v.height; c.style.cssText = 'width:100%;height:100%;display:block';
      p.box.append(c);
      await p.doc.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
    };
    // irisan persegi di ruang panggung (a0, b0, a1, b1) dengan slot halaman p, sebagai [u0, v0, u1, v1] di kotak halaman; null bila kosong
    const cut = (p, a0, b0, a1, b1) => {
      const p0 = Math.max(a0, p.l) - p.l, p1 = Math.min(a1, p.l + p.w) - p.l, q0 = Math.max(b0, p.t) - p.t, q1 = Math.min(b1, p.t + p.hh) - p.t;
      if (p1 <= p0 || q1 <= q0) return null;
      const [ua, va] = toBox(p0, q0, p.h), [ub, vb] = toBox(p1, q1, p.h);
      return [Math.min(ua, ub), Math.min(va, vb), Math.max(ua, ub), Math.max(va, vb)];
    };
    const drop = p => {   // buang kanvas tajam halaman (di luar layar, atau render dasar sudah cukup tajam)
      if (p.task) { p.task.cancel(); p.task = p.pend = null; }
      if (p.tile) { p.tile.c.width = p.tile.c.height = 0; p.tile.c.remove(); p.tile = null; }
    };
    const sharp = () => {
      if (!pdf || !W) return;
      const my = gen, vw = vp.clientWidth, vh = vp.clientHeight, dpr = window.devicePixelRatio || 1, m = s * dpr;   // m = piksel layar per satuan ruang dokumen
      const a0 = -x / s, b0 = -y / s, a1 = (vw - x) / s, b1 = (vh - y) / s, ma = vw * 0.3 / s, mb = vh * 0.3 / s;
      hl.forEach(p => {
        try {   // satu halaman gagal (mis. kanvas ditolak peramban karena memori) tidak boleh menghentikan halaman lain
          const vis = m > Math.min(dpr, 1.5) * 1.1 ? cut(p, a0, b0, a1, b1) : null;   // render dasar memakai min(dpr, 1,5) piksel per satuan
          if (!vis) return drop(p);
          const cukup = t => t && t.want >= m * 0.9 && t.u0 <= vis[0] + 1 && t.v0 <= vis[1] + 1 && t.u1 >= vis[2] - 1 && t.v1 >= vis[3] - 1;   // mencakup bagian yang tampak, dengan kerapatan memadai
          if (cukup(p.pend)) return;   // render yang sedang berjalan sudah mencukupi
          if (p.task) { p.task.cancel(); p.task = p.pend = null; }   // render usang: tampilan sudah berubah
          if (cukup(p.tile)) return;   // kanvas tajam yang ada masih mencukupi
          let k = m, r = cut(p, a0 - ma, b0 - mb, a1 + ma, b1 + mb);   // bagian yang tampak ditambah margin 30% agar geser pendek tak perlu menggambar ulang
          const px = () => (r[2] - r[0]) * (r[3] - r[1]) * k * k;
          if (px() > V_MAXPX) r = vis;
          if (px() > V_MAXPX) k *= Math.sqrt(V_MAXPX / px());
          k = Math.min(k, V_MAXSIDE / (r[2] - r[0]), V_MAXSIDE / (r[3] - r[1]));
          const u0 = Math.floor(r[0]), v0 = Math.floor(r[1]), c = document.createElement('canvas');
          c.width = Math.ceil((r[2] - u0) * k); c.height = Math.ceil((r[3] - v0) * k);
          p.pend = { u0, v0, u1: u0 + c.width / k, v1: v0 + c.height / k, want: m };
          // transform menggeser hasil render supaya kanvas hanya berisi bagian [u0, v0] ke kanan-bawah (dalam piksel kanvas)
          const task = p.task = p.doc.render({ canvasContext: c.getContext('2d'), viewport: p.doc.getViewport({ scale: p.sc * k }), transform: [1, 0, 0, 1, -u0 * k, -v0 * k] });
          task.promise.then(() => {
            if (my !== gen || p.task !== task) return;   // dokumen sudah diganti/ditutup, atau ada render yang lebih baru
            p.task = p.pend = null;
            c.style.cssText = `position:absolute;z-index:1;left:${u0}px;top:${v0}px;width:${c.width / k}px;height:${c.height / k}px;display:block;pointer-events:none`;
            const lama = p.tile;
            p.box.append(c); p.tile = { c, u0, v0, u1: u0 + c.width / k, v1: v0 + c.height / k, want: m };
            if (lama) { lama.c.width = lama.c.height = 0; lama.c.remove(); }
          }, () => { if (p.task === task) p.task = p.pend = null; /* dibatalkan (render lebih baru/ditutup): p.task sudah diganti; galat sungguhan: boleh dicoba lagi */ });
        } catch { p.task = p.pend = null; }
      });
    };
  
    const clean = () => {
      clearTimeout(tm); hl.forEach(drop);
      if (io) io.disconnect(); if (pdf) pdf.destroy(); if (url) URL.revokeObjectURL(url);
      io = pdf = url = null; inn.replaceChildren(); W = SW = SH = LW = LH = NW = 0; rot = 0; hl = []; pageInd();
    };
    const show = async i => {
      const my = ++gen; clean(); $('#vwm').textContent = 'Memuat dokumen…';
      try {
        const blob = await (await load(files[i])).blob();
        if (my !== gen) return;
        const cw = Math.min(vp.clientWidth, 1100);
        const add = (h, doc) => {   // halaman baru di tumpukan; mengembalikan kotaknya
          const slot = document.createElement('div'), box = document.createElement('div');
          slot.style.position = 'absolute';
          box.dataset.n = hl.length; box.style.cssText = `position:absolute;left:0;top:0;width:${cw}px;height:${h}px;transform-origin:0 0;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)`;
          slot.append(box); inn.append(slot);
          hl.push({ h, doc, slot, box, sc: doc ? cw / doc.getViewport({ scale: 1 }).width : 1, tile: null, pend: null, task: null });
          return box;
        };
        const mime = String(blob.type || files[i].mimeType || '').toLowerCase();
        const isPdf = mime.includes('pdf') || /\.pdf$/i.test(files[i].name || '');
        const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(files[i].name || '');
        if (isPdf) {
          if (!w.pdfjsLib) throw new Error('Pustaka PDF belum termuat. Muat ulang halaman BARJAS.');
          if (!w.pdfjsLib.GlobalWorkerOptions.workerSrc) w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/js/lib/pdf.worker.min.js';
          const doc = await w.pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
          if (my !== gen) return doc.destroy();
          pdf = doc;
          const pgs = [];
          for (let n = 1; n <= doc.numPages; n++) pgs.push(await doc.getPage(n));
          io = new IntersectionObserver(es => es.forEach(en => {
            if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = 1; paint(hl[+en.target.dataset.n]).catch(() => { /* ditutup saat digambar */ }); }
          }), { root: vp, rootMargin: '100% 0px' });
          pgs.forEach(pg => { const v1 = pg.getViewport({ scale: 1 }); io.observe(add(Math.round(v1.height * cw / v1.width), pg)); });
        } else if (isImage) {
          url = URL.createObjectURL(blob);
          const img = new Image(); img.src = url; await img.decode();
          if (my !== gen) return;
          img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
          add(Math.round(cw * img.naturalHeight / img.naturalWidth), null).append(img);
          NW = img.naturalWidth;
        } else {
          throw new Error('Jenis berkas ini (' + (mime || 'tidak diketahui') + ') belum didukung untuk pratinjau.');
        }
        W = cw;
        LW = hl.reduce((m, p) => Math.max(m, p.h), W);   // tumpukan terlebar (halaman tertinggi diputar 90 derajat)
        LH = Math.max(hl.reduce((m, p) => m + p.h, 0), hl.length * W) + (hl.length - 1) * V_GAP;   // tumpukan tertinggi (tanpa atau dengan diputar)
        layout(); $('#vwm').textContent = ''; fit(0);
      } catch (e) {
        if (my === gen) {
          const msg = $('#vwm');
          clear(msg);
          msg.appendChild(el('div.vw-error', { text: e.message || String(e) }));
          const link = files[i] && files[i].url;
          if (link) msg.appendChild(el('a.vw-open', { href: link, target: '_blank', rel: 'noopener' }, 'Buka berkas di tab baru'));
        }
      }
    };
    if ($('#vwf')) $('#vwf').onchange = () => show(+$('#vwf').value);
    $('#vwx').onclick = () => d.close();
    d.addEventListener('close', function () { gen++; clean(); ro.disconnect(); d.onclick = null; }, { once: true });

    show(idx);
  }

  var UI = {
    toast: function (msg, kind) {
      var box = $('#toast') || document.body.appendChild(el('div#toast'));
      var t = el('div.toast' + (kind ? '.' + kind : ''), { text: msg });
      box.appendChild(t);
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 250); }, kind === 'bad' ? 5200 : 3000);
    },
    err: function (e) { UI.toast(e && e.message ? e.message : String(e), 'bad'); },

    modal: function (opt) {
      var body = typeof opt.body === 'string' ? el('div', { html: opt.body }) : opt.body;
      var foot = el('footer.modal-foot');
      var wrap = el('div.modal-bg', { onclick: function (e) { if (e.target === wrap && opt.dismiss !== false) close(); } }, [
        el('div.modal', { role: 'dialog', 'aria-modal': 'true', class: opt.kelas || null }, [
          el('header.modal-head', null, [
            el('h2', { text: opt.title || '' }),
            el('button.icon', { type: 'button', title: 'Tutup', onclick: close, html: '&times;' })
          ]),
          el('div.modal-body', null, [body]),
          foot
        ])
      ]);
      (opt.actions || [{ label: 'Tutup' }]).forEach(function (a) {
        foot.appendChild(el('button', {
          type: 'button', class: 'btn ' + (a.kind || 'ghost'),
          onclick: function (e) { if (!a.onclick || a.onclick(close, e.currentTarget) !== false) if (a.close !== false) close(); }
        }, a.label));
      });
      function close() { wrap.classList.add('out'); setTimeout(function () { wrap.remove(); }, 160); document.removeEventListener('keydown', key); }
      function key(e) { if (e.key === 'Escape' && opt.dismiss !== false) close(); }
      document.addEventListener('keydown', key);
      document.body.appendChild(wrap);
      var f = wrap.querySelector('input,select,textarea,button.primary'); if (f) f.focus();
      return { close: close, node: wrap };
    },

    confirm: function (msg, onYes, opt) {
      opt = opt || {};
      UI.modal({
        title: opt.title || 'Konfirmasi',
        body: el('p', { text: msg }),
        actions: [
          { label: 'Batal' },
          { label: opt.yes || 'Lanjutkan', kind: opt.kind || 'primary', onclick: function () { onYes(); } }
        ]
      });
    },

    field: function (o) {
      var id = 'f_' + (o.name || Math.random().toString(36).slice(2));
      var input;
      if (o.type === 'combo') return UI.combo(o, id);
      if (o.type === 'select') {
        input = el('select', { id: id, name: o.name, required: o.required });
        (o.options || []).forEach(function (op) {
          input.appendChild(el('option', { value: op.value, selected: String(op.value) === String(o.value) }, op.label));
        });
      } else if (o.type === 'textarea') {
        input = el('textarea', { id: id, name: o.name, rows: o.rows || 3, required: o.required, placeholder: o.placeholder || '' });
        input.value = o.value == null ? '' : o.value;
      } else {
        var t = o.type || 'text';
        /* format ribuan otomatis untuk field nominal (o.format === 'rp') */
        if (o.format === 'rp') t = 'text';
        var at = {
          id: id, name: o.name, type: t, required: o.required,
          placeholder: o.placeholder || '', step: o.step, min: o.min, max: o.max,
          autocomplete: o.autocomplete || 'off', inputmode: o.format === 'rp' ? 'numeric' : (o.inputmode || undefined)
        };
        if (o.attr) for (var a in o.attr) at[a] = o.attr[a];
        input = el('input', at);
        input.value = o.value == null ? '' : (o.format === 'rp' ? Fmt.num(Number(o.value) || 0, 0) : o.value);
        if (o.format === 'rp') {
          (function (input) {
            input.style.textAlign = 'right';
            function sync() { input.dataset.angka = String(Fmt.parseNum(input.value)); }
            sync(); /* penting: isi dataset.angka SEKARANG juga (bukan cuma saat difokus/diketik),
                       supaya UI.formData tetap membaca angka mentah yang benar walau field ini
                       tidak pernah disentuh user sama sekali dalam sesi edit ini — sebelum ini,
                       field 'rp' yang tak tersentuh membuat formData mengirim teks berformat titik
                       ("50.000.000") alih-alih angka, sehingga nilainya salah/hilang saat disimpan. */
            input.addEventListener('input', function () {
              var awal = input.selectionStart, len = input.value.length;
              var baru = Fmt.num(Fmt.parseNum(input.value), 0);
              input.value = baru;
              sync();
              var pos = awal + (baru.length - len);
              try { input.setSelectionRange(pos, pos); } catch (e) { }
            });
            input.addEventListener('focus', sync);
            input.addEventListener('blur', function () {
              sync();
              if (!input.value) input.value = '';
            });
          })(input);
        }
      }
      if (o.readonly) input.setAttribute('readonly', 'readonly');
      if (o.oninput) input.addEventListener('input', o.oninput);
      if (o.onchange) input.addEventListener('change', o.onchange);
      return el('label.field' + (o.wide ? '.wide' : ''), null, [
        el('span.lbl', { text: o.label }),
        input,
        o.hint ? el('small.hint', { text: o.hint }) : null
      ]);
    },
    /* combobox: kotak isian biasa yang boleh diketik bebas + tombol ▾ untuk memilih dari daftar.
       o.options = larik teks (atau {value,label}); daftar selalu menampilkan SEMUA pilihan saat dibuka
       lewat tombol / panah bawah, dan menyaring sesuai ketikan saat mengetik. */
    combo: function (o, id) {
      var opsi = (o.options || []).map(function (x) {
        return typeof x === 'object' ? { value: String(x.value), label: String(x.label != null ? x.label : x.value) } : { value: String(x), label: String(x) };
      });
      var listId = id + '_daftar';
      var input = el('input', {
        id: id, name: o.name, type: 'text', required: o.required, placeholder: o.placeholder || '',
        autocomplete: 'off', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId
      });
      input.value = o.value == null ? '' : o.value;
      if (o.readonly) input.setAttribute('readonly', 'readonly');
      var daftar = el('ul.combo-daftar', { id: listId, role: 'listbox', hidden: true });
      var tombol = el('button.combo-btn', { type: 'button', tabindex: '-1', 'aria-label': 'Tampilkan pilihan', title: 'Pilihan' }, '\u25BE');
      var kotak = el('div.combo', null, [input, tombol, daftar]);
      var aktif = -1, tampil = [], sedangPilih = false;

      function gambar(saring) {
        var q = saring ? input.value.trim().toLowerCase() : '';
        tampil = opsi.filter(function (x) { return !q || x.label.toLowerCase().indexOf(q) >= 0; });
        clear(daftar);
        tampil.forEach(function (x, i) {
          var sama = x.value.toLowerCase() === input.value.trim().toLowerCase();
          daftar.appendChild(el('li', {
            role: 'option', id: listId + '_' + i, 'aria-selected': sama ? 'true' : 'false', class: sama ? 'dipilih' : '',
            onmousedown: function (e) { e.preventDefault(); },                 // jaga fokus tetap di kotak isian
            onclick: function (e) { e.preventDefault(); e.stopPropagation(); pilih(i); }
          }, x.label));
        });
        aktif = -1;
        return tampil.length;
      }
      function buka(saring) {
        if (input.readOnly) return;
        if (!gambar(saring)) { tutup(); return; }
        daftar.hidden = false; kotak.classList.add('buka'); input.setAttribute('aria-expanded', 'true');
        if (UI._comboBuka && UI._comboBuka !== tutup) UI._comboBuka();
        UI._comboBuka = tutup;
      }
      function tutup() {
        daftar.hidden = true; kotak.classList.remove('buka'); input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant'); aktif = -1;
        if (UI._comboBuka === tutup) UI._comboBuka = null;
      }
      function sorot(i) {
        var li = daftar.children;
        if (!li.length) return;
        aktif = (i + li.length) % li.length;
        Array.prototype.forEach.call(li, function (n, k) { n.classList.toggle('sorot', k === aktif); });
        input.setAttribute('aria-activedescendant', li[aktif].id);
        if (li[aktif].scrollIntoView) li[aktif].scrollIntoView({ block: 'nearest' });
      }
      function pilih(i) {
        if (!tampil[i]) return;
        input.value = tampil[i].value;
        tutup();
        sedangPilih = true;                       // event buatan ini tidak boleh membuka ulang daftar
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        sedangPilih = false;
        input.focus();
      }
      input.addEventListener('input', function () { if (!sedangPilih) buka(true); });
      input.addEventListener('keydown', function (e) {
        var terbuka = !daftar.hidden;
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!terbuka) buka(false); sorot(aktif + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (!terbuka) buka(false); sorot(aktif < 0 ? -1 : aktif - 1); }
        else if (e.key === 'Enter' && terbuka && aktif >= 0) { e.preventDefault(); pilih(aktif); }
        else if (e.key === 'Escape' && terbuka) { e.preventDefault(); e.stopPropagation(); tutup(); }
        else if (e.key === 'Tab') tutup();
      });
      tombol.addEventListener('mousedown', function (e) { e.preventDefault(); });
      tombol.addEventListener('click', function () {
        if (!daftar.hidden) { tutup(); return; }
        input.focus(); buka(false);
      });
      if (o.oninput) input.addEventListener('input', o.oninput);
      if (o.onchange) input.addEventListener('change', o.onchange);
      if (!UI._comboGlobal) {
        UI._comboGlobal = true;
        document.addEventListener('mousedown', function (e) {
          if (UI._comboBuka && !(e.target.closest && e.target.closest('.combo.buka'))) UI._comboBuka();
        });
      }
      return el('div.field' + (o.wide ? '.wide' : ''), null, [
        el('label.lbl', { for: id, text: o.label }),
        kotak,
        o.hint ? el('small.hint', { text: o.hint }) : null
      ]);
    },
    val: function (form, name) {
      var n = form.elements[name];
      return n ? (n.type === 'checkbox' ? n.checked : n.value.trim()) : '';
    },
    formData: function (form) {
      var o = {};
      Array.prototype.forEach.call(form.elements, function (n) {
        if (!n.name) return;
        var v = n.type === 'checkbox' ? n.checked : n.value;
        /* field berformat ribuan dikembalikan sebagai angka mentah */
        if (n.dataset && n.dataset.angka != null) v = String(n.value).trim() === '' ? '' : Fmt.parseNum(n.dataset.angka);
        o[n.name] = v;
      });
      return o;
    },

    /* ubah tombol jadi "Menyimpan…" + spinner selama proses; kembalikan fungsi pemulih */
    busy: function (btn, teks) {
      if (!btn) return function () { };
      var asli = btn.textContent, disable = btn.disabled;
      btn.disabled = true;
      btn.classList.add('proses');
      btn.innerHTML = '<span class="spin"></span> ' + esc(teks || 'Menyimpan…');
      return function () { btn.disabled = disable; btn.classList.remove('proses'); btn.textContent = asli; };
    },

    empty: function (judul, pesan, aksi) {
      return el('div.empty', null, [
        el('p.empty-t', { text: judul }),
        el('p.empty-p', { text: pesan }),
        aksi || null
      ]);
    },
    loading: function (t) { return el('div.loading', { text: t || 'Memuat…' }); },
    badge: function (text, kind) { return el('span.badge' + (kind ? '.' + kind : ''), { text: text }); },

    /* pita kelengkapan dokumen: satu segmen per dokumen; yang tidak berlaku untuk paket ini diarsir.
       `paket` harus memuat jenis, metode, dan field bersyarat (mis. ada_pph). */
    pita: function (adaMap, paket) {
      var wrap = el('div.pita', { title: 'Kelengkapan dokumen (' + w.dokJumlah(paket) + ' diperlukan)' });
      C.DOKUMEN.forEach(function (d) {
        var perlu = w.dokPerlu(d, paket);
        var ada = adaMap[d.kode];
        wrap.appendChild(el('i.seg' + (!perlu ? '.na' : ada ? '.ok' : ''), {
          title: w.dokNo(d.kode) + '. ' + w.dokNama(d, paket) + (perlu ? (ada ? ' — ada' : ' — belum') : ' — tidak diperlukan')
        }));
      });
      return wrap;
    },

    /* tabel ringan: render sekali lewat fragment, tanpa re-render per baris */
    table: function (kolom, baris, opt) {
      opt = opt || {};
      var thead = el('thead', null, [el('tr', null, kolom.map(function (k) {
        return el('th' + (k.num ? '.num' : ''), { text: k.label, style: k.w ? 'width:' + k.w : null });
      }))]);
      var tbody = el('tbody'), frag = document.createDocumentFragment();
      baris.forEach(function (row, i) {
        var tr = el('tr', opt.onrow ? { tabindex: '0', class: 'klik', onclick: function () { opt.onrow(row); },
          onkeydown: function (e) { if (e.key === 'Enter') opt.onrow(row); } } : null);
        kolom.forEach(function (k) {
          var v = k.render ? k.render(row, i) : row[k.key];
          tr.appendChild(el('td' + (k.num ? '.num' : ''), typeof v === 'object' && v ? null : { text: v == null ? '' : v },
            typeof v === 'object' && v ? [v] : null));
        });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      return el('div.tabel-wrap', null, [el('table.tabel', null, [thead, tbody])]);
    },

    /* panggung geser/perbesar/putar generik dipakai untuk gambar & halaman pdf.
       simpelnya: sebuah node (img/canvas) dibungkus lalu digeser dengan
       transform CSS -- geser & cubit sentuh, roda mouse/trackpad, dan tombol
       alat di bagian bawah panggung. mengembalikan {ganti, setLabel} supaya
       pemanggil (mis. penampil pdf berhalaman banyak) bisa mengganti isi
       tanpa membangun ulang seluruh kendali. */
    /* panggung geser/perbesar/putar generik dipakai untuk gambar & halaman pdf.
       node (img/canvas) dibungkus lalu digeser dengan transform CSS. dibatasi
       dua arah supaya dokumen TIDAK PERNAH bisa hilang dari layar:
        - saat dibuka, otomatis diskalakan supaya pas seutuhnya di panggung
          (seperti "fit to screen"), dan tak bisa diperkecil melebihi itu;
        - geseran dijepit (jepret()) supaya sebagian dokumen selalu tumpang
          tindih dengan area panggung, seberapa jauh pun diseret/diputar. */
    _panggung: function (stage, node, opts) {
      opts = opts || {};
      clear(stage);
      var skala = 1, rotasi = 0, tx = 0, ty = 0, MIN = 1, MAKS = 6;
      var wrap = el('div.pv-bungkus', null, [node]);
      stage.appendChild(wrap);
      var dasarSkala = 1, asli = { w: 0, h: 0 };

      /* jepit tx/ty supaya bounding-box dokumen (memperhitungkan rotasi)
         selalu bersinggungan dengan panggung, minimal sejumlah "lebih" px */
      function jepret() {
        var r = stage.getBoundingClientRect();
        var w0 = asli.w * dasarSkala * skala, h0 = asli.h * dasarSkala * skala;
        var rad = rotasi * Math.PI / 180;
        var bw = Math.abs(w0 * Math.cos(rad)) + Math.abs(h0 * Math.sin(rad));
        var bh = Math.abs(w0 * Math.sin(rad)) + Math.abs(h0 * Math.cos(rad));
        var lebih = Math.max(0, Math.min(90, bw / 2, bh / 2, r.width / 2, r.height / 2));
        var maxTx = bw <= r.width ? 0 : (r.width / 2 - lebih + bw / 2);
        var maxTy = bh <= r.height ? 0 : (r.height / 2 - lebih + bh / 2);
        tx = Math.max(-maxTx, Math.min(maxTx, tx));
        ty = Math.max(-maxTy, Math.min(maxTy, ty));
      }
      function terap() { wrap.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + rotasi + 'deg) scale(' + skala + ')'; }
      function pas() { skala = 1; rotasi = 0; tx = 0; ty = 0; terap(); }
      /* ukur ulang node aktif & hitung dasarSkala supaya pas di panggung */
      function ukur(w0, h0) {
        asli = { w: w0 || 1, h: h0 || 1 };
        var r = stage.getBoundingClientRect();
        dasarSkala = Math.max(0.02, Math.min((r.width * 0.96) / asli.w, (r.height * 0.96) / asli.h)) || 1;
        node.style.width = Math.round(asli.w * dasarSkala) + 'px';
        node.style.height = Math.round(asli.h * dasarSkala) + 'px';
        node.style.visibility = 'visible';
        skala = 1; rotasi = 0; tx = 0; ty = 0;
        terap();
      }
      function ukurNode() {
        node.style.visibility = 'hidden';
        if (node.tagName === 'CANVAS') { ukur(node.width, node.height); return; }
        if (node.complete && node.naturalWidth) { ukur(node.naturalWidth, node.naturalHeight); return; }
        node.addEventListener('load', function () { ukur(node.naturalWidth, node.naturalHeight); });
        node.addEventListener('error', function () {
          clear(stage).appendChild(UI.empty('Gagal memuat gambar', 'Berkas tidak dapat ditampilkan di sini.'));
        });
      }
      ukurNode();

      /* roda mouse / trackpad: perbesar mengikuti posisi kursor. tak pernah
         bisa memperkecil melewati ukuran "pas ke layar" (MIN = 1). */
      stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        var lama = skala;
        skala = Math.min(MAKS, Math.max(MIN, skala * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        var r = stage.getBoundingClientRect();
        var px = e.clientX - r.left - r.width / 2, py = e.clientY - r.top - r.height / 2;
        tx -= px * (skala / lama - 1); ty -= py * (skala / lama - 1);
        jepret(); terap();
      }, { passive: false });

      /* sentuh: satu jari geser, dua jari cubit-perbesar + putar */
      var awal = null;
      function daftarTitik(e) {
        return Array.prototype.map.call(e.touches || [], function (t) { return { x: t.clientX, y: t.clientY }; });
      }
      wrap.addEventListener('touchstart', function (e) {
        var arr = daftarTitik(e);
        awal = { skala: skala, rotasi: rotasi, tx: tx, ty: ty, titik: arr };
        if (arr.length === 2) {
          awal.jarak = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
          awal.sudut = Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x) * 180 / Math.PI;
          awal.tengah = { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
        }
      }, { passive: true });
      wrap.addEventListener('touchmove', function (e) {
        if (!awal) return;
        e.preventDefault();
        var arr = daftarTitik(e);
        if (arr.length === 1 && awal.titik.length === 1) {
          tx = awal.tx + (arr[0].x - awal.titik[0].x);
          ty = awal.ty + (arr[0].y - awal.titik[0].y);
        } else if (arr.length === 2 && awal.titik.length === 2) {
          var jarak = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
          var sudut = Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x) * 180 / Math.PI;
          skala = Math.min(MAKS, Math.max(MIN, awal.skala * (jarak / (awal.jarak || jarak))));
          rotasi = awal.rotasi + (sudut - awal.sudut);
          tx = awal.tx + ((arr[0].x + arr[1].x) / 2 - awal.tengah.x);
          ty = awal.ty + ((arr[0].y + arr[1].y) / 2 - awal.tengah.y);
        }
        jepret(); terap();
      }, { passive: false });
      function sentuhSelesai(e) {
        var arr = daftarTitik(e);
        if (!arr.length) { awal = null; return; }
        awal = { skala: skala, rotasi: rotasi, tx: tx, ty: ty, titik: arr };
        if (arr.length === 2) {
          awal.jarak = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
          awal.sudut = Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x) * 180 / Math.PI;
          awal.tengah = { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
        }
      }
      wrap.addEventListener('touchend', sentuhSelesai, { passive: true });
      wrap.addEventListener('touchcancel', sentuhSelesai, { passive: true });

      /* seret dengan mouse (klik tahan). listener geser/lepas dipasang di
         document supaya tak putus saat kursor lewat dari area panggung;
         resize dipasang di window untuk menjaga jepitan saat layar berputar.
         keduanya membersihkan diri sendiri begitu panggung ini sudah tak ada
         di halaman (modal ditutup). */
      var seret = null;
      function turun(e) {
        if (e.button !== 0) return;
        seret = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
        wrap.classList.add('menyeret'); e.preventDefault();
      }
      function gerak(e) {
        if (!document.body.contains(wrap)) return lepasSemua();
        if (!seret) return;
        tx = seret.tx + (e.clientX - seret.x); ty = seret.ty + (e.clientY - seret.y);
        jepret(); terap();
      }
      function lepas() { seret = null; wrap.classList.remove('menyeret'); }
      function saatUbahUkuran() {
        if (!document.body.contains(wrap)) return lepasSemua();
        jepret(); terap();
      }
      function lepasSemua() {
        document.removeEventListener('mousemove', gerak);
        document.removeEventListener('mouseup', lepas);
        w.removeEventListener('resize', saatUbahUkuran);
      }
      wrap.addEventListener('mousedown', turun);
      document.addEventListener('mousemove', gerak);
      document.addEventListener('mouseup', lepas);
      w.addEventListener('resize', saatUbahUkuran);

      /* klik ganda: perbesar ke tengah, atau kembalikan bila sudah diperbesar */
      wrap.addEventListener('dblclick', function () {
        if (skala > 1.05) { pas(); } else { skala = Math.min(MAKS, 2.2); jepret(); terap(); }
      });

      var labelHal = el('span.pv-hal', { text: opts.label || '' });
      var alat = el('div.pv-alat', null, [
        el('button', { type: 'button', title: 'Perkecil', onclick: function () { skala = Math.max(MIN, skala / 1.3); jepret(); terap(); }, html: '&minus;' }),
        el('button', { type: 'button', title: 'Perbesar', onclick: function () { skala = Math.min(MAKS, skala * 1.3); jepret(); terap(); }, html: '&#43;' }),
        el('button', { type: 'button', title: 'Putar 90°', onclick: function () { rotasi += 90; jepret(); terap(); }, html: '&#8635;' }),
        el('button', { type: 'button', title: 'Kembalikan tampilan', onclick: pas, html: '&#8962;' }),
        (opts.sebelum || opts.sesudah) ? el('span.pv-pisah') : null,
        opts.sebelum ? el('button', { type: 'button', title: 'Halaman sebelumnya', onclick: opts.sebelum, html: '&#8249;' }) : null,
        (opts.sebelum || opts.sesudah) ? labelHal : null,
        opts.sesudah ? el('button', { type: 'button', title: 'Halaman berikutnya', onclick: opts.sesudah, html: '&#8250;' }) : null
      ]);
      stage.appendChild(alat);

      return {
        ganti: function (node2, labelBaru) {
          clear(wrap); wrap.appendChild(node2); node = node2;
          if (labelBaru != null) labelHal.textContent = labelBaru;
          ukurNode();
        },
        setLabel: function (t) { labelHal.textContent = t; }
      };
    },

    /* pratinjau gambar: img langsung dipasang ke panggung geser/perbesar */
    _penampilGambar: function (stage, dataUrl) {
      var img = el('img', { src: dataUrl, draggable: 'false', alt: '' });
      UI._panggung(stage, img);
    },

    /* pratinjau pdf lewat pdf.js: tiap halaman dirender ke canvas resolusi
       tinggi, lalu diperbesar/diputar lewat transform CSS di panggung yang sama.
       "bytes" boleh ArrayBuffer atau Uint8Array hasil dekode base64. */
    _penampilPdf: function (stage, bytes) {
      if (!w.pdfjsLib) {
        clear(stage).appendChild(UI.empty('Pustaka PDF belum termuat', 'Periksa berkas pustaka di assets/js/lib/ lalu muat ulang halaman.'));
        return;
      }
      w.pdfjsLib.getDocument({ data: bytes }).promise.then(function (dokPdf) {
        var halaman = 1, total = dokPdf.numPages, panggung;
        function render(n) {
          return dokPdf.getPage(n).then(function (pg) {
            var vp = pg.getViewport({ scale: Math.min(3, (w.devicePixelRatio || 1) * 1.8) });
            var kanvas = el('canvas');
            kanvas.width = vp.width; kanvas.height = vp.height;
            return pg.render({ canvasContext: kanvas.getContext('2d'), viewport: vp }).promise.then(function () { return kanvas; });
          });
        }
        render(halaman).then(function (kanvas) {
          panggung = UI._panggung(stage, kanvas, total > 1 ? {
            label: halaman + ' / ' + total,
            sebelum: function () {
              if (halaman <= 1) return;
              halaman--;
              render(halaman).then(function (k) { panggung.ganti(k, halaman + ' / ' + total); });
            },
            sesudah: function () {
              if (halaman >= total) return;
              halaman++;
              render(halaman).then(function (k) { panggung.ganti(k, halaman + ' / ' + total); });
            }
          } : null);
        });
      }).catch(function (e) {
        clear(stage).appendChild(UI.empty('Gagal membuka PDF', e.message || String(e)));
      });
    },

    /* Pratinjau berkas BARJAS: data diambil melalui Edge Function Supabase,
       lalu ditampilkan memakai penampil dokumen bersama BIMASATU. */
    drivePreview: function (file) {
      if (!file) return;
      var fid = file.file_id || file.id;
      if (!fid) return UI.toast('Berkas tidak memiliki ID.', 'bad');
      var nama = file.nama_file || file.nama || 'berkas';
      var ekstensi = String(nama).toLowerCase().split('.').pop();
      var mimeEkstensi = ({
        pdf: 'application/pdf',
        jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg',
        png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
      })[ekstensi] || '';
      var item = { name: nama, mimeType: file.mime || mimeEkstensi || 'application/octet-stream', url: file.url || '' };

      var load = async function () {
        var r = await API.call('fileGet', { file_id: fid }, { jsonp: false });
        item.url = r.url || item.url;
        var mime = r.mime && r.mime !== 'application/octet-stream' ? r.mime : item.mimeType;
        if (r.data) {
          var binary = atob(r.data);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new Response(new Blob([bytes], { type: mime }));
        }
        if (r.url) {
          var response = await fetch(r.url);
          if (!response.ok) throw new Error('Berkas lama tidak dapat diambil dari penyimpanan sumber (HTTP ' + response.status + ').');
          return response;
        }
        throw new Error('Isi berkas tidak tersedia untuk dipratinjau.');
      };

      openViewer([item], 0, load);
    }
  };

  /* ---------- router hash ---------- */
  var Router = {
    routes: {},
    add: function (path, fn) { Router.routes[path] = fn; return Router; },
    go: function (path) { location.hash = '#' + path; },
    current: function () { return (location.hash || '#/').slice(1); },
    start: function (fallback) {
      function run() {
        var raw = Router.current(), q = raw.split('?'), path = q[0] || '/';
        var params = {};
        if (q[1]) q[1].split('&').forEach(function (kv) {
          var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
        });
        var seg = path.split('/').filter(Boolean), name = seg[0] || 'beranda';
        var fn = Router.routes[name] || fallback;
        $$('.nav a').forEach(function (a) { a.classList.toggle('aktif', a.getAttribute('href') === '#/' + name); });
        var host = $('#view');
        clear(host).appendChild(UI.loading());
        Promise.resolve()
          .then(function () { return fn(host, { seg: seg, id: seg[1], params: params }); })
          .catch(function (e) {
            clear(host).appendChild(UI.empty('Halaman gagal dimuat', e.message || String(e),
              el('button.btn.primary', { onclick: run }, 'Coba lagi')));
          });
        if (w.innerWidth < 880) document.body.classList.remove('nav-buka');
      }
      w.addEventListener('hashchange', run);
      run();
    }
  };

  w.$ = $; w.$$ = $$; w.el = el; w.clear = clear; w.esc = esc;
  w.Fmt = Fmt; w.API = API; w.Store = Store; w.Auth = Auth; w.UI = UI; w.Router = Router;
  w.wait = wait;
})(window);