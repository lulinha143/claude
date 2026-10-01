import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openView } from './support/shell';

// IMPORTING A SAVE REPLACES THE ENTIRE COMPANY.
//
// It used to do that straight from the file picker: no warning, no confirmation,
// and no message either way. One stray click could overwrite hours of play, and a
// malformed file gave the player nothing at all to go on.
//
// These tests pin the safety properties rather than the styling: the destructive
// step asks first and names what it would destroy, cancelling changes nothing, a
// bad file is refused with the current company left intact, and an export produces
// a file that identifies itself.

const SAVE = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 900_000, goldenNuts: 12, morale: 78, reputation: 640 },
  employees: { pip: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 } },
  collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true, language: 'en' },
};

async function openSettings(page: Page) {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    localStorage.setItem('wmno.lang', 'en');
  }, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await openView(page, 'settings');
  await expect(page.locator('.savebar')).toBeVisible();
}

// The company's name lives on its letterhead in the Archive's Company page.
async function company(page: Page) {
  await openView(page, 'company');
  return page.locator('.company-letterhead__name').innerText();
}

test('the save panel states when progress was last filed, and confirms a manual save', async ({
  page,
}) => {
  await openSettings(page);
  // A date alone cannot distinguish this session's save from yesterday's, so the
  // status carries a time.
  await expect(page.locator('.savebar__value')).toHaveText(/\d{1,2}:\d{2}/);
  await page.locator('.savebar__now').click();
  await expect(page.locator('.savebar__note--ok')).toBeVisible();
});

test('importing asks before replacing the company, and cancelling changes nothing', async ({
  page,
}) => {
  await openSettings(page);
  const other = { ...SAVE, company: { name: 'Acorn Holdings' } };
  const file = join(tmpdir(), `zw-import-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(other));

  await page.locator('.file-btn input[type=file]').setInputFiles(file);

  // It must ask, and the warning must name BOTH the file and what it would replace.
  const confirm = page.locator('.savebar__confirm');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Nutshell Inc.');
  await expect(confirm).toContainText('.json');

  await confirm.locator('.ghost-btn').click();
  await expect(confirm).toHaveCount(0);
  expect(await company(page)).toContain('Nutshell Inc.');
});

test('a malformed file is refused in plain language, leaving the company intact', async ({
  page,
}) => {
  await openSettings(page);
  const bad = join(tmpdir(), `zw-bad-${Date.now()}.json`);
  writeFileSync(bad, 'not a save file at all {{{');

  await page.locator('.file-btn input[type=file]').setInputFiles(bad);
  // A malformed file may be caught either at read time or on confirmation; both are
  // acceptable, but the player must end up told, and still own their company.
  const confirm = page.locator('.savebar__confirm');
  if (await confirm.count()) await confirm.locator('.danger-btn').click();

  const note = page.locator('.savebar__note--bad');
  await expect(note).toBeVisible();
  await expect(note).toContainText(/untouched/i);
  expect(await company(page)).toContain('Nutshell Inc.');
});

test('confirming an import actually replaces the company', async ({ page }) => {
  await openSettings(page);
  const other = { ...SAVE, company: { name: 'Acorn Holdings' } };
  const file = join(tmpdir(), `zw-good-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(other));

  await page.locator('.file-btn input[type=file]').setInputFiles(file);
  await page.locator('.savebar__confirm .danger-btn').click();
  await expect(page.locator('.savebar__confirm')).toHaveCount(0, { timeout: 10_000 });
  await openView(page, 'company');
  await expect(page.locator('.company-letterhead__name')).toContainText('Acorn Holdings', {
    timeout: 10_000,
  });
});

test('an exported save names the company and the moment it was taken', async ({ page }) => {
  await openSettings(page);
  const download = page.waitForEvent('download', { timeout: 10_000 });
  await page.locator('.ghost-btn', { hasText: 'Export save' }).first().click();
  const file = await download;
  // Was always `zooworkers-save.json`, so a second export became "(1)" and no file
  // said which company it held or when it was taken.
  expect(file.suggestedFilename()).toMatch(/^zooworkers_.+_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  await expect(page.locator('.savebar__note--ok')).toBeVisible();
});
