/* =====================================================================================
   sertifikat-hitung-kiblat.js: perhitungan arah kiblat, data matahari, tanggal Hijriah (murni, tanpa DOM)
   Salinan apa adanya dari portal sertifikat. Dipakai Arah Kiblat dan mesin PDF. Dimuat saat menu Sertifikat dibuka.
   ===================================================================================== */

var KiblatHitung = (function () {
  'use strict';

  var PIR = Math.PI / 180;
  // Ka'bah (Google Earth), sama dengan sheet "qiblat" di xlsx.
  var KAABAH_LAT = 21 + 25 / 60 + 22 / 3600;
  var KAABAH_LON = 39 + 49 / 60 + 34 / 3600;
  var ZONA_WIB = 7;

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var NAMA_BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var NAMA_BULAN_HIJRI = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];

  /* ---------- pembantu angka ---------- */

  // Membuang derau floating-point di digit ke-16/17 (cara Excel menilai angka)
  // sebelum dibulatkan, supaya nilai yang "seharusnya" tepat .5 tidak meleset.
  function norm15(x) { return Number(x.toPrecision(15)); }

  // MOD ala Excel: hasil bertanda sama dengan pembagi.
  function mod(a, n) { return a - n * Math.floor(a / n); }

  // Angka -> teks tanpa nol di belakang koma ("17", "40.33").
  function numStr(x) {
    var v = norm15(x);
    return v === 0 ? '0' : String(v);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- derajat-menit-detik (bilangan bulat detik-busur) ---------- */

  // Jumlah detik-busur (dikali 10^desimal) dari nilai derajat >= 0.
  // potong=true -> dipotong ke bawah (TRUNC); selain itu dibulatkan (ROUND).
  function totalDetik(derajat, desimal, potong) {
    var v = norm15(derajat * 3600 * Math.pow(10, desimal));
    return potong ? Math.floor(v) : Math.round(v);
  }

  // Memecah total (hasil totalDetik) menjadi derajat, menit, detik.
  function pecahTotal(total, desimal) {
    var skala = Math.pow(10, desimal);
    var perMenit = 60 * skala;
    var perDerajat = 3600 * skala;
    var d = Math.floor(total / perDerajat);
    total -= d * perDerajat;
    var m = Math.floor(total / perMenit);
    total -= m * perMenit;
    return { d: d, m: m, s: total / skala };
  }

  // Nilai derajat (>= 0) -> {d, m, s}; detik dibulatkan ke 'desimal' angka.
  function pecahDms(derajat, desimal) {
    return pecahTotal(totalDetik(derajat, desimal), desimal);
  }

  // 23°6'24.88"  (tanpa spasi/padding; tanda minus di depan derajat)
  function teksDms(p, negatif) {
    return (negatif ? '-' : '') + p.d + '°' + p.m + "'" + numStr(p.s) + '"';
  }

  // Detik 2 desimal, 2 digit di depan koma: "04.77"
  function detik2(s) {
    var t = (Math.round(s * 100) / 100).toFixed(2);
    return (s < 10 ? '0' : '') + t;
  }

  // Format Sertifikat/Berita Acara: "6° 20′ 29.72″"  (spasi + nol di depan)
  function teksKoordinatSertifikat(d, m, s) {
    return d + '° ' + pad2(m) + '′ ' + detik2(s) + '″';
  }

  // Format azimut di Sertifikat/Berita Acara: "294°52′40.33″"  (tanpa spasi)
  function teksDmsSertifikat(p) {
    return p.d + '°' + pad2(p.m) + '′' + detik2(p.s) + '″';
  }

  /* ---------- koordinat ---------- */

  // derajat/menit/detik + hemisfer -> desimal (selatan & barat negatif)
  function koordinatDesimal(d, m, s, hemisfer) {
    var v = d + m / 60 + s / 3600;
    return (hemisfer === 'S' || hemisfer === 'B') ? -v : v;
  }

  // desimal -> {d, m, s, hemisfer}; jenis 'lintang' (U/S) atau 'bujur' (T/B)
  function desimalKeDms(nilai, jenis) {
    var pos = jenis === 'lintang' ? 'U' : 'T';
    var neg = jenis === 'lintang' ? 'S' : 'B';
    var p = pecahDms(Math.abs(nilai), 2);
    return { d: p.d, m: p.m, s: p.s, hemisfer: nilai < 0 ? neg : pos };
  }

  function wilayahIndramayu(lat, lon) {
    return lat >= -6.95 && lat <= -6.0 && lon >= 107.7 && lon <= 108.8;
  }

  function angka(s) { return parseFloat(String(s).replace(',', '.')); }

  /**
   * Membaca koordinat dari teks yang ditempel (Google Maps dsb).
   * Didukung: "-6.340247, 108.113883", "6.34 S 108.11 E",
   *           6°20'29.7"S 108°06'49.9"E (juga ′ ″ dan LS/LU/BT/BB),
   *           tautan Google Maps lengkap (@lat,lon / !3d..!4d.. / ?q=lat,lon).
   * Mengembalikan {lat, lon} desimal, atau null kalau tidak dikenali.
   */
  function parseKoordinat(teks) {
    var t = String(teks === null || teks === undefined ? '' : teks).trim();
    if (!t) return null;
    var m;

    if (/^https?:\/\//i.test(t)) {
      try { t = decodeURIComponent(t); } catch (e) { /* biarkan apa adanya */ }
      m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(t) ||
          /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(t) ||
          /[?&](?:q|ll|query|center|destination)=(-?\d+(?:\.\d+)?)[,+ ]+(-?\d+(?:\.\d+)?)/.exec(t);
      return m ? { lat: +m[1], lon: +m[2] } : null;
    }

    t = t.replace(/[′’‘`´]/g, "'").replace(/[″”“]/g, '"')
         .replace(/º|˚/g, '°').replace(/−/g, '-');

    var hits = [];
    var mm;
    // Pasangan desimal sederhana ("-6.34, 108.11" / "6.34 S 108.11 E") dibaca langsung.
    var sederhana = /^([+-]?\d+(?:\.\d+)?)\s*(?:\u00B0)?\s*(LS|LU|BT|BB|[NSEWUTB])?\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*(?:\u00B0)?\s*(LS|LU|BT|BB|[NSEWUTB])?$/i.exec(t);
    if (sederhana) {
      hits = [
        { v: angka(sederhana[1]), h: sederhana[2] ? sederhana[2].toUpperCase() : '' },
        { v: angka(sederhana[3]), h: sederhana[4] ? sederhana[4].toUpperCase() : '' }
      ];
    } else {
      // Koma sebagai pemisah desimal (kebiasaan Indonesia): "-6,34; 108,11" atau "-6,34 108,11"
      if (/;/.test(t)) t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ' ');
      else if (!/\./.test(t) && /^[+-]?\d+,\d+\s+[+-]?\d+,\d+$/.test(t)) t = t.replace(/(\d),(\d)/g, '$1.$2');
      // angka [derajat [menit' [detik"]]] [hemisfer]
      var re = /([+-]?\d+(?:\.\d+)?)\s*(?:\u00B0\s*(?:(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*(?:"|'')\s*)?)?)?\s*(LS|LU|BT|BB|[NSEWUTB])?(?![A-Za-z0-9.])/gi;
      while ((mm = re.exec(t)) !== null) {
        var nilai = angka(mm[1]);
        var neg = mm[1].charAt(0) === '-';
        var menit = mm[2] ? angka(mm[2]) : 0;
        var detik = mm[3] ? angka(mm[3]) : 0;
        var v = Math.abs(nilai) + menit / 60 + detik / 3600;
        hits.push({ v: neg ? -v : v, h: mm[4] ? mm[4].toUpperCase() : '' });
      }
    }
    if (hits.length !== 2) return null;

    function hemi(h) {
      if (h === 'N' || h === 'U' || h === 'LU') return { jenis: 'lat', tanda: 1 };
      if (h === 'S' || h === 'LS') return { jenis: 'lat', tanda: -1 };
      if (h === 'E' || h === 'T' || h === 'BT') return { jenis: 'lon', tanda: 1 };
      if (h === 'W' || h === 'B' || h === 'BB') return { jenis: 'lon', tanda: -1 };
      return null;
    }
    var a = hits[0], b = hits[1];
    var ha = hemi(a.h), hb = hemi(b.h);
    var lat, lon;
    if (ha && hb) {
      if (ha.jenis === hb.jenis) return null;
      var pa = ha.tanda * Math.abs(a.v), pb = hb.tanda * Math.abs(b.v);
      if (ha.jenis === 'lat') { lat = pa; lon = pb; } else { lat = pb; lon = pa; }
    } else if (!ha && !hb) {
      lat = a.v; lon = b.v;
    } else {
      // Hanya satu hemisfer yang ditulis: terapkan ke pasangannya, urutan lat,lon.
      var h1 = ha ? ha.tanda * Math.abs(a.v) : a.v;
      var h2 = hb ? hb.tanda * Math.abs(b.v) : b.v;
      if (ha && ha.jenis === 'lon' || hb && hb.jenis === 'lat') { lat = h2; lon = h1; } else { lat = h1; lon = h2; }
    }
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat: lat, lon: lon };
  }

  /* ---------- tanggal & waktu ---------- */

  // Nomor seri tanggal Excel (sistem 1900) untuk tanggal Masehi y-m-d.
  function excelSerial(y, m, d) {
    return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
  }

  function namaHari(y, m, d) { return NAMA_HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
  function tanggalPanjang(y, m, d) { return pad2(d) + ' ' + NAMA_BULAN[m - 1] + ' ' + y; }
  function tanggalPendek(y, m, d) { return pad2(d) + '-' + NAMA_BULAN_PENDEK[m - 1] + '-' + pad2(y % 100); }

  function parseIso(iso) {
    var mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!mt) return null;
    var y = +mt[1], m = +mt[2], d = +mt[3];
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  function parseJam(str) {
    var mt = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(str || '').trim());
    if (!mt) return null;
    var h = +mt[1], mi = +mt[2], s = mt[3] ? +mt[3] : 0;
    if (h > 23 || mi > 59 || s > 59) return null;
    return { h: h, m: mi, s: s, detik: h * 3600 + mi * 60 + s };
  }

  function formatJam(detik, denganDetik) {
    detik = mod(Math.round(detik), 86400);
    var h = Math.floor(detik / 3600);
    var mi = Math.floor((detik % 3600) / 60);
    var s = detik % 60;
    return pad2(h) + ':' + pad2(mi) + (denganDetik ? ':' + pad2(s) : '');
  }

  // Tanggal & jam saat ini menurut WIB (UTC+7), TIDAK bergantung pada zona
  // waktu komputer yang dipakai. 'ms' opsional (untuk pengujian).
  function sekarangWib(ms) {
    var t = new Date((typeof ms === 'number' ? ms : Date.now()) + ZONA_WIB * 3600 * 1000);
    var y = t.getUTCFullYear(), mo = t.getUTCMonth() + 1, d = t.getUTCDate();
    return {
      tahun: y, bulan: mo, tanggal: d,
      jam: t.getUTCHours(), menit: t.getUTCMinutes(),
      iso: y + '-' + pad2(mo) + '-' + pad2(d),
      jamTeks: pad2(t.getUTCHours()) + ':' + pad2(t.getUTCMinutes())
    };
  }

  /* ---------- Hijriah: kalender sipil tabular ---------- */

  // Hari Julian (bilangan bulat) dari tanggal Gregorian proleptik.
  function hariJulian(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
           Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  // Tahun kabisat (355 hari) dalam siklus 30 tahun = 10.631 hari.
  var TAHUN_KABISAT = { 2: 1, 5: 1, 7: 1, 10: 1, 13: 1, 16: 1, 18: 1, 21: 1, 24: 1, 26: 1, 29: 1 };
  var EPOCH_HIJRI = 1948440; // hari Julian 1 Muharram 1 H (sipil, Jumat)

  function hijriSipil(y, m, d) {
    var hari = hariJulian(y, m, d) - EPOCH_HIJRI;      // 0 = 1 Muharram 1 H
    var siklus = Math.floor(hari / 10631);
    var sisa = hari - siklus * 10631;                   // 0..10630
    var th = 1;
    while (th < 30) {
      var panjangTahun = TAHUN_KABISAT[th] ? 355 : 354;
      if (sisa < panjangTahun) break;
      sisa -= panjangTahun;
      th++;
    }
    var bln = 1;
    while (bln < 12) {
      var panjangBulan = (bln % 2 === 1) ? 30 : 29;
      if (sisa < panjangBulan) break;
      sisa -= panjangBulan;
      bln++;
    }
    // Bulan ke-12 berumur 29 hari (30 pada tahun kabisat); sisa selalu muat.
    return {
      tahun: siklus * 30 + th, bulan: bln, hari: sisa + 1,
      teks: (sisa + 1) + ' ' + NAMA_BULAN_HIJRI[bln - 1] + ' ' + (siklus * 30 + th) + ' H'
    };
  }

  /* ---------- azimut kiblat ---------- */

  // Bearing awal (dari Utara, searah jarum jam) dari titik (lat, lon) ke Ka'bah.
  function azimutKiblat(lat, lon) {
    var dl = (KAABAH_LON - lon) * PIR;
    var p1 = lat * PIR;
    var p2 = KAABAH_LAT * PIR;
    var y = Math.sin(dl);
    var x = Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl);
    return mod(Math.atan2(y, x) / PIR, 360);
  }

  function hitungKiblat(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { ok: false, pesan: 'Koordinat tidak valid.' };
    }
    var azimut = azimutKiblat(lat, lon);
    if (!(azimut > 270 && azimut < 360)) {
      return {
        ok: false,
        pesan: 'Arah kiblat dari koordinat ini tidak berada di kuadran Barat-Utara (azimut ' + numStr(Math.round(azimut * 1000) / 1000) +
               '°); dokumen ini dirancang untuk wilayah Indonesia. Periksa kembali lintang/bujur dan hemisfernya.'
      };
    }
    // Azimut dipotong (TRUNC) ke 0,01 detik seperti rumus di xlsx; B dan sudut Q
    // diturunkan dari azimut yang sudah dipotong itu, jadi "360 - B = azimut" tepat.
    var azTotal = totalDetik(azimut, 2, true);
    var bTotal = 360 * 360000 - azTotal;                  // B = 360 - azimut
    var qTotal = azTotal - 270 * 360000;                  // sudut Q = azimut - 270
    var azDms = pecahTotal(azTotal, 2);
    var bDms = pecahTotal(bTotal, 2);
    var qDms = pecahTotal(qTotal, 2);
    return {
      ok: true,
      azimut: azimut, B: 360 - azimut, sudutQ: azimut - 270,
      azimutDms: azDms, bDms: bDms, sudutQDms: qDms,
      // untuk halaman Data Verifikasi (tanpa spasi/padding, tanda kutip ASCII)
      teksAzimut: teksDms(azDms, false),
      teksB: teksDms(bDms, false),
      teksSudutQ: teksDms(qDms, false)
    };
  }

  /* ---------- posisi matahari ---------- */

  function satuBarisMatahari(o, A) {
    var B = o.serial + A - 0.5 - 1 - o.tz / 24;
    var C = (B - 36525) / 36525;
    var D = mod(280.46646 + 36000.76983 * C + 0.0003032 * C * C, 360);
    var E = 125.04 - 1934.136 * C;
    var F = mod(357.52911 + 35999.05029 * C - 0.0001537 * Math.pow(C, 2), 360);
    var G = (1.9146 - 0.004817 * C - 0.000014 * Math.pow(C, 2)) * Math.sin(F * PIR) +
            (0.019993 - 0.000101 * C) * Math.sin(2 * F * PIR) +
            0.00029 * Math.sin(3 * F * PIR);
    var H = D + G;
    var I = 23.43929111 - 0.013004167 * C - 0.000000163889 * Math.pow(C, 2) + 0.000000503611 * Math.pow(C, 3);
    var J = I + 0.00256 * Math.cos(PIR * E);
    var K = H - 0.00569 - 0.00478 * Math.sin(PIR * E);
    var L = Math.asin(Math.sin(K * PIR) * Math.sin(J * PIR)) / PIR;          // deklinasi
    var M = Math.atan(Math.tan(K * PIR) * Math.cos(J * PIR)) / PIR;          // RA (hasil ATAN, seperti di xlsx)
    var eotMenit = mod(D - M + 40, 90) * 4 - 160;
    var N = A + eotMenit / 1440 + (-15 * o.tz + o.lon) / 360;
    var P = (mod(N, 1) - 0.5) * 360;
    var phi = o.lat * PIR;
    var Q = Math.asin(Math.sin(phi) * Math.sin(L * PIR) + Math.cos(phi) * Math.cos(L * PIR) * Math.cos(P * PIR)) / PIR;
    var arg = (Math.sin(L * PIR) - Math.sin(phi) * Math.sin(Q * PIR)) / (Math.cos(phi) * Math.cos(Q * PIR));
    if (arg > 1) arg = 1;
    if (arg < -1) arg = -1;
    var R = (180 - Math.acos(arg) / PIR) * (P < 0 ? -1 : 1);
    var S = 180 + R;
    return { L: L, M: M, eotMenit: eotMenit, P: P, Q: Q, S: S };
  }

  // "-03:50": TEXT(ABS(menit)/1440,"mm:ss") dengan tanda minus di depan.
  function teksEot(eotMenit) {
    var td = Math.round(Math.abs(eotMenit) * 60);
    return (eotMenit < 0 ? '-' : '') + pad2(Math.floor(td / 60)) + ':' + pad2(td % 60);
  }

  /**
   * opt: { lat, lon, tz, tahun, bulan, tanggal, jamMulaiDetik, intervalDetik, jumlah, azimutKiblat }
   *  lat  : desimal, selatan negatif       lon : desimal, timur positif
   * return: array baris { jam, ra, dekl, eot, irtifa, azimut, mizwah, selisih, mentah }
   */
  function hitungTabelMatahari(opt) {
    var o = { serial: excelSerial(opt.tahun, opt.bulan, opt.tanggal), tz: opt.tz === undefined ? ZONA_WIB : opt.tz, lat: opt.lat, lon: opt.lon };
    var step = opt.intervalDetik / 86400;
    var A = opt.jamMulaiDetik / 86400;
    var perPutaran = 360 * 36000;                          // 360 derajat dalam 0,1 detik-busur
    var baris = [];
    for (var i = 0; i < opt.jumlah; i++) {
      var h = satuBarisMatahari(o, A);
      var S = mod(h.S, 360);
      var azTotal = totalDetik(S, 1) % perPutaran;
      var az = pecahTotal(azTotal, 1);
      var mizwah = pecahTotal((azTotal + perPutaran / 2) % perPutaran, 1);
      var selisih = '';
      var selisihDesimal = null;
      if (typeof opt.azimutKiblat === 'number') {
        selisihDesimal = mod(opt.azimutKiblat - S, 360);
        selisih = teksDms(pecahDms(selisihDesimal, 2), false);
      }
      baris.push({
        jam: formatJam(opt.jamMulaiDetik + i * opt.intervalDetik, true),
        ra: teksDms(pecahDms(Math.abs(h.M), 2), false),
        dekl: teksDms(pecahDms(Math.abs(h.L), 2), h.L < 0),
        eot: teksEot(h.eotMenit),
        irtifa: teksDms(pecahDms(Math.abs(h.Q), 2), h.Q < 0),
        azimut: teksDms(az, false),
        mizwah: teksDms(mizwah, false),
        selisih: selisih,
        mentah: { L: h.L, M: h.M, eotMenit: h.eotMenit, Q: h.Q, S: S, P: h.P, selisih: selisihDesimal }
      });
      A = A + step;
    }
    return baris;
  }

  /* ---------- satu rekaman lengkap ---------- */

  /**
   * rek: { lintangDerajat, lintangMenit, lintangDetik, lintangHemisfer,
   *        bujurDerajat, bujurMenit, bujurDetik, bujurHemisfer,
   *        tanggalKalibrasi ('yyyy-MM-dd'), jamKalibrasi ('HH:mm'), tanggalHijriah }
   * Mengembalikan { ok, pesan } atau { ok:true, lat, lon, kiblat, tabel, tanggal, jam, hari, hijri, ... }
   */
  function hitungRekaman(rek, jumlahBaris) {
    var lat = koordinatDesimal(+rek.lintangDerajat, +rek.lintangMenit, +rek.lintangDetik, rek.lintangHemisfer);
    var lon = koordinatDesimal(+rek.bujurDerajat, +rek.bujurMenit, +rek.bujurDetik, rek.bujurHemisfer);
    var tgl = parseIso(rek.tanggalKalibrasi);
    var jam = parseJam(rek.jamKalibrasi);
    if (!isFinite(lat) || !isFinite(lon)) return { ok: false, pesan: 'Koordinat belum lengkap.' };
    if (!tgl) return { ok: false, pesan: 'Tanggal kalibrasi belum valid.' };
    if (!jam) return { ok: false, pesan: 'Jam kalibrasi belum valid.' };
    var kiblat = hitungKiblat(lat, lon);
    if (!kiblat.ok) return kiblat;
    var tabel = hitungTabelMatahari({
      lat: lat, lon: lon, tz: ZONA_WIB, tahun: tgl.y, bulan: tgl.m, tanggal: tgl.d,
      jamMulaiDetik: jam.h * 3600 + jam.m * 60, intervalDetik: 60,
      jumlah: jumlahBaris || 12, azimutKiblat: kiblat.azimut
    });
    var hijri = hijriSipil(tgl.y, tgl.m, tgl.d);
    return {
      ok: true, lat: lat, lon: lon, kiblat: kiblat, tabel: tabel,
      tanggal: tgl, jam: jam,
      hari: namaHari(tgl.y, tgl.m, tgl.d),
      tanggalPanjang: tanggalPanjang(tgl.y, tgl.m, tgl.d),
      tanggalPendek: tanggalPendek(tgl.y, tgl.m, tgl.d),
      jamTeks: formatJam(jam.detik, false),
      jamTeksDetik: formatJam(jam.detik, true),
      hijri: hijri,
      hijriTeks: String(rek.tanggalHijriah || '').trim() || hijri.teks
    };
  }

  return {
    PIR: PIR,
    KAABAH_LAT: KAABAH_LAT,
    KAABAH_LON: KAABAH_LON,
    NAMA_BULAN: NAMA_BULAN,
    NAMA_BULAN_HIJRI: NAMA_BULAN_HIJRI,
    mod: mod,
    numStr: numStr,
    pad2: pad2,
    excelSerial: excelSerial,
    namaHari: namaHari,
    tanggalPanjang: tanggalPanjang,
    tanggalPendek: tanggalPendek,
    parseIso: parseIso,
    parseJam: parseJam,
    formatJam: formatJam,
    sekarangWib: sekarangWib,
    hariJulian: hariJulian,
    hijriSipil: hijriSipil,
    pecahDms: pecahDms,
    teksDms: teksDms,
    azimutKiblat: azimutKiblat,
    hitungKiblat: hitungKiblat,
    hitungTabelMatahari: hitungTabelMatahari,
    hitungRekaman: hitungRekaman,
    koordinatDesimal: koordinatDesimal,
    desimalKeDms: desimalKeDms,
    parseKoordinat: parseKoordinat,
    wilayahIndramayu: wilayahIndramayu,
    teksKoordinatSertifikat: teksKoordinatSertifikat,
    teksDmsSertifikat: teksDmsSertifikat
  };
})();
