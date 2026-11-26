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
  expect(pages).toContain("var kunci = 'paket.v2.' + App.state.user.id + '.' + App.state.tahun;");
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

test('BMN and Barjas are separate account roles; old Pengelola Pengadaan stays legacy-only', () => {
  const accounts = read('js/akun.js');
  const access = read('js/akses.js');
  const bopEdge = read('supabase/functions/bop/index.ts');
  const bopSql = read('bop.sql');
  const barjasSql = read('barjas.sql');
  const core = read('js/core.js');
  const bmnUi = read('js/bmn.js');
  const bmnGas = read('apps-script/BMN.gs');

  const accountRoles = accounts.split('const AKUN_PERAN = [')[1]?.split(']')[0] || '';
  const accessRoles = access.split('const AKSES_PERAN = [')[1]?.split(']')[0] || '';
  const edgeRoles = bopEdge.split('const PERAN = [')[1]?.split(']')[0] || '';
  for (const roles of [accountRoles, accessRoles, edgeRoles]) {
    expect(roles).toContain("'bmn'");
    expect(roles).toContain("'barjas'");
    expect(roles).not.toContain('bmn_barjas');
    expect(roles).not.toContain('pengadaan');
  }
  expect(core).toContain("bmn: 'BMN', barjas: 'Barjas'");
  expect(accounts).toContain('Role BMN dapat mengelola inventaris BMN lintas satker.');
  expect(accounts).toContain('Role Barjas mendapat akses ke seluruh modul BARJAS.');
  expect(access).toContain("bmn: ['bmn']");
  expect(access).toContain("barjas: ['barjas']");

  for (const sql of [bopSql, barjasSql]) {
    const start = sql.indexOf('create or replace function public.handle_new_user()');
    const end = sql.indexOf('end $$;', start);
    expect(start).toBeGreaterThanOrEqual(0);
    const trigger = sql.slice(start, end);
    expect(trigger).toContain("'bmn'");
    expect(trigger).toContain("'barjas'");
    expect(trigger).not.toContain("'bmn_barjas'");
    expect(trigger).not.toContain("'pengadaan'");
    expect(sql).toContain("'bmn','barjas'");
  }
  expect(bopSql).toContain("values ('bmn','bmn'),('barjas','barjas')");
  expect(barjasSql).toContain("values ('barjas','barjas')");
  expect(bmnUi).toContain("me.role === 'bmn'");
  expect(bmnUi).not.toContain("me.role === 'barjas'");
  expect(bmnGas).toContain("role === 'admin' || role === 'bmn'");
  expect(bmnGas).not.toContain("role === 'barjas'");
  expect(bopEdge).toContain("me.role === 'admin' || me.role === 'bmn'");
  expect(bopEdge).not.toContain("me.role === 'barjas'");
  expect(barjasSql).toContain("'pengadaan','bmn','barjas'))");
});
