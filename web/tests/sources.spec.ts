import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// File mutation is only enabled by the isolated runner, never against a default server.
test('source replacement refreshes the live workspace without restarting', async ({ page, request }) => {
  test.skip(!process.env.LOCKER_TEST_DATA, 'Run through scripts/check_demo.py for an isolated disposable dataset');
  const root = process.env.LOCKER_TEST_DATA!;
  const file = path.join(root, 'KESSLER', 'requisition_status.csv');
  const original = await readFile(file, 'utf8');
  const version = async () => (await (await request.get('/api/scenario/version')).json()).version;
  await request.post('/api/reset', { data: { base_version: await version() } });
  await request.post('/api/events/play', { data: { base_version: await version() } });
  const before = await (await request.get('/api/dashboard')).json();
  try {
    await page.goto('/?legacy=1');
    await page.getByRole('button', { name: 'Evidence & feed', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Source health & refresh' })).toBeVisible();
    await writeFile(file, original.replace('BB 2026-11-05', 'BB 2026-11-12'), 'utf8');
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Refresh source snapshot?' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm exercise change' }).click();
    await expect.poll(async () => (await (await request.get('/api/dashboard')).json()).state.source_revision).not.toBe(before.state.source_revision);
    const after = await (await request.get('/api/dashboard')).json();
    expect(after.forecast.missions[0].p_ready).toBeLessThan(before.forecast.missions[0].p_ready);
    await expect(page.getByLabel('Source health', { exact: true })).toContainText(after.state.source_revision);
    await expect(page.locator('.playback-controls')).toContainText('1 / 4 events');
    await page.getByRole('button', { name: 'Mission overview', exact: true }).click();
    await expect(page.locator('.mission-row').first().locator('.status')).toContainText('At risk');
    await expect(page.locator('.mission-row').first()).toContainText('Across event interval');
    await page.getByRole('button', { name: 'Readiness brief', exact: true }).click();
    await page.getByRole('button', { name: 'Generate brief' }).click();
    await expect(page.locator('.brief-document')).toContainText('sampled event interval');
    // A malformed candidate must keep the active revision and tell the presenter.
    await writeFile(file, 'not a valid CSV export', 'utf8');
    await page.getByRole('button', { name: 'Evidence & feed', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm exercise change' }).click();
    await expect(page.getByText(/Source refresh failed. Showing the last usable snapshot/)).toBeVisible();
    expect((await (await request.get('/api/dashboard')).json()).state.source_revision).toBe(after.state.source_revision);
  } finally {
    await writeFile(file, original, 'utf8');
    await request.post('/api/sources/refresh', { data: { base_version: await version(), reset_scenario: true } });
  }
});

test('invalid assumption preview leaves exercise unchanged and explains the error', async ({ page, request }) => {
  const initial = await (await request.get('/api/scenario/version')).json();
  await request.post('/api/reset', { data: { base_version: initial.version } });
  const before = await (await request.get('/api/scenario/version')).json();
  await page.goto('/?legacy=1');
  await page.getByRole('button', { name: 'What-if lab', exact: true }).click();
  await page.getByLabel('Proposal', { exact: true }).selectOption('assumption');
  await page.getByLabel('Editable parameter').selectOption('repair_after_part_days.min');
  await page.getByLabel('Proposed value').fill('3');
  await page.getByRole('button', { name: 'Calculate preview' }).click();
  await expect(page.getByRole('alert')).toContainText('min <= mode <= max');
  expect((await (await request.get('/api/scenario/version')).json()).version).toBe(before.version);
});

test('system evidence remains accessible without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (type: string, ...args: unknown[]) {
        return type.includes('webgl') ? null : original.apply(this, [type, ...args] as Parameters<typeof original>);
      },
    });
  });
  await page.goto('/?legacy=1');
  await page.getByRole('button', { name: 'Ship overview', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('3D rendering is unavailable');
  await page.locator('.system-grid button').filter({ hasText: 'SPY1D-CW' }).click();
  await expect(page.locator('.system-inspector h2')).toContainText('Radar cooling water pump');
  await page.locator('.system-inspector .gate-evidence summary').first().click();
  await page.locator('.system-inspector .source-link').first().click();
  await expect(page.getByRole('dialog', { name: 'Source evidence' })).toBeVisible();
  // Source CSVs no longer carry a SYNTHETIC banner line; check the record itself is shown.
  await expect(page.locator('.source-lines')).toContainText('KESSLER');
});
