/* BARJAS - modul yang ditanam di dalam BIMASATU. */
(function (w) {
  'use strict';

  function shell() {
    return '<section id="barjas-root" class="barjas-module">' +
      '<div id="barjas-bar"></div>' +
      '<header class="atas"><div class="barjas-heading"><h1 id="barjas-judul">BARJAS</h1></div>' +
      '<div id="barjas-alat-atas" class="baris"></div></header>' +
      '<div id="barjas-view"></div>' +
      '<div id="barjas-toast" aria-live="polite"></div>' +
      '<dialog id="barjas-vdlg" aria-label="Pratinjau dokumen"></dialog>' +
      '</section>';
  }

  function pageBarjas() {
    var view = document.getElementById('view');
    if (!view) return;
    var root = document.getElementById('barjas-root');
    if (!root) {
      view.innerHTML = shell();
      mount();
    } else if (w.Router && typeof w.Router.run === 'function') {
      w.Router.run();
    }
  }

  function mount() {
    // BIMASATU memiliki binding global lexical `$` (getElementById). Pakai helper CSS BARJAS secara lokal.
    var $ = w.$, $$ = w.$$, el = w.el, clear = w.clear;
    var current = w.BIMASATU && w.BIMASATU.currentUser();
    if (!current || !(current.role === 'admin' || (current.menus || []).includes('barjas'))) {
      var host = document.getElementById('barjas-view');
      if (host) host.textContent = 'Akun ini tidak memiliki hak akses BARJAS.';
      return;
    }
    Auth.save({ token: 'shared-bimasatu-session', user: {
      id: current.id, nama: current.nama || current.email || '',
      username: current.username || '', email: current.email || '', role: current.role,
      menus: Array.isArray(current.menus) ? current.menus.slice() : []
    }});
    if (!Auth.guard()) return;
    var C = w.CONFIG;
  var App = {
    state: { user: Auth.user(), tahun: localStorage.getItem('barjas.tahun') || String(new Date().getFullYear()), master: null },

    /* pencarian cepat berbasis peta id */
    peta: { satker: {}, pejabat: {}, penyedia: {}, users: {} },
    satker: function (id) { return App.peta.satker[id] || null; },
    pejabat: function (id) { return App.peta.pejabat[id] || null; },
    penyedia: function (id) { return App.peta.penyedia[id] || null; },
    pengguna: function (id) { return App.peta.users[id] || null; },
    namaSatker: function (id) { var s = App.satker(id); return s ? s.nama : '—'; },

    jenis: function (id) {
      var j = C.JENIS_PENGADAAN.filter(function (x) { return x.id === id; })[0];
      return j || { id: id, nama: id || '—', rab: false };
    },

    setJudul: function (t, sub) {
      clear($('#barjas-judul'));
      $('#barjas-judul').appendChild(document.createTextNode(t));
      if (sub) $('#barjas-judul').appendChild(el('span.sub', { text: sub }));
      document.title = t + ' · BIMASATU';
    },
    alat: function (nodes) {
      var box = clear($('#barjas-alat-atas'));
      (nodes || []).forEach(function (n) { if (n) box.appendChild(n); });
    },

    /* data master sekali muat, dipakai seluruh halaman */
    muat: function (paksa) {
      if (App.state.master && !paksa) return Promise.resolve(App.state.master);
      var cache = paksa ? null : Store.get('master.' + App.state.tahun, C.CACHE_TTL);
      var p = cache ? Promise.resolve(cache) : API.call('bootstrap', { tahun: App.state.tahun });
      return p.then(function (m) {
        Store.set('master.' + App.state.tahun, m);
        App.state.master = m;
        App.peta = { satker: {}, pejabat: {}, penyedia: {}, users: {} };
        ['satker', 'pejabat', 'penyedia', 'users'].forEach(function (k) {
          (m[k] || []).forEach(function (r) { App.peta[k === 'users' ? 'users' : k][r.id] = r; });
        });
        return m;
      });
    },
    segarkan: function () {
      Store.dropAll();
      return App.muat(true).then(function () {
        w.dispatchEvent(new Event('hashchange'));
      });
    },
    gantiTahun: function (t) {
      App.state.tahun = String(t);
      localStorage.setItem('barjas.tahun', App.state.tahun);
      App.state.master = null;
      App.muat(true).then(function () { w.dispatchEvent(new Event('hashchange')); });
    },

    /* Izin menu BARJAS berarti akses seluruh data dan fungsi di dalam modul ini.
       Role BIMASATU tetap tidak berubah dan tidak memberi akses ke modul lain. */
    canManage: function () {
      var u = App.state.user || {};
      return u.role === 'admin' || (Array.isArray(u.menus) && u.menus.indexOf('barjas') >= 0);
    },

    /* Semua pengguna yang diberi menu BARJAS dapat melihat seluruh satker;
       penugasan hanya menjadi metadata pengelolaan, bukan filter visibilitas. */
    satkerSaya: function () {
      var m = App.state.master || {}, u = App.state.user;
      var tugas = (m.penugasan || []).filter(function (p) { return String(p.tahun) === App.state.tahun; });
      if (App.canManage()) return m.satker || [];
      var ids = {};
      tugas.forEach(function (p) { if (p.user_id === u.id) ids[p.satker_id] = 1; });
      return (m.satker || []).filter(function (s) { return ids[s.id]; });
    },
    tugas: function (satkerId, tahun) {
      var m = App.state.master || {};
      return (m.penugasan || []).filter(function (p) {
        return p.satker_id === satkerId && String(p.tahun) === String(tahun || App.state.tahun);
      })[0] || null;
    }
  };
  w.App = App;

  /* Navigasi, identitas akun, dan logout disediakan oleh kerangka BIMASATU. */

  /* pemilih tahun anggaran, selalu tampil di kanan atas */
  w.pilihTahun = function () {
    var m = App.state.master || {}, tahun = (m.tahun || []).map(function (t) { return String(t.id || t); });
    var kini = String(new Date().getFullYear());
    [kini, String(Number(kini) + 1)].forEach(function (t) { if (tahun.indexOf(t) < 0) tahun.push(t); });
    tahun.sort().reverse();
    var sel = el('select.inp', {
      style: 'width:auto;padding:6px 9px;font-size:13px',
      'aria-label': 'Tahun anggaran',
      onchange: function () { App.gantiTahun(sel.value); }
    }, tahun.map(function (t) {
      return el('option', { value: t, selected: t === App.state.tahun }, 'TA ' + t);
    }));
    return sel;
  };

  /* ---------- rute ---------- */
  function daftarkan() {
    var P = w.Pages, K = w.PaketPage;
    Router.add('beranda', P.beranda)
      .add('satker', P.satker)
      .add('penugasan', P.penugasan)
      .add('penyedia', P.penyedia)
      .add('pejabat', P.pejabat)
      .add('pengaturan', P.pengaturan)
      .add('migrasi', w.BarjasMigrasi.page)
      .add('paket', function (host, ctx) { return ctx.id ? K.detail(host, ctx) : K.daftar(host, ctx); });
  }

  App.muat().then(function () {
    if (!document.getElementById('barjas-root')) return;
    daftarkan();
    Router.start(w.Pages.beranda);
  }).catch(function (e) {
    var host = $('#barjas-view');
    if (host) clear(host).appendChild(UI.empty(
      'Tidak dapat menghubungi server',
      e.message + ' — periksa koneksi proyek Supabase dan pastikan Edge Function BARJAS sudah di-deploy.',
      el('button.btn.primary', { onclick: function () { App.muat(true).then(function () { Router.run(w.Pages.beranda); }).catch(UI.err); } }, 'Muat ulang')
    ));
  });
  }
  
  w.pageBarjas = pageBarjas;
})(window);