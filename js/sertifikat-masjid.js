/* =====================================================================================
   sertifikat-masjid.js: menu Sertifikat Masjid / Musala (data, form, cetak Piagam/SK/Rekomendasi)
   Salinan apa adanya dari portal sertifikat; data lewat callApi() (sertifikat.js) ke Apps Script. Tampilan: views/sertifikat-masjid.html.
   Dimuat setelah mesin PDF; berbagi variabel dengan arah-kiblat.js dan pengaturan-sertifikat.js (satu lingkup global).
   ===================================================================================== */

  /* ===================== SERTIFIKAT MASJID ===================== */

        var masjidData = [];
        var PENGATURAN_KUNCI = ['namaKepalaKantor', 'nipKepalaKantor', 'namaKasiBimas', 'nipKasiBimas', 'petugasUkur', 'ttdPetugasUkur'];
        var pengaturanCache = {
          namaKepalaKantor: '', nipKepalaKantor: '',
          namaKasiBimas: '', nipKasiBimas: '',
          petugasUkur: '', ttdPetugasUkur: ''
        };
        var modalMasjid = new bootstrap.Modal(document.getElementById('modalMasjid'));
        var modalCetak = new bootstrap.Modal(document.getElementById('modalCetak'));
        var JENIS_LABEL = { piagam: 'Piagam Identitas', sk: 'Surat Keterangan', rekom: 'Surat Rekomendasi' };

        // Daftar tipologi -- satu sumber untuk isi dropdown DAN validasi. Kalau
        // daftar di SIMAS berubah, cukup ubah dua array ini.
        var TIPOLOGI_MASJID = [
          'Masjid Negara', 'Masjid Nasional', 'Masjid Raya', 'Masjid Agung',
          'Masjid Besar', 'Masjid Jami', 'Masjid Bersejarah', 'Masjid di Tempat Publik'
        ];
        var TIPOLOGI_MUSOLA = [
          'Mushalla Tempat Publik', 'Mushalla Perkantoran',
          'Mushalla Pendidikan', 'Mushalla Perumahan / Pemukiman'
        ];
        // Nilai tipologi Musala versi lama (dulu hanya 2 pilihan) -> padanan barunya.
        var TIPOLOGI_MUSOLA_LAMA = {
          'di tempat publik': 'Mushalla Tempat Publik',
          'perumahan': 'Mushalla Perumahan / Pemukiman'
        };

        // Data wilayah dari DesaIndramayu.js: { "Kecamatan": ["Desa", ...], ... }
        var WILAYAH = typeof DesaWilayahIndramayu !== 'undefined' ? DesaWilayahIndramayu : null;

        function showMasjidError(message) {
          var el = document.getElementById('masjidAlert');
          el.textContent = message;
          el.classList.remove('d-none');
        }

        function loadMasjidList() {
          document.getElementById('masjidLoadingState').classList.remove('d-none');
          document.getElementById('masjidEmptyState').classList.add('d-none');
          callApi('listMasjid', {})
            .then(function (res) {
              document.getElementById('masjidLoadingState').classList.add('d-none');
              if (!res.success) {
                showMasjidError(res.message || 'Gagal memuat data masjid.');
                return;
              }
              masjidData = res.data || [];
              renderMasjidTable();
            })
            .catch(function (err) {
              document.getElementById('masjidLoadingState').classList.add('d-none');
              showMasjidError('Tidak dapat menghubungi server: ' + err.message);
            });
        }

        function renderMasjidTable() {
          var tbody = document.getElementById('masjidTableBody');
          tbody.innerHTML = '';

          if (masjidData.length === 0) {
            document.getElementById('masjidEmptyState').classList.remove('d-none');
            return;
          }
          document.getElementById('masjidEmptyState').classList.add('d-none');

          masjidData.forEach(function (m, idx) {
            var isMusola = m.jenis === 'musola';
            var labelJenis = isMusola ? 'Musala' : 'Masjid';
            var badgeClass = isMusola ? 'bg-label-info' : 'bg-label-success';
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + (idx + 1) + '</td>' +
              '<td><span class="badge ' + badgeClass + '">' + labelJenis + '</span></td>' +
              '<td>' + escapeHtml(m.namaMasjid) + '</td>' +
              '<td>' + escapeHtml(m.noIdNasional) + '</td>' +
              '<td>' + escapeHtml(m.kecamatan) + '</td>' +
              '<td>' + escapeHtml(m.tahunBerdiri || '-') + '</td>' +
              '<td>' +
                '<div class="dropdown d-inline-block me-1">' +
                  '<button class="btn btn-sm btn-label-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">' +
                    '<i class="icon-base bx bx-printer me-1"></i>Cetak' +
                  '</button>' +
                  '<ul class="dropdown-menu">' +
                    '<li><a class="dropdown-item cetak-item" href="javascript:void(0)" data-id="' + m.id + '" data-jenis="piagam">Piagam Identitas ' + labelJenis + '</a></li>' +
                    '<li><a class="dropdown-item cetak-item" href="javascript:void(0)" data-id="' + m.id + '" data-jenis="sk">Surat Keterangan</a></li>' +
                    '<li><a class="dropdown-item cetak-item" href="javascript:void(0)" data-id="' + m.id + '" data-jenis="rekom">Surat Rekomendasi</a></li>' +
                  '</ul>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-icon btn-label-secondary edit-item" data-id="' + m.id + '" title="Edit"><i class="icon-base bx bx-edit-alt"></i></button> ' +
                '<button type="button" class="btn btn-sm btn-icon btn-label-danger hapus-item" data-id="' + m.id + '" title="Hapus"><i class="icon-base bx bx-trash"></i></button>' +
              '</td>';
            tbody.appendChild(tr);
          });

          tbody.querySelectorAll('.edit-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
              openEditMasjid(btn.getAttribute('data-id'));
            });
          });
          tbody.querySelectorAll('.hapus-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
              hapusMasjid(btn.getAttribute('data-id'));
            });
          });
          tbody.querySelectorAll('.cetak-item').forEach(function (a) {
            a.addEventListener('click', function () {
              openModalCetak(a.getAttribute('data-id'), a.getAttribute('data-jenis'));
            });
          });
        }

        function findMasjid(id) {
          for (var i = 0; i < masjidData.length; i++) {
            if (String(masjidData[i].id) === String(id)) return masjidData[i];
          }
          return null;
        }

        function showModalMasjidError(message) {
          var el = document.getElementById('modalMasjidAlert');
          el.textContent = message;
          el.classList.remove('d-none');
        }

        function setSimpanMasjidLoading(isLoading) {
          document.getElementById('btnSimpanMasjid').disabled = isLoading;
          document.getElementById('btnSimpanMasjidText').classList.toggle('d-none', isLoading);
          document.getElementById('btnSimpanMasjidSpinner').classList.toggle('d-none', !isLoading);
        }

        // Menyesuaikan tampilan form (label Nama, input Jenis Tipologi) sesuai
        // Jenis yang dipilih -- dipakai saat Tambah, Edit, maupun saat radio
        // Jenis diganti langsung oleh pengguna.
        function applyJenisUi(jenis) {
          var isMusola = jenis === 'musola';
          document.getElementById('labelMasjidNama').textContent = isMusola ? 'Nama Musala *' : 'Nama Masjid *';
          document.getElementById('tipologiMasjidWrapper').classList.toggle('d-none', isMusola);
          document.getElementById('tipologiMusolaWrapper').classList.toggle('d-none', !isMusola);
        }

        document.querySelectorAll('input[name="masjidJenis"]').forEach(function (radio) {
          radio.addEventListener('change', function () {
            applyJenisUi(this.value);
          });
        });

        /* ---- Dropdown: tipologi, kecamatan, desa ---- */

        function byNama(a, b) {
          return a.localeCompare(b, 'id');
        }

        function fillSelect(select, values, placeholder) {
          select.innerHTML = '';
          var first = document.createElement('option');
          first.value = '';
          first.textContent = placeholder;
          select.appendChild(first);
          values.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
          });
        }

        // Memilih nilai di dropdown. Nilai yang tidak persis ada di daftar dicocokkan
        // tanpa membedakan huruf besar/kecil; kalau tetap tidak ada (mis. data lama
        // yang dulu diketik bebas), ditambahkan sebagai opsi "(data lama)" supaya
        // nilainya tidak hilang diam-diam saat data disimpan ulang.
        function setSelectValue(select, value) {
          var v = String(value === null || value === undefined ? '' : value).trim();
          if (!v) {
            select.value = '';
            return;
          }
          var lower = v.toLowerCase();
          for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].value && select.options[i].value.toLowerCase() === lower) {
              select.selectedIndex = i;
              return;
            }
          }
          var extra = document.createElement('option');
          extra.value = v;
          extra.textContent = v + ' (data lama)';
          select.appendChild(extra);
          select.value = v;
        }

        function kunciTipologi(text) {
          return String(text || '').toLowerCase().replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim();
        }

        // Memadankan nilai tipologi lama (mis. "Jami" -> "Masjid Jami") ke pilihan dropdown.
        function padankanTipologi(value, daftar, awalan) {
          var key = kunciTipologi(value);
          if (!key) return '';
          for (var i = 0; i < daftar.length; i++) {
            var opt = kunciTipologi(daftar[i]);
            if (opt === key || opt === kunciTipologi(awalan + ' ' + key)) return daftar[i];
          }
          return String(value).trim();
        }

        function padankanTipologiMusola(value) {
          return TIPOLOGI_MUSOLA_LAMA[kunciTipologi(value)] || padankanTipologi(value, TIPOLOGI_MUSOLA, 'Mushalla');
        }

        function isiOpsiTipologi() {
          fillSelect(document.getElementById('masjidTipologi'), TIPOLOGI_MASJID, '- Pilih Tipologi -');
          fillSelect(document.getElementById('masjidTipologiMusola'), TIPOLOGI_MUSOLA, '- Pilih Tipologi -');
        }

        function isiOpsiKecamatan() {
          var daftar = WILAYAH ? Object.keys(WILAYAH).sort(byNama) : [];
          fillSelect(document.getElementById('masjidKecamatan'), daftar, '- Pilih Kecamatan -');
        }

        // Daftar Desa mengikuti Kecamatan yang dipilih; kosong/dinonaktifkan selama
        // Kecamatan belum dipilih.
        function isiOpsiDesa(kecamatan, desaTerpilih) {
          var select = document.getElementById('masjidDesa');
          if (!kecamatan) {
            fillSelect(select, [], '- Pilih Kecamatan dulu -');
            select.disabled = true;
            return;
          }
          var daftar = WILAYAH && WILAYAH[kecamatan] ? WILAYAH[kecamatan].slice().sort(byNama) : [];
          fillSelect(select, daftar, '- Pilih Desa -');
          select.disabled = false;
          if (desaTerpilih) setSelectValue(select, desaTerpilih);
        }

        document.getElementById('masjidKecamatan').addEventListener('change', function () {
          isiOpsiDesa(this.value);
        });

        // Menyiapkan form dari nol: isi ulang semua dropdown (sekaligus membuang opsi
        // "(data lama)" sisa edit sebelumnya), lalu kosongkan isian dan peringatan.
        function siapkanFormMasjid() {
          isiOpsiTipologi();
          isiOpsiKecamatan();
          isiOpsiDesa('');
          document.getElementById('formMasjid').reset();
          document.getElementById('masjidId').value = '';
          var hint = document.getElementById('masjidTanggalTerbitHint');
          hint.textContent = '';
          hint.classList.add('d-none');
          document.getElementById('modalMasjidAlert').classList.add('d-none');
          if (!WILAYAH) {
            showModalMasjidError(
              'Data wilayah belum termuat, jadi dropdown Kecamatan/Desa kosong. ' +
              'Pastikan file DesaIndramayu.js ada di folder yang sama dengan Dashboard.html, lalu muat ulang halaman.'
            );
          }
        }

        document.getElementById('btnTambahMasjid').addEventListener('click', function () {
          siapkanFormMasjid();
          document.getElementById('jenisMasjid').checked = true;
          applyJenisUi('masjid');
          document.getElementById('modalMasjidTitle').textContent = 'Tambah Data Masjid / Musala';
          modalMasjid.show();
        });

        function openEditMasjid(id) {
          var m = findMasjid(id);
          if (!m) return;
          var isMusola = m.jenis === 'musola';
          siapkanFormMasjid();
          document.getElementById('masjidId').value = m.id;
          document.getElementById(isMusola ? 'jenisMusola' : 'jenisMasjid').checked = true;
          applyJenisUi(isMusola ? 'musola' : 'masjid');
          document.getElementById('masjidNoId').value = m.noIdNasional || '';
          document.getElementById('masjidNama').value = m.namaMasjid || '';
          if (isMusola) {
            setSelectValue(document.getElementById('masjidTipologiMusola'), padankanTipologiMusola(m.jenisTipologi));
          } else {
            setSelectValue(
              document.getElementById('masjidTipologi'),
              padankanTipologi(m.jenisTipologi, TIPOLOGI_MASJID, 'Masjid')
            );
          }
          document.getElementById('masjidTahunBerdiri').value = m.tahunBerdiri || '';
          document.getElementById('masjidAlamat').value = m.alamat || '';
          var kecamatanSelect = document.getElementById('masjidKecamatan');
          setSelectValue(kecamatanSelect, m.kecamatan);
          isiOpsiDesa(kecamatanSelect.value, m.desa);
          document.getElementById('masjidLembaga').value = m.lembagaOrgMasyarakat || '';
          document.getElementById('masjidUrl').value = m.urlProfil || '';

          var tanggal = String(m.tanggalTerbitSimas || '').trim().slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) tanggal = '';
          document.getElementById('masjidTanggalTerbit').value = tanggal;
          // Data lama masih menyimpan Bulan + Tahun terbit (sebelum digabung jadi satu
          // tanggal). Tampilkan sebagai petunjuk supaya bisa diisi tanggal lengkapnya.
          var terbitLama = [m.bulanTerbit, m.tahunTerbit].filter(function (x) { return x; }).join(' ');
          if (!tanggal && terbitLama) {
            var hint = document.getElementById('masjidTanggalTerbitHint');
            hint.textContent = 'Data lama: ' + terbitLama + ' - isi tanggal lengkapnya.';
            hint.classList.remove('d-none');
          }

          document.getElementById('modalMasjidTitle').textContent = 'Edit Data ' + (isMusola ? 'Musala' : 'Masjid');
          modalMasjid.show();
        }

        document.getElementById('btnSimpanMasjid').addEventListener('click', function () {
          document.getElementById('modalMasjidAlert').classList.add('d-none');

          var jenisTerpilih = document.querySelector('input[name="masjidJenis"]:checked').value;
          var isMusola = jenisTerpilih === 'musola';

          var data = {
            id: document.getElementById('masjidId').value || null,
            jenis: jenisTerpilih,
            noIdNasional: document.getElementById('masjidNoId').value.trim(),
            namaMasjid: document.getElementById('masjidNama').value.trim(),
            jenisTipologi: isMusola
              ? document.getElementById('masjidTipologiMusola').value.trim()
              : document.getElementById('masjidTipologi').value.trim(),
            tahunBerdiri: document.getElementById('masjidTahunBerdiri').value,
            alamat: document.getElementById('masjidAlamat').value.trim(),
            desa: document.getElementById('masjidDesa').value.trim(),
            kecamatan: document.getElementById('masjidKecamatan').value.trim(),
            lembagaOrgMasyarakat: document.getElementById('masjidLembaga').value.trim(),
            urlProfil: document.getElementById('masjidUrl').value.trim(),
            tanggalTerbitSimas: document.getElementById('masjidTanggalTerbit').value
          };

          if (!data.noIdNasional || !data.namaMasjid || !data.alamat || !data.desa || !data.kecamatan) {
            showModalMasjidError('Kolom bertanda * wajib diisi.');
            return;
          }
          if (isMusola && TIPOLOGI_MUSOLA.indexOf(data.jenisTipologi) === -1) {
            showModalMasjidError('Jenis Tipologi Musala wajib dipilih dari daftar.');
            return;
          }

          setSimpanMasjidLoading(true);
          callApi('saveMasjid', { data: data })
            .then(function (res) {
              setSimpanMasjidLoading(false);
              if (res.success) {
                modalMasjid.hide();
                loadMasjidList();
              } else {
                showModalMasjidError(res.message || 'Gagal menyimpan data.');
              }
            })
            .catch(function (err) {
              setSimpanMasjidLoading(false);
              showModalMasjidError('Tidak dapat menghubungi server: ' + err.message);
            });
        });

        function hapusMasjid(id) {
          var m = findMasjid(id);
          var nama = m ? m.namaMasjid : 'data ini';
          if (!confirm('Yakin ingin menghapus data "' + nama + '"? Tindakan ini tidak bisa dibatalkan.')) return;

          callApi('deleteMasjid', { id: id })
            .then(function (res) {
              if (res.success) {
                loadMasjidList();
              } else {
                alert(res.message || 'Gagal menghapus data.');
              }
            })
            .catch(function (err) {
              alert('Tidak dapat menghubungi server: ' + err.message);
            });
        }

        /* ------------------------- Cetak Dokumen ------------------------- */

        function showModalCetakError(message) {
          var el = document.getElementById('modalCetakAlert');
          el.textContent = message;
          el.classList.remove('d-none');
        }

        function setProsesCetakLoading(isLoading) {
          document.getElementById('btnProsesCetak').disabled = isLoading;
          document.getElementById('btnProsesCetakText').classList.toggle('d-none', isLoading);
          document.getElementById('btnProsesCetakSpinner').classList.toggle('d-none', !isLoading);
        }

        function openModalCetak(id, jenis) {
          var m = findMasjid(id);
          if (!m) return;

          var labelEntitas = m.jenis === 'musola' ? 'Musala' : 'Masjid';
          var namaDokumen = (JENIS_LABEL[jenis] || '') + (jenis === 'piagam' ? ' ' + labelEntitas : '');

          document.getElementById('cetakModul').value = 'masjid';
          document.getElementById('modalCetakCatatan').textContent = '';
          document.getElementById('cetakMasjidId').value = id;
          document.getElementById('cetakJenis').value = jenis;
          document.getElementById('modalCetakTitle').textContent = 'Cetak ' + namaDokumen;
          document.getElementById('modalCetakJenisLabel').textContent = labelEntitas;
          document.getElementById('modalCetakNamaMasjid').textContent = m.namaMasjid || '-';
          document.getElementById('modalCetakAlert').classList.add('d-none');

          modalCetak.show();
        }

        document.getElementById('btnProsesCetak').addEventListener('click', function () {
          document.getElementById('modalCetakAlert').classList.add('d-none');

          // Modal Cetak dipakai bersama: modul Arah Kiblat punya jenis dokumen & aturan sendiri.
          if (document.getElementById('cetakModul').value === 'kiblat') {
            prosesCetakKiblat();
            return;
          }

          var id = document.getElementById('cetakMasjidId').value;
          var jenis = document.getElementById('cetakJenis').value;

          // Piagam tidak memuat nama/NIP asli (hanya token ${nama_pengirim}); Surat
          // Keterangan & Surat Rekomendasi masih memuat blok "Yang bertanda tangan".
          if (jenis !== 'piagam' && !pengaturanCache.namaKepalaKantor) {
            showModalCetakError('Nama Kepala Kantor belum diisi. Buka menu Pengaturan terlebih dahulu.');
            return;
          }

          var masjid = findMasjid(id);
          if (!masjid) {
            showModalCetakError('Data masjid tidak ditemukan.');
            return;
          }

          setProsesCetakLoading(true);

          // Dibuat sepenuhnya di sisi klien (jsPDF) -- tidak ada panggilan ke
          // Apps Script sama sekali untuk pembuatan dokumen.
          try {
            var hasil;
            if (jenis === 'piagam') {
              hasil = DokumenGenerator.buildPiagamPdf(masjid);
            } else {
              hasil = DokumenGenerator.buildSuratPdf(jenis, masjid, pengaturanCache);
            }
            hasil.doc.save(hasil.filename);
            setProsesCetakLoading(false);
            modalCetak.hide();
          } catch (err) {
            setProsesCetakLoading(false);
            showModalCetakError('Gagal membuat dokumen: ' + err.message);
          }
        });

        /* BEGIN KIBLAT UI */
