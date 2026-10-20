/* =====================================================================================
   app.js: pemicu saat halaman dimuat (dimuat PALING AKHIR)
   Judul/merek, Turnstile, login, logout, sidebar, dan hashchange. Semua fungsi lain sudah tersedia saat berkas ini berjalan.
   ===================================================================================== */

/* =================================================== */
document.title = `${CFG.nama} · Bimas Islam Indramayu`;   // judul tab dan logo mengikuti CFG.nama (mengganti nama cukup di sini)
document.querySelectorAll('.brand').forEach(b => { b.lastChild.textContent = ' ' + CFG.nama; });

window.tsReady = () => {
  wid = turnstile.render('#ts', { sitekey: CFG.turnstile, callback: t => token = t, 'expired-callback': () => token = null });
};
document.addEventListener('click', e => { const b = e.target.closest('[data-eye]'); if (b) setEye(b, $(b.dataset.eye).type === 'password'); });
$('dlg').onclose = () => { $('dlg').className = ''; $('dlg').replaceChildren(); };
$('vdlg').onclose = () => { if (vOff) vOff(); vOff = null; $('vdlg').className = ''; $('vdlg').replaceChildren(); };

$('f').onsubmit = async e => {
  e.preventDefault();
  if (!token) return $('msg').innerHTML = note('Selesaikan captcha terlebih dahulu.', 'warning');
  $('go').disabled = true; $('msg').innerHTML = '';
  const rem = $('rem').checked, user = $('un').value.trim();
  LS.setItem(RK, rem ? '1' : '0'); // harus diset sebelum login agar sesi masuk ke storage yang benar
  const { error } = await sb.auth.signInWithPassword({
    email: toEmail(user), password: $('pw').value, options: { captchaToken: token }
  });
  $('go').disabled = false;
  if (!error) { if (rem) LS.setItem(EK, user); else LS.removeItem(EK); }
  if (error) { $('msg').innerHTML = note('Login gagal: username atau password salah, atau captcha tidak valid.'); resetCaptcha(); }
};
// setTimeout menghindari deadlock pemanggilan Supabase di dalam callback auth
sb.auth.onAuthStateChange((ev, s) => { if (ev !== 'TOKEN_REFRESHED') setTimeout(() => boot(s), 0); });

$('out').onclick = () => sb.auth.signOut();
if (LS.getItem(SIDE_KEY) === 'off') document.body.classList.add('side-off');
$('burger').onclick = () => {
  if (wideScreen()) LS.setItem(SIDE_KEY, document.body.classList.toggle('side-off') ? 'off' : 'on');
  else $('side').classList.toggle('open');
  syncSide();
};
addEventListener('resize', syncSide); syncSide();
addEventListener('hashchange', route);

// ---- Pemeriksaan pemasangan: js/config.js masih berisi nilai contoh? ----
(() => {
  const kurang = [];
  if (!/^https:\/\/[a-z0-9]{10,}\.supabase\.co$/.test(CFG.url)) kurang.push('url (alamat Supabase)');
  if (!/^(sb_publishable_|eyJ)/.test(CFG.key)) kurang.push('key (publishable key Supabase)');
  if (!/^0x[0-9A-Za-z_-]+$/.test(CFG.turnstile)) kurang.push('turnstile (Site Key Cloudflare)');
  if (!kurang.length) return;
  const d = document.createElement('div');
  d.className = 'alert alert-danger m-3';
  d.style.cssText = 'position:fixed;z-index:3000;left:0;right:0;top:0';
  d.innerHTML = '<b>js/config.js belum lengkap:</b> ' + kurang.join(', ') + '. Lihat PANDUAN-INSTALASI.md (bagian "Isi js/config.js").';
  document.body.prepend(d);
})();
