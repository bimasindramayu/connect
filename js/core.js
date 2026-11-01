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
  'bast', 'bast-buat', 'bast-pegawai', 'bast-setting', 'sert-masjid', 'sert-kiblat', 'sert-pengaturan', 'jaspro', 'akses'];
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
   putar, dan penunjuk halaman PDF ("Halaman 2 dari 7"). Posisi dijepit agar dokumen tak pernah hilang dari layar.
   - Memutar TIDAK mengubah zoom dan tetap di halaman yang sedang dilihat (titik di tengah layar tetap di tengah layar). Tiap halaman diputar
     sendiri dan halaman tetap tersusun ke bawah; bukan seluruh tumpukan yang diputar (dulu begitu, sehingga memutar PDF banyak halaman
     melompat ke halaman pertama dan mengecil sampai teks tak terbaca).
   - Batas zoom tidak bergantung pada rotasi, dan cukup besar untuk membaca teks kecil. PDF digambar ulang dengan kerapatan piksel layar
     untuk bagian yang tampak (kanvas "tajam"), jadi teks vektor tetap tajam di zoom berapa pun, bukan gambar besar yang pecah ====== */
const PDF_JS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDF_WK = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const V_GAP = 8;                        // jarak antar halaman (satuan ruang dokumen)
const V_ZOOM = 10;                      // zoom maksimal = 10 kali "pas lebar" (gambar beresolusi tinggi boleh lebih: lihat lim)
const V_MAXPX = 16e6, V_MAXSIDE = 8192; // batas kanvas tajam (iOS Safari membatasi sekitar 16,7 juta piksel per kanvas)
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
        <div id="vws" style="position:absolute;left:0;top:0;transform-origin:0 0"><div id="vwi" style="position:absolute;left:0;top:0"></div></div>
        <div id="vwm" class="position-absolute top-50 start-50 translate-middle text-center px-3" style="z-index:2"></div></div></div>
    <div class="small px-2 py-1 border-top d-none d-md-block">Geser dengan klik-tahan atau scroll. Ctrl + scroll, pinch, atau dua kali klik untuk zoom.</div></div>`;
  d.showModal();
  const vp = $('vwp'), st = $('vws'), inn = $('vwi'), P = new Map();
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
    const el = $('vwg');
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
    const b = e.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'side') { $('vwa').classList.toggle('d-none'); return fit(); }   // panel rincian: tampil/sembunyi lalu pas-kan dokumen ke lebar baru
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
    const my = ++gen; clean(); $('vwm').textContent = 'Memuat dokumen…';
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
      if ((blob.type || files[i].mimeType || '').startsWith('application/pdf')) {
        await loadJs(PDF_JS);
        pdfjsLib.GlobalWorkerOptions.workerSrc ||= URL.createObjectURL(new Blob([`importScripts("${PDF_WK}")`], { type: 'text/javascript' }));
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (my !== gen) return doc.destroy();
        pdf = doc;
        const pgs = [];
        for (let n = 1; n <= doc.numPages; n++) pgs.push(await doc.getPage(n));
        io = new IntersectionObserver(es => es.forEach(en => {
          if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = 1; paint(hl[+en.target.dataset.n]).catch(() => { /* ditutup saat digambar */ }); }
        }), { root: vp, rootMargin: '100% 0px' });
        pgs.forEach(pg => { const v1 = pg.getViewport({ scale: 1 }); io.observe(add(Math.round(v1.height * cw / v1.width), pg)); });
      } else {
        url = URL.createObjectURL(blob);
        const img = new Image(); img.src = url; await img.decode();
        if (my !== gen) return;
        img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
        add(Math.round(cw * img.naturalHeight / img.naturalWidth), null).append(img);
        NW = img.naturalWidth;
      }
      W = cw;
      LW = hl.reduce((m, p) => Math.max(m, p.h), W);   // tumpukan terlebar (halaman tertinggi diputar 90 derajat)
      LH = Math.max(hl.reduce((m, p) => m + p.h, 0), hl.length * W) + (hl.length - 1) * V_GAP;   // tumpukan tertinggi (tanpa atau dengan diputar)
      layout(); $('vwm').textContent = ''; fit(0);
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
