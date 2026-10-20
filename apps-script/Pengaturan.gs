/**
 * =====================================================================
 *  PENGATURAN
 *  Sheet: Pengaturan (kolom A = label, kolom B = isi), satu baris per
 *  pengaturan, urutannya TETAP (jangan diurutkan ulang/disisipi baris):
 *    B1 = Nama Kepala Kantor                      (Sertifikat Masjid/Musala)
 *    B2 = NIP Kepala Kantor
 *    B3 = Nama Kepala Seksi Bimas Islam           (Berita Acara Arah Kiblat)
 *    B4 = NIP Kepala Seksi Bimas Islam
 *    B5 = Nama Petugas Ukur Arah Kiblat           (Data Verifikasi & Berita Acara)
 *    B6 = Tanda tangan Petugas Ukur (gambar PNG/JPEG sebagai data URL)
 *
 *  Kolom B diformat sebagai TEKS supaya NIP (18 digit) tidak diubah
 *  Sheets menjadi angka berformat ilmiah (1,97E+17) yang menghilangkan digit.
 * =====================================================================
 */

const PENGATURAN_BARIS_ = [
  { kunci: 'namaKepalaKantor', label: 'Nama Kepala Kantor' },
  { kunci: 'nipKepalaKantor', label: 'NIP Kepala Kantor' },
  { kunci: 'namaKasiBimas', label: 'Nama Kepala Seksi Bimbingan Masyarakat Islam' },
  { kunci: 'nipKasiBimas', label: 'NIP Kepala Seksi Bimbingan Masyarakat Islam' },
  { kunci: 'petugasUkur', label: 'Nama Petugas Ukur Arah Kiblat' },
  { kunci: 'ttdPetugasUkur', label: 'Tanda Tangan Petugas Ukur (gambar; atur lewat menu Pengaturan)' }
];

// Batas panjang. Sel Google Sheets maksimum 50.000 karakter; tanda tangan
// dibatasi 48.000 (frontend sudah mengecilkan gambar agar jauh di bawahnya).
const PENGATURAN_MAKS_NAMA_ = 150;
const PENGATURAN_MAKS_NIP_ = 40;
const PENGATURAN_MAKS_TTD_ = 48000;

function getPengaturanSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PENGATURAN);
  if (!sheet) {
    throw new Error('Sheet "Pengaturan" belum ada. Jalankan setupDatabase() terlebih dahulu.');
  }
  return sheet;
}

/**
 * Menjamin label baris 1-6 ada (hanya mengisi label yang masih kosong,
 * isi kolom B tidak disentuh) dan kolom B berformat teks. Aman dipanggil
 * berkali-kali; dipakai setupDatabase() dan savePengaturan().
 */
function ensurePengaturanSchema_(sheet) {
  PENGATURAN_BARIS_.forEach(function (baris, i) {
    const sel = sheet.getRange(i + 1, 1);
    if (!String(sel.getValue() || '').trim()) {
      sel.setValue(baris.label);
      sel.setFontWeight('bold');
    }
  });
  sheet.getRange(1, 2, PENGATURAN_BARIS_.length, 1).setNumberFormat('@');
}

function getPengaturan() {
  const sheet = getPengaturanSheet_();
  const nilai = sheet.getRange(1, 2, PENGATURAN_BARIS_.length, 1).getValues();
  const hasil = {};
  PENGATURAN_BARIS_.forEach(function (baris, i) {
    const v = nilai[i][0];
    if (v === null || v === undefined) {
      hasil[baris.kunci] = '';
    } else if (typeof v === 'number' && Math.abs(v) > 9007199254740991) {
      // NIP lama yang dulu disimpan Sheets sebagai angka: digit terakhirnya
      // sudah terpotong (presisi 15-16 digit), jadi tidak ditampilkan agar tidak
      // tercetak salah di dokumen resmi. Pengguna cukup mengetik ulang & menyimpan.
      hasil[baris.kunci] = '';
    } else {
      hasil[baris.kunci] = String(v);
    }
  });
  return hasil;
}

/**
 * Simpan pengaturan. Hanya kunci yang ADA di data yang ditulis, jadi
 * frontend lama (hanya namaKepalaKantor & nipKepalaKantor) tetap bekerja
 * dan tidak menghapus pengaturan baru.
 */
function savePengaturan(data) {
  data = data || {};
  const ada = function (kunci) {
    return Object.prototype.hasOwnProperty.call(data, kunci);
  };

  const nilai = {};
  PENGATURAN_BARIS_.forEach(function (baris) {
    if (!ada(baris.kunci)) return;
    const mentah = data[baris.kunci];
    const teks = mentah === null || mentah === undefined ? '' : String(mentah);
    nilai[baris.kunci] = teks.trim();
  });

  if (ada('namaKepalaKantor') && !nilai.namaKepalaKantor) {
    return { success: false, message: 'Nama Kepala Kantor wajib diisi.' };
  }
  const kunciNama = ['namaKepalaKantor', 'namaKasiBimas', 'petugasUkur'];
  for (let i = 0; i < kunciNama.length; i++) {
    const v = nilai[kunciNama[i]];
    if (v !== undefined && v.length > PENGATURAN_MAKS_NAMA_) {
      return { success: false, message: 'Nama terlalu panjang (maksimal ' + PENGATURAN_MAKS_NAMA_ + ' karakter).' };
    }
  }
  const kunciNip = ['nipKepalaKantor', 'nipKasiBimas'];
  for (let j = 0; j < kunciNip.length; j++) {
    const v = nilai[kunciNip[j]];
    if (v !== undefined && v.length > PENGATURAN_MAKS_NIP_) {
      return { success: false, message: 'NIP terlalu panjang (maksimal ' + PENGATURAN_MAKS_NIP_ + ' karakter).' };
    }
  }
  const ttd = nilai.ttdPetugasUkur;
  if (ttd !== undefined && ttd !== '') {
    if (ttd.length > PENGATURAN_MAKS_TTD_) {
      return { success: false, message: 'Gambar tanda tangan terlalu besar. Gunakan gambar yang lebih kecil.' };
    }
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/]+={0,2}$/.test(ttd)) {
      return { success: false, message: 'Tanda tangan harus berupa gambar PNG atau JPEG.' };
    }
  }

  const sheet = getPengaturanSheet_();
  ensurePengaturanSchema_(sheet);
  PENGATURAN_BARIS_.forEach(function (baris, i) {
    if (ada(baris.kunci)) sheet.getRange(i + 1, 2).setValue(nilai[baris.kunci]);
  });
  return { success: true };
}