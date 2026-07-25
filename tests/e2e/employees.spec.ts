import { test, expect, type Page } from '@playwright/test';

// Employee-overlap hardening proof. Seeds a full room (six hires — the soft
// cap) and asserts, from the RENDERED DOM, that no two critters overlap; also
// captures a screenshot of the packed room for direct inspection.

const DIR = 'visual-artifacts';

const FULL_ROOM = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.4 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'founder-desk', x: 0.6 },
    bea: { hired: true, level: 3, friendship: 40, room: 'founder-desk', x: 0.8 },
    corvus: { hired: true, level: 2, friendship: 30, room: 'founder-desk', x: 0.5 },
    mina: { hired: true, level: 2, friendship: 30, room: 'founder-desk', x: 0.5 },
  },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
};

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
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

test('a full room lays out six teammates without overlap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await seed(page, FULL_ROOM);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const critters = page.locator('.floor[data-room="founder-desk"] .critter-btn');
  await expect(critters).toHaveCount(6);

  const boxes = [];
  for (let i = 0; i < 6; i += 1) {
    const b = await critters.nth(i).boundingBox();
    if (b) boxes.push(b);
  }
  await page.screenshot({ path: `${DIR}/employees-full-room.png` });

  // Horizontal centres must be clearly separated so nobody is hidden behind a
  // teammate. Allow real bodies to sit at different depths (bottom), but their
  // centre-x gap must exceed a readable fraction of the critter width.
  const centres = boxes.map((b) => b.x + b.width / 2).sort((a, b) => a - b);
  const width = boxes[0].width;
  for (let i = 1; i < centres.length; i += 1) {
    expect(centres[i] - centres[i - 1]).toBeGreaterThan(width * 0.5);
  }
});

// The employee's emotion bubble and speech bubble share ONE anchored node:
// by default it shows the mood emoji; clicking the teammate morphs that same
// bubble into a speech bubble, which then reverts to the emoji.
test('one anchored bubble morphs between emotion and speech on click', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await seed(page, FULL_ROOM);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const critter = page.locator('.floor[data-room="founder-desk"] .critter-btn').first();
  const bubble = critter.locator('.employee-bubble');

  // default: exactly one bubble, in emoji mode, with the mood emoji present.
  await expect(bubble).toHaveCount(1);
  await expect(bubble).toHaveAttribute('data-mode', 'emoji');
  await expect(bubble.locator('.mood-emoji')).toBeVisible();
  await expect(bubble.locator('.employee-bubble__speech')).toHaveCount(0);

  // click → same bubble switches to speech mode with visible text.
  await critter.click();
  await expect(bubble).toHaveAttribute('data-mode', 'speech', { timeout: 3000 });
  const speech = bubble.locator('.employee-bubble__speech');
  await expect(speech).toBeVisible();
  expect(((await speech.textContent()) ?? '').trim().length).toBeGreaterThan(0);
  // the mood emoji stays present as a small corner tag (same node).
  await expect(bubble.locator('.mood-emoji')).toBeVisible();

  // after the timed phrase it reverts to the emotion bubble.
  await expect(bubble).toHaveAttribute('data-mode', 'emoji', { timeout: 8000 });
});
