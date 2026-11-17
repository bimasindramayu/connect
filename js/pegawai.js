/* =====================================================================================
   pegawai.js: menu "Pegawai KUA" (pendataan pegawai KUA)
   Data di tabel pegawai (Supabase; bop.sql bagian 13). Yang menentukan siapa boleh apa adalah database (RLS dan trigger pegawai_guard);
   tampilan hanya menyesuaikan:
   - Operator KUA : melihat pegawai KUA-nya sendiri; menambah, mengubah, menghapus, dan memindahkan (transfer) pegawai ke KUA lain.
   - Admin        : melihat dan mengelola pegawai SEMUA KUA (daftar dan rekap per KUA).
   - Peran lain   : bila diberi menu Pegawai KUA di Hak Akses Menu, hanya MELIHAT pegawai semua KUA.
   Aturan isian (NIP 18 angka, HP 08xxxxxxxxxx, pangkat/golongan menurut jenis ASN, jabatan tambahan) sama dengan pegawai_guard di bop.sql;
   database tetap memeriksa ulang. Jenis ASN: PNS, PPPK, PPPK Paruh Waktu (PW), dan Honor. Kepala KUA dan Plt. Kepala KUA adalah jabatan
   TAMBAHAN (kolom jabatan_tambahan) di atas jabatan pokok pegawai yang tetap fungsional (Penghulu, Penyuluh, dan seterusnya).
   Konstanta PEG_ dan fungsi peg... di sini juga dipakai dashboard.js.
   ===================================================================================== */

const PEG_JENIS = ['PNS', 'PPPK', 'PPPK Paruh Waktu', 'Honor'];
// Kode pendek untuk id elemen, dan nama ringkas untuk tempat sempit (kartu, rekap); nama lengkap dipakai di formulir, daftar, dan Excel
const PEG_KODE = { PNS: 'PNS', PPPK: 'PPPK', 'PPPK Paruh Waktu': 'PW', Honor: 'Honor' };
const pegLabel = j => j === 'PPPK Paruh Waktu' ? 'PPPK PW' : j;
// Warna tetap tiap jenis ASN (palet kategorikal: biru, oranye, ungu, aqua). Dalam urutan PEG_JENIS keempatnya lolos uji pemisahan warna untuk
// pasangan yang bersebelahan (batang terbagi, legenda); jenis tidak pernah dibedakan oleh warna saja, karena nama dan angkanya selalu tertulis.
const PEG_WARNA = { PNS: '#2a78d6', PPPK: '#eb6834', 'PPPK Paruh Waktu': '#6250d6', Honor: '#1baf7a' };
// Jabatan tambahan = tugas tambahan di atas jabatan pokok. Hanya untuk PNS dan PPPK; satu orang untuk tiap jabatan di tiap KUA.
const PEG_TAMBAHAN = ['Kepala KUA', 'Plt. Kepala KUA'];
const PEG_TAMBAHAN_JENIS = ['PNS', 'PPPK'];
// [kode, nama pangkat]; kode harus sama dengan pemeriksaan di pegawai_guard (PNS I/a sampai IV/e)
const PEG_GOL_PNS = [['I/a', 'Juru Muda'], ['I/b', 'Juru Muda Tingkat I'], ['I/c', 'Juru'], ['I/d', 'Juru Tingkat I'],
  ['II/a', 'Pengatur Muda'], ['II/b', 'Pengatur Muda Tingkat I'], ['II/c', 'Pengatur'], ['II/d', 'Pengatur Tingkat I'],
  ['III/a', 'Penata Muda'], ['III/b', 'Penata Muda Tingkat I'], ['III/c', 'Penata'], ['III/d', 'Penata Tingkat I'],
  ['IV/a', 'Pembina'], ['IV/b', 'Pembina Tingkat I'], ['IV/c', 'Pembina Utama Muda'], ['IV/d', 'Pembina Utama Madya'], ['IV/e', 'Pembina Utama']];
const PEG_GOL_PPPK = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII'];
// Usulan jabatan pokok yang biasa ada di KUA (Kepala KUA bukan di sini: itu jabatan tambahan). Isian jabatan berupa combobox: pilih dari
// daftar ini atau ketik sendiri (jabatan lain tetap boleh).
const PEG_JABATAN = ['Penghulu Ahli Pertama', 'Penghulu Ahli Muda', 'Penghulu Ahli Madya', 'Penghulu Ahli Utama',
  'Penyuluh Agama Islam Ahli Pertama', 'Penyuluh Agama Islam Ahli Muda', 'Penyuluh Agama Islam Ahli Madya', 'Penyuluh Agama Islam Ahli Utama', 'Penyuluh Agama Islam Non PNS',
  'Penata Layanan Operasional', 'Pengelola Layanan Operasional', 'Pengadministrasi Perkantoran', 'Pengelola Keuangan', 'Bendahara Pengeluaran Pembantu',
  'Operator SIMKAH', 'Pranata Komputer', 'Arsiparis', 'Pelaksana',
  'Pramubakti', 'Petugas Kebersihan', 'Petugas Keamanan', 'Pengemudi'];
const PEG_KOLOM = { nama: 'Nama', nip: 'NIP', jenis_asn: 'Jenis ASN', pangkat_golongan: 'Pangkat/golongan', jabatan: 'Jabatan', jabatan_tambahan: 'Kepala KUA Definitif / Plt.', no_hp: 'No. HP', usia_pensiun: 'Usia pensiun', sumber_usia_pensiun: 'Sumber usia pensiun', tmt_kua: 'TMT di KUA saat ini', tmt_kepala_kua: 'TMT pertama menjabat Kepala KUA', operator_simkah: 'Operator SIMKAH', operator_bop: 'Operator BOP' };
const PEG_AKSI = { tambah: ['bg-success', 'Tambah'], ubah: ['bg-info', 'Ubah'], transfer: ['bg-warning', 'Transfer'], hapus: ['bg-danger', 'Hapus'] };

// 18 angka -> "19800101 200501 1 001" (tanggal lahir, tanggal pengangkatan, jenis kelamin, nomor urut)
const pegNip = s => { const d = String(s ?? '').replace(/\D/g, '').slice(0, 18); return [d.slice(0, 8), d.slice(8, 14), d.slice(14, 15), d.slice(15, 18)].filter(Boolean).join(' '); };
// Isian NIP: hanya angka, dikelompokkan saat mengetik, kursor tetap di tempatnya (cara yang sama dengan fmtIn di bop.js)
const pegNipIn = el => {
  const n = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, '').length;
  el.value = pegNip(el.value);
  let i = 0, c = 0;
  while (i < el.value.length && c < n) if (/\d/.test(el.value[i++])) c++;
  el.setSelectionRange?.(i, i);
};
// Sama dengan pegawai_guard: buang spasi, strip, dan kurung; awalan +62 atau 62 menjadi 0; awalan 8 menjadi 08
const pegHp = s => { let h = String(s ?? '').replace(/[\s().-]/g, '').replace(/^\+?62/, '0'); if (/^8/.test(h)) h = '0' + h; return h; };
const pegWa = hp => 'https://wa.me/62' + String(hp ?? '').replace(/\D/g, '').replace(/^0/, '');
const pegGol = (jenis, g) => {
  if (!g) return '-';
  if (jenis === 'PNS') { const x = PEG_GOL_PNS.find(a => a[0] === g); return x ? `${x[1].replace('Tingkat', 'Tk.')} (${g})` : g; }   // "Penata Muda Tk. I (III/b)": lebih ringkas di tabel
  return `Gol. ${g}`;
};
const pegGolIdx = p => p.jenis_asn === 'PNS' ? PEG_GOL_PNS.findIndex(g => g[0] === p.pangkat_golongan) : p.jenis_asn === 'Honor' ? -1 : PEG_GOL_PPPK.indexOf(p.pangkat_golongan);   // PPPK dan PPPK Paruh Waktu: golongan romawi
// Kepala KUA dan Plt. Kepala KUA = jabatan TAMBAHAN (kolom jabatan_tambahan); jabatan pokok pegawainya tetap fungsional. Kepala yang definitif didahulukan dari Plt.
const pegPeringkat = p => p?.jabatan_tambahan === 'Kepala KUA' ? 2 : p?.jabatan_tambahan === 'Plt. Kepala KUA' ? 1 : 0;
const pegPlt = p => p?.jabatan_tambahan === 'Plt. Kepala KUA';
const pegKepala = list => list.find(p => p.jabatan_tambahan === 'Kepala KUA') || list.find(p => p.jabatan_tambahan === 'Plt. Kepala KUA') || null;
// Data lama (sebelum ada jabatan tambahan): "Kepala KUA" tertulis di kolom jabatan. Dikenali supaya ditandai "Perlu dilengkapi" dan dibantu pengisiannya.
const pegJabatanLama = j => /kepala\s+(kua\b|kantor\s+urusan\s+agama\b)/i.test(j || '');
const pegJabatanLamaSaja = j => /^\s*((plt|plh|pj)\.?\s*)?kepala\s/i.test(j || '');   // jabatan diawali sebutan Kepala (mis. "Kepala KUA", "Plt. Kepala KUA"): dikosongkan di formulir agar jabatan fungsionalnya diisi; teks lamanya tetap terbaca di peringatan
const pegPltLama = j => /\b(plt|plh|pj)\b\.?\s*kepala\s/i.test(j || '');
// Urutan daftar: Kepala KUA, Plt. Kepala KUA, lalu jenis (PNS, PPPK, PPPK PW, Honor), golongan tertinggi, lalu nama
const pegUrut = (a, b) => (pegPeringkat(b) - pegPeringkat(a)) || (PEG_JENIS.indexOf(a.jenis_asn) - PEG_JENIS.indexOf(b.jenis_asn))
  || (pegGolIdx(b) - pegGolIdx(a)) || String(a.nama).localeCompare(String(b.nama), 'id');
const pegHitung = list => { const c = Object.fromEntries(PEG_JENIS.map(j => [j, 0])); list.forEach(p => { if (p.jenis_asn in c) c[p.jenis_asn]++; }); return c; };
const pegWaktu = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }); };
const pegTanggal = iso => { const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; };
// Perkiraan usia pensiun: NIP dipakai untuk memastikan tanggal lahir terbaca; jenjang JF menentukan kelompok usia.
// Hasilnya estimasi awal (58/60/65), bukan penetapan hukum; operator dapat mengganti secara manual.
const pegPensiun = (jabatan, nip) => {
  const n = String(nip ?? '').replace(/\D/g, ''); if (n.length !== 18) return null;
  const y = +n.slice(0, 4), m = +n.slice(4, 6), d = +n.slice(6, 8), t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  const j = String(jabatan ?? '').trim().toLowerCase();
  if (!j || /perlu dilengkapi|kepala\\s+(kua|kantor urusan agama)/i.test(j)) return null;
  if (/\butama\b/.test(j)) return 65;
  if (/\bmadya\b/.test(j)) return 60;
  return 58;
};
const pegPerluDilengkapi = p => pegJabatanLama(p?.jabatan) || /^perlu dilengkapi$/i.test(p?.jabatan || '');
// Kolom jabatan_tambahan belum ada = bop.sql versi terbaru belum dijalankan (website lebih baru dari database)
const pegDbLama = e => e?.code === '42703' || e?.code === 'PGRST204' || /jabatan_tambahan/i.test(e?.message || '');
const PEG_DB_LAMA = 'Database belum diperbarui ke versi terbaru (jenis PPPK Paruh Waktu dan jabatan tambahan). Jalankan bop.sql versi terbaru di SQL Editor Supabase, lalu muat ulang halaman ini.';
const pegGalat = e => pegDbLama(e) ? PEG_DB_LAMA
  : e?.code === '23505' ? (/pegawai_(kepala|plt)_unik/.test(e?.message || '') ? 'Jabatan tambahan itu baru saja diberikan kepada pegawai lain. Muat ulang halaman, lalu periksa daftar pegawai.'
    : 'NIP ini sudah terdaftar (mungkin baru saja ditambahkan pengguna lain). Muat ulang halaman, lalu periksa daftar pegawai.')
  : /row-level security/i.test(e?.message || '') ? 'Anda tidak berhak mengubah data pegawai ini.' : (e?.message || String(e));
// Nama yang diakhiri titik (gelar "M.Ag.") tidak menjadi dua titik bila diikuti titik penutup kalimat
const pegAkhir = n => String(n ?? '').replace(/\.+$/, '');
const pegSw = j => `<i class="peg-sw" style="background:${PEG_WARNA[j]}"></i>`;
// Penanda di sel Jabatan: jabatan tambahan (bila ada) dan tanda "Perlu dilengkapi" untuk data lama yang jabatannya masih tertulis Kepala KUA
const pegBadge = p => {
  const tugas = [p.jabatan_tambahan === 'Kepala KUA' ? 'Kepala KUA Definitif' : p.jabatan_tambahan, p.operator_simkah ? 'Operator SIMKAH' : '', p.operator_bop ? 'Operator BOP' : ''].filter(Boolean);
  return (tugas.length ? `<div class="mt-1 d-flex flex-wrap gap-1">${tugas.map(x => `<span class="badge peg-tb">${esc(x)}</span>`).join('')}</div>` : '')
    + (pegPerluDilengkapi(p) ? '<div class="mt-1"><span class="badge peg-lengkapi" title="Jabatan pokok belum dilengkapi. Ubah data pegawai untuk mengisi jabatan fungsional sebenarnya.">Perlu dilengkapi</span></div>' : '');
};
const pegTile = (label, nilai, jenis) => `<div class="col-6 col-lg"><div class="card h-100"><div class="card-body py-3"><div class="d-flex align-items-center gap-2">${jenis ? pegSw(jenis) : ''}<small>${esc(label)}</small></div><div class="fs-3 fw-semibold lh-1 mt-1 dash-num">${esc(nilai)}</div></div></div></div>`;

async function pagePegawai() {
  const ep = EP, adm = me.role === 'admin', op = me.role === 'operator';
  const kelola = adm || op, pu = !op;   // kelola = tombol tambah/ubah/transfer/hapus tampil (database tetap menegakkan); pu = melihat semua KUA
  if (op && !me.kua_id) return $('view').innerHTML = note('Akun ini belum terhubung ke KUA. Hubungi admin.', 'warning');
  $('view').innerHTML = `<h4 class="mb-1">Pegawai KUA</h4>
    <p class="mb-3">${op ? `Data pegawai <b>${esc(me.kua || 'KUA Anda')}</b>. Tambah, ubah, hapus, atau pindahkan (transfer) pegawai ke KUA lain.`
      : adm ? 'Data pegawai seluruh KUA. Admin dapat menambah, mengubah, menghapus, dan memindahkan pegawai KUA mana pun.' : 'Data pegawai seluruh KUA (hanya lihat).'}</p>
    <div class="row g-3 mb-3" id="pstat"></div>
    <div class="card"><div class="card-body">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        ${pu ? `<div class="btn-group" role="group" aria-label="Tampilan" id="ptabs"><button type="button" class="btn btn-sm btn-primary" data-tab="daftar" aria-pressed="true">Daftar pegawai</button><button type="button" class="btn btn-sm btn-outline-primary" data-tab="rekap" aria-pressed="false">Rekap per KUA</button></div>` : ''}
        <div class="ms-auto d-flex flex-wrap gap-2">
          ${kelola ? '<button type="button" class="btn btn-primary btn-sm" id="padd" disabled><i class="bx bx-plus"></i> Tambah Pegawai</button><button type="button" class="btn btn-outline-primary btn-sm" id="pimp" disabled><i class="bx bx-import"></i> Impor Excel</button><input type="file" id="pfile" class="d-none" accept=".xlsx">' : ''}
          <button type="button" class="btn btn-outline-secondary btn-sm" id="phis"><i class="bx bx-history"></i> Riwayat</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" id="pxls" disabled><i class="bx bx-spreadsheet"></i> Unduh Excel</button></div></div>
      <div id="pgmsg"></div>
      <div class="row g-2 mb-3" id="pflt">
        <div class="col-md-5 col-lg-4"><label class="form-label" for="pq">Cari</label><input id="pq" type="search" class="form-control" placeholder="Nama, NIP, jabatan, atau nomor HP" autocomplete="off"></div>
        ${pu ? '<div class="col-md-4 col-lg-3"><label class="form-label" for="pkf">KUA</label><select id="pkf" class="form-select"><option value="0">Semua KUA</option></select></div>' : ''}
        <div class="col-6 col-md-3 col-lg-2"><label class="form-label" for="pjf">Jenis ASN</label><select id="pjf" class="form-select"><option value="">Semua</option>${PEG_JENIS.map(j => `<option>${j}</option>`).join('')}</select></div></div>
      <div id="ptab">Memuat…</div>
      <p class="small mt-2 mb-0" id="pcnt"></p></div></div>`;

  let rows = [], kuas = [], kn = {}, tab = 'daftar';
  const F = { q: '', jenis: '', kua: 0 };   // penyaring; operator selalu terikat ke KUA-nya sendiri oleh database (RLS)
  const norm = s => String(s ?? '').toLowerCase();
  const filtered = () => {
    const q = norm(F.q).trim(), qd = /^[\d\s+-]+$/.test(q) ? q.replace(/\D/g, '') : '';
    return rows.filter(p => (!F.kua || p.kua_id === F.kua) && (!F.jenis || p.jenis_asn === F.jenis) && (!q
      || [p.nama, p.nip, p.jabatan, p.jabatan_tambahan, p.no_hp, kn[p.kua_id]].some(x => norm(x).includes(q)) || (qd.length >= 3 && ((p.nip || '').includes(qd) || (p.no_hp || '').includes(qd)))));
  };
  const urut = (a, b) => (pu ? String(kn[a.kua_id] || '').localeCompare(String(kn[b.kua_id] || ''), 'id') : 0) || pegUrut(a, b);

  const load = async () => {
    try {
      const [k, r] = await Promise.all([
        sb.from('kua').select('id,nama_kua,status').order('nama_kua'),
        fetchAll(() => sb.from('pegawai').select('id,kua_id,nama,nip,jenis_asn,pangkat_golongan,jabatan,jabatan_tambahan,no_hp,usia_pensiun,sumber_usia_pensiun,tmt_kua,tmt_kepala_kua,operator_simkah,operator_bop').order('id'))
      ]);
      if (k.error) throw k.error;
      if (!live(ep)) return false;
      kuas = k.data; kn = Object.fromEntries(kuas.map(x => [x.id, x.nama_kua])); rows = r;
      return true;
    } catch (e) {
      if (!live(ep)) return false;
      $('ptab').innerHTML = note(pegDbLama(e) ? PEG_DB_LAMA : /pegawai|schema cache|relation/i.test(e.message || '')
        ? 'Tabel pegawai belum ada. Jalankan bop.sql versi terbaru di SQL Editor Supabase, lalu muat ulang halaman ini.' : (e.message || String(e)));
      return false;
    }
  };

  const drawStat = () => {
    const sc = rows.filter(p => !F.kua || p.kua_id === F.kua), c = pegHitung(sc), terisi = new Set(rows.map(p => p.kua_id)).size;
    $('pstat').innerHTML = pegTile('Total pegawai', sc.length) + PEG_JENIS.map(j => pegTile(pegLabel(j), c[j], j)).join('')
      + (pu && !F.kua ? pegTile('KUA yang sudah terisi', `${terisi} dari ${kuas.length}`) : '');
  };
  const baris = (p, i) => `<tr>
    <td class="text-muted">${i + 1}</td>
    ${pu ? `<td>${esc(kn[p.kua_id] || '')}</td>` : ''}
    <td class="fw-semibold">${esc(p.nama)}</td>
    <td class="text-nowrap">${p.nip ? esc(pegNip(p.nip)) : '<span class="text-muted">-</span>'}</td>
    <td><span class="peg-jenis" title="${esc(p.jenis_asn)}">${pegSw(p.jenis_asn)}${esc(pegLabel(p.jenis_asn))}</span></td>
    <td>${esc(pegGol(p.jenis_asn, p.pangkat_golongan))}</td>
    <td class="peg-jab">${esc(p.jabatan)}${pegBadge(p)}</td>
    <td class="text-nowrap">${esc(pegTanggal(p.tmt_kua))}</td>
    <td class="text-nowrap">${esc(pegTanggal(p.tmt_kepala_kua))}</td>
    <td class="text-nowrap">${p.usia_pensiun ? `${esc(p.usia_pensiun)} tahun${p.sumber_usia_pensiun === 'MANUAL' ? ' <span class="small text-muted">(manual)</span>' : ''}` : '-'}</td>
    <td class="text-nowrap">${p.no_hp ? `<a href="${esc(pegWa(p.no_hp))}" target="_blank" rel="noopener noreferrer" title="Buka WhatsApp">${esc(p.no_hp)}</a>` : '<span class="text-muted">-</span>'}</td>
    ${kelola ? `<td class="text-end text-nowrap peg-act">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-e="${p.id}" title="Ubah" aria-label="Ubah ${esc(p.nama)}"><i class="bx bx-edit"></i></button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-t="${p.id}" title="Transfer ke KUA lain" aria-label="Transfer ${esc(p.nama)} ke KUA lain"><i class="bx bx-transfer-alt"></i></button>
      <button type="button" class="btn btn-sm btn-outline-danger" data-d="${p.id}" title="Hapus" aria-label="Hapus ${esc(p.nama)}"><i class="bx bx-trash"></i></button></td>` : ''}</tr>`;
  const drawDaftar = () => {
    const list = filtered().sort(urut), cols = 10 + (pu ? 1 : 0) + (kelola ? 1 : 0);
    $('ptab').innerHTML = `<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>No</th>${pu ? '<th>KUA</th>' : ''}<th>Nama lengkap + gelar</th><th>NIP</th><th>Jenis ASN</th><th>Pangkat / golongan</th><th>Jabatan / tugas tambahan</th><th>TMT di KUA</th><th>TMT Kepala KUA</th><th>Usia pensiun</th><th>HP / WA</th>${kelola ? '<th class="text-end">Aksi</th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(baris).join('') : `<tr><td colspan="${cols}" class="text-center py-4">${rows.length ? 'Tidak ada pegawai yang cocok dengan penyaring.'
        : op ? 'Belum ada data pegawai. Klik <b>Tambah Pegawai</b> untuk mulai mengisi.' : 'Belum ada data pegawai.'}</td></tr>`}</tbody></table></div>`;
    $('pcnt').textContent = list.length ? `Menampilkan ${list.length} dari ${rows.length} pegawai.` : '';
  };
  const drawRekap = () => {
    const by = new Map(kuas.map(k => [k.id, []])), T = Object.fromEntries([...PEG_JENIS, 'n'].map(j => [j, 0]));
    rows.forEach(p => by.get(p.kua_id)?.push(p));
    const trs = kuas.map(k => {
      const l = by.get(k.id), c = pegHitung(l), kp = pegKepala(l);
      PEG_JENIS.forEach(j => T[j] += c[j]); T.n += l.length;
      return `<tr><td><button type="button" class="btn btn-link p-0 text-start" data-kua="${k.id}" title="Lihat daftar pegawai ${esc(k.nama_kua)}">${esc(k.nama_kua)}</button></td>
        <td>${kp ? esc(kp.nama) + (pegPlt(kp) ? ' <span class="small text-muted">(Plt.)</span>' : '') : '<span class="text-muted">Belum diisi</span>'}</td>
        ${PEG_JENIS.map(j => `<td class="text-end">${c[j]}</td>`).join('')}
        <td class="text-end fw-semibold">${l.length}${l.length ? '' : ' <span class="badge bg-secondary">Belum ada data</span>'}</td></tr>`;
    }).join('');
    $('ptab').innerHTML = `<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>KUA</th><th>Kepala KUA</th>${PEG_JENIS.map(j => `<th class="text-end" title="${esc(j)}">${esc(pegLabel(j))}</th>`).join('')}<th class="text-end">Total</th></tr></thead>
      <tbody>${trs}</tbody><tfoot><tr><td colspan="2">Seluruh KUA</td>${PEG_JENIS.map(j => `<td class="text-end">${T[j]}</td>`).join('')}<td class="text-end">${T.n}</td></tr></tfoot></table></div>`;
    $('pcnt').textContent = `${new Set(rows.map(p => p.kua_id)).size} dari ${kuas.length} KUA sudah mengisi data pegawai.`;
  };
  const draw = () => {
    drawStat();
    $('pflt').classList.toggle('d-none', tab === 'rekap');
    $('pxls').classList.toggle('d-none', tab === 'rekap');
    if (kelola) $('pimp').classList.toggle('d-none', tab === 'rekap');
    if (tab === 'rekap') drawRekap(); else drawDaftar();
  };
  const refresh = async () => { if (await load()) { draw(); } };

  // ---- Tambah / ubah ----
  const form = p => {
    const baru = !p, kid0 = p ? p.kua_id : op ? me.kua_id : (F.kua || 0);
    // Data lama: "Kepala KUA" masih tertulis di kolom jabatan (sebelum ada jabatan tambahan). Isiannya dibantu: jabatan dikosongkan agar diisi
    // jabatan fungsionalnya, dan jabatan tambahan terpilih sesuai teks lama (Plt. atau Kepala).
    const lama = !baru && pegPerluDilengkapi(p), jab0 = lama ? '' : p?.jabatan;
    const tb0 = p?.jabatan_tambahan || (!baru && pegJabatanLama(p.jabatan) && PEG_TAMBAHAN_JENIS.includes(p.jenis_asn) ? (pegPltLama(p.jabatan) ? 'Plt. Kepala KUA' : 'Kepala KUA') : '');
    jpDlg(`<h5>${baru ? 'Tambah Pegawai' : 'Ubah Pegawai'}</h5>
      <form id="pfm" novalidate autocomplete="off">
        ${lama ? `<div class="alert alert-warning py-2 small" id="pflama">Jabatan pokok pegawai ini belum dilengkapi pada data sumber. Isi kolom <b>Jabatan</b> dengan jabatan sebenarnya (mis. Penghulu atau Penyuluh), lalu simpan. Status Kepala KUA tetap diatur secara terpisah.</div>` : ''}
        <div id="pfmsg"></div>
        <div class="row g-3">
          <div class="col-12">${baru && adm
            ? `<label class="form-label" for="pfk">KUA <span class="text-danger">*</span></label><select id="pfk" class="form-select"><option value="">Pilih KUA…</option>${kuas.map(k => `<option value="${k.id}"${k.id === kid0 ? ' selected' : ''}>${esc(k.nama_kua)}</option>`).join('')}</select>`
            : `<div class="small">KUA: <b>${esc(kn[kid0] || me.kua || '')}</b>${baru ? '' : '. Untuk memindahkan ke KUA lain gunakan Transfer.'}</div>`}</div>
          <div class="col-12"><label class="form-label" for="pfn">Nama lengkap beserta gelar <span class="text-danger">*</span></label>
            <input id="pfn" class="form-control" maxlength="150" placeholder="mis. Drs. H. Ahmad Fauzi, M.Ag." value="${esc(p?.nama)}"></div>
          <div class="col-12"><div class="form-label" id="pfjl">Jenis ASN <span class="text-danger">*</span></div>
            <div class="row g-2" role="group" aria-labelledby="pfjl">${PEG_JENIS.map(j => `<div class="col-6"><input type="radio" class="btn-check" name="pfj" id="pfj-${PEG_KODE[j]}" value="${j}"${p?.jenis_asn === j ? ' checked' : ''}><label class="btn btn-outline-primary w-100" for="pfj-${PEG_KODE[j]}">${j === 'PPPK Paruh Waktu' ? 'PPPK Paruh Waktu (PW)' : j}</label></div>`).join('')}</div></div>
          <div class="col-sm-6"><label class="form-label" for="pfi">NIP</label><input id="pfi" class="form-control" inputmode="numeric" maxlength="21" value="${esc(pegNip(p?.nip))}"><div class="form-text" id="pfih"></div></div>
          <div class="col-sm-6"><label class="form-label" for="pfg">Pangkat / golongan</label><select id="pfg" class="form-select"></select></div>
          <div class="col-12"><label class="form-label" for="pfb">Jabatan <span class="text-danger">*</span></label>
            <input id="pfb" class="form-control" list="pfbl" maxlength="100" placeholder="Pilih dari daftar atau ketik sendiri" value="${esc(jab0)}">
            <datalist id="pfbl">${PEG_JABATAN.map(j => `<option value="${esc(j)}"></option>`).join('')}</datalist>
            <div class="form-text">Jabatan pokok pegawai, mis. Penghulu atau Penyuluh Agama. Klik kolom ini untuk melihat jabatan yang biasa ada di KUA; jabatan lain boleh diketik sendiri. Kepala KUA tidak diisi di sini, melainkan di Jabatan Tambahan.</div></div>
          <div class="col-12"><label class="form-label" for="pft">Jabatan tambahan Kepala KUA</label>
            <select id="pft" class="form-select"><option value="">Tidak ada</option>${PEG_TAMBAHAN.map(t => `<option value="${esc(t)}"${t === tb0 ? ' selected' : ''}>${esc(t === 'Kepala KUA' ? 'Kepala KUA Definitif' : t)}</option>`).join('')}</select>
            <div class="form-text" id="pfth">Status definitif atau Plt. Kepala KUA ditetapkan di sini.</div></div>
          <div class="col-12"><div class="form-label">Penugasan tambahan operator</div><div class="row g-2">
            <div class="col-sm-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="pfos"${p?.operator_simkah ? ' checked' : ''}><label class="form-check-label" for="pfos">Operator SIMKAH</label></div></div>
            <div class="col-sm-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="pfob"${p?.operator_bop ? ' checked' : ''}><label class="form-check-label" for="pfob">Operator BOP</label></div></div>
          </div><div class="form-text">Operator SIMKAH dan Operator BOP dapat dirangkap oleh Kepala KUA Definitif maupun Plt., termasuk dirangkap sekaligus.</div></div>
          <div class="col-md-6"><label class="form-label" for="pfup">Usia pensiun (tahun)</label><input id="pfup" type="number" min="40" max="75" step="1" class="form-control" value="${esc(p?.usia_pensiun ?? '')}"><div class="form-text">Perkiraan awal berdasarkan jenjang jabatan dan tanggal lahir pada NIP.</div></div>
          <div class="col-md-6"><label class="form-label" for="pfus">Sumber usia pensiun</label><div class="input-group"><select id="pfus" class="form-select"><option value="AUTO"${(p?.sumber_usia_pensiun || (!p?.usia_pensiun ? 'AUTO' : 'MANUAL')) === 'AUTO' ? ' selected' : ''}>Otomatis</option><option value="MANUAL"${p?.sumber_usia_pensiun === 'MANUAL' || (!p?.sumber_usia_pensiun && p?.usia_pensiun) ? ' selected' : ''}>Manual</option></select><button type="button" class="btn btn-outline-secondary" id="pfua" title="Hitung ulang dari jabatan dan NIP">Hitung</button></div></div>
          <div class="col-md-6" id="pftmt-wrap"><label class="form-label" for="pftmt">TMT di KUA saat ini</label><input id="pftmt" type="date" class="form-control" value="${esc(p?.tmt_kua || '')}"></div>
          <div class="col-md-6 d-none" id="pftmtk-wrap"><label class="form-label" for="pftmtk">TMT pertama kali menjabat Kepala KUA</label><input id="pftmtk" type="date" class="form-control" value="${esc(p?.tmt_kepala_kua || '')}"></div>
          <div class="col-12"><label class="form-label" for="pfh">Nomor HP / WA aktif <span class="text-danger">*</span></label>
            <input id="pfh" class="form-control" type="tel" inputmode="tel" maxlength="20" placeholder="mis. 081234567890" value="${esc(p?.no_hp)}">
            <div class="form-text">Nomor aktif yang dapat dihubungi lewat WhatsApp. Boleh diawali 08 atau +62.</div></div>
        </div>
        <div class="d-flex flex-wrap justify-content-end gap-2 mt-4">
          <button type="button" class="btn btn-outline-secondary" data-x>Batal</button>
          ${baru ? '<button type="button" class="btn btn-outline-primary" id="pfmx">Simpan dan tambah lagi</button>' : ''}
          <button type="submit" class="btn btn-primary" id="pfms">Simpan</button></div>
      </form>`, d => {
      d.className = 'dlg-md';
      const f = d.querySelector('#pfm'), el = id => d.querySelector('#' + id), jenis = () => f.querySelector('input[name=pfj]:checked')?.value || '';
      const kuaForm = () => baru ? (adm ? +el('pfk').value || 0 : me.kua_id) : p.kua_id;
      const pegang = (t, kua, semua) => rows.find(x => x.kua_id === kua && x.jabatan_tambahan === t && (semua || x.id !== p?.id));   // pemegang jabatan tambahan t di KUA itu; selain pegawai ini, kecuali semua = true
      const nipInfo = () => {
        const j = jenis(), n = el('pfi').value.replace(/\D/g, '').length;
        el('pfih').textContent = j === 'Honor' ? 'Pegawai Honor tidak memiliki NIP dan pangkat/golongan.'
          : j === 'PPPK Paruh Waktu' ? `Boleh dikosongkan bila belum memiliki NIP. Bila diisi harus 18 angka. Terisi ${n} angka.`
          : j ? `18 angka (spasi boleh). Terisi ${n} angka.` : 'Pilih jenis ASN terlebih dahulu.';
      };
      const syncTmt = () => {
        const j = jenis(), tb = el('pft').value;
        const adaTmt = ['PNS','PPPK','PPPK Paruh Waktu'].includes(j);
        el('pftmt-wrap').classList.toggle('d-none', !adaTmt); el('pftmt').disabled = !adaTmt;
        const kepala = !!tb && PEG_TAMBAHAN_JENIS.includes(j);
        el('pftmtk-wrap').classList.toggle('d-none', !kepala); el('pftmtk').disabled = !kepala;
        if (!adaTmt) el('pftmt').value = '';
        if (!kepala) el('pftmtk').value = '';
      };
      const syncPensiun = force => {
        if (force || el('pfus').value === 'AUTO') {
          const usia = pegPensiun(el('pfb').value, el('pfi').value);
          el('pfup').value = usia ?? '';
          el('pfus').value = 'AUTO';
        }
      };
      const tambahanInfo = () => {   // jabatan tambahan hanya untuk PNS dan PPPK; tampilkan siapa yang kini memegang di KUA ini
        const j = jenis(), s = el('pft'), kua = kuaForm(), boleh = PEG_TAMBAHAN_JENIS.includes(j), h = el('pfth');
        if (!boleh) s.value = '';
        s.disabled = !boleh;
        if (!j) h.textContent = 'Pilih jenis ASN terlebih dahulu. Jabatan tambahan hanya untuk PNS dan PPPK.';
        else if (!boleh) h.textContent = 'Jabatan tambahan hanya untuk pegawai PNS atau PPPK.';
        else if (!kua) h.textContent = 'Pilih KUA terlebih dahulu.';
        else {
          const ada = PEG_TAMBAHAN.map(t => { const x = pegang(t, kua, true); return x ? `${t}: <b>${esc(x.nama)}</b>${x.id === p?.id ? ' (pegawai ini)' : ''}` : `${t}: belum ada`; }).join('; '), b = s.value && pegang(s.value, kua);
          h.innerHTML = `Tugas tambahan di KUA ini. Saat ini ${ada}` + (b ? `<div class="text-danger">${esc(s.value)} masih dijabat ${esc(b.nama)}: lepaskan dulu dari ${esc(b.nama)} (ubah data pegawainya).</div>` : '');
        }
      };
      const syncJenis = awal => {   // jenis ASN menentukan isian NIP, pilihan pangkat/golongan, dan jabatan tambahan
        const j = jenis(), g = el('pfg'), i = el('pfi'), keep = awal ? p?.pangkat_golongan : g.value, pw = j === 'PPPK Paruh Waktu';
        g.innerHTML = j === 'PNS' || j === 'PPPK' || pw
          ? `<option value="">${pw ? 'Tidak diisi / belum ada' : 'Pilih…'}</option>` + (j === 'PNS' ? PEG_GOL_PNS.map(([k, n]) => [k, `${k} · ${n}`]) : PEG_GOL_PPPK.map(k => [k, `Golongan ${k}`]))
            .map(([k, t]) => `<option value="${k}"${k === keep ? ' selected' : ''}>${esc(t)}</option>`).join('')
          : '<option value="">-</option>';
        g.disabled = i.disabled = !(j === 'PNS' || j === 'PPPK' || pw);
        if (j === 'Honor') i.value = '';
        nipInfo(); tambahanInfo(); syncTmt(); syncPensiun(false);
      };
      f.addEventListener('change', e => {
        if (e.target.name === 'pfj') syncJenis();
        else if (e.target.id === 'pfk' || e.target.id === 'pft') { tambahanInfo(); syncTmt(); }
        else if (e.target.id === 'pfus' && e.target.value === 'AUTO') syncPensiun(true);
      });
      f.addEventListener('input', e => {
        e.target.classList.remove('is-invalid');
        if (e.target.id === 'pfi') { pegNipIn(e.target); nipInfo(); syncPensiun(false); }
        else if (e.target.id === 'pfb') syncPensiun(false);
        else if (e.target.id === 'pfup') el('pfus').value = 'MANUAL';
      });
      el('pfua').onclick = () => syncPensiun(true);
      el('pfh').onblur = () => { el('pfh').value = pegHp(el('pfh').value); };
      syncJenis(true); syncTmt(); if (!el('pfup').value) syncPensiun(true);
      d.querySelector('[data-x]').onclick = () => d.close();

      const salah = (c, m) => { c.classList.add('is-invalid'); c.focus(); el('pfmsg').innerHTML = note(m); return null; };
      const cek = () => {   // sama dengan pegawai_guard (bop.sql); database tetap memeriksa ulang
        const nama = el('pfn').value.replace(/\s+/g, ' ').trim(), jab = el('pfb').value.replace(/\s+/g, ' ').trim(), j = jenis(), hp = pegHp(el('pfh').value);
        const nip = el('pfi').value.replace(/\D/g, ''), gol = el('pfg').value, kua = kuaForm(), tb = PEG_TAMBAHAN_JENIS.includes(j) ? el('pft').value : '';
        const usia = el('pfup').value ? Number(el('pfup').value) : null;
        const tmtKua = ['PNS','PPPK','PPPK Paruh Waktu'].includes(j) ? (el('pftmt').value || null) : null;
        const tmtKepala = tb ? (el('pftmtk').value || null) : null;
        el('pfmsg').innerHTML = '';
        if (!kua) return salah(el('pfk'), 'Pilih KUA pegawai.');
        if (!nama) return salah(el('pfn'), 'Nama lengkap wajib diisi.');
        if (nama.length > 150) return salah(el('pfn'), 'Nama lengkap maksimal 150 karakter.');
        if (!j) return salah(f.querySelector('input[name=pfj]'), 'Pilih jenis ASN: PNS, PPPK, PPPK Paruh Waktu, atau Honor.');
        if (j === 'PNS' || j === 'PPPK') {
          if (!nip) return salah(el('pfi'), `NIP wajib diisi untuk pegawai ${j}.`);
          if (nip.length !== 18) return salah(el('pfi'), `NIP harus 18 angka. Yang diisi: ${nip.length} angka.`);
          if (!gol) return salah(el('pfg'), j === 'PNS' ? 'Pangkat/golongan PNS wajib dipilih.' : 'Golongan PPPK wajib dipilih.');
        } else if (j === 'PPPK Paruh Waktu' && nip && nip.length !== 18) return salah(el('pfi'), `NIP harus 18 angka bila diisi. Yang diisi: ${nip.length} angka. Kosongkan bila belum memiliki NIP.`);
        if (!jab) return salah(el('pfb'), 'Jabatan wajib diisi.');
        if (jab.length > 100) return salah(el('pfb'), 'Jabatan maksimal 100 karakter.');
        if (pegJabatanLama(jab)) return salah(el('pfb'), 'Kepala KUA dan Plt. Kepala KUA adalah jabatan tambahan. Isi kolom Jabatan dengan jabatan fungsional pegawai (mis. Penghulu atau Penyuluh), lalu pilih Kepala KUA di Jabatan Tambahan.');
        const b = tb && pegang(tb, kua);
        if (b) return salah(el('pft'), `${tb} di KUA ini sudah dijabat oleh ${pegAkhir(b.nama)}. Lepaskan jabatan tambahan itu dari ${b.nama} terlebih dahulu (ubah data pegawainya), lalu tetapkan di sini.`);
        if (usia !== null && (!Number.isInteger(usia) || usia < 40 || usia > 75)) return salah(el('pfup'), 'Usia pensiun harus berupa angka 40 sampai 75 tahun.');
        if (!/^08\d{8,12}$/.test(hp)) return salah(el('pfh'), 'Nomor HP/WA tidak valid. Isi nomor aktif 10 sampai 14 angka yang diawali 08 (contoh 081234567890) atau +62.');
        return { kua, data: { nama, jenis_asn: j, nip: j === 'Honor' ? null : (nip || null), pangkat_golongan: j === 'Honor' ? null : (gol || null), jabatan: jab, jabatan_tambahan: tb || null, no_hp: hp,
          usia_pensiun: usia, sumber_usia_pensiun: usia === null ? null : el('pfus').value, tmt_kua: tmtKua, tmt_kepala_kua: tmtKepala,
          operator_simkah: el('pfos').checked, operator_bop: el('pfob').checked } };
      };
      const kirim = async lagi => {
        const v = cek();
        if (!v) return;
        const bs = [...f.querySelectorAll('button')]; bs.forEach(b => b.disabled = true);
        let err = null;
        if (baru) err = (await sb.from('pegawai').insert({ kua_id: v.kua, ...v.data })).error;
        else {   // RLS menyembunyikan baris yang bukan hak operator: 0 baris berubah = bukan galat dari server, jadi diperiksa sendiri
          const r = await sb.from('pegawai').update(v.data).eq('id', p.id).select('id');
          err = r.error || (r.data?.length ? null : { message: 'Pegawai ini sudah tidak ada di KUA Anda (dipindahkan atau dihapus). Muat ulang halaman.' });
        }
        if (!live(ep)) return d.close();
        bs.forEach(b => b.disabled = false);
        if (err) return lapor(el('pfmsg'), pegGalat(err), 'danger');
        jpToast(baru ? `${v.data.nama} ditambahkan.` : `Data ${v.data.nama} diperbarui.`);
        await refresh();
        if (!lagi) return d.close();
        const kua = el('pfk')?.value;   // tambah lagi: kosongkan isian, KUA pilihan Admin tetap
        f.reset(); if (kua != null && el('pfk')) el('pfk').value = kua;
        syncJenis(); syncTmt(); syncPensiun(true); el('pfmsg').innerHTML = note(`${v.data.nama} tersimpan. Isi pegawai berikutnya.`, 'success'); el('pfn').focus();
      };
      f.onsubmit = e => { e.preventDefault(); kirim(false); };
      if (el('pfmx')) el('pfmx').onclick = () => kirim(true);
    });
  };

  // ---- Transfer antar KUA ----
  const transfer = p => {
    const tujuan = kuas.filter(k => k.id !== p.kua_id && k.status === 'aktif');
    jpDlg(`<h5>Transfer Pegawai</h5>
      <p class="mb-3"><b>${esc(p.nama)}</b><br><span class="small">${esc(p.jabatan)} · KUA asal: <b>${esc(kn[p.kua_id] || '')}</b></span></p>
      ${p.jabatan_tambahan ? `<div class="alert alert-warning py-2 small mb-3" id="ptlepas">${esc(p.nama)} saat ini <b>${esc(p.jabatan_tambahan)}</b>. Jabatan tambahan itu melekat pada KUA asal, jadi <b>dikosongkan</b> saat transfer; Operator KUA asal perlu menetapkan penggantinya.</div>` : ''}
      <label class="form-label" for="ptk">KUA tujuan</label>
      <select id="ptk" class="form-select"><option value="">Pilih KUA tujuan…</option>${tujuan.map(k => `<option value="${k.id}">${esc(k.nama_kua)}</option>`).join('')}</select>
      <div class="alert alert-info py-2 small mt-3 mb-3">Pegawai langsung berpindah ke KUA tujuan dan tidak lagi tampil di daftar KUA asal. Perpindahan tercatat di Riwayat; Operator KUA tujuan dapat memindahkannya kembali bila keliru.</div>
      <div id="ptmsg"></div>
      <div class="d-flex justify-content-end gap-2"><button type="button" class="btn btn-outline-secondary" data-x>Batal</button><button type="button" class="btn btn-primary" data-ok>Transfer</button></div>`, d => {
      d.className = 'dlg-md';
      d.querySelector('[data-x]').onclick = () => d.close();
      d.querySelector('[data-ok]').onclick = async e => {
        const k = +d.querySelector('#ptk').value, msg = d.querySelector('#ptmsg');
        if (!k) return lapor(msg, 'Pilih KUA tujuan terlebih dahulu.', 'warning');
        e.target.disabled = true;
        const { error } = await sb.rpc('pegawai_transfer', { p_id: p.id, p_kua: k });
        if (!live(ep)) return d.close();
        if (error) { e.target.disabled = false; return lapor(msg, pegGalat(error), 'danger'); }
        await refresh();   // tombol tetap nonaktif selama tabel disegarkan; dialog ditutup dan pesan tampil setelah tabel mutakhir
        if (!live(ep)) return d.close();
        d.close(); jpToast(`${p.nama} dipindahkan ke ${kn[k]}.`);
      };
    });
  };

  // ---- Hapus ----
  const hapus = p => jpAsk('Hapus pegawai?', `${p.nama}${p.nip ? ' (NIP ' + pegNip(p.nip) + ')' : ''} akan dihapus dari data pegawai ${kn[p.kua_id] || 'KUA'}. Penghapusan tercatat di Riwayat. Bila pegawai ini hanya pindah tugas, gunakan Transfer.`, 'Hapus', async () => {
    const { data, error } = await sb.from('pegawai').delete().eq('id', p.id).select('id');
    if (!live(ep)) return;
    if (error) return lapor($('pgmsg'), pegGalat(error), 'danger');
    if (!data?.length) return lapor($('pgmsg'), 'Pegawai tidak ditemukan atau Anda tidak berhak menghapusnya. Muat ulang halaman.', 'warning');
    await refresh();   // tabel diperbarui dulu, baru pesan sukses (pesan tidak mendahului tabel)
    if (live(ep)) lapor($('pgmsg'), `${p.nama} dihapus dari data pegawai.`, 'success');
  }, true);

  // ---- Riwayat ----
  const riwayat = async () => {
    jpDlg(`<h5>Riwayat Pegawai</h5>
      <p class="small mb-3">${op ? `Perubahan data, transfer masuk dan keluar, serta penghapusan pegawai ${esc(me.kua || 'KUA Anda')}` : 'Perubahan data, transfer, dan penghapusan pegawai semua KUA'} (200 catatan terbaru).</p>
      <div id="prbody">Memuat…</div>
      <div class="d-flex justify-content-end mt-3"><button type="button" class="btn btn-outline-secondary" data-x>Tutup</button></div>`, d => {
      d.className = 'dlg-lg'; d.querySelector('[data-x]').onclick = () => d.close();
    });
    const { data, error } = await sb.from('pegawai_riwayat').select('id,waktu,aksi,nama,nip,dari_kua,ke_kua,oleh_nama,rincian')
      .order('waktu', { ascending: false }).order('id', { ascending: false }).limit(200);
    const box = $('prbody');
    if (!box || !live(ep)) return;
    if (error) return box.innerHTML = note(/pegawai_riwayat|schema cache/i.test(error.message) ? 'Tabel riwayat belum ada. Jalankan bop.sql versi terbaru di SQL Editor Supabase.' : error.message);
    const n = k => kn[k] || 'KUA lain', v = x => x == null || x === '' ? '-' : String(x);
    const ket = r => {
      if (r.aksi === 'tambah') return `Ditambahkan ke ${n(r.ke_kua)}`;
      if (r.aksi === 'hapus') return `Dihapus dari ${n(r.dari_kua)}`;
      if (r.aksi === 'transfer') {
        const lepas = Array.isArray(r.rincian?.jabatan_tambahan) && r.rincian.jabatan_tambahan[0] ? ` (jabatan tambahan ${r.rincian.jabatan_tambahan[0]} dilepas)` : '';
        return (op ? (r.ke_kua === me.kua_id ? `Pindah masuk dari ${n(r.dari_kua)}` : `Dipindahkan ke ${n(r.ke_kua)}`) : `${n(r.dari_kua)} → ${n(r.ke_kua)}`) + lepas;
      }
      return Object.entries(r.rincian || {}).filter(([, a]) => Array.isArray(a))
        .map(([k, [a, b]]) => `${PEG_KOLOM[k] || k}: ${k === 'nip' ? v(pegNip(a)) : v(a)} → ${k === 'nip' ? v(pegNip(b)) : v(b)}`).join('; ');
    };
    box.innerHTML = data.length ? `<div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Waktu</th><th>Aksi</th><th>Pegawai</th><th>Keterangan</th><th>Oleh</th></tr></thead><tbody>${data.map(r => {
      const a = PEG_AKSI[r.aksi] || ['bg-secondary', r.aksi];
      return `<tr><td class="text-nowrap">${esc(pegWaktu(r.waktu))}</td><td><span class="badge ${a[0]}">${esc(a[1])}</span></td><td>${esc(r.nama)}${r.nip ? `<div class="small">${esc(pegNip(r.nip))}</div>` : ''}</td><td>${esc(ket(r))}</td><td>${esc(r.oleh_nama || '-')}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="text-center py-3 mb-0">Belum ada riwayat.</p>';
  };

  // ---- Impor XLSX ----
  const imporExcel = async file => {
    if (!file) return;
    const tombol = $('pimp');
    if (tombol) tombol.disabled = true;
    lapor($('pgmsg'), `Membaca ${file.name}…`, 'info');
    try {
      await loadJs(CDN.exceljs);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 2) throw new Error('File Excel tidak memiliki baris data.');
      const kunci = v => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const teks = v => {
        if (v == null) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        if (typeof v === 'object') {
          if (v.result != null) return teks(v.result);
          if (v.text != null) return String(v.text).trim();
          if (Array.isArray(v.richText)) return v.richText.map(x => x.text || '').join('').trim();
        }
        return String(v).trim();
      };
      const tanggal = v => {
        if (v == null || v === '') return null;
        if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
        if (typeof v === 'number' && Number.isFinite(v)) {
          const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
          return isNaN(d) ? null : d.toISOString().slice(0, 10);
        }
        const x = String(v).trim();
        let m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = x.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return null;
      };
      const header = new Map();
      ws.getRow(1).eachCell((cell, col) => header.set(kunci(teks(cell.value)), col));
      const kolom = (...names) => names.map(kunci).map(x => header.get(x)).find(Boolean);
      const ambil = (row, ...names) => { const i = kolom(...names); return i ? teks(row.getCell(i).value) : ''; };
      if (!kolom('Nama') || !kolom('Tempat Tugas') || !kolom('Jenis Pegawai') || !kolom('Jabatan') || !kolom('NIP')) {
        throw new Error('Header wajib tidak ditemukan. Gunakan template pendataan dengan kolom Nama, Tempat Tugas, Jenis Pegawai, Jabatan, dan NIP.');
      }
      const normKua = x => kunci(x).replace(/^kua/, '');
      const cariKua = name => {
        const key = normKua(name);
        return kuas.find(k => normKua(k.nama_kua) === key)
          || kuas.find(k => normKua(k.nama_kua).includes(key) || key.includes(normKua(k.nama_kua)));
      };
      const roman = PEG_GOL_PPPK.slice().sort((a,b) => b.length-a.length);
      const golongan = (jenis, x) => {
        const t = String(x || '').toUpperCase();
        if (jenis === 'PNS') { const m = t.match(/\b((?:I{1,3}|IV)\/[A-E])\b/); return m ? m[1].replace(/\/([A-E])$/, (_, c) => '/' + c.toLowerCase()) : ''; }
        const m = t.match(/\b(I{1,3}|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII)\b/);
        return m && roman.includes(m[1]) ? m[1] : '';
      };
      const jenisPegawai = x => {
        const t = kunci(x);
        if (t === 'pns') return 'PNS';
        if (t === 'pppk') return 'PPPK';
        if (t.includes('pppkpw') || t.includes('paruhwaktu')) return 'PPPK Paruh Waktu';
        if (t === 'honor' || t === 'honorer') return 'Honor';
        return '';
      };
      const bool = x => /^(1|true|ya|yes|y|x|✓|✔)$/i.test(String(x || '').trim());
      const nips = new Set(rows.map(p => String(p.nip || '').replace(/\D/g, '')).filter(Boolean));
      const kepala = new Set(rows.filter(p => p.jabatan_tambahan).map(p => `${p.kua_id}:${p.jabatan_tambahan}`));
      const staged = [], masalah = []; let total = 0;
      ws.eachRow((row, no) => {
        if (no === 1 || !row.values.slice(1).some(v => v != null && String(v).trim() !== '')) return;
        total++;
        const nama = ambil(row, 'Nama');
        const tempat = ambil(row, 'Tempat Tugas');
        const kua = cariKua(tempat);
        const jenis = jenisPegawai(ambil(row, 'Jenis Pegawai'));
        let jabatan = ambil(row, 'Jabatan');
        let perluDilengkapi = false;
        if (!jabatan || pegJabatanLamaSaja(jabatan)) { jabatan = 'Perlu dilengkapi'; perluDilengkapi = true; }
        const nipRaw = ambil(row, 'NIP').replace(/\s/g, '');
        const nip = jenis === 'Honor' ? null : (nipRaw.replace(/\D/g, '') || null);
        const gol = jenis ? golongan(jenis, ambil(row, 'Pangkat/Golongan', 'Pangkat / Golongan')) : '';
        const tambahanRaw = ambil(row, 'Jabatan Tambahan Kepala KUA');
        const jabatanTambahan = /plt|plh|pj/i.test(tambahanRaw) ? 'Plt. Kepala KUA'
          : /kepala|definitif/i.test(tambahanRaw) ? 'Kepala KUA' : null;
        const tmtKua = tanggal(ambil(row, 'TMT di KUA saat ini'));
        const tmtKepala = tanggal(ambil(row, 'TMT Pertama Kali Menjabat Kepala KUA'));
        const usiaRaw = ambil(row, 'Usia Pensiun (tahun)');
        const usia = usiaRaw ? Number.parseInt(usiaRaw, 10) : pegPensiun(jabatan, nip);
        const sumberRaw = ambil(row, 'Sumber Usia Pensiun').toUpperCase();
        const sumber = usia == null ? null : (sumberRaw === 'MANUAL' ? 'MANUAL' : 'AUTO');
        const hp = pegHp(ambil(row, 'No. HP', 'Nomor HP', 'HP / WA')) || null;
        const alasan = [];
        if (!nama) alasan.push('Nama kosong');
        if (!kua) alasan.push(`Tempat Tugas "` + (tempat || '-') + `" tidak cocok dengan daftar KUA`);
        if (op && kua && kua.id !== me.kua_id) alasan.push('Operator hanya dapat mengimpor data KUA sendiri');
        if (!jenis) alasan.push(`Jenis pegawai "` + (ambil(row, 'Jenis Pegawai') || '-') + `" tidak dikenali`);
        if (jenis === 'PNS' || jenis === 'PPPK') {
          if (!nip || nip.length !== 18) alasan.push(`NIP ` + jenis + ` harus 18 angka`);
          if (!gol) alasan.push(`Pangkat/golongan ` + jenis + ` belum valid atau kosong`);
        } else if (jenis === 'PPPK Paruh Waktu' && nip && nip.length !== 18) alasan.push('NIP PPPK PW harus 18 angka bila diisi');
        if (jabatan.length > 100) alasan.push('Jabatan lebih dari 100 karakter');
        if (jabatanTambahan && !PEG_TAMBAHAN_JENIS.includes(jenis)) alasan.push('Kepala KUA hanya dapat ditetapkan untuk PNS atau PPPK');
        if (usia != null && (!Number.isInteger(usia) || usia < 40 || usia > 75)) alasan.push('Usia pensiun harus 40–75 tahun');
        if (usiaRaw && !Number.isFinite(usia)) alasan.push('Usia pensiun bukan angka');
        if (ambil(row, 'TMT di KUA saat ini') && !tmtKua) alasan.push('Format TMT di KUA tidak terbaca');
        if (ambil(row, 'TMT Pertama Kali Menjabat Kepala KUA') && !tmtKepala) alasan.push('Format TMT Kepala KUA tidak terbaca');
        if (nip && nips.has(nip)) alasan.push(`NIP ` + nip + ` sudah ada di database atau duplikat di file`);
        const kepalaKey = kua && jabatanTambahan ? `${kua.id}:${jabatanTambahan}` : '';
        if (kepalaKey && kepala.has(kepalaKey)) alasan.push(`${jabatanTambahan} di ${tempat} sudah memiliki pemegang`);
        if (alasan.length) {
          masalah.push({ no, nama: nama || '(tanpa nama)', tempat, alasan: alasan.join('; ') });
          return;
        }
        if (nip) nips.add(nip);
        if (kepalaKey) kepala.add(kepalaKey);
        staged.push({
          kua_id: kua.id, nama, nip, jenis_asn: jenis, pangkat_golongan: jenis === 'Honor' ? null : (gol || null),
          jabatan, jabatan_tambahan: jabatanTambahan, no_hp: hp, usia_pensiun: usia, sumber_usia_pensiun: sumber,
          tmt_kua: ['PNS','PPPK','PPPK Paruh Waktu'].includes(jenis) ? tmtKua : null,
          tmt_kepala_kua: jabatanTambahan ? tmtKepala : null,
          operator_simkah: bool(ambil(row, 'Operator SIMKAH')), operator_bop: bool(ambil(row, 'Operator BOP')),
          _row: no, _incomplete: perluDilengkapi
        });
      });
      if (!staged.length) throw new Error(`Tidak ada data yang dapat diimpor. ` + masalah.length + ` baris perlu diperbaiki.`);
      const preview = staged.slice(0, 5).map(p => `<tr><td>` + p._row + `</td><td>` + esc(p.nama) + `</td><td>` + esc(kn[p.kua_id] || '') + `</td><td>` + esc(p.jenis_asn) + `</td><td>` + esc(p.jabatan) + `</td><td>` + (p.usia_pensiun ? p.usia_pensiun + ' th' : '-') + `</td></tr>`).join('');
      const issueTable = masalah.slice(0, 12).map(x => `<tr><td>` + x.no + `</td><td>` + esc(x.nama) + `</td><td>` + esc(x.tempat) + `</td><td>` + esc(x.alasan) + `</td></tr>`).join('');
      jpDlg(`<h5>Pratinjau impor pegawai</h5>
        <p class="small mb-3">File: <b>` + esc(file.name) + `</b>. ID pada file sumber tidak digunakan; data akan dibuat sebagai data pegawai baru.</p>
        <div class="row g-2 mb-3">
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Baris terbaca</div><div class="fs-4 fw-semibold">` + total + `</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Siap diimpor</div><div class="fs-4 fw-semibold">` + staged.length + `</div></div></div>
          <div class="col-4"><div class="border rounded p-2"><div class="small text-muted">Dilewati</div><div class="fs-4 fw-semibold">` + masalah.length + `</div></div></div>
        </div>
        ` + (staged.some(x => x._incomplete) ? '<div class="alert alert-warning py-2 small">Ada ' + staged.filter(x => x._incomplete).length + ' pegawai yang jabatan pokoknya kosong atau berisi “Kepala KUA”. Data tetap dapat diimpor dengan jabatan sementara <b>Perlu dilengkapi</b>. Lengkapi setelah impor.</div>' : '') + `
        <div class="small fw-semibold mb-1">Contoh data yang akan diimpor</div>
        <div class="table-responsive mb-3"><table class="table table-sm"><thead><tr><th>Baris</th><th>Nama</th><th>KUA</th><th>Jenis</th><th>Jabatan</th><th>Usia pensiun</th></tr></thead><tbody>` + preview + `</tbody></table></div>
        ` + (masalah.length ? '<details class="mb-3"><summary class="small fw-semibold">Baris yang dilewati (' + masalah.length + ')</summary><div class="table-responsive mt-2" style="max-height:220px;overflow:auto"><table class="table table-sm"><thead><tr><th>Baris</th><th>Nama</th><th>KUA</th><th>Alasan</th></tr></thead><tbody>' + issueTable + '</tbody></table></div>' + (masalah.length > 12 ? '<div class="small text-muted">Menampilkan 12 dari ' + masalah.length + ' baris bermasalah.</div>' : '') + '</details>' : '') + `
        <div id="pimpprogress" class="small mb-2"></div>
        <div class="d-flex justify-content-end gap-2"><button type="button" class="btn btn-outline-secondary" data-x>Batal</button><button type="button" class="btn btn-primary" id="pimpgo">Impor ` + staged.length + ` pegawai</button></div>`, d => {
        d.className = 'dlg-lg';
        d.querySelector('[data-x]').onclick = () => d.close();
        d.querySelector('#pimpgo').onclick = async e => {
          const go = e.currentTarget, status = d.querySelector('#pimpprogress');
          go.disabled = true; d.querySelector('[data-x]').disabled = true;
          let berhasil = 0, gagal = [];
          const payload = p => { const { _row, _incomplete, ...data } = p; return data; };
          for (let i = 0; i < staged.length; i += 25) {
            const chunk = staged.slice(i, i + 25);
            const { error } = await sb.from('pegawai').insert(chunk.map(payload));
            if (!error) berhasil += chunk.length;
            else {
              for (const p of chunk) {
                const one = await sb.from('pegawai').insert(payload(p));
                if (one.error) gagal.push({ row: p._row, name: p.nama, message: pegGalat(one.error) });
                else berhasil++;
              }
            }
            status.textContent = 'Menyimpan ' + Math.min(i + 25, staged.length) + ' dari ' + staged.length + ' baris… Berhasil ' + berhasil + '.';
          }
          d.close();
          await refresh();
          if (live(ep)) {
            const detailGagal = gagal.slice(0, 5).map(x => 'Baris ' + x.row + ' (' + x.name + '): ' + x.message).join(' | ');
            lapor($('pgmsg'), 'Impor selesai: ' + berhasil + ' berhasil, ' + gagal.length + ' gagal, ' + masalah.length + ' dilewati.' + (detailGagal ? ' Rincian gagal: ' + detailGagal : ''), gagal.length || masalah.length ? 'warning' : 'success');
          }
        };
      });
    } catch (e) {
      if (live(ep)) lapor($('pgmsg'), e?.message || String(e), 'danger');
    } finally {
      if (live(ep) && tombol) tombol.disabled = false;
    }
  };

  // ---- Unduh Excel (sesuai penyaring yang sedang dipakai) ----
  const unduh = async () => {
    const list = filtered().sort(urut);
    if (!list.length) return lapor($('pgmsg'), 'Tidak ada pegawai untuk diunduh.', 'warning');
    $('pxls').disabled = true;
    try {
      await loadJs(CDN.exceljs);
      const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Pegawai KUA');
      ws.columns = [{ header: 'No', width: 5 }, ...(pu ? [{ header: 'KUA', width: 26 }] : []), { header: 'Nama lengkap + gelar', width: 38 }, { header: 'NIP', width: 22 },
        { header: 'Jenis ASN', width: 18 }, { header: 'Pangkat / golongan', width: 28 }, { header: 'Jabatan', width: 36 }, { header: 'Kepala KUA', width: 22 },
        { header: 'Operator SIMKAH', width: 18 }, { header: 'Operator BOP', width: 16 }, { header: 'TMT di KUA saat ini', width: 18 },
        { header: 'TMT pertama menjabat Kepala KUA', width: 24 }, { header: 'Usia pensiun (tahun)', width: 18 }, { header: 'Sumber usia pensiun', width: 18 }, { header: 'HP / WA', width: 16 }];
      // NIP dan nomor HP ditulis sebagai teks supaya Excel tidak membulatkan 18 angka atau menghapus angka 0 di depan
      list.forEach((p, i) => ws.addRow([i + 1, ...(pu ? [kn[p.kua_id] || ''] : []), p.nama, p.nip || '', p.jenis_asn, p.pangkat_golongan ? pegGol(p.jenis_asn, p.pangkat_golongan) : '', p.jabatan,
        p.jabatan_tambahan || '', p.operator_simkah ? 'Ya' : 'Tidak', p.operator_bop ? 'Ya' : 'Tidak', p.tmt_kua || '', p.tmt_kepala_kua || '', p.usia_pensiun ?? '', p.sumber_usia_pensiun || '', p.no_hp || '']));
      const h = ws.getRow(1); h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EBFF' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const nama = `pegawai-${op ? slug(me.kua) : F.kua ? slug(kn[F.kua]) : 'semua-kua'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const a = Object.assign(document.createElement('a'), { download: nama, href: URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })) });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      if (live(ep)) lapor($('pgmsg'), `${list.length} pegawai diunduh ke ${nama}.`, 'success');
    } catch (e) { if (live(ep)) lapor($('pgmsg'), e.message || String(e), 'danger'); }
    if (live(ep)) $('pxls').disabled = false;
  };

  // ---- Sambungkan ----
  $('pq').oninput = e => { F.q = e.target.value; drawDaftar(); };
  $('pjf').onchange = e => { F.jenis = e.target.value; drawDaftar(); };
  if (pu) {
    $('pkf').onchange = e => { F.kua = +e.target.value || 0; draw(); };
    $('ptabs').onclick = e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      tab = b.dataset.tab;
      $('ptabs').querySelectorAll('[data-tab]').forEach(x => { const on = x.dataset.tab === tab; x.classList.toggle('btn-primary', on); x.classList.toggle('btn-outline-primary', !on); x.setAttribute('aria-pressed', String(on)); });
      draw();
    };
  }
  $('ptab').onclick = e => {
    const b = e.target.closest('[data-e],[data-t],[data-d],[data-kua]'); if (!b) return;
    if (b.dataset.kua) {   // dari Rekap: buka daftar pegawai KUA itu
      F.kua = +b.dataset.kua; $('pkf').value = String(F.kua); tab = 'daftar';
      $('ptabs').querySelectorAll('[data-tab]').forEach(x => { const on = x.dataset.tab === 'daftar'; x.classList.toggle('btn-primary', on); x.classList.toggle('btn-outline-primary', !on); x.setAttribute('aria-pressed', String(on)); });
      return draw();
    }
    const p = rows.find(x => x.id === +(b.dataset.e || b.dataset.t || b.dataset.d));
    if (!p) return lapor($('pgmsg'), 'Pegawai tidak ditemukan. Muat ulang halaman.', 'warning');
    if (b.dataset.e) form(p); else if (b.dataset.t) transfer(p); else hapus(p);
  };
  $('phis').onclick = riwayat;
  $('pxls').onclick = unduh;
  if (kelola) {
    $('padd').onclick = () => form(null);
    $('pimp').onclick = () => $('pfile').click();
    $('pfile').onchange = async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) await imporExcel(file); };
  }

  if (!(await load())) return;
  if (pu) $('pkf').innerHTML = '<option value="0">Semua KUA</option>' + kuas.map(k => `<option value="${k.id}">${esc(k.nama_kua)}</option>`).join('');
  $('pxls').disabled = false;
  if (kelola) { $('padd').disabled = false; $('pimp').disabled = false; }
  draw();
}

// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { pegawai: pagePegawai });
