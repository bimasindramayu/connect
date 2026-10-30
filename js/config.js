/* =====================================================================================
   config.js: pengaturan sambungan BIMASATU. SATU-SATUNYA berkas yang wajib Anda isi.
   Diisi sekali saat pemasangan dan tidak ikut berubah saat berkas lain diperbarui.
   Instalasi yang sudah berjalan: JANGAN menimpa berkas ini dengan templat; pertahankan nilai Anda.
   Langkah mendapatkan tiap nilai: PANDUAN-INSTALASI.md (bagian 2, 3, 7, dan 8).
   ===================================================================================== */

const CFG = {
  nama: 'BIMASATU',                                  // nama aplikasi; juga nama folder master di Google Drive (samakan dengan APP_NAME di supabase/functions/bop/index.ts dan bop.mjs)
  url: 'https://lpfwkitppdnlcakkncov.supabase.co',        // Supabase > Project Settings > API > Project URL
  key: 'sb_publishable_AfVmUT86ttPMaiO3iUmJew_u3l3IBPF',                        // Supabase > Project Settings > API > Publishable key (sb_publishable_...). BUKAN secret key
  turnstile: '0x4AAAAAAFKG36vwdFMGZBiz',               // Cloudflare Turnstile > Site Key (Secret Key-nya dipasang di Supabase, bukan di sini)
  gas: 'https://script.google.com/macros/s/AKfycbzD36oRsvupE23S5MVbpl179Npwjuv8iyWTMyEyykAOfMTvgzpEOaPrUUWrK8GhynaY5Q/exec',                                           // URL Web App Apps Script (Sertifikat dan BAST NR): Deploy > New deployment > Web app. Kosong = menu tersebut belum aktif
  domain: 'domainanda.com'                             // domain email di balik username (pengguna tidak pernah mengetiknya); HARUS sama dengan EMAIL_DOMAIN di .env
};

// Nomor versi untuk pembusukan cache. Naikkan setiap kali berkas diperbarui: jalankan  node bump-versi.mjs
const APP_VERSI = '2026.10.29.23.54';
