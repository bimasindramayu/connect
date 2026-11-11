/* BIMASATU - BMN frontend. Data: Google Spreadsheet via Apps Script; files: Drive master via Edge Function. */
const BMN_UI = { rows: [], settings: { allowDataEntry: true }, busy: false };
const BMN_JENIS_FORM = ['Tanah', 'Gedung/Bangunan', 'Kendaraan', 'Peralatan & Mesin', 'Aset Lainnya'];
const BMN_SUMBER_FORM = ['APBN', 'APBD', 'Hibah', 'Swadaya', 'Bantuan'];
const BMN_KONDISI_FORM = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
const BMN_STATUS_FORM = ['Digunakan', 'Tidak Digunakan', 'Diusulkan Penghapusan'];
const BMN_MAX_FILES = 5, BMN_MAX_FILE_SIZE = 5 * 1024 * 1024;
const BMN_KUA_CODES = {
  anjatan:'AJ', arahan:'AR', balongan:'BA', bangodua:'BG', bongas:'BS', cantigi:'CT',
  cikedung:'CK', gantar:'GT', gabuswetan:'GB', haurgeulis:'HG', indramayu:'IM',
  jatibarang:'JT', juntinyuat:'JN', kandanghaur:'KH', karangampel:'KA',
  'kedokan bunder':'KB', kertasemaya:'KS', krangkeng:'KR', kroya:'KY', lelea:'LL',
  lohbener:'LB', losarang:'LS', pasekan:'PS', patrol:'PT', sindang:'SD', sliyeg:'SL',
  sukagumiwang:'SG', sukra:'SK', terisi:'TR', tukdana:'TK', widasari:'WD'
};
const BMN_KUA_NAMES = [
  'Anjatan','Arahan','Balongan','Bangodua','Bongas','Cantigi','Cikedung','Gabuswetan',
  'Gantar','Haurgeulis','Indramayu','Jatibarang','Juntinyuat','Kandanghaur','Karangampel',
  'Kedokan Bunder','Kertasemaya','Krangkeng','Kroya','Lelea','Lohbener','Losarang',
  'Pasekan','Patrol','Sindang','Sliyeg','Sukagumiwang','Sukra','Terisi','Tukdana','Widasari'
];
const bmnCanWrite = () => !!me && (
  me.role === 'admin' || (me.role === 'operator' && BMN_UI.settings.allowDataEntry !== false)
);
const bmnIsAdmin = () => !!me && me.role === 'admin';
const bmnSatkerDefault = () => me && me.role === 'operator' ? (me.kua || '') : '';

function bmnMoney(v) {
  return 'Rp ' + Number(v || 0).toLocaleString('id-ID');
}
function bmnNotice(message, type = 'success') {
  const el = $('bmnMessage');
  if (el) el.innerHTML = note(esc(message), type);
}
function bmnBadge(v, group) {
  const map = group === 'kondisi'
    ? { 'Baik': 'success', 'Rusak Ringan': 'warning', 'Rusak Berat': 'danger' }
    : { 'Digunakan': 'success', 'Tidak Digunakan': 'secondary', 'Diusulkan Penghapusan': 'warning' };
  return '<span class="badge bg-label-' + (map[v] || 'secondary') + '">' + esc(v || '-') + '</span>';
}
function bmnPhotoList(row) {
  return Array.isArray(row.fotos) ? row.fotos : [];
}
function bmnNormalizeSatker(value) {
  return String(value || '').trim().toLowerCase().replace(/^kua\s*(kec\.?|kecamatan)?\s*/i, '').replace(/\s+/g, ' ');
}
function bmnKodeBarangPreview(satker, jenis) {
  const key = bmnNormalizeSatker(satker);
  const kuaCode = BMN_KUA_CODES[key] || key.replace(/[^a-z0-9]/g, '').slice(0, 2).toUpperCase() || '00';
  const jenisIndex = BMN_JENIS_FORM.indexOf(jenis);
  if (!satker || jenisIndex < 0) return '';
  const prefix = kuaCode + '-' + String(jenisIndex + 1).padStart(2, '0') + '-';
  let max = 0;
  BMN_UI.rows.forEach(row => {
    const code = String(row.kodeBarang || '');
    if (code.startsWith(prefix)) {
      const n = parseInt(code.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(4, '0');
}
function bmnOptionList(items, selected, placeholder) {
  return '<option value="">' + esc(placeholder || '— Pilih —') + '</option>' +
    items.map(value => '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(value) + '</option>').join('');
}
function bmnMimeType(photo) {
  const raw = String(photo?.mimeType || '').split(';')[0].trim().toLowerCase();
  if (['application/pdf', 'image/jpeg', 'image/png'].includes(raw)) return raw;
  const name = String(photo?.fileName || '').toLowerCase();
  if (/\.pdf$/.test(name)) return 'application/pdf';
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (/\.png$/.test(name)) return 'image/png';
  return '';
}

async function pageBMN() {
  $('view').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <div><h4 class="mb-1"><i class="bx bx-building me-1"></i>Barang Milik Negara</h4>
        <div class="text-body-secondary small">Inventaris BMN Satker · Database Google Spreadsheet BIMASATU</div></div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-outline-success btn-sm" id="bmnRefresh"><i class="bx bx-refresh"></i> Muat ulang</button>
        <button class="btn btn-primary btn-sm" id="bmnAdd" ${bmnCanWrite() ? '' : 'disabled'}><i class="bx bx-plus"></i> Tambah BMN</button>
      </div>
    </div>
    <div id="bmnMessage"></div>
    <div class="row g-3 mb-3" id="bmnStats">
      ${['Total Barang','Kondisi Baik','Rusak Ringan','Rusak Berat'].map(x => `<div class="col-6 col-xl-3"><div class="card h-100"><div class="card-body"><div class="text-body-secondary small">${x}</div><div class="placeholder-glow"><span class="placeholder col-4"></span></div></div></div></div>`).join('')}
    </div>
    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-3 ${me.role === 'operator' ? 'd-none' : ''}">
          <label class="form-label" for="bmnFilterSatker">Satker</label><input class="form-control" id="bmnFilterSatker" placeholder="Semua Satker">
        </div>
        <div class="col-6 col-md-2"><label class="form-label" for="bmnFilterJenis">Jenis</label>
          <select class="form-select" id="bmnFilterJenis"><option value="">Semua jenis</option><option>Tanah</option><option>Gedung/Bangunan</option><option>Kendaraan</option><option>Peralatan & Mesin</option><option>Aset Lainnya</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label" for="bmnFilterKondisi">Kondisi</label>
          <select class="form-select" id="bmnFilterKondisi"><option value="">Semua kondisi</option><option>Baik</option><option>Rusak Ringan</option><option>Rusak Berat</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label" for="bmnFilterStatus">Status</label>
          <select class="form-select" id="bmnFilterStatus"><option value="">Semua status</option><option>Digunakan</option><option>Tidak Digunakan</option><option>Diusulkan Penghapusan</option></select></div>
        <div class="col-12 col-md"><label class="form-label" for="bmnSearch">Cari barang</label><input class="form-control" id="bmnSearch" placeholder="Kode, nama, ID BMN, lokasi…"></div>
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
        <div class="small text-body-secondary" id="bmnCount"></div>
        <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-success btn-sm" id="bmnExcel">Ekspor Excel</button><button class="btn btn-outline-danger btn-sm" id="bmnPdf">Ekspor PDF</button></div>
      </div>
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-hover align-middle mb-0" id="bmnTable">
      <thead><tr><th>No</th><th>Satker</th><th>Kode Barang</th><th>Nama Barang</th><th>Jenis</th><th>Tahun</th><th>Nilai</th><th>Kondisi</th><th>Status</th><th>Foto</th><th>Aksi</th></tr></thead>
      <tbody><tr><td colspan="11" class="text-center py-4 text-body-secondary">Memuat data…</td></tr></tbody>
    </table></div></div>
    ${bmnIsAdmin() ? `<div class="card mt-3" id="bmnMigrationCard"><div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div><h5 class="mb-1"><i class="bx bx-transfer-alt me-1"></i> Pusat Migrasi Data BMN</h5><div class="small text-body-secondary">Migrasi bertahap dari aplikasi BMN lama ke penyimpanan BIMASATU.</div></div>
        <span class="badge bg-label-info">Khusus Admin</span>
      </div>
      <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="bmnAllowEntry"><label class="form-check-label" for="bmnAllowEntry">Izinkan Operator KUA menambah/mengubah data BMN</label></div>
      <div class="bmn-migration-step">
        <div class="d-flex gap-3 align-items-start"><span class="bmn-step-number">1</span><div class="flex-grow-1">
          <div class="fw-semibold">Impor data barang</div><div class="small text-body-secondary mb-2">Membaca Spreadsheet BMN lama dan menyalin data barang ke sheet BMN_Data pada Spreadsheet BIMASATU. ID yang sudah ada tidak ditimpa.</div>
          <div class="d-flex flex-wrap align-items-center gap-2"><button class="btn btn-primary btn-sm" id="bmnImport"><i class="bx bx-import me-1"></i> Mulai / Ulangi Impor</button><span class="small text-body-secondary" id="bmnImportState">Belum ada proses pada sesi ini.</span></div>
        </div></div>
      </div>
      <div class="bmn-migration-step mt-3">
        <div class="d-flex gap-3 align-items-start"><span class="bmn-step-number">2</span><div class="flex-grow-1">
          <div class="fw-semibold">Salin foto dan dokumen</div><div class="small text-body-secondary mb-2">Menyalin berkas lama ke folder Google Drive BIMASATU/BMN. File di lokasi lama tetap dipertahankan.</div>
          <div class="row g-2 mb-2" id="bmnMigrationStats">
            <div class="col-4"><div class="bmn-migration-stat"><div class="small text-body-secondary">Menunggu</div><div class="fw-semibold" id="bmnPendingCount">0</div></div></div>
            <div class="col-4"><div class="bmn-migration-stat"><div class="small text-body-secondary">Sudah disalin</div><div class="fw-semibold" id="bmnDoneCount">0</div></div></div>
            <div class="col-4"><div class="bmn-migration-stat"><div class="small text-body-secondary">Total berkas</div><div class="fw-semibold" id="bmnTotalPhotoCount">0</div></div></div>
          </div>
          <div class="progress mb-2" style="height:8px"><div class="progress-bar" id="bmnPhotoProgress" role="progressbar" style="width:0%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div></div>
          <div class="d-flex flex-wrap align-items-center gap-2"><button class="btn btn-outline-warning btn-sm" id="bmnMigratePhotos"><i class="bx bx-cloud-upload me-1"></i> Salin / Lanjutkan Foto</button><span class="small text-body-secondary" id="bmnPhotoState">Belum ada foto yang diproses.</span></div>
        </div></div>
      </div>
      <div class="alert alert-light border small mt-3 mb-0"><i class="bx bx-info-circle me-1"></i> Urutan yang disarankan: selesaikan impor data terlebih dahulu, lalu jalankan salin foto. Jika proses terhenti, jalankan ulang; data barang yang sudah masuk akan dilewati.</div>
      <div id="bmnMigrationResult" class="mt-3" aria-live="polite"></div>
    </div></div>` : ''}
  `;
  $('bmnRefresh').onclick = bmnLoad;
  $('bmnAdd').onclick = () => bmnOpenForm(null);
  ['bmnFilterSatker','bmnFilterJenis','bmnFilterKondisi','bmnFilterStatus','bmnSearch'].forEach(id => $(id)?.addEventListener('input', bmnRenderTable));
  $('bmnExcel').onclick = () => bmnExport('xls');
  $('bmnPdf').onclick = () => bmnExport('pdf');
  if (bmnIsAdmin()) {
    $('bmnAllowEntry').onchange = async e => {
      try { await gas('bmnSaveSetting', { key: 'allowDataEntry', value: e.target.checked }); BMN_UI.settings.allowDataEntry = e.target.checked; bmnNotice('Pengaturan input BMN disimpan.'); }
      catch (err) { e.target.checked = !e.target.checked; bmnNotice(err.message, 'danger'); }
    };
    $('bmnImport').onclick = bmnImportLegacy;
    $('bmnMigratePhotos').onclick = bmnMigrateLegacyPhotos;
    bmnUpdateMigrationPanel();
  }
  await bmnLoad();
}

async function bmnLoad() {
  if (BMN_UI.busy) return;
  BMN_UI.busy = true;
  try {
    const needsSettings = bmnIsAdmin() || me.role === 'operator';
    const [list, stats, settings] = await Promise.all([
      gas('bmnList'), gas('bmnStats'), needsSettings ? gas('bmnSettings') : Promise.resolve({ data: {} })
    ]);
    BMN_UI.rows = list.data || [];
    BMN_UI.settings = settings.data || { allowDataEntry: true };
    if (bmnIsAdmin() && $('bmnAllowEntry')) $('bmnAllowEntry').checked = BMN_UI.settings.allowDataEntry !== false;
    if ($('bmnAdd')) $('bmnAdd').disabled = !bmnCanWrite();
    bmnRenderStats(stats.data || {});
    bmnRenderTable();
    if (me.role === 'operator' && !bmnCanWrite()) {
      bmnNotice('Admin sedang menutup input BMN. Anda tetap dapat melihat dan mengekspor data KUA.', 'warning');
    }
  } catch (e) {
    bmnNotice(e.message || 'Gagal memuat data BMN.', 'danger');
    $('bmnTable').querySelector('tbody').innerHTML = `<tr><td colspan="11" class="text-center text-danger py-4">${esc(e.message)}</td></tr>`;
  } finally { BMN_UI.busy = false; }
}

function bmnRenderStats(s) {
  const cards = [
    ['Total Barang', s.total || 0, 'bx-package', 'primary'],
    ['Kondisi Baik', s.baik || 0, 'bx-check-circle', 'success'],
    ['Rusak Ringan', s.rusakRingan || 0, 'bx-error-circle', 'warning'],
    ['Rusak Berat', s.rusakBerat || 0, 'bx-x-circle', 'danger']
  ];
  $('bmnStats').innerHTML = cards.map(([label,val,icon,color]) => `
    <div class="col-6 col-xl-3"><div class="card h-100"><div class="card-body d-flex align-items-center gap-3">
      <span class="avatar avatar-md bg-label-${color}"><i class="bx ${icon} fs-4"></i></span>
      <div><div class="text-body-secondary small">${label}</div><div class="fs-4 fw-semibold">${Number(val).toLocaleString('id-ID')}</div></div>
    </div></div></div>`).join('');
}

function bmnFilteredRows() {
  const val = id => $(id)?.value.trim() || '';
  const satker = val('bmnFilterSatker').toLowerCase(), jenis = val('bmnFilterJenis'), kondisi = val('bmnFilterKondisi'), status = val('bmnFilterStatus'), q = val('bmnSearch').toLowerCase();
  return BMN_UI.rows.filter(r =>
    (!satker || String(r.satker).toLowerCase().includes(satker)) &&
    (!jenis || r.jenis === jenis) && (!kondisi || r.kondisi === kondisi) && (!status || r.status === status) &&
    (!q || [r.kodeBarang,r.namaBarang,r.idBMN,r.lokasiBarang,r.satker].join(' ').toLowerCase().includes(q))
  );
}

function bmnRenderTable() {
  const rows = bmnFilteredRows();
  $('bmnCount').textContent = rows.length.toLocaleString('id-ID') + ' dari ' + BMN_UI.rows.length.toLocaleString('id-ID') + ' barang';
  $('bmnTable').querySelector('tbody').innerHTML = rows.length ? rows.map((r,i) => {
    const photos = bmnPhotoList(r);
    const actions = `<button class="btn btn-sm btn-outline-primary" data-bmn-view="${esc(r.id)}" title="Detail"><i class="bx bx-show"></i></button> ` +
      (bmnCanWrite() ? `<button class="btn btn-sm btn-outline-secondary" data-bmn-edit="${esc(r.id)}" title="Edit"><i class="bx bx-edit"></i></button>` : '') +
      (bmnCanWrite() ? ` <button class="btn btn-sm btn-outline-danger" data-bmn-delete="${esc(r.id)}" title="Hapus"><i class="bx bx-trash"></i></button>` : '');
    return `<tr><td>${i+1}</td><td>${esc(r.satker)}</td><td class="text-nowrap">${esc(r.kodeBarang)}</td><td class="bmn-name">${esc(r.namaBarang)}</td><td>${esc(r.jenis)}</td><td>${esc(r.tahunPerolehan)}</td><td class="text-nowrap">${bmnMoney(r.nilaiPerolehan)}</td><td>${bmnBadge(r.kondisi,'kondisi')}</td><td>${bmnBadge(r.status,'status')}</td><td>${photos.length ? `<span class="badge bg-label-info">${photos.length} file</span>` : '-'}</td><td class="text-nowrap">${actions}</td></tr>`;
  }).join('') : '<tr><td colspan="11" class="text-center text-body-secondary py-4">Belum ada data BMN sesuai filter.</td></tr>';
  $('bmnTable').querySelectorAll('[data-bmn-view]').forEach(b => b.onclick = () => bmnView(b.dataset.bmnView));
  $('bmnTable').querySelectorAll('[data-bmn-edit]').forEach(b => b.onclick = () => bmnOpenForm(BMN_UI.rows.find(x=>x.id===b.dataset.bmnEdit)));
  $('bmnTable').querySelectorAll('[data-bmn-delete]').forEach(b => b.onclick = () => bmnDelete(b.dataset.bmnDelete));
}

function bmnFormHtml(row) {
  const r = row || {}, isEdit = !!r.id, isOperator = me.role === 'operator';
  const satker = r.satker || bmnSatkerDefault();
  const jenis = r.jenis || '';
  const kode = r.kodeBarang || bmnKodeBarangPreview(satker, jenis);
  const sourceOptions = bmnOptionList(BMN_SUMBER_FORM, r.sumberPerolehan || '', '— Pilih Sumber Perolehan —');
  const jenisOptions = bmnOptionList(BMN_JENIS_FORM, jenis, '— Pilih Jenis BMN —');
  const kondisiOptions = bmnOptionList(BMN_KONDISI_FORM, r.kondisi || '', '— Pilih Kondisi —');
  const statusOptions = bmnOptionList(BMN_STATUS_FORM, r.status || '', '— Pilih Status Penggunaan —');
  const locationList = BMN_KUA_NAMES.map(name => '<option value="KUA ' + esc(name) + '"></option>').join('');
  const existing = bmnPhotoList(r);
  const photoCards = existing.length ? existing.map((photo, i) => {
    const mime = bmnMimeType(photo), isPdf = mime === 'application/pdf';
    const pending = photo.migrationStatus === 'pending' || !photo.fileId;
    const icon = isPdf ? 'bx-file-pdf' : (mime.startsWith('image/') ? 'bx-image' : 'bx-file');
    return `<div class="bmn-attachment-card">
      <span class="bmn-attachment-icon ${isPdf ? 'pdf' : 'image'}"><i class="bx ${icon}"></i></span>
      <span class="bmn-attachment-meta"><strong title="${esc(photo.fileName || 'Lampiran ' + (i + 1))}">${esc(photo.fileName || 'Lampiran ' + (i + 1))}</strong>
        <small>${pending ? 'Masih menunggu migrasi' : 'Tersimpan di Drive BIMASATU'}</small></span>
      <button type="button" class="bmn-attachment-remove" data-bmn-remove-photo="${i}" title="Lepas dari data BMN" aria-label="Lepas lampiran"><i class="bx bx-x"></i></button>
    </div>`;
  }).join('') : '<div class="bmn-attachment-empty">Belum ada lampiran tersimpan.</div>';

  return `<div class="bmn-form-shell">
    <header class="bmn-form-header">
      <div class="bmn-form-header-main">
        <span class="bmn-form-header-icon"><i class="bx bx-package"></i></span>
        <div class="min-w-0"><div class="bmn-form-eyebrow">INVENTARISASI BARANG MILIK NEGARA</div>
          <h4>${isEdit ? 'Edit Data BMN' : 'Tambah BMN Baru'}</h4>
          <p>${isEdit ? 'Perbarui informasi aset dan dokumentasinya.' : 'Lengkapi data aset sesuai kondisi dan dokumen perolehan.'}</p></div>
        <button type="button" class="btn-close btn-close-white ms-auto" id="bmnCloseForm" aria-label="Tutup"></button>
      </div>
      <div class="bmn-form-header-meta"><span><i class="bx bx-building-house"></i> ${esc(satker || 'Pilih Satker/KUA')}</span><span><i class="bx bx-shield-quarter"></i> Tersimpan di BIMASATU</span></div>
    </header>

    <form id="bmnForm" autocomplete="off">
      <input type="hidden" name="id" value="${esc(r.id || '')}">
      <div class="bmn-form-body">
        <section class="bmn-form-section accent-indigo">
          <div class="bmn-form-section-title"><span><i class="bx bx-barcode-reader"></i></span><div><h6>Identifikasi Barang</h6><small>Jenis, kode, dan identitas aset</small></div></div>
          <div class="bmn-form-grid two">
            <div class="bmn-form-field field-wide">
              <label for="bmnSatker">Satker / KUA <em>*</em></label>
              <input id="bmnSatker" class="form-control bmn-form-control" name="satker" list="bmnSatkerOptions"
                value="${esc(satker)}" placeholder="Ketik atau pilih nama KUA" required
                ${(isOperator || isEdit) ? 'readonly' : ''}>
              ${!isOperator && !isEdit ? '<datalist id="bmnSatkerOptions">' + locationList + '</datalist>' : ''}
              <small class="bmn-form-help">${isOperator ? 'Data otomatis mengikuti KUA pada akun Anda.' : 'Pilih nama KUA dari daftar agar kode barang mengikuti kode KUA.'}</small>
            </div>
            <div class="bmn-form-field">
              <label for="bmnJenisSelect">Jenis BMN <em>*</em></label>
              <select id="bmnJenisSelect" class="form-select bmn-form-control" required ${isEdit ? 'disabled' : ''}>${jenisOptions}</select>
              <input type="hidden" name="jenis" id="bmnJenisValue" value="${esc(jenis)}">
            </div>
            <div class="bmn-form-field">
              <label for="bmnKodeBarang">Kode Barang <span class="bmn-auto-tag"><i class="bx bx-magic-wand"></i> Otomatis</span></label>
              <div class="bmn-code-input"><i class="bx bx-barcode"></i><input id="bmnKodeBarang" class="form-control bmn-form-control" name="kodeBarang" value="${esc(kode)}" readonly placeholder="Pilih Satker dan Jenis BMN"></div>
              <small class="bmn-form-help">Kode dibuat otomatis saat disimpan dan tidak perlu diketik.</small>
            </div>
            <div class="bmn-form-field field-wide">
              <label for="bmnNamaBarang">Nama Barang <em>*</em></label>
              <input id="bmnNamaBarang" class="form-control bmn-form-control" name="namaBarang" value="${esc(r.namaBarang || '')}" placeholder="Contoh: Laptop Lenovo ThinkPad" required maxlength="180">
            </div>
            <div class="bmn-form-field">
              <label for="bmnIdBMN">ID BMN / No. Registrasi</label>
              <input id="bmnIdBMN" class="form-control bmn-form-control" name="idBMN" value="${esc(r.idBMN || '')}" placeholder="Opsional">
            </div>
            <div class="bmn-form-field">
              <label for="bmnLokasi">Lokasi Barang <em>*</em></label>
              <input id="bmnLokasi" class="form-control bmn-form-control" name="lokasiBarang" value="${esc(r.lokasiBarang || '')}" placeholder="Contoh: Ruang Kepala KUA" required maxlength="180">
            </div>
          </div>
        </section>

        <section class="bmn-form-section accent-blue">
          <div class="bmn-form-section-title"><span><i class="bx bx-clipboard"></i></span><div><h6>Perolehan, Kondisi &amp; Status</h6><small>Informasi pengadaan dan penggunaan aset</small></div></div>
          <div class="bmn-form-grid two">
            <div class="bmn-form-field">
              <label for="bmnTahun">Tahun Perolehan <em>*</em></label>
              <input id="bmnTahun" type="number" class="form-control bmn-form-control" name="tahunPerolehan"
                min="1900" max="2100" step="1" inputmode="numeric"
                value="${esc(isEdit ? (r.tahunPerolehan || '') : new Date().getFullYear())}" required>
              <small class="bmn-form-help">Hanya angka tahun, 1900–2100.</small>
            </div>
            <div class="bmn-form-field">
              <label for="bmnSumber">Sumber Perolehan</label>
              <select id="bmnSumber" class="form-select bmn-form-control" name="sumberPerolehan">${sourceOptions}</select>
            </div>
            <div class="bmn-form-field">
              <label for="bmnNilai">Nilai Perolehan (Rp)</label>
              <div class="bmn-number-input"><span>Rp</span><input id="bmnNilai" type="number" class="form-control bmn-form-control" name="nilaiPerolehan" min="0" step="1" inputmode="numeric" value="${esc(r.nilaiPerolehan || 0)}" placeholder="0"></div>
              <small class="bmn-form-help">Masukkan angka tanpa titik atau koma.</small>
            </div>
            <div class="bmn-form-field">
              <label for="bmnKondisi">Kondisi Barang <em>*</em></label>
              <select id="bmnKondisi" class="form-select bmn-form-control" name="kondisi" required>${kondisiOptions}</select>
            </div>
            <div class="bmn-form-field field-wide">
              <label for="bmnStatus">Status Penggunaan <em>*</em></label>
              <select id="bmnStatus" class="form-select bmn-form-control" name="status" required>${statusOptions}</select>
            </div>
            <div class="bmn-form-field field-wide">
              <label for="bmnKeterangan">Keterangan</label>
              <textarea id="bmnKeterangan" class="form-control bmn-form-control" name="keterangan" rows="3" placeholder="Keterangan tambahan (opsional)...">${esc(r.keterangan || '')}</textarea>
            </div>
          </div>
        </section>

        <section class="bmn-form-section accent-orange">
          <div class="bmn-form-section-title"><span><i class="bx bx-images"></i></span><div><h6>Foto dan Dokumen</h6><small>Foto kondisi barang atau dokumen pendukung</small></div></div>
          <div class="bmn-upload-toolbar">
            <button type="button" class="btn bmn-upload-choice" id="bmnPickFiles"><i class="bx bx-folder-open"></i> Pilih File</button>
            <button type="button" class="btn bmn-upload-choice camera" id="bmnPickCamera"><i class="bx bx-camera"></i> Kamera</button>
            <span class="bmn-upload-limit"><i class="bx bx-info-circle"></i> Maks. 5 file · 5 MB/file · PDF/JPG/PNG</span>
            <input type="file" id="bmnFiles" multiple accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" hidden>
            <input type="file" id="bmnCamera" accept="image/*" capture="environment" hidden>
          </div>
          <div class="bmn-attachment-block"><div class="bmn-attachment-heading">Lampiran tersimpan <span id="bmnExistingCount">${existing.length}</span></div><div class="bmn-attachment-list" id="bmnExistingFiles">${photoCards}</div></div>
          <div class="bmn-attachment-block new d-none" id="bmnNewBlock"><div class="bmn-attachment-heading">File baru <span id="bmnNewCount">0</span></div><div class="bmn-attachment-list" id="bmnNewFiles"></div></div>
          <div class="bmn-upload-footnote"><i class="bx bx-cloud-upload"></i> File baru akan diunggah ke Google Drive BIMASATU/BMN setelah data disimpan.</div>
        </section>
      </div>
      <footer class="bmn-form-footer"><div class="bmn-form-footer-note"><i class="bx bx-lock-alt"></i> Pastikan data sesuai dokumen inventaris.</div>
        <div class="d-flex gap-2"><button type="button" class="btn btn-light" id="bmnCancel">Batal</button><button class="btn btn-primary bmn-save-button" id="bmnSaveBtn"><i class="bx bx-save me-1"></i> Simpan BMN</button></div>
      </footer>
    </form>
  </div>`;
}

function bmnOpenForm(row) {
  if (!bmnCanWrite()) return bmnNotice('Input BMN sedang ditutup oleh Admin.', 'warning');
  const existingPhotos = bmnPhotoList(row).slice();
  const pendingFiles = [];
  $('dlg').className = 'wide bmn-form-dialog';
  $('dlg').innerHTML = bmnFormHtml(row);
  $('dlg').showModal();

  const cleanup = () => pendingFiles.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  const close = () => { cleanup(); $('dlg').close(); };
  $('bmnCloseForm').onclick = close;
  $('bmnCancel').onclick = close;
  $('bmnPickFiles').onclick = () => $('bmnFiles').click();
  $('bmnPickCamera').onclick = () => $('bmnCamera').click();

  const updateCode = () => {
    const type = $('bmnJenisSelect').value;
    $('bmnJenisValue').value = type;
    if (row && row.kodeBarang) { $('bmnKodeBarang').value = row.kodeBarang; return; }
    $('bmnKodeBarang').value = bmnKodeBarangPreview($('bmnSatker').value, type);
  };
  $('bmnJenisSelect').onchange = updateCode;
  $('bmnSatker').addEventListener('input', updateCode);
  $('bmnSatker').addEventListener('change', updateCode);

  const renderExisting = () => {
    $('bmnExistingCount').textContent = existingPhotos.length;
    $('bmnExistingFiles').innerHTML = existingPhotos.length ? existingPhotos.map((photo, i) => {
      const mime = bmnMimeType(photo), isPdf = mime === 'application/pdf';
      const pending = photo.migrationStatus === 'pending' || !photo.fileId;
      return `<div class="bmn-attachment-card">
        <span class="bmn-attachment-icon ${isPdf ? 'pdf' : 'image'}"><i class="bx ${isPdf ? 'bx-file-pdf' : 'bx-image'}"></i></span>
        <span class="bmn-attachment-meta"><strong title="${esc(photo.fileName || 'Lampiran')}">${esc(photo.fileName || 'Lampiran')}</strong>
          <small>${pending ? 'Menunggu migrasi' : 'Tersimpan di Drive BIMASATU'}</small></span>
        <button type="button" class="bmn-attachment-remove" data-bmn-remove-photo="${i}" title="Lepas dari data BMN"><i class="bx bx-x"></i></button>
      </div>`;
    }).join('') : '<div class="bmn-attachment-empty">Belum ada lampiran tersimpan.</div>';
    $('bmnExistingFiles').querySelectorAll('[data-bmn-remove-photo]').forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.bmnRemovePhoto);
        const item = existingPhotos[i];
        if (!item || !confirm('Lepas lampiran ini dari data BMN? File fisik di Google Drive tidak ikut dihapus.')) return;
        existingPhotos.splice(i, 1);
        renderExisting();
        renderPending();
      };
    });
  };
  const renderPending = () => {
    const block = $('bmnNewBlock');
    block.classList.toggle('d-none', pendingFiles.length === 0);
    $('bmnNewCount').textContent = pendingFiles.length;
    $('bmnNewFiles').innerHTML = pendingFiles.map((item, i) => {
      const isImage = item.file.type.startsWith('image/');
      return `<div class="bmn-attachment-card new-file">
        <span class="bmn-attachment-icon ${isImage ? 'image' : 'pdf'}">${isImage && item.previewUrl ? `<img src="${item.previewUrl}" alt="">` : `<i class="bx ${isImage ? 'bx-image' : 'bx-file-pdf'}"></i>`}</span>
        <span class="bmn-attachment-meta"><strong title="${esc(item.file.name)}">${esc(item.file.name)}</strong><small>Siap diunggah · ${(item.file.size / 1024 / 1024).toFixed(2)} MB</small></span>
        <button type="button" class="bmn-attachment-remove" data-bmn-remove-new="${i}" title="Batalkan file"><i class="bx bx-x"></i></button>
      </div>`;
    }).join('');
    $('bmnNewFiles').querySelectorAll('[data-bmn-remove-new]').forEach(btn => {
      btn.onclick = () => {
        const item = pendingFiles.splice(Number(btn.dataset.bmnRemoveNew), 1)[0];
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        renderPending();
      };
    });
  };
  const addFiles = input => {
    const incoming = Array.from(input.files || []);
    input.value = '';
    incoming.forEach(file => {
      const validType = ['application/pdf','image/jpeg','image/png'].includes(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
      if (!validType) { bmnNotice(file.name + ': hanya PDF, JPG, atau PNG.', 'warning'); return; }
      if (file.size > BMN_MAX_FILE_SIZE) { bmnNotice(file.name + ': ukuran maksimal 5 MB.', 'warning'); return; }
      if (existingPhotos.length + pendingFiles.length >= BMN_MAX_FILES) { bmnNotice('Maksimal 5 foto/dokumen per barang.', 'warning'); return; }
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      pendingFiles.push({ file, previewUrl });
    });
    renderPending();
  };
  $('bmnFiles').onchange = () => addFiles($('bmnFiles'));
  $('bmnCamera').onchange = () => addFiles($('bmnCamera'));

  $('bmnForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('bmnSaveBtn');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menyimpan…';
    const fd = new FormData(e.currentTarget);
    const data = {
      id: fd.get('id') || null,
      satker: String(fd.get('satker') || '').trim(),
      namaBarang: String(fd.get('namaBarang') || '').trim(),
      jenis: String(fd.get('jenis') || ''),
      tahunPerolehan: String(fd.get('tahunPerolehan') || ''),
      sumberPerolehan: String(fd.get('sumberPerolehan') || ''),
      nilaiPerolehan: String(fd.get('nilaiPerolehan') || '0'),
      kondisi: String(fd.get('kondisi') || ''),
      status: String(fd.get('status') || ''),
      lokasiBarang: String(fd.get('lokasiBarang') || '').trim(),
      idBMN: String(fd.get('idBMN') || '').trim(),
      keterangan: String(fd.get('keterangan') || '').trim(),
      fotos: existingPhotos.slice()
    };
    try {
      if (data.fotos.length + pendingFiles.length > BMN_MAX_FILES) throw new Error('Maksimal 5 foto/dokumen per barang.');
      // Simpan dahulu agar kode final dibuat server dan folder unggahan memakai kode yang sama.
      const saved = await gas('bmnSave', { data });
      const record = saved.data || {};
      data.id = record.id || data.id;
      const finalCode = record.kodeBarang || $('bmnKodeBarang').value;
      const uploadErrors = [];
      for (const item of pendingFiles) {
        try {
          const form = new FormData();
          form.set('file', item.file);
          form.set('satker', data.satker);
          form.set('kodeBarang', finalCode);
          const response = await api({ action: 'bmn-upload' }, { method: 'POST', body: form });
          const uploaded = await response.json();
          if (!uploaded.id) throw new Error(uploaded.error || 'ID file hasil unggah tidak ditemukan.');
          data.fotos.push({
            fileId: uploaded.id, fileName: item.file.name, fileSize: item.file.size,
            mimeType: item.file.type || bmnMimeType({ fileName: item.file.name }), migrationStatus: 'master'
          });
        } catch (uploadError) {
          uploadErrors.push(item.file.name + ': ' + uploadError.message);
        }
      }
      if (pendingFiles.length) {
        data.kodeBarang = finalCode;
        await gas('bmnSave', { data });
      }
      cleanup();
      $('dlg').close();
      await bmnLoad();
      if (uploadErrors.length) {
        bmnNotice('Data BMN tersimpan dengan Kode ' + finalCode + ', tetapi sebagian lampiran gagal diunggah: ' + uploadErrors.join(' | '), 'warning');
      } else {
        bmnNotice('Data BMN berhasil disimpan. Kode Barang: ' + finalCode + '.', 'success');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bx bx-save me-1"></i> Simpan BMN';
      bmnNotice(err.message || 'Gagal menyimpan BMN.', 'danger');
    }
  };

  updateCode();
  renderExisting();
}

function bmnDetailField(label, value, icon, tone = 'primary') {
  return `<div class="bmn-detail-field">
    <span class="bmn-detail-field-icon bg-label-${tone}"><i class="bx ${icon}"></i></span>
    <div class="min-w-0"><div class="bmn-detail-field-label">${esc(label)}</div><div class="bmn-detail-field-value">${esc(value || '-')}</div></div>
  </div>`;
}

async function bmnView(id) {
  const r = BMN_UI.rows.find(x => x.id === id);
  if (!r) return;
  const photos = bmnPhotoList(r);
  const fields = [
    ['Jenis Barang', r.jenis, 'bx-category', 'primary'],
    ['Tahun Perolehan', r.tahunPerolehan, 'bx-calendar', 'info'],
    ['Sumber Perolehan', r.sumberPerolehan, 'bx-purchase-tag', 'success'],
    ['Lokasi Barang', r.lokasiBarang, 'bx-map', 'warning'],
    ['ID BMN', r.idBMN, 'bx-barcode', 'secondary'],
    ['Keterangan', r.keterangan, 'bx-notepad', 'primary']
  ];
  const fileHtml = photos.length ? photos.map((p, i) => {
    const pending = p.migrationStatus === 'pending' || !p.fileId;
    const mime = bmnMimeType(p);
    const isPdf = mime === 'application/pdf';
    const isImage = mime.startsWith('image/');
    const icon = isPdf ? 'bx-file-pdf' : (isImage ? 'bx-image' : 'bx-file');
    const ext = isPdf ? 'PDF' : (mime === 'image/jpeg' ? 'JPG' : (mime === 'image/png' ? 'PNG' : ((p.fileName || '').split('.').pop() || 'FILE').toUpperCase()));
    return `<button type="button" class="bmn-file-card text-start" data-bmn-photo="${i}" aria-label="${pending ? 'Dokumen menunggu migrasi' : 'Lihat pratinjau ' + esc(p.fileName || 'dokumen')}" ${pending ? 'disabled' : ''}>
      <span class="bmn-file-icon ${isPdf ? 'pdf' : (isImage ? 'image' : 'other')}"><i class="bx ${icon}"></i></span>
      <span class="bmn-file-meta"><strong title="${esc(p.fileName || 'Dokumen ' + (i + 1))}">${esc(p.fileName || 'Dokumen ' + (i + 1))}</strong>
        <small><span class="bmn-file-type">${esc(ext)}</span><span class="bmn-file-dot">•</span>${pending ? 'Belum dipindahkan' : 'Tersimpan di Drive BIMASATU'}</small></span>
      <span class="bmn-file-action">${pending ? '<i class="bx bx-time-five"></i><small>Menunggu</small>' : '<i class="bx bx-show"></i><small>Lihat</small>'}</span>
    </button>`;
  }).join('') : '<div class="bmn-file-empty"><i class="bx bx-folder-open"></i><span>Belum ada foto atau dokumen untuk barang ini.</span></div>';

  $('dlg').className = 'wide bmn-detail-dialog';
  $('dlg').innerHTML = `<div class="bmn-detail-shell">
    <div class="bmn-detail-hero">
      <div class="d-flex align-items-start gap-3">
        <span class="bmn-detail-hero-icon"><i class="bx bx-building-house"></i></span>
        <div class="min-w-0 flex-grow-1">
          <div class="bmn-detail-eyebrow">DETAIL BARANG MILIK NEGARA</div>
          <h4>${esc(r.namaBarang || 'Barang tanpa nama')}</h4>
          <div class="bmn-detail-subtitle">${esc(r.satker || '-')} <span>•</span> Kode: ${esc(r.kodeBarang || '-')}</div>
          <div class="d-flex flex-wrap gap-2 mt-3">${bmnBadge(r.kondisi, 'kondisi')} ${bmnBadge(r.status, 'status')}</div>
        </div>
        <button type="button" class="btn-close btn-close-white" id="bmnDetailClose" aria-label="Tutup"></button>
      </div>
      <div class="bmn-detail-highlights">
        <div class="bmn-detail-highlight"><span class="bmn-detail-highlight-icon"><i class="bx bx-wallet"></i></span><div><small>Nilai Perolehan</small><strong>${esc(bmnMoney(r.nilaiPerolehan))}</strong></div></div>
        <div class="bmn-detail-highlight"><span class="bmn-detail-highlight-icon"><i class="bx bx-calendar-check"></i></span><div><small>Tahun Perolehan</small><strong>${esc(r.tahunPerolehan || '-')}</strong></div></div>
        <div class="bmn-detail-highlight"><span class="bmn-detail-highlight-icon"><i class="bx bx-file"></i></span><div><small>Foto / Dokumen</small><strong>${photos.length.toLocaleString('id-ID')} berkas</strong></div></div>
      </div>
    </div>

    <div class="bmn-detail-content">
      <section class="bmn-detail-section">
        <div class="bmn-detail-section-heading"><span class="bmn-detail-section-icon primary"><i class="bx bx-list-ul"></i></span><div><h6>Informasi Barang</h6><small>Rincian identitas dan kondisi aset</small></div></div>
        <div class="bmn-detail-fields">${fields.map(f => bmnDetailField(f[0], f[1], f[2], f[3])).join('')}</div>
      </section>
      <section class="bmn-detail-section">
        <div class="bmn-detail-section-heading"><span class="bmn-detail-section-icon info"><i class="bx bx-images"></i></span><div><h6>Foto dan Dokumen</h6><small>Pilih berkas untuk melihat pratinjau langsung</small></div></div>
        <div class="bmn-detail-files" id="bmnPhotoButtons">${fileHtml}</div>
        ${photos.some(p => p.migrationStatus === 'pending' || !p.fileId) ? '<div class="bmn-detail-file-note"><i class="bx bx-info-circle"></i> Berkas yang masih menunggu migrasi perlu disalin terlebih dahulu melalui Pusat Migrasi Data BMN.</div>' : ''}
      </section>
    </div>
    <div class="bmn-detail-footer"><span><i class="bx bx-shield-quarter"></i> Data tersimpan di Spreadsheet BIMASATU</span><button type="button" class="btn btn-primary" id="bmnDetailDone"><i class="bx bx-check me-1"></i> Selesai</button></div>
  </div>`;

  $('dlg').showModal();
  const close = () => $('dlg').close();
  $('bmnDetailClose').onclick = close;
  $('bmnDetailDone').onclick = close;
  $('bmnPhotoButtons').querySelectorAll('[data-bmn-photo]').forEach(btn => {
    btn.onclick = () => bmnOpenFile(photos[Number(btn.dataset.bmnPhoto)], photos);
  });
}

function bmnOpenFile(photo, photos = [photo]) {
  if (!photo || photo.migrationStatus === 'pending' || !photo.fileId) {
    return bmnNotice('Dokumen ini masih berada di lokasi lama. Admin perlu menyelesaikan migrasi ke folder BIMASATU/BMN terlebih dahulu.', 'warning');
  }
  // Pola penampil sama dengan LPJ BOP: file diambil melalui Edge Function,
  // lalu openViewer menangani PDF multi-halaman maupun gambar dengan zoom/putar.
  const files = photos
    .filter(p => p && p.fileId && p.migrationStatus !== 'pending')
    .map((p, i) => ({
      id: String(p.fileId),
      name: p.fileName || 'Dokumen BMN ' + (i + 1),
      mimeType: bmnMimeType(p)
    }));
  const index = files.findIndex(f => f.id === String(photo.fileId));
  if (index < 0) return bmnNotice('Berkas BMN tidak ditemukan pada daftar.', 'danger');

  openViewer(files, index, async file => {
    const response = await api({ action: 'bmn-file', id: file.id });
    const headerType = String(response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    const fallbackType = file.mimeType;
    const type = ['application/pdf', 'image/jpeg', 'image/png'].includes(headerType) ? headerType : fallbackType;
    if (!type) {
      throw new Error('Format dokumen tidak dikenali. Gunakan file PDF, JPG, atau PNG.');
    }
    if (headerType === 'application/json') {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || result.error || 'Dokumen BMN tidak dapat dibaca.');
    }
    // Beberapa file lama tidak menyertakan MIME type pada metadata; normalkan dari ekstensi.
    if (headerType !== type) {
      return new Response(await response.blob(), { headers: { 'Content-Type': type } });
    }
    return response;
  });
}
async function bmnDelete(id) {
  if (!bmnCanWrite()) return bmnNotice('Hak tambah, edit, dan hapus BMN sedang tidak diaktifkan oleh Admin.', 'warning');
  const r = BMN_UI.rows.find(x => x.id === id);
  if (!r || !confirm('Hapus data BMN "' + r.namaBarang + '" dari ' + r.satker + '? Lampiran di Google Drive tidak ikut dihapus dan tetap tersimpan sebagai arsip.')) return;
  try {
    await gas('bmnDelete', { id });
    bmnNotice('Data BMN berhasil dihapus. Lampiran Google Drive tetap tersimpan sebagai arsip.', 'success');
    await bmnLoad();
  } catch (e) { bmnNotice(e.message, 'danger'); }
}

async function bmnExport(format) {
  try {
    const rows=bmnFilteredRows();
    if(!rows.length) throw new Error('Tidak ada data untuk diekspor.');
    const result=await gas('bmnExport',{format,rows:rows.map(r=>({
      satker:r.satker,kodeBarang:r.kodeBarang,namaBarang:r.namaBarang,jenis:r.jenis,tahunPerolehan:r.tahunPerolehan,
      nilaiPerolehan:r.nilaiPerolehan,kondisi:r.kondisi,status:r.status,lokasiBarang:r.lokasiBarang
    }))});
    const bytes=Uint8Array.from(atob(result.fileData),c=>c.charCodeAt(0));
    const blob=new Blob([bytes],{type:result.mimeType}), url=URL.createObjectURL(blob);
    const a=Object.assign(document.createElement('a'),{href:url,download:result.fileName});document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  } catch(e){bmnNotice(e.message,'danger');}
}

function bmnPhotoMigrationCounts() {
  let pending=0,done=0,total=0;
  BMN_UI.rows.forEach(r=>(r.fotos||[]).forEach(p=>{total++;if(p.migrationStatus==='pending')pending++;else done++;}));
  return {pending,done,total};
}
function bmnUpdateMigrationPanel() {
  if (!$('bmnMigrationCard')) return;
  const c=bmnPhotoMigrationCounts(), pct=c.total?Math.round(c.done/c.total*100):0;
  $('bmnPendingCount').textContent=c.pending.toLocaleString('id-ID');
  $('bmnDoneCount').textContent=c.done.toLocaleString('id-ID');
  $('bmnTotalPhotoCount').textContent=c.total.toLocaleString('id-ID');
  $('bmnPhotoProgress').style.width=pct+'%';
  $('bmnPhotoProgress').setAttribute('aria-valuenow',String(pct));
  $('bmnPhotoState').textContent=c.pending ? 'Masih ada '+c.pending+' berkas yang perlu disalin.' : (c.total?'Semua berkas sudah berstatus tersalin.':'Belum ada berkas foto/dokumen.');
}
async function bmnImportLegacy() {
  if(!confirm('Impor data BMN dari sumber lama? Data yang sudah ada di BIMASATU tidak akan ditimpa.'))return;
  const btn=$('bmnImport'), state=$('bmnImportState'); btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span> Mengimpor…'; state.textContent='Sedang membaca sumber dan memasukkan data…';
  try {
    const result=await gas('bmnImportLegacy',{});
    const d=result.data||{};
    const html='<div class="alert alert-success mb-2"><div class="fw-semibold mb-1">Hasil impor data</div><div class="row g-2"><div class="col-6 col-md-3"><span class="small text-body-secondary">Data sumber</span><div class="fw-semibold">'+Number(d.sourceCount||0).toLocaleString('id-ID')+'</div></div><div class="col-6 col-md-3"><span class="small text-body-secondary">Berhasil masuk</span><div class="fw-semibold">'+Number(d.imported||0).toLocaleString('id-ID')+'</div></div><div class="col-6 col-md-3"><span class="small text-body-secondary">Dilewati</span><div class="fw-semibold">'+Number(d.skipped||0).toLocaleString('id-ID')+'</div></div><div class="col-6 col-md-3"><span class="small text-body-secondary">Foto menunggu</span><div class="fw-semibold">'+Number(d.fotoPending||0).toLocaleString('id-ID')+'</div></div></div><div class="small mt-2">Sumber: '+esc(d.source||'BMN lama')+'</div></div>';
    $('bmnMigrationResult').innerHTML=html+(d.endpointWarning?'<div class="alert alert-warning small">Catatan pembacaan endpoint: '+esc(d.endpointWarning)+'</div>':'')+(d.errors&&d.errors.length?'<div class="alert alert-warning small">Beberapa baris gagal: '+esc(d.errors.join(' | '))+'</div>':'');
    state.textContent='Impor selesai · '+Number(d.imported||0)+' data baru.';
    bmnNotice('Impor selesai. '+Number(d.imported||0)+' data berhasil masuk, '+Number(d.skipped||0)+' dilewati.','success');
    await bmnLoad();
  } catch(e){state.textContent='Impor gagal.';bmnNotice(e.message,'danger');$('bmnMigrationResult').innerHTML='<div class="alert alert-danger small">'+esc(e.message)+'</div>';}
  finally{btn.disabled=false;btn.innerHTML='<i class="bx bx-import me-1"></i> Mulai / Ulangi Impor';}
}
async function bmnMigrateLegacyPhotos() {
  const pending=[];
  BMN_UI.rows.forEach(r=>(r.fotos||[]).forEach((p,i)=>{if(p.migrationStatus==='pending' && (p.legacyUrl||p.legacyFileId))pending.push({r,p,i});}));
  if(!pending.length){bmnUpdateMigrationPanel();return bmnNotice('Tidak ada foto lama yang menunggu migrasi.','warning');}
  if(!confirm('Salin '+pending.length+' foto/dokumen lama ke folder BIMASATU/BMN? File lama tidak dihapus.'))return;
  const btn=$('bmnMigratePhotos'),state=$('bmnPhotoState');let ok=0,fail=0;btn.disabled=true;
  for(let n=0;n<pending.length;n++){
    const item=pending[n];state.textContent='Memproses berkas '+(n+1)+' dari '+pending.length+'…';
    try{
      const response=await api({action:'bmn-salin'},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        url:item.p.legacyUrl||('https://drive.google.com/file/d/'+item.p.legacyFileId+'/view'),satker:item.r.satker,kodeBarang:item.r.kodeBarang,bmnId:item.r.id,fileName:item.p.fileName
      })});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();if(!data.id)throw new Error(data.message||'ID file hasil salin tidak ditemukan.');
      const fresh=BMN_UI.rows.find(x=>x.id===item.r.id);if(!fresh)throw new Error('Data BMN tidak ditemukan pada daftar.');
      fresh.fotos[item.i]={fileId:data.id,fileName:item.p.fileName,fileSize:item.p.fileSize,mimeType:item.p.mimeType,migrationStatus:'master'};
      await gas('bmnSave',{data:{
        id:fresh.id,satker:fresh.satker,kodeBarang:fresh.kodeBarang,namaBarang:fresh.namaBarang,jenis:fresh.jenis,
        tahunPerolehan:fresh.tahunPerolehan,sumberPerolehan:fresh.sumberPerolehan,nilaiPerolehan:fresh.nilaiPerolehan,
        kondisi:fresh.kondisi,status:fresh.status,lokasiBarang:fresh.lokasiBarang,idBMN:fresh.idBMN,keterangan:fresh.keterangan,fotos:fresh.fotos
      }});
      ok++;
    }catch(e){fail++;if($('bmnMigrationResult'))$('bmnMigrationResult').innerHTML='<div class="alert alert-warning small">Berkas '+esc(item.p.fileName||'tanpa nama')+': '+esc(e.message)+'</div>';}
    const pct=Math.round((n+1)/pending.length*100);$('bmnPhotoProgress').style.width=pct+'%';$('bmnPhotoProgress').setAttribute('aria-valuenow',String(pct));
  }
  btn.disabled=false;
  $('bmnPhotoState').textContent='Selesai diproses: '+ok+' berhasil, '+fail+' gagal.';
  $('bmnMigrationResult').innerHTML='<div class="alert '+(fail?'alert-warning':'alert-success')+' mb-0 small"><b>Hasil salin foto:</b> '+ok+' berhasil · '+fail+' gagal. Berkas gagal tetap berstatus menunggu agar dapat dicoba lagi.</div>';
  bmnNotice('Migrasi foto selesai. Berhasil: '+ok+', gagal: '+fail,fail?'warning':'success');
  await bmnLoad();
}

pages.bmn = pageBMN;
