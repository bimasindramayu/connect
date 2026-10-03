// BOP KUA: skrip pemasangan sekali-jalan (JANGAN diunggah ke GitHub). Dua perintah dalam satu file:
//
//   node --env-file=.env bop.mjs akun    Buat akun admin + 31 operator (hasil: akun.csv).
//                                        Butuh sekali:  npm install @supabase/supabase-js
//   node --env-file=.env bop.mjs drive   Siapkan akses Google Drive untuk Edge Function "bop":
//                                        ambil refresh token dan buat folder pusat LPJ.
//
// Isi file .env (buat di folder yang sama; JANGAN diunggah ke GitHub):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SERVICE_ROLE_KEY=...                 Secret key atau service_role (RAHASIA)      [akun]
//   ADMIN_EMAIL=admin@contoh.go.id                                                  [akun]
//   ADMIN_PASSWORD=...                   minimal 8 karakter                         [akun]
//   EMAIL_DOMAIN=contoh.go.id            domain email operator                      [akun]
//   GOOGLE_CLIENT_ID=...                 OAuth client "Desktop app"                 [drive]
//   GOOGLE_CLIENT_SECRET=...                                                        [drive]
//   DRIVE_FOLDER_ID=...                  opsional: pakai folder buatan sendiri      [drive]
//
// Persiapan Google (untuk "drive"): aktifkan Google Drive API; OAuth consent screen dengan scope .../auth/drive.file
// lalu "Publish app" (jika tetap Testing, token kedaluwarsa 7 hari); buat OAuth client ID jenis "Desktop app".
// Login dengan akun Google yang akan menjadi pemilik folder LPJ: kuota Drive akun itu yang terpakai.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const cmd = process.argv[2];
if (cmd === 'akun') await akun();
else if (cmd === 'drive') await drive();
else {
  console.log('Pemakaian:\n  node --env-file=.env bop.mjs akun    (buat akun admin + 31 operator)\n  node --env-file=.env bop.mjs drive   (siapkan Google Drive untuk LPJ)');
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------------------
async function akun() {
  const { SUPABASE_URL, SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, EMAIL_DOMAIN } = process.env;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD || !EMAIL_DOMAIN) {
    throw new Error('Isi SUPABASE_URL, SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, dan EMAIL_DOMAIN di .env');
  }
  const { createClient } = await import('@supabase/supabase-js');   // dimuat hanya untuk perintah "akun"
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const KUA = ['Anjatan','Arahan','Balongan','Bangodua','Bongas','Cantigi','Cikedung','Gabuswetan',
    'Gantar','Haurgeulis','Indramayu','Jatibarang','Juntinyuat','Kandanghaur','Karangampel',
    'Kedokan Bunder','Kertasemaya','Krangkeng','Kroya','Lelea','Lohbener','Losarang','Pasekan',
    'Patrol','Sindang','Sliyeg','Sukagumiwang','Sukra','Terisi','Tukdana','Widasari'];

  const pw = () => randomBytes(9).toString('base64url');
  const slug = s => s.toLowerCase().replace(/\s+/g, '');

  const daftar = [
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, nama: 'Administrator', kua: '', role: 'admin' },
    ...KUA.map(k => ({
      email: `kua.${slug(k)}@${EMAIL_DOMAIN}`, password: pw(),
      nama: `Operator KUA ${k}`, kua: `KUA Kec. ${k}`, role: 'operator'
    }))
  ];

  const csv = ['email,password,nama,instansi,role'];
  for (const a of daftar) {
    const { error } = await sb.auth.admin.createUser({
      email: a.email, password: a.password, email_confirm: true,
      user_metadata: { nama: a.nama, kua: a.kua, role: a.role }
    });
    console.log(error ? `GAGAL  ${a.email} -> ${error.message}` : `OK     ${a.email}`);
    if (!error) csv.push([a.email, a.password, a.nama, a.kua, a.role].join(','));
  }
  writeFileSync('akun.csv', csv.join('\n'));
  console.log('\nSelesai. Daftar email + password ada di akun.csv (simpan rapi, jangan diunggah).');
}

// ---------------------------------------------------------------------------------------------------------------
async function drive() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, DRIVE_FOLDER_ID: ownFolder } = process.env;
  if (!id || !secret) throw new Error('Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env');

  const redirect = 'http://localhost:53682';
  // drive.file = hanya file/folder buatan aplikasi ini (paling aman). drive = diperlukan bila memakai folder buatan sendiri.
  const scope = ownFolder ? 'https://www.googleapis.com/auth/drive' : 'https://www.googleapis.com/auth/drive.file';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent', scope,
  });
  console.log('Buka URL ini di browser lalu izinkan akses:\n\n' + url + '\n');

  const code = await new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const c = new URL(req.url, redirect).searchParams.get('code');
      res.end(c ? 'Berhasil. Tutup tab ini dan kembali ke terminal.' : 'Menunggu persetujuan...');
      if (c) { srv.close(); ok(c); }
    }).listen(53682);
  });

  const tok = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  })).json();
  if (!tok.refresh_token) throw new Error('Refresh token tidak diterima: ' + JSON.stringify(tok));

  let folderId = ownFolder;
  if (!folderId) {
    // Folder root dibuat oleh aplikasi ini sendiri, sebab scope drive.file hanya boleh mengakses file/folder buatannya.
    const folder = await (await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'BOP KUA - LPJ', mimeType: 'application/vnd.google-apps.folder' }),
    })).json();
    if (!folder.id) throw new Error('Gagal membuat folder: ' + JSON.stringify(folder));
    folderId = folder.id;
    console.log('\nFolder "BOP KUA - LPJ" dibuat di Drive Anda.');
  }

  console.log('\nSekarang jalankan (satu baris):\n');
  console.log(`npx supabase secrets set GOOGLE_CLIENT_ID=${id} GOOGLE_CLIENT_SECRET=${secret} GOOGLE_REFRESH_TOKEN=${tok.refresh_token} DRIVE_ROOT_FOLDER_ID=${folderId}`);
  console.log('\nLalu: npx supabase functions deploy bop --no-verify-jwt');
}
