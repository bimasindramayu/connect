/* =====================================================================================
   akses.js: halaman "Hak Akses Menu" (khusus admin)
   Admin mencentang menu apa saja yang boleh dibuka tiap peran. Data di tabel hak_akses (Supabase), disimpan lewat set_hak_akses()
   (satu transaksi). Daftar menu di MENU_DEF HARUS sama dengan menu_keys() di bop.sql dan data-menu di index.html; aturan
   "tidak dapat diberikan" di bawah sama dengan pemeriksaan di set_hak_akses() (database menolak bila dilanggar).
   Hak ini dibaca tiga tempat: tampilan (sidebar dan router), database (RLS/trigger lewat can_menu), Apps Script dan Edge Function.
   ===================================================================================== */

const AKSES_PERAN = ['operator', 'bendahara_bop', 'verifikator_bop', 'bast_nr', 'kemasjidan', 'pnbp_nr'];   // peran yang hak aksesnya dapat diubah (Admin selalu semua menu)
const AKSES_ADMIN = ['akses', 'impor'];                                                                      // khusus Admin, tidak dapat diberikan
const AKSES_TAK_OPERATOR = ['anggaran', 'verifikasi', 'metode', 'sakti', 'config'];                          // Operator KUA hanya boleh mengakses data KUA-nya sendiri
const AKSES_BAWAAN = {   // isi awal di bop.sql (tombol "Kembalikan ke bawaan" hanya mencentang ulang; tersimpan bila Simpan ditekan)
  operator: ['bop', 'rpd', 'realisasi', 'laporan'],
  bendahara_bop: ['bop', 'rpd', 'verifikasi', 'sakti', 'laporan'],
  verifikator_bop: ['bop', 'rpd', 'verifikasi', 'laporan'],
  bast_nr: ['bast', 'bast-buat', 'bast-pegawai', 'bast-setting'],
  kemasjidan: ['sert-masjid', 'sert-kiblat', 'sert-pengaturan'],
  pnbp_nr: ['jaspro']
};
// [kunci, nama menu, keterangan]
const MENU_DEF = [
  ['BOP', [
    ['bop', 'Halaman BOP', 'Halaman depan BOP: kartu pilihan modul dan ringkasan SAKTI.'],
    ['anggaran', 'Anggaran', 'Menetapkan anggaran tahunan tiap KUA. Tidak untuk Operator KUA.'],
    ['rpd', 'RPD', 'Operator KUA mengisi RPD KUA-nya sendiri. Peran lain hanya MELIHAT RPD semua KUA (Admin yang dapat mengubah).'],
    ['realisasi', 'Realisasi', 'Mengisi Realisasi bulanan dan mengunggah LPJ. Khusus Operator KUA.'],
    ['verifikasi', 'Verifikasi', 'Menyetujui, menolak, atau menandai Dibayar; membuka dokumen LPJ semua KUA. Tidak mengubah nominal. Tidak untuk Operator KUA.'],
    ['metode', 'Pengaturan SAKTI', 'Mencentang KUA yang Listrik dan Telepon/Internet-nya dibayar lewat SAKTI. Tidak untuk Operator KUA.'],
    ['sakti', 'Realisasi SAKTI', 'Menginput nominal pembayaran SAKTI tiap bulan. Tidak untuk Operator KUA.'],
    ['config', 'Config', 'Pengaturan sistem BOP: buka/tutup pengisian, bulan RPD, batas file LPJ. Tidak untuk Operator KUA.'],
    ['impor', 'Impor Data Lama', 'Mengambil data dari sistem lama. Khusus Admin.'],
    ['laporan', 'Laporan', 'Unduh laporan Excel/PDF. Operator KUA: KUA-nya sendiri; peran lain: semua KUA.']]],
  ['BAST NR', [
    ['bast', 'Riwayat', 'Daftar Berita Acara, status SIMKAH, dan arsip dokumen tertandatangan (lihat, unggah, hapus).'],
    ['bast-buat', 'Buat BA', 'Membuat Berita Acara baru.'],
    ['bast-pegawai', 'Pegawai', 'Mengelola daftar pegawai (Pihak Pertama dan Pihak Kedua).'],
    ['bast-setting', 'Pengaturan BAST', 'Format nomor surat, pejabat yang mengetahui, alamat kantor, dan pemindahan arsip lama ke folder master.']]],
  ['Sertifikat', [
    ['sert-masjid', 'Masjid / Musala', 'Data masjid/musala dan cetak sertifikat.'],
    ['sert-kiblat', 'Arah Kiblat', 'Data kalibrasi arah kiblat dan cetak sertifikat.'],
    ['sert-pengaturan', 'Pengaturan Sertifikat', 'Nama penanda tangan dan tanda tangan petugas ukur.']]],
  ['Lainnya', [
    ['jaspro', 'Jaspro Transport', 'Menghitung Jaspro dan Transport dari data presensi dan membuat laporannya.'],
    ['akses', 'Hak Akses Menu', 'Halaman ini. Khusus Admin.']]]
];
const MENU_INFO = Object.fromEntries(MENU_DEF.flatMap(([, ms]) => ms).map(([k, n, d]) => [k, { nama: n, ket: d }]));

// Boleh diberikan ke peran ini? (sama dengan set_hak_akses di database)
const aksesBoleh = (peran, menu) => {
  if (AKSES_ADMIN.includes(menu)) return false;
  if (peran === 'operator' && AKSES_TAK_OPERATOR.includes(menu)) return false;
  if (peran !== 'operator' && menu === 'realisasi') return false;
  return true;
};
const aksesAlasan = (peran, menu) => AKSES_ADMIN.includes(menu) ? 'Khusus Admin'
  : peran === 'operator' ? 'Operator KUA hanya mengakses data KUA-nya sendiri' : 'Khusus Operator KUA (mengisi Realisasi KUA sendiri)';

async function pageAkses() {
  const ep = EP;
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h4 class="mb-1">Hak Akses Menu</h4>
    <p class="mb-3">Centang menu yang boleh dibuka tiap peran. <b>Admin</b> selalu dapat membuka semua menu. Menu <b>Pengaturan</b> (ganti password sendiri) terbuka untuk semua akun.
      Perubahan berlaku saat pengguna memuat ulang halaman atau login ulang; menu Sertifikat dan BAST NR (Apps Script) paling lama 5 menit.
      Hak ini ditegakkan server (database, Apps Script, Edge Function), bukan hanya disembunyikan di tampilan.</p>
    <div id="hmsg"></div><div id="hbody">Memuat…</div></div></div>`;
  let orig = {}, jumlah = {};   // orig = { peran: [menu] } tersimpan di database; jumlah = { peran: jumlah akun }
  const [h, ak] = await Promise.all([sb.from('hak_akses').select('role,menu'), sb.rpc('akun_daftar')]);
  if (!live(ep)) return;
  if (h.error) {
    return $('hbody').innerHTML = note(/hak_akses|schema cache/i.test(h.error.message)
      ? 'Tabel hak_akses belum ada. Jalankan bop.sql versi terbaru di SQL Editor Supabase, lalu muat ulang halaman ini.' : h.error.message);
  }
  AKSES_PERAN.forEach(r => orig[r] = h.data.filter(x => x.role === r).map(x => x.menu));
  (ak.data || []).forEach(a => jumlah[a.role] = (jumlah[a.role] || 0) + 1);

  const cell = (r, m) => aksesBoleh(r, m)
    ? `<td class="text-center"><input type="checkbox" class="form-check-input" data-r="${r}" data-m="${m}" data-o="${orig[r].includes(m) ? 1 : 0}"${orig[r].includes(m) ? ' checked' : ''} aria-label="${esc(MENU_INFO[m].nama)} untuk ${esc(peranLabel(r))}"></td>`
    : `<td class="text-center text-muted" title="${esc(aksesAlasan(r, m))}" aria-label="Tidak dapat diberikan: ${esc(aksesAlasan(r, m))}"><i class="bx bx-block"></i></td>`;
  $('hbody').innerHTML = `<div class="table-responsive"><table class="table table-hover align-middle akses mb-2" style="min-width:860px">
    <thead><tr><th style="min-width:260px">Menu</th><th class="text-center">Admin<div class="small fw-normal">${jumlah.admin || 0} akun</div></th>${AKSES_PERAN.map(r => `<th class="text-center">
      <label class="d-flex flex-column align-items-center gap-1 mb-0"><span>${esc(peranLabel(r))}</span><span class="small fw-normal">${jumlah[r] || 0} akun</span>
      <input type="checkbox" class="form-check-input" data-all="${r}" aria-label="Centang semua menu untuk ${esc(peranLabel(r))}" title="Centang / kosongkan semua"></label></th>`).join('')}</tr></thead>
    <tbody>${MENU_DEF.map(([grup, ms]) => `<tr class="table-light"><th colspan="${AKSES_PERAN.length + 2}" class="small text-uppercase">${esc(grup)}</th></tr>${ms.map(([m, nama, ket]) => `<tr>
      <td><b>${esc(nama)}</b><div class="small">${esc(ket)}</div></td>
      <td class="text-center">${m === 'realisasi' ? '<span class="text-muted" title="Admin tidak mengisi Realisasi"><i class="bx bx-block"></i></span>' : '<i class="bx bx-check text-success fs-5" title="Admin selalu boleh"></i>'}</td>
      ${AKSES_PERAN.map(r => cell(r, m)).join('')}</tr>`).join('')}`).join('')}</tbody></table></div>
    <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary" id="hsave">Simpan Hak Akses</button>
      <button class="btn btn-outline-secondary" id="hdef" type="button">Kembalikan ke bawaan</button>
      <button class="btn btn-outline-secondary" id="hundo" type="button">Batalkan perubahan</button></div>
    <p class="small mt-3 mb-0"><i class="bx bx-block"></i> = tidak dapat diberikan ke peran itu (khusus Admin, atau khusus Operator KUA). Tombol <b>Kembalikan ke bawaan</b> hanya mencentang ulang sesuai isi awal; baru tersimpan setelah Anda menekan <b>Simpan Hak Akses</b>.</p>`;

  const boxes = r => [...$('hbody').querySelectorAll(`input[data-r="${r}"]`)];
  const mark = c => c.closest('td').classList.toggle('table-warning', (c.checked ? 1 : 0) !== +c.dataset.o);
  const syncAll = r => { const b = boxes(r), a = $('hbody').querySelector(`input[data-all="${r}"]`); a.checked = b.length > 0 && b.every(x => x.checked); a.indeterminate = !a.checked && b.some(x => x.checked); };
  AKSES_PERAN.forEach(syncAll);
  $('hbody').onchange = e => {
    const t = e.target;
    if (t.dataset.all) { boxes(t.dataset.all).forEach(c => { c.checked = t.checked; mark(c); }); syncAll(t.dataset.all); }
    else if (t.dataset.r) { mark(t); syncAll(t.dataset.r); }
  };
  const setAll = (fn) => { AKSES_PERAN.forEach(r => { boxes(r).forEach(c => { c.checked = fn(r, c.dataset.m); mark(c); }); syncAll(r); }); };
  $('hdef').onclick = () => { setAll((r, m) => AKSES_BAWAAN[r].includes(m)); $('hmsg').innerHTML = note('Dicentang sesuai bawaan. Tekan Simpan Hak Akses untuk menyimpannya.', 'info'); };
  $('hundo').onclick = () => { setAll((r, m) => orig[r].includes(m)); $('hmsg').innerHTML = ''; };
  $('hsave').onclick = () => {
    const data = {};
    AKSES_PERAN.forEach(r => {
      const now = boxes(r).filter(c => c.checked).map(c => c.dataset.m).sort(), was = [...orig[r]].sort();
      if (now.join() !== was.join()) data[r] = now;
    });
    const ganti = Object.keys(data);
    if (!ganti.length) return lapor($('hmsg'), 'Tidak ada perubahan untuk disimpan.', 'info');
    const kosong = ganti.filter(r => !data[r].length);
    const simpan = async () => {
      $('hsave').disabled = true;
      const { error } = await sb.rpc('set_hak_akses', { p_data: data });   // satu transaksi: gagal satu = batal semua
      if (!live(ep)) return;
      $('hsave').disabled = false;
      if (error) return lapor($('hmsg'), error.message, 'danger');
      ganti.forEach(r => orig[r] = data[r]);
      AKSES_PERAN.forEach(r => boxes(r).forEach(c => { c.dataset.o = c.checked ? 1 : 0; mark(c); }));   // yang tersimpan menjadi acuan baru
      lapor($('hmsg'), `Hak akses tersimpan untuk: ${ganti.map(peranLabel).join(', ')}.`, 'success');
    };
    if (kosong.length) jpAsk('Peran tanpa menu?', `${kosong.map(peranLabel).join(', ')} tidak akan punya menu apa pun, sehingga akunnya hanya dapat membuka halaman Pengaturan. Lanjutkan?`, 'Simpan', simpan);
    else simpan();
  };
}

// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { akses: pageAkses });
