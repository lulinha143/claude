import { expect, test, type Page } from '@playwright/test';
import { ACHIEVEMENTS } from '../../src/content/achievements';
import { ROOMS } from '../../src/content/rooms';
import { DECORATIONS } from '../../src/content/decorations';
import { EMPLOYEES } from '../../src/content/employees';

// Visual-capture harness. Unlike smoke.spec, this does not assert — it seeds a
// rich save, drives the app to each key screen at a matrix of window sizes and
// languages, and writes PNGs to `visual-artifacts/` for direct inspection
// (manual screenshots, so no stored baselines are required to run).

const RICH_SAVE = {
  version: 7,
  // Keep this visual fixture current and fully specified so screenshots verify
  // presentation rather than being obscured by migration-triggered unlocks.
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.4 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'founder-desk', x: 0.6 },
    bea: { hired: true, level: 3, friendship: 40, room: 'founder-desk', x: 0.8 },
    corvus: { hired: true, level: 2, friendship: 30, room: null, x: 0.5 },
    mina: { hired: true, level: 2, friendship: 30, room: null, x: 0.5 },
  },
  achievements: Object.fromEntries(ACHIEVEMENTS.map((achievement) => [achievement.id, 1])),
  // own a spread of decorations so the tray + placed furniture are populated
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:mini-couch', 'deco:water-cooler', 'deco:whiteboard'],
  },
};

// Exhaustive art-direction fixture: every department is unlocked but no one
// and nothing has been added by the player. Each room capture therefore proves
// the authored composition can stand on its own before customization.
// Both gates are derived from the room table rather than listed by hand. A room
// added later then joins this review automatically instead of shipping unlooked-at,
// which is exactly how the five newest departments slipped past a hardcoded list.
const ROOM_UNLOCK_UPGRADES = Object.fromEntries(
  ROOMS.flatMap((room) => (room.unlock.upgradeId ? [[room.unlock.upgradeId, 1] as const] : [])),
);
const ROOM_UNLOCK_REPUTATION =
  Math.max(0, ...ROOMS.map((room) => room.unlock.reputation ?? 0)) * 4 + 1000;

const EMPTY_ROOM_REVIEW_SAVE = {
  ...RICH_SAVE,
  settings: { language: 'en', reducedMotion: true, fontScale: 1, uiScale: 1 },
  resources: { ...RICH_SAVE.resources, reputation: ROOM_UNLOCK_REPUTATION },
  upgrades: ROOM_UNLOCK_UPGRADES,
  employees: Object.fromEntries(
    EMPLOYEES.map((employee) => [
      employee.id,
      { hired: false, level: 1, friendship: 0, room: null, x: 0.5 },
    ]),
  ),
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  placements: {},
  decorationInstances: [],
};

const VIEWPORTS: { name: string; w: number; h: number }[] = [
  { name: '420x720', w: 420, h: 720 },
  { name: '480x800', w: 480, h: 800 },
  { name: '720x720', w: 720, h: 720 },
  { name: '960x720', w: 960, h: 720 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: '1920x1080', w: 1920, h: 1080 },
  { name: 'ultrawide-2560x1080', w: 2560, h: 1080 },
  { name: 'narrow-380x900', w: 380, h: 900 },
];

const DIR = 'visual-artifacts';

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, save);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4, 4);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

// Dismiss any modal that would block navigation (offline welcome-back, an event,
// etc.) and let the notification toasts settle.
async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(200);
    } else break;
  }
  await page.waitForTimeout(300);
}

// One test captures the Office at every viewport (the highest-value screen for
// responsiveness + adaptive rooms + decoration scale).
test('office across the viewport matrix', async ({ page }) => {
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await seed(page, RICH_SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);
    await page.waitForTimeout(400);
    await shot(page, `office-${v.name}`);
  }
});

// Capture every major view at a representative desktop size and a compact size.
test('all views at desktop + compact', async ({ page }) => {
  for (const v of [
    { name: '1280x720', w: 1280, h: 720 },
    { name: '420x720', w: 420, h: 720 },
  ]) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await seed(page, RICH_SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);

    const views: [string, RegExp][] = [
      ['upgrades', /^Upgrades$|^Melhorias$/i],
      ['team', /^Team$|^Equipe$/i],
      ['company', /^Company$|^Empresa$/i],
      ['focus', /^Focus$|^Foco$/i],
      ['collections', /^Collections$|^Coleções$/i],
      ['achievements', /^Achievements$|^Conquistas$/i],
      ['stats', /^Stats$|^Estatísticas$/i],
      ['prestige', /^Prestige$|^Prestígio$/i],
      ['settings', /^Settings$|^Ajustes$/i],
    ];
    for (const [key, name] of views) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(300);
        await shot(page, `view-${key}-${v.name}`);
      }
    }

    // Decorate / arrange mode if a decorate nav button exists.
    const deco = page.getByRole('button', { name: /Decorate|Decoraç/i }).first();
    if (await deco.count()) {
      await deco.click();
      await page.waitForTimeout(300);
      await shot(page, `view-decorate-${v.name}`);
    }
  }
});

// Scroll to the populated room (Founder's Desk sits at the bottom of the trunk)
// so the diorama can be inspected with characters + workbench + crate present.
test('populated room (scrolled to Founder\'s Desk)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page, RICH_SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.locator('.floor').last().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, 'office-populated');
});

// Trigger an event choice and capture the WHAT CHANGED consequence panel.
test('event WHAT CHANGED panel', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 760 });
  await seed(page, RICH_SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  // Force a known event via the dev panel if present, else skip gracefully.
  const dev = page.locator('.dev-fab');
  if (await dev.count()) {
    await dev.click();
    // switch to actions tab and pick the event from the select if available
    const actions = page.getByRole('button', { name: /Actions/i }).first();
    if (await actions.count()) await actions.click();
    const select = page.locator('.dev-panel select').last();
    if (await select.count()) {
      await select.selectOption('bea-wood').catch(() => {});
      await page.waitForTimeout(200);
      // close dev panel
      const close = page.getByRole('button', { name: /Close|Fechar/i }).first();
      if (await close.count()) await close.click();
      // choose the "approve" option in the event modal
      const eventModal = page.locator('.event-modal, .modal');
      if (await eventModal.count()) {
        await page.waitForTimeout(300);
        await shot(page, 'event-modal');
        const firstChoice = page.locator('.event-modal button, .modal .choice-btn, .modal button').first();
        if (await firstChoice.count()) {
          await firstChoice.click();
          await page.waitForTimeout(400);
          await shot(page, 'what-changed');
        }
      }
    }
  }
});

// A localized capture (Brazilian Portuguese) of Office + Settings.
test('pt-BR localization capture', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page, { ...RICH_SAVE, settings: { language: 'pt-BR' } });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.waitForTimeout(300);
  await shot(page, 'office-ptBR');
  const settings = page.getByRole('button', { name: /Ajustes|Configura|Settings/i }).first();
  if (await settings.count()) {
    await settings.click();
    await page.waitForTimeout(300);
    await shot(page, 'settings-ptBR');
  }
});

// Exhaustive per-room review. This is deliberately one room per artifact—not
// a tall overview—so lighting, negative space, built-ins and surface readability
// can be judged at the size the player actually sees.
test('every undecorated room is captured individually for art direction review', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, EMPTY_ROOM_REVIEW_SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await clearModals(page);

  for (const definition of ROOMS) {
    const room = page.locator(`.floor[data-room="${definition.id}"]`);
    await expect(room, `${definition.id} should be unlocked and rendered`).toHaveCount(1);
    await room.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await room.screenshot({ path: `${DIR}/review/rooms/${definition.id}.png` });
  }
});

// Exhaustive per-item catalogue review. Cards use the real sprite renderer,
// authored scale, surface stage, department accent and localized product name.
test('every decoration is captured individually for catalogue art review', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, EMPTY_ROOM_REVIEW_SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  await clearModals(page);
  await page.getByRole('button', { name: /^Decorate$/i }).click();

  const cards = page.locator('.decocard');
  await expect(cards).toHaveCount(DECORATIONS.length);
  for (const definition of DECORATIONS) {
    const card = page.locator(`.decocard[data-decoration="${definition.id}"]`);
    await expect(card, `${definition.id} should have a catalogue card`).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
    await card.screenshot({ path: `${DIR}/review/decorations/${definition.id}.png` });
  }
});
