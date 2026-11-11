/* BIMASATU - BMN frontend. Data: Google Spreadsheet via Apps Script; files: Drive master via Edge Function. */
const BMN_UI = { rows: [], settings: { allowDataEntry: true }, busy: false };
const bmnCanWrite = () => !!me && (me.role === 'admin' || me.role === 'operator');
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
    ${bmnIsAdmin() ? `<div class="card mt-3"><div class="card-body">
      <h6 class="mb-2">Pengaturan dan migrasi data lama</h6>
      <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="bmnAllowEntry"><label class="form-check-label" for="bmnAllowEntry">Izinkan Operator KUA menambah/mengubah data BMN</label></div>
      <div class="d-flex flex-wrap align-items-center gap-2"><button class="btn btn-outline-primary" id="bmnImport">Impor data BMN lama</button><span class="small text-body-secondary">Sumber: Apps Script lama (sudah dikonfigurasi).</span></div>
      <div class="small text-body-secondary mt-2">Impor aman diulang: ID barang yang sudah ada dilewati. Foto lama ditandai untuk disalin ke Drive BIMASATU.</div>
      <div class="mt-2"><button class="btn btn-outline-warning btn-sm" id="bmnMigratePhotos">Salin foto lama ke Drive BIMASATU</button></div>
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
  }
  await bmnLoad();
}

async function bmnLoad() {
  if (BMN_UI.busy) return;
  BMN_UI.busy = true;
  try {
    const [list, stats, settings] = await Promise.all([
      gas('bmnList'), gas('bmnStats'), bmnIsAdmin() ? gas('bmnSettings') : Promise.resolve({ data: {} })
    ]);
    BMN_UI.rows = list.data || [];
    BMN_UI.settings = settings.data || { allowDataEntry: true };
    if (bmnIsAdmin() && $('bmnAllowEntry')) $('bmnAllowEntry').checked = BMN_UI.settings.allowDataEntry !== false;
    bmnRenderStats(stats.data || {});
    bmnRenderTable();
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
      (bmnIsAdmin() ? ` <button class="btn btn-sm btn-outline-danger" data-bmn-delete="${esc(r.id)}" title="Hapus"><i class="bx bx-trash"></i></button>` : '');
    return `<tr><td>${i+1}</td><td>${esc(r.satker)}</td><td class="text-nowrap">${esc(r.kodeBarang)}</td><td class="bmn-name">${esc(r.namaBarang)}</td><td>${esc(r.jenis)}</td><td>${esc(r.tahunPerolehan)}</td><td class="text-nowrap">${bmnMoney(r.nilaiPerolehan)}</td><td>${bmnBadge(r.kondisi,'kondisi')}</td><td>${bmnBadge(r.status,'status')}</td><td>${photos.length ? `<span class="badge bg-label-info">${photos.length} file</span>` : '-'}</td><td class="text-nowrap">${actions}</td></tr>`;
  }).join('') : '<tr><td colspan="11" class="text-center text-body-secondary py-4">Belum ada data BMN sesuai filter.</td></tr>';
  $('bmnTable').querySelectorAll('[data-bmn-view]').forEach(b => b.onclick = () => bmnView(b.dataset.bmnView));
  $('bmnTable').querySelectorAll('[data-bmn-edit]').forEach(b => b.onclick = () => bmnOpenForm(BMN_UI.rows.find(x=>x.id===b.dataset.bmnEdit)));
  $('bmnTable').querySelectorAll('[data-bmn-delete]').forEach(b => b.onclick = () => bmnDelete(b.dataset.bmnDelete));
}

function bmnFormHtml(row) {
  const r = row || {}, readonlySatker = me.role === 'operator';
  const photos = bmnPhotoList(r);
  return `<div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-1">${r.id ? 'Edit' : 'Tambah'} Data BMN</h5><small class="text-body-secondary">Perubahan disimpan ke Spreadsheet BIMASATU</small></div><button type="button" class="btn-close" id="bmnCloseForm"></button></div>
  <form id="bmnForm">
    <input type="hidden" name="id" value="${esc(r.id || '')}">
    <div class="row g-3">
      <div class="col-md-6"><label class="form-label">Satker *</label><input class="form-control" name="satker" value="${esc(r.satker || bmnSatkerDefault())}" ${readonlySatker ? 'readonly' : 'required'}></div>
      <div class="col-md-6"><label class="form-label">Kode Barang</label><input class="form-control" name="kodeBarang" value="${esc(r.kodeBarang || '')}"></div>
      <div class="col-md-8"><label class="form-label">Nama Barang *</label><input class="form-control" name="namaBarang" value="${esc(r.namaBarang || '')}" required></div>
      <div class="col-md-4"><label class="form-label">Jenis *</label><select class="form-select" name="jenis" required><option value="">Pilih jenis</option>${['Tanah','Gedung/Bangunan','Kendaraan','Peralatan & Mesin','Aset Lainnya'].map(x=>`<option ${r.jenis===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="col-md-4"><label class="form-label">Tahun Perolehan</label><input class="form-control" name="tahunPerolehan" inputmode="numeric" value="${esc(r.tahunPerolehan || '')}"></div>
      <div class="col-md-4"><label class="form-label">Sumber Perolehan</label><input class="form-control" name="sumberPerolehan" value="${esc(r.sumberPerolehan || '')}"></div>
      <div class="col-md-4"><label class="form-label">Nilai Perolehan (Rp)</label><input class="form-control" name="nilaiPerolehan" inputmode="numeric" value="${esc(r.nilaiPerolehan || 0)}"></div>
      <div class="col-md-4"><label class="form-label">Kondisi</label><select class="form-select" name="kondisi">${['Baik','Rusak Ringan','Rusak Berat'].map(x=>`<option ${(r.kondisi||'Baik')===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="col-md-4"><label class="form-label">Status Penggunaan</label><select class="form-select" name="status">${['Digunakan','Tidak Digunakan','Diusulkan Penghapusan'].map(x=>`<option ${(r.status||'Digunakan')===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="col-md-4"><label class="form-label">ID BMN</label><input class="form-control" name="idBMN" value="${esc(r.idBMN || '')}"></div>
      <div class="col-12"><label class="form-label">Lokasi Barang</label><input class="form-control" name="lokasiBarang" value="${esc(r.lokasiBarang || '')}"></div>
      <div class="col-12"><label class="form-label">Keterangan</label><textarea class="form-control" name="keterangan" rows="2">${esc(r.keterangan || '')}</textarea></div>
      <div class="col-12"><label class="form-label">Foto / Dokumen Barang</label><input type="file" class="form-control" name="files" id="bmnFiles" multiple accept=".jpg,.jpeg,.png,.pdf"><div class="form-text">PDF/JPG/PNG, maksimal 12 file per barang; file baru disimpan di Google Drive/BIMASATU/BMN.</div>
        <div id="bmnExistingFiles" class="d-flex flex-wrap gap-2 mt-2">${photos.map((p,i)=>`<span class="badge bg-label-secondary">${esc(p.fileName || 'File '+(i+1))}${p.migrationStatus==='pending'?' · menunggu migrasi':''}</span>`).join('')}</div>
      </div>
    </div>
    <div class="d-flex justify-content-end gap-2 mt-4"><button type="button" class="btn btn-outline-secondary" id="bmnCancel">Batal</button><button class="btn btn-primary" id="bmnSaveBtn">Simpan BMN</button></div>
  </form>`;
}

function bmnOpenForm(row) {
  if (!bmnCanWrite()) return;
  $('dlg').className = 'wide';
  $('dlg').innerHTML = '<div class="p-3 p-md-4">' + bmnFormHtml(row) + '</div>';
  $('dlg').showModal();
  const close = () => $('dlg').close();
  $('bmnCloseForm').onclick = close; $('bmnCancel').onclick = close;
  $('bmnForm').onsubmit = async e => {
    e.preventDefault();
    const btn=$('bmnSaveBtn'); btn.disabled=true; btn.textContent='Menyimpan…';
    try {
      const fd = new FormData(e.currentTarget), photos = bmnPhotoList(row).slice();
      const files = Array.from($('bmnFiles').files || []);
      if (photos.length + files.length > 12) throw new Error('Maksimal 12 foto/dokumen per barang.');
      const satker = String(fd.get('satker')||'').trim(), kodeBarang=String(fd.get('kodeBarang')||'').trim();
      for (const file of files) {
        const form = new FormData(); form.set('file',file); form.set('satker',satker); form.set('kodeBarang',kodeBarang); form.set('bmnId',String(fd.get('id')||''));
        const response = await api({action:'bmn-upload'},{method:'POST',body:form});
        const item = await response.json();
        photos.push({fileId:item.id,fileName:file.name,fileSize:file.size,mimeType:file.type,migrationStatus:'master'});
      }
      const data = {
        id: fd.get('id') || null, satker, kodeBarang, namaBarang: fd.get('namaBarang'), jenis: fd.get('jenis'),
        tahunPerolehan: fd.get('tahunPerolehan'), sumberPerolehan: fd.get('sumberPerolehan'),
        nilaiPerolehan: fd.get('nilaiPerolehan'), kondisi: fd.get('kondisi'), status: fd.get('status'),
        lokasiBarang: fd.get('lokasiBarang'), idBMN: fd.get('idBMN'), keterangan: fd.get('keterangan'), fotos: photos
      };
      await gas('bmnSave',{data});
      $('dlg').close(); bmnNotice('Data BMN berhasil disimpan.'); await bmnLoad();
    } catch(err) { bmnNotice(err.message || 'Gagal menyimpan BMN.','danger'); btn.disabled=false; btn.textContent='Simpan BMN'; }
  };
}

async function bmnView(id) {
  const r=BMN_UI.rows.find(x=>x.id===id); if(!r)return;
  const photos=bmnPhotoList(r);
  $('dlg').className='wide';
  $('dlg').innerHTML=`<div class="p-3 p-md-4">
    <div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-1">${esc(r.namaBarang)}</h5><div class="text-body-secondary small">${esc(r.satker)} · ${esc(r.kodeBarang)}</div></div><button class="btn-close" id="bmnDetailClose"></button></div>
    <div class="row g-3 mb-3">
      ${[['Jenis',r.jenis],['Tahun Perolehan',r.tahunPerolehan],['Sumber Perolehan',r.sumberPerolehan],['Nilai Perolehan',bmnMoney(r.nilaiPerolehan)],['Kondisi',r.kondisi],['Status',r.status],['Lokasi',r.lokasiBarang],['ID BMN',r.idBMN],['Keterangan',r.keterangan]].map(([k,v])=>`<div class="col-sm-6"><div class="bmn-detail-item"><div class="small text-body-secondary">${k}</div><div class="fw-semibold text-break">${esc(v||'-')}</div></div></div>`).join('')}
    </div>
    <h6>Foto / Dokumen (${photos.length})</h6><div class="d-flex flex-wrap gap-2" id="bmnPhotoButtons">${photos.length ? photos.map((p,i)=>`<button class="btn btn-sm btn-outline-primary" data-bmn-photo="${i}"><i class="bx ${(p.mimeType||'').includes('pdf')?'bx-file-pdf':'bx-image'}"></i> ${esc(p.fileName||'Dokumen '+(i+1))}${p.migrationStatus==='pending'?' (belum dipindahkan)':''}</button>`).join('') : '<span class="text-body-secondary small">Belum ada foto/dokumen.</span>'}</div>
    <div class="d-flex justify-content-end mt-4"><button class="btn btn-secondary" id="bmnDetailDone">Tutup</button></div>
  </div>`;
  $('dlg').showModal(); const close=()=> $('dlg').close();
  $('bmnDetailClose').onclick=close; $('bmnDetailDone').onclick=close;
  $('bmnPhotoButtons').querySelectorAll('[data-bmn-photo]').forEach(btn=>btn.onclick=()=>bmnOpenFile(photos[Number(btn.dataset.bmnPhoto)]));
}

async function bmnOpenFile(photo) {
  if (photo.migrationStatus==='pending' || photo.legacyUrl) return bmnNotice('Dokumen ini masih berada di lokasi lama. Admin dapat menjalankan migrasi ke folder BIMASATU.','warning');
  try {
    const response=await api({action:'bmn-file',id:photo.fileId});
    const blob=await response.blob(), url=URL.createObjectURL(blob);
    const a=Object.assign(document.createElement('a'),{href:url,target:'_blank',rel:'noopener',download:photo.fileName||'dokumen-bmn'});
    document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch(e){bmnNotice(e.message,'danger');}
}

async function bmnDelete(id) {
  const r=BMN_UI.rows.find(x=>x.id===id); if(!r || !confirm('Hapus data BMN "'+r.namaBarang+'"? Data yang dihapus tidak dapat dikembalikan dari aplikasi.'))return;
  try {
    await gas('bmnDelete',{id});
    bmnNotice('Data BMN dihapus. File Drive tidak ikut dihapus otomatis untuk menghindari kehilangan arsip.');
    await bmnLoad();
  } catch(e){bmnNotice(e.message,'danger');}
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

async function bmnImportLegacy() {
  if(!confirm('Impor data BMN dari Apps Script lama yang sudah dikonfigurasi? Data pada BIMASATU yang sudah ada tidak akan ditimpa.'))return;
  try {
    const result=await gas('bmnImportLegacy',{});
    const d=result.data||{};
    bmnNotice('Sumber: '+(d.source || 'BMN lama')+'. Data sumber: '+(d.sourceCount || 0)+'; masuk: '+d.imported+', dilewati: '+d.skipped+', foto menunggu migrasi: '+d.fotoPending+'.'+(d.endpointWarning ? ' Catatan endpoint: '+d.endpointWarning : '')+(d.errors && d.errors.length ? ' Gagal: '+d.errors.join(' | ') : ''));
    await bmnLoad();
  } catch(e){bmnNotice(e.message,'danger');}
}

async function bmnMigrateLegacyPhotos() {
  const pending=[];
  BMN_UI.rows.forEach(r=>(r.fotos||[]).forEach((p,i)=>{if(p.migrationStatus==='pending' && p.legacyUrl)pending.push({r,p,i});}));
  if(!pending.length)return bmnNotice('Tidak ada foto lama yang menunggu migrasi.','warning');
  if(!confirm('Salin '+pending.length+' foto/dokumen lama ke folder BIMASATU? File lama tidak dihapus.'))return;
  let ok=0, fail=0;
  for(const item of pending){
    try{
      const result=await api({action:'bmn-salin'},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        url:item.p.legacyUrl,satker:item.r.satker,kodeBarang:item.r.kodeBarang,bmnId:item.r.id,fileName:item.p.fileName
      })});
      const data=await result.json();
      const fresh=BMN_UI.rows.find(x=>x.id===item.r.id);
      fresh.fotos[item.i]={fileId:data.id,fileName:item.p.fileName,fileSize:item.p.fileSize,mimeType:item.p.mimeType,migrationStatus:'master'};
      await gas('bmnSave',{data:{
        id:fresh.id,satker:fresh.satker,kodeBarang:fresh.kodeBarang,namaBarang:fresh.namaBarang,jenis:fresh.jenis,
        tahunPerolehan:fresh.tahunPerolehan,sumberPerolehan:fresh.sumberPerolehan,nilaiPerolehan:fresh.nilaiPerolehan,
        kondisi:fresh.kondisi,status:fresh.status,lokasiBarang:fresh.lokasiBarang,idBMN:fresh.idBMN,keterangan:fresh.keterangan,fotos:fresh.fotos
      }});
      ok++;
    }catch(e){fail++;}
  }
  bmnNotice('Migrasi foto selesai. Berhasil: '+ok+', gagal: '+fail+(fail?' (periksa tautan/izin file lama).':''),fail?'warning':'success');
  await bmnLoad();
}

pages.bmn = pageBMN;
