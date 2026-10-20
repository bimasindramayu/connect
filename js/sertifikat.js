/* =====================================================================================
   sertifikat.js: pintu masuk menu Sertifikat dan pemuat modulnya (khusus admin)
   Berisi halaman Status Apps Script dan pemuat: modul berat (sertifikat-masjid, arah-kiblat, pengaturan-sertifikat, mesin PDF)
   baru diunduh saat menu Sertifikat pertama kali dibuka. Data di Spreadsheet lewat Apps Script.
   ===================================================================================== */

// ---- Pemuat modul Sertifikat ----
// Alur saat menu Sertifikat pertama dibuka: (1) pustaka dari CDN + mesin PDF lokal + tampilan HTML, (2) tampilan dipasang ke halaman,
// (3) berkas menu dimuat berurutan (satu lingkup global), (4) data awal dimuat. Kegagalan jaringan dapat diulang tanpa memasang ulang tampilan.
var DokumenGenerator;   // dibuat di sertMount; dipakai sertifikat-masjid.js dan arah-kiblat.js
function callApi(action, params) { return gasRaw(action, params); }   // modul sertifikat memanggil Apps Script lewat sini
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str === null || str === undefined ? '' : String(str);
  return div.innerHTML;
}
const SERT = { libs: null, dom: false, i: 0, sedang: null, selesai: false };
const SERT_URL = {
  boot: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',
  qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js',
  lfCss: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', lfCssSri: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  lfJs: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', lfJsSri: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
};
const SERT_LOKAL = ['js/sertifikat-hitung-kiblat.js', 'js/sertifikat-wilayah.js', 'js/sertifikat-dokumen-pdf.js'];   // pustaka lokal (urutan bebas)
const SERT_MODUL = ['js/sertifikat-masjid.js', 'js/arah-kiblat.js', 'js/pengaturan-sertifikat.js'];                 // urutan WAJIB (berbagi variabel)
const SERT_TAMPILAN = ['views/sertifikat-masjid.html', 'views/arah-kiblat.html', 'views/pengaturan-sertifikat.html'];
function sertMuat(tag, attrs) {
  return new Promise(function (ok, no) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { if (attrs[k]) el[k] = attrs[k]; });
    if (attrs.integrity) el.crossOrigin = 'anonymous';
    el.onload = ok; el.onerror = function () { no(new Error('Gagal memuat ' + (attrs.src || attrs.href) + '. Periksa koneksi internet lalu coba lagi.')); };
    document.head.append(el);
  });
}
const sertBerkas = url => sertMuat('script', { src: url + '?v=' + APP_VERSI });
async function sertMuatPustaka() {
  var prev = window.jspdf;   // jsPDF 2.5.1 milik BOP/BAST (bila sudah dimuat) tidak boleh tertimpa jsPDF 4.2.1 milik sertifikat
  await Promise.all([
    sertMuat('script', { src: SERT_URL.boot }), sertMuat('script', { src: SERT_URL.qr }), sertMuat('script', { src: SERT_URL.pdf }),
    sertMuat('link', { rel: 'stylesheet', href: SERT_URL.lfCss, integrity: SERT_URL.lfCssSri }),
    sertMuat('script', { src: SERT_URL.lfJs, integrity: SERT_URL.lfJsSri })
  ]);
  var mine = window.jspdf;
  if (prev) window.jspdf = prev; else delete window.jspdf;
  if (!mine || !mine.jsPDF) throw new Error('jsPDF gagal dimuat.');
  return mine;
}
async function sertMount() {
  if (SERT.selesai) return;
  if (SERT.sedang) return SERT.sedang;
  SERT.sedang = (async () => {
    if (!SERT.libs) {
      SERT.libs = Promise.all([sertMuatPustaka(), ...SERT_TAMPILAN.map(u => fetch(u + '?v=' + APP_VERSI).then(r => { if (!r.ok) throw new Error('Gagal memuat ' + u + ' (HTTP ' + r.status + ').'); return r.text(); }))])
        .then(async hasil => { for (const u of SERT_LOKAL) await sertBerkas(u); return hasil; })
        .catch(e => { SERT.libs = null; throw e; });
    }
    const [mine, ...tampilan] = await SERT.libs;
    if (!SERT.dom) {
      const box = $('sertView'); box.textContent = '';
      // dialog modal dipindah ke <body>; sisanya (tampilan) dipasang di #sertView
      tampilan.forEach(h => { const t = document.createElement('template'); t.innerHTML = h; Array.from(t.content.children).filter(m => m.classList.contains('modal')).forEach(m => document.body.append(m)); box.append(t.content); });
      box.querySelectorAll('.app-view').forEach(v => v.classList.add('d-none'));
      DokumenGenerator = buatDokumenGenerator(mine);
      SERT.dom = true;
    }
    while (SERT.i < SERT_MODUL.length) { await sertBerkas(SERT_MODUL[SERT.i]); SERT.i++; }
    loadMasjidList(); loadKiblatList(); loadPengaturan();
    SERT.selesai = true;
  })().finally(() => { SERT.sedang = null; });
  return SERT.sedang;
}
window.sertPage = async function (view) {   // dipanggil router untuk sert-masjid / sert-kiblat / sert-pengaturan
  var ep = EP, box = $('sertView');
  try {
    if (!SERT.selesai) box.innerHTML = '<div class="text-body-secondary">Memuat modul Sertifikat…</div>';
    await sertMount();
    if (!live(ep)) return;
    box.querySelectorAll('.app-view').forEach(function (v) { v.classList.add('d-none'); });
    var t = $('view-' + view); if (t) t.classList.remove('d-none');
  } catch (e) {
    if (live(ep)) box.innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
  }
};

async function pageSertStatus() {   // admin: periksa sambungan ke Apps Script (menu Masjid/Musala dan Arah Kiblat menyusul di Tahap 3)
  const ep = EP;
  $('view').innerHTML = `
    <h4 class="mb-1">Status Apps Script</h4>
    <p class="text-body-secondary">Memeriksa sambungan ke Apps Script dan Spreadsheet yang dipakai ${esc(CFG.nama)} untuk Sertifikat dan BAST NR.</p>
    <div class="card"><div class="card-body" id="sertStatus">Memeriksa…</div></div>
    <button class="btn btn-outline-primary btn-sm mt-3" id="sertCek"><i class="bx bx-refresh"></i> Periksa lagi</button>`;
  const cek = async () => {
    $('sertStatus').textContent = 'Memeriksa…';
    try {
      const j = await gas('whoami');
      if (live(ep)) $('sertStatus').innerHTML = `<span class="badge bg-label-success me-2">Tersambung</span>Akun <b>${esc(j.nama)}</b> dikenali Apps Script sebagai <b>${esc(j.role)}</b>.`;
    } catch (e) {
      if (live(ep)) $('sertStatus').innerHTML = `<span class="badge bg-label-danger me-2">Gagal</span>${esc(e.message)}`;
    }
  };
  $('sertCek').onclick = cek;
  cek();
}


// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { "sert-status": pageSertStatus, "sert-masjid": () => window.sertPage('masjid'), "sert-kiblat": () => window.sertPage('kiblat'), "sert-pengaturan": () => window.sertPage('pengaturan') });
