import { test, expect, type Page } from '@playwright/test';

// End-to-end proof that the VISIBLE header mute button silences the whole game
// (not just AudioManager methods). Uses a read-only diagnostics hook that
// reports the live effective gain of every audio bus.

async function boot(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem(
        'wmno.save.v1',
        JSON.stringify({
          version: 3,
          onboardingComplete: true,
          lastSaved: Date.now(),
          resources: { nuts: 100000, goldenNuts: 5, reputation: 200, morale: 80, permanentKernels: 0 },
        }),
      );
    }
  });
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  // a real user gesture so the AudioManager resumes its context
  await page.mouse.click(550, 400);
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn').first();
    if (await ok.count()) await ok.click().catch(() => {});
    await page.waitForTimeout(120);
  }
}

interface Diag {
  flags: { muted: boolean; quiet: boolean; focus: boolean };
  masterGain: number;
  buses: Record<'music' | 'ambience' | 'ui' | 'sfx', number>;
  activeSources: number;
}
const diag = (page: Page): Promise<Diag> =>
  page.evaluate(() => (window as unknown as { __wmnoAudioDiag: () => Diag }).__wmnoAudioDiag());

test('the visible mute button silences every audio bus and persists', async ({ page }) => {
  await boot(page);
  const btn = page.getByTestId('mute-toggle');
  await expect(btn).toBeVisible();

  // unmuted to start: master + buses are audible
  const before = await diag(page);
  expect(before.flags.muted).toBe(false);
  expect(before.masterGain).toBeGreaterThan(0);
  expect(before.buses.music).toBeGreaterThan(0);
  expect(before.buses.sfx).toBeGreaterThan(0);
  await page.screenshot({ path: 'visual-artifacts/mute-unmuted.png' });

  // click the visible button
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveClass(/is-muted/);
  await page.screenshot({ path: 'visual-artifacts/mute-muted.png' });

  // EVERY effective bus is now zero
  const muted = await diag(page);
  expect(muted.flags.muted).toBe(true);
  expect(muted.masterGain).toBe(0);
  for (const ch of ['music', 'ambience', 'ui', 'sfx']) expect(muted.buses[ch]).toBe(0);

  // a sound started AFTER muting is also silent (no new source is created)
  const srcBefore = muted.activeSources;
  await page.getByRole('button', { name: /Upgrades|Melhorias/i }).click().catch(() => {});
  await page.waitForTimeout(200);
  const afterClick = await diag(page);
  expect(afterClick.masterGain).toBe(0);
  expect(afterClick.activeSources).toBeLessThanOrEqual(srcBefore);

  // persisted to the save
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wmno.save.v1') || '{}'));
  expect(saved.settings.masterMuted).toBe(true);

  // persists across a reload
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await expect(page.getByTestId('mute-toggle')).toHaveAttribute('aria-pressed', 'true');
  const afterReload = await diag(page);
  expect(afterReload.masterGain).toBe(0);

  // unmute restores audible buses
  await page.getByTestId('mute-toggle').click();
  const restored = await diag(page);
  expect(restored.flags.muted).toBe(false);
  expect(restored.masterGain).toBeGreaterThan(0);
  expect(restored.buses.music).toBeGreaterThan(0);
});
