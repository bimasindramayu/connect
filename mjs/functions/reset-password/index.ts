// Reset password operator oleh admin. Berjalan di server Supabase, jadi service_role key
// tidak pernah menyentuh frontend/GitHub.
//
// Deploy (sekali, dari folder project):
//   npx supabase login
//   npx supabase link --project-ref lpfwkitppdnlcakkncov
//   npx supabase functions deploy reset-password --no-verify-jwt
// --no-verify-jwt aman: fungsi ini memverifikasi token dan role admin sendiri (di bawah).
// Tidak perlu set secret: SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY disuntik otomatis oleh Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Metode tidak didukung.' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Pemanggil harus login DAN berrole admin (dibaca dari tabel profiles, bukan dari klien)
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return reply({ error: 'Sesi tidak valid. Silakan login ulang.' }, 401);
  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return reply({ error: 'Hanya admin yang boleh mereset password.' }, 403);

  // 2) Validasi input
  let body: { user_id?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* body kosong */ }
  const { user_id, password } = body;
  if (!user_id || typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return reply({ error: 'Data tidak valid: password harus 8–72 karakter.' }, 400);
  }

  // 3) Target harus akun operator (admin mengganti passwordnya sendiri lewat Pengaturan)
  const { data: target } = await db.from('profiles').select('nama, role').eq('id', user_id).maybeSingle();
  if (!target) return reply({ error: 'Akun tidak ditemukan.' }, 404);
  if (target.role !== 'operator') return reply({ error: 'Hanya password operator yang dapat direset di sini.' }, 403);

  // 4) Ganti password
  const { error } = await db.auth.admin.updateUserById(user_id, { password });
  if (error) return reply({ error: error.message }, 400);
  return reply({ ok: true, nama: target.nama });
});