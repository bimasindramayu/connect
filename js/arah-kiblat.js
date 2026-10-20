/* =====================================================================================
   arah-kiblat.js: menu Sertifikat Arah Kiblat (data, peta, GPS, perhitungan, cetak)
   Salinan apa adanya dari portal sertifikat. Tampilan: views/arah-kiblat.html. Memakai pemilih wilayah dan dialog cetak dari sertifikat-masjid.js.
   ===================================================================================== */

  /* ===================== SERTIFIKAT ARAH KIBLAT ===================== */

        var kiblatData = [];
        var modalKiblat = new bootstrap.Modal(document.getElementById('modalKiblat'));
        var kiblatHijriManual = false; // true = pengguna mengetik/ubah tanggal Hijriah sendiri
        var kiblatPeta = null; // objek peta Leaflet (dibuat saat pertama kali dibuka)
        var kiblatPenanda = null;
        var kiblatGaris = null;
        var kiblatGpsBatal = null; // fungsi untuk membatalkan pengambilan GPS yang sedang berjalan

        var KIBLAT_DOKUMEN = {
          sertifikat: 'Sertifikat Kalibrasi Arah Kiblat',
          verifikasi: 'Data Verifikasi Arah Kiblat',
          ba: 'Berita Acara Kalibrasi Arah Kiblat',
          paket: 'Sertifikat + Data Verifikasi Arah Kiblat'
        };

        function kEl(id) {
          return document.getElementById(id);
        }

        // Angka dari isian (boleh koma desimal ala Indonesia); NaN kalau kosong/bukan angka.
        function kiblatAngka(teks) {
          var t = String(teks === null || teks === undefined ? '' : teks).trim().replace(',', '.');
          return /^[+-]?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
        }

        function kiblatCari(id) {
          for (var i = 0; i < kiblatData.length; i++) {
            if (String(kiblatData[i].id) === String(id)) return kiblatData[i];
          }
          return null;
        }

        function kiblatPesanBackend(res, bawaan) {
          var pesan = (res && res.message) || bawaan;
          if (/tidak dikenali/i.test(pesan)) {
            pesan +=
              ' -- Deployment Apps Script belum diperbarui. Salin Code.gs, Kiblat.gs, dan Pengaturan.gs terbaru, ' +
              'jalankan setupDatabase(), lalu Deploy > Manage deployments > Edit > Version: New version.';
          }
          return pesan;
        }

        /* ---------------------------- daftar data ---------------------------- */

        function kiblatGalatDaftar(pesan) {
          var el = kEl('kiblatAlert');
          el.textContent = pesan;
          el.classList.remove('d-none');
        }

        function loadKiblatList() {
          kEl('kiblatLoadingState').classList.remove('d-none');
          kEl('kiblatEmptyState').classList.add('d-none');
          kEl('kiblatAlert').classList.add('d-none');
          callApi('listKiblat', {})
            .then(function (res) {
              kEl('kiblatLoadingState').classList.add('d-none');
              if (!res.success) {
                kiblatGalatDaftar(kiblatPesanBackend(res, 'Gagal memuat data arah kiblat.'));
                return;
              }
              kiblatData = res.data || [];
              renderKiblatTable();
            })
            .catch(function (err) {
              kEl('kiblatLoadingState').classList.add('d-none');
              kiblatGalatDaftar('Tidak dapat menghubungi server: ' + err.message);
            });
        }

        // Ringkasan satu baris untuk tabel: koordinat, azimut kiblat, waktu kalibrasi.
        function kiblatRingkas(r) {
          var K = KiblatHitung;
          var lat = K.koordinatDesimal(+r.lintangDerajat, +r.lintangMenit, +r.lintangDetik, r.lintangHemisfer);
          var lon = K.koordinatDesimal(+r.bujurDerajat, +r.bujurMenit, +r.bujurDetik, r.bujurHemisfer);
          var kiblat = K.hitungKiblat(lat, lon);
          var hemLat = { S: 'LS', U: 'LU' }[String(r.lintangHemisfer).toUpperCase()] || '';
          var hemLon = { T: 'BT', B: 'BB' }[String(r.bujurHemisfer).toUpperCase()] || '';
          var tgl = K.parseIso(r.tanggalKalibrasi);
          return {
            koordinat: isFinite(lat) && isFinite(lon)
              ? K.teksKoordinatSertifikat(+r.lintangDerajat, +r.lintangMenit, +r.lintangDetik) + ' ' + hemLat + ', ' +
                K.teksKoordinatSertifikat(+r.bujurDerajat, +r.bujurMenit, +r.bujurDetik) + ' ' + hemLon
              : '-',
            azimut: kiblat.ok ? K.teksDmsSertifikat(kiblat.azimutDms) : '-',
            waktu: tgl ? K.tanggalPanjang(tgl.y, tgl.m, tgl.d) + ', ' + (r.jamKalibrasi || '-') + ' WIB' : '-'
          };
        }

        function renderKiblatTable() {
          var tbody = kEl('kiblatTableBody');
          tbody.innerHTML = '';

          if (kiblatData.length === 0) {
            kEl('kiblatEmptyState').classList.remove('d-none');
            return;
          }
          kEl('kiblatEmptyState').classList.add('d-none');

          // Kalibrasi terbaru di atas.
          var urut = kiblatData.slice().sort(function (a, b) {
            var ka = String(a.tanggalKalibrasi || '') + ' ' + String(a.jamKalibrasi || '');
            var kb = String(b.tanggalKalibrasi || '') + ' ' + String(b.jamKalibrasi || '');
            return ka < kb ? 1 : ka > kb ? -1 : 0;
          });

          urut.forEach(function (r, idx) {
            var isMusola = r.jenis === 'musola';
            var ringkas = kiblatRingkas(r);
            var id = escapeHtml(r.id);
            var item = function (jenis, teks) {
              return '<li><a class="dropdown-item kiblat-cetak" href="javascript:void(0)" data-id="' + id + '" data-jenis="' + jenis + '">' + teks + '</a></li>';
            };
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + (idx + 1) + '</td>' +
              '<td><span class="badge ' + (isMusola ? 'bg-label-info' : 'bg-label-success') + '">' + (isMusola ? 'Musala' : 'Masjid') + '</span></td>' +
              '<td>' + escapeHtml(r.namaMasjid) + '</td>' +
              '<td>' + escapeHtml(r.kecamatan) + ' / ' + escapeHtml(r.desa) + '</td>' +
              '<td>' + escapeHtml(ringkas.koordinat) + '</td>' +
              '<td>' + escapeHtml(ringkas.azimut) + '</td>' +
              '<td>' + escapeHtml(ringkas.waktu) + '</td>' +
              '<td>' +
                '<div class="dropdown d-inline-block me-1">' +
                  '<button class="btn btn-sm btn-label-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-popper-config=\'{"strategy":"fixed"}\'>' +
                    '<i class="icon-base bx bx-printer me-1"></i>Cetak' +
                  '</button>' +
                  '<ul class="dropdown-menu">' +
                    item('sertifikat', 'Sertifikat Kalibrasi Arah Kiblat') +
                    item('verifikasi', 'Data Verifikasi (Perhitungan)') +
                    item('ba', 'Berita Acara Kalibrasi') +
                    '<li><hr class="dropdown-divider" /></li>' +
                    item('paket', 'Sertifikat + Data Verifikasi (1 PDF)') +
                  '</ul>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-icon btn-label-secondary kiblat-edit" data-id="' + id + '" title="Edit"><i class="icon-base bx bx-edit-alt"></i></button> ' +
                '<button type="button" class="btn btn-sm btn-icon btn-label-danger kiblat-hapus" data-id="' + id + '" title="Hapus"><i class="icon-base bx bx-trash"></i></button>' +
              '</td>';
            tbody.appendChild(tr);
          });

          tbody.querySelectorAll('.kiblat-edit').forEach(function (btn) {
            btn.addEventListener('click', function () { bukaEditKiblat(btn.getAttribute('data-id')); });
          });
          tbody.querySelectorAll('.kiblat-hapus').forEach(function (btn) {
            btn.addEventListener('click', function () { hapusKiblat(btn.getAttribute('data-id')); });
          });
          tbody.querySelectorAll('.kiblat-cetak').forEach(function (a) {
            a.addEventListener('click', function () { bukaModalCetakKiblat(a.getAttribute('data-id'), a.getAttribute('data-jenis')); });
          });
        }

        /* ---------------------- dropdown kecamatan / desa ---------------------- */

        function kiblatIsiKecamatan() {
          var daftar = WILAYAH ? Object.keys(WILAYAH).sort(byNama) : [];
          fillSelect(kEl('kiblatKecamatan'), daftar, '- Pilih Kecamatan -');
        }

        function kiblatIsiDesa(kecamatan, desaTerpilih) {
          var select = kEl('kiblatDesa');
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

        kEl('kiblatKecamatan').addEventListener('change', function () {
          kiblatIsiDesa(this.value);
        });

        function kiblatTerapkanJenis(jenis) {
          kEl('labelKiblatNama').textContent = jenis === 'musola' ? 'Nama Musala *' : 'Nama Masjid *';
        }

        /* ------------------------ membaca & memeriksa form ------------------------ */

        function kiblatHijriOtomatis() {
          var t = KiblatHitung.parseIso(kEl('kiblatTanggal').value);
          return t ? KiblatHitung.hijriSipil(t.y, t.m, t.d).teks : '';
        }

        // Kosong ('') = pakai hitungan otomatis; terisi = teks buatan pengguna.
        function kiblatHijriUntukDisimpan() {
          var v = kEl('kiblatHijriah').value.trim();
          if (!v || !kiblatHijriManual || v === kiblatHijriOtomatis()) return '';
          return v;
        }

        function kiblatBacaForm() {
          var jenisEl = document.querySelector('input[name="kiblatJenis"]:checked');
          var teks = function (id) { return kEl(id).value.trim(); };
          // Menit/detik yang dikosongkan dianggap 0 selama derajatnya sudah diisi.
          var dms = function (awal, bagian) {
            var terisi = teks('kiblat' + awal + 'D') !== '';
            if (bagian === 'D') return kiblatAngka(kEl('kiblat' + awal + 'D').value);
            var t = teks('kiblat' + awal + bagian);
            if (!terisi) return NaN;
            return t === '' ? 0 : kiblatAngka(t);
          };
          return {
            id: kEl('kiblatId').value || null,
            jenis: jenisEl ? jenisEl.value : 'masjid',
            namaMasjid: teks('kiblatNama'),
            alamat: teks('kiblatAlamat'),
            desa: kEl('kiblatDesa').value.trim(),
            kecamatan: kEl('kiblatKecamatan').value.trim(),
            penyelenggaraPendiri: teks('kiblatPenyelenggara'),
            lintangDerajat: dms('Lintang', 'D'),
            lintangMenit: dms('Lintang', 'M'),
            lintangDetik: dms('Lintang', 'S'),
            lintangHemisfer: kEl('kiblatLintangH').value,
            bujurDerajat: dms('Bujur', 'D'),
            bujurMenit: dms('Bujur', 'M'),
            bujurDetik: dms('Bujur', 'S'),
            bujurHemisfer: kEl('kiblatBujurH').value,
            tanggalKalibrasi: kEl('kiblatTanggal').value,
            jamKalibrasi: kEl('kiblatJam').value,
            tanggalHijriah: kiblatHijriUntukDisimpan(),
            petugas: teks('kiblatPetugas'),
            saksi1: teks('kiblatSaksi1'),
            saksi2: teks('kiblatSaksi2')
          };
        }

        // Pesan galat untuk satu koordinat (derajat/menit/detik), '' kalau benar.
        function kiblatCekDms(label, d, m, s, maksDerajat) {
          if (!(isFinite(d) && Math.floor(d) === d && d >= 0 && d <= maksDerajat)) {
            return label + ': derajat harus bilangan bulat 0 sampai ' + maksDerajat + '.';
          }
          if (!(isFinite(m) && Math.floor(m) === m && m >= 0 && m <= 59)) {
            return label + ': menit harus bilangan bulat 0 sampai 59.';
          }
          if (!(isFinite(s) && s >= 0 && s < 60)) {
            return label + ': detik harus 0 sampai kurang dari 60.';
          }
          if (d === maksDerajat && (m > 0 || s > 0)) {
            return label + ' tidak boleh lebih dari ' + maksDerajat + ' derajat.';
          }
          return '';
        }

        // {lat, lon} desimal dari isian saat ini, atau null kalau belum lengkap/valid.
        function kiblatKoordinatSaatIni() {
          var rek = kiblatBacaForm();
          if (kiblatCekDms('Lintang', rek.lintangDerajat, rek.lintangMenit, rek.lintangDetik, 90)) return null;
          if (kiblatCekDms('Bujur', rek.bujurDerajat, rek.bujurMenit, rek.bujurDetik, 180)) return null;
          return {
            lat: KiblatHitung.koordinatDesimal(rek.lintangDerajat, rek.lintangMenit, rek.lintangDetik, rek.lintangHemisfer),
            lon: KiblatHitung.koordinatDesimal(rek.bujurDerajat, rek.bujurMenit, rek.bujurDetik, rek.bujurHemisfer)
          };
        }

        /* --------------------- koordinat: GPS / peta / tempel --------------------- */

        function kiblatStatusLokasi(teks, tingkat) {
          var el = kEl('kiblatLokasiStatus');
          if (!teks) {
            el.classList.add('d-none');
            return;
          }
          el.className = 'alert py-2 px-3 alert-' + (tingkat || 'info');
          el.textContent = teks;
        }

        // Satu pintu untuk semua sumber koordinat desimal (GPS, peta, teks tempel):
        // diubah ke derajat-menit-detik (detik 2 desimal) dan diisikan ke form.
        function kiblatSetKoordinat(lat, lon, opsi) {
          opsi = opsi || {};
          var a = KiblatHitung.desimalKeDms(lat, 'lintang');
          var b = KiblatHitung.desimalKeDms(lon, 'bujur');
          kEl('kiblatLintangD').value = a.d;
          kEl('kiblatLintangM').value = a.m;
          kEl('kiblatLintangS').value = KiblatHitung.numStr(a.s);
          kEl('kiblatLintangH').value = a.hemisfer;
          kEl('kiblatBujurD').value = b.d;
          kEl('kiblatBujurM').value = b.m;
          kEl('kiblatBujurS').value = KiblatHitung.numStr(b.s);
          kEl('kiblatBujurH').value = b.hemisfer;

          if (opsi.sumber === 'gps') {
            var jam = KiblatHitung.sekarangWib();
            var akurasi = Math.round(opsi.akurasi);
            kiblatStatusLokasi(
              'Lokasi GPS direkam pukul ' + jam.jamTeks + ' WIB, akurasi ±' + akurasi + ' m.' +
                (akurasi > 50
                  ? ' Akurasi kurang baik: ulangi di tempat terbuka atau koreksi lewat peta.'
                  : ''),
              akurasi > 50 ? 'warning' : 'success'
            );
          } else if (opsi.sumber === 'peta') {
            kiblatStatusLokasi('Titik diambil dari peta.', 'success');
          } else if (opsi.sumber === 'tempel') {
            kiblatStatusLokasi('Koordinat dibaca dari teks yang ditempel.', 'success');
          }
          kiblatPerbarui();
          kiblatSinkronPeta(!!opsi.pusatkan);
        }

        function kiblatIsiSekarang() {
          var n = KiblatHitung.sekarangWib();
          kEl('kiblatTanggal').value = n.iso;
          kEl('kiblatJam').value = n.jamTeks;
          kiblatPerbarui();
        }

        function kiblatSetTombolGps(sibuk) {
          kEl('btnKiblatRekam').disabled = sibuk;
          kEl('btnKiblatGps').disabled = sibuk;
        }

        function kiblatHentikanGps() {
          if (kiblatGpsBatal) {
            var batal = kiblatGpsBatal;
            kiblatGpsBatal = null;
            batal();
          }
          kiblatSetTombolGps(false);
        }

        // Merekam titik lokasi saat ini dari GPS/lokasi browser. Pembacaan diperhalus
        // selama maks. 8 detik setelah hasil pertama (ambil yang akurasinya terbaik).
        function kiblatGps(denganWaktu) {
          if (kiblatGpsBatal) return;
          if (!navigator.geolocation) {
            kiblatStatusLokasi('Browser ini tidak mendukung lokasi (GPS). Gunakan peta, tempel koordinat, atau isi manual.', 'warning');
            return;
          }
          kiblatSetTombolGps(true);
          kiblatStatusLokasi('Mengambil lokasi... izinkan akses lokasi bila browser menanyakan.', 'info');

          var terbaik = null;
          var watchId = null;
          var jendela = null;
          var selesai = false;

          function bersihkan() {
            selesai = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            if (jendela) clearTimeout(jendela);
            kiblatGpsBatal = null;
            kiblatSetTombolGps(false);
          }
          function akhiri() {
            if (selesai) return;
            bersihkan();
            if (!terbaik) {
              kiblatStatusLokasi('Lokasi belum berhasil diambil. Coba lagi di tempat terbuka, atau pakai peta / tempel koordinat / isi manual.', 'warning');
              return;
            }
            kiblatSetKoordinat(terbaik.coords.latitude, terbaik.coords.longitude, {
              sumber: 'gps',
              akurasi: terbaik.coords.accuracy,
              pusatkan: true
            });
            if (denganWaktu) kiblatIsiSekarang();
          }
          function gagal(err) {
            if (selesai) return;
            if (terbaik) {
              akhiri(); // sudah punya pembacaan; kegagalan berikutnya diabaikan
              return;
            }
            bersihkan();
            var pesan;
            if (err && err.code === 1) {
              pesan = 'Izin lokasi ditolak. Izinkan akses lokasi untuk halaman ini di pengaturan browser, atau pakai peta / tempel koordinat / isi manual.';
              if (window.isSecureContext === false) {
                pesan += ' (Halaman ini dibuka lewat http://, sehingga browser memblokir lokasi; buka lewat file lokal, localhost, atau https.)';
              }
            } else if (err && err.code === 2) {
              pesan = 'Posisi tidak tersedia. Nyalakan layanan lokasi/GPS perangkat, atau pakai peta / tempel koordinat / isi manual.';
            } else {
              pesan = 'Waktu pengambilan lokasi habis. Coba lagi di tempat terbuka, atau pakai peta / tempel koordinat / isi manual.';
            }
            kiblatStatusLokasi(pesan, 'warning');
          }

          kiblatGpsBatal = function () {
            if (!selesai) bersihkan();
          };
          watchId = navigator.geolocation.watchPosition(
            function (pos) {
              if (selesai) return;
              if (!terbaik || pos.coords.accuracy < terbaik.coords.accuracy) terbaik = pos;
              kiblatStatusLokasi(
                'Mengambil lokasi... akurasi saat ini ±' + Math.round(terbaik.coords.accuracy) +
                  ' m (menyempurnakan, maksimal 8 detik).',
                'info'
              );
              if (pos.coords.accuracy <= 8) {
                akhiri();
              } else if (!jendela) {
                jendela = setTimeout(akhiri, 8000);
              }
            },
            gagal,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
          );
        }

        function kiblatTerapkanTempel() {
          var pesan = kEl('kiblatTempelPesan');
          var teks = kEl('kiblatTempel').value;
          if (!teks.trim()) {
            pesan.className = 'form-text text-danger mb-3';
            pesan.textContent = 'Tempel dulu koordinatnya di kolom di atas.';
            return;
          }
          var p = KiblatHitung.parseKoordinat(teks);
          if (!p) {
            pesan.className = 'form-text text-danger mb-3';
            pesan.textContent =
              'Format koordinat tidak dikenali. Contoh yang bisa dibaca: -6.340247, 108.113883  |  6°20\'24.9"S 108°06\'49.9"E  |  tautan Google Maps.';
            return;
          }
          pesan.className = 'form-text text-success mb-3';
          pesan.textContent = 'Koordinat terbaca: ' + p.lat.toFixed(6) + ', ' + p.lon.toFixed(6) + '.';
          kiblatSetKoordinat(p.lat, p.lon, { sumber: 'tempel', pusatkan: true });
        }

        // Derajat desimal / pecahan menit yang diketik di kolom derajat/menit diubah
        // otomatis ke derajat-menit-detik; tanda minus berarti LS/BB.
        function kiblatNormalisasi(awal) {
          var d = kEl('kiblat' + awal + 'D');
          var m = kEl('kiblat' + awal + 'M');
          var s = kEl('kiblat' + awal + 'S');
          var h = kEl('kiblat' + awal + 'H');
          var dv = kiblatAngka(d.value);
          if (!isFinite(dv)) return;
          if (dv < 0) {
            dv = -dv;
            h.value = awal === 'Lintang' ? 'S' : 'B';
          }
          var mv = m.value.trim() === '' ? 0 : kiblatAngka(m.value);
          var sv = s.value.trim() === '' ? 0 : kiblatAngka(s.value);
          if (!isFinite(mv) || !isFinite(sv)) {
            d.value = KiblatHitung.numStr(dv);
            return;
          }
          if (dv !== Math.floor(dv) && mv === 0 && sv === 0) {
            var p = KiblatHitung.pecahDms(dv, 2); // 6.341589 -> 6° 20′ 29.72″
            dv = p.d; mv = p.m; sv = p.s;
          } else if (mv !== Math.floor(mv) && sv === 0) {
            var total = Math.round(mv * 6000); // menit desimal -> detik (0,01")
            mv = Math.floor(total / 6000);
            sv = (total - mv * 6000) / 100;
          }
          d.value = KiblatHitung.numStr(dv);
          if (m.value.trim() !== '' || mv !== 0) m.value = KiblatHitung.numStr(mv);
          if (s.value.trim() !== '' || sv !== 0) s.value = KiblatHitung.numStr(sv);
        }

        /* ------------------------------ peta (Leaflet) ------------------------------ */

        // Titik tujuan dari (lat, lon) sejauh jarakM meter ke arah azimut (derajat dari utara).
        function kiblatTitikTujuan(lat, lon, azimut, jarakM) {
          var R = 6371008.8;
          var br = azimut * Math.PI / 180;
          var p1 = lat * Math.PI / 180;
          var l1 = lon * Math.PI / 180;
          var dr = jarakM / R;
          var p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(br));
          var l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
          return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI + 540) % 360) - 180];
        }

        function kiblatBuatPeta() {
          kiblatPeta = L.map('kiblatPeta', { zoomControl: true }).setView([-6.327, 108.32], 11);
          var satelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
          });
          var jalan = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
          });
          var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          });
          satelit.addTo(kiblatPeta);
          L.control.layers({ Satelit: satelit, Jalan: jalan, OpenStreetMap: osm }, null, { collapsed: true }).addTo(kiblatPeta);
          kiblatPeta.on('click', function (e) {
            var p = e.latlng.wrap();
            kiblatSetKoordinat(p.lat, p.lng, { sumber: 'peta' });
          });
        }

        // Menyamakan penanda & garis arah kiblat di peta dengan isian koordinat.
        function kiblatSinkronPeta(pusatkan) {
          if (!kiblatPeta) return;
          var ll = kiblatKoordinatSaatIni();
          if (!ll) {
            if (kiblatPenanda) { kiblatPeta.removeLayer(kiblatPenanda); kiblatPenanda = null; }
            if (kiblatGaris) { kiblatPeta.removeLayer(kiblatGaris); kiblatGaris = null; }
            return;
          }
          var pos = [ll.lat, ll.lon];
          if (!kiblatPenanda) {
            var ikon = L.divIcon({ className: 'kiblat-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 14] });
            kiblatPenanda = L.marker(pos, { draggable: true, icon: ikon, keyboard: false }).addTo(kiblatPeta);
            kiblatPenanda.on('dragend', function () {
              var p = kiblatPenanda.getLatLng().wrap();
              kiblatSetKoordinat(p.lat, p.lng, { sumber: 'peta' });
            });
          } else {
            kiblatPenanda.setLatLng(pos);
          }
          var k = KiblatHitung.hitungKiblat(ll.lat, ll.lon);
          if (k.ok) {
            var ujung = kiblatTitikTujuan(ll.lat, ll.lon, k.azimut, 150);
            if (!kiblatGaris) {
              kiblatGaris = L.polyline([pos, ujung], { color: '#e11d48', weight: 3, dashArray: '8 6' }).addTo(kiblatPeta);
            } else {
              kiblatGaris.setLatLngs([pos, ujung]);
            }
          } else if (kiblatGaris) {
            kiblatPeta.removeLayer(kiblatGaris);
            kiblatGaris = null;
          }
          if (pusatkan) kiblatPeta.setView(pos, Math.max(kiblatPeta.getZoom(), 18));
        }

        function kiblatToggleMap() {
          var panel = kEl('kiblatPetaPanel');
          if (!panel.classList.contains('d-none')) {
            panel.classList.add('d-none');
            kEl('btnKiblatPetaTeks').textContent = 'Pilih di peta';
            return;
          }
          if (typeof L === 'undefined') {
            kiblatStatusLokasi('Peta tidak dapat dimuat (perlu koneksi internet ke Leaflet/CDN). Gunakan GPS, tempel koordinat, atau isi manual.', 'warning');
            return;
          }
          panel.classList.remove('d-none');
          kEl('btnKiblatPetaTeks').textContent = 'Sembunyikan peta';
          if (!kiblatPeta) kiblatBuatPeta();
          setTimeout(function () {
            kiblatPeta.invalidateSize();
            kiblatSinkronPeta(true);
          }, 150);
        }

        /* ----------------------- pratinjau hasil perhitungan ----------------------- */

        function kiblatPerbarui() {
          var K = KiblatHitung;
          var rek = kiblatBacaForm();
          var kosongLat = kEl('kiblatLintangD').value.trim() === '';
          var kosongLon = kEl('kiblatBujurD').value.trim() === '';

          var ket = kEl('kiblatHasilKosong');
          var galat = kEl('kiblatHasilGalat');
          var isi = kEl('kiblatHasilIsi');
          var peringatan = kEl('kiblatLokasiPeringatan');
          ket.classList.add('d-none');
          galat.classList.add('d-none');
          isi.classList.add('d-none');
          peringatan.classList.add('d-none');
          kEl('kiblatHasilTabelWadah').classList.add('d-none');
          kEl('kiblatLinkMaps').classList.add('d-none');
          kEl('kiblatDesimal').textContent = 'Desimal: -';

          // Tanggal Hijriah otomatis (kecuali pengguna sudah mengubahnya sendiri).
          var hijriOto = kiblatHijriOtomatis();
          if (!kiblatHijriManual) kEl('kiblatHijriah').value = hijriOto;
          kEl('kiblatHijriahInfo').textContent = hijriOto
            ? 'Otomatis (kalender sipil tabular): ' + hijriOto + '. Bisa berbeda satu hari dari ketetapan resmi Kemenag; ubah manual kalau perlu.'
            : 'Dihitung otomatis dari tanggal Masehi (kalender sipil tabular); bisa berbeda satu hari dari ketetapan resmi, ubah manual kalau perlu.';

          if (kosongLat && kosongLon) {
            ket.classList.remove('d-none');
            return;
          }
          var galatKoordinat =
            kiblatCekDms('Lintang', rek.lintangDerajat, rek.lintangMenit, rek.lintangDetik, 90) ||
            kiblatCekDms('Bujur', rek.bujurDerajat, rek.bujurMenit, rek.bujurDetik, 180);
          if (galatKoordinat) {
            galat.textContent = galatKoordinat;
            galat.classList.remove('d-none');
            return;
          }

          var lat = K.koordinatDesimal(rek.lintangDerajat, rek.lintangMenit, rek.lintangDetik, rek.lintangHemisfer);
          var lon = K.koordinatDesimal(rek.bujurDerajat, rek.bujurMenit, rek.bujurDetik, rek.bujurHemisfer);
          kEl('kiblatDesimal').textContent = 'Desimal: ' + lat.toFixed(6) + ', ' + lon.toFixed(6);
          var link = kEl('kiblatLinkMaps');
          link.href = 'https://www.google.com/maps?q=' + lat.toFixed(6) + ',' + lon.toFixed(6);
          link.classList.remove('d-none');

          if (!K.wilayahIndramayu(lat, lon)) {
            peringatan.textContent =
              'Titik ini berada di luar perkiraan wilayah Kabupaten Indramayu. Periksa kembali angka koordinat dan hemisfernya (LS/LU, BT/BB).';
            peringatan.classList.remove('d-none');
          }

          var kiblat = K.hitungKiblat(lat, lon);
          if (!kiblat.ok) {
            galat.textContent = kiblat.pesan;
            galat.classList.remove('d-none');
            return;
          }
          kEl('kiblatHasilAzimut').textContent = K.teksDmsSertifikat(kiblat.azimutDms);
          kEl('kiblatHasilSudutQ').textContent = K.teksDmsSertifikat(kiblat.sudutQDms);
          kEl('kiblatHasilB').textContent = K.teksDmsSertifikat(kiblat.bDms);
          isi.classList.remove('d-none');

          var h = K.hitungRekaman(rek, 12);
          if (h.ok) {
            var baris = '';
            h.tabel.forEach(function (b) {
              baris += '<tr><td>' + escapeHtml(b.jam) + '</td><td>' + escapeHtml(b.ra) + '</td><td>' + escapeHtml(b.dekl) +
                '</td><td>' + escapeHtml(b.eot) + '</td><td>' + escapeHtml(b.irtifa) + '</td><td>' + escapeHtml(b.azimut) +
                '</td><td>' + escapeHtml(b.mizwah) + '</td><td>' + escapeHtml(b.selisih) + '</td></tr>';
            });
            kEl('kiblatHasilTabel').innerHTML = baris;
            kEl('kiblatHasilTabelWadah').classList.remove('d-none');
          }
        }

        /* ------------------------------ tambah / edit ------------------------------ */

        function kiblatTampilGalatModal(pesan) {
          var el = kEl('modalKiblatAlert');
          el.textContent = pesan;
          el.classList.remove('d-none');
          var badan = el.closest('.modal-body');
          if (badan) badan.scrollTop = 0;
        }

        function setSimpanKiblatLoading(sedang) {
          kEl('btnSimpanKiblat').disabled = sedang;
          kEl('btnSimpanKiblatText').classList.toggle('d-none', sedang);
          kEl('btnSimpanKiblatSpinner').classList.toggle('d-none', !sedang);
        }

        // Form kosong: semua dropdown diisi ulang, isian dan peringatan dibersihkan.
        function kiblatSiapkanForm() {
          kiblatHentikanGps();
          kiblatIsiKecamatan();
          kiblatIsiDesa('');
          kEl('formKiblat').reset();
          kEl('kiblatId').value = '';
          kEl('kiblatTempel').value = '';
          kEl('kiblatTempelPesan').className = 'form-text mb-3';
          kEl('kiblatTempelPesan').textContent = 'Di Google Maps: tekan lama pada titik masjid, lalu salin angka koordinat yang muncul.';
          kEl('modalKiblatAlert').classList.add('d-none');
          kiblatStatusLokasi('');
          kiblatHijriManual = false;
          kiblatTerapkanJenis('masjid');
          kiblatSinkronPeta(false);
          kiblatPerbarui();
          if (!WILAYAH) {
            kiblatTampilGalatModal(
              'Data wilayah belum termuat, jadi dropdown Kecamatan/Desa kosong. ' +
                'Pastikan file DesaIndramayu.js ada di folder yang sama dengan Dashboard.html, lalu muat ulang halaman.'
            );
          }
        }

        function kiblatPetaSembunyi() {
          kEl('kiblatPetaPanel').classList.add('d-none');
          kEl('btnKiblatPetaTeks').textContent = 'Pilih di peta';
        }

        kEl('btnTambahKiblat').addEventListener('click', function () {
          kiblatSiapkanForm();
          kiblatPetaSembunyi();
          kEl('modalKiblatTitle').textContent = 'Tambah Data Arah Kiblat';
          modalKiblat.show();
        });

        function bukaEditKiblat(id) {
          var r = kiblatCari(id);
          if (!r) return;
          var isMusola = r.jenis === 'musola';
          kiblatSiapkanForm();
          kiblatPetaSembunyi();
          kEl('kiblatId').value = r.id;
          kEl(isMusola ? 'kiblatJenisMusola' : 'kiblatJenisMasjid').checked = true;
          kiblatTerapkanJenis(isMusola ? 'musola' : 'masjid');
          kEl('kiblatNama').value = r.namaMasjid || '';
          kEl('kiblatAlamat').value = r.alamat || '';
          var kec = kEl('kiblatKecamatan');
          setSelectValue(kec, r.kecamatan);
          kiblatIsiDesa(kec.value, r.desa);
          kEl('kiblatPenyelenggara').value = r.penyelenggaraPendiri || '';

          kEl('kiblatLintangD').value = r.lintangDerajat;
          kEl('kiblatLintangM').value = r.lintangMenit;
          kEl('kiblatLintangS').value = r.lintangDetik;
          kEl('kiblatLintangH').value = String(r.lintangHemisfer || 'S').toUpperCase();
          kEl('kiblatBujurD').value = r.bujurDerajat;
          kEl('kiblatBujurM').value = r.bujurMenit;
          kEl('kiblatBujurS').value = r.bujurDetik;
          kEl('kiblatBujurH').value = String(r.bujurHemisfer || 'T').toUpperCase();

          var tgl = String(r.tanggalKalibrasi || '').trim().slice(0, 10);
          kEl('kiblatTanggal').value = /^\d{4}-\d{2}-\d{2}$/.test(tgl) ? tgl : '';
          var jam = String(r.jamKalibrasi || '').trim();
          kEl('kiblatJam').value = /^\d{2}:\d{2}/.test(jam) ? jam.slice(0, 5) : '';

          var hijri = String(r.tanggalHijriah || '').trim();
          kiblatHijriManual = hijri !== '' && hijri !== kiblatHijriOtomatis();
          if (kiblatHijriManual) kEl('kiblatHijriah').value = hijri;

          kEl('kiblatPetugas').value = r.petugas || '';
          kEl('kiblatSaksi1').value = r.saksi1 || '';
          kEl('kiblatSaksi2').value = r.saksi2 || '';

          kiblatPerbarui();
          kEl('modalKiblatTitle').textContent = 'Edit Data Arah Kiblat';
          modalKiblat.show();
        }

        // Pesan galat pertama yang ditemukan (''= data siap disimpan).
        function kiblatValidasi(rek) {
          var label = rek.jenis === 'musola' ? 'Musala' : 'Masjid';
          if (!rek.namaMasjid) return 'Nama ' + label + ' wajib diisi.';
          if (!rek.alamat) return 'Alamat wajib diisi.';
          if (!rek.kecamatan) return 'Kecamatan wajib dipilih.';
          if (!rek.desa) return 'Desa wajib dipilih.';
          var gl = kiblatCekDms('Lintang', rek.lintangDerajat, rek.lintangMenit, rek.lintangDetik, 90);
          if (gl) return gl.indexOf('derajat harus') !== -1 && kEl('kiblatLintangD').value.trim() === '' ? 'Lintang wajib diisi.' : gl;
          var gb = kiblatCekDms('Bujur', rek.bujurDerajat, rek.bujurMenit, rek.bujurDetik, 180);
          if (gb) return gb.indexOf('derajat harus') !== -1 && kEl('kiblatBujurD').value.trim() === '' ? 'Bujur wajib diisi.' : gb;
          if (!KiblatHitung.parseIso(rek.tanggalKalibrasi)) return 'Tanggal kalibrasi wajib diisi.';
          if (!KiblatHitung.parseJam(rek.jamKalibrasi)) return 'Jam kalibrasi wajib diisi.';
          var lat = KiblatHitung.koordinatDesimal(rek.lintangDerajat, rek.lintangMenit, rek.lintangDetik, rek.lintangHemisfer);
          var lon = KiblatHitung.koordinatDesimal(rek.bujurDerajat, rek.bujurMenit, rek.bujurDetik, rek.bujurHemisfer);
          var kiblat = KiblatHitung.hitungKiblat(lat, lon);
          if (!kiblat.ok) return kiblat.pesan;
          return '';
        }

        kEl('btnSimpanKiblat').addEventListener('click', function () {
          kEl('modalKiblatAlert').classList.add('d-none');
          var rek = kiblatBacaForm();
          var galat = kiblatValidasi(rek);
          if (galat) {
            kiblatTampilGalatModal(galat);
            return;
          }
          setSimpanKiblatLoading(true);
          callApi('saveKiblat', { data: rek })
            .then(function (res) {
              setSimpanKiblatLoading(false);
              if (res.success) {
                modalKiblat.hide();
                loadKiblatList();
              } else {
                kiblatTampilGalatModal(kiblatPesanBackend(res, 'Gagal menyimpan data.'));
              }
            })
            .catch(function (err) {
              setSimpanKiblatLoading(false);
              kiblatTampilGalatModal('Tidak dapat menghubungi server: ' + err.message);
            });
        });

        function hapusKiblat(id) {
          var r = kiblatCari(id);
          var nama = r ? r.namaMasjid : 'data ini';
          if (!confirm('Yakin ingin menghapus data arah kiblat "' + nama + '"? Tindakan ini tidak bisa dibatalkan.')) return;
          callApi('deleteKiblat', { id: id })
            .then(function (res) {
              if (res.success) loadKiblatList();
              else alert(kiblatPesanBackend(res, 'Gagal menghapus data.'));
            })
            .catch(function (err) {
              alert('Tidak dapat menghubungi server: ' + err.message);
            });
        }

        /* ------------------------------ cetak dokumen ------------------------------ */

        function bukaModalCetakKiblat(id, jenis) {
          var r = kiblatCari(id);
          if (!r) return;
          var catatan = '';
          var nama;
          if (jenis === 'verifikasi' || jenis === 'paket') {
            nama = pengaturanCache.petugasUkur;
            catatan = nama
              ? 'Petugas Ukur (dari menu Pengaturan): ' + nama + (pengaturanCache.ttdPetugasUkur ? ', dengan tanda tangan.' : '.')
              : 'Nama Petugas Ukur belum diisi di menu Pengaturan.';
          } else if (jenis === 'ba') {
            nama = pengaturanCache.namaKasiBimas;
            catatan = nama
              ? 'Mengetahui (dari menu Pengaturan): ' + nama + (pengaturanCache.nipKasiBimas ? ', NIP ' + pengaturanCache.nipKasiBimas : '') + '.'
              : 'Nama Kepala Seksi Bimbingan Masyarakat Islam belum diisi di menu Pengaturan.';
          }
          if (jenis === 'sertifikat' || jenis === 'paket') {
            catatan += (catatan ? ' ' : '') +
              'Nomor, tanggal, tanda tangan, dan nama kepala pada sertifikat dicetak sebagai penanda ${nomor_naskah}, ${tanggal_naskah}, ${ttd_pengirim}, ${nama_pengirim}.';
          }
          kEl('cetakModul').value = 'kiblat';
          kEl('cetakMasjidId').value = id;
          kEl('cetakJenis').value = jenis;
          kEl('modalCetakTitle').textContent = 'Cetak ' + KIBLAT_DOKUMEN[jenis];
          kEl('modalCetakJenisLabel').textContent = r.jenis === 'musola' ? 'Musala' : 'Masjid';
          kEl('modalCetakNamaMasjid').textContent = r.namaMasjid || '-';
          kEl('modalCetakCatatan').textContent = catatan;
          kEl('modalCetakAlert').classList.add('d-none');
          modalCetak.show();
        }

        function prosesCetakKiblat() {
          var id = kEl('cetakMasjidId').value;
          var jenis = kEl('cetakJenis').value;
          var r = kiblatCari(id);
          if (!r) {
            showModalCetakError('Data tidak ditemukan.');
            return;
          }
          if ((jenis === 'verifikasi' || jenis === 'paket') && !pengaturanCache.petugasUkur) {
            showModalCetakError('Nama Petugas Ukur belum diisi. Buka menu Pengaturan terlebih dahulu.');
            return;
          }
          if (jenis === 'ba' && !pengaturanCache.namaKasiBimas) {
            showModalCetakError('Nama Kepala Seksi Bimbingan Masyarakat Islam belum diisi. Buka menu Pengaturan terlebih dahulu.');
            return;
          }
          setProsesCetakLoading(true);
          try {
            var hasil;
            if (jenis === 'sertifikat') hasil = DokumenGenerator.buildSertifikatKiblatPdf(r);
            else if (jenis === 'verifikasi') hasil = DokumenGenerator.buildDataVerifikasiPdf(r, pengaturanCache);
            else if (jenis === 'ba') hasil = DokumenGenerator.buildBeritaAcaraKiblatPdf(r, pengaturanCache);
            else hasil = DokumenGenerator.buildPaketKiblatPdf(r, pengaturanCache, ['sertifikat', 'verifikasi']);
            hasil.doc.save(hasil.filename);
            setProsesCetakLoading(false);
            modalCetak.hide();
          } catch (err) {
            setProsesCetakLoading(false);
            showModalCetakError('Gagal membuat dokumen: ' + err.message);
          }
        }

        /* ------------------------------ pemasangan event ------------------------------ */

        var formKiblat = kEl('formKiblat');
        formKiblat.addEventListener('input', function (ev) {
          var id = ev.target.id;
          if (id === 'kiblatHijriah') {
            var v = ev.target.value.trim();
            kiblatHijriManual = v !== '' && v !== kiblatHijriOtomatis();
            return;
          }
          if (id === 'kiblatTempel') return;
          kiblatPerbarui();
          if (/^kiblat(Lintang|Bujur)[DMSH]$/.test(id)) kiblatSinkronPeta(false);
        });
        formKiblat.addEventListener('change', function (ev) {
          var id = ev.target.id;
          if (ev.target.name === 'kiblatJenis') kiblatTerapkanJenis(ev.target.value);
          if (id === 'kiblatLintangD' || id === 'kiblatLintangM') kiblatNormalisasi('Lintang');
          else if (id === 'kiblatBujurD' || id === 'kiblatBujurM') kiblatNormalisasi('Bujur');
          if (id !== 'kiblatHijriah' && id !== 'kiblatTempel') {
            kiblatPerbarui();
            kiblatSinkronPeta(false);
          }
        });

        kEl('btnKiblatRekam').addEventListener('click', function () { kiblatGps(true); });
        kEl('btnKiblatGps').addEventListener('click', function () { kiblatGps(false); });
        kEl('btnKiblatPeta').addEventListener('click', kiblatToggleMap);
        kEl('btnKiblatSekarang').addEventListener('click', kiblatIsiSekarang);
        kEl('btnKiblatTerapkan').addEventListener('click', kiblatTerapkanTempel);
        kEl('kiblatTempel').addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            kiblatTerapkanTempel();
          }
        });
        kEl('kiblatTempel').addEventListener('paste', function () {
          setTimeout(kiblatTerapkanTempel, 0);
        });
        kEl('btnKiblatHijriahOtomatis').addEventListener('click', function () {
          kiblatHijriManual = false;
          kiblatPerbarui();
        });
        kEl('modalKiblat').addEventListener('hidden.bs.modal', kiblatHentikanGps);
/* END KIBLAT UI */
