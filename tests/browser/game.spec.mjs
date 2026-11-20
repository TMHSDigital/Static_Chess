import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('the board starts cleanly and the worker replies to e4', async ({ page }) => {
  const runtimeErrors = [];
  const workers = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('worker', (worker) => workers.push(worker.url()));
  await page.exposeFunction('recordCspViolation', (directive) => runtimeErrors.push(directive));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void window.recordCspViolation(event.violatedDirective);
    });
  });

  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(64);
  await page.getByLabel('Opponent').selectOption('easy');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('gridcell', { name: /^white pawn on e2\b/i }).click();
  await page.getByRole('gridcell', { name: /^e4\b/i }).click();

  await expect(page.locator('#move-history [data-ply="1"]')).toHaveText('e4');
  await expect(page.locator('#move-history [data-ply="2"]')).toBeVisible({ timeout: 5000 });
  expect(workers.some((url) => new URL(url).pathname === '/js/ai-worker.js')).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test('the service worker restores the board offline after a reload', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(64);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('gridcell')).toHaveCount(64);
});

test('a PGN loaded in the dialog can be downloaded with the same moves', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.locator('#import-text').fill('[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 *');
  await page.getByRole('button', { name: 'Load game', exact: true }).click();
  await expect(page.locator('#move-history [data-ply="4"]')).toHaveText('Nc6');

  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PGN', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('static-chess-game.pgn');
  const pgn = await readFile(await file.path(), 'utf8');
  expect(pgn).toMatch(/1\.\s+e4\s+e5\s+2\.\s+Nf3\s+Nc6\s+\*/);
});

test('? opens the shortcuts panel and Escape closes it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(64);
  await page.keyboard.press('?');
  const panel = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('tbody tr', { hasText: 'Open this panel' })).toHaveCount(1);
  await expect(panel.locator('tbody tr').first()).toContainText('?');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});
