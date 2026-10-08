// Jalin: SATU Edge Function untuk semua pekerjaan yang harus berjalan di server
// (kunci rahasia tidak boleh ada di browser). Dipanggil dari index.html sebagai
//   <SUPABASE_URL>/functions/v1/bop?action=<aksi>     dengan header Authorization: Bearer <token login>
//
//   action=reset-password  POST JSON {user_id, password}       Admin mereset password operator
//   action=upload          POST multipart (tahun, bulan, files) Operator mengunggah LPJ ke Google Drive
//   action=delete          POST ?tahun&bulan&id                 Operator menghapus file LPJ (ke Sampah Drive)
//   action=list            GET  ?kua&tahun&bulan                Daftar dokumen LPJ
//   action=file            GET  ?kua&tahun&bulan&id             Isi dokumen (untuk pratinjau di website)
//   action=impor-lpj       POST JSON {kua, tahun, bulan, url, nama}
//                                                               Admin menyalin SATU file LPJ lama (Google Drive sistem lama)
//                                                               ke struktur folder baru (menu Impor Data Lama)
//   action=bast-upload     POST multipart (id, file)            Admin mengunggah/mengganti arsip Berita Acara BAST NR ke Google Drive
//   action=bast-file       GET  ?id                             Isi arsip BAST NR (pratinjau)
//   action=bast-delete     POST ?id                             Admin menghapus arsip BAST NR (ke Sampah Drive)
//
// Tanpa console.log/error sengaja (hemat kuota log Supabase); kesalahan dikembalikan ke klien sebagai JSON.
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_ROOT_FOLDER_ID
//   (dibuat oleh: node --env-file=.env bop.mjs drive). SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY disediakan otomatis.
// Deploy:  npx supabase functions deploy bop --no-verify-jwt   (fungsi memverifikasi token dan hak akses sendiri)
//
// STRUKTUR GOOGLE DRIVE. Semua file berada di bawah SATU folder master (DRIVE_ROOT_FOLDER_ID) yang otomatis diberi nama APP_NAME:
//   <APP_NAME> / BOP / LPJ / <tahun> / Kecamatan <nama> / <MM Bulan> - <nama file>
//   <APP_NAME> / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>
// Aturannya: master -> nama menu -> (jenis dokumen) -> tahun -> ... File LPJ satu KUA satu tahun berada dalam satu folder;
// bulannya dibedakan awalan nama file "MM Bulan - " (di Drive otomatis terurut menurut bulan).
// Catatan: scope drive.file hanya bisa mengakses folder buatan aplikasinya, jadi DRIVE_ROOT_FOLDER_ID harus folder yang
// dibuat 'node bop.mjs drive'. Bila memakai folder buatan sendiri, jalankan perintah itu dengan DRIVE_FOLDER_ID (scope drive).
import { createClient } from 'npm:@supabase/supabase-js@2';

// Nama aplikasi = nama folder master di Google Drive. Samakan dengan CFG.nama di index.html dan APP_NAME di bop.mjs.
const APP_NAME = 'Jalin';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const EXT: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const TYPES = Object.values(EXT);
const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47],
};
const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const MAX_LAMA = 20 * 1024 * 1024;   // batas file lama yang disalin (menjaga memori fungsi)
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
const awalan = (bulan: number) => `${String(bulan).padStart(2, '0')} ${BULAN[bulan - 1]} - `;
const validId = (v: unknown) => typeof v === 'string' && /^[\w-]{10,100}$/.test(v);
type Auth = { Authorization: string };

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

// ---- Admin mereset password operator -----------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
async function resetPassword(db: any, me: { role: string } | null, req: Request) {
  if (me?.role !== 'admin') return json({ error: 'Hanya admin yang boleh mereset password.' }, 403);
  let body: { user_id?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* body kosong */ }
  const { user_id, password } = body;
  if (!user_id || typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return json({ error: 'Data tidak valid: password harus 8–72 karakter.' }, 400);
  }
  // Target harus akun operator (admin mengganti passwordnya sendiri lewat Pengaturan)
  const { data: target } = await db.from('profiles').select('nama, role').eq('id', user_id).maybeSingle();
  if (!target) return json({ error: 'Akun tidak ditemukan.' }, 404);
  if (target.role !== 'operator') return json({ error: 'Hanya password operator yang dapat direset di sini.' }, 403);
  const { error } = await db.auth.admin.updateUserById(user_id, { password });
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, nama: target.nama });
}

// ---- Impor Data Lama: salin SATU file LPJ dari Google Drive sistem lama ke struktur folder baru (hanya admin) -------
// File lama dibagikan "siapa saja yang memiliki link", jadi dapat diunduh tanpa akses ke akun lama. Aman diulang: file yang
// sudah pernah disalin dikenali dari properti aplikasi (lama = ID file lama) dan tidak digandakan.
// deno-lint-ignore no-explicit-any
async function imporLpj(db: any, me: { role: string } | null, req: Request) {
  if (me?.role !== 'admin') return json({ error: 'Hanya admin yang boleh mengimpor dokumen.' }, 403);
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
  if (!got) {
    return json({ error: besar ? `File lama lebih dari ${MAX_LAMA / 1024 / 1024} MB, tidak disalin.`
      : 'File lama tidak dapat diunduh. Pastikan berbagi "Siapa saja yang memiliki link" di Google Drive lama masih aktif.' }, 502);
  }
  let n = clean(nama.trim() || 'LPJ').slice(-120);
  if (!/\.(pdf|jpe?g|png)$/i.test(n)) n += '.' + got.ext;
  const up = await driveUpload(auth, dir, awalan(bulan) + n, got.type, new Blob([got.bytes]), { lama: src });
  return json({ ok: true, id: up.id, folderUrl });
}

// ---- BAST NR: arsip dokumen tertandatangan (hanya admin) ---------------------------------------------------------
// Folder: <master> / BAST NR / <tahun> / <MM Bulan> / BAST KUA <KUA> - <nnn>-<tahun>.<ext>. Satu arsip per Berita Acara (unggah baru = ganti).
// deno-lint-ignore no-explicit-any
async function bastArsip(db: any, me: { role: string } | null, action: string, req: Request, url: URL) {
  if (me?.role !== 'admin') return json({ error: 'Hanya admin yang boleh mengelola arsip BAST NR.' }, 403);
  const form = action === 'bast-upload' ? await req.formData() : null;
  const id = Number(form ? form.get('id') : url.searchParams.get('id'));
  if (!Number.isInteger(id)) return json({ error: 'ID Berita Acara tidak valid.' }, 400);
  const { data: ba } = await db.from('bast_ba').select('nomor_urut, tahun, bln_srt, bln, pihak_kedua_nip, arsip_id').eq('id', id).maybeSingle();
  if (!ba) return json({ error: 'Berita Acara tidak ditemukan.' }, 404);
  const auth = { Authorization: `Bearer ${await googleToken()}` };

  if (action === 'bast-file') {
    if (!validId(ba.arsip_id)) return json({ error: 'Arsip belum ada.' }, 404);
    const meta = await (await fetch(`${API}/${ba.arsip_id}?fields=mimeType,trashed`, { headers: auth })).json();
    if (meta.trashed || !TYPES.includes(meta.mimeType)) return json({ error: 'Arsip tidak ditemukan di Google Drive.' }, 404);
    const r = await fetch(`${API}/${ba.arsip_id}?alt=media`, { headers: auth });
    if (!r.ok || !r.body) throw new Error('Gagal membaca arsip dari Google Drive.');
    return new Response(r.body, { headers: { ...cors, 'Content-Type': meta.mimeType, 'Cache-Control': 'private, max-age=300' } });
  }
  if (action === 'bast-delete') {   // dipindah ke Sampah Google Drive
    if (validId(ba.arsip_id)) await trash(auth, ba.arsip_id);
    await db.from('bast_ba').update({ arsip_id: null, arsip_link: null }).eq('id', id);
    return json({ ok: true });
  }

  const f = form!.get('file');
  if (!(f instanceof File)) return json({ error: 'Pilih satu file arsip.' }, 400);
  const { data: c } = await db.from('config').select('value').eq('key', 'max_file_size_mb').maybeSingle();
  const maxMb = Number(c?.value ?? 5), ext = (f.name.split('.').pop() ?? '').toLowerCase(), type = EXT[ext];
  if (!type) return json({ error: 'Hanya PDF, JPG, atau PNG.' }, 400);
  if (f.size > maxMb * 1024 * 1024) return json({ error: `Ukuran file melebihi ${maxMb} MB.` }, 400);
  const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  if (!MAGIC[type].every((b, i) => head[i] === b)) return json({ error: 'Isi file tidak sesuai ekstensinya.' }, 400);

  const mi = BULAN.findIndex((b) => String(ba.bln ?? '').toLowerCase().startsWith(b.toLowerCase()));
  const m = mi >= 0 ? mi + 1 : (ba.bln_srt >= 1 && ba.bln_srt <= 12 ? ba.bln_srt : 0);
  const parent = (await drivePath(auth, ['BAST NR', String(ba.tahun), m ? `${String(m).padStart(2, '0')} ${BULAN[m - 1]}` : 'Lainnya'], true))!;
  const { data: p } = await db.from('bast_pegawai').select('kua').eq('nip', ba.pihak_kedua_nip).maybeSingle();
  const name = `BAST KUA ${String(p?.kua || 'KUA').replace(/[\\/:*?"<>|]/g, '_')} - ${String(ba.nomor_urut).padStart(3, '0')}-${ba.tahun}.${ext}`;
  const up = await driveUpload(auth, parent, name, type, f);
  if (validId(ba.arsip_id)) await trash(auth, ba.arsip_id);   // arsip lama diganti (dipindah ke Sampah Drive)
  const link = up.webViewLink || `https://drive.google.com/file/d/${up.id}/view`;
  await db.from('bast_ba').update({ arsip_id: up.id, arsip_link: link }).eq('id', id);
  return json({ ok: true, fileId: up.id, link });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url), action = url.searchParams.get('action') ?? '';
    const POST = ['upload', 'delete', 'reset-password', 'impor-lpj', 'bast-upload', 'bast-delete'];
    if (![...POST, 'list', 'file', 'bast-file'].includes(action)) return json({ error: 'Aksi tidak dikenal.' }, 400);
    if (POST.includes(action) !== (req.method === 'POST')) return json({ error: 'Metode tidak didukung.' }, 405);
    const own = action === 'upload' || action === 'delete';   // mengubah dokumen: hanya operator, untuk KUA-nya sendiri

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Siapa pemanggilnya (token + profil dari database, bukan dari kiriman klien)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return json({ error: 'Sesi tidak valid. Silakan login ulang.' }, 401);
    const { data: me } = await db.from('profiles').select('role, kua_id').eq('id', user.id).maybeSingle();
    if (action === 'reset-password') return await resetPassword(db, me, req);
    if (action === 'impor-lpj') return await imporLpj(db, me, req);
    if (action.startsWith('bast-')) return await bastArsip(db, me, action, req, url);
    if (!me) return json({ error: 'Profil tidak ditemukan.' }, 403);

    // 2) Target dokumen. Upload: selalu KUA milik operator. List/file: admin bebas, operator hanya KUA sendiri.
    const form = action === 'upload' ? await req.formData() : null;
    const get = (k: string) => (form ? form.get(k) : url.searchParams.get(k));
    const tahun = Number(get('tahun')), bulan = Number(get('bulan'));
    if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100 || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
      return json({ error: 'Tahun atau bulan tidak valid.' }, 400);
    }
    const kuaId = own ? me.kua_id : Number(get('kua'));
    const boleh = own ? me.role === 'operator' && !!me.kua_id : me.role === 'admin' || (!!me.kua_id && me.kua_id === kuaId);
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