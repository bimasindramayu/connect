/* =====================================================================================
   akun.js: halaman Pengaturan (profil dan ganti password sendiri) dan, khusus admin, pengelolaan akun SEMUA peran:
   tambah akun, ubah nama/peran/KUA, dan reset password.
   Pekerjaan yang memerlukan kunci server (membuat akun, ubah password orang lain) dikerjakan Edge Function bop lewat api() di core.js:
   action=buat-akun, ubah-akun, reset-password. Siapa saja yang boleh dibuka tiap peran diatur di js/akses.js (Hak Akses Menu).
   ===================================================================================== */

const PW_ERR = 'Password minimal 8 karakter dan harus sama di kedua kolom.';
const errId = e => ({ same_password: 'Password baru tidak boleh sama dengan password lama.', weak_password: 'Password terlalu lemah. Tambahkan huruf besar, angka, atau simbol.' }[e.code] || e.message);
const eyeBtn = id => `<button type="button" class="btn btn-outline-secondary" data-eye="${id}" aria-label="Tampilkan password"><i class="bx bx-show"></i></button>`;
const pwPair = p => `
  <label class="form-label" for="${p}1">Password baru</label>
  <div class="input-group mb-3"><input id="${p}1" type="password" class="form-control" minlength="8" maxlength="72" autocomplete="new-password" placeholder="Minimal 8 karakter" required>${eyeBtn(p + 1)}</div>
  <label class="form-label" for="${p}2">Ulangi password baru</label>
  <div class="input-group"><input id="${p}2" type="password" class="form-control" maxlength="72" autocomplete="new-password" placeholder="Ketik ulang password baru" required>${eyeBtn(p + 2)}</div>
  <div class="small mt-1 mb-3" id="${p}h" aria-live="polite"></div>`;
const pairOk = p => {
  const a = $(p + 1).value, b = $(p + 2).value, same = a === b, h = $(p + 'h');
  const bad = !same && b && (b.length >= a.length || !a.startsWith(b)); // merah hanya jika sudah pasti salah ketik
  h.className = 'small mt-1 mb-3 ' + (same && b ? 'text-success' : bad ? 'text-danger' : '');
  h.textContent = same && b ? 'Password sama.' : bad ? 'Password belum sama.' : '';
  return a.length >= 8 && same;
};
const bindPair = p => [1, 2].forEach(n => $(p + n).addEventListener('input', () => pairOk(p)));
const sandiAcak = () => {   // 12 karakter tanpa huruf/angka yang mudah tertukar (l, I, 1, O, 0)
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), n => c[n % c.length]).join('');
};
const apiJson = (action, body) => api({ action }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Urutan peran di daftar dan pilihan. Daftar yang sama: core.js (PERAN), bop.sql, supabase/functions/bop/index.ts.
const AKUN_PERAN = ['admin', 'operator', 'bendahara_bop', 'verifikator_bop', 'bast_nr', 'kemasjidan', 'pnbp_nr'];
const BADGE_PERAN = { admin: 'danger', operator: 'primary', bendahara_bop: 'success', verifikator_bop: 'info', bast_nr: 'warning', kemasjidan: 'secondary', pnbp_nr: 'dark' };
let akun = { data: [], kua: [], peran: '', q: '', ep: 0 };   // keadaan daftar akun (admin): data akun, daftar KUA aktif, filter peran dan pencarian

function openReset(r) {
  if (!r) return;
  const d = $('dlg');
  d.innerHTML = `<form id="rf" class="p-4">
    <h5 class="mb-1">Reset password</h5>
    <p class="mb-3">Akun: <b>${esc(r.nama)}</b> · ${esc(peranLabel(r.role))}${r.kua ? ' (' + esc(r.kua) + ')' : ''}${r.username ? ' · username <code>' + esc(r.username) + '</code>' : ''}</p>
    <div id="rmsg"></div>${pwPair('rp')}
    <button type="button" class="btn btn-sm btn-outline-secondary mb-3" id="gen"><i class="bx bx-refresh"></i> Buat password acak</button>
    <p class="small">Password lama langsung tidak berlaku. Sampaikan password baru ini kepada pemilik akun, dan sarankan menggantinya lewat menu Pengaturan.</p>
    <div class="d-flex justify-content-end gap-2">
      <button type="button" class="btn btn-outline-secondary" id="rx">Batal</button>
      <button class="btn btn-primary" id="rgo">Reset password</button></div></form>`;
  bindPair('rp');
  $('rx').onclick = () => d.close();
  $('gen').onclick = () => {
    $('rp1').value = $('rp2').value = sandiAcak();
    d.querySelectorAll('[data-eye]').forEach(b => setEye(b, true)); pairOk('rp');
  };
  $('rf').onsubmit = async e => {
    e.preventDefault();
    if (!pairOk('rp')) return $('rmsg').innerHTML = note(PW_ERR, 'warning');
    $('rgo').disabled = true; $('rmsg').innerHTML = '';
    try {
      await apiJson('reset-password', { user_id: r.id, password: $('rp1').value });
      d.close(); lapor($('amsg'), `Password ${r.nama} berhasil direset.`, 'success');
    } catch (er) { $('rgo').disabled = false; lapor($('rmsg'), er.message, 'danger'); }
  };
  d.showModal();
}

// Tambah akun (r kosong) atau ubah nama/peran/KUA akun (r = baris dari akun_daftar). Username tidak dapat diubah setelah dibuat.
function openAkun(r) {
  const baru = !r, d = $('dlg'), diri = !baru && r.id === me.id;
  const kuaId = !baru && r.kua ? (akun.kua.find(k => k.nama_kua === r.kua) || {}).id : '';
  d.innerHTML = `<form id="kf" class="p-4" novalidate>
    <h5 class="mb-1">${baru ? 'Tambah akun' : 'Ubah akun'}</h5>
    <p class="small mb-3">${baru ? 'Akun langsung aktif. Menu yang dapat dibuka mengikuti halaman Hak Akses Menu.' : `Username <code>${esc(r.username)}</code> tidak dapat diubah. Untuk mengganti password, gunakan Reset password.`}</p>
    <div id="kmsg"></div>
    ${baru ? `<label class="form-label" for="ku">Username</label>
    <input id="ku" class="form-control mb-1" maxlength="60" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="mis. bendahara_bop" required>
    <div class="small mb-3">Huruf kecil, angka, titik, garis bawah, atau garis; 3–40 karakter. Dipakai untuk login.</div>` : ''}
    <label class="form-label" for="kn">Nama</label>
    <input id="kn" class="form-control mb-3" maxlength="100" autocomplete="off" value="${esc(baru ? '' : r.nama)}" placeholder="Nama lengkap atau nama jabatan" required>
    <label class="form-label" for="kr">Peran</label>
    <select id="kr" class="form-select mb-1"${diri ? ' disabled' : ''}>${AKUN_PERAN.map(p => `<option value="${p}"${!baru && r.role === p || baru && p === 'operator' ? ' selected' : ''}>${esc(peranLabel(p))}</option>`).join('')}</select>
    <div class="small mb-3">${diri ? 'Peran akun Anda sendiri tidak dapat diubah.' : 'Hanya Operator KUA yang terikat ke satu KUA.'}</div>
    <div id="kk"><label class="form-label" for="kk1">KUA</label>
    <select id="kk1" class="form-select mb-3"><option value="">Pilih KUA…</option>${akun.kua.map(k => `<option value="${k.id}"${String(k.id) === String(kuaId) ? ' selected' : ''}>${esc(k.nama_kua)}</option>`).join('')}</select></div>
    ${baru ? `<div id="kpw">${pwPair('kp')}<button type="button" class="btn btn-sm btn-outline-secondary mb-3" id="kgen"><i class="bx bx-refresh"></i> Buat password acak</button></div>` : ''}
    <div class="d-flex justify-content-end gap-2">
      <button type="button" class="btn btn-outline-secondary" id="kx">Batal</button>
      <button class="btn btn-primary" id="kgo">${baru ? 'Buat akun' : 'Simpan'}</button></div></form>`;
  const sync = () => { $('kk').classList.toggle('d-none', $('kr').value !== 'operator'); };
  $('kr').onchange = sync; sync();
  if (baru) {
    bindPair('kp');
    $('kgen').onclick = () => { $('kp1').value = $('kp2').value = sandiAcak(); d.querySelectorAll('[data-eye]').forEach(b => setEye(b, true)); pairOk('kp'); };
  }
  $('kx').onclick = () => d.close();
  $('kf').onsubmit = async e => {
    e.preventDefault();
    const peran = $('kr').value, nama = $('kn').value.trim(), kua = $('kk1').value;
    const salah = m => lapor($('kmsg'), m, 'warning');
    let email = '';
    if (baru) {
      const u = $('ku').value.trim().toLowerCase();
      if (!(u.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) : /^[a-z0-9._-]{3,40}$/.test(u))) return salah('Username hanya boleh huruf kecil, angka, titik, garis bawah, atau garis (3–40 karakter).');
      email = toEmail(u);
      if (akun.data.some(a => a.username === email.split('@')[0] && email.endsWith('@' + CFG.domain))) return salah('Username itu sudah dipakai akun lain.');
    }
    if (!nama) return salah('Nama wajib diisi.');
    if (peran === 'operator' && !kua) return salah('Pilih KUA untuk akun Operator KUA.');
    if (baru && !pairOk('kp')) return salah(PW_ERR);
    $('kgo').disabled = true; $('kmsg').innerHTML = '';
    try {
      if (baru) await apiJson('buat-akun', { email, nama, role: peran, password: $('kp1').value, kua_id: peran === 'operator' ? +kua : undefined });
      else await apiJson('ubah-akun', { user_id: r.id, nama, role: peran, kua_id: peran === 'operator' ? +kua : undefined });
      d.close();
      await akunMuat();
      lapor($('amsg'), baru ? `Akun ${nama} (${peranLabel(peran)}) dibuat. Username: ${email.split('@')[0]}.` : `Akun ${nama} diperbarui.`, 'success');
    } catch (er) { $('kgo').disabled = false; lapor($('kmsg'), er.message, 'danger'); }
  };
  d.showModal();
}

// Daftar akun: pencarian dan filter peran (kartu hitungan di atas tabel ikut berfungsi sebagai filter).
function akunRender() {
  const el = $('acc'); if (!el) return;
  const q = akun.q.trim().toLowerCase(), hit = {};
  akun.data.forEach(a => hit[a.role] = (hit[a.role] || 0) + 1);
  $('achips').innerHTML = [['', 'Semua', akun.data.length], ...AKUN_PERAN.map(p => [p, peranLabel(p), hit[p] || 0])].map(([p, l, n]) =>
    `<button type="button" class="btn btn-sm ${akun.peran === p ? 'btn-primary' : 'btn-outline-secondary'}" data-peran="${p}" aria-pressed="${akun.peran === p}">${esc(l)} <span class="badge bg-label-secondary ms-1">${n}</span></button>`).join('');
  const rows = akun.data.filter(r => (!akun.peran || r.role === akun.peran) && (!q || [r.nama, r.username, r.kua].some(x => String(x || '').toLowerCase().includes(q))));
  el.innerHTML = rows.length ? `<table class="table table-hover align-middle"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Instansi</th><th class="text-end">Aksi</th></tr></thead><tbody>${
    rows.map(r => `<tr><td>${esc(r.nama)}${r.id === me.id ? ' <span class="badge bg-label-info">Anda</span>' : ''}</td><td><code>${esc(r.username)}</code></td>
      <td><span class="badge bg-label-${BADGE_PERAN[r.role] || 'secondary'}">${esc(peranLabel(r.role))}</span></td><td>${esc(r.kua || '-')}</td>
      <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-ubah="${esc(r.id)}" aria-label="Ubah akun ${esc(r.nama)}"><i class="bx bx-edit-alt"></i> Ubah</button>
      ${r.id === me.id ? '' : ` <button class="btn btn-sm btn-outline-primary" data-reset="${esc(r.id)}" aria-label="Reset password ${esc(r.nama)}"><i class="bx bx-key"></i> Reset password</button>`}</td></tr>`).join('')
  }</tbody></table>` : '<div class="text-muted py-3">Tidak ada akun yang cocok.</div>';
}
async function akunMuat() {
  const ep = akun.ep;
  const [a, k] = await Promise.all([sb.rpc('akun_daftar'), sb.from('kua').select('id,nama_kua').eq('status', 'aktif').order('nama_kua')]);
  if (!live(ep)) return;
  if (a.error) return $('acc') && ($('acc').innerHTML = note(a.error.message));
  akun.data = a.data || []; akun.kua = k.data || [];
  akunRender();
}

async function pagePengaturan() {
  const ep = EP;
  $('view').innerHTML = `<div class="row g-4">
    <div class="col-lg-6"><div class="card"><div class="card-body">
      <h5 class="mb-3">Profil</h5>
      <dl class="row mb-0">
        <dt class="col-4">Nama</dt><dd class="col-8">${esc(me.nama)}</dd>
        <dt class="col-4">Instansi</dt><dd class="col-8">${esc(me.kua || '-')}</dd>
        <dt class="col-4">Username</dt><dd class="col-8">${esc(me.username)}</dd>
        <dt class="col-4">Peran</dt><dd class="col-8">${esc(peranLabel(me.role))}</dd>
      </dl></div></div></div>
    <div class="col-lg-6"><div class="card"><div class="card-body">
      <h5 class="mb-3">Ubah password</h5><div id="pmsg"></div>
      <form id="pf">${pwPair('np')}
      <button class="btn btn-primary" id="pgo">Simpan password</button></form></div></div></div>
    ${me.role === 'admin' ? `<div class="col-12"><div class="card"><div class="card-body">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3"><h5 class="mb-0 me-auto">Daftar akun</h5>
        <input id="aq" type="search" class="form-control form-control-sm" style="width:220px" placeholder="Cari nama, username, KUA…" aria-label="Cari akun" autocomplete="off">
        <button class="btn btn-sm btn-primary" id="anew"><i class="bx bx-user-plus"></i> Tambah akun</button></div>
      <div id="amsg"></div><div id="achips" class="d-flex flex-wrap gap-2 mb-3"></div><div class="table-responsive" id="acc">Memuat…</div></div></div></div>` : ''}
  </div>`;
  bindPair('np');
  $('pf').onsubmit = async e => {
    e.preventDefault();
    if (!pairOk('np')) return lapor($('pmsg'), PW_ERR, 'warning');
    $('pgo').disabled = true;
    const { error } = await sb.auth.updateUser({ password: $('np1').value });
    if (!live(ep)) return;
    $('pgo').disabled = false;
    lapor($('pmsg'), error ? errId(error) : 'Password berhasil diubah.', error ? 'danger' : 'success');
    if (!error) { $('pf').reset(); mask($('pf')); pairOk('np'); }
  };
  if (me.role === 'admin') {
    akun = { data: [], kua: [], peran: '', q: '', ep };
    $('aq').oninput = e => { akun.q = e.target.value; akunRender(); };
    $('achips').onclick = e => { const b = e.target.closest('[data-peran]'); if (b) { akun.peran = b.dataset.peran; akunRender(); } };
    $('anew').onclick = () => openAkun();
    $('acc').onclick = e => {
      const b = e.target.closest('[data-reset],[data-ubah]'); if (!b) return;
      const id = b.dataset.reset || b.dataset.ubah, r = akun.data.find(x => x.id === id);
      if (b.dataset.reset) openReset(r); else openAkun(r);
    };
    await akunMuat();   // username = bagian email sebelum @ (auth.users tidak terbuka ke klien)
  }
}


// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { pengaturan: pagePengaturan });
