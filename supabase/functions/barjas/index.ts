// BARJAS backend for BIMASATU CONNECT.
// Authentication and row-level authorization are shared with the existing Supabase project.
// The frontend never receives the service-role key.
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (message: string, code = 'ERROR', status = 400) => json({ ok: false, code, error: message }, status);
const msg = (e: unknown) => e instanceof Error ? e.message : String(e);
const now = () => new Date().toISOString();
const uid = (prefix = 'S') => prefix + crypto.randomUUID().replace(/-/g, '');
const cleanName = (s: string) => String(s || 'berkas').replace(/[\\/:*?"<>|]/g, '_').slice(0, 160);
const asBool = (v: unknown) => v === true || v === 1 || ['true', '1', 'ya', 'yes'].includes(String(v ?? '').toLowerCase());
const parseObject = (v: unknown, fallback: unknown = {}) => {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } }
  return fallback;
};
const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
const checked = <T>(r: { data: T; error: any }, label = 'Database') => {
  if (r.error) throw new Error(label + ': ' + r.error.message);
  return r.data;
};

async function upsertMany(db: any, table: string, rows: any[], conflict = 'id') {
  for (const part of chunk(rows, 100)) {
    if (part.length) checked(await db.from(table).upsert(part, { onConflict: conflict }), 'Simpan ' + table);
  }
}

function mapUser(user: any, profile: any) {
  const role = profile?.role === 'admin' ? 'admin' : 'operator';
  return {
    id: user.id,
    nama: profile?.nama || user.user_metadata?.nama || user.email || '',
    nip: user.user_metadata?.nip || '',
    username: user.user_metadata?.username || String(user.email || '').split('@')[0],
    email: user.email || '',
    role,
    aktif: !user.banned_until,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Metode tidak didukung.', 'METHOD', 405);

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return fail('Sesi tidak valid. Silakan masuk kembali.', 'AUTH', 401);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = createClient(URL, ANON, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const authUser = checked(await admin.auth.getUser(token), 'Autentikasi');
    const user = authUser.user;
    if (!user) return fail('Sesi tidak valid. Silakan masuk kembali.', 'AUTH', 401);

    const access = checked(await db.rpc('akses_saya'), 'Hak akses');
    if (!access) return fail('Profil akun tidak ditemukan.', 'AUTH', 401);
    const isAdmin = access.role === 'admin';
    const canBarjas = isAdmin || (Array.isArray(access.menus) && access.menus.includes('barjas'));
    if (!canBarjas) return fail('Akun ini tidak memiliki hak akses BARJAS.', 'FORBIDDEN', 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const d = body.data || {};
    const adminOnly = () => { if (!isAdmin) throw new Error('Hanya Admin yang dapat melakukan tindakan ini.'); };
    const getPackage = async (id: string) => {
      const row = checked(await db.from('barjas_paket').select('*').eq('id', id).maybeSingle(), 'Paket');
      if (!row) throw new Error('Paket tidak ditemukan atau Anda tidak ditugaskan pada satker ini.');
      return row;
    };
    const log = async (aksi: string, detail = '') => {
      await db.from('barjas_log').insert({ user_id: user.id, aksi, detail: String(detail).slice(0, 1000) });
    };

    switch (action) {
      case 'ping':
        return json({ ok: true, data: { versi: 'supabase-1.0.0', waktu: now() } });

      case 'bootstrap': {
        const tahun = Number(d.tahun || new Date().getFullYear());
        const [cfg, satker, pejabat, penyedia, penugasan, paketYears] = await Promise.all([
          db.from('barjas_config').select('key,value'),
          db.from('barjas_satker').select('*').order('nama'),
          db.from('barjas_pejabat').select('*').order('nama'),
          db.from('barjas_penyedia').select('*').order('nama'),
          db.from('barjas_penugasan').select('*'),
          db.from('barjas_paket').select('tahun'),
        ]);
        const configRows = checked(cfg, 'Config') || [];
        const satkerRows = checked(satker, 'Satuan kerja') || [];
        const pejabatRows = checked(pejabat, 'Pejabat') || [];
        const penyediaRows = checked(penyedia, 'Penyedia') || [];
        const penugasanRows = checked(penugasan, 'Penugasan') || [];
        const packageYearRows = checked(paketYears, 'Tahun paket') || [];
        const config: Record<string, unknown> = {};
        configRows.forEach((r: any) => { config[r.key] = r.value; });

        let users: any[] = [];
        if (isAdmin) {
          const all: any[] = [];
          let page = 1;
          while (page <= 20) {
            const result = checked(await admin.auth.admin.listUsers({ page, perPage: 500 }), 'Daftar pengguna');
            all.push(...(result.users || []));
            if (!result.users || result.users.length < 500) break;
            page++;
          }
          const profiles = checked(await admin.from('profiles').select('id,nama,role,kua'), 'Profil pengguna') || [];
          const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
          users = all
            .filter((u: any) => ['admin', 'pengadaan'].includes((profileMap.get(u.id) as any)?.role))
            .map((u: any) => mapUser(u, profileMap.get(u.id)));
        } else {
          users = [{
            id: user.id, nama: access.nama || user.user_metadata?.nama || user.email,
            nip: user.user_metadata?.nip || '', username: String(user.email || '').split('@')[0],
            email: user.email || '', role: 'operator', aktif: true,
          }];
        }

        const years = new Set<number>([tahun]);
        penugasanRows.forEach((r: any) => { if (r.tahun) years.add(Number(r.tahun)); });
        packageYearRows.forEach((r: any) => { if (r.tahun) years.add(Number(r.tahun)); });
        return json({ ok: true, data: {
          config,
          tahun: [...years].sort((a, b) => b - a).map((id) => ({ id: String(id) })),
          satker: satkerRows,
          pejabat: pejabatRows,
          penyedia: penyediaRows.map((r: any) => ({
            ...r, cp_file_id: r.cp_storage_path || r.cp_legacy_file_id || r.cp_file_id || '',
          })),
          users,
          penugasan: penugasanRows,
        } });
      }

      case 'save': {
        const entity = String(d.entity || '');
        const row = d.row || {};
        if (entity === 'Users') {
          adminOnly();
          const role = row.role === 'admin' ? 'admin' : 'pengadaan';
          let email = String(row.email || '').trim().toLowerCase();
          if (!email) {
            const domain = Deno.env.get('BARJAS_EMAIL_DOMAIN') || '';
            const username = String(row.username || '').trim().toLowerCase();
            if (!domain || !username) throw new Error('Email wajib diisi untuk membuat akun Supabase. Atur BARJAS_EMAIL_DOMAIN atau isi kolom Email.');
            email = username + '@' + domain;
          }
          let authResult: any;
          if (row.id) {
            const patch: any = { email, user_metadata: { nama: row.nama, nip: row.nip || '', username: row.username || String(email).split('@')[0], role } };
            if (row.password) patch.password = row.password;
            if (row.aktif === false) patch.ban_duration = '876000h';
            else patch.ban_duration = 'none';
            authResult = checked(await admin.auth.admin.updateUserById(row.id, patch), 'Ubah akun');
            checked(await admin.from('profiles').update({ nama: row.nama, role, kua: null, kua_id: null }).eq('id', row.id), 'Perbarui profil');
          } else {
            if (String(row.password || '').length < 8) throw new Error('Kata sandi minimal 8 karakter.');
            authResult = checked(await admin.auth.admin.createUser({
              email, password: row.password, email_confirm: true,
              user_metadata: { nama: row.nama, nip: row.nip || '', username: row.username || String(email).split('@')[0], role },
            }), 'Buat akun');
          }
          await log(row.id ? 'ubah-pengguna' : 'tambah-pengguna', email);
          return json({ ok: true, data: mapUser(authResult.user, { nama: row.nama, role }) });
        }

        if (entity === 'Penugasan' || entity === 'Users') adminOnly();
        const tableMap: Record<string, string> = {
          Pejabat: 'barjas_pejabat', Satker: 'barjas_satker', Penugasan: 'barjas_penugasan',
          Penyedia: 'barjas_penyedia',
        };
        const table = tableMap[entity];
        if (!table) throw new Error('Entitas tidak dikenal: ' + entity + '.');
        const payload = { ...row };
        delete payload.__row;
        if (entity === 'Penugasan') {
          payload.tahun = Number(payload.tahun);
          payload.ada_pengadaan = payload.ada_pengadaan === undefined ? true : asBool(payload.ada_pengadaan);
          payload.tgl_dipa = payload.tgl_dipa ? String(payload.tgl_dipa).slice(0, 10) : null;
          payload.user_id = payload.user_id || null;
          if (!payload.id) {
            const previous = checked(await db.from('barjas_penugasan').select('id')
              .eq('satker_id', payload.satker_id).eq('tahun', payload.tahun).maybeSingle(), 'Cari penugasan');
            payload.id = previous?.id || uid('T');
          }
        } else if (!payload.id) {
          const prefix: Record<string, string> = { Satker: 'S', Pejabat: 'J', Penyedia: 'V' };
          payload.id = uid(prefix[entity] || 'S');
        }
        if (entity === 'Satker' && !isAdmin) {
          if (!payload.id) throw new Error('Pengelola satker tidak dapat menambah satuan kerja.');
          return json({ ok: true, data: checked(await db.from(table).update(payload).eq('id', payload.id).select().single(), 'Simpan ' + entity) });
        }
        return json({ ok: true, data: checked(await db.from(table).upsert(payload).select().single(), 'Simpan ' + entity) });
      }

      case 'remove': {
        adminOnly();
        const tableMap: Record<string, string> = { Pejabat: 'barjas_pejabat', Satker: 'barjas_satker', Penyedia: 'barjas_penyedia' };
        const table = tableMap[String(d.entity || '')];
        if (!table) throw new Error('Entitas tidak dikenal atau tidak dapat dihapus.');
        checked(await db.from(table).delete().eq('id', d.id), 'Hapus data');
        await log('hapus-' + String(d.entity), String(d.id));
        return json({ ok: true, data: true });
      }

      case 'resetPassword': {
        adminOnly();
        if (String(d.password || '').length < 8) throw new Error('Kata sandi minimal 8 karakter.');
        checked(await admin.auth.admin.updateUserById(d.id, { password: d.password }), 'Atur ulang sandi');
        await log('reset-sandi', String(d.id));
        return json({ ok: true, data: true });
      }

      case 'saveConfig': {
        adminOnly();
        const rows = Object.keys(d || {}).map((key) => ({ key, value: d[key], updated_at: now() }));
        await upsertMany(db, 'barjas_config', rows, 'key');
        await log('ubah-pengaturan', 'Config BARJAS');
        return json({ ok: true, data: true });
      }

      case 'paketList': {
        const tahun = Number(d.tahun || new Date().getFullYear());
        const [paketResult, dokResult, penyediaResult] = await Promise.all([
          db.from('barjas_paket').select('*').eq('tahun', tahun).order('nama'),
          db.from('barjas_dokumen').select('paket_id,kode'),
          db.from('barjas_penyedia').select('id,cp_storage_path,cp_legacy_file_id,cp_file_id'),
        ]);
        const paket = checked(paketResult, 'Daftar paket') || [];
        const docs = checked(dokResult, 'Daftar dokumen') || [];
        const providers = checked(penyediaResult, 'Daftar penyedia') || [];
        const hit: Record<string, any> = {};
        docs.forEach((x: any) => {
          const key = String(x.paket_id);
          if (!hit[key]) hit[key] = {};
          hit[key][x.kode] = (hit[key][x.kode] || 0) + 1;
        });
        const providerMap = new Map(providers.map((p: any) => [p.id, p]));
        return json({ ok: true, data: paket.map((p: any) => {
          const out = { ...p, ada_pph: asBool(p.ada_pph), dok: hit[p.id] || {} };
          const v: any = providerMap.get(p.penyedia_id);
          if (v && (v.cp_storage_path || v.cp_legacy_file_id || v.cp_file_id)) out.dok[12] = out.dok[12] || 1;
          return out;
        }) });
      }

      case 'paketDetail': {
        const p = await getPackage(String(d.id || ''));
        const [dok, hps, monev] = await Promise.all([
          db.from('barjas_dokumen').select('*').eq('paket_id', p.id).order('uploaded_at', { ascending: false }),
          db.from('barjas_hps').select('*').eq('paket_id', p.id).order('part'),
          db.from('barjas_monev').select('*').eq('paket_id', p.id).maybeSingle(),
        ]);
        const docs = checked(dok, 'Dokumen') || [];
        docs.forEach((x: any) => { if (x.storage_path) x.file_id = x.storage_path; else if (x.legacy_file_id) x.file_id = x.legacy_file_id; });
        const parts = checked(hps, 'HPS') || [];
        let hpsValue: any = null;
        if (parts.length) {
          try { hpsValue = JSON.parse(parts.map((x: any) => x.payload).join('')); } catch { hpsValue = null; }
        }
        const monevRow = checked(monev, 'Monev');
        let monevValue: any = null;
        if (monevRow) { try { monevValue = JSON.parse(monevRow.payload); } catch { monevValue = null; } }
        return json({ ok: true, data: { paket: { ...p, ada_pph: asBool(p.ada_pph) }, dokumen: docs, hps: hpsValue, monev: monevValue } });
      }

      case 'savePaket': {
        const row = { ...(d.row || {}) };
        row.tahun = Number(row.tahun);
        row.pagu = Number(row.pagu || 0);
        row.nilai = Number(row.nilai || 0);
        row.ada_pph = asBool(row.ada_pph);
        row.penyedia_id = row.penyedia_id || null;
        row.updated_at = now();
        if (row.meta && typeof row.meta === 'string') row.meta = parseObject(row.meta, {});
        if (!row.id) { row.id = uid('P'); row.created_at = now(); }
        return json({ ok: true, data: checked(await db.from('barjas_paket').upsert(row).select().single(), 'Simpan paket') });
      }

      case 'removePaket': {
        const p = await getPackage(String(d.id || ''));
        const docs = checked(await db.from('barjas_dokumen').select('storage_path').eq('paket_id', p.id), 'Dokumen') || [];
        const paths = docs.map((r: any) => r.storage_path).filter(Boolean);
        if (paths.length) await Promise.all([admin.storage.from('barjas-files').remove(paths), admin.storage.from('sipadu-files').remove(paths)]);
        checked(await db.from('barjas_paket').delete().eq('id', p.id), 'Hapus paket');
        await log('hapus-paket', p.nama || p.id);
        return json({ ok: true, data: true });
      }

      case 'saveHPS': {
        const p = await getPackage(String(d.paket_id || ''));
        const payload = String(d.payload || '');
        const parts = payload.match(/[\s\S]{1,40000}/g) || [];
        checked(await db.from('barjas_hps').delete().eq('paket_id', p.id), 'Kosongkan HPS');
        const rows = parts.map((part, i) => ({
          id: 'H' + p.id + '-' + i, paket_id: p.id, part: i, payload: part,
          total: Number(d.total || 0), updated_at: now(),
        }));
        await upsertMany(db, 'barjas_hps', rows, 'paket_id,part');
        return json({ ok: true, data: true });
      }

      case 'saveMonev': {
        const p = await getPackage(String(d.paket_id || ''));
        const payload = String(d.payload || '');
        const row = { id: 'M' + p.id, paket_id: p.id, payload, updated_at: now() };
        return json({ ok: true, data: checked(await db.from('barjas_monev').upsert(row, { onConflict: 'paket_id' }).select().single(), 'Simpan Monev') });
      }

      case 'registerFile': {
        const meta = d.meta || {};
        const path = String(d.path || '');
        if (!path || !path.startsWith('penyedia/') && !path.startsWith(String(meta.paket_id || '') + '/'))
          throw new Error('Lokasi berkas tidak valid.');
        if (meta.penyedia_id) {
          const row = checked(await db.from('barjas_penyedia').update({
            cp_file_id: path, cp_storage_path: path, cp_legacy_file_id: meta.legacy_file_id || null, cp_url: '',
            updated_at: now(),
          }).eq('id', meta.penyedia_id).select().single(), 'Simpan company profile');
          return json({ ok: true, data: { kode: 12, nama_file: meta.nama_file, file_id: path, storage_path: path, url: '', penyedia: row } });
        }
        const row = {
          id: meta.legacy_id || uid('D'),
          paket_id: meta.paket_id,
          kode: Number(meta.kode),
          sub: meta.sub || '',
          nama_file: meta.nama_file || path.split('/').pop(),
          file_id: path,
          legacy_file_id: meta.legacy_file_id || null,
          storage_path: path,
          url: '',
          mime: meta.mime || 'application/octet-stream',
          size: Number(meta.size || 0),
          keterangan: meta.keterangan || '',
          uploaded_by: user.id,
          uploaded_at: now(),
        };
        return json({ ok: true, data: checked(await db.from('barjas_dokumen').upsert(row).select().single(), 'Simpan metadata dokumen') });
      }

      case 'fileGet': {
        const fid = String(d.file_id || '').trim();
        if (!fid) throw new Error('ID berkas tidak diberikan.');
        let row: any = null;
        let docResult = await db.from('barjas_dokumen').select('*').eq('storage_path', fid).limit(1).maybeSingle();
        if (!docResult.data && !docResult.error) docResult = await db.from('barjas_dokumen').select('*').eq('file_id', fid).limit(1).maybeSingle();
        if (!docResult.data && !docResult.error) docResult = await db.from('barjas_dokumen').select('*').eq('legacy_file_id', fid).limit(1).maybeSingle();
        if (docResult.error) throw new Error('Dokumen: ' + docResult.error.message);
        row = docResult.data;
        if (!row) {
          let providerResult = await db.from('barjas_penyedia').select('*').eq('cp_storage_path', fid).limit(1).maybeSingle();
          if (!providerResult.data && !providerResult.error) providerResult = await db.from('barjas_penyedia').select('*').eq('cp_file_id', fid).limit(1).maybeSingle();
          if (!providerResult.data && !providerResult.error) providerResult = await db.from('barjas_penyedia').select('*').eq('cp_legacy_file_id', fid).limit(1).maybeSingle();
          if (providerResult.error) throw new Error('Penyedia: ' + providerResult.error.message);
          const provider = providerResult.data;
          if (provider) row = {
            nama_file: provider.nama, mime: 'application/octet-stream', size: 0,
            storage_path: provider.cp_storage_path, legacy_file_id: provider.cp_legacy_file_id, url: provider.cp_url,
          };
        }
        if (!row) throw new Error('Berkas tidak ditemukan atau Anda tidak berwenang melihatnya.');
        if (row.storage_path) {
          // Berkas yang sudah tersimpan di bucket SIPADU lama tetap dapat dibaca setelah rename.
          let bucket = 'barjas-files';
          let downloaded = await admin.storage.from(bucket).download(row.storage_path);
          if (downloaded.error) {
            const legacyDownload = await admin.storage.from('sipadu-files').download(row.storage_path);
            if (!legacyDownload.error) {
              downloaded = legacyDownload;
              bucket = 'sipadu-files';
            }
          }
          const blob = checked(downloaded, 'Unduh berkas');
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = '';
          const step = 0x8000;
          for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
          const base64 = btoa(binary);
          const signed = checked(await admin.storage.from(bucket).createSignedUrl(row.storage_path, 600), 'Tautan berkas');
          return json({ ok: true, data: {
            nama: row.nama_file || 'berkas', mime: row.mime || blob.type || 'application/octet-stream',
            size: row.size || blob.size, data: base64, url: signed.signedUrl,
          } });
        }
        if (row.url) return json({ ok: true, data: { nama: row.nama_file || 'berkas', mime: row.mime, size: row.size || 0, url: row.url } });
        throw new Error('Berkas lama belum dipindahkan ke penyimpanan Supabase. Gunakan tautan arsip yang tercatat.');
      }

      case 'removeDok': {
        const row = checked(await db.from('barjas_dokumen').select('*').eq('id', d.id).maybeSingle(), 'Dokumen');
        if (!row) return json({ ok: true, data: true });
        if (row.storage_path) await Promise.all([admin.storage.from('barjas-files').remove([row.storage_path]), admin.storage.from('sipadu-files').remove([row.storage_path])]);
        checked(await db.from('barjas_dokumen').delete().eq('id', d.id), 'Hapus dokumen');
        await log('hapus-berkas', row.nama_file || row.id);
        return json({ ok: true, data: true });
      }

      case 'importState': {
        adminOnly();
        const [docs, providers] = await Promise.all([
          admin.from('barjas_dokumen').select('id,legacy_file_id,storage_path'),
          admin.from('barjas_penyedia').select('id,cp_legacy_file_id,cp_storage_path'),
        ]);
        return json({ ok: true, data: {
          dokumen: checked(docs, 'Status dokumen') || [],
          penyedia: checked(providers, 'Status penyedia') || [],
        } });
      }

      case 'importBatch': {
        adminOnly();
        const configRows = Object.entries(d.config || {}).map(([key, value]) => ({ key, value, updated_at: now() }));
        await upsertMany(db, 'barjas_config', configRows, 'key');

        const mapRows = (d.user_map || []).filter((x: any) => x.legacy_id && x.auth_user_id)
          .map((x: any) => ({ legacy_id: String(x.legacy_id), auth_user_id: x.auth_user_id, legacy_username: x.legacy_username || '' }));
        await upsertMany(db, 'barjas_user_map', mapRows, 'legacy_id');

        const satkerRows = (d.satker || []).map((x: any) => ({ ...x, id: String(x.id), aktif: x.aktif === undefined ? true : asBool(x.aktif) }));
        const pejabatRows = (d.pejabat || []).map((x: any) => ({ ...x, id: String(x.id), aktif: x.aktif === undefined ? true : asBool(x.aktif) }));
        const penyediaRows = (d.penyedia || []).map((x: any) => {
          const row = { ...x, id: String(x.id), aktif: x.aktif === undefined ? true : asBool(x.aktif) };
          row.cp_legacy_file_id = x.cp_file_id || null;
          row.cp_storage_path = null;
          row.cp_file_id = x.cp_file_id || null;
          return row;
        });
        await upsertMany(db, 'barjas_satker', satkerRows);
        await upsertMany(db, 'barjas_pejabat', pejabatRows);
        await upsertMany(db, 'barjas_penyedia', penyediaRows);

        const maps = new Map(mapRows.map((x: any) => [x.legacy_id, x.auth_user_id]));
        const assignments = (d.penugasan || []).map((x: any) => ({
          ...x,
          id: String(x.id),
          tahun: Number(x.tahun),
          tgl_dipa: x.tgl_dipa ? String(x.tgl_dipa).slice(0, 10) : null,
          user_id: maps.get(String(x.user_id)) || (String(x.user_id || '').includes('-') ? x.user_id : null),
          ada_pengadaan: x.ada_pengadaan === undefined ? true : asBool(x.ada_pengadaan),
        }));
        await upsertMany(db, 'barjas_penugasan', assignments);

        const paketRows = (d.paket || []).map((x: any) => ({
          ...x, id: String(x.id), tahun: Number(x.tahun), pagu: Number(x.pagu || 0),
          nilai: Number(x.nilai || 0), ada_pph: asBool(x.ada_pph), penyedia_id: x.penyedia_id || null, meta: parseObject(x.meta, {}),
        }));
        await upsertMany(db, 'barjas_paket', paketRows);
        // HPS/Monev disinkronkan per paket agar impor ulang juga membersihkan versi lama yang sudah dihapus di sumber.
        const paketIds = paketRows.map((x: any) => String(x.id));
        if (paketIds.length) {
          checked(await db.from('barjas_hps').delete().in('paket_id', paketIds), 'Sinkronisasi HPS');
          checked(await db.from('barjas_monev').delete().in('paket_id', paketIds), 'Sinkronisasi Monev');
        }

        const hpsRows: any[] = [];
        for (const x of (d.hps || [])) {
          const payload = typeof x.payload === 'string' ? x.payload : JSON.stringify(x.payload);
          const parts = payload.match(/[\s\S]{1,40000}/g) || [''];
          parts.forEach((part: string, i: number) => hpsRows.push({
            id: 'H' + String(x.paket_id) + '-' + i, paket_id: String(x.paket_id), part: i,
            payload: part, total: Number(x.total || 0), updated_at: x.updated_at || now(),
          }));
        }
        if (hpsRows.length) await upsertMany(db, 'barjas_hps', hpsRows, 'paket_id,part');

        const monevRows = (d.monev || []).map((x: any) => ({
          id: 'M' + String(x.paket_id), paket_id: String(x.paket_id),
          payload: typeof x.payload === 'string' ? x.payload : JSON.stringify(x.payload),
          updated_at: x.updated_at || now(),
        }));
        if (monevRows.length) await upsertMany(db, 'barjas_monev', monevRows, 'paket_id');

        await log('migrasi-data', 'Satker ' + satkerRows.length + ', paket ' + paketRows.length);
        return json({ ok: true, data: {
          satker: satkerRows.length, pejabat: pejabatRows.length, penyedia: penyediaRows.length,
          penugasan: assignments.length, paket: paketRows.length, hps: hpsRows.length, monev: monevRows.length,
          user_map: mapRows.length,
        } });
      }

      case 'importDocLink': {
        adminOnly();
        const doc = d.doc || {};
        const row = {
          id: String(d.legacy_id || doc.id || uid('D')),
          paket_id: String(doc.paket_id),
          kode: Number(doc.kode || 0),
          sub: doc.sub || '',
          nama_file: doc.nama_file || 'Berkas lama',
          file_id: doc.file_id || null,
          legacy_file_id: doc.file_id || null,
          storage_path: null,
          url: doc.url || '',
          mime: doc.mime || '',
          size: Number(doc.size || 0),
          keterangan: doc.keterangan || '',
          uploaded_by: null,
          uploaded_at: doc.uploaded_at || now(),
        };
        return json({ ok: true, data: checked(await db.from('barjas_dokumen').upsert(row).select().single(), 'Impor metadata dokumen') });
      }

      case 'importProviderLink': {
        adminOnly();
        const id = String(d.id || '');
        const p = checked(await db.from('barjas_penyedia').update({
          cp_file_id: d.legacy_file_id || null,
          cp_legacy_file_id: d.legacy_file_id || null,
          cp_storage_path: null, cp_url: d.url || '',
        }).eq('id', id).select().single(), 'Impor company profile');
        return json({ ok: true, data: p });
      }

      default:
        return fail('Aksi "' + action + '" tidak dikenal.', 'UNKNOWN_ACTION', 404);
    }
  } catch (e) {
    const message = msg(e);
    const status = /hak akses|tidak memiliki hak/i.test(message) ? 403 : 400;
    return fail(message, status === 403 ? 'FORBIDDEN' : 'ERROR', status);
  }
});
