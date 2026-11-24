const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('BARJAS menu permission is passed into the module and grants all satker', () => {
  const app = read('barjas/assets/js/app.js');
  expect(app).toContain('menus: Array.isArray(current.menus) ? current.menus.slice() : []');
  expect(app).toContain("u.role === 'admin' || (Array.isArray(u.menus) && u.menus.indexOf('barjas') >= 0)");
  expect(app).toContain('if (App.canManage()) return m.satker || [];');
  expect(app).toContain("var cacheKey = 'master.v2.' + App.state.user.id + '.' + App.state.tahun;");
  expect(app).not.toContain('if (Auth.isAdmin()) return m.satker || [];');
});

test('BARJAS screens do not block menu-authorized users with an Admin-only role check', () => {
  const pages = read('barjas/assets/js/pages.js');
  const migration = read('barjas/assets/js/migrasi.js');
  expect(pages).not.toContain('Auth.isAdmin()');
  expect(pages).not.toContain('Khusus admin');
  expect((pages.match(/App\.canManage\(\)/g) || []).length).toBe(7);
  expect(migration).not.toContain('Auth.isAdmin()');
  expect(migration).toContain('if (!App.canManage())');
});

test('BARJAS Edge Function has no Admin-only action gate after menu authorization', () => {
  const edge = read('supabase/functions/barjas/index.ts');
  expect(edge).toContain("access.menus.includes('barjas')");
  expect(edge).toContain("if (!canBarjas) return fail('Akun ini tidak memiliki hak akses BARJAS.'");
  expect(edge).not.toContain('adminOnly');
  expect(edge).not.toContain('isAdmin');
  expect(edge).toContain("if (canBarjas) {");
});

test('BARJAS database policies scope all rows and storage by menu permission, not satker assignment', () => {
  const sql = read('barjas.sql');
  const helperStart = sql.indexOf('create or replace function public.barjas_can_satker');
  const helperEnd = sql.indexOf('$barjas$;', helperStart);
  expect(helperStart).toBeGreaterThanOrEqual(0);
  const helper = sql.slice(helperStart, helperEnd);
  expect(helper).toContain("select public.can_menu('barjas');");
  expect(helper).not.toContain('barjas_penugasan');
  expect(helper).not.toContain('auth.uid()');

  expect(sql).toContain("create policy barjas_penugasan_read on public.barjas_penugasan for select to authenticated\n  using (public.can_menu('barjas'));");
  expect(sql).toContain("create policy barjas_penugasan_admin on public.barjas_penugasan for all to authenticated\n  using (public.can_menu('barjas')) with check (public.can_menu('barjas'));");
  expect(sql).toContain("using (bucket_id = 'barjas-files' and public.can_menu('barjas'));");
  expect(sql).not.toContain("values ('pengadaan', 'barjas')");
});

test('new accounts cannot receive a dedicated Pengelola Pengadaan role; existing role stays compatible', () => {
  const accounts = read('js/akun.js');
  const access = read('js/akses.js');
  const bopEdge = read('supabase/functions/bop/index.ts');
  const bopSql = read('bop.sql');
  const barjasSql = read('barjas.sql');

  const accountRoles = accounts.match(/const AKUN_PERAN = \[([^\]]+)\]/);
  const accessRoles = access.match(/const AKSES_PERAN = \[([^\]]+)\]/);
  const edgeRoles = bopEdge.match(/const PERAN = \[([^\]]+)\]/);
  expect(accountRoles?.[1] || '').not.toContain('pengadaan');
  expect(accessRoles?.[1] || '').not.toContain('pengadaan');
  expect(edgeRoles?.[1] || '').not.toContain('pengadaan');

  for (const sql of [bopSql, barjasSql]) {
    const start = sql.indexOf('create or replace function public.handle_new_user()');
    const end = sql.indexOf('end $$;', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(sql.slice(start, end)).not.toContain("'pengadaan'");
  }
  expect(accounts).toContain('Pengelola Pengadaan (akun lama)');
  expect(bopEdge).toContain("role === 'pengadaan' && target.role === 'pengadaan'");
  expect(barjasSql).toContain("'pengadaan'))");
});
