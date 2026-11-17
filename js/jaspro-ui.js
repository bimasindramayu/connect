/* =====================================================================================
   jaspro-ui.js: alur satu halaman untuk Jaspro Transpo.
   Mesin hitung, pencocokan, workbook, dan CSV tetap memakai JX/jp* dari jaspro.js.
   ===================================================================================== */

function jpUiMoney(value) {
  return 'Rp ' + rp(Math.round(Number(value) || 0));
}
function jpUiPeriod(id) {
  return J.periods.find(function (p) { return p.id === id; }) || null;
}
function jpUiBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.labelIdle = button.dataset.labelIdle || button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' + (label || 'Menyimpan…');
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = button.dataset.labelIdle || label || 'Simpan';
    delete button.dataset.labelIdle;
  }
}
function jpUiSetDialogWide(dialog) {
  dialog.classList.add('jp-dialog-wide');
}
function jpUiBuildRows(report, settings) {
  const rows = report && Array.isArray(report.rows) ? report.rows : [];
  const index = JX.buildMasterIndex(J.master);
  return rows.map(function (row) {
    const match = JX.matchPenghulu(row.nama, J.master, index);
    const master = match.entry;
    return Object.assign({}, row, JX.classifyRow(row, settings), {
      rekening: master ? master.noRekening : (row.noRekeningSumber || ''),
      namaPemilik: master ? (master.namaPemilik || master.nama) : '',
      matchStatus: master ? match.status : 'TIDAK_DITEMUKAN',
      candidates: match.candidates || []
    });
  });
}
function jpUiRender() {
  const panel = $('jpanel');
  if (!panel) return;
  if (J.detailId) {
    const period = jpUiPeriod(J.detailId);
    if (!period || !period.laporan) {
      J.detailId = '';
      J.rows = null;
      jpUiRender();
      return;
    }
    panel.innerHTML = jpDetailPeriode(period);
    if (!J.rows || J.previewPeriodId !== period.id) {
      J.set = jpMuatSet(period.settings);
      J.laporan = period.laporan;
      J.periodId = period.id;
      J.rows = jpUiBuildRows(period.laporan, J.set);
      J.previewPeriodId = period.id;
      J.stale = false;
    }
    jpReview();
    return;
  }
  panel.innerHTML = pRiwayat();
}
function jpUiUploadModal() {
  const current = new Date();
  const monthOptions = JX.BULAN_LIST.map(function (month, index) {
    const label = month.charAt(0) + month.slice(1).toLowerCase();
    return '<option value="' + month + '"' + (index === current.getMonth() ? ' selected' : '') + '>' + label + '</option>';
  }).join('');
  jpDlg(
    '<div class="jp-modal-head"><div><div class="jp-eyebrow">LAPORAN BULANAN</div><h5 class="mb-1">Unggah Laporan XLS</h5><p class="text-body-secondary mb-0">Pilih periode dan file nominatif .xlsx. Setiap periode disimpan terpisah.</p></div><button type="button" class="btn-close" data-x aria-label="Tutup"></button></div>' +
    '<div class="row g-3 mt-2 mb-3">' +
      '<div class="col-sm-6"><label class="form-label" for="jp-upload-month">Bulan laporan</label><select id="jp-upload-month" class="form-select">' + monthOptions + '</select></div>' +
      '<div class="col-sm-6"><label class="form-label" for="jp-upload-year">Tahun laporan</label><input id="jp-upload-year" class="form-control" type="number" min="1900" max="2200" step="1" value="' + current.getFullYear() + '"></div>' +
    '</div>' +
    '<input id="jp-upload-file" type="file" accept=".xlsx" hidden>' +
    '<button class="jp-drop w-100" type="button" id="jp-upload-drop">' +
      '<span class="jp-drop-icon"><i class="bx bx-cloud-upload"></i></span><span class="d-block fw-semibold">Pilih file Excel atau seret ke area ini</span>' +
      '<span class="small text-body-secondary d-block mt-1">Format .xlsx · Maksimal 5.000 baris data</span>' +
    '</button>' +
    '<div id="jp-upload-selected" class="small text-body-secondary mt-2">Belum ada file dipilih.</div>' +
    '<div id="jp-upload-confirm" class="alert alert-warning mt-3 d-none" role="status">Periode ini sudah memiliki laporan. Menyimpan akan mengganti laporan pada bulan ini saja; arsip bulan lain tidak berubah.</div>' +
    '<div id="jp-upload-error" class="mt-3" aria-live="polite"></div>' +
    '<div class="d-flex justify-content-end gap-2 mt-4"><button class="btn btn-outline-secondary" type="button" data-x>Batal</button><button class="btn btn-primary" type="button" id="jp-upload-save" disabled>Simpan Laporan</button></div>',
    function (dialog) {
      const fileInput = dialog.querySelector('#jp-upload-file');
      const drop = dialog.querySelector('#jp-upload-drop');
      const selected = dialog.querySelector('#jp-upload-selected');
      const save = dialog.querySelector('#jp-upload-save');
      const confirmBox = dialog.querySelector('#jp-upload-confirm');
      const errorBox = dialog.querySelector('#jp-upload-error');
      let file = null;
      let prepared = null;
      const setFile = function (next) {
        file = next || null;
        prepared = null;
        confirmBox.classList.add('d-none');
        errorBox.innerHTML = '';
        save.dataset.labelIdle = '';
        save.innerHTML = 'Simpan Laporan';
        save.disabled = !file;
        selected.textContent = file ? file.name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' KB' : 'Belum ada file dipilih.';
      };
      dialog.querySelectorAll('[data-x]').forEach(function (button) { button.onclick = function () { dialog.close(); }; });
      drop.onclick = function () { fileInput.click(); };
      drop.onkeydown = function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
      };
      drop.ondragover = function (event) { event.preventDefault(); drop.classList.add('is-dragover'); };
      drop.ondragleave = function () { drop.classList.remove('is-dragover'); };
      drop.ondrop = function (event) {
        event.preventDefault(); drop.classList.remove('is-dragover');
        setFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
      };
      fileInput.onchange = function () { setFile(fileInput.files && fileInput.files[0]); };
      dialog.querySelector('#jp-upload-month').onchange = function () { prepared = null; confirmBox.classList.add('d-none'); };
      dialog.querySelector('#jp-upload-year').onchange = function () { prepared = null; confirmBox.classList.add('d-none'); };
      save.onclick = async function () {
        errorBox.innerHTML = '';
        const month = dialog.querySelector('#jp-upload-month').value;
        const year = Number(dialog.querySelector('#jp-upload-year').value);
        const monthNumber = JX.BULAN_LIST.indexOf(month) + 1;
        if (!Number.isInteger(year) || year < 1900 || year > 2200 || monthNumber < 1) {
          errorBox.innerHTML = note('Bulan dan tahun laporan belum sah.', 'warning');
          return;
        }
        if (!file || !/\.xlsx$/i.test(file.name) || !file.size) {
          errorBox.innerHTML = note('Pilih file Excel .xlsx yang tidak kosong.', 'warning');
          return;
        }
        const id = String(year).padStart(4, '0') + '-' + String(monthNumber).padStart(2, '0');
        if (prepared && prepared.id === id) {
          await jpUiPersistUpload(id, prepared.report, dialog, save, errorBox);
          return;
        }
        jpUiBusy(save, true, 'Memeriksa file…');
        try {
          await jpX();
          const parsed = await JX.parseLaporanFile(file);
          if (!parsed.ok) throw new Error(parsed.error || 'File tidak dapat dibaca.');
          if (parsed.rows.length > 5000) throw new Error('Maksimal 5.000 baris per laporan.');
          const duplicates = jpDuplikatJadwal(parsed.rows);
          if (duplicates.length) {
            const sample = duplicates.slice(0, 5).map(function (item) {
              return 'Baris ' + item.baris + ' duplikat dengan baris ' + item.pertama + ' (' + item.nama + ').';
            }).join(' ');
            throw new Error('Ditemukan ' + duplicates.length + ' jadwal duplikat. Data tidak disimpan. ' + sample);
          }
          const existing = jpUiPeriod(id);
          prepared = { id: id, report: { fileName: file.name, rows: parsed.rows, tanggalTakSah: parsed.tanggalTakSah || 0 } };
          if (existing && existing.laporan) {
            confirmBox.classList.remove('d-none');
            save.dataset.labelIdle = 'Ganti & Simpan';
            save.innerHTML = 'Ganti & Simpan';
            save.disabled = false;
          } else {
            await jpUiPersistUpload(id, prepared.report, dialog, save, errorBox);
          }
        } catch (error) {
          errorBox.innerHTML = note(error.message || 'File gagal diproses.', 'danger');
          jpToast(error.message || 'File gagal diproses.', 'danger');
          jpUiBusy(save, false);
          save.disabled = !file;
        }
      };
    }
  );
  jpUiSetDialogWide($('dlg'));
}
async function jpUiPersistUpload(id, report, dialog, button, errorBox) {
  jpUiBusy(button, true, 'Menyimpan laporan…');
  const previous = { set: J.set, laporan: J.laporan, periodId: J.periodId, rows: J.rows, previewPeriodId: J.previewPeriodId };
  const existing = jpUiPeriod(id);
  const parts = id.split('-').map(Number);
  const settings = jpMuatSet(existing ? existing.settings : jpDef());
  settings.tahun = parts[0];
  settings.bulan = JX.BULAN_LIST[parts[1] - 1];
  J.set = settings;
  J.periodId = id;
  J.laporan = existing ? existing.laporan : null;
  try {
    const ok = await jpSave({ laporan: report, settings: jpSetOut() });
    if (!ok) throw new Error('Laporan belum berhasil disimpan ke server. Periksa koneksi dan coba lagi.');
    J.historyYear = parts[0];
    J.set = previous.set;
    J.laporan = previous.laporan;
    J.periodId = previous.periodId;
    J.rows = previous.rows;
    J.previewPeriodId = previous.previewPeriodId;
    dialog.close();
    jpUiRender();
    jpToast(report.rows.length + ' baris laporan tersimpan untuk ' + jpPeriodLabel(id) + '.', 'success');
  } catch (error) {
    J.set = previous.set;
    J.laporan = previous.laporan;
    J.periodId = previous.periodId;
    J.rows = previous.rows;
    J.previewPeriodId = previous.previewPeriodId;
    errorBox.innerHTML = note(error.message || 'Laporan gagal disimpan. Isian tetap tersedia untuk dicoba lagi.', 'danger');
    jpUiBusy(button, false);
    button.disabled = false;
  }
}
function jpUiMasterRows(query) {
  const q = JX.normalizeCoreName(query || '');
  const counts = {};
  J.master.forEach(function (item) {
    const key = JX.normalizeCoreName(item.nama);
    counts[key] = (counts[key] || 0) + 1;
  });
  const rows = J.master.slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); }).filter(function (item) {
    return !q || JX.normalizeCoreName(item.nama).includes(q) || String(item.noRekening || '').includes(q);
  });
  return {
    total: rows.length,
    html: rows.map(function (item) {
      const duplicate = counts[JX.normalizeCoreName(item.nama)] > 1;
      return '<tr><td><span class="fw-semibold">' + esc(item.nama) + '</span>' + (duplicate ? ' <span class="badge bg-label-warning">Nama ganda</span>' : '') + '</td>' +
        '<td>' + esc(item.namaPemilik || item.nama) + '</td><td class="text-nowrap">' + esc(item.noRekening || '—') + '</td>' +
        '<td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" type="button" data-master-act="edit" data-id="' + esc(item.id) + '">Ubah</button> ' +
        '<button class="btn btn-sm btn-outline-danger" type="button" data-master-act="delete" data-id="' + esc(item.id) + '">Hapus</button></td></tr>';
    }).join('')
  };
}
function jpUiMasterModal() {
  jpDlg(
    '<div class="jp-modal-head"><div><div class="jp-eyebrow">DATA INDUK</div><h5 class="mb-1">Master Rekening Penghulu</h5><p class="text-body-secondary mb-0">Daftar ini dipakai untuk mencocokkan nama penghulu dan mengisi nomor rekening pada setiap bulan.</p></div><button class="btn-close" type="button" data-x aria-label="Tutup"></button></div>' +
    '<div class="d-flex flex-wrap align-items-center gap-2 my-3"><div class="input-group jp-master-search"><span class="input-group-text"><i class="bx bx-search"></i></span><input id="jp-master-search" class="form-control" type="search" placeholder="Cari nama atau nomor rekening"></div>' +
      '<span id="jp-master-count" class="small text-body-secondary ms-sm-auto"></span></div>' +
    '<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-primary" type="button" data-master-act="add"><i class="bx bx-plus"></i> Tambah Penghulu</button>' +
      '<button class="btn btn-outline-secondary" type="button" data-master-act="import"><i class="bx bx-upload"></i> Impor Excel</button>' +
      '<button class="btn btn-outline-secondary" type="button" data-master-act="export"><i class="bx bx-download"></i> Ekspor Excel</button></div>' +
    '<input id="jp-master-file" type="file" accept=".xlsx" hidden>' +
    '<div class="jp-table-scroll"><table class="table table-hover align-middle mb-0"><thead><tr><th>Nama Penghulu</th><th>Nama Pemilik Rekening</th><th>Nomor Rekening</th><th class="text-end">Aksi</th></tr></thead><tbody id="jp-master-rows"></tbody></table></div>' +
    '<div id="jp-master-empty" class="jp-empty d-none"><div class="jp-empty-icon"><i class="bx bx-id-card"></i></div><div class="fw-semibold">Belum ada data rekening</div><p class="small text-body-secondary mb-0">Tambahkan penghulu satu per satu atau impor daftar dari Excel.</p></div>' +
    '<div id="jp-master-error" class="mt-3" aria-live="polite"></div>' +
    '<div class="d-flex justify-content-end mt-4"><button class="btn btn-outline-secondary" type="button" data-x>Tutup</button></div>',
    function (dialog) {
      const search = dialog.querySelector('#jp-master-search');
      const tbody = dialog.querySelector('#jp-master-rows');
      const count = dialog.querySelector('#jp-master-count');
      const empty = dialog.querySelector('#jp-master-empty');
      const render = function () {
        const result = jpUiMasterRows(search.value);
        tbody.innerHTML = result.html;
        count.textContent = result.total + ' dari ' + J.master.length + ' data';
        empty.classList.toggle('d-none', result.total > 0);
        tbody.closest('table').classList.toggle('d-none', result.total === 0);
      };
      dialog.querySelectorAll('[data-x]').forEach(function (button) { button.onclick = function () { dialog.close(); }; });
      search.oninput = render;
      dialog.querySelector('#jp-master-file').onchange = function () {
        const file = this.files && this.files[0];
        this.value = '';
        if (file) jpImport(file);
      };
      dialog.addEventListener('click', function (event) {
        const button = event.target.closest('[data-master-act]');
        if (!button) return;
        const action = button.dataset.masterAct;
        const id = button.dataset.id;
        if (action === 'add') jpUiMasterForm();
        else if (action === 'edit') jpUiMasterForm(id);
        else if (action === 'import') dialog.querySelector('#jp-master-file').click();
        else if (action === 'export') jpMExp();
        else if (action === 'delete') {
          const item = J.master.find(function (entry) { return entry.id === id; });
          if (!item) return;
          jpAsk('Hapus rekening penghulu?', 'Data rekening untuk ' + item.nama + ' akan dihapus dari Master Rekening. Arsip laporan bulanan tidak dihapus.', 'Hapus', async function () {
            const next = J.master.filter(function (entry) { return entry.id !== id; });
            const ok = await jpSave({ master: next });
            if (ok) { jpToast('Data rekening berhasil dihapus.'); jpUiMasterModal(); }
            else jpUiMasterModal();
          }, true);
        }
      });
      render();
    }
  );
  jpUiSetDialogWide($('dlg'));
}
function jpUiMasterForm(id) {
  const current = J.master.find(function (entry) { return entry.id === id; });
  jpDlg(
    '<div class="jp-modal-head"><div><div class="jp-eyebrow">MASTER REKENING</div><h5 class="mb-1">' + (current ? 'Ubah' : 'Tambah') + ' Penghulu</h5><p class="text-body-secondary mb-0">Isi nama sesuai daftar penghulu dan nomor rekening penerima.</p></div><button type="button" class="btn-close" data-x aria-label="Tutup"></button></div>' +
    '<div id="jp-master-form-error" class="mt-3" aria-live="polite"></div>' +
    '<div class="mt-3"><label class="form-label" for="jp-master-name">Nama Penghulu</label><input id="jp-master-name" class="form-control" value="' + esc(current ? current.nama : '') + '" placeholder="Nama lengkap penghulu" required></div>' +
    '<div class="mt-3"><label class="form-label" for="jp-master-owner">Nama Pemilik Rekening</label><input id="jp-master-owner" class="form-control" value="' + esc(current ? current.namaPemilik : '') + '" placeholder="Kosongkan bila sama dengan nama penghulu"></div>' +
    '<div class="mt-3"><label class="form-label" for="jp-master-account">Nomor Rekening</label><input id="jp-master-account" class="form-control" inputmode="numeric" value="' + esc(current ? current.noRekening : '') + '" placeholder="Nomor rekening" required></div>' +
    '<div class="d-flex justify-content-end gap-2 mt-4"><button type="button" class="btn btn-outline-secondary" data-x>Batal</button><button type="button" class="btn btn-primary" id="jp-master-save">' + (current ? 'Simpan Perubahan' : 'Simpan Penghulu') + '</button></div>',
    function (dialog) {
      dialog.classList.remove('jp-dialog-wide');
      dialog.querySelectorAll('[data-x]').forEach(function (button) { button.onclick = function () { jpUiMasterModal(); }; });
      dialog.querySelector('#jp-master-save').onclick = async function () {
        const button = this;
        const error = dialog.querySelector('#jp-master-form-error');
        error.innerHTML = '';
        const nama = dialog.querySelector('#jp-master-name').value.trim();
        const noRekening = dialog.querySelector('#jp-master-account').value.trim();
        const namaPemilik = dialog.querySelector('#jp-master-owner').value.trim() || nama;
        if (!nama || !noRekening) {
          error.innerHTML = note('Nama penghulu dan nomor rekening wajib diisi.', 'warning');
          return;
        }
        const next = J.master.map(function (entry) { return Object.assign({}, entry); });
        const existing = next.find(function (entry) { return entry.id === id; });
        const value = { nama: nama, namaPemilik: namaPemilik, noRekening: noRekening };
        if (existing) Object.assign(existing, value);
        else next.push(Object.assign({ id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000000) }, value));
        jpUiBusy(button, true, 'Menyimpan…');
        const ok = await jpSave({ master: next });
        if (!ok) {
          error.innerHTML = note('Data belum berhasil disimpan. Periksa koneksi lalu coba lagi.', 'danger');
          jpUiBusy(button, false);
          return;
        }
        dialog.close();
        jpToast('Master Rekening berhasil disimpan.');
        jpUiMasterModal();
      };
    }
  );
}
async function jpUiImportMaster(file) {
  if (!file || !/\.xlsx$/i.test(file.name) || !file.size) return jpToast('Pilih file Excel .xlsx yang tidak kosong.', 'warning');
  jpDlg('<h5 class="mb-2">Membaca Master Rekening</h5><p class="text-body-secondary mb-0"><span class="spinner-border spinner-border-sm me-2"></span>' + esc(file.name) + '</p>');
  jpUiSetDialogWide($('dlg'));
  let parsed;
  try {
    await jpX();
    parsed = await JX.parseMasterFile(file);
    if (!parsed.ok) throw new Error(parsed.error || 'File tidak dapat dibaca.');
  } catch (error) {
    jpDlg('<h5 class="mb-2">Impor gagal</h5>' + note(error.message || 'File gagal dibaca.', 'danger') + '<div class="d-flex justify-content-end"><button class="btn btn-primary" data-x>Tutup</button></div>', function (dialog) {
      dialog.querySelector('[data-x]').onclick = function () { jpUiMasterModal(); };
    });
    jpUiSetDialogWide($('dlg'));
    return;
  }
  const entries = parsed.entries || [];
  const html = '<div class="jp-modal-head"><div><div class="jp-eyebrow">IMPOR DATA</div><h5 class="mb-1">Impor ' + entries.length + ' rekening</h5><p class="text-body-secondary mb-0">Pilih cara menerapkan data dari ' + esc(file.name) + '.</p></div></div>' +
    '<p class="mt-3 mb-3">Master saat ini berisi ' + J.master.length + ' data. Gabungkan akan memperbarui nama yang cocok dan menambahkan data baru. Ganti semua akan mengganti seluruh daftar rekening.</p>' +
    '<div id="jp-import-error" aria-live="polite"></div><div class="d-flex flex-wrap justify-content-end gap-2 mt-4"><button class="btn btn-outline-secondary" type="button" data-x>Batal</button>' +
      '<button class="btn btn-outline-danger" type="button" data-import="replace">Ganti Semua</button><button class="btn btn-primary" type="button" data-import="merge">Gabungkan & Simpan</button></div>';
  jpDlg(html, function (dialog) {
    dialog.querySelector('[data-x]').onclick = function () { jpUiMasterModal(); };
    dialog.querySelectorAll('[data-import]').forEach(function (button) {
      button.onclick = async function () {
        const mode = this.dataset.import;
        const error = dialog.querySelector('#jp-import-error');
        if (mode === 'replace' && button.dataset.confirmReplace !== 'yes') {
          button.dataset.confirmReplace = 'yes';
          button.textContent = 'Konfirmasi Ganti Semua';
          error.innerHTML = note('Semua ' + J.master.length + ' data rekening yang ada akan diganti dengan ' + entries.length + ' data dari file. Klik sekali lagi untuk melanjutkan.', 'warning');
          return;
        }
        let next;
        if (mode === 'replace') {
          next = entries.map(function (entry) { return { id: entry.id, nama: entry.nama, namaPemilik: entry.namaPemilik, noRekening: entry.noRekening }; });
        } else {
          next = J.master.map(function (entry) { return Object.assign({}, entry); });
          const index = JX.buildMasterIndex(next);
          entries.forEach(function (entry) {
            const matched = index[JX.normalizeCoreName(entry.nama)];
            if (matched && matched.length === 1) {
              const target = next.find(function (item) { return item.id === matched[0].id; });
              if (target) Object.assign(target, { nama: entry.nama, namaPemilik: entry.namaPemilik, noRekening: entry.noRekening });
            } else next.push(entry);
          });
        }
        jpUiBusy(button, true, 'Menyimpan…');
        const ok = await jpSave({ master: next });
        if (!ok) {
          error.innerHTML = note('Impor belum berhasil disimpan. Data lama tetap dipertahankan.', 'danger');
          jpUiBusy(button, false);
          return;
        }
        dialog.close();
        jpToast('Master Rekening berhasil diperbarui.');
        jpUiMasterModal();
      };
    });
  });
  jpUiSetDialogWide($('dlg'));
}
function jpUiSettingsModal() {
  const period = jpUiPeriod(J.detailId);
  if (!period) return;
  J.set = jpMuatSet(period.settings);
  J.laporan = period.laporan;
  J.periodId = period.id;
  const fields = [
    ['pphII', 'PNS Golongan II'], ['pphIII', 'PNS Golongan III'], ['pphIV', 'PNS Golongan IV'], ['pphPPPK', 'PPPK Golongan IX']
  ];
  const pph = fields.map(function (field) {
    return '<div class="col-sm-6"><label class="form-label" for="jp-pref-' + field[0] + '">' + field[1] + ' (%)</label><input id="jp-pref-' + field[0] + '" class="form-control" type="number" min="0" max="100" step="0.1" data-pref="' + field[0] + '" value="' + esc(J.set[field[0]]) + '"></div>';
  }).join('');
  const signer = [['kpa', 'Kolom Kiri'], ['ppk', 'Kolom Tengah'], ['bendahara', 'Kolom Kanan']].map(function (item) {
    const key = item[0];
    return '<div class="col-lg-4"><div class="jp-signer-card"><div class="fw-semibold mb-2">' + item[1] + '</div>' +
      '<label class="form-label small mb-1" for="jp-pref-' + key + 'Jabatan">Jabatan</label><input id="jp-pref-' + key + 'Jabatan" class="form-control form-control-sm" data-pref="' + key + 'Jabatan" value="' + esc(J.set[key + 'Jabatan']) + '">' +
      '<label class="form-label small mb-1 mt-2" for="jp-pref-' + key + 'Nama">Nama</label><input id="jp-pref-' + key + 'Nama" class="form-control form-control-sm" data-pref="' + key + 'Nama" value="' + esc(J.set[key + 'Nama']) + '">' +
      '<label class="form-label small mb-1 mt-2" for="jp-pref-' + key + 'Nip">NIP</label><input id="jp-pref-' + key + 'Nip" class="form-control form-control-sm" data-pref="' + key + 'Nip" value="' + esc(J.set[key + 'Nip']) + '"></div></div>';
  }).join('');
  jpDlg(
    '<div class="jp-modal-head"><div><div class="jp-eyebrow">PENGATURAN PERIODE</div><h5 class="mb-1">Pejabat &amp; PPh</h5><p class="text-body-secondary mb-0">Berlaku hanya untuk ' + esc(jpPeriodLabel(period.id)) + '. Pengaturan bulan lain tidak berubah.</p></div><button class="btn-close" type="button" data-x aria-label="Tutup"></button></div>' +
    '<div class="mt-4"><h6 class="mb-1">Tarif PPh Jasa Profesi</h6><p class="small text-body-secondary mb-3">PPh dikenakan pada Jasa Profesi. Transport tidak dikenakan PPh.</p><div class="row g-3">' + pph + '</div></div>' +
    '<div class="mt-4"><h6 class="mb-1">Tempat dan tanggal</h6><input class="form-control mt-2" data-pref="tempatTanggal" value="' + esc(J.set.tempatTanggal) + '" placeholder="Contoh: Indramayu, 30 November 2026"></div>' +
    '<div class="mt-4"><h6 class="mb-1">Pejabat penandatangan</h6><div class="row g-3 mt-1">' + signer + '</div></div>' +
    '<div id="jp-pref-error" class="mt-3" aria-live="polite"></div>' +
    '<div class="d-flex justify-content-end gap-2 mt-4"><button class="btn btn-outline-secondary" type="button" data-x>Batal</button><button class="btn btn-primary" type="button" id="jp-pref-save">Simpan Pengaturan</button></div>',
    function (dialog) {
      dialog.querySelectorAll('[data-x]').forEach(function (button) { button.onclick = function () { dialog.close(); }; });
      dialog.querySelector('#jp-pref-save').onclick = async function () {
        const button = this;
        const error = dialog.querySelector('#jp-pref-error');
        error.innerHTML = '';
        const next = jpMuatSet(J.set);
        dialog.querySelectorAll('[data-pref]').forEach(function (input) {
          const key = input.dataset.pref;
          next[key] = input.type === 'number' ? Number(input.value) : input.value.trim();
        });
        const invalid = fields.find(function (field) {
          const value = next[field[0]];
          return !Number.isFinite(value) || value < 0 || value > 100;
        });
        if (invalid) {
          error.innerHTML = note('Tarif ' + invalid[1] + ' harus diisi antara 0 sampai 100 persen.', 'warning');
          return;
        }
        const old = J.set;
        J.set = next;
        J.periodId = period.id;
        J.laporan = period.laporan;
        jpUiBusy(button, true, 'Menyimpan…');
        const ok = await jpSave({ settings: jpSetOut() });
        if (!ok) {
          J.set = old;
          error.innerHTML = note('Pengaturan belum berhasil disimpan. Perubahan tetap berada di formulir ini.', 'danger');
          jpUiBusy(button, false);
          return;
        }
        J.rows = jpUiBuildRows(period.laporan, J.set);
        J.previewPeriodId = period.id;
        dialog.close();
        jpUiRender();
        jpToast('Pengaturan ' + jpPeriodLabel(period.id) + ' berhasil disimpan.');
      };
    }
  );
  jpUiSetDialogWide($('dlg'));
}
function jpUiAnnualPage() {
  const now = new Date().getFullYear();
  const years = Array.from(new Set([now].concat(J.periods.filter(function (p) { return p.laporan; }).map(function (p) { return Number(p.tahun); })))).filter(Number.isFinite).sort(function (a, b) { return b - a; });
  if (!years.includes(Number(J.historyYear))) J.historyYear = now;
  const records = J.periods.filter(function (p) { return p.laporan && Number(p.tahun) === Number(J.historyYear); }).sort(function (a, b) { return a.bulan - b.bulan; });
  const values = records.map(function (period) {
    const calc = jpHitung(period.laporan, jpMuatSet(period.settings));
    return { period: period, calc: calc };
  });
  const total = function (key) { return values.reduce(function (sum, row) { return sum + (Number(row.calc[key]) || 0); }, 0); };
  const table = records.length ? (
    '<div class="jp-table-scroll"><table class="table table-hover align-middle mb-0"><thead><tr><th>Bulan</th><th class="text-end">Baris</th><th class="text-end">Peristiwa</th><th class="text-end">Jaspro bruto</th><th class="text-end">PPh</th><th class="text-end">Jaspro bersih</th><th class="text-end">Transport</th><th class="text-end">Dibayarkan</th><th class="text-end">Rincian</th></tr></thead><tbody>' +
    values.map(function (item) {
      const calc = item.calc, period = item.period;
      return '<tr><td class="fw-semibold">' + esc(jpPeriodLabel(period.id).replace(' ' + period.tahun, '')) + '</td>' +
        '<td class="text-end">' + calc.rows.length + '</td><td class="text-end">' + rp(calc.peristiwa) + '</td>' +
        '<td class="text-end text-nowrap">' + jpUiMoney(calc.jasproBruto) + '</td><td class="text-end text-nowrap">' + jpUiMoney(calc.pph) + '</td>' +
        '<td class="text-end text-nowrap">' + jpUiMoney(calc.jaspro) + '</td><td class="text-end text-nowrap">' + jpUiMoney(calc.transport) + '</td>' +
        '<td class="text-end text-nowrap fw-semibold">' + jpUiMoney(calc.total) + '</td>' +
        '<td class="text-end"><button class="btn btn-sm btn-outline-primary" type="button" data-act="detail" data-id="' + period.id + '">Detail</button></td></tr>';
    }).join('') + '</tbody><tfoot><tr class="fw-semibold"><td>TOTAL ' + J.historyYear + '</td><td></td><td class="text-end">' + rp(total('peristiwa')) + '</td>' +
    '<td class="text-end text-nowrap">' + jpUiMoney(total('jasproBruto')) + '</td><td class="text-end text-nowrap">' + jpUiMoney(total('pph')) + '</td>' +
    '<td class="text-end text-nowrap">' + jpUiMoney(total('jaspro')) + '</td><td class="text-end text-nowrap">' + jpUiMoney(total('transport')) + '</td>' +
    '<td class="text-end text-nowrap">' + jpUiMoney(total('total')) + '</td><td></td></tr></tfoot></table></div>'
  ) : '<div class="jp-empty"><div class="jp-empty-icon"><i class="bx bx-calendar-x"></i></div><div class="fw-semibold">Belum ada laporan pada tahun ' + J.historyYear + '</div><p class="small text-body-secondary mb-0">Pilih tahun lain atau unggah laporan untuk mulai membuat arsip tahunan.</p></div>';
  return '<section class="jp-annual">' +
    '<div class="jp-toolbar mb-3"><div><div class="jp-eyebrow">ARSIP JASPRO TRANSPORT</div><h5 class="mb-1">Riwayat Tahunan</h5><p class="text-body-secondary mb-0">Rekap laporan nominatif per bulan dan rincian pembayaran penghulu.</p></div>' +
      '<div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-primary" data-act="upload"><i class="bx bx-upload me-1"></i>Upload Laporan XLS</button>' +
      '<button type="button" class="btn btn-outline-secondary" data-act="master"><i class="bx bx-wallet me-1"></i>Setting Master Rekening</button></div></div>' +
    (records.length ? '<div class="row g-3 mb-3">' +
      jpCard('bx-wallet', 'primary', jpUiMoney(total('jaspro')), 'Jaspro bersih') +
      jpCard('bx-receipt', 'warning', jpUiMoney(total('pph')), 'Potongan PPh') +
      jpCard('bx-bus', 'info', jpUiMoney(total('transport')), 'Transport') +
      jpCard('bx-calculator', 'success', jpUiMoney(total('total')), 'Total dibayarkan') +
      '</div>' : '') +
    '<div class="card"><div class="card-body">' +
      '<div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3"><div><h6 class="mb-1">Laporan per bulan</h6><p class="small text-body-secondary mb-0">Pilih Detail untuk melihat nominatif, nomor rekening, dan unduhan bulan tersebut.</p></div>' +
      '<div><label class="form-label mb-1" for="jp-history-year">Tahun laporan</label><select id="jp-history-year" class="form-select" data-history-year>' + years.map(function (year) { return '<option value="' + year + '"' + (Number(year) === Number(J.historyYear) ? ' selected' : '') + '>' + year + '</option>'; }).join('') + '</select></div></div>' +
      table + '</div></div></section>';
}
function jpUiDetailPage(period) {
  const calc = jpHitung(period.laporan, jpMuatSet(period.settings));
  return '<section class="jp-detail">' +
    '<div class="jp-detail-head mb-3"><div><button type="button" class="btn btn-sm btn-outline-secondary mb-3" data-act="back"><i class="bx bx-arrow-back me-1"></i>Kembali ke Riwayat</button>' +
      '<div class="jp-eyebrow">RINCIAN PERIODE</div><h5 class="mb-1">' + esc(jpPeriodLabel(period.id)) + '</h5>' +
      '<p class="text-body-secondary mb-0">Sumber: ' + esc(period.laporan.fileName || 'Laporan Nominatif') + ' · ' + calc.rows.length + ' baris data</p></div>' +
      '<div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary" type="button" data-act="setting"><i class="bx bx-slider-alt me-1"></i>Setting Pejabat &amp; PPh</button>' +
      '<button class="btn btn-outline-danger" type="button" data-act="delete-period"><i class="bx bx-trash me-1"></i>Hapus Arsip</button></div></div>' +
    '<div class="row g-3 mb-3">' +
      jpCard('bx-wallet', 'primary', jpUiMoney(calc.jasproBruto), 'Jaspro bruto') +
      jpCard('bx-receipt', 'warning', jpUiMoney(calc.pph), 'Potongan PPh') +
      jpCard('bx-wallet', 'success', jpUiMoney(calc.jaspro), 'Jaspro bersih') +
      jpCard('bx-bus', 'info', jpUiMoney(calc.transport), 'Transport') +
      jpCard('bx-calculator', 'primary', jpUiMoney(calc.total), 'Total dibayarkan') +
      jpCard('bx-check-double', calc.mismatchCount ? 'warning' : 'success', calc.mismatchCount, 'Selisih kolom J') +
    '</div>' +
    '<div id="jrev"></div></section>';
}
function jpUiReview() {
  const rows = J.rows || [];
  const host = $('jrev');
  if (!host) return;
  if (!rows.length) {
    host.innerHTML = '<div class="jp-empty">Tidak ada baris nominatif untuk ditampilkan.</div>';
    return;
  }
  const sum = function (key) { return rows.reduce(function (total, row) { return total + (Number(row[key]) || 0); }, 0); };
  const automatic = rows.filter(function (row) { return row.matchStatus === 'OTOMATIS'; }).length;
  const needReview = rows.filter(function (row) { return !['OTOMATIS', 'MANUAL'].includes(row.matchStatus) || !row.rekening; }).length;
  const sourceRows = rows.filter(function (row) { return row.jumlahDiterimaSumber != null; });
  const mismatch = sourceRows.filter(function (row) { return !row.jumlahDiterimaCocok; }).length;
  const hasDate = rows.some(function (row) { return JX.tglSah(row.tanggal); });
  const columns = '<th>No</th><th>Nama Penghulu</th><th>KUA</th><th>NIP</th><th>Golongan</th><th>Status Cocok</th><th>Nomor Rekening</th><th>Nama Pemilik</th>' +
    (hasDate ? '<th>Tanggal</th>' : '') + '<th class="text-end">Peristiwa</th><th class="text-end">Jaspro diterima</th><th class="text-end">Transport</th><th class="text-end">Diterima file (J)</th><th class="text-end">Hasil bruto (H+I)</th><th>Pemeriksaan</th><th class="text-end">Dibayarkan</th>';
  const body = rows.map(function (row, index) {
    const status = JST[row.matchStatus] || JST.TIDAK_DITEMUKAN;
    const needs = !['OTOMATIS', 'MANUAL'].includes(row.matchStatus);
    const candidate = row.candidates && row.candidates[0];
    const accountHint = row.rekening ? (row.matchStatus === 'TIDAK_DITEMUKAN' ? '<small class="d-block text-body-secondary">Nomor dari file; belum cocok ke master</small>' : '') : '<small class="d-block text-warning">Belum ada nomor rekening di Master</small>';
    const golonganUnknown = row.golClass === 'UNKNOWN';
    return '<tr class="' + (needs || !row.rekening ? 'issue' : '') + '"><td>' + (index + 1) + '</td><td>' + esc(row.nama) + '</td><td>' + esc(row.kua) + '</td><td>' + esc(row.nip) + '</td>' +
      '<td><input class="form-control form-control-sm jp-inline-input" data-i="' + index + '" data-f="gol" value="' + esc(row.golongan) + '"><span class="badge bg-label-' + (golonganUnknown ? 'danger' : 'secondary') + ' mt-1">' + (golonganUnknown ? 'Golongan tidak dikenali' : esc(JX.golonganLabel(row.golClass))) + '</span></td>' +
      '<td><span class="badge bg-label-' + status[0] + '">' + status[1] + '</span>' + (needs && candidate ? '<button class="btn btn-link btn-sm p-0 d-block text-start" type="button" data-act="use" data-i="' + index + '">Pakai: ' + esc(candidate.nama) + '</button>' : '') + '</td>' +
      '<td><input class="form-control form-control-sm jp-inline-input jp-account-input" data-i="' + index + '" data-f="rek" value="' + esc(row.rekening) + '" placeholder="Belum ada rekening">' + accountHint + '</td>' +
      '<td><input class="form-control form-control-sm jp-inline-input jp-owner-input" data-i="' + index + '" data-f="own" value="' + esc(row.namaPemilik || '') + '" placeholder="Nama pemilik rekening"></td>' +
      (hasDate ? '<td class="text-nowrap">' + (JX.tglSah(row.tanggal) ? JX.tglID(row.tanggal) : '–') + '</td>' : '') +
      '<td class="text-end">' + rp(row.jumlahPeristiwa) + '</td><td class="text-end text-nowrap">' + jpUiMoney(row.jasproDiterima) + '<small class="d-block text-body-secondary">@ ' + rp(row.tarifJaspro) + '</small></td>' +
      '<td class="text-end text-nowrap">' + jpUiMoney(row.transpoDiterima) + '<small class="d-block text-body-secondary">@ ' + rp(row.tarifTransport) + '</small></td>' +
      '<td class="text-end text-nowrap">' + (row.jumlahDiterimaSumber == null ? '–' : jpUiMoney(row.jumlahDiterimaSumber)) + '</td>' +
      '<td class="text-end text-nowrap fw-semibold">' + jpUiMoney(row.jumlahDiterimaHitung) + '</td>' +
      '<td>' + (row.jumlahDiterimaSumber == null ? '<span class="badge bg-label-secondary">Tidak ada di file</span>' : row.jumlahDiterimaCocok ? '<span class="badge bg-label-success">Sesuai</span>' : '<span class="badge bg-label-warning">Selisih ' + jpUiMoney(Math.abs(row.selisihJumlahDiterima)) + '</span>') + '</td>' +
      '<td class="text-end text-nowrap fw-semibold">' + jpUiMoney(row.jumlahDiterimaBersih) + '</td></tr>';
  }).join('');
  const downloads = '<div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3"><p class="small text-body-secondary mb-0">Perubahan golongan dan rekening pada pratinjau ini bersifat sementara selama halaman terbuka.</p>' +
    '<div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-outline-secondary" type="button" data-act="dct"><i class="bx bx-download me-1"></i>CSV Transport</button>' +
    '<button class="btn btn-sm btn-outline-secondary" type="button" data-act="dcj"><i class="bx bx-download me-1"></i>CSV Jaspro</button>' +
    '<button class="btn btn-sm btn-primary" type="button" data-act="dxl"><i class="bx bx-file me-1"></i>Excel Nominatif</button></div></div>';
  host.innerHTML = '<div class="row g-3 mb-3">' +
    jpCard('bx-list-ul', 'primary', rows.length, 'Total baris') +
    jpCard('bx-check-circle', 'success', automatic, 'Cocok otomatis') +
    jpCard('bx-error', needReview ? 'warning' : 'success', needReview, 'Perlu ditinjau') +
    jpCard('bx-wallet', 'info', jpUiMoney(sum('jasproDiterima')), 'Jaspro diterima') +
    jpCard('bx-bus', 'info', jpUiMoney(sum('transpoDiterima')), 'Transport diterima') +
    jpCard('bx-check-double', mismatch ? 'warning' : 'success', sourceRows.length ? (sourceRows.length - mismatch) + '/' + sourceRows.length : '–', 'Pemeriksaan kolom J') +
    '</div><div class="card"><div class="card-body"><div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h6 class="mb-1">Pratinjau Nominatif</h6><p class="small text-body-secondary mb-0">Nomor rekening ditampilkan dari Master Rekening atau dari file sumber bila tersedia.</p></div><span class="small text-body-secondary">' + rows.length + ' baris</span></div>' +
    '<div class="jp-table-scroll"><table class="table table-sm table-hover align-middle mb-0"><thead><tr>' + columns + '</tr></thead><tbody>' + body + '</tbody></table></div>' + downloads + '</div></div>';
}
function jpUiDeletePeriod(id) {
  const period = jpUiPeriod(id);
  if (!period) return;
  jpAsk('Hapus arsip ' + jpPeriodLabel(id) + '?', 'Laporan dan pengaturan khusus periode ini akan dihapus permanen. Master Rekening dan arsip bulan lain tidak terpengaruh.', 'Hapus Arsip', async function () {
    const result = await sb.from('jaspro_periode').delete().eq('id', id);
    if (result.error) {
      jpToast('Gagal menghapus arsip: ' + result.error.message, 'danger');
      return;
    }
    J.periods = J.periods.filter(function (item) { return item.id !== id; });
    J.detailId = '';
    J.rows = null;
    J.previewPeriodId = '';
    jpUiRender();
    jpToast('Arsip ' + jpPeriodLabel(id) + ' berhasil dihapus.');
  }, true);
}

/* ---- Ganti antarmuka bertab dengan riwayat tahunan + rincian periode ---- */
pageJaspro = async function () {
  $('view').innerHTML = '<div class="jp" id="jroot"><div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">' +
    '<div><h4 class="mb-1">Jaspro Transpo</h4><p class="mb-0 text-body-secondary">Pengelolaan laporan nominatif dan riwayat pembayaran penghulu.</p></div>' +
    '<span id="jstat" class="badge bg-label-secondary">Memuat…</span></div><div id="jmsg"></div><div id="jpanel">Memuat data arsip…</div></div>';
  const firstLoad = !J.on;
  if (firstLoad || REFRESH_PAGE_DATA) {
    const retainedYear = Number(J.historyYear) || new Date().getFullYear();
    const retainedDetail = J.detailId || '';
    const results = await Promise.all([
      sb.from('jaspro_data').select('master').eq('id', 1).maybeSingle(),
      sb.from('jaspro_periode').select('id,tahun,bulan,laporan,settings,updated_at').order('id', { ascending: false })
    ]);
    const masterResult = results[0], periodResult = results[1];
    if (masterResult.error) {
      $('jpanel').innerHTML = note('Gagal memuat Master Rekening: ' + masterResult.error.message);
      return;
    }
    if (periodResult.error) {
      $('jpanel').innerHTML = note('Gagal memuat arsip Jaspro. Jalankan bop.sql versi terbaru di Supabase terlebih dahulu. Pesan: ' + periodResult.error.message);
      return;
    }
    J.master = masterResult.data && masterResult.data.master ? masterResult.data.master : [];
    J.periods = periodResult.data || [];
    J.on = true;
    J.historyYear = firstLoad ? new Date().getFullYear() : retainedYear;
    J.detailId = retainedDetail && J.periods.some(function (item) { return item.id === retainedDetail && item.laporan; }) ? retainedDetail : '';
    if (J.detailId) jpLoadPeriod(J.detailId);
    else {
      J.rows = null;
      J.previewPeriodId = '';
    }
  }
  const root = $('jroot');
  root.onclick = jpClick;
  root.onchange = jpChange;
  root.oninput = jpInput;
  jpStat('Tersimpan', 'success');
  jpUiRender();
};
jpRender = jpUiRender;
pRiwayat = jpUiAnnualPage;
jpDetailPeriode = jpUiDetailPage;
jpReview = jpUiReview;
jpClick = function (event) {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const action = button.dataset.act;
  const id = button.dataset.id;
  if (action === 'upload') jpUiUploadModal();
  else if (action === 'master') jpUiMasterModal();
  else if (action === 'detail') {
    const period = jpUiPeriod(id);
    if (!period || !period.laporan) return;
    J.detailId = id;
    jpLoadPeriod(id);
    J.rows = jpUiBuildRows(period.laporan, J.set);
    J.previewPeriodId = id;
    jpUiRender();
    $('jpanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (action === 'back') {
    J.detailId = '';
    J.rows = null;
    J.previewPeriodId = '';
    jpUiRender();
  } else if (action === 'setting') jpUiSettingsModal();
  else if (action === 'delete-period') jpUiDeletePeriod(J.detailId);
  else if (action === 'use') {
    const row = J.rows && J.rows[Number(button.dataset.i)];
    const candidate = row && row.candidates && row.candidates[0];
    if (!row || !candidate) return;
    Object.assign(row, { rekening: candidate.noRekening, namaPemilik: candidate.namaPemilik || candidate.nama, matchStatus: 'MANUAL' });
    jpUiReview();
  } else if (action === 'dxl') jpDl('xlsx');
  else if (action === 'dcj') jpDl('jaspro');
  else if (action === 'dct') jpDl('transpo');
};
jpChange = async function (event) {
  const target = event.target;
  const data = target.dataset || {};
  if (data.historyYear != null) {
    J.historyYear = Number(target.value) || new Date().getFullYear();
    jpUiRender();
    return;
  }
  if (data.i == null || !J.rows) return;
  const row = J.rows[Number(data.i)];
  if (!row) return;
  if (data.f === 'gol') {
    row.golongan = target.value;
    Object.assign(row, JX.classifyRow(row, J.set));
  } else if (data.f === 'rek') {
    row.rekening = target.value.trim();
    row.matchStatus = 'MANUAL';
    const master = J.master.find(function (item) { return item.noRekening === row.rekening; });
    if (master) row.namaPemilik = master.namaPemilik || master.nama;
  } else if (data.f === 'own') row.namaPemilik = target.value.trim();
  jpUiReview();
};
jpInput = function () {};
jpProcess = function () {
  if (!J.laporan || !J.laporan.rows) return;
  J.rows = jpUiBuildRows(J.laporan, J.set);
  J.previewPeriodId = J.periodId;
  J.stale = false;
  jpUiReview();
};
jpUiDeletePeriod = jpUiDeletePeriod;
jpMForm = jpUiMasterForm;
jpImport = jpUiImportMaster;
