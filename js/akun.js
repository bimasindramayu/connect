/* =====================================================================================
   akun.js: manajemen akun (Pengaturan akun sendiri dan reset password operator oleh admin)
   Memakai fungsi edge reset-password lewat api() di core.js.
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

function openReset(r) {
  if (!r) return;
  const d = $('dlg');
  d.innerHTML = `<form id="rf" class="p-4">
    <h5 class="mb-1">Reset password</h5>
    <p class="mb-3">Akun: <b>${esc(r.nama)}</b>${r.kua ? ' (' + esc(r.kua) + ')' : ''}${r.username ? ' · username <code>' + esc(r.username) + '</code>' : ''}</p>
    <div id="rmsg"></div>${pwPair('rp')}
    <button type="button" class="btn btn-sm btn-outline-secondary mb-3" id="gen"><i class="bx bx-refresh"></i> Buat password acak</button>
    <p class="small">Password lama langsung tidak berlaku. Sampaikan password baru ini ke operator yang bersangkutan.</p>
    <div class="d-flex justify-content-end gap-2">
      <button type="button" class="btn btn-outline-secondary" id="rx">Batal</button>
      <button class="btn btn-primary" id="rgo">Reset password</button></div></form>`;
  bindPair('rp');
  $('rx').onclick = () => d.close();
  $('gen').onclick = () => {
    const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $('rp1').value = $('rp2').value = Array.from(crypto.getRandomValues(new Uint32Array(12)), n => c[n % c.length]).join('');
    d.querySelectorAll('[data-eye]').forEach(b => setEye(b, true)); pairOk('rp');
  };
  $('rf').onsubmit = async e => {
    e.preventDefault();
    if (!pairOk('rp')) return $('rmsg').innerHTML = note(PW_ERR, 'warning');
    $('rgo').disabled = true; $('rmsg').innerHTML = '';
    try {
      await api({ action: 'reset-password' }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: r.id, password: $('rp1').value }) });
      d.close(); const am = document.getElementById('amsg'); if (am) am.innerHTML = note(`Password ${r.nama} berhasil direset.`, 'success'); return;
    } catch (er) { $('rgo').disabled = false; $('rmsg').innerHTML = note(er.message); }
  };
  d.showModal();
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
        <dt class="col-4">Role</dt><dd class="col-8">${esc(me.role)}</dd>
      </dl></div></div></div>
    <div class="col-lg-6"><div class="card"><div class="card-body">
      <h5 class="mb-3">Ubah password</h5><div id="pmsg"></div>
      <form id="pf">${pwPair('np')}
      <button class="btn btn-primary" id="pgo">Simpan password</button></form></div></div></div>
    ${me.role === 'admin' ? `<div class="col-12"><div class="card"><div class="card-body">
      <h5 class="mb-3">Daftar akun</h5><div id="amsg"></div><div class="table-responsive" id="acc">Memuat…</div></div></div></div>` : ''}
  </div>`;
  bindPair('np');
  $('pf').onsubmit = async e => {
    e.preventDefault();
    if (!pairOk('np')) return $('pmsg').innerHTML = note(PW_ERR, 'warning');
    $('pgo').disabled = true;
    const { error } = await sb.auth.updateUser({ password: $('np1').value });
    if (!live(ep)) return;
    $('pgo').disabled = false;
    $('pmsg').innerHTML = error ? note(errId(error)) : note('Password berhasil diubah.', 'success');
    if (!error) { $('pf').reset(); mask($('pf')); pairOk('np'); }
  };
  if (me.role === 'admin') {
    const { data } = await sb.rpc('akun_daftar');   // username = bagian email sebelum @ (auth.users tidak terbuka ke klien)
    const el = $('acc');
    if (el) el.innerHTML = `<table class="table table-hover"><thead><tr><th>Nama</th><th>Username</th><th>Instansi</th><th>Role</th><th class="text-end">Aksi</th></tr></thead><tbody>${
      (data || []).map(r => `<tr><td>${esc(r.nama)}</td><td><code>${esc(r.username)}</code></td><td>${esc(r.kua || '-')}</td><td><span class="badge bg-label-primary">${esc(r.role)}</span></td><td class="text-end">${r.role === 'operator' ? `<button class="btn btn-sm btn-outline-primary" data-reset="${esc(r.id)}"><i class="bx bx-key"></i> Reset password</button>` : ''}</td></tr>`).join('')
    }</tbody></table>`;
    if (el) el.onclick = e => { const b = e.target.closest('[data-reset]'); if (b) openReset((data || []).find(r => r.id === b.dataset.reset)); };
  }
}


// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { pengaturan: pagePengaturan });
