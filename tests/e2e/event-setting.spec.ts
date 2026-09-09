import { test, expect, type Page } from '@playwright/test';

// Proves the "disable choice popups" setting is a real gameplay option, not a
// decorative toggle: it persists, it stops the interruption, and the event it
// silences still genuinely happens and applies its consequences.
//
// Events are fired through the dev panel's existing trigger (`?dev=1`), which is
// the same `engine.triggerEvent` path a natural roll uses — no test-only bridge
// is added to the product.

const SAVE = {
  version: 8,
  onboardingComplete: true,
  lastSaved: Date.now(),
  createdAt: Date.now() - 600_000,
  company: { name: 'Nutshell Inc.' },
  resources: { nuts: 500_000, goldenNuts: 20, permanentKernels: 0, morale: 80, reputation: 90 },
  employees: {
    pip: {
      hired: true,
      level: 4,
      friendship: 50,
      outfitId: 'pip-classic',
      room: 'founder-desk',
      x: 0.5,
    },
  },
  upgrades: {},
  collections: { nuts: [], outfits: ['pip-classic'], logos: ['default'], moments: [], secrets: [] },
  settings: { reducedMotion: true },
};

async function boot(page: Page, dev = false) {
  // Wide enough that the whole nav is visible rather than collapsed under "More".
  await page.setViewportSize({ width: 1280, height: 950 });
  // Seed only when absent, so a reload exercises the game's OWN persisted state
  // instead of re-injecting the starting snapshot over it.
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    }
  }, SAVE);
  await page.goto(dev ? '/?dev=1' : '/');
  await expect(page.locator('.office')).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gameplay' })).toBeVisible();
}

async function openOffice(page: Page) {
  await page.getByRole('button', { name: 'Office', exact: true }).click();
  await expect(page.locator('.office')).toBeVisible();
}

const CHOICE_TOGGLE = 'Disable choice popups';

/** Fire a specific event via the dev panel's own trigger (its "Actions" tab). */
async function triggerEvent(page: Page, id: string) {
  const panel = page.locator('.dev-panel');
  if (!(await panel.isVisible())) await page.locator('.dev-fab').click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Actions' }).click();
  await panel.locator('select').first().selectOption(id);
}

interface SavedShape {
  settings: { autoResolveEvents?: boolean };
  stats: { eventsSeen: number };
  resources: { reputation: number };
  eventHistory: Array<{ eventId: string }>;
}

/** Flush a save and read it back, so assertions see persisted state. */
async function readSave(page: Page): Promise<SavedShape> {
  return page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(window.localStorage.getItem('wmno.save.v1') ?? '{}');
  });
}

test('the toggle exists, explains itself, and persists across a reload', async ({ page }) => {
  await boot(page);
  await openSettings(page);

  const toggle = page.getByRole('checkbox', { name: CHOICE_TOGGLE });
  await expect(toggle).not.toBeChecked();
  // The OFF state says events will ask.
  await expect(page.getByText('pause the office and ask you to decide')).toBeVisible();

  await toggle.check();
  await expect(toggle).toBeChecked();
  // The ON state states the actual policy, so "disabled" is never ambiguous.
  await expect(page.getByText(/department picks the best available option/)).toBeVisible();

  // Persisted, not merely component state.
  await page.reload();
  await openSettings(page);
  await expect(page.getByRole('checkbox', { name: CHOICE_TOGGLE })).toBeChecked();
  expect((await readSave(page)).settings.autoResolveEvents).toBe(true);
});

test('with popups enabled, an event asks and can always be resolved', async ({ page }) => {
  await boot(page, true);
  await triggerEvent(page, 'nut-audit');

  const modal = page.locator('.popup');
  await expect(modal).toBeVisible();

  // An event deliberately requires a decision rather than being dismissed, so
  // the guarantee that matters is that a usable choice is ALWAYS offered —
  // otherwise the popup would be a dead end that blocks the game.
  const choices = modal.locator('.event-choice, .popup__actions button, button');
  const enabled = choices.locator('visible=true');
  expect(await enabled.count()).toBeGreaterThan(0);

  // Taking a choice resolves the event and records the decision. (The result
  // panel that follows is also a `.popup`, so the decision itself is the
  // meaningful assertion rather than the popup disappearing.)
  await modal.getByRole('button').first().click();
  await expect
    .poll(
      async () => {
        const history = (await readSave(page)).eventHistory;
        return history?.some((entry) => entry.eventId === 'nut-audit') ?? false;
      },
      { timeout: 8_000 },
    )
    .toBe(true);
});

test('with popups disabled, the same event never interrupts but still resolves', async ({
  page,
}) => {
  await boot(page, true);
  await openSettings(page);
  await page.getByRole('checkbox', { name: CHOICE_TOGGLE }).check();
  await openOffice(page);

  const before = await readSave(page);
  await triggerEvent(page, 'nut-audit');

  // No choice popup, ever.
  await expect(page.locator('.popup')).toHaveCount(0);

  const after = await readSave(page);
  // The event genuinely happened...
  expect(after.stats.eventsSeen).toBeGreaterThan(before.stats.eventsSeen);
  // ...its consequence landed (nut-audit's best option grants reputation)...
  expect(after.resources.reputation).toBeGreaterThan(before.resources.reputation);
  // ...and the decision was recorded in company history.
  expect(after.eventHistory.some((entry) => entry.eventId === 'nut-audit')).toBe(true);
});

test('a decision made for the player is reported, not hidden', async ({ page }) => {
  await boot(page, true);
  await openSettings(page);
  await page.getByRole('checkbox', { name: CHOICE_TOGGLE }).check();
  await openOffice(page);

  await triggerEvent(page, 'nut-audit');
  // The notification feed tells the player what was decided.
  await expect(page.getByText(/Handled for you/)).toBeVisible({ timeout: 5_000 });
});
