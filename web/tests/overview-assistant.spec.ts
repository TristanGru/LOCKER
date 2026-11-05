import { test, expect } from '@playwright/test';

test('ship and shore overview expose loaded source records and reject actions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open overview assistant', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Overview assistant' });
  await expect(panel.getByText(/Whole unit:/).first()).toBeVisible();
  await panel.getByText(/Loaded sources ·/).click();
  await expect(panel.locator('summary').filter({ hasText: /csv/ }).first()).toBeVisible();
  await panel.getByLabel('Ask about this unit').fill('approve this fix');
  await panel.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(panel.getByText(/Actions, simulations and unsupported/)).toBeVisible();
  await page.goto('/#/shore');
  await page.getByRole('button', { name: 'Open overview assistant', exact: true }).click();
  await expect(panel.getByRole('heading', { name: /Command brief · Shore/ })).toBeVisible();
  await expect(panel.getByText(/Whole unit:/).first()).toBeVisible();
  await panel.getByText('Uncertainty and data limitations').click();
  await expect(panel.getByText(/Mock installation/)).toBeVisible();
});

test('assistant stays collapsed, loads on demand, closes with Escape and fits mobile', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (request.url().includes('/api/overview-assistant/brief')) requests++; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const launcher = page.getByRole('button', { name: 'Open overview assistant', exact: true });
  await expect(launcher).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Ask LOCKER' })).toHaveCount(0);
  expect(requests).toBe(0);
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Ask LOCKER' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Whole unit:/).first()).toBeVisible();
  expect(requests).toBeGreaterThan(0);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await launcher.click();
  await page.getByRole('button', { name: 'Close overview assistant', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('MiniLM runs locally via Transformers.js without external requests', async ({ page }) => {
  test.setTimeout(180000);
  const external: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().includes('127.0.0.1')) external.push(request.url()); });
  await page.goto('/#/shore');
  await page.getByRole('button', { name: 'Open overview assistant', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Overview assistant' });
  await expect(panel.getByText(/Whole unit:/).first()).toBeVisible();
  await panel.getByLabel('Enable local MiniLM semantic search (Transformers.js)').check();
  await panel.getByLabel('Ask about this unit').fill('show evidence for shore capability status');
  await panel.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(panel.getByText(/Local MiniLM \+ lexical retrieval/)).toBeVisible({ timeout: 90000 });
  await expect(panel.getByText(/verified template facts|Verified overview facts/)).toBeVisible();
  expect(external).toEqual([]);
});
