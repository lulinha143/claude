import { test, expect, type Page } from '@playwright/test';
import { ROOM_CAP } from '../../src/sim/rooms';

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

test('an over-full legacy room is reduced to the cap and the overflow rehomed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  // This save assigns SIX teammates to one room, which predates the four-per-room
  // cap. Loading it must not render a six-person room: two of them get desks
  // elsewhere, and nobody vanishes.
  await seed(page, FULL_ROOM);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const critters = page.locator('.floor[data-room="founder-desk"] .critter-btn');
  await expect(critters).toHaveCount(ROOM_CAP);
  // All six are still employed and on screen somewhere in the building.
  await expect(page.locator('.office .critter-btn')).toHaveCount(6);

  const boxes = [];
  for (let i = 0; i < ROOM_CAP; i += 1) {
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

// The mood emoji stays anchored to the character, while the WORDS are presented
// as an observation note portaled to the body.
//
// The words used to render inside this same in-scene bubble, but `.floor` sets
// `overflow: hidden`, so any teammate near a room edge had their dialogue sliced
// off and a hard width cap hid the rest. The note is now a body-level element
// bounded by the window instead (see art/SpeechNote.tsx), so a long line wraps
// into a taller card rather than being cut. The bubble still flips to
// `data-mode="speech"` so the character visibly reacts.
test('clicking a teammate shows their words in a readable note', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await seed(page, FULL_ROOM);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const critter = page.locator('.floor[data-room="founder-desk"] .critter-btn').first();
  // The emotion sticker sits in the stage's top layer (so furniture in front of a
  // teammate never hides it), linked to its teammate by data-employee.
  const employeeId = await critter.getAttribute('data-employee');
  const bubble = page.locator(`.employee-bubble[data-employee="${employeeId}"]`);

  // default: exactly one bubble, in emoji mode, with the mood emoji present.
  await expect(bubble).toHaveCount(1);
  await expect(bubble).toHaveAttribute('data-mode', 'emoji');
  await expect(bubble.locator('.mood-emoji')).toBeVisible();
  await expect(page.locator('.speech-note')).toHaveCount(0);

  // click → the character reacts and the note appears with their words.
  await critter.click();
  await expect(bubble).toHaveAttribute('data-mode', 'speech', { timeout: 3000 });
  const note = page.locator('.speech-note').first();
  await expect(note).toBeVisible();
  const body = note.locator('.speech-note__body');
  expect(((await body.textContent()) ?? '').trim().length).toBeGreaterThan(0);
  // The note names who is speaking.
  expect(
    ((await note.locator('.speech-note__who').textContent()) ?? '').trim().length,
  ).toBeGreaterThan(0);
  // Every line is fully laid out — nothing is clipped away.
  const metrics = await body.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  expect(metrics.scrollH).toBeLessThanOrEqual(metrics.clientH + 1);
  // the mood emoji stays anchored to the character.
  await expect(bubble.locator('.mood-emoji')).toBeVisible();

  // after the timed phrase it reverts to the emotion bubble and the note goes.
  await expect(bubble).toHaveAttribute('data-mode', 'emoji', { timeout: 8000 });
  await expect(page.locator('.speech-note')).toHaveCount(0);
});
