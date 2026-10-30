/* =====================================================================================
   bop.js: menu BOP (RPD, Realisasi, Laporan, Anggaran, Verifikasi, Metode, SAKTI, Config, Impor Data Lama)
   Data di Supabase. Dimuat setelah core.js.
   Siapa yang boleh membuka halaman mana ditentukan menu di Hak Akses Menu (can() di core.js) dan DITEGAKKAN database (RLS/trigger di
   bop.sql). Kode di sini hanya menyesuaikan tampilan: Operator KUA selalu terikat ke KUA-nya sendiri, peran lain (pusat) melihat semua KUA.
   Hasil aksi (simpan, kirim, ubah status) dilaporkan lewat lapor()/jpToast() di core.js: catatan di halaman DAN pop-up paling depan.
   ===================================================================================== */

/* ====== Data master (cache di memori), format rupiah ====== */
const M = {};
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
async function master() {
  if (!M.pos) {
    const [k, p, c] = await Promise.all([
      sb.from('kua').select('id,nama_kua').order('nama_kua'),
      sb.from('pos').select('id,kode_pos,nama_pos,nama_rincian').order('urutan'),
      sb.from('config').select('key,value')
    ]);
    const err = k.error || p.error || c.error;
    if (err) throw err;
    M.kua = k.data; M.pos = p.data; M.cfg = Object.fromEntries(c.data.map(r => [r.key, r.value]));
  }
  return M;
}   // tanpa minus => tidak pernah negatif
const MAXD = 10;   // semua input nominal maksimal 10 digit (Rp 9.999.999.999); sama dengan nominal_max() di database
const fmtIn = el => {   // format 1.500.000 saat mengetik (maks. 10 digit), kursor tetap di tempatnya
  const d = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length;
  el.value = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAXD).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  let i = 0, c = 0;
  while (i < el.value.length && c < d) if (/\d/.test(el.value[i++])) c++;
  el.setSelectionRange(i, i);
};
const yearSel = (id, y) => `<select id="${id}" class="form-select" style="width:auto">${[y - 1, y, y + 1].map(v => `<option${v === y ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
// Peran pusat = semua peran selain Operator KUA (Admin, Bendahara BOP, Verifikator BOP, ...): memilih KUA atau melihat semua KUA.
const pusat = () => me.role !== 'operator';

/* ====== Anggaran (menu anggaran: bawaan hanya Admin) ====== */
async function pageAnggaran() {
  const ep = EP;
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3"><h4 class="mb-0 me-auto">Anggaran Tahunan</h4>${yearSel('ay', new Date().getFullYear())}</div>
    <div id="amsg"></div><div class="table-responsive" id="atab">Memuat…</div></div></div>`;
  const load = async () => {
    const t = +$('ay').value;
    let m, a;
    try { [m, a] = await Promise.all([master(), sb.rpc('anggaran_tahun', { p_tahun: t })]); if (a.error) throw a.error; }
    catch (e) { return live(ep) && ($('atab').innerHTML = note(e.message)); }
    if (!live(ep)) return;
    const set = a.data || {};   // { "<id KUA>": nominal }: di database seluruh anggaran satu tahun hanya 1 baris
    const n = m.kua.filter(k => set[k.id] != null).length, tot = m.kua.reduce((s, k) => s + (set[k.id] || 0), 0);
    $('atab').innerHTML = `<p class="mb-2"><b>${n}</b> dari ${m.kua.length} KUA sudah diset untuk ${t}. Total anggaran: <b>Rp ${rp(tot)}</b>.</p>
      <table class="table table-hover align-middle"><thead><tr><th>KUA</th><th>Status</th><th>Anggaran (Rp)</th></tr></thead><tbody>${m.kua.map(k => `<tr>
        <td>${esc(k.nama_kua)}</td>
        <td><span class="badge ${set[k.id] != null ? 'bg-label-primary' : 'bg-secondary'}">${set[k.id] != null ? 'Sudah diset' : 'Belum diset'}</span></td>
        <td><input class="form-control form-control-sm text-end" style="min-width:140px" inputmode="numeric" placeholder="0" data-k="${k.id}" value="${set[k.id] != null ? rp(set[k.id]) : ''}"></td>
        </tr>`).join('')}</tbody></table>
      <p class="small text-muted">Maksimal 10 digit per KUA. Mengosongkan kolom menghapus anggaran KUA itu (ditolak bila RPD-nya sudah diisi).</p>
      <button class="btn btn-primary" id="asave">Simpan Anggaran ${t}</button>`;
    $('atab').oninput = e => { if (e.target.dataset.k) fmtIn(e.target); };
    $('asave').onclick = async () => {
      const items = {};   // hanya KUA yang berubah; yang lain tidak tersentuh (digabung di server)
      $('atab').querySelectorAll('[data-k]').forEach(i => { const v = i.value.trim() ? num(i.value) : 0; if (v !== (set[i.dataset.k] || 0)) items[i.dataset.k] = v; });
      const c = Object.keys(items).length;
      if (!c) return lapor($('amsg'), 'Tidak ada perubahan untuk disimpan.', 'info');
      $('asave').disabled = true;
      const { error } = await sb.rpc('set_anggaran', { p_tahun: t, p_items: items });   // satu transaksi: gagal satu = batal semua
      if (!live(ep)) return;
      lapor($('amsg'), error ? error.message : `Anggaran ${t} tersimpan untuk ${c} KUA.`, error ? 'danger' : 'success');
      if (error) $('asave').disabled = false; else load();
    };
  };
  $('ay').onchange = () => { $('amsg').innerHTML = ''; load(); };
  load();
}

const ST = { waiting: ['bg-warning', 'Menunggu verifikasi'], approved: ['bg-info', 'Disetujui'], rejected: ['bg-danger', 'Ditolak'], paid: ['bg-success', 'Dibayar'] };
const sumT = a => a.reduce((s, x) => s + x.total, 0);
const isum = o => Object.values(o || {}).reduce((s, v) => s + v, 0);
const posLabel = p => `${p.kode_pos} · ${p.nama_rincian || p.nama_pos}`;   // kode akun + nama POS/rincian
/* ====== Pembayaran SAKTI: hanya Listrik dan Telepon/Internet. Ceklis GLOBAL per KUA + POS (tanpa bulan/tahun berlaku) dan
   nominal bulanan yang diinput petugas (Admin, atau peran bermenu Realisasi SAKTI) ====== */
const SAKTI_POS = ['522111', '522112'];   // Listrik dan Telepon/Internet: hanya POS ini yang dapat dibayar lewat SAKTI
const metodeOf = (vers, kid, pid) => vers.find(v => v.kua_id === kid && v.pos_id === pid)?.metode || 'MANUAL';   // belum diatur = MANUAL (sama dengan fungsi SQL metode_pos)
const saktiOf = (rs, b) => { const o = {}; rs.forEach(x => { if (x.bulan === b && x.nominal > 0) o[x.pos_id] = x.nominal; }); return o; };   // {pos_id: nominal} Realisasi SAKTI satu bulan
const saktiYear = (rs, pid) => rs.reduce((s, x) => s + (x.pos_id === pid ? x.nominal : 0), 0);
async function showDocs(el, ctx, opt = {}) {   // ctx = { kua, tahun, bulan }; opt = { del, onCount, side } (side = rincian Realisasi di kiri penampil)
  el.textContent = 'Memuat dokumen…';
  try {
    const { files } = await (await api({ action: 'list', ...ctx })).json();
    if (opt.onCount) opt.onCount(files.length);
    el.innerHTML = files.length ? `<ul class="list-unstyled mb-0">${files.map((f, i) => `<li class="d-flex align-items-center gap-2 mb-1"><i class="bx bx-file"></i><span class="me-auto text-break">${esc(f.name)}</span><button class="btn btn-sm btn-outline-primary" data-f="${i}">Lihat</button>${opt.del ? `<button class="btn btn-sm btn-outline-danger" data-x="${i}" aria-label="Hapus"><i class="bx bx-trash"></i></button>` : ''}</li>`).join('')}</ul>` : '<span class="small">Belum ada dokumen.</span>';
    el.onclick = async e => {
      const v = e.target.closest('[data-f]'), x = e.target.closest('[data-x]');
      if (v) return openViewer(files, +v.dataset.f, f => api({ action: 'file', ...ctx, id: f.id }), opt.side);
      if (!x || !confirm(`Hapus file "${files[+x.dataset.x].name}" dari Google Drive?`)) return;
      x.disabled = true;
      try { await api({ action: 'delete', ...ctx, id: files[+x.dataset.x].id }, { method: 'POST' }); showDocs(el, ctx, opt); jpToast('Dokumen dihapus dari Google Drive.', 'success'); }
      catch (er) { x.disabled = false; el.insertAdjacentHTML('beforeend', note(er.message)); jpToast(er.message, 'danger'); }
    };
  } catch (e) { el.innerHTML = note(e.message); if (opt.onCount) opt.onCount(null); }
}

// Rincian Realisasi per POS untuk panel kiri penampil dokumen, pembanding dengan isi dokumen LPJ.
// man = {id POS: nominal manual}, sak = {id POS: nominal SAKTI}, flagged = Set id POS yang dibayar lewat SAKTI (baris diwarnai biru).
function realisasiSide(judul, sub, pos, man, sak, flagged, rpdTotal) {
  const rows = pos.filter(p => man[p.id] > 0 || sak[p.id] > 0 || flagged.has(p.id)), tm = isum(man), ts = isum(sak);
  return `<div class="fw-semibold">${esc(judul)}</div><div class="small mb-2">${esc(sub)}</div>
    <table class="table table-sm align-middle mb-2"><thead><tr><th>POS</th><th class="text-end">Realisasi (Rp)</th></tr></thead><tbody>${rows.length ? rows.map(p => {
      const s = flagged.has(p.id), v = (man[p.id] || 0) + (sak[p.id] || 0);
      return `<tr${s ? ' class="table-info"' : ''}><td>${esc(posLabel(p))}${s ? ' <span class="badge bg-label-primary">SAKTI</span>' : ''}</td><td class="text-end">${v ? rp(v) : '-'}</td></tr>`; }).join('')
      : '<tr><td colspan="2" class="small">Belum ada nominal.</td></tr>'}</tbody>
      <tfoot><tr class="fw-semibold"><td>Total</td><td class="text-end">${rp(tm + ts)}</td></tr></tfoot></table>
    <div class="small">Manual: <b>Rp ${rp(tm)}</b>${flagged.size || ts ? `<br>SAKTI: <b>Rp ${rp(ts)}</b>` : ''}${rpdTotal != null ? `<br>RPD bulan ini: <b>Rp ${rp(rpdTotal)}</b>` : ''}</div>
    ${rows.some(p => flagged.has(p.id)) ? '<div class="small mt-2">Baris biru: dibayar lewat SAKTI.</div>' : ''}`;
}

/* ====== RPD: daftar dulu (peran pusat: filter semua kecamatan), Detail membuka rincian per POS. 1 record = 1 bulan.
   Admin mengubah RPD kapan saja; Operator KUA hanya KUA-nya selama pengisian RPD dibuka (Config); peran pusat lain (Bendahara/Verifikator
   BOP) hanya MELIHAT, sama dengan aturan database (policy rpd_write) ====== */
async function pageRpd() {
  const ep = EP, admin = me.role === 'admin', pu = pusat(), ro = pu && !admin, y = new Date().getFullYear();
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  if (!pu && !me.kua_id) return $('view').innerHTML = note('Akun ini belum terhubung ke KUA. Hubungi admin.', 'warning');
  $('view').innerHTML = `<div class="card"><div class="card-body"><h4 class="mb-3">RPD</h4>
    <div class="d-flex flex-wrap gap-2 mb-3">${pu ? `<select id="rk" class="form-select" style="width:auto" aria-label="Kecamatan"><option value="0">Semua Kecamatan</option>${m.kua.map(k => `<option value="${k.id}">${esc(k.nama_kua)}</option>`).join('')}</select>` : ''}${yearSel('ry', y)}</div>
    <div id="xmsg"></div><div id="rbody">Memuat…</div></div></div>`;
  let rows = [], ang = {}, cap = null, t, kid;   // ang = { "<id KUA>": anggaran }
  const listAll = () => {   // admin: semua kecamatan sekaligus
    const A = ang, R = {};
    rows.forEach(r => R[r.kua_id] = (R[r.kua_id] || 0) + r.total);
    const ta = Object.values(ang).reduce((s, v) => s + v, 0), tr = sumT(rows);
    $('rbody').oninput = null;
    $('rbody').innerHTML = `<div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>Kecamatan</th><th class="text-end">Anggaran (Rp)</th><th class="text-end">Total RPD (Rp)</th><th class="text-end">Sisa (Rp)</th><th></th></tr></thead><tbody>${m.kua.map(k => `<tr><td>${esc(k.nama_kua)}</td><td class="text-end">${A[k.id] != null ? rp(A[k.id]) : '<span class="badge bg-secondary">Belum diset</span>'}</td><td class="text-end">${rp(R[k.id])}</td><td class="text-end">${A[k.id] != null ? rp(A[k.id] - (R[k.id] || 0)) : '-'}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-k="${k.id}">Detail</button></td></tr>`).join('')}</tbody>
      <tfoot><tr class="fw-semibold"><td>Total ${t}</td><td class="text-end">${rp(ta)}</td><td class="text-end">${rp(tr)}</td><td class="text-end">${rp(ta - tr)}</td><td></td></tr></tfoot></table></div>`;
    $('rbody').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { $('rk').value = b.dataset.k; load(); } };
  };
  const list = () => {   // satu kecamatan: 12 bulan
    const tot = sumT(rows);
    $('rbody').oninput = null;
    $('rbody').innerHTML = `${pu ? '<button class="btn btn-sm btn-outline-secondary mb-3" id="rall"><i class="bx bx-arrow-back"></i> Semua kecamatan</button>' : ''}
      <div class="alert alert-primary py-2">Anggaran Tahunan ${t}: <b>${cap == null ? 'belum ditetapkan' : 'Rp ' + rp(cap)}</b> · Total RPD: <b>Rp ${rp(tot)}</b> · Sisa: <b>Rp ${rp((cap ?? 0) - tot)}</b></div>
      <div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>Bulan</th><th class="text-end">Total RPD (Rp)</th><th></th></tr></thead><tbody>${BULAN.map((n, i) => `<tr><td>${n}</td><td class="text-end">${rp(rows.find(x => x.bulan === i + 1)?.total)}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-b="${i + 1}">Detail</button></td></tr>`).join('')}</tbody>
      <tfoot><tr class="fw-semibold"><td>Total ${t}</td><td class="text-end">${rp(tot)}</td><td></td></tr></tfoot></table></div>`;
    if (pu) $('rall').onclick = () => { $('rk').value = 0; load(); };
    $('rbody').onclick = e => { const b = e.target.closest('[data-b]'); if (b) detail(+b.dataset.b); };
  };
  const detail = b => {
    const locked = ro || (!admin && !(m.cfg.rpd_enabled === true && (m.cfg.bulan_edit_rpd || []).includes(b)));
    const cur = rows.find(x => x.bulan === b)?.items || {};
    $('rbody').innerHTML = `<button class="btn btn-sm btn-outline-secondary mb-3" id="rback"><i class="bx bx-arrow-back"></i> Kembali</button>
      <h5 class="mb-3">RPD ${BULAN[b - 1]} ${t}${pu ? ' · ' + esc(m.kua.find(k => k.id === kid).nama_kua) : ''}</h5><div id="rsum"></div>
      ${ro ? note('Peran Anda hanya dapat melihat RPD. RPD diisi oleh Operator KUA atau Admin.', 'info') : locked ? note('Pengisian RPD untuk bulan ini ditutup. Hubungi admin bila perlu perubahan.', 'warning') : ''}
      <div class="table-responsive"><table class="table align-middle"><tbody>${m.pos.map(p => `<tr>
        <td>${esc(posLabel(p))}${p.nama_rincian ? `<div class="small">${esc(p.nama_pos)}</div>` : ''}</td>
        <td style="width:190px"><input class="form-control text-end" inputmode="numeric" placeholder="0" data-p="${p.id}" value="${cur[p.id] ? rp(cur[p.id]) : ''}"${locked ? ' disabled' : ''}></td></tr>`).join('')}</tbody>
        <tfoot><tr class="fw-semibold"><td>Total RPD ${BULAN[b - 1]}</td><td class="text-end" id="rtot"></td></tr></tfoot></table></div>
      ${ro ? '' : `<button class="btn btn-primary" id="rsave">Simpan RPD ${BULAN[b - 1]}</button>`}`;
    const calc = () => {
      const others = sumT(rows.filter(x => x.bulan !== b)), mine = [...$('rbody').querySelectorAll('[data-p]')].reduce((s, i) => s + num(i.value), 0);
      const total = others + mine, sisa = (cap ?? 0) - total, over = cap == null || sisa < 0;
      $('rtot').textContent = 'Rp ' + rp(mine);
      $('rsum').className = 'alert py-2 ' + (over ? 'alert-danger' : 'alert-primary');
      $('rsum').innerHTML = cap == null ? `Anggaran Tahunan ${t} belum ditetapkan admin, jadi RPD belum bisa diisi.`
        : `Total RPD ${t}: <b>Rp ${rp(total)}</b> · Anggaran: <b>Rp ${rp(cap)}</b> · Sisa: <b>Rp ${rp(sisa)}</b>` +
          (sisa < 0 ? `<br>Melebihi anggaran Rp ${rp(-sisa)}. Batas Rp ${rp(cap)}; bulan lain Rp ${rp(others)}; bulan ini yang diisi Rp ${rp(mine)}. Kurangi isian bulan ini.` : '');
      if ($('rsave')) $('rsave').disabled = locked || over;
      return over;
    };
    $('rback').onclick = list;
    $('rbody').onclick = null;
    $('rbody').oninput = e => { if (e.target.dataset.p) { fmtIn(e.target); calc(); } };
    if ($('rsave')) $('rsave').onclick = async () => {
      if (calc()) return;
      const items = {};
      $('rbody').querySelectorAll('[data-p]').forEach(i => { const v = num(i.value); if (v > 0) items[i.dataset.p] = v; });
      $('rsave').disabled = true;
      const { error } = await sb.from('rpd').upsert({ kua_id: kid, tahun: t, bulan: b, items }, { onConflict: 'kua_id,tahun,bulan' }); if (!live(ep)) return;   // 1 bulan = 1 record
      lapor($('xmsg'), error ? error.message : `RPD ${BULAN[b - 1]} ${t} tersimpan.`, error ? 'danger' : 'success');
      if (!error) rows = rows.filter(x => x.bulan !== b).concat({ kua_id: kid, bulan: b, items, total: isum(items) });
      calc();
    };
    calc();
  };
  const load = async () => {
    t = +$('ry').value; kid = pu ? +$('rk').value : me.kua_id;
    $('rbody').textContent = 'Memuat…';
    const qr = sb.from('rpd').select('kua_id,bulan,items,total').eq('tahun', t);
    const [a, r] = await Promise.all([sb.rpc('anggaran_tahun', { p_tahun: t }), kid ? qr.eq('kua_id', kid) : qr]);   // anggaran 1 baris per tahun; operator hanya menerima KUA-nya
    if (!live(ep)) return;
    if (a.error || r.error) return $('rbody').innerHTML = note((a.error || r.error).message);
    ang = a.data || {}; rows = r.data; cap = kid ? (ang[kid] ?? null) : null;
    kid ? list() : listAll();
  };
  ['ry', 'rk'].forEach(id => { if ($(id)) $(id).onchange = () => { $('xmsg').innerHTML = ''; load(); }; });
  load();
}

/* ====== Realisasi (Operator KUA): daftar bulan dulu. Hanya yang belum diisi / ditolak yang bisa diedit ======
   Batas RPD (sama dengan realisasi_guard di bop.sql): (1) total sebulan (manual + SAKTI) <= RPD bulan itu; (2) tiap POS setahun
   (manual + SAKTI) <= RPD POS itu setahun. Realisasi SAKTI sudah dibayar dan boleh melampaui RPD (diinput petugas); selama sebuah POS
   melebihi RPD setahun, Realisasi baru TIDAK dapat dikirim (tombol Kirim nonaktif) dan kelebihannya ditampilkan di daftar dan detail. */
async function pageRealisasi() {
  const ep = EP, now = new Date();
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  if (!me.kua_id) return $('view').innerHTML = note('Akun ini belum terhubung ke KUA. Hubungi admin.', 'warning');
  $('view').innerHTML = `<div class="card"><div class="card-body"><h4 class="mb-3">Realisasi</h4>
    <div class="d-flex flex-wrap gap-2 mb-3">${yearSel('lt', now.getFullYear())}<select id="lm" class="form-select" style="width:auto" aria-label="Bulan"><option value="0">Semua bulan</option>${BULAN.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('')}</select></div><div id="lmsg"></div><div id="lbody">Memuat…</div></div></div>`;
  let rpd = [], rl = [], vers = null, rs = [], t;   // vers = metode pembayaran KUA ini; rs = Realisasi SAKTI tahun terpilih
  const rec = b => rl.find(x => x.bulan === b), rpdOf = b => rpd.find(x => x.bulan === b);
  // POS yang Realisasi setahunnya (manual semua bulan + SAKTI) sudah melebihi RPD setahun. Kosong = tidak ada kelebihan.
  const lebihTahun = () => m.pos.map(p => {
    const cap = rpd.reduce((s, x) => s + (x.items[p.id] || 0), 0), man = rl.reduce((s, x) => s + (x.items[p.id] || 0), 0), sak = saktiYear(rs, p.id);
    return { p, cap, man, sak, lebih: man + sak - cap };
  }).filter(x => x.lebih > 0);
  const bannerLebih = () => {
    const L = lebihTahun();
    if (!L.length) return '';
    return `<div class="alert alert-danger py-2" role="alert"><b>Realisasi ${t} sudah melebihi RPD setahun, jadi Realisasi baru belum dapat dikirim.</b><ul class="mb-1">${L.map(x =>
      `<li>${esc(posLabel(x.p))}: terpakai Rp ${rp(x.man + x.sak)} (manual Rp ${rp(x.man)}${x.sak ? ` + SAKTI Rp ${rp(x.sak)}` : ''}) dari RPD setahun Rp ${rp(x.cap)}; <b>kelebihan Rp ${rp(x.lebih)}</b></li>`).join('')}</ul>
      <span class="small">${L.some(x => x.sak) ? 'Realisasi SAKTI sudah dibayar sehingga tidak dapat diubah operator. ' : ''}Tombol Kirim terbuka lagi setelah RPD POS tersebut ditambah (menu RPD, bila pengisian RPD dibuka) atau dihubungi admin.</span></div>`;
  };
  const list = () => {
    let ta = 0; const ms = +$('lm').value;   // filter bulan (0 = semua)
    $('lbody').oninput = null;
    $('lbody').innerHTML = bannerLebih() + `<div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>Bulan</th><th class="text-end">RPD (Rp)</th><th class="text-end">Realisasi (Rp)</th><th>Status</th><th></th></tr></thead><tbody>${BULAN.map((n, i) => {
        if (ms && ms !== i + 1) return '';
        const b = i + 1, r = rec(b), st = r ? ST[r.status] : ['bg-secondary', 'Belum diisi'], au = isum(saktiOf(rs, b)); ta += au;
        return `<tr><td>${n}</td><td class="text-end">${rp(rpdOf(b)?.total)}</td><td class="text-end">${rp((r?.total || 0) + au)}</td><td><span class="badge ${st[0]}">${st[1]}</span>${r?.status === 'paid' && r.nominal_dibayar ? `<div class="small">Rp ${rp(r.nominal_dibayar)}</div>` : ''}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-b="${b}">Detail</button></td></tr>`; }).join('')}</tbody>
      <tfoot><tr class="fw-semibold"><td>Total ${ms ? BULAN[ms - 1] + ' ' : ''}${t}</td><td class="text-end">${rp(sumT(rpd.filter(x => !ms || x.bulan === ms)))}</td><td class="text-end">${rp(sumT(rl.filter(x => !ms || x.bulan === ms)) + ta)}</td><td colspan="2"></td></tr></tfoot></table></div>`;
    $('lbody').onclick = e => { const b = e.target.closest('[data-b]'); if (b) detail(+b.dataset.b); };
  };
  const detail = b => {
    const r = rec(b), au = saktiOf(rs, b), mt = Object.fromEntries(m.pos.map(p => [p.id, metodeOf(vers, me.kua_id, p.id)])), cur = r ? r.items : {}, ri = rpdOf(b)?.items || {}, lpj = r?.file_lpj_url || '';
    const open = m.cfg.realisasi_enabled === true, okDate = now >= new Date(t, b - 1, 10), canRec = !r || r.status === 'rejected', edit = open && canRec, send = edit && okDate;   // send = boleh unggah dokumen dan mengirim
    let nDocs = lpj ? null : 0, upl = '';   // jumlah dokumen LPJ di Drive; upl = folder yang baru diunggah pada sesi ini
    $('lbody').innerHTML = `<button class="btn btn-sm btn-outline-secondary mb-3" id="lback"><i class="bx bx-arrow-back"></i> Kembali</button>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3"><h5 class="mb-0 me-auto">Realisasi ${BULAN[b - 1]} ${t}</h5>${r ? `<span class="badge ${ST[r.status][0]}">${ST[r.status][1]}</span>` : ''}${r?.status === 'paid' && r.nominal_dibayar ? `<span class="small">Dibayar <b>Rp ${rp(r.nominal_dibayar)}</b></span>` : ''}</div>
      <div id="lsum" class="alert alert-primary py-2"></div>
      ${r && r.status === 'rejected' ? note('Ditolak' + (r.catatan_admin ? ': ' + r.catatan_admin : '') + '. Perbaiki nominal atau dokumen LPJ, lalu kirim ulang.', 'danger') : ''}
      ${r && r.status !== 'rejected' ? note(`Realisasi berstatus ${ST[r.status][1]} dan tidak dapat diubah. Hanya Realisasi yang ditolak yang dapat diperbaiki.`, 'info') : ''}
      ${open ? '' : note('Pengisian Realisasi sedang ditutup oleh admin.', 'warning')}
      ${edit && !okDate ? note(`Realisasi ${BULAN[b - 1]} ${t} baru dapat disubmit mulai 10 ${BULAN[b - 1]} ${t}.`, 'info') : ''}
      <div id="lerr"></div>
      <div class="table-responsive"><table class="table align-middle"><thead><tr><th>POS</th><th class="text-end">RPD bulan ini (Rp)</th><th style="width:190px">Realisasi (Rp)</th><th class="text-end">Sisa anggaran POS</th></tr></thead><tbody>${m.pos.map(p => {
        const S = mt[p.id] === 'SAKTI', a = S ? (au[p.id] || 0) : 0, old = S ? (cur[p.id] || 0) : 0, ro = !edit || S;   // old = nilai manual lama yang dipertahankan
        return `<tr><td>${esc(posLabel(p))}${p.nama_rincian ? `<div class="small">${esc(p.nama_pos)}</div>` : ''}</td>
          <td class="text-end">${rp(ri[p.id])}</td>
          <td><input class="form-control text-end" inputmode="numeric" placeholder="0" data-p="${p.id}" value="${S ? (a || old ? rp(a || old) : '') : cur[p.id] ? rp(cur[p.id]) : ''}"${ro ? ' disabled' : ''}>${S ? (a ? '<div class="small mt-1"><span class="badge bg-success">Sudah dibayar SAKTI</span></div>' : old ? '<div class="small mt-1"><span class="badge bg-label-primary">SAKTI</span> nilai sebelumnya dipertahankan</div>' : '<div class="small mt-1"><span class="badge bg-warning">Belum dibayar SAKTI</span></div>') : ''}</td>
          <td class="text-end"><b id="sisa${p.id}"></b></td></tr>`; }).join('')}</tbody>
        <tfoot><tr class="fw-semibold"><td>Total</td><td class="text-end" id="trpd"></td><td class="text-end" id="treal"></td><td></td></tr></tfoot></table></div>
      <div class="mb-3"><div class="fw-semibold mb-1">Dokumen LPJ</div><div id="ldocs"><span class="small">Belum ada dokumen.</span></div></div>
      ${canRec ? `<label class="form-label" for="lfile">${lpj ? 'Tambah file LPJ' : 'Unggah file LPJ <span class="text-danger">(wajib)</span>'}</label>
        <input id="lfile" type="file" class="form-control mb-1" multiple accept=".pdf,.jpg,.jpeg,.png"${send ? '' : ' disabled'}>
        <div class="form-text mb-3">PDF, JPG, atau PNG. Maksimal ${m.cfg.max_file_count ?? 3} file per bulan, masing-masing ${m.cfg.max_file_size_mb ?? 5} MB.</div>
        <button class="btn btn-primary" id="lsave"${send ? '' : ' disabled'}>Kirim Realisasi ${BULAN[b - 1]}</button>
        <div id="lblock" class="small text-danger mt-2" aria-live="polite"></div>` : ''}`;
    const side = () => {   // pembanding di samping dokumen: nilai yang SEDANG diisi di form (belum tentu tersimpan) + nominal SAKTI
      const man = {}, sak = {}, flagged = new Set();
      m.pos.forEach(p => { if (mt[p.id] === 'SAKTI') { flagged.add(p.id); if (au[p.id]) sak[p.id] = au[p.id]; if (cur[p.id]) man[p.id] = cur[p.id]; } });
      $('lbody').querySelectorAll('[data-p]').forEach(i => { const pid = +i.dataset.p, v = num(i.value); if (mt[pid] !== 'SAKTI' && v > 0) man[pid] = v; });
      return realisasiSide(`Realisasi ${BULAN[b - 1]} ${t}`, me.kua || '', m.pos, man, sak, flagged, rpdOf(b)?.total || 0);
    };
    if (lpj) showDocs($('ldocs'), { kua: me.kua_id, tahun: t, bulan: b }, { del: edit, onCount: n => nDocs = n, side });
    const calc = () => {
      const inp = [...$('lbody').querySelectorAll('[data-p]')], errs = [], aTot = isum(au), rpdBln = rpdOf(b)?.total || 0;
      let man = 0, sakLebih = false;
      inp.forEach(i => {
        const pid = +i.dataset.p, p = m.pos.find(x => x.id === pid), v = mt[pid] === 'SAKTI' ? (cur[pid] || 0) : num(i.value); man += v;
        // SEMUA POS diperiksa (juga yang tidak diisi bulan ini), sama dengan database: POS yang sudah melebihi RPD setahun karena
        // Realisasi SAKTI menutup pengiriman Realisasi bulan apa pun.
        const cap = rpd.reduce((s, x) => s + (x.items[pid] || 0), 0), oth = rl.filter(x => x.bulan !== b).reduce((s, x) => s + (x.items[pid] || 0), 0), sak = saktiYear(rs, pid);
        const used = oth + sak, sisa = cap - used - v;
        $('sisa' + pid).textContent = 'Rp ' + rp(sisa); $('sisa' + pid).className = sisa < 0 ? 'text-danger' : '';
        if (sisa < 0) {
          if (sak) sakLebih = true;
          errs.push(`${posLabel(p)}: melebihi RPD setahun. RPD setahun Rp ${rp(cap)}; terpakai Rp ${rp(used)} (bulan lain Rp ${rp(oth)}${sak ? ` + SAKTI Rp ${rp(sak)}` : ''}); bulan ini Rp ${rp(v)}; kelebihan Rp ${rp(-sisa)}.`);
        }
      });
      if (man + aTot > rpdBln) {
        if (aTot) sakLebih = true;
        errs.push(`Total Realisasi ${BULAN[b - 1]} Rp ${rp(man + aTot)}${aTot ? ` (manual Rp ${rp(man)} + SAKTI Rp ${rp(aTot)})` : ''} melebihi RPD bulan ini Rp ${rp(rpdBln)}; kelebihan Rp ${rp(man + aTot - rpdBln)}.`);
      }
      $('trpd').textContent = rp(rpdBln); $('treal').textContent = rp(man + aTot);
      $('lsum').innerHTML = `RPD ${BULAN[b - 1]}: <b>Rp ${rp(rpdBln)}</b> · Realisasi: <b>Rp ${rp(man + aTot)}</b> · Sisa RPD bulan ini: <b>Rp ${rp(rpdBln - man - aTot)}</b>`;
      // Rincian kelebihan hanya untuk bulan yang masih bisa dikirim/diperbaiki; bulan yang sudah terkunci cukup keterangan statusnya.
      $('lerr').innerHTML = errs.length && canRec ? `<div class="alert alert-danger py-2" role="alert">${errs.map(esc).join('<br>')}${
        sakLebih ? '<div class="small mt-1">Realisasi SAKTI sudah dibayar dan tidak dapat diubah operator. Tambah RPD terkait (menu RPD, bila pengisian RPD dibuka) atau hubungi admin.</div>' : ''}</div>` : '';
      const kunci = errs.length > 0;
      if ($('lsave')) {
        $('lsave').disabled = kunci || !send || !inp.some(i => !i.disabled);
        $('lsave').title = kunci ? 'Realisasi melebihi RPD: lihat keterangan di atas.' : '';
        $('lblock').textContent = kunci && send ? 'Kirim dinonaktifkan: Realisasi melebihi RPD (lihat keterangan merah di atas).' : '';
      }
      return kunci;
    };
    $('lback').onclick = list;
    $('lbody').onclick = null;
    $('lbody').oninput = e => { if (e.target.dataset.p) { fmtIn(e.target); calc(); } };
    if ($('lsave')) $('lsave').onclick = async () => {
      if (calc()) return;
      const files = [...$('lfile').files], warn = txt => lapor($('lmsg'), txt, 'warning'), items = {};
      $('lbody').querySelectorAll('[data-p]:not([disabled])').forEach(i => { const v = num(i.value); if (v > 0) items[i.dataset.p] = v; });
      const maxMb = m.cfg.max_file_size_mb ?? 5, maxN = m.cfg.max_file_count ?? 3, bad = files.find(f => f.size > maxMb * 1048576 || !/\.(pdf|jpe?g|png)$/i.test(f.name));
      if (!Object.keys(items).length) return warn('Belum ada nominal yang diisi.');
      if (files.length > maxN) return warn(`Maksimal ${maxN} file per bulan.`);
      if (bad) return warn(`${bad.name}: hanya PDF, JPG, atau PNG dan maksimal ${maxMb} MB.`);
      if (nDocs === null && !files.length) return warn('Dokumen LPJ masih dimuat. Coba lagi sebentar.');
      if (!(nDocs > 0) && !files.length) return warn('LPJ wajib dilampirkan: unggah minimal satu file.');
      $('lsave').disabled = true;
      let url = upl || lpj || null;
      if (files.length) {
        $('lmsg').innerHTML = note('Mengunggah dokumen LPJ…', 'info');
        const fd = new FormData(); fd.append('tahun', t); fd.append('bulan', b); files.forEach(f => fd.append('files', f));
        try { const j = await (await api({ action: 'upload' }, { method: 'POST', body: fd })).json(); url = upl = j.folderUrl; nDocs = j.total; $('lfile').value = ''; }
        catch (e) { if (!live(ep)) return; lapor($('lmsg'), e.message, 'danger'); return calc(); }
        if (!live(ep)) return;
      }
      const { error } = await sb.from('realisasi').upsert({ kua_id: me.kua_id, tahun: t, bulan: b, items, file_lpj_url: url }, { onConflict: 'kua_id,tahun,bulan' });   // 1 bulan = 1 record
      if (!live(ep)) return;
      if (error) { lapor($('lmsg'), error.message, 'danger'); return calc(); }
      lapor($('lmsg'), 'Realisasi terkirim dan menunggu verifikasi. Selama menunggu, nominal dan dokumen tidak dapat diubah.', 'success');
      await load(b);
    };
    calc();
  };
  const load = async b => {
    t = +$('lt').value;
    const [p, r, c, sk] = await Promise.all([
      sb.from('rpd').select('bulan,items,total').eq('kua_id', me.kua_id).eq('tahun', t),
      sb.from('realisasi').select('bulan,items,total,status,catatan_admin,file_lpj_url,nominal_dibayar').eq('kua_id', me.kua_id).eq('tahun', t),
      vers ? { data: vers } : sb.from('metode_pembayaran').select('kua_id,pos_id,metode').eq('kua_id', me.kua_id),   // pengaturan SAKTI cukup dimuat sekali
      sb.from('realisasi_sakti').select('pos_id,bulan,nominal').eq('kua_id', me.kua_id).eq('tahun', t)
    ]);
    if (!live(ep)) return;
    const err = p.error || r.error || c.error || sk.error;
    if (err) return $('lbody').innerHTML = note(err.message);
    rpd = p.data; rl = r.data; vers = c.data; rs = sk.data; b ? detail(b) : list();
  };
  $('lm').onchange = () => list();
  $('lt').onchange = () => { $('lmsg').innerHTML = ''; $('lbody').textContent = 'Memuat…'; load(); };
  load();
}

/* ====== Verifikasi (menu verifikasi: Admin, Bendahara BOP, Verifikator BOP): filter kecamatan/tahun/status, tabel dulu,
   Detail = POS + dokumen + ubah status. Tidak dapat mengubah nominal atau dokumen LPJ (dijaga database) ====== */
async function pageVerifikasi() {
  const ep = EP;
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  $('view').innerHTML = `<div class="card"><div class="card-body"><h4 class="mb-3">Verifikasi Realisasi</h4>
    <div class="d-flex flex-wrap gap-2 mb-3">
      <select id="vk" class="form-select" style="width:auto" aria-label="Kecamatan"><option value="0">Semua Kecamatan</option>${m.kua.map(k => `<option value="${k.id}">${esc(k.nama_kua)}</option>`).join('')}</select>
      ${yearSel('vy', new Date().getFullYear())}
      <select id="vb" class="form-select" style="width:auto" aria-label="Bulan"><option value="0">Semua bulan</option>${BULAN.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('')}</select>
      <select id="vs" class="form-select" style="width:auto" aria-label="Status"><option value="">Semua status</option>${Object.entries(ST).map(([k, v]) => `<option value="${k}"${k === 'waiting' ? ' selected' : ''}>${v[1]}</option>`).join('')}</select></div>
    <div id="vmsg"></div><div id="vbody">Memuat…</div></div></div>`;
  let G = [], sortK = '', sortD = 1;   // pengurutan: klik judul kolom (naik), klik lagi (turun), klik lagi (urutan awal)
  const kn = id => m.kua.find(k => k.id === id)?.nama_kua || id;
  const SK = { kua: f => kn(f.kua_id), periode: f => f.tahun * 100 + f.bulan, total: f => f.total, status: f => Object.keys(ST).indexOf(f.status) };
  const cmp = (a, c) => { const x = SK[sortK](G[a]), y = SK[sortK](G[c]), d = typeof x === 'string' ? x.localeCompare(y, 'id') : x - y; return d * sortD || a - c; };
  const th = (k, label, cls = '') => `<th class="${cls}" role="button" tabindex="0" data-s="${k}" style="cursor:pointer;white-space:nowrap;user-select:none" aria-sort="${sortK === k ? (sortD > 0 ? 'ascending' : 'descending') : 'none'}">${label} <i class="bx ${sortK === k ? (sortD > 0 ? 'bx-sort-up' : 'bx-sort-down') : 'bx-sort-alt-2 text-muted'}"></i></th>`;
  const sortBy = k => { if (sortK === k && sortD < 0) { sortK = ''; sortD = 1; } else { sortD = sortK === k ? -1 : 1; sortK = k; } list(); };
  const list = () => {
    const ord = G.map((_, i) => i); if (sortK) ord.sort(cmp);   // data-i tetap menunjuk indeks asli, jadi Detail selalu membuka baris yang benar
    $('vbody').innerHTML = G.length ? `<div class="table-responsive"><table class="table table-hover align-middle"><thead><tr>${th('kua', 'Kecamatan')}${th('periode', 'Periode')}${th('total', 'Total (Rp)', 'text-end')}${th('status', 'Status')}<th></th></tr></thead><tbody>${ord.map(i => { const f = G[i]; return `<tr><td>${esc(kn(f.kua_id))}</td><td>${BULAN[f.bulan - 1]} ${f.tahun}</td><td class="text-end">${rp(f.total)}</td><td><span class="badge ${ST[f.status][0]}">${ST[f.status][1]}</span>${f.status === 'paid' ? `<div class="small">${f.nominal_dibayar ? 'Rp ' + rp(f.nominal_dibayar) : 'nominal belum dicatat'}</div>` : ''}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-i="${i}">Detail</button></td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="mb-0">Tidak ada Realisasi untuk filter ini.</p>';
    $('vbody').onclick = e => { const s = e.target.closest('[data-s]'); if (s) return sortBy(s.dataset.s); const b = e.target.closest('[data-i]'); if (b) detail(+b.dataset.i); };
    $('vbody').onkeydown = e => { const s = e.target.closest('[data-s]'); if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortBy(s.dataset.s); } };
  };
  const detail = async i => {
    const f = G[i];
    $('vbody').onclick = null; $('vbody').onkeydown = null; $('vbody').textContent = 'Memuat…';
    const [rr, rk, rm] = await Promise.all([
      sb.from('rpd').select('items').eq('kua_id', f.kua_id).eq('tahun', f.tahun).eq('bulan', f.bulan).maybeSingle(),
      sb.from('realisasi_sakti').select('pos_id,nominal').eq('kua_id', f.kua_id).eq('tahun', f.tahun).eq('bulan', f.bulan).gt('nominal', 0),
      sb.from('metode_pembayaran').select('pos_id,metode').eq('kua_id', f.kua_id)]);
    if (!live(ep)) return;
    const ri = rr.data?.items || {}, sk = Object.fromEntries((rk.data || []).map(x => [x.pos_id, x.nominal])), sakti = isum(sk);   // sk = Realisasi SAKTI bulan ini per POS (diinput Admin)
    const flagged = new Set((rm.data || []).filter(x => x.metode === 'SAKTI').map(x => x.pos_id));   // POS yang dibayar lewat SAKTI
    Object.keys(sk).forEach(k => flagged.add(+k));
    const rowsPos = m.pos.filter(p => f.items[p.id] || ri[p.id] || sk[p.id]), anySak = rowsPos.some(p => flagged.has(p.id));
    $('vbody').innerHTML = `<button class="btn btn-sm btn-outline-secondary mb-3" id="vback"><i class="bx bx-arrow-back"></i> Kembali</button>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3"><h5 class="mb-0 me-auto">${esc(kn(f.kua_id))} · ${BULAN[f.bulan - 1]} ${f.tahun}</h5><span class="badge ${ST[f.status][0]}">${ST[f.status][1]}</span>${f.status === 'paid' ? `<span class="small">Dibayar <b>${f.nominal_dibayar ? 'Rp ' + rp(f.nominal_dibayar) : '(nominal belum dicatat)'}</b></span>` : ''}</div>
      ${f.status === 'rejected' && f.catatan_admin ? note('Alasan penolakan: ' + f.catatan_admin, 'danger') : ''}
      <div class="table-responsive"><table class="table align-middle mb-2"><thead><tr><th>POS</th><th class="text-end">RPD bulan ini (Rp)</th><th class="text-end">Realisasi (Rp)</th></tr></thead><tbody>${rowsPos.map(p => { const s = flagged.has(p.id);
          return `<tr${s ? ' class="table-info"' : ''}><td>${esc(posLabel(p))}${s ? ' <span class="badge bg-label-primary">SAKTI</span>' : ''}</td><td class="text-end">${rp(ri[p.id])}</td><td class="text-end">${rp((f.items[p.id] || 0) + (sk[p.id] || 0))}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr class="fw-semibold"><td>Total</td><td class="text-end">${rp(isum(ri))}</td><td class="text-end">${rp(f.total + sakti)}</td></tr></tfoot></table></div>
      ${anySak ? '<div class="small mb-2"><span class="badge" style="background:#cff4fc;color:#055160;border:1px solid #9eeaf9">Biru</span> = POS dibayar lewat SAKTI (nominal diinput petugas SAKTI, bukan diajukan operator).</div>' : ''}
      <p class="small mb-3">Realisasi Manual (operator): <b>Rp ${rp(f.total)}</b> · Realisasi SAKTI (diinput petugas SAKTI): <b>Rp ${rp(sakti)}</b> · Total Realisasi (Manual + SAKTI): <b>Rp ${rp(f.total + sakti)}</b> · RPD bulan ini: <b>Rp ${rp(isum(ri))}</b></p>
      <div class="fw-semibold mb-1">Dokumen LPJ</div><div id="vdocs" class="mb-3"></div>
      <div class="border rounded p-3"><div class="fw-semibold mb-2">Ubah status</div>
        <select id="vst" class="form-select mb-2" style="max-width:260px">${Object.entries(ST).map(([k, v]) => `<option value="${k}"${k === f.status ? ' selected' : ''}>${v[1]}</option>`).join('')}</select>
        <div id="vpaidbox" class="mb-2${f.status === 'paid' ? '' : ' d-none'}" style="max-width:260px"><label class="form-label small mb-1" for="vpaid">Nominal yang dibayarkan (Rp)</label>
          <input id="vpaid" class="form-control text-end" inputmode="numeric" placeholder="0" value="${rp(f.nominal_dibayar || f.total)}">
          <div class="form-text">Wajib diisi. Maksimal 10 digit dan tidak melebihi total Realisasi Rp ${rp(f.total)}.</div></div>
        <textarea id="vnote" class="form-control mb-2${f.status === 'rejected' ? '' : ' d-none'}" rows="2" placeholder="Alasan penolakan (wajib)">${esc(f.catatan_admin || '')}</textarea>
        <div id="vperr"></div>
        <button class="btn btn-primary" id="vsave">Simpan status</button>
        <div class="form-text mt-2">Status dapat diubah kapan saja, tetapi nominal dan dokumen LPJ tidak dapat diubah dari sini.</div></div>`;
    showDocs($('vdocs'), { kua: f.kua_id, tahun: f.tahun, bulan: f.bulan }, { side: () => realisasiSide(kn(f.kua_id), `${BULAN[f.bulan - 1]} ${f.tahun}`, m.pos, f.items, sk, flagged, isum(ri)) });
    $('vback').onclick = list;
    $('vst').onchange = () => { $('vnote').classList.toggle('d-none', $('vst').value !== 'rejected'); $('vpaidbox').classList.toggle('d-none', $('vst').value !== 'paid'); };
    $('vpaid').oninput = () => fmtIn($('vpaid'));
    $('vsave').onclick = async () => {
      const st = $('vst').value, why = $('vnote').value.trim(), paid = num($('vpaid').value), warn = txt => lapor($('vperr'), txt, 'warning');
      if (st === f.status && st !== 'rejected' && !(st === 'paid' && paid !== (f.nominal_dibayar || 0))) return warn('Status belum diubah.');
      if (st === 'rejected' && !why) return warn('Alasan penolakan wajib diisi.');
      if (st === 'paid' && !paid) return warn('Nominal yang dibayarkan wajib diisi.');
      if (st === 'paid' && paid > f.total) return warn(`Nominal yang dibayarkan (Rp ${rp(paid)}) melebihi total Realisasi (Rp ${rp(f.total)}).`);
      $('vsave').disabled = true;
      const { error } = await sb.from('realisasi').update(st === 'rejected' ? { status: st, catatan_admin: why } : st === 'paid' ? { status: st, nominal_dibayar: paid } : { status: st })
        .eq('kua_id', f.kua_id).eq('tahun', f.tahun).eq('bulan', f.bulan);
      if (!live(ep)) return;
      if (error) { lapor($('vperr'), error.message, 'danger'); $('vsave').disabled = false; return; }
      lapor($('vmsg'), `Status ${kn(f.kua_id)} ${BULAN[f.bulan - 1]} ${f.tahun} diubah menjadi ${ST[st][1]}${st === 'paid' ? ` (Rp ${rp(paid)})` : ''}.`, 'success');
      await load();
    };
  };
  const load = async () => {
    $('vbody').textContent = 'Memuat…';
    let q = sb.from('realisasi').select('kua_id,tahun,bulan,items,total,status,catatan_admin,nominal_dibayar').eq('tahun', +$('vy').value);
    if (+$('vk').value) q = q.eq('kua_id', +$('vk').value);
    if (+$('vb').value) q = q.eq('bulan', +$('vb').value);
    if ($('vs').value) q = q.eq('status', $('vs').value);
    const r = await q.order('bulan').order('kua_id');
    if (!live(ep)) return;
    if (r.error) return $('vbody').innerHTML = note(r.error.message);
    G = r.data; list();
  };
  ['vk', 'vy', 'vb', 'vs'].forEach(id => $(id).onchange = () => { $('vmsg').innerHTML = ''; load(); });
  load();
}

/* ====== Pengaturan SAKTI (menu metode: bawaan hanya Admin): ceklis GLOBAL per KUA + POS (Listrik dan Telepon/Internet). Tanpa bulan/tahun berlaku ====== */
async function pageMetode() {
  const ep = EP;
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  const P = m.pos.filter(p => SAKTI_POS.includes(p.kode_pos)), nm = p => p.nama_pos.replace('Belanja Langganan ', '');   // Listrik, Telepon/Internet
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h4 class="mb-1">Pengaturan SAKTI</h4>
    <p class="mb-3">Centang KUA yang pembayaran <b>Listrik</b> dan <b>Telepon/Internet</b>-nya lewat SAKTI (autopayment). Berlaku untuk semua bulan. KUA yang dicentang: nominalnya diinput petugas di menu <a href="#sakti">Realisasi SAKTI</a> dan tidak dapat diisi operator. KUA yang tidak dicentang: operator mengisi Realisasi seperti biasa.</p>
    <div id="mmsg"></div><div id="mbody">Memuat…</div></div></div>`;
  let vers = [];
  const mark = c => c.closest('td').classList.toggle('table-warning', (c.checked ? 1 : 0) !== +c.dataset.o);
  const draw = () => {
    const cnt = P.map(p => m.kua.filter(k => metodeOf(vers, k.id, p.id) === 'SAKTI').length);
    $('mbody').innerHTML = `<p class="mb-2">KUA yang dicentang SAKTI: ${P.map((p, i) => `${esc(nm(p))} <b>${cnt[i]}</b>`).join(' · ')} (dari ${m.kua.length} KUA).</p>
      <div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>KUA</th>${P.map((p, i) => `<th class="text-center"><label class="d-flex align-items-center justify-content-center gap-2 mb-0"><input type="checkbox" class="form-check-input mt-0" data-all="${p.id}" aria-label="Centang semua ${esc(nm(p))}"${cnt[i] === m.kua.length ? ' checked' : ''}>${esc(p.kode_pos)} · ${esc(nm(p))}</label></th>`).join('')}</tr></thead>
      <tbody>${m.kua.map(k => `<tr><td>${esc(k.nama_kua)}</td>${P.map(p => { const on = metodeOf(vers, k.id, p.id) === 'SAKTI';
        return `<td class="text-center"><input type="checkbox" class="form-check-input" data-k="${k.id}" data-p="${p.id}" data-o="${on ? 1 : 0}"${on ? ' checked' : ''} aria-label="SAKTI ${esc(k.nama_kua)} ${esc(nm(p))}"></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <button class="btn btn-primary" id="msave">Simpan pengaturan</button>`;
    $('mbody').onchange = e => {
      if (e.target.dataset.all) $('mbody').querySelectorAll(`input[data-p="${e.target.dataset.all}"]`).forEach(c => { c.checked = e.target.checked; mark(c); });
      else if (e.target.dataset.o != null) mark(e.target);
    };
    $('msave').onclick = async () => {   // hanya baris yang berubah, satu transaksi
      const rows = [];
      $('mbody').querySelectorAll('input[data-k]').forEach(c => { if ((c.checked ? 1 : 0) !== +c.dataset.o) rows.push({ kua_id: +c.dataset.k, pos_id: +c.dataset.p, metode: c.checked ? 'SAKTI' : 'MANUAL' }); });
      if (!rows.length) return lapor($('mmsg'), 'Tidak ada perubahan untuk disimpan.', 'info');
      $('msave').disabled = true;
      const { error } = await sb.from('metode_pembayaran').upsert(rows, { onConflict: 'kua_id,pos_id' });   // satu transaksi: gagal satu = batal semua
      if (!live(ep)) return;
      $('msave').disabled = false;
      lapor($('mmsg'), error ? error.message : `Pengaturan SAKTI tersimpan untuk ${rows.length} KUA/POS.`, error ? 'danger' : 'success');
      if (!error) load();
    };
  };
  const load = async () => {
    $('mbody').textContent = 'Memuat…';
    const r = await sb.from('metode_pembayaran').select('kua_id,pos_id,metode');
    if (!live(ep)) return;
    if (r.error) return $('mbody').innerHTML = note(r.error.message);
    vers = r.data; draw();
  };
  load();
}

/* ====== Realisasi SAKTI (menu sakti: Admin, Bendahara BOP): tampilan sama dengan Pengaturan SAKTI, tetapi ceklis diganti kolom nominal (per bulan) ======
   Pembayaran SAKTI (autopayment) SUDAH terjadi, jadi nominalnya TIDAK dibatasi RPD: tetap dapat disimpan walau melebihi RPD bulan itu atau
   RPD setahun (database tidak lagi menolaknya, lihat realisasi_sakti_guard di bop.sql). Kelebihannya hanya DITAMPILKAN sebagai peringatan,
   tidak memblokir. Dampaknya ada di Operator KUA: selama Realisasi sebuah POS melebihi RPD setahun, atau Realisasi sebuah bulan melebihi RPD
   bulan itu, operator tidak dapat mengirim Realisasi (tombol Kirim nonaktif dan kelebihannya tampil; lihat pageRealisasi). ====== */
async function pageSakti() {
  const ep = EP, now = new Date();
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  const P = m.pos.filter(p => SAKTI_POS.includes(p.kode_pos)), nm = p => p.nama_pos.replace('Belanja Langganan ', '');
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h4 class="mb-1">Realisasi SAKTI</h4>
    <p class="mb-2">Input nominal pembayaran SAKTI untuk <b>Listrik</b> dan <b>Telepon/Internet</b> pada bulan terpilih. Hanya kolom KUA yang dicentang di ${can('metode') ? '<a href="#metode">Pengaturan SAKTI</a>' : 'Pengaturan SAKTI'} yang dapat diisi. Nominal otomatis dijumlahkan dengan Realisasi manual pada batas RPD dan Laporan.</p>
    <p class="mb-3">Pembayaran SAKTI sudah terjadi, jadi nominalnya <b>tetap dapat disimpan walau melebihi RPD</b>. Kelebihan ditandai kuning di kolom Keterangan RPD; Operator KUA yang bersangkutan tidak dapat mengirim Realisasi sampai RPD-nya disesuaikan.</p>
    <div class="d-flex flex-wrap gap-2 mb-3">${yearSel('sy', now.getFullYear())}
      <select id="sm" class="form-select" style="width:auto" aria-label="Bulan">${BULAN.map((n, i) => `<option value="${i + 1}"${i === now.getMonth() ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <div id="smsg"></div><div id="sbody">Memuat…</div></div></div>`;
  let vers = [], rs = [], rpd = [], rel = [], D = {};   // rs = Realisasi SAKTI, rpd = RPD, rel = Realisasi manual: semuanya satu tahun, semua KUA
  // Indeks per KUA agar pemeriksaan kelebihan RPD cepat saat mengetik: total per bulan, per POS setahun, dan SAKTI per POS per bulan.
  const index = () => {
    D = {};
    m.kua.forEach(k => D[k.id] = { rpdB: Array(13).fill(0), rpdP: {}, rpdPB: {}, manB: Array(13).fill(0), manP: {}, sak: {} });
    rpd.forEach(x => { const d = D[x.kua_id]; if (!d) return; d.rpdB[x.bulan] += x.total; Object.entries(x.items).forEach(([pid, n]) => { d.rpdP[pid] = (d.rpdP[pid] || 0) + n; d.rpdPB[pid + '|' + x.bulan] = n; }); });
    rel.forEach(x => { const d = D[x.kua_id]; if (!d) return; d.manB[x.bulan] += x.total; Object.entries(x.items).forEach(([pid, n]) => { d.manP[pid] = (d.manP[pid] || 0) + n; }); });
    rs.forEach(x => { const d = D[x.kua_id]; if (d) (d.sak[x.pos_id] ||= Array(13).fill(0))[x.bulan] = x.nominal; });
  };
  // Kelebihan RPD satu KUA, dengan isian bulan terpilih (v = {id POS: nominal}) menggantikan nilai tersimpan. Sama dengan aturan realisasi_guard:
  // (1) Realisasi sebulan (manual + SAKTI) <= RPD bulan itu; (2) tiap POS setahun (manual + SAKTI) <= RPD POS itu setahun. Kembalian: daftar teks.
  const cek = (k, b, v) => {
    const d = D[k.id], out = [], sakB = Array(13).fill(0);
    P.forEach(p => { const a = d.sak[p.id] || []; for (let i = 1; i <= 12; i++) sakB[i] += i === b ? (v[p.id] || 0) : (a[i] || 0); });
    for (let i = 1; i <= 12; i++) {
      const tot = d.manB[i] + sakB[i];
      if (sakB[i] > 0 && tot > d.rpdB[i]) out.push(`${BULAN[i - 1]}: Realisasi Rp ${rp(tot)} melebihi RPD bulan itu Rp ${rp(d.rpdB[i])} (lebih Rp ${rp(tot - d.rpdB[i])})`);
    }
    P.forEach(p => {
      const a = d.sak[p.id] || [], sak = a.reduce((s, x, i) => s + (i === b ? 0 : x || 0), 0) + (v[p.id] || 0);
      if (!sak) return;
      const man = d.manP[p.id] || 0, cap = d.rpdP[p.id] || 0;
      if (man + sak > cap) out.push(`${nm(p)} setahun: Rp ${rp(man + sak)} melebihi RPD setahun Rp ${rp(cap)} (lebih Rp ${rp(man + sak - cap)})`);
    });
    return out;
  };
  const vals = k => { const o = {}; $('sbody').querySelectorAll(`input[data-k="${k.id}"]`).forEach(i => o[+i.dataset.p] = num(i.value)); return o; };
  const sums = () => P.map(p => [...$('sbody').querySelectorAll(`input[data-p="${p.id}"]`)].reduce((s, i) => s + num(i.value), 0));
  // Hitung ulang total kolom, petunjuk RPD tiap kotak, dan baris/ringkasan yang melebihi RPD. Dipanggil tiap ketikan.
  const recalc = () => {
    const b = +$('sm').value;
    sums().forEach((v, i) => $('sbody').querySelector(`[data-tot="${P[i].id}"]`).textContent = rp(v));
    let n = 0;
    $('sbody').querySelectorAll('[data-hint]').forEach(h => {
      const [kid, pid] = h.dataset.hint.split('|'), r = D[kid].rpdPB[pid + '|' + b] || 0, v = num($('sbody').querySelector(`input[data-k="${kid}"][data-p="${pid}"]`).value);
      h.textContent = `RPD bulan ini Rp ${rp(r)}` + (v > r ? ` · melebihi Rp ${rp(v - r)}` : '');
      h.className = 'small mt-1 ' + (v > r ? 'text-warning-emphasis fw-semibold' : 'text-muted');
    });
    m.kua.forEach(k => {
      const w = cek(k, b, vals(k)), tr = $('sbody').querySelector(`tr[data-row="${k.id}"]`);
      tr.classList.toggle('table-warning', w.length > 0);
      tr.querySelector('[data-warn]').innerHTML = w.map(x => `<div>${esc(x)}</div>`).join('');
      if (w.length) n++;
    });
    $('swarn').innerHTML = n ? `<div class="alert alert-warning py-2" role="status"><b>${n} KUA melebihi RPD</b> (baris kuning).<br>Realisasi SAKTI tetap dapat disimpan karena sudah dibayar. Operator KUA terkait tidak dapat mengirim Realisasi (bulan yang melebihi RPD bulannya, atau semua bulan bila sebuah POS melebihi RPD setahun) sampai RPD-nya disesuaikan.</div>` : '';
  };
  const draw = () => {
    const t = +$('sy').value, b = +$('sm').value;
    const future = t * 12 + b > now.getFullYear() * 12 + now.getMonth() + 1;   // periode belum berjalan: ditolak juga oleh database
    const val = (k, p) => D[k.id].sak[p.id]?.[b] || 0;
    const any = m.kua.some(k => P.some(p => metodeOf(vers, k.id, p.id) === 'SAKTI'));
    $('sbody').innerHTML = `${future ? note(`${BULAN[b - 1]} ${t} belum berjalan, jadi Realisasi SAKTI belum dapat diinput.`, 'warning') : ''}${any ? '' : note('Belum ada KUA yang dicentang SAKTI. Atur dulu di menu Pengaturan SAKTI.', 'info')}<div id="swarn"></div>
      <div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>KUA</th>${P.map(p => `<th class="text-end">${esc(p.kode_pos)} · ${esc(nm(p))} (Rp)</th>`).join('')}<th style="min-width:240px">Keterangan RPD</th></tr></thead>
      <tbody>${m.kua.map(k => `<tr data-row="${k.id}"><td>${esc(k.nama_kua)}</td>${P.map(p => { const on = metodeOf(vers, k.id, p.id) === 'SAKTI', v = val(k, p);
        return `<td><input class="form-control form-control-sm text-end" style="min-width:140px" inputmode="numeric" placeholder="${on ? '0' : '-'}" data-k="${k.id}" data-p="${p.id}" data-o="${v}" aria-label="Nominal ${esc(k.nama_kua)} ${esc(nm(p))}" value="${v ? rp(v) : ''}"${on && !future ? '' : ' disabled'}>${on ? `<div data-hint="${k.id}|${p.id}"></div>` : ''}</td>`; }).join('')}<td class="small" data-warn="${k.id}"></td></tr>`).join('')}</tbody>
      <tfoot><tr class="fw-semibold"><td>Total ${BULAN[b - 1]} ${t}</td>${P.map(p => `<td class="text-end" data-tot="${p.id}"></td>`).join('')}<td></td></tr></tfoot></table></div>
      <button class="btn btn-primary" id="ssave"${future || !any ? ' disabled' : ''}>Simpan Realisasi SAKTI</button>`;
    recalc();
    $('sbody').oninput = e => { if (e.target.dataset.p) { fmtIn(e.target); recalc(); } };
    $('ssave').onclick = async () => {   // hanya sel yang berubah, satu transaksi. Kelebihan RPD TIDAK menghalangi penyimpanan
      const out = [];
      $('sbody').querySelectorAll('input[data-k]:not([disabled])').forEach(i => { const v = num(i.value); if (v !== +i.dataset.o) out.push({ kua_id: +i.dataset.k, pos_id: +i.dataset.p, tahun: t, bulan: b, nominal: v }); });
      if (!out.length) return lapor($('smsg'), 'Tidak ada perubahan untuk disimpan.', 'info');
      $('ssave').disabled = true;
      const { error } = await sb.from('realisasi_sakti').upsert(out, { onConflict: 'kua_id,pos_id,tahun,bulan' });
      if (!live(ep)) return;
      $('ssave').disabled = false;
      if (error) return lapor($('smsg'), error.message, 'danger');
      await load();   // muat ulang: ringkasan kelebihan di bawah dihitung dari data yang baru tersimpan
      if (!live(ep)) return;
      lapor($('smsg'), `Realisasi SAKTI ${BULAN[b - 1]} ${t} tersimpan (${out.length} perubahan).`, 'success');
      const lebih = [...new Set(out.map(o => o.kua_id))].map(id => m.kua.find(k => k.id === id)).filter(k => k && cek(k, b, vals(k)).length);
      if (lebih.length) jpToast(`${lebih.map(k => k.nama_kua).join(', ')}: Realisasi SAKTI melebihi RPD. Tetap tersimpan karena SAKTI sudah dibayar; Operator KUA terkait tidak dapat mengirim Realisasi sampai RPD-nya disesuaikan.`, 'warning');
    };
  };
  const load = async () => {
    const y = +$('sy').value;
    $('sbody').textContent = 'Memuat…';
    try {
      const [v, r, d, l] = await Promise.all([
        sb.from('metode_pembayaran').select('kua_id,pos_id,metode'),
        fetchAll(() => sb.from('realisasi_sakti').select('kua_id,pos_id,bulan,nominal').eq('tahun', y).order('kua_id').order('pos_id').order('bulan')),
        fetchAll(() => sb.from('rpd').select('kua_id,bulan,items,total').eq('tahun', y).order('kua_id').order('bulan')),
        fetchAll(() => sb.from('realisasi').select('kua_id,bulan,items,total').eq('tahun', y).order('kua_id').order('bulan'))]);
      if (!live(ep)) return;
      if (v.error) throw v.error;
      vers = v.data; rs = r; rpd = d; rel = l;
    } catch (e) { if (live(ep)) $('sbody').innerHTML = note(e.message); return; }
    index(); draw();
  };
  $('sy').onchange = () => { $('smsg').innerHTML = ''; load(); };
  $('sm').onchange = () => { $('smsg').innerHTML = ''; draw(); };   // data satu tahun sudah dimuat: pindah bulan tidak perlu mengambil ulang
  load();
}

/* ====== Impor Data Lama (admin): ambil data dari Spreadsheet/Apps Script sistem lama, tulis ke BIMASATU, dan SALIN berkas LPJ-nya ke
   struktur Google Drive baru (BIMASATU / BOP / LPJ / tahun / Kecamatan ...). Hanya data yang dipakai BIMASATU yang dibawa. Aman diulang ====== */
const LG_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const lgKey = s => String(s || '').toLowerCase().replace(/^kua\s+/, '').replace(/^kec\.?\s+/, '').replace(/\s+/g, ' ').trim();   // "KUA Anjatan" = "KUA Kec. Anjatan"
const lgNum = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };   // hanya nominal positif yang dibawa
const lgBulan = v => { const s = String(v ?? '').trim().toLowerCase(), i = BULAN.findIndex(b => b.toLowerCase() === s); return i >= 0 ? i + 1 : /^\d{1,2}$/.test(s) && +s >= 1 && +s <= 12 ? +s : 0; };
const lgStatus = s => ({ waiting: 'waiting', pending: 'waiting', approved: 'approved', rejected: 'rejected', paid: 'paid' })[String(s || '').trim().toLowerCase()] || 'waiting';
const lgTime = s => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d.toISOString() : null; };
const lgDriveId = u => (String(u || '').match(/\/d\/([\w-]{10,100})/) || String(u || '').match(/[?&]id=([\w-]{10,100})/) || [])[1] || '';

async function legacyCall(url, action, data = {}) {   // sama seperti apiCall sistem lama: POST tanpa header, supaya tidak ada preflight CORS
  let r;
  try { r = await fetch(url, { method: 'POST', body: JSON.stringify({ action, ...data }) }); }
  catch { throw new Error('Tidak dapat menghubungi Apps Script lama. Periksa alamat Web App dan koneksi internet.'); }
  if (!r.ok) throw new Error(`Apps Script lama membalas kode ${r.status}.`);
  let j; try { j = await r.json(); } catch { throw new Error('Balasan Apps Script lama bukan JSON. Pastikan alamatnya berakhiran /exec dan aksesnya "Siapa saja".'); }
  if (!j || !j.success) throw new Error((j && j.message) || `Apps Script lama menolak ${action}.`);
  return j.data;
}

async function legacyFetch(url, opt, log) {   // hanya yang dipilih; tahun dipersempit di sumber agar balasan kecil
  const yr = opt.tahun ? { year: opt.tahun } : {}, raw = { budgets: [], rpds: [], reals: [], apCfg: {}, apNom: [] }, arr = x => Array.isArray(x) ? x : [];
  if (opt.parts.anggaran) { log('Membaca Anggaran…'); raw.budgets = arr(await legacyCall(url, 'getBudgets', yr)); }
  if (opt.parts.rpd) { log('Membaca RPD…'); raw.rpds = arr(await legacyCall(url, 'getRPDs', yr)); }
  if (opt.parts.realisasi) { log('Membaca Realisasi…'); raw.reals = arr(await legacyCall(url, 'getRealisasis', yr)); }
  if (opt.parts.sakti || opt.parts.realisasi) {   // Realisasi perlu tahu POS mana yang Auto Payment (nilainya digantikan Realisasi SAKTI)
    log('Membaca pengaturan Auto Payment…'); raw.apCfg = (await legacyCall(url, 'getAutoPaymentConfig')) || {};
  }
  if (opt.parts.sakti) {
    const yNow = new Date().getFullYear(), years = opt.tahun ? [opt.tahun]
      : [...new Set([...raw.budgets, ...raw.rpds, ...raw.reals].map(r => +r.year).filter(Boolean))].sort();
    for (const yy of years.length ? years : [yNow - 1, yNow]) {
      log(`Membaca nominal Auto Payment ${yy}…`);
      raw.apNom.push({ year: yy, data: (await legacyCall(url, 'getAutoPaymentNominalYear', { year: yy })) || {} });
    }
  }
  return raw;
}

// Ubah data lama menjadi baris untuk BIMASATU. Murni (tanpa jaringan/DOM). Yang tidak dipakai BIMASATU tidak ikut:
// ID, Total (dihitung ulang), nama pengguna/verifikator, metadata file, nilai Rp 0, baris kosong, KUA/POS tak dikenal.
function legacyPlan(raw, m, opt) {
  const kmap = new Map(m.kua.map(k => [lgKey(k.nama_kua), k.id])), pmap = new Map(), bad = { kua: new Set(), pos: new Set(), tahun: 0 };
  m.pos.forEach(p => pmap.set(p.kode_pos + '|' + (p.nama_rincian ? p.nama_rincian.toLowerCase().trim() : '*'), p.id));
  const posOf = (code, item) => pmap.get(code + '|' + String(item || '').toLowerCase().trim()) ?? pmap.get(code + '|*');
  const kuaOf = n => { const id = kmap.get(lgKey(n)); if (!id) bad.kua.add(String(n || '(kosong)')); return id; };
  const yearOf = y => { const t = +y; return t >= 2020 && t <= 2100 ? t : 0; };
  const scope = t => !!t && (!opt.tahun || t === opt.tahun);   // tahun tidak valid (0) tidak pernah lolos, termasuk saat "Semua tahun"
  const sPos = m.pos.filter(p => SAKTI_POS.includes(p.kode_pos)), P = opt.parts;
  const out = { anggaran: [], rpd: [], realisasi: [], metode: [], sakti: [], warn: [], baca: { budgets: raw.budgets.length, rpds: raw.rpds.length, reals: raw.reals.length, apNom: 0 }, berkas: 0 };
  const hitung = (data, buang) => {   // {kode: {rincian: nilai}} -> {id POS: nominal}; POS dalam `buang` (Auto Payment) tidak dibawa
    const it = {}; let dibuang = 0;
    Object.entries(data || {}).forEach(([code, v]) => (v && typeof v === 'object' ? Object.entries(v) : [['Nominal', v]]).forEach(([item, val]) => {
      const n = lgNum(val); if (!n) return;
      const pid = posOf(code, item);
      if (!pid) { bad.pos.add(`${code} · ${item}`); return; }
      if (buang && buang.has(pid)) { dibuang += n; return; }
      it[pid] = (it[pid] || 0) + n;
    }));
    return { it, dibuang };
  };

  // Pengaturan Auto Payment lama (ceklis global) -> ceklis SAKTI BIMASATU. Dibutuhkan juga untuk Realisasi.
  const flagged = new Map();
  Object.entries(raw.apCfg || {}).forEach(([nama, cfg]) => {
    const kid = kuaOf(nama); if (!kid) return;
    sPos.forEach(p => {
      const on = !!cfg && (cfg[p.kode_pos] === true || cfg[p.kode_pos] === 'TRUE');
      if (P.sakti) out.metode.push({ kua_id: kid, pos_id: p.id, metode: on ? 'SAKTI' : 'MANUAL' });
      if (on) { if (!flagged.has(kid)) flagged.set(kid, new Set()); flagged.get(kid).add(p.id); }
    });
  });

  // Anggaran: 1 nilai per KUA per tahun
  if (P.anggaran) {
    const mp = new Map();
    raw.budgets.forEach(b => {
      const kid = kuaOf(b.kua), t = yearOf(b.year), n = lgNum(b.total ?? b.budget);
      if (!kid || !scope(t) || !n) { if (kid && !t) bad.tahun++; return; }
      mp.set(kid + '|' + t, { kua_id: kid, tahun: t, nominal: n });
    });
    out.anggaran = [...mp.values()];
  }

  // RPD: rincian per POS per KUA per bulan (baris tanpa nominal dilewati)
  if (P.rpd) {
    const mp = new Map();
    raw.rpds.forEach(r => {
      const kid = kuaOf(r.kua), t = yearOf(r.year), b = lgBulan(r.month);
      if (!kid || !scope(t) || !b) { if (kid && (!t || !b)) bad.tahun++; return; }
      const { it } = hitung(r.data); if (!Object.keys(it).length) return;
      mp.set(`${kid}|${t}|${b}`, { kua_id: kid, tahun: t, bulan: b, items: it });
    });
    out.rpd = [...mp.values()];
  }

  // Nominal Auto Payment -> Realisasi SAKTI (hanya KUA + POS yang dicentang)
  const sk = new Map(); let taktif = 0;
  if (P.sakti) {
    (raw.apNom || []).forEach(({ year, data }) => {
      const t = yearOf(year); if (!t || !scope(t)) return;
      Object.entries(data || {}).forEach(([bulan, byKua]) => {
        const b = lgBulan(bulan); if (!b) return;
        Object.entries(byKua || {}).forEach(([nama, e]) => {
          const kid = kuaOf(nama); if (!kid) return;
          sPos.forEach(p => {
            const n = lgNum(e && e[p.kode_pos]); if (!n) return;
            out.baca.apNom++;
            if (flagged.get(kid)?.has(p.id)) sk.set(`${kid}|${p.id}|${t}|${b}`, { kua_id: kid, pos_id: p.id, tahun: t, bulan: b, nominal: n }); else taktif++;
          });
        });
      });
    });
    out.sakti = [...sk.values()];
    if (taktif) out.warn.push(`${taktif} nominal Auto Payment milik KUA/POS yang tidak dicentang tidak dibawa.`);
  }

  // Realisasi: rincian per POS (POS Auto Payment tidak dibawa: digantikan Realisasi SAKTI), status, catatan, waktu, dan berkas LPJ
  if (P.realisasi) {
    const mp = new Map(); let ganda = 0, tanpaBerkas = 0, lepasN = 0;
    raw.reals.forEach(r => {
      const kid = kuaOf(r.kua), t = yearOf(r.year), b = lgBulan(r.month);
      if (!kid || !scope(t) || !b) { if (kid && (!t || !b)) bad.tahun++; return; }
      const { it, dibuang } = hitung(r.data, flagged.get(kid));
      if (dibuang) lepasN++;
      if (!Object.keys(it).length) return;
      const st = lgStatus(r.status), dibuat = lgTime(r.createdAt) || lgTime(r.updatedAt), ver = lgTime(r.verifiedAt) || lgTime(r.updatedAt);
      const berkas = (Array.isArray(r.files) ? r.files : []).map(f => {
        const id = f && (f.fileId || f.id), url = f && (f.fileUrl || f.url) || (id ? `https://drive.google.com/file/d/${id}/view` : '');
        return lgDriveId(url) ? { url, nama: String(f.fileName || f.originalName || f.name || f.uniqueName || 'LPJ') } : null;
      }).filter(Boolean);
      const key = `${kid}|${t}|${b}`, baru = { kua_id: kid, tahun: t, bulan: b, items: it, status: st,
        catatan_admin: String(r.notes || '').trim() || null, submitted_at: dibuat,
        verified_at: st === 'waiting' ? null : ver, paid_at: st === 'paid' ? ver : null, files: berkas, _u: String(r.updatedAt || '') };
      if (mp.has(key)) { ganda++; if (baru._u < mp.get(key)._u) return; }
      mp.set(key, baru);
    });
    out.realisasi = [...mp.values()];
    out.realisasi.forEach(r => { out.berkas += r.files.length; if (!r.files.length) tanpaBerkas++; delete r._u; });
    if (ganda) out.warn.push(`${ganda} Realisasi ganda untuk KUA + bulan yang sama: dipakai yang terbaru.`);
    if (tanpaBerkas) out.warn.push(`${tanpaBerkas} Realisasi tidak punya berkas LPJ di sistem lama.`);
    if (lepasN) out.warn.push(`${lepasN} Realisasi memuat nilai POS Auto Payment (Listrik/Telepon): nilainya tidak dibawa karena digantikan Realisasi SAKTI, seperti perhitungan sistem lama.`);
  }

  if (bad.kua.size) out.warn.unshift(`KUA tidak dikenali (dilewati): ${[...bad.kua].join(', ')}.`);
  if (bad.pos.size) out.warn.push(`POS/rincian tidak dikenali (dilewati): ${[...bad.pos].join(', ')}.`);
  if (bad.tahun) out.warn.push(`${bad.tahun} baris dilewati karena tahun atau bulannya tidak valid.`);
  return out;
}

async function pageImpor() {
  const ep = EP;
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  const y = new Date().getFullYear(), kn = id => m.kua.find(k => k.id === id)?.nama_kua || id;
  const chk = (id, label, on = true) => `<div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="${id}"${on ? ' checked' : ''}><label class="form-check-label" for="${id}">${label}</label></div>`;
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h4 class="mb-1">Impor Data Lama</h4>
    <p class="mb-3">Ambil data dari Spreadsheet/Apps Script sistem lama ke ${esc(CFG.nama)}, termasuk <b>menyalin berkas LPJ</b> ke Google Drive ${esc(CFG.nama)} (<code>${esc(CFG.nama)} / BOP / LPJ / tahun / Kecamatan …</code>). Aman diulang: berkas yang sudah tersalin tidak digandakan.</p>
    <div id="imsg"></div>
    <div class="row g-3 mb-3">
      <div class="col-lg-8"><label class="form-label" for="iurl">Alamat Web App sistem lama</label>
        <input id="iurl" class="form-control" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(LS.getItem('jalin.legacy') || '')}" autocomplete="off" spellcheck="false">
        <div class="form-text">Sama dengan <code>SCRIPT_URL</code> di config.js sistem lama. Diingat di browser ini.</div></div>
      <div class="col-sm-6 col-lg-2"><label class="form-label" for="ith">Tahun</label>
        <select id="ith" class="form-select"><option value="0">Semua tahun</option>${[y - 2, y - 1, y, y + 1].map(v => `<option${v === y ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="col-sm-6 col-lg-2"><label class="form-label" for="imd">Data yang sudah ada</label>
        <select id="imd" class="form-select"><option value="0">Lewati (aman)</option><option value="1">Timpa</option></select></div></div>
    <div class="mb-2"><div class="fw-semibold mb-1">Yang dibawa</div>
      ${chk('ip_anggaran', 'Anggaran')}${chk('ip_rpd', 'RPD')}${chk('ip_realisasi', 'Realisasi + berkas LPJ')}${chk('ip_sakti', 'SAKTI (Auto Payment: ceklis + nominal)')}</div>
    <p class="small mb-3"><b>Tidak dibawa</b> karena tidak dipakai ${esc(CFG.nama)}: akun dan password pengguna (akun dibuat lewat <code>bop.mjs</code>), kuota API, konfigurasi lama, riwayat/log, ID dan Total (dihitung ulang), nama pengunggah/verifikator, metadata file, nilai Rp 0 atau baris kosong, serta KUA/POS yang tidak dikenali. Air tidak lagi SAKTI.</p>
    <button class="btn btn-primary" id="icek"><i class="bx bx-search-alt"></i> Ambil data &amp; pratinjau</button>
    <div id="ihasil" class="mt-4"></div></div></div>`;
  let plan = null, stop = false;
  const opts = () => ({ url: $('iurl').value.trim(), tahun: +$('ith').value, timpa: $('imd').value === '1',
    parts: { anggaran: $('ip_anggaran').checked, rpd: $('ip_rpd').checked, realisasi: $('ip_realisasi').checked, sakti: $('ip_sakti').checked } });
  const log = t => { const el = $('ilog'); if (el) el.textContent = t; };
  const nm = { anggaran: 'Anggaran', rpd: 'RPD', realisasi: 'Realisasi', sakti: 'Realisasi SAKTI', metode: 'Pengaturan SAKTI' };

  const showPlan = () => {
    const o = plan.opt, P = o.parts, b = plan.baca;
    const row = (jenis, dibaca, siap, extra = '') => `<tr><td>${jenis}</td><td class="text-end">${dibaca}</td><td class="text-end"><b>${siap}</b></td><td>${extra}</td></tr>`;
    const sakMet = plan.metode.filter(r => r.metode === 'SAKTI').length;
    $('ihasil').innerHTML = `<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Jenis data</th><th class="text-end">Dibaca</th><th class="text-end">Akan diimpor</th><th></th></tr></thead><tbody>
      ${P.anggaran ? row('Anggaran', b.budgets, plan.anggaran.length, 'per KUA per tahun') : ''}
      ${P.rpd ? row('RPD', b.rpds, plan.rpd.length, 'per KUA per bulan') : ''}
      ${P.realisasi ? row('Realisasi', b.reals, plan.realisasi.length, `${plan.berkas} berkas LPJ akan disalin ke Google Drive`) : ''}
      ${P.sakti ? row('Pengaturan SAKTI', '-', sakMet, 'KUA/POS yang dicentang') + row('Realisasi SAKTI', b.apNom, plan.sakti.length, 'nominal per KUA/POS/bulan') : ''}</tbody></table></div>
      ${plan.warn.length ? `<div class="alert alert-warning py-2"><b>Perhatian</b><ul class="mb-0">${plan.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <p class="small mb-2">Mode: <b>${o.timpa ? 'Timpa data yang sudah ada' : 'Lewati data yang sudah ada'}</b>${plan.berkas ? ` · Perkiraan waktu salin berkas: ±${Math.ceil(plan.berkas * 3 / 60)} menit. Biarkan tab ini terbuka.` : ''}</p>
      <div class="d-flex gap-2"><button class="btn btn-success" id="igo"><i class="bx bx-import"></i> Impor sekarang</button><button class="btn btn-outline-secondary d-none" id="istop">Hentikan</button></div>
      <div id="ilog" class="small mt-3"></div><div id="ires" class="mt-3"></div>`;
    $('igo').onclick = runImport;
    $('istop').onclick = () => { stop = true; $('istop').disabled = true; log('Menghentikan setelah langkah ini selesai…'); };
  };

  const runImport = async () => {
    const o = plan.opt, hasil = [], gagalBerkas = [];
    let fatal = '';
    stop = false; $('igo').disabled = true; $('icek').disabled = true; $('istop').classList.remove('d-none');
    let copied = 0, ada = 0;
    const step = async (jenis, rows) => {   // RPC impor_baris per 100 baris; satu baris gagal tidak membatalkan yang lain
      const tot = { jenis, ok: 0, lewati: 0, gagal: [] };
      for (let i = 0; i < rows.length; i += 100) {
        log(`${nm[jenis]}: ${Math.min(i + 100, rows.length)} dari ${rows.length}…`);
        const { data, error } = await sb.rpc('impor_baris', { p_jenis: jenis, p_rows: rows.slice(i, i + 100), p_timpa: o.timpa });
        if (error) throw new Error(`${nm[jenis]}: ${error.message}`);
        tot.ok += data.ok; tot.lewati += data.lewati; tot.gagal.push(...data.gagal.map(g => ({ jenis, ...g })));
      }
      hasil.push(tot);
    };
    try {
      if (o.parts.anggaran) await step('anggaran', plan.anggaran);
      if (o.parts.sakti) await step('metode', o.timpa ? plan.metode : plan.metode.filter(r => r.metode === 'SAKTI'));
      if (o.parts.rpd) await step('rpd', plan.rpd);
      if (o.parts.realisasi) {
        // baris asli BIMASATU (diajukan operator, submitted_by terisi) tidak disentuh pada mode Lewati; baris hasil impor sebelumnya boleh dilengkapi berkasnya
        const exist = new Map();
        if (!o.timpa) (await fetchAll(() => { let q = sb.from('realisasi').select('kua_id,tahun,bulan,submitted_by'); if (o.tahun) q = q.eq('tahun', o.tahun); return q.order('kua_id').order('tahun').order('bulan'); }))
          .forEach(r => exist.set(`${r.kua_id}|${r.tahun}|${r.bulan}`, r));
        const todo = plan.realisasi.filter(r => { const e = exist.get(`${r.kua_id}|${r.tahun}|${r.bulan}`); return !e || e.submitted_by == null; });
        const lewatiAsli = plan.realisasi.length - todo.length;
        let n = 0;
        for (const r of todo) {
          if (stop) break;
          n++;
          for (const f of r.files) {   // berurutan: folder tidak dibuat ganda dan Google Drive tidak kewalahan
            if (stop) break;
            log(`Realisasi ${n} dari ${todo.length}: ${kn(r.kua_id)} ${BULAN[r.bulan - 1]} ${r.tahun}, menyalin “${f.nama}”…`);
            try {
              const j = await (await api({ action: 'impor-lpj' }, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kua: r.kua_id, tahun: r.tahun, bulan: r.bulan, url: f.url, nama: f.nama }) })).json();
              r.file_lpj_url = j.folderUrl; if (j.ada) ada++; else copied++;
            } catch (e) { gagalBerkas.push({ kua_id: r.kua_id, tahun: r.tahun, bulan: r.bulan, nama: f.nama, pesan: e.message }); }
          }
        }
        const kirim = todo.slice(0, stop ? n : todo.length).map(({ files, ...row }) => row);
        await step('realisasi', kirim);
        hasil[hasil.length - 1].lewati += lewatiAsli;
      }
      if (o.parts.sakti && !stop) await step('sakti', plan.sakti);
    } catch (e) {
      fatal = e.message;
    }
    if (!live(ep)) return;
    log(stop ? 'Dihentikan. Jalankan lagi untuk melanjutkan (yang sudah masuk tidak digandakan).' : 'Selesai.');
    $('istop').classList.add('d-none'); $('igo').disabled = false; $('icek').disabled = false;
    const pl = id => { const p = m.pos.find(x => x.id === id); return p ? posLabel(p) : 'POS ' + id; };
    const gagal = hasil.flatMap(h => h.gagal), lbl = g => `${kn(g.kua_id)}${g.bulan ? ' · ' + BULAN[g.bulan - 1] + ' ' + g.tahun : g.tahun ? ' · ' + g.tahun : ''}${g.pos_id ? ' · ' + pl(g.pos_id) : ''}`;
    $('ires').innerHTML = `${fatal ? note('Impor berhenti: ' + fatal) : ''}
      <div class="table-responsive"><table class="table align-middle"><thead><tr><th>Jenis data</th><th class="text-end">Masuk</th><th class="text-end">Dilewati</th><th class="text-end">Gagal</th></tr></thead><tbody>
        ${hasil.map(h => `<tr><td>${nm[h.jenis]}</td><td class="text-end">${h.ok}</td><td class="text-end">${h.lewati}</td><td class="text-end${h.gagal.length ? ' text-danger fw-semibold' : ''}">${h.gagal.length}</td></tr>`).join('')}
        ${plan.opt.parts.realisasi ? `<tr><td>Berkas LPJ</td><td class="text-end">${copied}</td><td class="text-end">${ada}</td><td class="text-end${gagalBerkas.length ? ' text-danger fw-semibold' : ''}">${gagalBerkas.length}</td></tr>` : ''}</tbody></table></div>
      ${gagal.length || gagalBerkas.length ? `<div class="alert alert-danger py-2"><b>Yang gagal</b> (perbaiki penyebabnya lalu jalankan impor lagi, yang sudah masuk tidak digandakan):<ul class="mb-0">${
        gagal.slice(0, 40).map(g => `<li>${esc(nm[g.jenis])} · ${esc(lbl(g))}: ${esc(g.pesan)}</li>`).join('')}${
        gagalBerkas.slice(0, 40).map(g => `<li>Berkas · ${esc(lbl(g))} “${esc(g.nama)}”: ${esc(g.pesan)}</li>`).join('')}${
        gagal.length + gagalBerkas.length > 80 ? '<li>… dan lainnya.</li>' : ''}</ul></div>` : fatal || stop ? '' : note('Semua data yang dipilih berhasil diproses.', 'success')}`;
  };

  $('icek').onclick = async () => {
    const o = opts();
    if (!LG_URL.test(o.url)) return $('imsg').innerHTML = note('Alamat Web App tidak valid. Contoh: https://script.google.com/macros/s/…/exec', 'warning');
    if (!Object.values(o.parts).some(Boolean)) return $('imsg').innerHTML = note('Pilih minimal satu jenis data.', 'warning');
    $('imsg').innerHTML = ''; $('icek').disabled = true; plan = null;
    $('ihasil').innerHTML = '<div class="small" id="ilog">Menghubungi sistem lama…</div>';
    try {
      const raw = await legacyFetch(o.url, o, log);
      if (!live(ep)) return;
      plan = legacyPlan(raw, m, o); plan.opt = o;
      LS.setItem('jalin.legacy', o.url);
      showPlan();
    } catch (e) { if (live(ep)) $('ihasil').innerHTML = note(e.message); }
    if (live(ep)) $('icek').disabled = false;
  };
}

/* ====== Multi-select dengan chip (tanpa library): pilih banyak, cari dengan mengetik, hapus lewat tombol x.
   options: [[nilai bilangan, teks]]; selected: array nilai. Mengembalikan { values(), all(true|false) } ====== */
function multiSelect(host, options, selected, label) {
  const sel = new Set(selected), id = host.id;
  host.innerHTML = `<div class="ms"><div class="ms-box form-control"><input id="${id}-in" class="ms-input" type="search" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" aria-label="${esc(label)}"></div><ul id="${id}-list" class="ms-menu d-none" role="listbox" aria-multiselectable="true"></ul></div>`;
  const box = host.querySelector('.ms-box'), inp = host.querySelector('input'), menu = host.querySelector('ul');
  let shown = [], hl = 0;
  const picked = () => options.filter(([v]) => sel.has(v));
  const chips = () => {
    box.querySelectorAll('.ms-chip').forEach(c => c.remove());
    picked().forEach(([v, t]) => inp.insertAdjacentHTML('beforebegin', `<span class="ms-chip">${esc(t)}<button type="button" data-rm="${v}" aria-label="Hapus ${esc(t)}">×</button></span>`));
    inp.placeholder = sel.size ? '' : 'Pilih…';
  };
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    shown = options.filter(([, t]) => t.toLowerCase().includes(q));
    hl = Math.max(0, Math.min(hl, shown.length - 1));
    menu.innerHTML = shown.length ? shown.map(([v, t], i) => `<li role="option" aria-selected="${sel.has(v)}" data-v="${v}" class="${sel.has(v) ? 'on' : ''}${i === hl ? ' hl' : ''}"><span>${esc(t)}</span>${sel.has(v) ? '<span aria-hidden="true">✓</span>' : ''}</li>`).join('') : '<li class="empty">Tidak ada hasil</li>';
  };
  const open = o => { menu.classList.toggle('d-none', !o); inp.setAttribute('aria-expanded', o); box.classList.toggle('focus', o); if (o) draw(); };
  const toggle = v => { sel.has(v) ? sel.delete(v) : sel.add(v); inp.value = ''; chips(); draw(); };
  box.onclick = e => {
    const x = e.target.closest('[data-rm]');
    if (x) { sel.delete(+x.dataset.rm); chips(); draw(); } else { inp.focus(); open(true); }
  };
  inp.onfocus = () => open(true);
  inp.oninput = () => { hl = 0; open(true); };
  inp.onkeydown = e => {
    if (e.key === 'Backspace' && !inp.value && sel.size) { sel.delete(picked().pop()[0]); chips(); draw(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); open(true); hl = Math.min(hl + 1, shown.length - 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(hl - 1, 0); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!menu.classList.contains('d-none') && shown[hl]) toggle(shown[hl][0]); }
    else if (e.key === 'Escape') open(false);
  };
  menu.onmousedown = e => e.preventDefault();   // fokus tetap di kolom ketik
  menu.onclick = e => { const li = e.target.closest('[data-v]'); if (li) toggle(+li.dataset.v); };
  const away = e => { if (!host.isConnected) document.removeEventListener('pointerdown', away); else if (!host.contains(e.target)) open(false); };
  document.addEventListener('pointerdown', away);
  chips();
  return { values: () => picked().map(([v]) => v), all: on => { on ? options.forEach(([v]) => sel.add(v)) : sel.clear(); chips(); draw(); } };
}

/* ====== Config (menu config: bawaan hanya Admin): buka/tutup pengisian RPD dan Realisasi, batas file LPJ, bulan RPD yang dibuka ====== */
async function pageConfig() {
  const ep = EP;
  $('view').innerHTML = `<div class="card"><div class="card-body"><h4 class="mb-3">Config</h4><div id="cmsg"></div><div id="cbody">Memuat…</div></div></div>`;
  const c = await sb.from('config').select('key,value');
  if (!live(ep)) return;
  if (c.error) return $('cbody').innerHTML = note(c.error.message);
  const cfg = M.cfg = Object.fromEntries(c.data.map(r => [r.key, r.value]));
  const sw = (id, label, on) => `<div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="${id}"${on ? ' checked' : ''}><label class="form-check-label" for="${id}">${label}</label></div>`;
  const nm = (id, label, v, max) => `<div class="col-sm-6"><label class="form-label" for="${id}">${label}</label><input id="${id}" type="number" min="1" max="${max}" class="form-control" value="${v}" required></div>`;
  $('cbody').innerHTML = `<form id="cf">
    ${sw('crp', 'Operator boleh mengisi RPD', cfg.rpd_enabled === true)}
    ${sw('crl', 'Operator boleh mengisi Realisasi', cfg.realisasi_enabled === true)}
    <div class="row g-3 my-1">${nm('cmb', 'Maksimal ukuran file (MB)', cfg.max_file_size_mb ?? 5, 100)}${nm('cfc', 'Maksimal jumlah file', cfg.max_file_count ?? 3, 20)}</div>
    <label class="form-label mt-3" for="blnms-in">Bulan yang dibuka untuk edit RPD (operator)</label>
    <div id="blnms"></div>
    <div class="form-text mb-3">Operator hanya dapat mengisi RPD pada bulan yang dipilih. <button type="button" class="btn btn-link btn-sm p-0 align-baseline" id="bln-all">Pilih semua</button> · <button type="button" class="btn btn-link btn-sm p-0 align-baseline" id="bln-none">Kosongkan</button></div>
    <button class="btn btn-primary" id="csave">Simpan pengaturan</button></form>`;
  const bm = multiSelect($('blnms'), BULAN.map((n, i) => [i + 1, n]), cfg.bulan_edit_rpd || [], 'Bulan yang dibuka untuk edit RPD');
  $('bln-all').onclick = () => bm.all(true);
  $('bln-none').onclick = () => bm.all(false);
  $('cf').onsubmit = async e => {
    e.preventDefault();
    const v = { rpd_enabled: $('crp').checked, realisasi_enabled: $('crl').checked,
      max_file_size_mb: +$('cmb').value, max_file_count: +$('cfc').value,
      bulan_edit_rpd: bm.values() };
    $('csave').disabled = true;
    const at = new Date().toISOString();
    const { error } = await sb.from('config').upsert(Object.entries(v).map(([key, value]) => ({ key, value, updated_by: me.id, updated_at: at })), { onConflict: 'key' });
    if (!error) Object.assign(M.cfg, v);
    if (!live(ep)) return;
    $('csave').disabled = false;
    lapor($('cmsg'), error ? error.message : 'Pengaturan tersimpan.', error ? 'danger' : 'success');
  };
}

/* ====== Laporan ====== */
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fetchAll = async mk => {   // halaman 1000 baris (batas default Supabase)
  let out = [], from = 0;
  for (;;) {
    const { data, error } = await mk().range(from, from + 999);
    if (error) throw error;
    out = out.concat(data);
    if (data.length < 1000) return out;
    from += 1000;
  }
};

async function buildReport(f, m) {
  if (f.nom === 'sakti') return buildSakti(f, m);
  const tbl = f.nom === 'rpd' ? 'rpd' : 'realisasi', stf = { ok: ['approved', 'paid'], paid: ['paid'] }[f.st];
  const rows = await fetchAll(() => {
    let q = sb.from(tbl).select('kua_id,bulan,items').eq('tahun', f.tahun);
    if (f.kid) q = q.eq('kua_id', f.kid);
    if (f.per === 'bulan') q = q.eq('bulan', f.bulan);
    if (tbl === 'realisasi' && stf) q = q.in('status', stf);
    return q.order('kua_id').order('bulan');
  });
  let rs = [];
  if (tbl === 'realisasi') {   // Realisasi SAKTI (diinput admin; nominal > 0 = sudah dibayar) dijumlahkan dengan Realisasi manual
    rs = await fetchAll(() => {
      let q = sb.from('realisasi_sakti').select('kua_id,pos_id,bulan,nominal').eq('tahun', f.tahun).gt('nominal', 0);
      if (f.kid) q = q.eq('kua_id', f.kid);
      if (f.per === 'bulan') q = q.eq('bulan', f.bulan);
      return q.order('kua_id').order('pos_id').order('bulan');
    });
  }
  const all = !f.kid, det = f.bentuk === 'detail', lead = all ? 3 : 2;
  const cols = f.per === 'bulan' ? [f.bulan] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const agg = {}, add = (k, pid, b, n) => { (agg[k + '|' + pid] ||= Array(12).fill(0))[b - 1] += n; };
  rows.forEach(r => Object.entries(r.items).forEach(([pid, n]) => add(r.kua_id, pid, r.bulan, n)));
  rs.forEach(r => add(r.kua_id, r.pos_id, r.bulan, r.nominal));
  const head = [...(all ? ['KUA'] : []), 'Kode POS', 'POS / Rincian', ...(det ? cols.map(c => BLN3[c - 1]) : []), det ? 'Total' : 'Nominal'];
  const body = [];
  (all ? m.kua : m.kua.filter(k => k.id === f.kid)).forEach(k => m.pos.forEach(p => {
    const a = agg[k.id + '|' + p.id] || Array(12).fill(0), v = cols.map(c => a[c - 1]);
    body.push([...(all ? [k.nama_kua] : []), p.kode_pos, p.nama_rincian || p.nama_pos, ...(det ? v : []), v.reduce((s, x) => s + x, 0)]);
  }));
  const total = head.map((h, i) => i < lead ? (i === lead - 1 ? 'TOTAL' : '') : body.reduce((s, r) => s + r[i], 0));
  const kn = all ? 'Seluruh KUA' : m.kua.find(k => k.id === f.kid)?.nama_kua || '';
  const jenis = f.nom === 'rpd' ? 'RPD' : 'Realisasi';
  return {
    head, body, total, lead, det,
    title: `Laporan ${jenis} ${det ? 'Detail' : 'Rekap'} ${f.tahun}`,
    sub: [kn, f.per === 'bulan' ? `${BULAN[f.bulan - 1]} ${f.tahun}` : `Tahun ${f.tahun}`,
      f.nom === 'realisasi' ? { ok: 'Disetujui + Dibayar', paid: 'Dibayar saja', all: 'Semua status' }[f.st] : null,
      'Dicetak ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })].filter(Boolean).join(' · '),
    name: `laporan-${f.nom}-${f.bentuk}-${f.tahun}${f.per === 'bulan' ? '-' + String(f.bulan).padStart(2, '0') : ''}-${all ? 'semua-kua' : kn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  };
}

async function buildSakti(f, m) {   // Rekap RPD vs Realisasi per KUA x POS: SAKTI, Manual, Total, Sisa; filter POS dan metode
  const stf = { ok: ['approved', 'paid'], paid: ['paid'] }[f.st], per = q => f.per === 'bulan' ? q.eq('bulan', f.bulan) : q, kua = q => f.kid ? q.eq('kua_id', f.kid) : q;
  const [rpd, rel, rs, vers] = await Promise.all([
    fetchAll(() => per(kua(sb.from('rpd').select('kua_id,bulan,items').eq('tahun', f.tahun))).order('kua_id').order('bulan')),
    fetchAll(() => { let q = per(kua(sb.from('realisasi').select('kua_id,bulan,items').eq('tahun', f.tahun))); if (stf) q = q.in('status', stf); return q.order('kua_id').order('bulan'); }),
    fetchAll(() => per(kua(sb.from('realisasi_sakti').select('kua_id,pos_id,bulan,nominal').eq('tahun', f.tahun))).order('kua_id').order('pos_id').order('bulan')),
    fetchAll(() => kua(sb.from('metode_pembayaran').select('kua_id,pos_id,metode')).order('kua_id').order('pos_id'))]);
  const R = {}, M2 = {}, S = {}, all = !f.kid, lead = all ? 3 : 2, cols = f.per === 'bulan' ? [f.bulan] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  rpd.forEach(r => R[r.kua_id + '|' + r.bulan] = r.items);
  rel.forEach(r => M2[r.kua_id + '|' + r.bulan] = r.items);
  rs.forEach(r => S[r.kua_id + '|' + r.pos_id + '|' + r.bulan] = r);
  const KS = all ? m.kua : m.kua.filter(k => k.id === f.kid), PS = f.pos ? m.pos.filter(p => p.id === f.pos) : m.pos, body = [];
  KS.forEach(k => PS.forEach(p => {
    if (f.metode && f.metode !== (SAKTI_POS.includes(p.kode_pos) ? metodeOf(vers, k.id, p.id) : 'MANUAL')) return;   // pengaturan SAKTI global per KUA + POS
    let a = 0, mn = 0, sk = 0;
    cols.forEach(b => {
      const sr = S[k.id + '|' + p.id + '|' + b];
      a += R[k.id + '|' + b]?.[p.id] || 0; mn += M2[k.id + '|' + b]?.[p.id] || 0; sk += sr?.nominal || 0;
    });
    if (a || mn || sk) body.push([...(all ? [k.nama_kua] : []), p.kode_pos, p.nama_rincian || p.nama_pos, a, sk, mn, sk + mn, a - sk - mn]);
  }));
  const head = [...(all ? ['KUA'] : []), 'Kode POS', 'POS / Rincian', 'RPD', 'Realisasi SAKTI', 'Realisasi Manual', 'Total Realisasi', 'Sisa'];
  const total = head.map((h, i) => i < lead ? (i === lead - 1 ? 'TOTAL' : '') : body.reduce((s, r) => s + r[i], 0));
  const kn = all ? 'Seluruh KUA' : m.kua.find(k => k.id === f.kid)?.nama_kua || '', mm = String(f.bulan).padStart(2, '0');
  return {
    head, body, total, lead, det: false,
    title: `Laporan Rekap Manual vs SAKTI ${f.tahun}`,
    sub: [kn, f.per === 'bulan' ? `${BULAN[f.bulan - 1]} ${f.tahun}` : `Tahun ${f.tahun}`, f.pos ? posLabel(m.pos.find(p => p.id === f.pos)) : null,
      f.metode ? 'Metode ' + f.metode : null,
      { ok: 'Manual: Disetujui + Dibayar', paid: 'Manual: Dibayar saja', all: 'Manual: Semua status' }[f.st],
      'Dicetak ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })].filter(Boolean).join(' · '),
    name: `laporan-sakti-${f.tahun}${f.per === 'bulan' ? '-' + mm : ''}-${all ? 'semua-kua' : kn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  };
}

async function toXlsx(r) {
  await loadJs(CDN.xlsx);
  const ws = XLSX.utils.aoa_to_sheet([[r.title], [r.sub], [], r.head, ...r.body, r.total]);
  ws['!cols'] = r.head.map((h, i) => ({ wch: i >= r.lead ? 14 : i === r.lead - 1 || h === 'KUA' ? 30 : 11 }));
  Object.keys(ws).forEach(a => { if (a[0] !== '!' && ws[a].t === 'n') ws[a].z = '#,##0'; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
  XLSX.writeFile(wb, r.name + '.xlsx');
}

async function toPdf(r) {
  await loadJs(CDN.pdf); await loadJs(CDN.at);   // autotable butuh jsPDF lebih dulu
  const doc = new window.jspdf.jsPDF({ orientation: r.head.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(13); doc.text(r.title, 40, 40); doc.setFontSize(9); doc.text(r.sub, 40, 56);
  const right = {}; r.head.forEach((h, i) => { if (i >= r.lead) right[i] = { halign: 'right' }; });
  doc.autoTable({
    head: [r.head], startY: 68, theme: 'grid', columnStyles: right,
    body: [...r.body, r.total].map(x => x.map((v, i) => i >= r.lead ? rp(v) : v)),
    styles: { fontSize: r.head.length > 10 ? 6.5 : 8, cellPadding: 3 }, headStyles: { fillColor: [105, 108, 255] },
    didParseCell: d => { if (d.section === 'body' && d.row.index === r.body.length) d.cell.styles.fontStyle = 'bold'; }
  });
  doc.save(r.name + '.pdf');
}

/* Laporan (menu laporan): peran pusat (Admin, Bendahara/Verifikator BOP, ...) memilih KUA atau seluruh KUA; Operator KUA hanya KUA-nya. */
async function pageLaporan() {
  const ep = EP, pu = pusat(), y = new Date().getFullYear();
  let m;
  try { m = await master(); } catch (e) { return live(ep) && ($('view').innerHTML = note('Gagal memuat data master: ' + e.message)); }
  if (!live(ep)) return;
  if (!pu && !me.kua_id) return $('view').innerHTML = note('Akun ini belum terhubung ke KUA. Hubungi admin.', 'warning');
  const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${v}"${v == cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const col = (id, label, arr, cur, extra = '') => `<div class="col-sm-6 col-lg-4"><label class="form-label" for="${id}">${label}</label><select id="${id}" class="form-select">${opt(arr, cur)}</select>${extra}</div>`;
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h4 class="mb-3">Laporan</h4><div id="gmsg"></div>
    <div class="row g-3" id="gform">
      ${col('gn', 'Jenis nominal', [['realisasi', 'Realisasi'], ['rpd', 'RPD'], ['sakti', 'Rekap Manual vs SAKTI']], 'realisasi')}
      ${col('gf', 'Bentuk laporan', [['rekap', 'Rekap (total per POS)'], ['detail', 'Detail per bulan (matriks)']], 'rekap')}
      ${col('gt', 'Tahun', [y - 1, y, y + 1].map(v => [v, v]), y)}
      ${col('gp', 'Periode', [['tahun', 'Satu tahun'], ['bulan', 'Satu bulan']], 'tahun',
        `<select id="gb" class="form-select mt-2 d-none" aria-label="Bulan">${opt(BULAN.map((b, i) => [i + 1, b]), new Date().getMonth() + 1)}</select>`)}
      ${pu ? col('gc', 'Cakupan', [['', 'Seluruh KUA'], ...m.kua.map(k => [k.id, k.nama_kua])], '')
              : `<div class="col-sm-6 col-lg-4"><label class="form-label" for="gc">Cakupan</label><input id="gc" class="form-control" value="${esc(me.kua || '')}" disabled></div>`}
      ${col('gs', 'Status Realisasi (manual)', [['ok', 'Disetujui + Dibayar'], ['paid', 'Dibayar saja'], ['all', 'Semua status']], 'ok')}
      ${col('gm', 'Metode pembayaran', [['', 'Semua metode'], ['MANUAL', 'MANUAL'], ['SAKTI', 'SAKTI']], '')}
      ${col('gq', 'POS', [[0, 'Semua POS'], ...m.pos.map(p => [p.id, posLabel(p)])], 0)}
    </div>
    <div class="mt-4 d-flex flex-wrap gap-2">
      <button class="btn btn-primary" data-x="xlsx"><i class="bx bx-spreadsheet"></i> Unduh Excel</button>
      <button class="btn btn-outline-primary" data-x="pdf"><i class="bx bxs-file-pdf"></i> Unduh PDF</button></div></div></div>`;
  const sync = () => {
    const n = $('gn').value, sk = n === 'sakti';
    $('gb').classList.toggle('d-none', $('gp').value !== 'bulan');
    $('gs').closest('.col-sm-6').classList.toggle('d-none', n === 'rpd');
    $('gf').closest('.col-sm-6').classList.toggle('d-none', sk);   // rekap Manual vs SAKTI hanya satu bentuk
    ['gm', 'gq'].forEach(id => $(id).closest('.col-sm-6').classList.toggle('d-none', !sk));
  };
  $('gform').onchange = sync; sync();
  $('view').onclick = async e => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    const f = { nom: $('gn').value, bentuk: $('gf').value, tahun: +$('gt').value, per: $('gp').value, bulan: +$('gb').value, st: $('gs').value,
      metode: $('gm').value, pos: +$('gq').value || 0, kid: pu ? +$('gc').value || 0 : me.kua_id };
    const btns = $('view').querySelectorAll('[data-x]');
    btns.forEach(x => x.disabled = true); $('gmsg').innerHTML = note('Menyiapkan laporan…', 'info');
    try {
      const r = await buildReport(f, m);
      await (b.dataset.x === 'xlsx' ? toXlsx : toPdf)(r);
      if (live(ep)) lapor($('gmsg'), `Laporan berisi ${r.body.length} baris dan sudah diunduh.`, 'success');
    } catch (err) { if (live(ep)) lapor($('gmsg'), err.message, 'danger'); }
    btns.forEach(x => x.disabled = false);
  };
}

function pageBop() {   // kartu modul = menu BOP yang boleh dibuka akun ini (Hak Akses Menu)
  const items = [
    ['anggaran', 'Anggaran', 'bx-coin-stack', 'Anggaran tahunan setiap KUA'],
    ['rpd', 'RPD', 'bx-calendar-edit', 'Rencana penarikan dana bulanan'],
    ['realisasi', 'Realisasi', 'bx-receipt', 'Isi realisasi dan unggah LPJ'],
    ['verifikasi', 'Verifikasi', 'bx-check-shield', 'Setujui atau tolak realisasi'],
    ['metode', 'Pengaturan SAKTI', 'bx-toggle-right', 'Centang KUA yang dibayar lewat SAKTI'],
    ['sakti', 'Realisasi SAKTI', 'bx-transfer', 'Input nominal pembayaran SAKTI'],
    ['config', 'Config', 'bx-slider', 'Pengaturan sistem'],
    ['impor', 'Impor Data Lama', 'bx-import', 'Ambil data dari Spreadsheet lama'],
    ['laporan', 'Laporan', 'bx-file', 'Unduh Excel dan PDF']].filter(i => can(i[0]));
  $('view').innerHTML = `<h4 class="mb-1">BOP</h4><p class="mb-3">Halo, <b>${esc(me.nama)}</b>. ${items.length ? 'Pilih modul:' : 'Belum ada modul BOP yang dapat Anda buka. Hubungi admin.'}</p>
    ${can('sakti') ? '<div class="row g-3 mb-3" id="bstat"></div>' : ''}<div class="row g-3">${items.map(i => `<div class="col-sm-6 col-lg-4">
      <a class="card h-100 text-decoration-none" href="#${i[0]}"><div class="card-body d-flex gap-3 align-items-center">
        <div class="avatar"><i class="bx ${i[2]} fs-4"></i></div><div><h5 class="mb-0">${i[1]}</h5><small>${i[3]}</small></div></div></a></div>`).join('')}</div>`;
  if (can('sakti')) bopStat(EP);
}

async function bopStat(ep) {   // statistik ringkas SAKTI untuk yang punya menu Realisasi SAKTI (opsional: diam bila gagal)
  try {
    const now = new Date(), y = now.getFullYear(), b = now.getMonth() + 1;
    const [m, v, s] = await Promise.all([master(), sb.from('metode_pembayaran').select('kua_id,pos_id,metode'),
      fetchAll(() => sb.from('realisasi_sakti').select('kua_id,pos_id,bulan,nominal').eq('tahun', y).order('kua_id').order('pos_id').order('bulan'))]);
    if (!live(ep) || !$('bstat') || v.error) return;
    const P = m.pos.filter(p => SAKTI_POS.includes(p.kode_pos)), cards = [];
    let belum = 0;
    P.forEach(p => {
      const ks = m.kua.filter(k => metodeOf(v.data, k.id, p.id) === 'SAKTI');
      belum += ks.filter(k => !s.some(x => x.kua_id === k.id && x.pos_id === p.id && x.bulan === b && x.nominal > 0)).length;
      cards.push([`KUA SAKTI · ${p.nama_pos.replace('Belanja Langganan ', '')}`, `${ks.length} dari ${m.kua.length}`]);
    });
    cards.push([`Total Realisasi SAKTI ${y}`, 'Rp ' + rp(s.reduce((a, x) => a + x.nominal, 0)), `Belum diinput ${BULAN[b - 1]}: ${belum}`]);
    $('bstat').innerHTML = cards.map(c => `<div class="col-6 col-lg-3"><div class="card h-100"><div class="card-body"><small>${esc(c[0])}</small><h4 class="mb-0">${esc(c[1])}</h4>${c[2] ? `<small>${esc(c[2])}</small>` : ''}</div></div></div>`).join('');
  } catch { /* statistik hanya pelengkap */ }
}


// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { bop: pageBop, rpd: pageRpd, laporan: pageLaporan, realisasi: pageRealisasi, anggaran: pageAnggaran, verifikasi: pageVerifikasi, metode: pageMetode, sakti: pageSakti, config: pageConfig, impor: pageImpor });
