import { test, expect, type Page } from '@playwright/test';
import { openView } from './support/shell';

// LOADING A SAVE MUST NOT BURY THE GAME IN TOASTS.
//
// Achievements are evaluated at the end of every tick and anything newly
// satisfied announces itself as its own toast. That is correct for something the
// player just earned and wrong for something they earned long ago — and on the
// first tick after a load the two are indistinguishable, because the tick cannot
// tell whether the progress satisfying a condition happened a second ago or last
// week.
//
// So a save with real progress but no achievements recorded used to unlock a
// dozen at once and greet the player with a wall of toasts over the office
// (measured: a 15-deep queue, four cards held on screen for longer than five
// seconds). Three ordinary paths reach that state — a content update adding
// achievements, the schema repairing an invalid `achievements` record with
// `.catch({})`, and offline progression crossing several thresholds at once — so
// it is not merely a seeded-save artefact.
//
// `catchUpAchievementsQuietly()` in state/store.ts reconciles what a save already
// satisfies BEFORE the first tick and folds it into one summary line. These tests
// pin the player-facing outcome rather than the mechanism: a quiet boot, and
// nothing actually lost.

/** A save with plenty of progress and an EMPTY achievements record. */
const PROGRESSED_SAVE = {
  version: 10,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 900_000,
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 5_000_000, goldenNuts: 40, morale: 80, reputation: 1_600 },
  employees: {
    pip: { hired: true, level: 4, friendship: 50, room: 'founder-desk', x: 0.5 },
    bea: { hired: true, level: 4, friendship: 50, room: 'construction', x: 0.5 },
    moss: { hired: true, level: 4, friendship: 50, room: 'research', x: 0.5 },
  },
  upgrades: { 'room-sorting': 1, 'room-lab': 1, 'room-research': 1, 'room-construction': 1 },
  // Deliberately absent: `achievements`. The schema defaults it to {}, which is
  // exactly the state a repaired or pre-update save arrives in.
  stats: { totalNutsEarned: 2_000_000, totalClicks: 900, cratesCollected: 140 },
  collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true, language: 'en' },
};

async function bootWith(page: Page, save: Record<string, unknown>) {
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    localStorage.setItem('wmno.lang', 'en');
  }, save);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
}

/** Deepest the toast queue gets across the window a boot flood would occupy. */
async function peakQueue(page: Page): Promise<{ peak: number; texts: string[] }> {
  let peak = 0;
  const texts = new Set<string>();
  for (let i = 0; i < 10; i += 1) {
    const seen = await page.evaluate(() => {
      const box = document.querySelector('.toasts');
      if (!box) return { size: 0, texts: [] as string[] };
      return {
        size: Number(box.getAttribute('data-queue-size') ?? 0),
        texts: [...box.children].map((c) => (c.textContent ?? '').trim()),
      };
    });
    peak = Math.max(peak, seen.size);
    seen.texts.forEach((t) => t && texts.add(t));
    await page.waitForTimeout(500);
  }
  return { peak, texts: [...texts] };
}

test('loading a progressed save does not bury the office in achievement toasts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await bootWith(page, PROGRESSED_SAVE);

  const { peak, texts } = await peakQueue(page);

  // The wall was 15 deep. A handful is fine — production keeps running during the
  // sample window, so genuinely-new unlocks may legitimately arrive — but it must
  // not be the whole achievement list.
  expect(peak, `boot toast queue peaked at ${peak}: ${texts.join(' | ')}`).toBeLessThanOrEqual(6);

  // Whatever the save already satisfied is reported as ONE line, not N.
  const summaries = texts.filter((t) => /earlier achievements? recorded/i.test(t));
  expect(summaries.length, `expected a single catch-up summary, got: ${texts.join(' | ')}`).toBe(1);
  expect(summaries[0]).toMatch(/\d+\s+earlier achievements? recorded/i);
});

test('the catch-up records the achievements and pays their rewards rather than hiding them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await bootWith(page, PROGRESSED_SAVE);
  await page.waitForTimeout(1_500);

  // Read the ACHIEVEMENTS SCREEN, not localStorage: the periodic autosave has not
  // necessarily fired this early, so the stored copy is still the seed and proves
  // nothing either way. The screen renders live engine state, which is also what
  // the player would actually go and check.
  await openView(page, 'achievements');
  await expect(page.locator('.view--achievements')).toBeVisible();
  const unlocked = page.locator('.ach.is-unlocked');

  // Quietly is not the same as secretly. The achievements must be genuinely
  // recorded — folding the toasts together while dropping the unlocks would
  // silently rob the player of their golden-nut rewards.
  await expect(unlocked.first()).toBeVisible();
  expect(await unlocked.count(), 'caught-up achievements must be recorded').toBeGreaterThan(5);
});

test('a brand-new game gets no catch-up summary, because it has nothing to catch up', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('wmno.lang', 'en');
    localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: true }));
  });
  await page.goto('/');
  await page.waitForTimeout(2_500);

  const texts = await page.evaluate(() =>
    [...(document.querySelector('.toasts')?.children ?? [])].map((c) =>
      (c.textContent ?? '').trim(),
    ),
  );
  expect(texts.filter((t) => /earlier achievements? recorded/i.test(t))).toHaveLength(0);
});
