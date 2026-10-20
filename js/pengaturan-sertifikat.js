/* =====================================================================================
   pengaturan-sertifikat.js: menu Pengaturan Sertifikat (Kepala Kantor, Kasi Bimas, Petugas Ukur, tanda tangan)
   Salinan apa adanya dari portal sertifikat. Tampilan: views/pengaturan-sertifikat.html.
   ===================================================================================== */

  /* =========================== PENGATURAN =========================== */

        // Data URL tanda tangan yang sedang tampil di form (belum tentu sudah tersimpan).
        var pengaturanTtd = '';
        // Batas panjang data URL tanda tangan; backend menolak > 48.000 karakter
        // (batas sel Google Sheets 50.000), sisakan ruang.
        var TTD_MAKS_KARAKTER = 40000;

        function tampilkanTtd(dataUrl) {
          pengaturanTtd = dataUrl || '';
          var img = document.getElementById('pengaturanTtdPreview');
          var kosong = document.getElementById('pengaturanTtdKosong');
          var hapus = document.getElementById('btnHapusTtd');
          if (pengaturanTtd) {
            img.src = pengaturanTtd;
            img.classList.remove('d-none');
            kosong.classList.add('d-none');
            hapus.classList.remove('d-none');
          } else {
            img.removeAttribute('src');
            img.classList.add('d-none');
            kosong.classList.remove('d-none');
            hapus.classList.add('d-none');
          }
        }

        function isiFormPengaturan() {
          document.getElementById('pengaturanNama').value = pengaturanCache.namaKepalaKantor;
          document.getElementById('pengaturanNip').value = pengaturanCache.nipKepalaKantor;
          document.getElementById('pengaturanKasiNama').value = pengaturanCache.namaKasiBimas;
          document.getElementById('pengaturanKasiNip').value = pengaturanCache.nipKasiBimas;
          document.getElementById('pengaturanPetugasUkur').value = pengaturanCache.petugasUkur;
          tampilkanTtd(pengaturanCache.ttdPetugasUkur);
        }

        function loadPengaturan() {
          callApi('getPengaturan', {})
            .then(function (res) {
              if (res.success) {
                PENGATURAN_KUNCI.forEach(function (kunci) {
                  pengaturanCache[kunci] = res.data[kunci] || '';
                });
                isiFormPengaturan();
              }
            })
            .catch(function () {
              /* biarkan kosong -- tidak fatal, formnya tetap bisa diisi manual */
            });
        }

        function pesanTtd(teks, galat) {
          var el = document.getElementById('pengaturanTtdPesan');
          el.textContent = teks;
          el.className = 'form-text' + (galat ? ' text-danger' : '');
        }

        // Mengecilkan gambar tanda tangan (maks. 480 x 220 px) lalu menyimpannya sebagai data
        // URL <= TTD_MAKS_KARAKTER. PNG dulu (latar transparan terjaga); kalau terlalu besar
        // (foto/pindaian "ramai") dicoba JPEG berlatar putih, lalu ukuran yang lebih kecil.
        function kecilkanTandaTangan(file) {
          return new Promise(function (resolve, reject) {
            if (!/^image\/(png|jpeg)$/.test(file.type)) {
              reject(new Error('Gunakan gambar berformat PNG atau JPEG.'));
              return;
            }
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
              URL.revokeObjectURL(url);
              var w0 = img.naturalWidth, h0 = img.naturalHeight;
              if (!w0 || !h0) {
                reject(new Error('Gambar tidak dapat dibaca.'));
                return;
              }
              var dasar = Math.min(1, 480 / w0, 220 / h0);
              var canvas = document.createElement('canvas');
              var ctx = canvas.getContext('2d');
              var percobaan = [
                ['image/png', 1], ['image/png', 0.8], ['image/png', 0.64], ['image/png', 0.5],
                ['image/jpeg', 1, 0.85], ['image/jpeg', 0.8, 0.8], ['image/jpeg', 0.64, 0.8], ['image/jpeg', 0.5, 0.75],
                ['image/png', 0.4], ['image/png', 0.3],
                ['image/jpeg', 0.4, 0.7], ['image/jpeg', 0.3, 0.7]
              ];
              for (var i = 0; i < percobaan.length; i++) {
                var tipe = percobaan[i][0];
                var w = Math.max(1, Math.round(w0 * dasar * percobaan[i][1]));
                var h = Math.max(1, Math.round(h0 * dasar * percobaan[i][1]));
                canvas.width = w;
                canvas.height = h;
                if (tipe === 'image/jpeg') {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, w, h);
                } else {
                  ctx.clearRect(0, 0, w, h);
                }
                ctx.drawImage(img, 0, 0, w, h);
                var hasil = canvas.toDataURL(tipe, percobaan[i][2]);
                if (hasil.length <= TTD_MAKS_KARAKTER && /^data:image\/(png|jpeg);base64,/.test(hasil)) {
                  resolve(hasil);
                  return;
                }
              }
              reject(new Error('Gambar terlalu rumit untuk disimpan. Gunakan gambar tanda tangan yang lebih sederhana (latar putih atau transparan).'));
            };
            img.onerror = function () {
              URL.revokeObjectURL(url);
              reject(new Error('Gambar tidak dapat dibaca. Gunakan berkas PNG atau JPEG yang valid.'));
            };
            img.src = url;
          });
        }

        document.getElementById('pengaturanTtdFile').addEventListener('change', function () {
          var input = this;
          var file = input.files && input.files[0];
          if (!file) return;
          kecilkanTandaTangan(file)
            .then(function (dataUrl) {
              tampilkanTtd(dataUrl);
              pesanTtd('Tanda tangan siap. Tekan "Simpan Pengaturan" untuk menyimpannya.', false);
            })
            .catch(function (err) {
              pesanTtd(err.message, true);
            })
            .then(function () {
              input.value = ''; // supaya berkas yang sama bisa dipilih ulang
            });
        });

        document.getElementById('btnHapusTtd').addEventListener('click', function () {
          tampilkanTtd('');
          pesanTtd('Tanda tangan dihapus dari form. Tekan "Simpan Pengaturan" untuk menyimpan perubahan.', false);
        });

        function setSimpanPengaturanLoading(isLoading) {
          document.getElementById('btnSimpanPengaturan').disabled = isLoading;
          document.getElementById('btnSimpanPengaturanText').classList.toggle('d-none', isLoading);
          document.getElementById('btnSimpanPengaturanSpinner').classList.toggle('d-none', !isLoading);
        }

        document.getElementById('formPengaturan').addEventListener('submit', function (ev) {
          ev.preventDefault();
          document.getElementById('pengaturanAlert').classList.add('d-none');
          document.getElementById('pengaturanSuccessAlert').classList.add('d-none');

          var data = {
            namaKepalaKantor: document.getElementById('pengaturanNama').value.trim(),
            nipKepalaKantor: document.getElementById('pengaturanNip').value.trim(),
            namaKasiBimas: document.getElementById('pengaturanKasiNama').value.trim(),
            nipKasiBimas: document.getElementById('pengaturanKasiNip').value.trim(),
            petugasUkur: document.getElementById('pengaturanPetugasUkur').value.trim(),
            ttdPetugasUkur: pengaturanTtd
          };

          if (!data.namaKepalaKantor) {
            document.getElementById('pengaturanAlert').textContent = 'Nama Kepala Kantor wajib diisi.';
            document.getElementById('pengaturanAlert').classList.remove('d-none');
            return;
          }

          setSimpanPengaturanLoading(true);
          callApi('savePengaturan', { data: data })
            .then(function (res) {
              setSimpanPengaturanLoading(false);
              if (res.success) {
                PENGATURAN_KUNCI.forEach(function (kunci) {
                  pengaturanCache[kunci] = data[kunci];
                });
                pesanTtd('PNG berlatar transparan paling bagus (atau foto/pindaian di kertas putih, format JPEG/PNG). Gambar otomatis dikecilkan agar muat di Spreadsheet.', false);
                document.getElementById('pengaturanSuccessAlert').classList.remove('d-none');
              } else {
                document.getElementById('pengaturanAlert').textContent = res.message || 'Gagal menyimpan pengaturan.';
                document.getElementById('pengaturanAlert').classList.remove('d-none');
              }
            })
            .catch(function (err) {
              setSimpanPengaturanLoading(false);
              document.getElementById('pengaturanAlert').textContent = 'Tidak dapat menghubungi server: ' + err.message;
              document.getElementById('pengaturanAlert').classList.remove('d-none');
            });
        });
