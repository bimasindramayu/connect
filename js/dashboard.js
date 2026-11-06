/* =====================================================================================
   dashboard.js: Dashboard Operator KUA (menu dashboard; halaman awal Operator KUA)
   Ringkasan KUA akun ini: sudah atau belum Realisasi bulan ini, Realisasi dibanding anggaran BOP tahun ini, kepala dan alamat KUA,
   dan statistik SDM (dari data Pegawai KUA). Khusus Operator KUA (database menolak menu ini untuk peran lain): data yang dibaca
   hanya milik KUA-nya sendiri (RLS). Admin tidak punya dashboard.
   - Realisasi memakai angka yang sama dengan halaman Realisasi: Realisasi manual (semua status) ditambah Realisasi SAKTI.
   - Kepala KUA diambil dari pegawai yang jabatannya "Kepala KUA" (pegKepala di pegawai.js); alamat KUA di kolom kua.alamat
     (diubah lewat set_alamat_kua).
   Memakai PEG_ dan peg... dari pegawai.js, serta master, rp, ST, BULAN dari bop.js.
   ===================================================================================== */

const dashPct = (a, b) => b > 0 ? a / b * 100 : 0;
const dashFmtPct = v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%';
// Batang peringkat satu warna: [[label, jumlah], ...]. Angka di ujung batang; ujung data membulat, pangkal batang rata.
const dashBars = (items, warna = '#696cff') => {
  const mx = Math.max(1, ...items.map(i => i[1]));
  return `<div class="dash-rank">${items.map(([l, n]) => `<div class="dash-rl" title="${esc(l)}">${esc(l)}</div>
    <div class="dash-rb" aria-hidden="true"><span style="width:${n ? Math.max(3, n / mx * 100) : 0}%;background:${warna}"></span></div><div class="dash-rv">${n}</div>`).join('')}</div>`;
};
// Batang tipis terbagi (PNS, PPPK, Honor); angkanya ada di sebelahnya sehingga tidak dicetak di batang
const dashSeg = c => {
  const tot = PEG_JENIS.reduce((s, j) => s + c[j], 0);
  return `<div class="dash-seg" role="img" aria-label="${esc(PEG_JENIS.map(j => `${j} ${c[j]}`).join(', '))}">${PEG_JENIS.filter(j => c[j]).map(j =>
    `<span title="${esc(`${j}: ${c[j]} pegawai (${dashFmtPct(c[j] / tot * 100)})`)}" style="flex:${c[j]};background:${PEG_WARNA[j]}"></span>`).join('')}</div>`;
};

const dashJudul = (t, aksi = '') => `<div class="d-flex align-items-center gap-2 mb-3"><h5 class="mb-0 me-auto">${esc(t)}</h5>${aksi}</div>`;   // judul kartu seragam (CSS memberi garis aksen di kiri)

async function pageDashboard() {
  const ep = EP, now = new Date(), y = now.getFullYear(), b = now.getMonth() + 1, bln = BULAN[b - 1];
  if (!me.kua_id) return $('view').innerHTML = note('Akun ini belum terhubung ke KUA. Hubungi admin.', 'warning');
  $('view').innerHTML = `<h4 class="mb-1">Dashboard</h4>
    <p class="mb-3">Halo, <b>${esc(me.nama)}</b>. Ringkasan <b>${esc(me.kua || 'KUA Anda')}</b> per ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    <div class="row g-3 mb-3">
      <div class="col-lg-6"><div class="card h-100"><div class="card-body" id="dreal">Memuat…</div></div></div>
      <div class="col-lg-6"><div class="card h-100"><div class="card-body" id="dang">Memuat…</div></div></div></div>
    <div class="row g-3">
      <div class="col-lg-5"><div class="card h-100"><div class="card-body" id="dprof">Memuat…</div></div></div>
      <div class="col-lg-7"><div class="card h-100"><div class="card-body" id="dsdm">Memuat…</div></div></div></div>`;

  // tiap bagian dimuat sendiri: satu yang gagal (mis. tabel belum ada) tidak menggagalkan bagian lain
  const aman = async f => { try { return await f(); } catch (e) { return { data: null, error: e }; } };
  const [m, rl, sk, ag, rd, pg, ku] = await Promise.all([
    aman(master),
    aman(() => sb.from('realisasi').select('bulan,total,status,catatan_admin,nominal_dibayar').eq('kua_id', me.kua_id).eq('tahun', y)),
    aman(() => sb.from('realisasi_sakti').select('bulan,nominal').eq('kua_id', me.kua_id).eq('tahun', y)),
    aman(() => sb.rpc('anggaran_tahun', { p_tahun: y })),
    aman(() => sb.from('rpd').select('bulan,total').eq('kua_id', me.kua_id).eq('tahun', y)),
    aman(() => sb.from('pegawai').select('nama,nip,jenis_asn,pangkat_golongan,jabatan,no_hp').eq('kua_id', me.kua_id)),
    aman(() => sb.from('kua').select('id,nama_kua,alamat').eq('id', me.kua_id).maybeSingle())
  ]);
  if (!live(ep)) return;
  const cfg = m?.cfg || {}, galat = (...r) => r.map(x => x?.error).find(Boolean);
  const bantu = e => /pegawai|alamat|schema cache|column/i.test(e.message || '') ? 'Data belum tersedia. Jalankan bop.sql versi terbaru di SQL Editor Supabase, lalu muat ulang halaman ini.' : (e.message || String(e));

  // ---- 1. Sudah atau belum Realisasi bulan ini ----
  {
    const e = galat(rl, sk);
    if (e) $('dreal').innerHTML = `${dashJudul(`Realisasi ${bln} ${y}`)}${note(bantu(e))}`;
    else {
      const rec = rl.data.find(r => r.bulan === b), sakBln = sk.data.filter(s => s.bulan === b).reduce((a, s) => a + s.nominal, 0);
      const rpdBln = rd.data?.find(r => r.bulan === b)?.total || 0, tutup = cfg.realisasi_enabled === false, mulai = new Date(y, b - 1, 10), belumWaktu = now < mulai;
      let ic = 'bx-time-five', c = 'secondary', judul = 'Belum realisasi', ket;
      if (!rec) {
        ket = tutup ? 'Pengisian Realisasi sedang ditutup oleh admin.'
          : belumWaktu ? `Realisasi ${bln} ${y} dapat dikirim mulai 10 ${bln} ${y}.` : 'Segera isi Realisasi dan unggah dokumen LPJ bulan ini.';
        if (!tutup && !belumWaktu) { ic = 'bx-error-circle'; c = 'warning'; }
      } else if (rec.status === 'rejected') {
        ic = 'bx-x-circle'; c = 'danger'; judul = 'Realisasi ditolak';
        ket = 'Perbaiki nominal atau dokumen LPJ, lalu kirim ulang.' + (rec.catatan_admin ? ` Catatan verifikator: ${rec.catatan_admin}` : '');
      } else {
        ic = 'bx-check-circle'; c = 'success'; judul = 'Sudah realisasi';
        ket = rec.status === 'waiting' ? 'Realisasi sudah dikirim dan menunggu verifikasi.' : rec.status === 'approved' ? 'Realisasi sudah disetujui verifikator.' : 'Realisasi sudah dibayar.';
      }
      const jml = (rec?.total || 0) + sakBln;
      $('dreal').innerHTML = `${dashJudul(`Realisasi ${bln} ${y}`)}
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="avatar rounded bg-label-${c}"><i class="bx ${ic} fs-4"></i></div>
          <div class="lh-sm"><div class="fs-4 fw-semibold dash-num" id="dstatus">${judul}</div>${rec ? `<span class="badge ${ST[rec.status][0]} mt-1">${ST[rec.status][1]}</span>` : ''}</div></div>
        <p class="mb-3">${esc(ket)}</p>
        <div class="d-flex flex-wrap gap-4 mb-3">
          <div><div class="small">RPD ${bln}</div><div class="fw-semibold">Rp ${rp(rpdBln)}</div></div>
          <div><div class="small">Realisasi ${bln}</div><div class="fw-semibold">Rp ${rp(jml)}</div>${sakBln ? `<div class="small">termasuk SAKTI Rp ${rp(sakBln)}</div>` : ''}</div>
          ${rec?.status === 'paid' && rec.nominal_dibayar ? `<div><div class="small">Dibayar</div><div class="fw-semibold">Rp ${rp(rec.nominal_dibayar)}</div></div>` : ''}</div>
        ${can('realisasi') ? `<a class="btn btn-primary btn-sm" href="#realisasi">${!rec || rec.status === 'rejected' ? 'Isi Realisasi' : 'Lihat Realisasi'}</a>` : ''}`;
    }
  }

  // ---- 2. Realisasi tahun ini dibanding anggaran BOP ----
  {
    const e = galat(rl, sk, ag);
    if (e) $('dang').innerHTML = `${dashJudul(`Realisasi dibanding anggaran BOP ${y}`)}${note(bantu(e))}`;
    else {
      const st = { paid: 0, approved: 0, waiting: 0, rejected: 0 };
      rl.data.forEach(r => { if (r.status in st) st[r.status] += r.total; });
      const sakti = sk.data.reduce((a, s) => a + s.nominal, 0), total = Object.values(st).reduce((a, n) => a + n, 0) + sakti;
      const ang = ag.data?.[me.kua_id], ada = typeof ang === 'number', p = dashPct(total, ang), lebih = ada && total > ang;
      const rinci = [...Object.keys(st).filter(k => st[k]).map(k => `<span class="badge ${ST[k][0]}">${ST[k][1]}: Rp ${rp(st[k])}</span>`), sakti ? `<span class="badge bg-label-primary">SAKTI: Rp ${rp(sakti)}</span>` : ''].join(' ');
      $('dang').innerHTML = `${dashJudul(`Realisasi dibanding anggaran BOP ${y}`)}
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <div><div class="fs-3 fw-semibold lh-1 dash-num" id="dtotal">Rp ${rp(total)}</div><small>total realisasi ${y}</small></div>
          ${ada ? `<div class="text-end"><div class="fs-3 fw-semibold lh-1 dash-num" id="dpersen">${dashFmtPct(p)}</div><small>dari anggaran</small></div>` : ''}</div>
        ${ada ? `<div class="dash-meter${lebih ? ' over' : ''}" role="progressbar" aria-label="Realisasi terhadap anggaran BOP ${y}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(p, 100))}"><span style="width:${total ? Math.min(100, Math.max(1, p)) : 0}%"></span></div>
          <div class="d-flex flex-wrap justify-content-between gap-2 small mt-2 mb-3"><span>Anggaran BOP ${y}: <b id="dang-n">Rp ${rp(ang)}</b></span><span>${lebih ? 'Melebihi anggaran' : 'Sisa anggaran'}: <b>Rp ${rp(Math.abs(ang - total))}</b></span></div>`
          : `<div class="alert alert-warning py-2 small mb-3">Anggaran BOP ${y} belum ditetapkan admin untuk KUA ini, sehingga persentase belum dapat dihitung.</div>`}
        <div class="d-flex flex-wrap gap-2">${rinci || '<span class="small">Belum ada realisasi tahun ini.</span>'}</div>`;
    }
  }

  // ---- 3. Profil KUA: kepala dan alamat ----
  const profil = () => {
    const e = galat(pg, ku);
    if (e && !ku.data) return $('dprof').innerHTML = `${dashJudul('Profil KUA')}${note(bantu(e))}`;
    const kp = pg.data ? pegKepala(pg.data) : null, alamat = ku.data?.alamat || '';
    $('dprof').innerHTML = `${dashJudul('Profil KUA')}
      <div class="mb-3"><div class="small">KUA</div><div class="fw-semibold" id="dkua">${esc(ku.data?.nama_kua || me.kua || '')}</div></div>
      <div class="mb-3"><div class="small">Kepala KUA</div>${kp
        ? `<div class="fw-semibold" id="dkepala">${esc(kp.nama)}${pegPlt(kp.jabatan) ? ' <span class="small fw-normal">(Plt.)</span>' : ''}</div>
          <div class="small">${kp.nip ? 'NIP ' + esc(pegNip(kp.nip)) + ' · ' : ''}<a href="${esc(pegWa(kp.no_hp))}" target="_blank" rel="noopener noreferrer">${esc(kp.no_hp)}</a></div>`
        : `<div id="dkepala" class="text-muted">Belum diisi.</div><div class="small">${can('pegawai') ? 'Tambahkan pegawai berjabatan <b>Kepala KUA</b> di menu <a href="#pegawai">Pegawai KUA</a>.' : 'Belum ada pegawai berjabatan Kepala KUA.'}</div>`}</div>
      <div><div class="small d-flex align-items-center gap-2">Alamat KUA <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" id="dalamat">${alamat ? 'Ubah' : 'Isi alamat'}</button></div>
        ${alamat ? `<div id="dalamat-teks">${esc(alamat)}</div>` : '<div id="dalamat-teks" class="text-muted">Belum diisi.</div>'}</div>`;
    $('dalamat').onclick = () => jpDlg(`<h5>Alamat KUA</h5>
      <form id="dalf" novalidate>
        <label class="form-label" for="dala">Alamat lengkap ${esc(ku.data?.nama_kua || me.kua || 'KUA')}</label>
        <textarea id="dala" class="form-control" rows="3" maxlength="300" placeholder="mis. Jl. Raya Anjatan No. 1, Kec. Anjatan, Kab. Indramayu">${esc(alamat)}</textarea>
        <div class="form-text"><span id="dalc">${alamat.length}</span>/300 karakter. Kosongkan untuk menghapus alamat.</div>
        <div id="dalm" class="mt-2"></div>
        <div class="d-flex justify-content-end gap-2 mt-3"><button type="button" class="btn btn-outline-secondary" data-x>Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
      </form>`, d => {
      d.className = 'dlg-md';
      const a = d.querySelector('#dala');
      a.oninput = () => { d.querySelector('#dalc').textContent = a.value.length; };
      d.querySelector('[data-x]').onclick = () => d.close();
      d.querySelector('#dalf').onsubmit = async ev => {
        ev.preventDefault();
        const btn = ev.target.querySelector('[type=submit]'); btn.disabled = true;
        const { error } = await sb.rpc('set_alamat_kua', { p_kua: me.kua_id, p_alamat: a.value });
        if (!live(ep)) return d.close();
        btn.disabled = false;
        if (error) return lapor(d.querySelector('#dalm'), error.message, 'danger');
        ku.data = { ...(ku.data || { id: me.kua_id, nama_kua: me.kua }), alamat: a.value.replace(/\s+/g, ' ').trim() || null };
        ku.error = null;
        d.close(); jpToast(ku.data.alamat ? 'Alamat KUA tersimpan.' : 'Alamat KUA dihapus.');
        profil();
      };
    });
  };
  profil();

  // ---- 4. Statistik SDM ----
  {
    const e = galat(pg);
    const kepala = dashJudul('Statistik SDM', can('pegawai') ? '<a class="btn btn-sm btn-outline-primary" href="#pegawai"><i class="bx bx-user-pin"></i> Kelola pegawai</a>' : '');
    if (e) $('dsdm').innerHTML = kepala + note(bantu(e));
    else if (!pg.data.length) $('dsdm').innerHTML = kepala + `<div class="text-center py-4"><i class="bx bx-group fs-1 text-muted"></i><p class="mb-0 mt-2">Belum ada data pegawai ${esc(me.kua || 'KUA')}.${can('pegawai') ? ' Lengkapi di menu <a href="#pegawai">Pegawai KUA</a>.' : ''}</p></div>`;
    else {
      const L = pg.data, c = pegHitung(L), tot = L.length;
      const jab = new Map();   // jabatan yang sama (huruf besar/kecil dan spasi diabaikan) dihitung satu
      L.forEach(p => { const k = p.jabatan.toLowerCase().replace(/\s+/g, ' ').trim(); const o = jab.get(k) || [p.jabatan, 0]; o[1]++; jab.set(k, o); });
      let jb = [...jab.values()].sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0], 'id'));
      if (jb.length > 8) jb = [...jb.slice(0, 7), [`Jabatan lain (${jb.length - 7})`, jb.slice(7).reduce((s, x) => s + x[1], 0)]];
      const gol = ['IV', 'III', 'II', 'I'].map(g => [`Golongan ${g}`, L.filter(p => p.jenis_asn === 'PNS' && String(p.pangkat_golongan || '').split('/')[0] === g).length]);
      $('dsdm').innerHTML = kepala + `
        <div class="row g-3 mb-3">
          <div class="col-6 col-sm-3"><div class="small">Total pegawai</div><div class="fs-3 fw-semibold lh-1 mt-1 dash-num" id="dsdm-total">${tot}</div></div>
          ${PEG_JENIS.map(j => `<div class="col-6 col-sm-3"><div class="small d-flex align-items-center gap-2">${pegSw(j)}${j}</div><div class="fs-3 fw-semibold lh-1 mt-1 dash-num" id="dsdm-${j}">${c[j]}</div><div class="small">${dashFmtPct(dashPct(c[j], tot))}</div></div>`).join('')}</div>
        ${dashSeg(c)}
        <div class="row g-4 mt-1">
          <div class="col-md-6"><div class="fw-semibold mb-2">Jabatan</div>${dashBars(jb)}</div>
          <div class="col-md-6"><div class="fw-semibold mb-2">Golongan PNS</div>${c.PNS ? dashBars(gol) : '<p class="small mb-0">Belum ada pegawai PNS.</p>'}</div></div>`;
    }
  }
}

// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { dashboard: pageDashboard });
