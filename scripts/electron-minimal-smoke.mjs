// Verifies Chromium can create ANY renderer process at all, via the isolated
// --minimal-window-test mode (plain data: window, no app machinery). Also used
// to exercise GPU safe mode (WMNO_DISABLE_GPU) from the caller's env.
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'wmno-min-'));
const app = await electron.launch({
  args: [
    'dist-electron/main.cjs',
    '--minimal-window-test',
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userData}`,
  ],
  env: { ...process.env, WMNO_SMOKE: '1' },
});
try {
  const page = await app.firstWindow({ timeout: 20000 });
  await page.waitForFunction(() => /renderer alive/i.test(document.body?.innerText || ''), {
    timeout: 15000,
  });
  await page.waitForTimeout(400);
  const log = (() => {
    try {
      return fs.readFileSync(path.join(userData, 'startup.log'), 'utf-8');
    } catch {
      return '';
    }
  })();
  const ok = /MINIMAL WINDOW SUCCESS/.test(log) && /MINIMAL WINDOW DID FINISH LOAD/.test(log);
  console.log(ok ? 'MINIMAL SMOKE OK' : 'MINIMAL SMOKE FAIL');
  console.log(
    log
      .split('\n')
      .filter((l) => /MINIMAL WINDOW|app ready|GPU feature/.test(l))
      .join('\n'),
  );
  if (!ok) process.exit(1);
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
