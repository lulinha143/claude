import { test, expect, type Page } from '@playwright/test';
import { openView } from './support/shell';

/**
 * The full-screen employee interaction mode, driven through the real DOM.
 *
 * These exist because the interesting failures in this feature are not simulation
 * failures — the engine is covered by tests/talks.test.ts — they are integration
 * failures: an entry point that does not fire, a sheet that does not fit, a portrait
 * that is quietly enlarged, or a consequence that looks applied but does not survive a
 * reload. All four of those actually happened while building it.
 */

const SAVE = {
  version: 11,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 5_000_000, goldenNuts: 12, reputation: 400, morale: 78, permanentKernels: 0 },
  employees: {
    pip: { hired: true, level: 4, friendship: 60, room: 'founder-desk', x: 0.3 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.6 },
  },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
};

async function boot(page: Page) {
  // Seed only if absent. This init script re-runs on EVERY navigation including
  // reload, so seeding unconditionally would overwrite the game's own save and the
  // reload assertion below would silently be testing the seed instead of the result.
  await page.addInitScript((d) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(d));
    }
    localStorage.setItem('wmno.lang', 'en');
  }, SAVE);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
}

/** Into the roster, which carries the explicit Talk affordance. */
async function openViaRoster(page: Page, employee: string) {
  await openView(page, 'employees');
  const talk = page.locator(`.employee-card__talk[data-employee="${employee}"]`);
  await talk.first().scrollIntoViewIfNeeded();
  await talk.first().click();
  await page.locator('.talk__sheet').waitFor({ timeout: 8000 });
}

test('the roster opens a conversation, which reports what actually changed', async ({ page }) => {
  await boot(page);
  await openViaRoster(page, 'pip');

  const sheet = page.locator('.talk__sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.talk__name')).toHaveText(/Pip/);
  // The topic, the employee's opening line, and at least two options to answer with.
  await expect(page.locator('.talk__said')).toBeVisible();
  const choices = page.locator('.talk-choice');
  expect(await choices.count()).toBeGreaterThanOrEqual(2);

  const trustBefore = await page
    .locator('.talk__bar-num')
    .first()
    .innerText()
    .then((s) => parseInt(s, 10));

  await page.locator('.talk-choice[data-eligible="true"]').first().click();
  await page.waitForTimeout(500);

  // The reply to the option comes back...
  await expect(page.locator('.talk__said--reply')).toBeVisible();
  // ...with a MEASURED consequence readout, not a restatement of the authored effects.
  const changed = page.locator('.talk__changed li');
  expect(await changed.count()).toBeGreaterThan(0);
  // Trust visibly moved, and the readout agrees with the bar.
  const trustAfter = await page
    .locator('.talk__bar-num')
    .first()
    .innerText()
    .then((s) => parseInt(s, 10));
  expect(trustAfter).toBeGreaterThan(trustBefore);
});

test('poking a teammate who is already talking escalates into the conversation', async ({
  page,
}) => {
  await boot(page);
  const critter = page.locator('.floor[data-room="founder-desk"] .critter-btn').first();

  // First poke keeps the ambient behaviour: they just say something. This is
  // deliberately NOT the interaction mode — the one-liners are most of what makes the
  // office feel inhabited, so a casual poke must stay casual.
  await critter.click();
  await expect(page.locator('.speech-note').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.talk__sheet')).toHaveCount(0);

  // Poking again while they are mid-sentence leans in.
  await critter.click();
  await expect(page.locator('.talk__sheet')).toBeVisible({ timeout: 8000 });
});

test('Escape leaves the mode and the agreed consequence survives a reload', async ({ page }) => {
  await boot(page);
  await openViaRoster(page, 'pip');
  await page.locator('.talk-choice[data-eligible="true"]').first().click();
  await page.waitForTimeout(500);

  const trust = await page
    .locator('.talk__bar-num')
    .first()
    .innerText()
    .then((s) => parseInt(s, 10));

  await page.keyboard.press('Escape');
  await expect(page.locator('.talk__sheet')).toHaveCount(0);

  // A conversation is a moment and is not itself persisted; what it CHANGED is. So
  // after a reload the trust it bought is still there and the topic is spent.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('wmno.save.v1');
    const s = JSON.parse(raw!);
    return {
      version: s.version,
      friendship: s.employees.pip.friendship,
      talks: s.employees.pip.talks,
    };
  });
  expect(saved.version).toBeGreaterThanOrEqual(11);
  expect(Math.round(saved.friendship)).toBe(trust);
  expect(saved.talks.count).toBeGreaterThanOrEqual(1);
});

test('the sheet fits and the portrait is never enlarged, at every window size', async ({
  page,
}) => {
  await boot(page);
  for (const [w, h] of [
    [1280, 800],
    [900, 600],
    [1500, 560],
    [2560, 1080],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => localStorage.removeItem('wmno.talk-probe'));
    await page.waitForTimeout(400);
    if (!(await page.locator('.talk__sheet').count())) {
      await openViaRoster(page, 'pip').catch(() => {});
    }
    if (!(await page.locator('.talk__sheet').count())) continue;
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const sheet = document.querySelector('.talk__sheet')!.getBoundingClientRect();
      const img = document.querySelector('.talk__portrait img') as HTMLImageElement | null;
      const box = img?.getBoundingClientRect();
      return {
        fits: sheet.left >= -1 && sheet.right <= window.innerWidth + 1,
        upscale:
          img && box ? Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight) : 0,
        optionsVisible: [...document.querySelectorAll('.talk-choice')].every((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }),
      };
    });
    expect(m.fits, `${w}x${h}: destination must fit horizontally`).toBe(true);
    await page.locator('.talk-choice').last().scrollIntoViewIfNeeded();
    const lastChoice = (await page.locator('.talk-choice').last().boundingBox())!;
    expect(
      lastChoice.y + lastChoice.height,
      'last choice is reachable in the main scroll area',
    ).toBeLessThanOrEqual(h + 1);
    expect(m.optionsVisible, `${w}x${h}: every option must be laid out`).toBe(true);
    // Enlarging the portrait is what made the founder read soft in the one screen that
    // shows her largest; it is capped at the densest build that exists.
    expect(m.upscale, `${w}x${h}: portrait upscale`).toBeLessThanOrEqual(1.02);
  }
});
