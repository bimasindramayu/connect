// Jalin: skrip pemasangan sekali-jalan (JANGAN diunggah ke GitHub). Empat perintah dalam satu file:
//
//   node --env-file=.env bop.mjs akun      Buat akun admin + 31 operator dengan USERNAME (hasil: akun.csv).
//                                          Butuh sekali:  npm install @supabase/supabase-js
//   node --env-file=.env bop.mjs username  Ubah akun LAMA (kua.<nama>@domain) menjadi username kua_<nama>; password tidak berubah.
//                                          Aman diulang. Hasil: username.csv (tanpa password).
//   node --env-file=.env bop.mjs drive     Siapkan akses Google Drive untuk Edge Function "bop":
//                                          ambil refresh token dan buat folder master "Jalin".
//   node --env-file=.env bop.mjs bast      Pindahkan data BAST NR lama (Apps Script/Spreadsheet) ke Supabase.
//
// Isi file .env (buat di folder yang sama; JANGAN diunggah ke GitHub):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SERVICE_ROLE_KEY=...                 Secret key atau service_role (RAHASIA)      [akun, username, bast]
//   EMAIL_DOMAIN=contoh.go.id            domain di balik username; pengguna tidak pernah mengetiknya.
//                                        HARUS sama dengan CFG.domain di index.html  [akun, username]
//   ADMIN_USERNAME=admin                 opsional (bawaan: admin)                    [akun, username]
//   ADMIN_EMAIL=admin@kantor.go.id       opsional: admin memakai email sendiri (login mengetik email lengkap)  [akun]
//   ADMIN_PASSWORD=...                   minimal 8 karakter                          [akun]
//   GOOGLE_CLIENT_ID=...                 OAuth client "Desktop app"                  [drive]
//   GOOGLE_CLIENT_SECRET=...                                                         [drive]
//   DRIVE_FOLDER_ID=...                  opsional: pakai folder buatan sendiri       [drive]
//   BAST_WEB_APP_URL=https://script.google.com/macros/s/.../exec   URL Web App BAST NR lama   [bast]
//
// Username operator: kua_<nama kecamatan huruf kecil tanpa spasi>, mis. kua_anjatan, kua_indramayu, kua_kedokanbunder.
// Persiapan Google (untuk "drive"): aktifkan Google Drive API; OAuth consent screen dengan scope .../auth/drive.file
// lalu "Publish app" (jika tetap Testing, token kedaluwarsa 7 hari); buat OAuth client ID jenis "Desktop app".
// Login dengan akun Google yang akan menjadi pemilik folder LPJ: kuota Drive akun itu yang terpakai.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Nama aplikasi = nama folder master di Google Drive. Samakan dengan CFG.nama di index.html dan APP_NAME di index.ts.
const APP_NAME = 'Jalin';
const slug = s => s.toLowerCase().replace(/\s+/g, '');
const usernameKua = kecamatan => `kua_${slug(kecamatan)}`;

const cmd = process.argv[2];
if (cmd === 'akun') await akun();
else if (cmd === 'username') await username();
else if (cmd === 'drive') await drive();
else if (cmd === 'bast') await bast();
else {
  console.log('Pemakaian:\n  node --env-file=.env bop.mjs akun      (buat akun admin + 31 operator dengan username)\n  node --env-file=.env bop.mjs username  (ubah akun lama menjadi username kua_<nama>)\n  node --env-file=.env bop.mjs drive     (siapkan Google Drive untuk LPJ)\n  node --env-file=.env bop.mjs bast      (pindahkan data BAST NR lama ke Supabase)');
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------------------
async function akun() {
  const { SUPABASE_URL, SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD, EMAIL_DOMAIN } = process.env;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_PASSWORD || !EMAIL_DOMAIN) {
    throw new Error('Isi SUPABASE_URL, SERVICE_ROLE_KEY, ADMIN_PASSWORD, dan EMAIL_DOMAIN di .env');
  }
  const { createClient } = await import('@supabase/supabase-js');   // dimuat hanya bila perlu
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const KUA = ['Anjatan','Arahan','Balongan','Bangodua','Bongas','Cantigi','Cikedung','Gabuswetan',
    'Gantar','Haurgeulis','Indramayu','Jatibarang','Juntinyuat','Kandanghaur','Karangampel',
    'Kedokan Bunder','Kertasemaya','Krangkeng','Kroya','Lelea','Lohbener','Losarang','Pasekan',
    'Patrol','Sindang','Sliyeg','Sukagumiwang','Sukra','Terisi','Tukdana','Widasari'];

  const pw = () => randomBytes(9).toString('base64url');
  const adminEmail = (ADMIN_EMAIL || `${(ADMIN_USERNAME || 'admin').toLowerCase()}@${EMAIL_DOMAIN}`).toLowerCase();
  const login = email => email.endsWith('@' + EMAIL_DOMAIN) ? email.split('@')[0] : email;   // yang diketik pengguna saat login

  const daftar = [
    { email: adminEmail, password: ADMIN_PASSWORD, nama: 'Administrator', kua: '', role: 'admin' },
    ...KUA.map(k => ({
      email: `${usernameKua(k)}@${EMAIL_DOMAIN}`, password: pw(),
      nama: `Operator KUA ${k}`, kua: `KUA Kec. ${k}`, role: 'operator'
    }))
  ];

  const csv = ['username,password,nama,instansi,role'];
  for (const a of daftar) {
    const { error } = await sb.auth.admin.createUser({
      email: a.email, password: a.password, email_confirm: true,
      user_metadata: { nama: a.nama, kua: a.kua, role: a.role }
    });
    console.log(error ? `GAGAL  ${login(a.email)} -> ${error.message}` : `OK     ${login(a.email)}`);
    if (!error) csv.push([login(a.email), a.password, a.nama, a.kua, a.role].join(','));
  }
  writeFileSync('akun.csv', csv.join('\n'));
  console.log('\nSelesai. Daftar username + password ada di akun.csv (simpan rapi, jangan diunggah).');
  console.log(`Pastikan CFG.domain di index.html = '${EMAIL_DOMAIN}'.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Mengubah akun LAMA (mis. kua.anjatan@domain) menjadi username baru kua_anjatan. Password tidak berubah, jadi operator cukup
// memakai username baru dengan password yang sama. Username diturunkan dari nama kecamatan di tabel kua (bukan dari email lama).
// Admin ikut diubah hanya bila ADMIN_USERNAME diisi. Aman diulang: akun yang sudah sesuai dilewati.
async function username() {
  const { SUPABASE_URL, SERVICE_ROLE_KEY, EMAIL_DOMAIN, ADMIN_USERNAME } = process.env;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !EMAIL_DOMAIN) throw new Error('Isi SUPABASE_URL, SERVICE_ROLE_KEY, dan EMAIL_DOMAIN di .env');
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const [prof, kua] = await Promise.all([sb.from('profiles').select('id,nama,kua,role,kua_id'), sb.from('kua').select('id,kecamatan')]);
  if (prof.error || kua.error) throw new Error((prof.error || kua.error).message);
  const kec = new Map(kua.data.map(k => [k.id, k.kecamatan]));
  const users = [];
  for (let page = 1; ; page++) {   // semua akun Auth (dibagi per halaman)
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  const byId = new Map(users.map(u => [u.id, u]));

  const rencana = [];
  for (const p of prof.data) {
    const u = byId.get(p.id); if (!u) continue;
    if (p.role === 'operator' && p.kua_id && kec.get(p.kua_id)) rencana.push({ p, u, baru: `${usernameKua(kec.get(p.kua_id))}@${EMAIL_DOMAIN}` });
    else if (p.role === 'admin' && ADMIN_USERNAME) rencana.push({ p, u, baru: `${ADMIN_USERNAME.toLowerCase()}@${EMAIL_DOMAIN}` });
  }
  const csv = ['username,nama,instansi,role'];
  let ubah = 0, sama = 0, gagal = 0;
  for (const { p, u, baru } of rencana) {
    const nama = baru.split('@')[0];
    if ((u.email || '').toLowerCase() === baru) { console.log(`SAMA   ${nama}`); sama++; csv.push([nama, p.nama, p.kua ?? '', p.role].join(',')); continue; }
    const { error } = await sb.auth.admin.updateUserById(p.id, { email: baru, email_confirm: true });
    if (error) { console.log(`GAGAL  ${u.email} -> ${baru}: ${error.message}`); gagal++; continue; }
    console.log(`OK     ${u.email} -> ${baru}`); ubah++;
    csv.push([nama, p.nama, p.kua ?? '', p.role].join(','));
  }
  writeFileSync('username.csv', csv.join('\n'));
  console.log(`\nSelesai: ${ubah} diubah, ${sama} sudah sesuai, ${gagal} gagal. Daftar username ada di username.csv (tanpa password).`);
  console.log(`Pastikan CFG.domain di index.html = '${EMAIL_DOMAIN}'. Password tidak berubah.`);
  if (gagal) process.exitCode = 1;
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
      body: JSON.stringify({ name: APP_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })).json();
    if (!folder.id) throw new Error('Gagal membuat folder: ' + JSON.stringify(folder));
    folderId = folder.id;
    console.log(`\nFolder master "${APP_NAME}" dibuat di Drive Anda. Di dalamnya Edge Function membuat BOP / LPJ / tahun / Kecamatan ..., dan BAST NR / tahun / bulan.`);
  }

  console.log('\nSekarang jalankan (satu baris):\n');
  console.log(`npx supabase secrets set GOOGLE_CLIENT_ID=${id} GOOGLE_CLIENT_SECRET=${secret} GOOGLE_REFRESH_TOKEN=${tok.refresh_token} DRIVE_ROOT_FOLDER_ID=${folderId}`);
  if (ownFolder) console.log(`\nCatatan: folder Anda akan dinamai ulang menjadi "${APP_NAME}" otomatis oleh Edge Function saat pertama dipakai.`);
  console.log('\nLalu: npx supabase functions deploy bop --no-verify-jwt');
}

// ---------------------------------------------------------------------------------------------------------------
// Memindahkan data BAST NR dari Web App Apps Script lama (aksi GET: getPegawai, getBeritaAcara, getSetting) ke Supabase.
// Aman diulang: data yang sudah ada dilewati (perubahan di sistem baru tidak ditimpa). Arsip lama hanya dicatat sebagai tautan.
async function bast() {
  const { SUPABASE_URL, SERVICE_ROLE_KEY, BAST_WEB_APP_URL: url } = process.env;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !url) throw new Error('Isi SUPABASE_URL, SERVICE_ROLE_KEY, dan BAST_WEB_APP_URL (berakhiran /exec) di .env');
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const get = async (a) => {
    const j = await (await fetch(`${url}?action=${a}`)).json().catch(() => null);
    if (!j?.success) throw new Error(`${a} gagal: ${j?.message ?? 'respons bukan JSON (cek URL Web App dan akses "Anyone")'}`);
    return j.data;
  };
  const txt = (v) => String(v ?? '').trim(), int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  const [peg, ba, set] = [await get('getPegawai'), await get('getBeritaAcara'), await get('getSetting')];
  const warn = [];

  const pegRows = peg.map((p) => ({ nip: txt(p.nip), nama: txt(p.nama), kategori: txt(p.kategori), jabatan: txt(p.jabatan), kua: txt(p.kua), alamat: txt(p.alamat) }))
    .filter((p) => { const ok = p.nip && p.nama && p.jabatan && p.alamat && ['Bimas Islam', 'KUA'].includes(p.kategori); if (!ok) warn.push(`Pegawai dilewati (data tidak lengkap): ${p.nip || '(NIP kosong)'} ${p.nama}`); return ok; });

  const seen = new Set(), baRows = [];
  for (const r of ba) {
    const row = {
      nomor_urut: int(r.nomorUrut), tahun: int(r.tahun), bln_srt: int(r.blnSrt), hari: txt(r.hari), tgl: txt(r.tgl), bln: txt(r.bln),
      pihak_satu_nip: txt(r.pihakSatuNip), pihak_satu_nama: txt(r.pihakSatuNama), pihak_satu_jabatan: txt(r.pihakSatuJabatan), pihak_satu_alamat: txt(r.pihakSatuAlamat),
      pihak_kedua_nip: txt(r.pihakKeduaNip), pihak_kedua_nama: txt(r.pihakKeduaNama), pihak_kedua_jabatan: txt(r.pihakKeduaJabatan), pihak_kedua_alamat: txt(r.pihakKeduaAlamat),
      banyak_na_buku: int(r.banyakNaBuku), banyak_n: int(r.banyakN), banyak_nb: int(r.banyakNb), no_seri: txt(r.noSeri), porporasi: txt(r.porporasi),
      kasi_nama: txt(r.kasiNama), kasi_nip: txt(r.kasiNip), status_simkah: r.statusSimkah === 'Sudah' ? 'Sudah' : 'Belum', arsip_link: txt(r.linkArsip) || null,
    };
    const k = `${row.nomor_urut}/${row.tahun}`;
    if (!(row.nomor_urut > 0) || !(row.tahun >= 2000 && row.tahun <= 2100)) { warn.push(`BA dilewati (nomor/tahun tidak terbaca): ${JSON.stringify([r.nomorUrut, r.tahun])}`); continue; }
    if (seen.has(k)) { warn.push(`BA ganda ${k}: hanya yang pertama dipindahkan`); continue; }
    seen.add(k); baRows.push(row);
  }

  const put = async (table, rows, onConflict) => {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from(table).upsert(rows.slice(i, i + 200), { onConflict, ignoreDuplicates: true });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await put('bast_pegawai', pegRows, 'nip');
  await put('bast_ba', baRows, 'nomor_urut,tahun');
  await put('bast_setting', Object.entries(set).filter(([k]) => ['KASI_NAMA', 'KASI_NIP', 'NOMOR_AWAL_SURAT', 'KODE_KANTOR', 'KODE_KLASIFIKASI', 'NOMOR_FORMAT_TEMPLATE', 'ALAMAT_BIMAS_LENGKAP'].includes(k)).map(([key, value]) => ({ key, value: txt(value) })), 'key');

  // Nomor terakhir dihitung dari data BA (tahun terbaru, nomor terbesar) dan hanya dimajukan.
  const { data: cur } = await sb.from('bast_setting').select('key,value').in('key', ['LAST_NUMBER', 'LAST_NUMBER_YEAR']);
  const c = Object.fromEntries((cur ?? []).map((x) => [x.key, x.value]));
  const { data: top } = await sb.from('bast_ba').select('tahun,nomor_urut').order('tahun', { ascending: false }).order('nomor_urut', { ascending: false }).limit(1);
  if (top?.[0]) {
    const y = String(top[0].tahun), n = top[0].nomor_urut, cy = c.LAST_NUMBER_YEAR || '', cn = parseInt(c.LAST_NUMBER, 10) || 0;
    if (y > cy || (y === cy && n > cn)) await sb.from('bast_setting').upsert([{ key: 'LAST_NUMBER', value: String(n) }, { key: 'LAST_NUMBER_YEAR', value: y }]);
  }

  console.log(`Dibaca dari sistem lama: ${peg.length} pegawai, ${ba.length} Berita Acara, ${Object.keys(set).length} pengaturan.`);
  console.log(`Diproses ke Supabase  : ${pegRows.length} pegawai, ${baRows.length} Berita Acara (yang sudah ada dilewati).`);
  warn.forEach((w) => console.log('PERINGATAN: ' + w));
  console.log('\nArsip lama dicatat sebagai tautan Drive (dibuka dari Detail BA). Arsip baru diunggah lewat aplikasi.');
  console.log('PENTING: setelah data dipastikan lengkap, nonaktifkan deployment Apps Script lama (Deploy > Manage deployments > Archive).');
  console.log('URL Web App-nya terbuka untuk siapa pun yang tahu alamatnya, termasuk yang tertulis di config.js lama.');
}
