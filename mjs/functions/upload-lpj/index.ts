// Unggah LPJ ke Google Drive, dijalankan di server Supabase. Secret Google hanya ada di Supabase Secrets,
// tidak pernah ada di frontend/GitHub.
//
// Setup (sekali): jalankan setup-drive.mjs di komputer Anda, lalu:
//   npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... DRIVE_ROOT_FOLDER_ID=...
//   npx supabase functions deploy upload-lpj --no-verify-jwt
// --no-verify-jwt aman: fungsi ini memverifikasi token dan role operator sendiri.
//
// Struktur Drive: <folder root>/<tahun>-<bulan> <nama KUA>/<file LPJ>. Link folder itulah yang disimpan di realisasi.file_lpj_url.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EXT: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47],
};
const API = 'https://www.googleapis.com/drive/v3/files';

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
  if (req.method !== 'POST') return reply({ error: 'Metode tidak didukung.' }, 405);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Pemanggil harus operator. KUA diambil dari profil di database, bukan dari kiriman klien.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return reply({ error: 'Sesi tidak valid. Silakan login ulang.' }, 401);
    const { data: me } = await db.from('profiles').select('role, kua').eq('id', user.id).maybeSingle();
    if (me?.role !== 'operator' || !me.kua) return reply({ error: 'Hanya operator KUA yang dapat mengunggah LPJ.' }, 403);

    // 2) Batas dari tabel config
    const { data: rows } = await db.from('config').select('key, value')
      .in('key', ['realisasi_enabled', 'max_file_size_mb', 'max_file_count']);
    const cfg = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
    if (cfg.realisasi_enabled !== true) return reply({ error: 'Pengisian Realisasi sedang ditutup oleh admin.' }, 403);
    const maxMb = Number(cfg.max_file_size_mb ?? 5), maxN = Number(cfg.max_file_count ?? 3);

    // 3) Validasi input dan file (ekstensi, ukuran, dan isi file)
    const form = await req.formData();
    const tahun = Number(form.get('tahun')), bulan = Number(form.get('bulan'));
    if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100 || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
      return reply({ error: 'Tahun atau bulan tidak valid.' }, 400);
    }
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) return reply({ error: 'Pilih minimal satu file.' }, 400);
    const items: { f: File; type: string }[] = [];
    for (const f of files) {
      const type = EXT[(f.name.split('.').pop() ?? '').toLowerCase()];
      if (!type) return reply({ error: `${f.name}: hanya PDF, JPG, atau PNG.` }, 400);
      if (f.size > maxMb * 1024 * 1024) return reply({ error: `${f.name}: ukuran melebihi ${maxMb} MB.` }, 400);
      const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (!MAGIC[type].every((b, i) => head[i] === b)) return reply({ error: `${f.name}: isi file tidak sesuai ekstensinya.` }, 400);
      items.push({ f, type });
    }

    // 4) Folder bulanan KUA di Drive (cari, bila belum ada dibuat)
    const auth = { Authorization: `Bearer ${await googleToken()}` };
    const root = Deno.env.get('DRIVE_ROOT_FOLDER_ID')!;
    const name = `${tahun}-${String(bulan).padStart(2, '0')} ${me.kua}`;
    const found = await (await fetch(`${API}?` + new URLSearchParams({
      q: `name='${name.replace(/'/g, "\\'")}' and '${root}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)', pageSize: '1',
    }), { headers: auth })).json();
    let folder: string | undefined = found.files?.[0]?.id;
    if (!folder) {
      const c = await (await fetch(`${API}?fields=id`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [root] }),
      })).json();
      folder = c.id;
    }
    if (!folder) { console.error('folder Drive gagal', found); throw new Error('Gagal menyiapkan folder di Google Drive.'); }

    const ex = await (await fetch(`${API}?` + new URLSearchParams({
      q: `'${folder}' in parents and trashed=false`, fields: 'files(id)', pageSize: '100',
    }), { headers: auth })).json();
    const n = ex.files?.length ?? 0;
    if (n + items.length > maxN) {
      return reply({ error: `Maksimal ${maxN} file per LPJ. Sudah ada ${n} file, Anda mengunggah ${items.length}.` }, 400);
    }

    // 5) Unggah
    for (const { f, type } of items) {
      const b = 'lpj' + crypto.randomUUID();
      const meta = JSON.stringify({ name: f.name.replace(/[\\/:*?"<>|]/g, '_'), parents: [folder] });
      const body = new Blob([
        `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`,
        f, `\r\n--${b}--`,
      ]);
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { ...auth, 'Content-Type': `multipart/related; boundary=${b}` }, body,
      });
      if (!r.ok) { console.error('upload gagal', r.status, await r.text()); throw new Error(`Gagal mengunggah ${f.name} ke Google Drive.`); }
    }
    return reply({ ok: true, folderUrl: `https://drive.google.com/drive/folders/${folder}`, total: n + items.length });
  } catch (e) {
    console.error(e);
    return reply({ error: (e as Error).message || 'Terjadi kesalahan di server.' }, 500);
  }
});
