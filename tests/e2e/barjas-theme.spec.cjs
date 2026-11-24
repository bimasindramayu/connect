const { test, expect } = require('@playwright/test');

const rgb = (hex) => {
  const h = hex.replace('#', '');
  const value = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
};

const luminance = (color) => {
  const values = color.match(/\d+/g).slice(0, 3).map((x) => {
    const v = Number(x) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};

const contrast = (foreground, background) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const style = (locator) => locator.evaluate((el) => {
  const s = getComputedStyle(el);
  return {
    color: s.color,
    background: s.backgroundColor,
    border: s.borderColor,
    position: s.position,
    opacity: s.opacity,
    boxShadow: s.boxShadow
  };
});

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/barjas-theme.html');
  await page.locator('#barjas-root').waitFor();
});

test('01 - tombol: default, primary, danger, ghost, disabled, hover dan kontras', async ({ page }) => {
  const normal = await style(page.locator('#btn-default'));
  const primary = await style(page.locator('#btn-primary'));
  const danger = await style(page.locator('#btn-danger'));
  const ghost = await style(page.locator('#btn-ghost'));
  const disabled = await style(page.locator('#btn-disabled'));

  expect(normal.background).toBe('rgb(255, 255, 255)');
  expect(normal.color).toBe(rgb('#566a7f'));
  expect(primary.background).toBe(rgb('#5f61e6'));
  expect(primary.color).toBe('rgb(255, 255, 255)');
  expect(danger.color).toBe(rgb('#c62828'));
  expect(ghost.background).toBe('rgb(255, 255, 255)');
  expect(disabled.background).toBe(rgb('#f1f2f6'));
  expect(contrast(primary.color, primary.background)).toBeGreaterThanOrEqual(4.5);

  await page.locator('#btn-primary').hover();
  expect((await style(page.locator('#btn-primary'))).background).toBe(rgb('#4f50c5'));
});

test('02 - text field: input, textarea, select, Bootstrap controls, readonly, disabled dan focus', async ({ page }) => {
  for (const id of ['#field-native', '#field-inp', '#field-bs', '#field-bs-select']) {
    const s = await style(page.locator(id));
    expect(s.color, id + ' text').toBe(rgb('#566a7f'));
    expect(s.background, id + ' background').toBe('rgb(255, 255, 255)');
    expect(s.border, id + ' border').toBe(rgb('#d9dee7'));
  }

  const labelColor = await page.locator('#field-section .lbl').first().evaluate((el) => getComputedStyle(el).color);
  expect(labelColor).toBe(rgb('#566a7f'));
  const placeholderColor = await page.locator('#field-native').evaluate((el) => getComputedStyle(el, '::placeholder').color);
  expect(contrast(placeholderColor, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(4.5);

  await page.locator('#field-native').focus();
  expect((await style(page.locator('#field-native'))).border).toBe(rgb('#696cff'));

  expect((await style(page.locator('#field-readonly'))).background).toBe(rgb('#f1f2f6'));
  expect((await style(page.locator('#field-disabled'))).background).toBe(rgb('#f1f2f6'));
  expect((await style(page.locator('#field-textarea'))).color).toBe(rgb('#566a7f'));
});

test('03 - modal: overlay, posisi, teks, header, body, footer, close dan tombol aksi', async ({ page }) => {
  await page.locator('#sample-modal').evaluate((el) => { el.hidden = false; });
  const modal = await style(page.locator('#sample-modal .modal'));
  const head = await style(page.locator('#sample-modal .modal-head'));
  const body = await style(page.locator('#sample-modal .modal-body'));
  const foot = await style(page.locator('#sample-modal .modal-foot'));
  const overlayZ = await page.locator('#sample-modal').evaluate((el) => Number(getComputedStyle(el).zIndex));
  const closeColor = await page.locator('#modal-close').evaluate((el) => getComputedStyle(el).color);

  expect(modal.position).toBe('relative');
  expect(modal.background).toBe('rgb(255, 255, 255)');
  expect(modal.color).toBe(rgb('#566a7f'));
  expect(head.background).toBe('rgb(255, 255, 255)');
  expect(head.color).toBe(rgb('#566a7f'));
  expect(body.background).toBe('rgb(255, 255, 255)');
  expect(body.color).toBe(rgb('#566a7f'));
  expect(foot.background).toBe(rgb('#f8f9fc'));
  expect(foot.color).toBe(rgb('#566a7f'));
  expect(closeColor).toBe(rgb('#65748a'));
  expect(overlayZ).toBeGreaterThan(1030);
  expect((await style(page.locator('#modal-save'))).color).toBe('rgb(255, 255, 255)');
});

test('04 - halaman migrasi: Bootstrap utility, form-select dan tabel tetap konsisten', async ({ page }) => {
  const select = await style(page.locator('#migrasi-table .form-select'));
  const table = await style(page.locator('#migrasi-table'));
  const header = await style(page.locator('#migrasi-table thead th').first());
  const secondary = await page.locator('#migration-secondary').evaluate((el) => getComputedStyle(el).color);
  const success = await page.locator('#migration-success').evaluate((el) => getComputedStyle(el).color);

  expect(select.color).toBe(rgb('#566a7f'));
  expect(select.background).toBe('rgb(255, 255, 255)');
  expect(table.color).toBe(rgb('#566a7f'));
  expect(header.background).toBe(rgb('#f8f9fc'));
  expect(header.color).toBe(rgb('#566a7f'));
  expect(secondary).toBe(rgb('#65748a'));
  expect(success).toBe(rgb('#2d6b12'));
});

test('05 - tabel, tab dan badge: status semantik terpisah dari warna primer', async ({ page }) => {
  const th = await style(page.locator('#barjas-table th').first());
  const activeTab = await page.locator('#sample-tabs button.aktif').evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, border: s.borderBottomColor };
  });
  const ok = await style(page.locator('#sample-badges .badge.ok'));
  const warn = await style(page.locator('#sample-badges .badge.warn'));
  const bad = await style(page.locator('#sample-badges .badge.bad'));
  const info = await style(page.locator('#sample-badges .badge.info'));
  const docNo = await style(page.locator('#document-item .dok-no'));
  const hpsCell = await style(page.locator('#hps-table td.pilih'));

  expect(th.background).toBe(rgb('#f8f9fc'));
  expect(th.color).toBe(rgb('#65748a'));
  expect(activeTab.color).toBe(rgb('#4f50c5'));
  expect(activeTab.border).toBe(rgb('#5f61e6'));
  expect(ok.background).toBe(rgb('#e8f8dc'));
  expect(ok.color).toBe(rgb('#2d6b12'));
  expect(warn.color).toBe(rgb('#8a5f10'));
  expect(bad.color).toBe(rgb('#c62828'));
  expect(info.color).toBe(rgb('#00718e'));
  expect(docNo.background).toBe(rgb('#52a83e'));
  expect(hpsCell.background).toBe(rgb('#e7e7ff'));
});

test('06 - penampil dokumen: dialog, pilihan halaman dan tombol tutup terbaca', async ({ page }) => {
  await page.locator('#barjas-vdlg').evaluate((el) => el.showModal());
  const dialog = await style(page.locator('#barjas-vdlg'));
  const close = await style(page.locator('#barjas-vdlg .vw-close'));
  const pageLabel = await style(page.locator('#barjas-vdlg .vw-page'));
  const beforeDisplay = await page.locator('#barjas-vdlg').evaluate((el) => getComputedStyle(el, '::before').display);

  expect(dialog.background).toBe(rgb('#f8f9fc'));
  expect(close.background).toBe(rgb('#5f61e6'));
  expect(close.color).toBe('rgb(255, 255, 255)');
  expect(pageLabel.color).toBe(rgb('#00718e'));
  expect(beforeDisplay).toBe('none');
  await page.locator('#barjas-vdlg').evaluate((el) => el.close());
});

test('07 - CSS BARJAS tidak mengubah tombol di luar modul BIMASATU', async ({ page }) => {
  const outside = await style(page.locator('#outside-btn'));
  expect(outside.background).toBe(rgb('#696cff'));
  expect(outside.color).toBe('rgb(255, 255, 255)');
});

test('framework Sneat yang sama dengan index BIMASATU berhasil dimuat', async ({ page }) => {
  const loaded = await page.locator('#sneat-css').evaluate((el) => !!el.sheet);
  expect(loaded).toBeTruthy();
});
