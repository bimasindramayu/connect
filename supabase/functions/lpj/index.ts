// LPJ di Google Drive: unggah, daftar file, dan baca file (untuk pratinjau di website).
// Berjalan di server Supabase, jadi secret Google tidak pernah ada di frontend/GitHub.
//
// Secrets (sama seperti sebelumnya): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_ROOT_FOLDER_ID
// Deploy:  npx supabase functions deploy lpj --no-verify-jwt   (fungsi memverifikasi token & hak akses sendiri)
//
// Semua file masuk ke DRIVE_ROOT_FOLDER_ID dengan struktur:
//   <root> / <tahun> / <nama KUA> / Realisasi / <MM Bulan> / <file>
// Catatan: scope drive.file hanya bisa mengakses folder buatan aplikasinya. DRIVE_ROOT_FOLDER_ID harus folder yang
// dibuat setup-drive.mjs. Bila memakai folder buatan sendiri, buat ulang refresh token dengan scope .../auth/drive.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function googleToken(): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) { console.error('token Google gagal', j); throw new Error('Gagal terhubung ke Google Drive. Hubungi admin.'); }
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url), action = url.searchParams.get('action');
    if (!['upload', 'list', 'file'].includes(action ?? '')) return json({ error: 'Aksi tidak dikenal.' }, 400);
    if ((action === 'upload') !== (req.method === 'POST')) return json({ error: 'Metode tidak didukung.' }, 405);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Siapa pemanggilnya (token + profil dari database, bukan dari kiriman klien)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return json({ error: 'Sesi tidak valid. Silakan login ulang.' }, 401);
    const { data: me } = await db.from('profiles').select('role, kua_id').eq('id', user.id).maybeSingle();
    if (!me) return json({ error: 'Profil tidak ditemukan.' }, 403);

    // 2) Target dokumen. Upload: selalu KUA milik operator. List/file: admin bebas, operator hanya KUA sendiri.
    const form = action === 'upload' ? await req.formData() : null;
    const get = (k: string) => (form ? form.get(k) : url.searchParams.get(k));
    const tahun = Number(get('tahun')), bulan = Number(get('bulan'));
    if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100 || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
      return json({ error: 'Tahun atau bulan tidak valid.' }, 400);
    }
    const kuaId = action === 'upload' ? me.kua_id : Number(get('kua'));
    const boleh = action === 'upload' ? me.role === 'operator' && !!me.kua_id : me.role === 'admin' || (!!me.kua_id && me.kua_id === kuaId);
    if (!boleh) return json({ error: 'Anda tidak berhak mengakses dokumen ini.' }, 403);
    const { data: kua } = await db.from('kua').select('nama_kua').eq('id', kuaId).maybeSingle();
    if (!kua) return json({ error: 'KUA tidak ditemukan.' }, 404);
    const jenis = action !== 'upload' && get('jenis') === 'rpd' ? 'RPD' : 'Realisasi';

    // 3) Drive: folder tahun / KUA / jenis / bulan (dicari, dan dibuat bila upload)
    const auth = { Authorization: `Bearer ${await googleToken()}` };
    const root = Deno.env.get('DRIVE_ROOT_FOLDER_ID')!;
    const search = async (q: string, fields: string, extra: Record<string, string> = {}) =>
      (await (await fetch(`${API}?` + new URLSearchParams({ q, fields, pageSize: '100', ...extra }), { headers: auth })).json()).files ?? [];
    const folder = async (create: boolean): Promise<string | null> => {
      let parent = root;
      for (const name of [String(tahun), kua.nama_kua, jenis, `${String(bulan).padStart(2, '0')} ${BULAN[bulan - 1]}`]) {
        let id: string | undefined = (await search(`name='${esc(name)}' and '${parent}' in parents and mimeType='${FOLDER}' and trashed=false`, 'files(id)'))[0]?.id;
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
    };

    if (action === 'list') {
      const f = await folder(false);
      const files = f ? (await search(`'${f}' in parents and trashed=false`, 'files(id,name,mimeType,size)', { orderBy: 'createdTime' }))
        .filter((x: { mimeType: string }) => TYPES.includes(x.mimeType)) : [];
      return json({ files });
    }

    if (action === 'file') {
      const id = url.searchParams.get('id') ?? '';
      if (!/^[\w-]{10,100}$/.test(id)) return json({ error: 'ID file tidak valid.' }, 400);
      const f = await folder(false);
      const meta = await (await fetch(`${API}/${id}?fields=mimeType,parents,trashed`, { headers: auth })).json();
      if (!f || meta.trashed || !meta.parents?.includes(f) || !TYPES.includes(meta.mimeType)) return json({ error: 'Dokumen tidak ditemukan.' }, 404);
      const r = await fetch(`${API}/${id}?alt=media`, { headers: auth });
      if (!r.ok || !r.body) throw new Error('Gagal membaca dokumen dari Google Drive.');
      return new Response(r.body, { headers: { ...cors, 'Content-Type': meta.mimeType, 'Cache-Control': 'private, max-age=300' } });
    }

    // 4) Upload: aturan yang sama dengan form (dijaga ulang di server)
    const { data: rows } = await db.from('config').select('key, value').in('key', ['realisasi_enabled', 'max_file_size_mb', 'max_file_count']);
    const cfg = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
    if (cfg.realisasi_enabled !== true) return json({ error: 'Pengisian Realisasi sedang ditutup oleh admin.' }, 403);
    const wib = new Date(Date.now() + 7 * 3600 * 1000);
    if (Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) < Date.UTC(tahun, bulan - 1, 10)) {
      return json({ error: `Realisasi ${BULAN[bulan - 1]} ${tahun} baru dapat disubmit mulai tanggal 10.` }, 403);
    }
    const { count } = await db.from('realisasi').select('id', { count: 'exact', head: true })
      .eq('kua_id', kuaId).eq('tahun', tahun).eq('bulan', bulan).eq('is_autopayment', false).in('status', ['approved', 'paid']);
    if (count) return json({ error: 'Realisasi bulan ini sudah disetujui/dibayar; dokumen LPJ terkunci.' }, 403);

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
    const ada = (await search(`'${dir}' in parents and trashed=false`, 'files(id)')).length;
    if (ada + items.length > maxN) return json({ error: `Maksimal ${maxN} file per bulan. Sudah ada ${ada} file, Anda mengunggah ${items.length}.` }, 400);
    for (const { f, type } of items) {
      const b = 'lpj' + crypto.randomUUID();
      const meta = JSON.stringify({ name: f.name.replace(/[\\/:*?"<>|]/g, '_'), parents: [dir] });
      const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`, f, `\r\n--${b}--`]);
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { ...auth, 'Content-Type': `multipart/related; boundary=${b}` }, body,
      });
      if (!r.ok) { console.error('upload gagal', r.status, await r.text()); throw new Error(`Gagal mengunggah ${f.name} ke Google Drive.`); }
    }
    return json({ ok: true, folderUrl: `https://drive.google.com/drive/folders/${dir}`, total: ada + items.length });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || 'Terjadi kesalahan di server.' }, 500);
  }
});
