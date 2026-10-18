import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../../src/sim/state';
import { characterDepth, SCENE_DEPTH } from '../../src/sim/depth';
import { STAGE_HEIGHT_PX, characterSlots, standingDepthPx } from '../../src/content/roomLayout';
import type { DecorationInstance, GameState } from '../../src/sim/types';
import { evaluateAchievements } from '../../src/sim/achievements';
import { arrangeToggle, openView } from './support/shell';

/**
 * Chapter 8: the decoration catalogue, placement and depth, through the real DOM.
 *
 * The catalogue says the price before anything is pressed, and what is missing
 * when short (changing nothing); a purchase is charged once and says where the
 * piece went. "Arrumar" takes a piece to the office: a drag from the storage
 * strip lands where it was let go (the tower never scrolls under the pointer on
 * the way in); let go over the strip a placed piece is put away; leaving
 * arranging or pressing Escape with a piece in the paw changes nothing. Floor
 * furniture stands among the team by where it stands, sent back it stays behind
 * everyone, and both survive a reload.
 */

const PT = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/pt-BR.json', import.meta.url), 'utf8'),
);
const text = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], PT) as string;
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');

const ROOM = 'founder-desk';

function instance(
  id: string,
  roomId: string | null,
  surface: 'floor' | 'wall',
  x: number,
  y: number,
  layer?: 'front' | 'back',
): DecorationInstance {
  return {
    instanceId: `deco-${id}-1`,
    decorationId: id,
    roomId,
    surfaceType: surface,
    regionKind: surface,
    normalizedX: x,
    normalizedY: y,
    depth: surface === 'wall' ? 186 : 200,
    ...(layer ? { layer } : {}),
    flipped: false,
    rotation: 0,
    interactionState: {},
  };
}

/** A young company, in Portuguese: four rooms open, a fern on the floor, a lamp in storage. */
function company(mutate: (s: GameState) => void = () => undefined): GameState {
  const s = createInitialState(Date.now());
  s.onboardingComplete = true;
  s.resources.nuts = 650;
  s.resources.goldenNuts = 1;
  s.resources.morale = 60;
  s.resources.reputation = 10;
  s.upgrades['room-sorting'] = 1;
  s.stats.totalClicks = 300;
  s.stats.playTimeSeconds = 4_000;
  s.settings.language = 'pt-BR';
  s.settings.showHints = false;
  s.settings.reducedMotion = true;
  s.collections.secrets.push('deco:potted-fern', 'deco:desk-lamp');
  s.decorationInstances.push(
    instance('potted-fern', ROOM, 'floor', 0.3, 0.12),
    instance('desk-lamp', null, 'floor', 0.16, 0.06),
  );
  s.placements['potted-fern'] = { surface: 'floor', x: 0.3, y: 0.12 };
  mutate(s);
  // What the save has already earned is filed with it (no catch-up note on boot).
  evaluateAchievements(s, Date.now());
  return s;
}

async function boot(page: Page, state: GameState, width: number, height: number) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('wmno.save.v1')) {
      localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
    localStorage.setItem('wmno.lang', save.settings.language);
  }, state);
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
}

/** The save as it is on disk right now (no extra save forced). */
const onDisk = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState);
/** The save after asking the game to write it (as closing the window does). */
const saved = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem('wmno.save.v1')!) as GameState;
  });
const piece = (s: GameState, id: string) =>
  s.decorationInstances.find((item) => item.decorationId === id)!;

test('the catalogue says the price first, and what is missing when short, changing nothing', async ({
  page,
}) => {
  await boot(page, company(), 380, 460);
  await openView(page, 'decorate');
  const poster = page.locator('.decocard[data-decoration="motivational-poster"]');
  await expect(poster.locator('.buy-btn')).toContainText('300');
  await expect(poster).toContainText(text('decorate.surface.wall'));
  await expect(poster).toContainText(fill(text('decorate.moraleOnBuy'), { value: '2' }));
  // 800 for the plushie, with about 650 in hand: the button says what is missing.
  const plushie = page.locator('.decocard[data-decoration="conveyor-plushie"]');
  const buy = plushie.locator('.buy-btn');
  await expect(buy).toHaveAttribute('aria-disabled', 'true');
  await expect(buy.locator('.decocard__short')).toContainText(/Faltam \d+/);
  const before = await saved(page);
  // Still pressable (it explains); Playwright treats aria-disabled as inert, so
  // the press skips its actionability wait.
  await buy.click({ force: true });
  await expect(plushie.locator('.decocard__note')).toContainText(/Ainda faltam \d+ castanhas/);
  const after = await onDisk(page);
  expect(after.collections.secrets).not.toContain('deco:conveyor-plushie');
  expect(after.resources.nuts).toBeGreaterThanOrEqual(before.resources.nuts);
  // The catalogue fits the corner window.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a purchase is charged once, says where the piece went and is saved straight away', async ({
  page,
}) => {
  await boot(page, company(), 380, 460);
  await openView(page, 'decorate');
  const poster = page.locator('.decocard[data-decoration="motivational-poster"]');
  const before = await saved(page);
  await poster.locator('.buy-btn').click();
  await expect(poster.locator('.decocard__note')).toHaveText(
    fill(text('decorate.boughtPlaced'), { room: text('room.founderDesk.name') }),
  );
  await expect(poster).toHaveClass(/is-owned/);
  // Bought: the buy button is gone, so a second press cannot buy it again.
  await expect(poster.locator('.buy-btn')).toHaveCount(0);
  // On disk at once (no autosave needed), charged once.
  const after = await onDisk(page);
  expect(
    after.collections.secrets.filter((key) => key === 'deco:motivational-poster'),
  ).toHaveLength(1);
  const spent = before.resources.nuts - after.resources.nuts;
  expect(spent).toBeGreaterThan(290);
  expect(spent).toBeLessThanOrEqual(300);
  expect(piece(after, 'motivational-poster').roomId).toBe(ROOM);
  // It is on the Founder's Desk wall in the office, after a reload too.
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await expect(
    page.locator(`.floor[data-room="${ROOM}"] [data-deco="motivational-poster"]`),
  ).toHaveAttribute('data-layer', 'back');
});

for (const [width, height] of [
  [380, 460],
  [1280, 720],
] as const) {
  test(`a piece taken from storage lands where it is let go, at ${width}x${height}`, async ({
    page,
  }) => {
    await boot(page, company(), width, height);
    await openView(page, 'decorate');
    await page.locator('.decocard[data-decoration="desk-lamp"] .decocard__arrange').click();
    await page.locator('.office--decorating').waitFor();
    const stage = page.locator(`.floor[data-room="${ROOM}"] .floor__stage`);
    await stage.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const card = (await page
      .locator('.deco-tray__card[data-decoration="desk-lamp"]')
      .boundingBox())!;
    const box = (await stage.boundingBox())!;
    // From the storage strip up into the room: the path crosses the bottom edge
    // of the tower, which must not scroll it away from under the pointer.
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.86, { steps: 14 });
    await expect(page.locator('.drag-ghost')).toHaveClass(/is-ok/);
    await expect(page.locator('.deco-tray__drop')).toHaveText(text('decorate.dropToKeep'));
    const still = (await stage.boundingBox())!;
    expect(Math.abs(still.y - box.y)).toBeLessThan(1);
    // Escape here would change nothing: no charge, still in storage.
    if (width === 380) {
      const nuts = (await saved(page)).resources.nuts;
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.drag-ghost')).toHaveCount(0);
      const kept = await saved(page);
      expect(piece(kept, 'desk-lamp').roomId).toBeNull();
      expect(kept.resources.nuts).toBeGreaterThanOrEqual(nuts);
      expect(kept.collections.secrets).toContain('deco:desk-lamp');
      // Again, this time all the way in.
      await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.86, { steps: 14 });
      await expect(page.locator('.drag-ghost')).toHaveClass(/is-ok/);
    }
    await page.mouse.up();
    await expect.poll(async () => piece(await onDisk(page), 'desk-lamp').roomId).toBe(ROOM);
    const lamp = piece(await onDisk(page), 'desk-lamp');
    expect(Math.abs(lamp.normalizedX - 0.62)).toBeLessThan(0.03);
    // No horizontal overflow while arranging.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('let go over the storage strip, a placed piece is put away; Escape changes nothing', async ({
  page,
}) => {
  await boot(page, company(), 1280, 720);
  await arrangeToggle(page).click();
  const fern = page.locator(`.floor[data-room="${ROOM}"] [data-deco="potted-fern"] .decor`);
  await fern.scrollIntoViewIfNeeded();
  const start = (await fern.boundingBox())!;

  // Escape with the fern in the paw: it stays where it was.
  const first = piece(await saved(page), 'potted-fern');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(start.x + 140, start.y + 10, { steps: 8 });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  expect(piece(await saved(page), 'potted-fern')).toEqual(first);

  // Over the strip (a slim strip while a piece is in the paw) it says what
  // letting go does, then puts the fern away.
  await page.mouse.move(start.x + start.width / 2, start.y + start.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 20, start.y + 30, { steps: 4 });
  const strip = (await page.locator('.deco-tray').boundingBox())!;
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2, { steps: 12 });
  await expect(page.locator('.deco-tray')).toHaveClass(/is-drop-over/);
  await expect(page.locator('.deco-tray__drop')).toHaveText(text('decorate.dropToStow'));
  await expect(page.locator('.drag-ghost')).toHaveClass(/is-stow/);
  await page.mouse.up();
  await expect.poll(async () => piece(await onDisk(page), 'potted-fern').roomId).toBeNull();
  const after = await onDisk(page);
  expect(after.collections.secrets).toContain('deco:potted-fern');
  await expect(page.locator(`.floor[data-room="${ROOM}"] [data-deco="potted-fern"]`)).toHaveCount(
    0,
  );
  await expect(page.locator('.deco-tray__card[data-decoration="potted-fern"]')).toHaveAttribute(
    'data-placement',
    'stored',
  );
});

test('leaving arranging with a piece in the paw puts it back', async ({ page }) => {
  await boot(page, company(), 1280, 720);
  const toggle = arrangeToggle(page);
  await toggle.click();
  const fern = page.locator(`.floor[data-room="${ROOM}"] [data-deco="potted-fern"] .decor`);
  await fern.scrollIntoViewIfNeeded();
  const start = (await fern.boundingBox())!;
  const before = piece(await saved(page), 'potted-fern');
  await toggle.focus();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(start.x + 160, start.y + 6, { steps: 8 });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  // The arrange switch, by keyboard, mid-drag.
  await page.keyboard.press('Enter');
  await expect(page.locator('.office--decorating')).toHaveCount(0);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await page.mouse.up();
  expect(piece(await saved(page), 'potted-fern')).toEqual(before);
});

test('floor furniture stands among the team by where it stands, and sent back stays behind', async ({
  page,
}) => {
  // Two at the Founder's Desk: one at the front of the floor, one a step back.
  const [front, back] = characterSlots(2, ROOM);
  const nearerThanBack = Math.max(0, back.bottom - 8) / STAGE_HEIGHT_PX;
  await boot(
    page,
    company((s) => {
      s.employees.pip = { ...s.employees.pip, hired: true, room: ROOM };
      s.employees.marlow = { ...s.employees.marlow, hired: true, level: 2, room: ROOM };
      s.collections.secrets.push('deco:billboard', 'deco:snack-bar');
      s.decorationInstances.push(
        instance('billboard', ROOM, 'floor', front.x, 0.28),
        instance('snack-bar', ROOM, 'floor', back.x, nearerThanBack),
      );
    }),
    1280,
    720,
  );
  const floor = `.floor[data-room="${ROOM}"]`;
  const zOf = (selector: string) =>
    page.locator(selector).evaluate((el) => Number(getComputedStyle(el).zIndex));
  await page.locator(floor).scrollIntoViewIfNeeded();
  const team = [
    await zOf(`${floor} .critter-btn[data-employee="pip"]`),
    await zOf(`${floor} .critter-btn[data-employee="marlow"]`),
  ];
  const [nearest, furthest] = [Math.max(...team), Math.min(...team)];
  expect(nearest).toBe(characterDepth(front.bottom));
  expect(furthest).toBe(characterDepth(back.bottom));
  // Placed at the back of the floor, the billboard is behind both of them.
  const billboard = await zOf(`${floor} [data-deco="billboard"]`);
  expect(billboard).toBe(characterDepth(standingDepthPx(0.28)));
  expect(billboard).toBeLessThan(furthest);
  // The snack bar stands in front of the one further back, behind the one in front.
  const snack = await zOf(`${floor} [data-deco="snack-bar"]`);
  expect(snack).toBeGreaterThan(furthest);
  expect(snack).toBeLessThan(nearest);

  // Sent back, it stays behind everyone wherever it stands; kept after a reload.
  await arrangeToggle(page).click();
  await page.locator(`${floor} [data-deco="snack-bar"] .decor`).click();
  const toggle = page.locator(`${floor} .deco-layer-btn`);
  await expect(toggle).toHaveText(text('decorate.layerBack'));
  await toggle.click();
  await expect(page.locator(`${floor} [data-deco="snack-bar"]`)).toHaveAttribute(
    'data-layer',
    'back',
  );
  expect(await zOf(`${floor} [data-deco="snack-bar"]`)).toBeLessThan(SCENE_DEPTH.character.min);
  // Brought forward again, it rejoins the team where it stands.
  await expect(toggle).toHaveText(text('decorate.layerFront'));
  await expect(toggle).toHaveAttribute('title', text('decorate.layerAmongTip'));
  await toggle.click();
  expect(await zOf(`${floor} [data-deco="snack-bar"]`)).toBe(snack);
  await toggle.click();
  await page.reload();
  await page.locator(floor).waitFor({ timeout: 15_000 });
  await expect(page.locator(`${floor} [data-deco="snack-bar"]`)).toHaveAttribute(
    'data-layer',
    'back',
  );
  expect(piece(await onDisk(page), 'snack-bar').layer).toBe('back');
});
