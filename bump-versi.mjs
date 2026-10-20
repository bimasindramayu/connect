// Menaikkan nomor versi agar peramban memuat berkas terbaru setelah pembaruan.
// Pakai:  node bump-versi.mjs   (lalu commit dan push). Mengubah ?v=... di index.html dan APP_VERSI di js/config.js.
import fs from 'node:fs';
const v = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '.');   // contoh: 2026.10.11.1530
const ubah = (berkas, pola, ganti) => {
  const lama = fs.readFileSync(berkas, 'utf8'), baru = lama.replace(pola, ganti);
  if (baru === lama) throw new Error('Tidak ada yang berubah di ' + berkas);
  fs.writeFileSync(berkas, baru);
};
ubah('index.html', /\?v=[\w.]+/g, '?v=' + v);
ubah('js/config.js', /APP_VERSI = '[^']*'/, `APP_VERSI = '${v}'`);
console.log('Versi baru:', v);
