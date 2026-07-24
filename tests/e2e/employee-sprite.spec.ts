import { test, expect, type Page } from '@playwright/test';

// Proves Bea's FINAL animated artwork (an optimized, looping APNG) is wired in
// correctly: it renders in her department, actually animates (frames advance),
// keeps the SAME <img> across React re-renders (so the loop never restarts on
// ordinary state churn), and degrades to a single static poster frame when the
// player prefers reduced motion. Screenshots are also written for inspection.

const DIR = 'visual-artifacts';

function saveWith(extra: Record<string, unknown>) {
  return {
    version: 7,
    onboardingComplete: true,
    lastSaved: Date.now(),
    company: { name: 'Nutty Co.' },
    resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
    employees: {
      pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.5 },
      bea: { hired: true, level: 4, friendship: 60, room: 'construction', x: 0.5 },
    },
    collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
    ...extra,
  };
}

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, save);
}

async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
  await page.waitForTimeout(200);
}

async function openConstruction(page: Page) {
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.locator('.floor[data-room="construction"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

test("Bea's animated workstation sprite renders and loops in her department", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, saveWith({}));
  await page.goto('/');
  await openConstruction(page);

  const sprite = page.locator('.floor[data-room="construction"] .critter-btn--sprite .employee-sprite');
  await expect(sprite).toHaveCount(1);
  await expect(sprite).toBeVisible();

  // The animated APNG (not the poster) is the source, and it decoded.
  const src = await sprite.getAttribute('src');
  expect(src).toContain('employees/bea.png');
  const natural = await sprite.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  expect(natural).toBeGreaterThan(0);

  await page.screenshot({ path: `${DIR}/bea-construction.png` });

  // Frames advance: two element captures ~600ms apart must differ (30fps art).
  const a = await sprite.screenshot();
  await page.waitForTimeout(600);
  const b = await sprite.screenshot();
  expect(Buffer.compare(a, b)).not.toBe(0);

  // The <img> is NOT remounted by ordinary re-renders: grab the node, trigger a
  // re-render by interacting, and confirm the very same element persists and is
  // still the animated source (the loop is never reset by React state churn).
  const handle = await sprite.elementHandle();
  await page.locator('.floor[data-room="construction"] .critter-btn').first().click();
  await page.waitForTimeout(300);
  const stillThere = await handle!.evaluate(
    (el) => el.isConnected && (el as HTMLImageElement).currentSrc.includes('employees/bea.png'),
  );
  expect(stillThere).toBe(true);

  // And it is still animating after the interaction.
  const c = await sprite.screenshot();
  await page.waitForTimeout(600);
  const d = await sprite.screenshot();
  expect(Buffer.compare(c, d)).not.toBe(0);
});

test('reduced motion swaps Bea to a static poster frame', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, saveWith({ settings: { reducedMotion: true } }));
  await page.goto('/');
  await openConstruction(page);

  const sprite = page.locator('.floor[data-room="construction"] .critter-btn--sprite .employee-sprite');
  await expect(sprite).toHaveCount(1);
  const src = await sprite.getAttribute('src');
  expect(src).toContain('employees/bea-poster.png');

  // A poster is static: two captures must be identical.
  const a = await sprite.screenshot();
  await page.waitForTimeout(600);
  const b = await sprite.screenshot();
  expect(Buffer.compare(a, b)).toBe(0);
});
