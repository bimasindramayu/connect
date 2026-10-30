/* =====================================================================================
   core.js: inti aplikasi
   Sambungan Supabase, penyimpanan sesi, fungsi bantu ($, esc, note), peran dan hak akses menu (PERAN, can), router (route, pages),
   boot, klien Edge Function (api) dan Apps Script (gas), pemuat pustaka (loadJs), penampil dokumen (openViewer), dan komponen
   antarmuka bersama (jpToast, jpDlg, jpAsk, jpCard).
   Berkas menu mendaftarkan halamannya ke objek pages di akhir berkasnya masing-masing.
   ===================================================================================== */

const LS = localStorage, SS = sessionStorage, RK = 'bop.remember', EK = 'bop.email';
const remembered = () => LS.getItem(RK) === '1';
// Ingat saya: sesi di localStorage (tetap login setelah browser ditutup). Tidak dicentang: sessionStorage (hilang saat tab ditutup).
const authStore = {
  getItem: k => LS.getItem(k) ?? SS.getItem(k),
  setItem: (k, v) => { const [on, off] = remembered() ? [LS, SS] : [SS, LS]; off.removeItem(k); on.setItem(k, v); },
  removeItem: k => { LS.removeItem(k); SS.removeItem(k); }
};
const sb = supabase.createClient(CFG.url, CFG.key, { auth: { storage: authStore } });
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const note = (t, type = 'danger') => `<div class="alert alert-${type} py-2">${esc(t)}</div>`;
let me = null, token = null, wid = null;
let EP = 0;   // nomor halaman aktif: naik tiap pindah menu. Hasil await dari halaman lama diabaikan (cek live) agar tidak menulis ke layar yang sudah diganti
const live = ep => ep === EP;

/* ====== Peran dan hak akses menu ======
   Peran akun: daftar yang sama ada di bop.sql (check profiles.role, handle_new_user, set_hak_akses, peran_label) dan
   supabase/functions/bop/index.ts (PERAN): ubah semuanya bersama. Menu apa yang boleh dibuka tiap peran diatur admin di halaman
   "Hak Akses Menu" (tabel hak_akses) dan dibaca lewat akses_saya(). Tampilan hanya mengikuti; yang menentukan tetap server
   (RLS/trigger database, Apps Script, Edge Function), jadi menyembunyikan menu di sini bukan satu-satunya pengaman. */
const PERAN = { admin: 'Admin', operator: 'Operator KUA', bendahara_bop: 'Bendahara BOP', verifikator_bop: 'Verifikator BOP', bast_nr: 'BAST NR', kemasjidan: 'Kemasjidan', pnbp_nr: 'PNBP NR' };
const peranLabel = r => PERAN[r] || r;
const can = menu => !!me && Array.isArray(me.menus) && me.menus.includes(menu);   // menu = kunci menu (sama dengan hash halaman, mis. 'rpd', 'bast-buat')
// Urutan mencari halaman awal bila alamat kosong atau menunya tidak boleh dibuka akun ini.
const HOME_ORDER = ['bop', 'rpd', 'realisasi', 'verifikasi', 'sakti', 'metode', 'anggaran', 'laporan', 'config', 'impor',
  'bast', 'bast-buat', 'bast-pegawai', 'bast-setting', 'sert-masjid', 'sert-kiblat', 'sert-pengaturan', 'sert-status', 'jaspro', 'akses'];
const homeMenu = () => HOME_ORDER.find(can) || 'pengaturan';
// Hanya dipakai bila database belum diperbarui (fungsi akses_saya belum ada): perilaku lama, admin semua menu dan operator 4 menu.
const MENU_LAMA = {
  admin: HOME_ORDER.filter(k => k !== 'realisasi' && k !== 'akses'),
  operator: ['bop', 'rpd', 'realisasi', 'laporan']
};
let menuLama = false;   // true = database belum diperbarui (jalankan bop.sql versi terbaru)
const resetCaptcha = () => { token = null; if (window.turnstile && wid != null) turnstile.reset(wid); };

const loadRemember = () => {
  $('rem').checked = remembered();
  if (remembered()) $('un').value = (LS.getItem(EK) || '').replace('@' + CFG.domain, '');
  if ($('un').value) $('pw').focus();
};
// Login memakai username (mis. kua_anjatan). Email penuh tetap diterima (untuk akun lama / admin dengan email sendiri).
const toEmail = u => { u = u.trim().toLowerCase(); return u.includes('@') ? u : `${u}@${CFG.domain}`; };
const setEye = (b, on) => {
  $(b.dataset.eye).type = on ? 'text' : 'password';
  b.firstElementChild.className = 'bx ' + (on ? 'bx-hide' : 'bx-show');
  b.setAttribute('aria-label', (on ? 'Sembunyikan' : 'Tampilkan') + ' password');
};
const mask = root => root.querySelectorAll('[data-eye]').forEach(b => setEye(b, false));

const show = v => { $('auth').classList.toggle('d-none', v !== 'auth'); $('app').classList.toggle('d-none', v !== 'app'); };

// Daftar menu akun ini dari database (akses_saya). Database lama (fungsi belum ada): pakai MENU_LAMA agar aplikasi tetap jalan.
async function loadMenus(profil) {
  const { data, error } = await sb.rpc('akses_saya');
  if (!error && data && Array.isArray(data.menus)) { menuLama = false; return data.menus; }
  const hilang = error && (error.code === 'PGRST202' || error.code === '42883' || /akses_saya/i.test(error.message || ''));
  if (hilang && MENU_LAMA[profil.role]) { menuLama = true; return MENU_LAMA[profil.role]; }
  throw new Error(error ? error.message : 'Hak akses menu akun ini tidak ditemukan.');
}
// Tampilkan hanya menu yang boleh dibuka; kelompok (BOP, BAST NR, Sertifikat) disembunyikan bila semua isinya tersembunyi.
function applyMenus() {
  const side = $('side');
  side.querySelectorAll('[data-menu]').forEach(a => a.classList.toggle('d-none', !can(a.dataset.menu)));
  side.querySelectorAll('details').forEach(g => g.classList.toggle('d-none', !g.querySelector('[data-menu]:not(.d-none)')));
  $('dbWarn').classList.toggle('d-none', !(menuLama && me.role === 'admin'));
}

// Akun yang sedang dimuat. Supabase bisa memberi dua peristiwa login hampir bersamaan (INITIAL_SESSION dan SIGNED_IN) saat halaman dibuka
// dengan sesi tersimpan; tanpa penjaga ini profil dan hak akses diambil dua kali dan halaman dirender dua kali (dua permintaan ke server).
let booting = null;
async function boot(session) {
  if (!session) { booting = null; me = null; jpReset(); bnReset(); $('f').reset(); mask($('f')); resetCaptcha(); show('auth'); return loadRemember(); }
  const uid = session.user.id;
  if ((me && me.id === uid) || booting === uid) return;
  booting = uid;
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', uid).single();
    if (booting !== uid) return;   // keluar (logout) selagi profil dimuat
    if (error || !data) {
      await sb.auth.signOut();
      $('msg').innerHTML = note('Profil akun tidak ditemukan. Hubungi admin.');
      return;
    }
    let menus;
    try { menus = await loadMenus(data); }
    catch (e) { await sb.auth.signOut(); $('msg').innerHTML = note('Gagal memuat hak akses menu: ' + e.message); return; }
    if (booting !== uid) return;
    me = { ...data, email: session.user.email, username: (session.user.email || '').split('@')[0], menus };
    $('uName').textContent = me.nama;
    $('uRole').textContent = me.role === 'operator' ? (me.kua || peranLabel(me.role)) : peranLabel(me.role);
    $('uAv').textContent = me.nama.charAt(0).toUpperCase();
    applyMenus();
    $('pw').value = ''; show('app'); route();
  } finally { if (booting === uid) booting = null; }
}
// Menu samping: layar lebar = sembunyikan/tampilkan (pilihan diingat di browser ini); layar sempit = geser masuk/keluar.
// Daftar menu dapat digulir bila submenu yang dibuka lebih panjang daripada layar (CSS #side overflow-y).
const SIDE_KEY = 'jalin.side', wideScreen = () => innerWidth >= 992;
const syncSide = () => $('burger').setAttribute('aria-expanded', String(wideScreen() ? !document.body.classList.contains('side-off') : $('side').classList.contains('open')));

const pages = {};
function route() {
  if (!me) return;
  const h = location.hash.slice(1);
  let k = h in pages ? h : homeMenu();
  if (k !== 'pengaturan' && !can(k)) {   // menu ini tidak diberikan ke peran akun ini: ke halaman awal. Server tetap menolak bila diakali lewat alamat.
    k = homeMenu();
    if (h && location.hash !== '#' + k) history.replaceState(null, '', '#' + k);
  }
  document.querySelectorAll('#side .nav-link').forEach(a => a.classList.toggle('active', a.hash === '#' + k));
  $('side').classList.remove('open');
  const grp = $('side').querySelector('a.active')?.closest('details') || (k === 'bop' ? $('side').querySelector('details[data-grup="bop"]') : null);
  if (grp) grp.open = true;
  EP++;
  const sv = k === 'sert-masjid' || k === 'sert-kiblat' || k === 'sert-pengaturan';   // modul Sertifikat punya wadah sendiri (#sertView), tidak ditimpa innerHTML #view
  $('view').classList.toggle('d-none', sv); $('sertView').classList.toggle('d-none', !sv);
  $('view').classList.toggle('bop', !/^(jaspro|bast|sert-)/.test(k));   // pewarnaan khusus halaman BOP dan akun (css/app.css)
  pages[k]();
}
const rp = n => String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const num = s => parseInt(String(s).replace(/\D/g, '') || '0', 10);

/* ====== Edge Function "bop": reset password, unggah/hapus/daftar/baca dokumen LPJ (folder pusat Google Drive) ====== */
async function api(q, opt = {}) {
  const { data: { session } } = await sb.auth.getSession();
  let r;
  try { r = await fetch(`${CFG.url}/functions/v1/bop?${new URLSearchParams(q)}`, { ...opt, headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.key, ...opt.headers } }); }
  catch { throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet, dan pastikan Edge Function bop sudah di-deploy dengan opsi --no-verify-jwt.'); }
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    throw new Error(j?.error || `Server tidak merespons (kode ${r.status}). Pastikan Edge Function bop sudah di-deploy.`);
  }
  return r;
}
/* ====== Apps Script (Sertifikat, BAST NR): satu Spreadsheet, login memakai token Supabase (admin saja, diperiksa di server Apps Script) ====== */
async function gasRaw(action, params = {}) {   // hasil apa adanya, termasuk { success: false, message } dari server; galat jaringan/format tetap dilempar
  if (!CFG.gas) throw new Error('CFG.gas (URL Web App Apps Script) di index.html belum diisi.');
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesi habis. Silakan login ulang.');
  let r;
  try { r = await fetch(CFG.gas, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...params, action, token: session.access_token }) }); }
  catch { throw new Error('Tidak dapat menghubungi Apps Script. Periksa koneksi internet dan URL Web App (CFG.gas).'); }
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`Apps Script tidak merespons dengan benar (kode ${r.status}). Pastikan Web App sudah di-deploy dengan akses Anyone.`);
  return j;
}
async function gas(action, params = {}) {
  const j = await gasRaw(action, params);
  if (!j.success) throw new Error(j.message || 'Permintaan ke Apps Script gagal.');
  return j;
}

/* ====== Pratinjau dokumen, SATU penampil untuk semua menu (Realisasi, Verifikasi, BAST NR): zoom (mouse/trackpad/sentuh), geser,
   putar, dan penunjuk halaman PDF ("Halaman 2 dari 7"). Posisi dijepit agar dokumen tak pernah hilang dari layar ====== */
const PDF_JS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDF_WK = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
let vOff = null;
// files = [{ name }]; load(file) = fungsi yang mengembalikan Response isi file (PDF/gambar dikenali dari Content-Type).
// Dialog tersendiri (#vdlg) sehingga dapat dibuka di atas dialog lain (mis. detail BAST NR) tanpa menutupnya.
// side (opsional) = HTML atau fungsi yang mengembalikan HTML: rincian Realisasi per POS di kiri dokumen sebagai pembanding.
// PENTING: id elemen di penampil berawalan "vw" dan harus unik di seluruh dokumen. getElementById mengambil yang PERTAMA di halaman,
// jadi id yang sama dengan halaman di belakangnya (dulu "vst" = status Verifikasi) membuat zoom/geser mengenai elemen yang salah.
async function openViewer(files, idx, load, side) {
  const d = $('vdlg'), sideHtml = typeof side === 'function' ? side() : (side || ''), btn = (k, ic, lb) => `<button type="button" class="btn btn-outline-secondary" data-v="${k}" aria-label="${lb}" title="${lb}"><i class="bx ${ic}"></i></button>`;
  d.className = sideHtml ? 'wide xl' : 'wide';
  d.innerHTML = `<div class="d-flex flex-column h-100">
    <div class="d-flex align-items-center flex-wrap gap-2 p-2 border-bottom">
      ${files.length > 1
        ? `<select id="vwf" class="form-select form-select-sm" style="flex:1 1 140px;width:auto;min-width:0">${files.map((f, i) => `<option value="${i}"${i === idx ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>`
        : `<div class="fw-semibold text-truncate" style="flex:1 1 140px;min-width:0" title="${esc(files[idx].name)}">${esc(files[idx].name)}</div>`}
      <span id="vwg" class="badge bg-label-primary text-nowrap d-none" aria-live="polite"></span>
      ${sideHtml ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-v="side" aria-label="Tampilkan atau sembunyikan rincian Realisasi" title="Rincian Realisasi per POS"><i class="bx bx-list-ul"></i> Rincian</button>' : ''}
      <div class="btn-group btn-group-sm">${btn('out', 'bx-zoom-out', 'Perkecil')}${btn('in', 'bx-zoom-in', 'Perbesar')}${btn('fit', 'bx-fullscreen', 'Pas layar')}${btn('ccw', 'bx-rotate-left', 'Putar kiri')}${btn('cw', 'bx-rotate-right', 'Putar kanan')}</div>
      <button type="button" class="btn btn-sm btn-primary" id="vwx">Tutup</button></div>
    <div class="d-flex flex-grow-1 position-relative" style="min-height:0">
      ${sideHtml ? `<aside id="vwa" class="p-3${innerWidth >= 768 ? '' : ' d-none'}" aria-label="Rincian Realisasi">${sideHtml}</aside>` : ''}
      <div id="vwp" style="flex:1;min-width:0;min-height:0;position:relative;overflow:hidden;touch-action:none;background:#e9ecef;user-select:none;-webkit-user-select:none">
        <div id="vws" style="position:absolute;left:0;top:0;transform-origin:0 0"><div id="vwi" style="position:absolute;left:0;top:0;transform-origin:0 0"></div></div>
        <div id="vwm" class="position-absolute top-50 start-50 translate-middle text-center px-3" style="z-index:2"></div></div></div>
    <div class="small px-2 py-1 border-top d-none d-md-block">Geser dengan klik-tahan atau scroll. Ctrl + scroll, pinch, atau dua kali klik untuk zoom.</div></div>`;
  d.showModal();
  const vp = $('vwp'), st = $('vws'), inn = $('vwi'), P = new Map();
  let W = 0, H = 0, rot = 0, s = 1, x = 0, y = 0, gen = 0, pdf = null, url = null, io = null;
  let pTop = [], pH = [], cur = -1;   // posisi atas dan tinggi tiap halaman PDF di ruang dokumen (sebelum diputar)
  const dim = () => rot % 180 ? [H, W] : [W, H];
  const lim = () => { const [bw, bh] = dim(), base = vp.clientWidth / bw; return [Math.max(Math.min(base, vp.clientHeight / bh) * 0.9, base * 0.15), base * 6]; };
  const pageInd = () => {   // halaman yang paling banyak terlihat. Dihitung di ruang dokumen, jadi benar untuk semua rotasi
    const el = $('vwg'), n = pTop.length;
    if (!el) return;
    if (!n || !W) { el.classList.add('d-none'); cur = -1; return; }
    const vw = vp.clientWidth, vh = vp.clientHeight;
    // rentang sumbu susun halaman (tegak lurus tumpukan) yang tampak di layar, menurut rotasi
    const [a, b] = rot === 0 ? [-y / s, (vh - y) / s] : rot === 180 ? [H - (vh - y) / s, H + y / s] : rot === 90 ? [H - (vw - x) / s, H + x / s] : [-x / s, (vw - x) / s];
    let best = 0, bo = -Infinity;
    for (let k = 0; k < n; k++) { const o = Math.min(b, pTop[k] + pH[k]) - Math.max(a, pTop[k]); if (o > bo) { bo = o; best = k; } }
    if (best !== cur || el.classList.contains('d-none')) { cur = best; el.textContent = `Halaman ${best + 1} dari ${n}`; el.classList.remove('d-none'); }
  };
  const apply = () => {   // jepit zoom dan posisi: dokumen selalu terlihat (kecil = di tengah, besar = tepi tak keluar layar)
    if (!W) return;
    const [bw, bh] = dim(), vw = vp.clientWidth, vh = vp.clientHeight, [lo, hi] = lim();
    s = Math.min(hi, Math.max(lo, s));
    x = bw * s <= vw ? (vw - bw * s) / 2 : Math.min(0, Math.max(vw - bw * s, x));
    y = bh * s <= vh ? (vh - bh * s) / 2 : Math.min(0, Math.max(vh - bh * s, y));
    st.style.width = bw + 'px'; st.style.height = bh + 'px';
    st.style.transform = `translate(${x}px,${y}px) scale(${s})`;
    inn.style.transform = ['', `translate(${H}px,0) rotate(90deg)`, `translate(${W}px,${H}px) rotate(180deg)`, `translate(0,${W}px) rotate(270deg)`][rot / 90];
    pageInd();
  };
  const fit = () => { if (!W) return; s = vp.clientWidth / dim()[0]; x = y = 0; apply(); };
  const zoomAt = (cx, cy, k) => {
    if (!W) return;
    const n = Math.min(lim()[1], Math.max(lim()[0], s * k)), f = n / s;
    x = cx - (cx - x) * f; y = cy - (cy - y) * f; s = n;
  };
  d.onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'side') { $('vwa').classList.toggle('d-none'); return fit(); }   // panel rincian: tampil/sembunyi lalu pas-kan dokumen ke lebar baru
    if (!W) return;
    const k = b.dataset.v, c = [vp.clientWidth / 2, vp.clientHeight / 2];
    if (k === 'fit') return fit();
    if (k === 'cw' || k === 'ccw') { rot = (rot + (k === 'cw' ? 90 : 270)) % 360; return fit(); }
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
    const r = vp.getBoundingClientRect(), base = vp.clientWidth / (dim()[0] || 1);
    if (s > base * 1.2) fit(); else { zoomAt(e.clientX - r.left, e.clientY - r.top, base * 2.5 / s); apply(); }
  };
  const ro = new ResizeObserver(apply); ro.observe(vp);

  const clean = () => { if (io) io.disconnect(); if (pdf) pdf.destroy(); if (url) URL.revokeObjectURL(url); io = pdf = url = null; inn.replaceChildren(); W = H = 0; rot = 0; pTop = []; pH = []; pageInd(); };
  const paint = async (box, pg) => {   // render halaman PDF hanya saat mendekati layar
    const k = W / pg.getViewport({ scale: 1 }).width, v = pg.getViewport({ scale: k * Math.min(window.devicePixelRatio || 1, 1.5) }), c = document.createElement('canvas');
    c.width = v.width; c.height = v.height; c.style.cssText = 'width:100%;height:100%;display:block';
    box.append(c);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
  };
  const show = async i => {
    const my = ++gen; clean(); $('vwm').textContent = 'Memuat dokumen…';
    try {
      const blob = await (await load(files[i])).blob();
      if (my !== gen) return;
      const cw = Math.min(vp.clientWidth, 1100);
      if ((blob.type || files[i].mimeType || '').startsWith('application/pdf')) {
        await loadJs(PDF_JS);
        pdfjsLib.GlobalWorkerOptions.workerSrc ||= URL.createObjectURL(new Blob([`importScripts("${PDF_WK}")`], { type: 'text/javascript' }));
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (my !== gen) return doc.destroy();
        pdf = doc;
        const pgs = [];
        for (let n = 1; n <= doc.numPages; n++) pgs.push(await doc.getPage(n));
        io = new IntersectionObserver(es => es.forEach(en => {
          if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = 1; paint(en.target, pgs[+en.target.dataset.n]); }
        }), { root: vp, rootMargin: '100% 0px' });
        W = cw; H = 0;
        pgs.forEach((pg, n) => {
          const v1 = pg.getViewport({ scale: 1 }), h = Math.round(v1.height * cw / v1.width), box = document.createElement('div');
          box.dataset.n = n; box.style.cssText = `width:${cw}px;height:${h}px;margin-bottom:8px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)`;
          pTop.push(H); pH.push(h);
          inn.append(box); io.observe(box); H += h + 8;
        });
      } else {
        url = URL.createObjectURL(blob);
        const img = new Image(); img.src = url; await img.decode();
        if (my !== gen) return;
        W = cw; H = Math.round(cw * img.naturalHeight / img.naturalWidth);
        img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
        inn.append(img);
      }
      inn.style.width = W + 'px'; inn.style.height = H + 'px';
      $('vwm').textContent = ''; fit();
    } catch (e) { if (my === gen) $('vwm').innerHTML = note(e.message); }
  };
  if ($('vwf')) $('vwf').onchange = () => show(+$('vwf').value);
  $('vwx').onclick = () => d.close();
  vOff = () => { gen++; clean(); ro.disconnect(); d.onclick = null; };
  show(idx);
}
const CDN = {
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  at: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
  exceljs: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
};
const libs = {};
const loadJs = src => libs[src] ||= new Promise((ok, no) => {   // library ekspor hanya dimuat saat tombol unduh ditekan
  const el = document.createElement('script'); el.src = src; el.onload = ok;
  el.onerror = () => { delete libs[src]; no(new Error('Gagal memuat library ekspor. Periksa koneksi internet lalu coba lagi.')); };
  document.head.append(el);
});
/* ====== Pemberitahuan pop-up (toast): SELALU paling depan ======
   <dialog>.showModal() menaruh dialog di "top layer" browser, lapisan yang tidak dapat dikalahkan z-index berapa pun, jadi toast biasa
   (position:fixed + z-index) tertutup dialog yang sedang terbuka. Wadah toast dijadikan popover manual: popover juga masuk top layer
   dan yang masuk PALING AKHIR tampil paling depan. Karena itu wadah dinaikkan lagi (hide lalu show) tiap ada toast baru dan tiap kali
   dialog modal dibuka (showModal di bawah). Browser tanpa Popover API memakai z-index biasa (modal Bootstrap Sertifikat di bawahnya). */
const TOAST_POP = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
function toastHost() {
  let h = document.getElementById('jtoast');
  if (!h) {
    h = document.createElement('div'); h.id = 'jtoast'; h.setAttribute('aria-live', 'polite');
    if (TOAST_POP) h.setAttribute('popover', 'manual');
    document.body.append(h);
  }
  return h;
}
function toastUp() {   // naikkan wadah ke paling depan (bila ada toast yang tampil)
  const h = document.getElementById('jtoast');
  if (!h || !TOAST_POP || !h.children.length) return;
  try { if (h.matches(':popover-open')) h.hidePopover(); h.showPopover(); } catch { /* abaikan: toast tetap tampil dengan z-index biasa */ }
}
if (typeof HTMLDialogElement !== 'undefined') {
  const showModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function (...a) { const r = showModal.apply(this, a); toastUp(); return r; };
}
// c: success | danger | warning | info. Pesan panjang dan galat dibaca lebih lama (4,5 detik sampai 12 detik).
const jpToast = (m, c = 'success') => {
  const h = toastHost(), teks = String(m ?? '');
  const e = Object.assign(document.createElement('div'), { className: 'jp-toast ' + c, textContent: teks });
  e.setAttribute('role', c === 'danger' ? 'alert' : 'status');
  h.append(e); toastUp();
  setTimeout(() => {
    e.remove();
    if (!h.children.length && TOAST_POP) { try { h.hidePopover(); } catch { /* sudah tertutup */ } }
  }, Math.min(12000, Math.max(4500, 2500 + teks.length * 60)));
};
// Hasil sebuah aksi (simpan, kirim, ubah status): catatan di tempatnya DAN pop-up paling depan, supaya tidak terlewat walau layar
// sedang menggulir jauh dari catatan itu atau dialog sedang terbuka. type: success | danger | warning | info.
function lapor(el, teks, type = 'danger') {
  if (el) el.innerHTML = note(teks, type);
  jpToast(teks, type);
}
const jpDlg = (h, wire) => { const d = $('dlg'); d.innerHTML = `<div class="p-4">${h}</div>`; wire?.(d); if (!d.open) d.showModal(); };
const jpAsk = (title, msg, label, ok, danger) => jpDlg(
  `<h5 class="mb-2">${esc(title)}</h5><p>${esc(msg)}</p><div class="d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary" data-x>Batal</button><button class="btn btn-${danger ? 'danger' : 'primary'}" data-ok>${esc(label)}</button></div>`,
  d => { d.querySelector('[data-x]').onclick = () => d.close(); d.querySelector('[data-ok]').onclick = () => { d.close(); ok(); }; });
const jpCard = (ic, c, v, l) => `<div class="col-6 col-lg"><div class="card h-100"><div class="card-body d-flex align-items-center gap-3 py-3"><div class="avatar rounded bg-label-${c}"><i class="bx ${ic} fs-4"></i></div><div class="lh-sm"><div class="fw-semibold fs-5">${v}</div><small>${l}</small></div></div></div></div>`;
