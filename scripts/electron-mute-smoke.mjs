// Real-Electron smoke for the visible Mute button. Launches the built desktop
// app (dist-electron/main.cjs + dist/), seeds a save so we land in the office,
// clicks the ACTUAL header mute button, and reads the audio diagnostics. This
// catches packaged-only failures the browser E2E can't — most importantly the
// frameless-window drag region swallowing the click (which would leave
// masterGain audible after the click).
import { _electron as electron } from '@playwright/test';

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: { nuts: 100000, goldenNuts: 5, reputation: 200, morale: 80, permanentKernels: 0 },
};

function fail(msg) {
  console.error('SMOKE FAIL:', msg);
  process.exit(1);
}

const app = await electron.launch({
  args: ['dist-electron/main.cjs', '--no-sandbox', '--disable-gpu'],
  env: { ...process.env, WMNO_SMOKE: '1' },
});

try {
  const page = await app.firstWindow({ timeout: 20000 });
  // Seed a save, then reload so the app boots straight into the office.
  await page.evaluate((save) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: true }));
  }, SAVE);
  await page.reload();
  await page.locator('.office').first().waitFor({ timeout: 20000 });

  const btn = page.getByTestId('mute-toggle');
  await btn.waitFor({ timeout: 10000 });

  const diag = () => page.evaluate(() => window.__wmnoAudioDiag());

  const before = await diag();
  if (before.flags.muted !== false) fail(`expected unmuted at start, got ${JSON.stringify(before.flags)}`);

  // Click the REAL visible button (this is the drag-region test).
  await btn.click();
  await page.waitForTimeout(150);

  const muted = await diag();
  const pressed = await btn.getAttribute('aria-pressed');
  if (pressed !== 'true') fail(`aria-pressed not true after click (drag region may have eaten the click): ${pressed}`);
  if (muted.flags.muted !== true) fail(`flags.muted not true after click: ${JSON.stringify(muted.flags)}`);
  if (muted.masterGain !== 0) fail(`masterGain not 0 after mute: ${muted.masterGain}`);
  for (const ch of ['music', 'ambience', 'ui', 'sfx']) {
    if (muted.buses[ch] !== 0) fail(`bus ${ch} not 0 after mute: ${muted.buses[ch]}`);
  }

  // Unmute restores audible master.
  await btn.click();
  await page.waitForTimeout(150);
  const restored = await diag();
  if (restored.flags.muted !== false) fail('unmute did not clear the flag');
  if (!(restored.masterGain > 0)) fail(`masterGain not restored after unmute: ${restored.masterGain}`);

  console.log('SMOKE OK: visible Electron mute button toggled masterGain', before.masterGain, '-> 0 ->', restored.masterGain);
} finally {
  await app.close();
}
