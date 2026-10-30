// BIMASATU: SATU Edge Function untuk semua pekerjaan yang harus berjalan di server
// (kunci rahasia tidak boleh ada di browser). Dipanggil dari index.html sebagai
//   <SUPABASE_URL>/functions/v1/bop?action=<aksi>     dengan header Authorization: Bearer <token login>
//
//   AKUN (khusus admin)
//   action=reset-password  POST JSON {user_id, password}       Mereset password akun peran APA PUN (kecuali akun sendiri)
//   action=buat-akun       POST JSON {email, nama, role, password, kua_id?}   Membuat akun baru (peran: lihat PERAN)
//   action=ubah-akun       POST JSON {user_id, nama?, role?, kua_id?}         Mengubah nama / peran / KUA akun
//
//   LPJ BOP (Google Drive)
//   action=upload          POST multipart (tahun, bulan, files) Operator KUA mengunggah LPJ ke Google Drive
//   action=delete          POST ?tahun&bulan&id                 Operator KUA menghapus file LPJ (ke Sampah Drive)
//   action=list            GET  ?kua&tahun&bulan                Daftar dokumen LPJ  (admin, peran bermenu Verifikasi, atau operator KUA itu sendiri)
//   action=file            GET  ?kua&tahun&bulan&id             Isi dokumen (untuk pratinjau di website)
//   action=impor-lpj       POST JSON {kua, tahun, bulan, url, nama}
//                                                               Admin menyalin SATU file LPJ lama (Google Drive sistem lama)
//                                                               ke struktur folder baru (menu Impor Data Lama)
//
//   ARSIP BAST NR (Google Drive; data BA-nya sendiri ada di Spreadsheet lewat Apps Script)
//   action=bast-upload     POST multipart (file, tahun, bulan, nomor, kua, ba?, ganti?, lama?)
//                                                               Menyimpan arsip BA ke folder master. ganti = id arsip lama yang dibuang
//                                                               setelah yang baru berhasil; lama = id file lama (migrasi, tidak digandakan)
//   action=bast-salin      POST JSON {url, tahun, bulan, nomor, kua, ba?}
//                                                               Migrasi arsip lama yang hanya punya tautan Google Drive (dibagikan "siapa saja
//                                                               yang memiliki link") ke folder master; aman diulang
//   action=bast-file       GET  ?id                             Isi arsip (pratinjau)
//   action=bast-hapus      POST ?id                             Arsip ke Sampah Drive
//   Yang boleh: admin, atau peran yang diberi menu Riwayat BAST (bast); unggah/baca juga boleh bagi menu Pengaturan BAST (bast-setting,
//   untuk migrasi arsip lama). Hapus hanya untuk menu bast.
//
// Hak akses dibaca dari database (tabel profiles dan hak_akses), bukan dari kiriman klien.
//
// Tanpa console.log/error sengaja (hemat kuota log Supabase); kesalahan dikembalikan ke klien sebagai JSON.
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_ROOT_FOLDER_ID
//   (dibuat oleh: node --env-file=.env bop.mjs drive). SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY disediakan otomatis.
// Deploy:  npx supabase functions deploy bop --no-verify-jwt   (fungsi memverifikasi token dan hak akses sendiri)
//
// STRUKTUR GOOGLE DRIVE. Semua file berada di bawah SATU folder master (DRIVE_ROOT_FOLDER_ID) yang otomatis diberi nama APP_NAME:
//   <APP_NAME> / BOP / LPJ / <tahun> / Kecamatan <nama> / <MM Bulan> - <nama file>
//   <APP_NAME> / BAST NR / <tahun> / <MM Bulan> / BAST KUA <nama KUA> - <nnn>-<tahun>.<ekstensi>
// Aturannya: master -> nama menu -> (jenis dokumen) -> tahun -> ... File LPJ satu KUA satu tahun berada dalam satu folder;
// bulannya dibedakan awalan nama file "MM Bulan - " (di Drive otomatis terurut menurut bulan).
// Catatan: scope drive.file hanya bisa mengakses folder buatan aplikasinya, jadi DRIVE_ROOT_FOLDER_ID harus folder yang
// dibuat 'node bop.mjs drive'. Bila memakai folder buatan sendiri, jalankan perintah itu dengan DRIVE_FOLDER_ID (scope drive).
// Karena itu SEMUA pekerjaan Drive (LPJ dan arsip BAST NR) dilakukan di sini, memakai akun Google yang sama; Apps Script
// tidak lagi menyentuh Drive untuk arsip baru (akunnya berbeda dan ditolak Google dengan HTTP 403).
import { createClient } from 'npm:@supabase/supabase-js@2';

// Nama aplikasi = nama folder master di Google Drive. Samakan dengan CFG.nama di js/config.js dan APP_NAME di bop.mjs.
const APP_NAME = 'BIMASATU';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Peran akun. Daftar yang sama ada di bop.sql (check profiles.role, handle_new_user, set_hak_akses) dan js/akses.js.
const PERAN = ['admin', 'operator', 'bendahara_bop', 'verifikator_bop', 'bast_nr', 'kemasjidan', 'pnbp_nr'];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const EXT: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const TYPES = Object.values(EXT);
const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47],
};
const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const MAX_LAMA = 20 * 1024 * 1024;   // batas file lama yang disalin (menjaga memori fungsi)
const MAX_BAST = 5 * 1024 * 1024;    // batas satu arsip BAST NR (sama dengan tampilan di js/bast.js)
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
const awalan = (bulan: number) => `${String(bulan).padStart(2, '0')} ${BULAN[bulan - 1]} - `;
const validId = (v: unknown) => typeof v === 'string' && /^[\w-]{10,100}$/.test(v);
type Auth = { Authorization: string };
type Me = { id: string; nama: string; role: string; kua_id: number | null };
type Hak = (menu: string) => boolean;

async function googleToken(): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) { throw new Error('Gagal terhubung ke Google Drive. Hubungi admin.'); }
  return j.access_token;
}

// ---- Hak akses menu ----------------------------------------------------------------------------------------------------
// Admin selalu boleh. Peran lain: menu yang dicentang di tabel hak_akses (aturan yang sama dengan can_menu() di database).
// deno-lint-ignore no-explicit-any
async function hakMenu(db: any, me: Me): Promise<Hak> {
  if (me.role === 'admin') return () => true;
  const { data, error } = await db.from('hak_akses').select('menu').eq('role', me.role);
  if (error) throw new Error('Tabel hak_akses belum ada atau tidak terbaca. Jalankan bop.sql versi terbaru di SQL Editor Supabase.');
  const ada = new Set((data ?? []).map((r: { menu: string }) => r.menu));
  return (menu: string) => ada.has(menu);
}

// ---- Google Drive: pembantu bersama ---------------------------------------------------------------------------------
// Folder master diberi nama APP_NAME (sekali per instance; kosmetik saja, kegagalannya tidak mengganggu pekerjaan).
let masterBernama = false;
async function masterFolder(auth: Auth): Promise<string> {
  const id = Deno.env.get('DRIVE_ROOT_FOLDER_ID')!;
  if (!masterBernama) {
    masterBernama = true;
    try {
      const m = await (await fetch(`${API}/${id}?fields=name`, { headers: auth })).json();
      if (m.name && m.name !== APP_NAME) {
        await fetch(`${API}/${id}`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: APP_NAME }) });
      }
    } catch { /* abaikan */ }
  }
  return id;
}

// deno-lint-ignore no-explicit-any
async function driveList(auth: Auth, q: string, fields: string, extra: Record<string, string> = {}): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  let token = '';
  do {
    const p = new URLSearchParams({ q, fields: `nextPageToken,${fields}`, pageSize: '200', ...extra });
    if (token) p.set('pageToken', token);
    const j = await (await fetch(`${API}?${p}`, { headers: auth })).json();
    out.push(...(j.files ?? []));
    token = j.nextPageToken ?? '';
  } while (token);
  return out;
}

// Folder bertingkat di bawah master; dicari, dan dibuat bila create = true
async function drivePath(auth: Auth, names: string[], create: boolean): Promise<string | null> {
  let parent = await masterFolder(auth);
  for (const name of names) {
    let id: string | undefined = (await driveList(auth, `name='${esc(name)}' and '${parent}' in parents and mimeType='${FOLDER}' and trashed=false`, 'files(id)'))[0]?.id;
    if (!id) {
      if (!create) return null;
      id = (await (await fetch(`${API}?fields=id`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
      })).json()).id;
      if (!id) throw new Error('Gagal membuat folder di Google Drive. Pastikan DRIVE_ROOT_FOLDER_ID benar.');
    }
    parent = id;
  }
  return parent;
}

const lpjFolder = (auth: Auth, tahun: number, kecamatan: string, create: boolean) =>
  drivePath(auth, ['BOP', 'LPJ', String(tahun), clean(`Kecamatan ${kecamatan}`)], create);

async function driveUpload(auth: Auth, parent: string, name: string, type: string, data: Blob, props?: Record<string, string>) {
  const b = 'jln' + crypto.randomUUID();
  const meta = JSON.stringify({ name, parents: [parent], ...(props ? { appProperties: props } : {}) });
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`, data, `\r\n--${b}--`]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST', headers: { ...auth, 'Content-Type': `multipart/related; boundary=${b}` }, body,
  });
  const up = await r.json().catch(() => ({}));
  if (!r.ok || !up.id) throw new Error(`Gagal mengunggah ${name} ke Google Drive.`);
  return up as { id: string; webViewLink?: string };
}

const trash = (auth: Auth, fid: string) =>
  fetch(`${API}/${fid}`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });

function sniff(b: Uint8Array): { type: string; ext: string } | null {
  for (const [ext, type] of [['pdf', 'application/pdf'], ['jpg', 'image/jpeg'], ['png', 'image/png']] as const) {
    if (MAGIC[type].every((x, i) => b[i] === x)) return { type, ext };
  }
  return null;
}

// ---- Akun (hanya admin) ------------------------------------------------------------------------------------------------
// Pesan galat Supabase Auth dalam bahasa Indonesia; yang tidak dikenal diteruskan apa adanya.
function pesanAuth(e: { code?: string; message?: string }): string {
  const c = e.code ?? '', m = e.message ?? '';
  if (c === 'weak_password') return 'Password terlalu lemah. Tambahkan huruf besar, angka, atau simbol.';
  if (c === 'same_password') return 'Password baru tidak boleh sama dengan password lama.';
  if (c === 'email_exists' || c === 'user_already_exists' || /already (been )?registered/i.test(m)) return 'Username atau email itu sudah dipakai akun lain.';
  if (c === 'email_address_invalid' || /invalid.*email/i.test(m)) return 'Alamat email/username tidak valid.';
  return m || 'Permintaan ditolak oleh server login.';
}

async function bacaJson<T>(req: Request): Promise<T> {
  try { return await req.json() as T; } catch { return {} as T; }
}

// Admin mereset password akun peran apa pun. Password akun sendiri diganti lewat menu Pengaturan.
// deno-lint-ignore no-explicit-any
async function resetPassword(db: any, me: Me, req: Request) {
  if (me.role !== 'admin') return json({ error: 'Hanya admin yang boleh mereset password.' }, 403);
  const { user_id, password } = await bacaJson<{ user_id?: string; password?: string }>(req);
  if (!user_id || typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return json({ error: 'Data tidak valid: password harus 8–72 karakter.' }, 400);
  }
  if (user_id === me.id) return json({ error: 'Password akun Anda sendiri diubah lewat menu Pengaturan.' }, 400);
  const { data: target } = await db.from('profiles').select('nama, role').eq('id', user_id).maybeSingle();
  if (!target) return json({ error: 'Akun tidak ditemukan.' }, 404);
  const { error } = await db.auth.admin.updateUserById(user_id, { password });
  if (error) return json({ error: pesanAuth(error) }, 400);
  return json({ ok: true, nama: target.nama });
}

// Data KUA untuk akun Operator KUA (harus ada dan aktif); kembalian null bila tidak sah.
// deno-lint-ignore no-explicit-any
async function kuaOperator(db: any, kuaId: unknown): Promise<{ id: number; nama_kua: string } | null> {
  const id = Number(kuaId);
  if (!Number.isInteger(id)) return null;
  const { data } = await db.from('kua').select('id, nama_kua, status').eq('id', id).maybeSingle();
  return data && data.status === 'aktif' ? { id: data.id, nama_kua: data.nama_kua } : null;
}

// deno-lint-ignore no-explicit-any
async function buatAkun(db: any, me: Me, req: Request) {
  if (me.role !== 'admin') return json({ error: 'Hanya admin yang boleh membuat akun.' }, 403);
  const b = await bacaJson<{ email?: unknown; nama?: unknown; password?: unknown; role?: unknown; kua_id?: unknown }>(req);
  const email = String(b.email ?? '').trim().toLowerCase(), nama = String(b.nama ?? '').trim(), role = String(b.role ?? '');
  const password = typeof b.password === 'string' ? b.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Username/email tidak valid.' }, 400);
  if (!nama || nama.length > 100) return json({ error: 'Nama wajib diisi (maksimal 100 karakter).' }, 400);
  if (!PERAN.includes(role)) return json({ error: 'Peran tidak dikenal.' }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: 'Password harus 8–72 karakter.' }, 400);
  const kua = role === 'operator' ? await kuaOperator(db, b.kua_id) : null;
  if (role === 'operator' && !kua) return json({ error: 'Pilih KUA yang aktif untuk akun Operator KUA.' }, 400);

  // Profil dibuat otomatis oleh trigger handle_new_user() dari user_metadata (peran, nama, KUA).
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nama, role, ...(kua ? { kua: kua.nama_kua } : {}) },
  });
  if (error || !data?.user) return json({ error: pesanAuth(error ?? {}) }, 400);

  // Pastikan profilnya sesuai. Bila tidak (bop.sql lama belum diperbarui), akun dibatalkan agar tidak salah peran.
  const { data: prof } = await db.from('profiles').select('role, kua_id').eq('id', data.user.id).maybeSingle();
  if (!prof || prof.role !== role || (kua && prof.kua_id !== kua.id)) {
    await db.auth.admin.deleteUser(data.user.id);
    return json({ error: 'Profil akun tidak terbentuk sesuai peran. Jalankan bop.sql versi terbaru di SQL Editor Supabase, lalu coba lagi.' }, 500);
  }
  return json({ ok: true, id: data.user.id });
}

// Mengubah nama, peran, dan KUA. Peran akun sendiri tidak dapat diubah; admin terakhir dijaga trigger di database.
// deno-lint-ignore no-explicit-any
async function ubahAkun(db: any, me: Me, req: Request) {
  if (me.role !== 'admin') return json({ error: 'Hanya admin yang boleh mengubah akun.' }, 403);
  const b = await bacaJson<{ user_id?: unknown; nama?: unknown; role?: unknown; kua_id?: unknown }>(req);
  const id = String(b.user_id ?? ''), nama = String(b.nama ?? '').trim(), role = String(b.role ?? '');
  if (!id || !nama || nama.length > 100 || !PERAN.includes(role)) return json({ error: 'Data tidak valid: nama dan peran wajib diisi.' }, 400);
  const { data: target } = await db.from('profiles').select('role').eq('id', id).maybeSingle();
  if (!target) return json({ error: 'Akun tidak ditemukan.' }, 404);
  if (id === me.id && role !== target.role) return json({ error: 'Peran akun Anda sendiri tidak dapat diubah.' }, 400);
  const kua = role === 'operator' ? await kuaOperator(db, b.kua_id) : null;
  if (role === 'operator' && !kua) return json({ error: 'Pilih KUA yang aktif untuk akun Operator KUA.' }, 400);
  const { error } = await db.from('profiles').update({ nama, role, kua: kua?.nama_kua ?? null, kua_id: kua?.id ?? null }).eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}

// Mengunduh SATU file dari Google Drive lama lewat tautan unduhan publik ("siapa saja yang memiliki link"), mengikuti pengalihan.
// Dipakai impor LPJ lama dan migrasi arsip BAST NR lama. Hanya PDF/JPG/PNG (dikenali dari byte awal) yang diterima.
async function unduhPublik(src: string, rk?: string): Promise<{ got: { bytes: Uint8Array; type: string; ext: string } | null; besar: boolean }> {
  const q = rk ? `&resourcekey=${encodeURIComponent(rk)}` : '';
  let got: { bytes: Uint8Array; type: string; ext: string } | null = null, besar = false;
  for (const u of [
    `https://drive.usercontent.google.com/download?id=${src}&export=download&confirm=t${q}`,
    `https://drive.google.com/uc?export=download&id=${src}${q}`,
  ]) {
    try {
      const r = await fetch(u, { redirect: 'follow' });
      if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      const t = sniff(bytes);
      if (!t) continue;
      if (bytes.length > MAX_LAMA) { besar = true; continue; }
      got = { bytes, ...t }; break;
    } catch { /* coba tautan berikutnya */ }
  }
  return { got, besar };
}

// ---- Impor Data Lama: salin SATU file LPJ dari Google Drive sistem lama ke struktur folder baru (hanya admin) -------
// File lama dibagikan "siapa saja yang memiliki link", jadi dapat diunduh tanpa akses ke akun lama. Aman diulang: file yang
// sudah pernah disalin dikenali dari properti aplikasi (lama = ID file lama) dan tidak digandakan.
// deno-lint-ignore no-explicit-any
async function imporLpj(db: any, me: Me, req: Request) {
  if (me.role !== 'admin') return json({ error: 'Hanya admin yang boleh mengimpor dokumen.' }, 403);
  let b: { kua?: unknown; tahun?: unknown; bulan?: unknown; url?: unknown; nama?: unknown } = {};
  try { b = await req.json(); } catch { /* body kosong */ }
  const kuaId = Number(b.kua), tahun = Number(b.tahun), bulan = Number(b.bulan), url = String(b.url ?? ''), nama = String(b.nama ?? '');
  if (!Number.isInteger(kuaId) || !Number.isInteger(tahun) || tahun < 2020 || tahun > 2100 || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    return json({ error: 'KUA, tahun, atau bulan tidak valid.' }, 400);
  }
  const m = url.match(/\/d\/([\w-]{10,100})/) ?? url.match(/[?&]id=([\w-]{10,100})/);
  if (!m) return json({ error: 'Tautan file lama tidak dikenali.' }, 400);
  const src = m[1], rk = url.match(/[?&]resourcekey=([\w-]+)/i)?.[1];
  const { data: kua } = await db.from('kua').select('kecamatan').eq('id', kuaId).maybeSingle();
  if (!kua) return json({ error: 'KUA tidak ditemukan.' }, 404);

  const auth = { Authorization: `Bearer ${await googleToken()}` };
  const dir = (await lpjFolder(auth, tahun, kua.kecamatan, true))!;
  const folderUrl = `https://drive.google.com/drive/folders/${dir}`;
  if ((await driveList(auth, `appProperties has { key='lama' and value='${src}' } and '${dir}' in parents and trashed=false`, 'files(id)')).length) {
    return json({ ok: true, ada: true, folderUrl });
  }

  // Unduh: tautan unduhan publik Google Drive (mengikuti pengalihan). Isi dicek dari byte awal, bukan dari ekstensi,
  // sehingga halaman HTML (akses ditolak/halaman peringatan) tidak pernah tersimpan sebagai LPJ.
  const { got, besar } = await unduhPublik(src, rk);
  if (!got) {
    return json({ error: besar ? `File lama lebih dari ${MAX_LAMA / 1024 / 1024} MB, tidak disalin.`
      : 'File lama tidak dapat diunduh. Pastikan berbagi "Siapa saja yang memiliki link" di Google Drive lama masih aktif.' }, 502);
  }
  let n = clean(nama.trim() || 'LPJ').slice(-120);
  if (!/\.(pdf|jpe?g|png)$/i.test(n)) n += '.' + got.ext;
  const up = await driveUpload(auth, dir, awalan(bulan) + n, got.type, new Blob([got.bytes as BlobPart]), { lama: src });
  return json({ ok: true, id: up.id, folderUrl });
}

// ---- Arsip BAST NR: <master> / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext> -----------------
const linkFile = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Arsip hanya boleh disentuh bila benar berada di bawah <master>/BAST NR: id file LPJ atau file lain yang dikirim ke aksi BAST ditolak.
async function arsipBast(auth: Auth, id: string): Promise<{ name: string; mimeType: string } | null> {
  const root = await drivePath(auth, ['BAST NR'], false);
  if (!root) return null;
  const m = await (await fetch(`${API}/${id}?fields=name,mimeType,parents,trashed`, { headers: auth })).json();
  if (!m || m.trashed || !m.name || !m.mimeType) return null;
  let induk: string | undefined = m.parents?.[0];
  for (let i = 0; i < 4 && induk; i++) {   // arsip -> bulan -> tahun -> BAST NR
    if (induk === root) return { name: m.name, mimeType: m.mimeType };
    induk = (await (await fetch(`${API}/${induk}?fields=parents`, { headers: auth })).json()).parents?.[0];
  }
  return null;
}

// Keterangan Berita Acara yang menentukan folder dan nama file arsip (dikirim halaman dari data BA; hanya dipakai untuk menamai).
type TargetBast = { tahun: number; bulan: number; nomor: number; kua: string; ba: string };
function targetBast(v: { tahun: unknown; bulan: unknown; nomor: unknown; kua: unknown; ba: unknown }): TargetBast | string {
  const tahun = Number(v.tahun), bulan = Number(v.bulan), nomor = Number(v.nomor);
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) return 'Tahun tidak valid.';
  if (!Number.isInteger(bulan) || bulan < 0 || bulan > 12) return 'Bulan tidak valid.';   // 0 = bulan tidak dikenal (folder "Lainnya")
  if (!Number.isInteger(nomor) || nomor < 1 || nomor > 99999) return 'Nomor urut tidak valid.';
  return { tahun, bulan, nomor, kua: String(v.kua ?? '').trim().slice(0, 80) || 'KUA', ba: String(v.ba ?? '').replace(/\D/g, '').slice(0, 12) };
}

// Simpan satu arsip ke folder master. lama = id file lama (migrasi): bila sudah pernah disalin, dikembalikan apa adanya (tidak digandakan).
// ganti = id arsip sebelumnya di folder master yang dibuang ke Sampah setelah yang baru berhasil tersimpan.
async function simpanArsipBast(auth: Auth, t: TargetBast, data: Blob, type: string, ext: string, ganti: string, lama: string) {
  if (lama) {
    const sudah = (await driveList(auth, `appProperties has { key='bastlama' and value='${lama}' } and trashed=false`, 'files(id,webViewLink)'))[0];
    if (sudah && await arsipBast(auth, sudah.id)) return json({ ok: true, ada: true, id: sudah.id, link: sudah.webViewLink ?? linkFile(sudah.id) });
  }
  const dir = (await drivePath(auth, ['BAST NR', String(t.tahun), t.bulan ? `${String(t.bulan).padStart(2, '0')} ${BULAN[t.bulan - 1]}` : 'Lainnya'], true))!;
  const nama = `BAST KUA ${clean(t.kua)} - ${String(t.nomor).padStart(3, '0')}-${t.tahun}.${ext}`;
  const up = await driveUpload(auth, dir, nama, type, data, { bast: t.ba || '1', ...(lama ? { bastlama: lama } : {}) });
  if (ganti && ganti !== up.id && await arsipBast(auth, ganti)) { try { await trash(auth, ganti); } catch { /* arsip lama gagal dibuang: tidak menghalangi */ } }
  return json({ ok: true, id: up.id, link: up.webViewLink ?? linkFile(up.id) });
}

// Unggah dari halaman (Riwayat BAST: arsip baru atau pengganti) dan migrasi arsip lama yang isinya sudah dibaca halaman lewat Apps Script.
async function bastUpload(req: Request) {
  const form = await req.formData();
  const t = targetBast({ tahun: form.get('tahun'), bulan: form.get('bulan'), nomor: form.get('nomor'), kua: form.get('kua'), ba: form.get('ba') });
  if (typeof t === 'string') return json({ error: t }, 400);
  const ganti = String(form.get('ganti') ?? ''), lama = String(form.get('lama') ?? '');
  if ((ganti && !validId(ganti)) || (lama && !validId(lama))) return json({ error: 'ID arsip tidak valid.' }, 400);

  const f = form.get('file');
  if (!(f instanceof File)) return json({ error: 'Pilih satu file arsip.' }, 400);
  const ext = (f.name.split('.').pop() ?? '').toLowerCase(), type = EXT[ext];
  if (!type) return json({ error: 'Hanya PDF, JPG, atau PNG.' }, 400);
  if (f.size > MAX_BAST) return json({ error: `Ukuran file melebihi ${MAX_BAST / 1024 / 1024} MB.` }, 400);
  const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  if (!MAGIC[type].every((x, i) => head[i] === x)) return json({ error: 'Isi file tidak sesuai ekstensinya.' }, 400);

  return await simpanArsipBast({ Authorization: `Bearer ${await googleToken()}` }, t, f, type, ext, ganti, lama);
}

// Migrasi arsip lama yang HANYA punya tautan Google Drive (tanpa id yang dapat dibaca Apps Script): disalin dari tautan unduhan publik
// ("siapa saja yang memiliki link") ke folder master. Aman diulang (lama = id file di tautan itu).
async function bastSalin(req: Request) {
  const b = await bacaJson<{ url?: unknown; tahun?: unknown; bulan?: unknown; nomor?: unknown; kua?: unknown; ba?: unknown }>(req);
  const t = targetBast({ tahun: b.tahun, bulan: b.bulan, nomor: b.nomor, kua: b.kua, ba: b.ba });
  if (typeof t === 'string') return json({ error: t }, 400);
  const url = String(b.url ?? '');
  const m = url.match(/\/d\/([\w-]{10,100})/) ?? url.match(/[?&]id=([\w-]{10,100})/);
  if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url) || !m) return json({ error: 'Tautan arsip lama tidak dikenali (harus tautan Google Drive).' }, 400);
  const src = m[1], rk = url.match(/[?&]resourcekey=([\w-]+)/i)?.[1];

  const auth = { Authorization: `Bearer ${await googleToken()}` };
  const { got, besar } = await unduhPublik(src, rk);
  if (!got) {
    return json({ error: besar ? `Arsip lama lebih dari ${MAX_LAMA / 1024 / 1024} MB, tidak disalin.`
      : 'Arsip lama tidak dapat diunduh (tautan tidak dibagikan "Siapa saja yang memiliki link" atau file sudah dihapus). Unggah ulang arsipnya dari Riwayat BAST.' }, 502);
  }
  return await simpanArsipBast(auth, t, new Blob([got.bytes as BlobPart]), got.type, got.ext, '', src);
}

async function bastFile(url: URL) {
  const id = url.searchParams.get('id') ?? '';
  if (!validId(id)) return json({ error: 'ID file tidak valid.' }, 400);
  const auth = { Authorization: `Bearer ${await googleToken()}` };
  const meta = await arsipBast(auth, id);
  if (!meta || !TYPES.includes(meta.mimeType)) return json({ error: 'Arsip tidak ditemukan di folder master Google Drive.' }, 404);
  const r = await fetch(`${API}/${id}?alt=media`, { headers: auth });
  if (!r.ok || !r.body) throw new Error('Gagal membaca arsip dari Google Drive.');
  return new Response(r.body, { headers: { ...cors, 'Content-Type': meta.mimeType, 'Cache-Control': 'private, max-age=300' } });
}

async function bastHapus(url: URL) {
  const id = url.searchParams.get('id') ?? '';
  if (!validId(id)) return json({ error: 'ID file tidak valid.' }, 400);
  const auth = { Authorization: `Bearer ${await googleToken()}` };
  if (!await arsipBast(auth, id)) return json({ error: 'Arsip tidak ditemukan di folder master Google Drive.' }, 404);
  const r = await trash(auth, id);   // ke Sampah Google Drive (masih bisa dipulihkan pemilik folder)
  if (!r.ok) throw new Error('Gagal menghapus arsip di Google Drive.');
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url), action = url.searchParams.get('action') ?? '';
    const POST = ['upload', 'delete', 'reset-password', 'buat-akun', 'ubah-akun', 'impor-lpj', 'bast-upload', 'bast-salin', 'bast-hapus'];
    if (![...POST, 'list', 'file', 'bast-file'].includes(action)) return json({ error: 'Aksi tidak dikenal.' }, 400);
    if (POST.includes(action) !== (req.method === 'POST')) return json({ error: 'Metode tidak didukung.' }, 405);
    const own = action === 'upload' || action === 'delete';   // mengubah dokumen LPJ: hanya Operator KUA, untuk KUA-nya sendiri

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Siapa pemanggilnya (token + profil dari database, bukan dari kiriman klien)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return json({ error: 'Sesi tidak valid. Silakan login ulang.' }, 401);
    const { data: prof } = await db.from('profiles').select('nama, role, kua_id').eq('id', user.id).maybeSingle();
    if (!prof) return json({ error: 'Profil tidak ditemukan.' }, 403);
    const me: Me = { id: user.id, nama: prof.nama, role: prof.role, kua_id: prof.kua_id };

    if (action === 'reset-password') return await resetPassword(db, me, req);
    if (action === 'buat-akun') return await buatAkun(db, me, req);
    if (action === 'ubah-akun') return await ubahAkun(db, me, req);
    if (action === 'impor-lpj') return await imporLpj(db, me, req);

    const bisa = await hakMenu(db, me);
    if (action.startsWith('bast-')) {   // arsip BAST NR: menu Riwayat BAST (bast) atau Pengaturan BAST (bast-setting, untuk migrasi arsip lama)
      if (!(action === 'bast-hapus' ? bisa('bast') : bisa('bast') || bisa('bast-setting'))) return json({ error: 'Anda tidak berhak mengakses arsip BAST NR.' }, 403);
      if (action === 'bast-upload') return await bastUpload(req);
      if (action === 'bast-salin') return await bastSalin(req);
      if (action === 'bast-file') return await bastFile(url);
      return await bastHapus(url);
    }

    // 2) Target dokumen LPJ. Upload/hapus: selalu KUA milik Operator KUA. List/file: peran bermenu verifikasi bebas, Operator KUA hanya KUA sendiri.
    const form = action === 'upload' ? await req.formData() : null;
    const get = (k: string) => (form ? form.get(k) : url.searchParams.get(k));
    const tahun = Number(get('tahun')), bulan = Number(get('bulan'));
    if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100 || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
      return json({ error: 'Tahun atau bulan tidak valid.' }, 400);
    }
    const kuaId = own ? me.kua_id : Number(get('kua'));
    const operatorKuaSendiri = me.role === 'operator' && !!me.kua_id && bisa('realisasi');
    const boleh = own ? operatorKuaSendiri : bisa('verifikasi') || (operatorKuaSendiri && me.kua_id === kuaId);
    if (!boleh) return json({ error: 'Anda tidak berhak mengakses dokumen ini.' }, 403);
    const { data: kua } = await db.from('kua').select('kecamatan').eq('id', kuaId).maybeSingle();
    if (!kua) return json({ error: 'KUA tidak ditemukan.' }, 404);

    // 3) Drive: <master> / BOP / LPJ / <tahun> / Kecamatan <nama>; bulan = awalan nama file (dibuat bila upload)
    const auth = { Authorization: `Bearer ${await googleToken()}` };
    const folder = (create: boolean) => lpjFolder(auth, tahun, kua.kecamatan, create);
    const awal = awalan(bulan);
    const isiBulan = async (dir: string, fields: string) =>
      (await driveList(auth, `'${dir}' in parents and trashed=false`, fields, { orderBy: 'createdTime' }))
        .filter((x: { name: string }) => x.name.startsWith(awal));

    if (action === 'list') {
      const f = await folder(false);
      const files = f ? (await isiBulan(f, 'files(id,name,mimeType,size)'))
        .filter((x: { mimeType: string }) => TYPES.includes(x.mimeType))
        .map((x: { name: string }) => ({ ...x, name: x.name.slice(awal.length) })) : [];
      return json({ files });
    }

    if (action === 'file') {
      const id = url.searchParams.get('id') ?? '';
      if (!validId(id)) return json({ error: 'ID file tidak valid.' }, 400);
      const f = await folder(false);
      const meta = await (await fetch(`${API}/${id}?fields=name,mimeType,parents,trashed`, { headers: auth })).json();
      if (!f || meta.trashed || !meta.parents?.includes(f) || !String(meta.name).startsWith(awal) || !TYPES.includes(meta.mimeType)) {
        return json({ error: 'Dokumen tidak ditemukan.' }, 404);
      }
      const r = await fetch(`${API}/${id}?alt=media`, { headers: auth });
      if (!r.ok || !r.body) throw new Error('Gagal membaca dokumen dari Google Drive.');
      return new Response(r.body, { headers: { ...cors, 'Content-Type': meta.mimeType, 'Cache-Control': 'private, max-age=300' } });
    }

    // 4) Unggah/hapus dokumen: hanya bila Realisasi bulan itu belum dikirim atau berstatus Ditolak (rejected)
    const { data: rec } = await db.from('realisasi').select('status').eq('kua_id', kuaId).eq('tahun', tahun).eq('bulan', bulan).maybeSingle();
    if (rec && rec.status !== 'rejected') return json({ error: 'Dokumen LPJ hanya dapat diubah saat Realisasi berstatus Ditolak (atau belum dikirim).' }, 403);

    if (action === 'delete') {   // dipindah ke Sampah Google Drive (masih bisa dipulihkan pemilik folder)
      const id = url.searchParams.get('id') ?? '';
      if (!validId(id)) return json({ error: 'ID file tidak valid.' }, 400);
      const f = await folder(false);
      const meta = await (await fetch(`${API}/${id}?fields=name,parents,trashed`, { headers: auth })).json();
      // hanya file bulan ini: operator tidak dapat menghapus dokumen bulan lain yang berada di folder yang sama
      if (!f || meta.trashed || !meta.parents?.includes(f) || !String(meta.name).startsWith(awal)) return json({ error: 'Dokumen tidak ditemukan.' }, 404);
      const r = await trash(auth, id);
      if (!r.ok) throw new Error('Gagal menghapus dokumen di Google Drive.');
      return json({ ok: true, remaining: (await isiBulan(f, 'files(id,name)')).filter((x: { id: string }) => x.id !== id).length });
    }

    // 5) Upload: aturan yang sama dengan form (dijaga ulang di server)
    const { data: rows } = await db.from('config').select('key, value').in('key', ['realisasi_enabled', 'max_file_size_mb', 'max_file_count']);
    const cfg = Object.fromEntries((rows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
    if (cfg.realisasi_enabled !== true) return json({ error: 'Pengisian Realisasi sedang ditutup oleh admin.' }, 403);
    const wib = new Date(Date.now() + 7 * 3600 * 1000);
    if (Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) < Date.UTC(tahun, bulan - 1, 10)) {
      return json({ error: `Realisasi ${BULAN[bulan - 1]} ${tahun} baru dapat disubmit mulai tanggal 10.` }, 403);
    }

    const maxMb = Number(cfg.max_file_size_mb ?? 5), maxN = Number(cfg.max_file_count ?? 3);
    const files = form!.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) return json({ error: 'Pilih minimal satu file.' }, 400);
    const items: { f: File; type: string }[] = [];
    for (const f of files) {
      const type = EXT[(f.name.split('.').pop() ?? '').toLowerCase()];
      if (!type) return json({ error: `${f.name}: hanya PDF, JPG, atau PNG.` }, 400);
      if (f.size > maxMb * 1024 * 1024) return json({ error: `${f.name}: ukuran melebihi ${maxMb} MB.` }, 400);
      const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (!MAGIC[type].every((b, i) => head[i] === b)) return json({ error: `${f.name}: isi file tidak sesuai ekstensinya.` }, 400);
      items.push({ f, type });
    }

    const dir = (await folder(true))!;
    const ada = (await isiBulan(dir, 'files(id,name)')).length;
    if (ada + items.length > maxN) return json({ error: `Maksimal ${maxN} file per bulan. Sudah ada ${ada} file, Anda mengunggah ${items.length}.` }, 400);
    for (const { f, type } of items) await driveUpload(auth, dir, awal + clean(f.name).slice(-120), type, f);
    return json({ ok: true, folderUrl: `https://drive.google.com/drive/folders/${dir}`, total: ada + items.length });
  } catch (e) {
    return json({ error: (e as Error).message || 'Terjadi kesalahan di server.' }, 500);
  }
});
