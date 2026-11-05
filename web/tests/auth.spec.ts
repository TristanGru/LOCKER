import { expect, test } from '@playwright/test';

// These tests start signed out; every other spec reuses the fleet session from global-setup.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ playwright, baseURL }) => {
  const fleet = await playwright.request.newContext({ baseURL });
  await fleet.post('/api/login', { data: { username: 'fleet.commander@us.navy.mil' } });
  const state = await (await fleet.get('/api/scenario/version')).json();
  await fleet.post('/api/reset', { data: { base_version: state.version } });
  await fleet.dispose();
});

test('signed out, the app asks for a username and the API refuses data', async ({ page, request }) => {
  expect((await request.get('/api/dashboard')).status()).toBe(401);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username').fill('somebody');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No account named');
  await expect(page.getByLabel('Selected ship')).toHaveCount(0);
});

test('a CO sees only their own ship and no fleet controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  // The page must run under the server's Content-Security-Policy without violations, signed out or in.
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Commanding Officer, USS ASHBY/ }).click();
  await expect(page.getByLabel('Signed in account')).toContainText('co.ashby');
  await expect(page.getByLabel('Selected ship')).toHaveValue('ASHBY');
  await expect(page.getByLabel('Selected ship').locator('option')).toHaveText(['USS ASHBY']);
  await expect(page.getByLabel('Selected ship')).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Shore Overview', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset demo' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Mission Overview', exact: true }).click();
  await expect(page.getByText('IRON HORIZON', { exact: true }).first()).toBeVisible();
  for (const other of ['TIDEWATCH', 'SEASHIELD', 'DEEP LANTERN', 'Standby E'])
    await expect(page.getByText(other, { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Change Feed', exact: true }).click();
  await expect(page.getByText(/Fleet staff release exercise events/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Next event/ })).toHaveCount(0);
  // Typing another unit's route does not reach it, and the API refuses another ship's data.
  await page.goto('/#/shore');
  await expect(page.getByRole('heading', { name: 'Ship Overview', exact: true })).toBeVisible();
  expect((await page.request.get('/api/graph/KESSLER')).status()).toBe(403);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: /Sign out/ }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect((await page.request.get('/api/graph/ASHBY')).status()).toBe(401);
  expect(errors.filter((e) => /Content Security Policy/.test(e))).toEqual([]);
});

test('the fleet account signs in by email and sees every unit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Username').fill('Fleet.Commander@us.navy.mil');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Signed in account')).toContainText('fleet.commander@us.navy.mil');
  await expect(page.getByLabel('Selected ship').locator('option')).toHaveText(['USS KESSLER', 'USS VARNELL', 'USS ASHBY']);
  await expect(page.getByRole('link', { name: 'Shore Overview', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mission Overview', exact: true }).click();
  for (const name of ['TIDEWATCH', 'IRON HORIZON', 'PIER SUPPORT: TIDEWATCH', 'Standby E'])
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});
