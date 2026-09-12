#!/usr/bin/env node
/**
 * Capture the real rendered game at several window sizes for visual inspection.
 *
 * Measurements prove proportions; they do not prove the scene still looks right.
 * This writes PNGs to visual-artifacts/ (gitignored) so the room, the cast, the
 * furniture and the HUD can actually be looked at side by side after a change.
 *
 * Usage: node scripts/visual-qa.mjs [--tag NAME] [--full]
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { qaSave } from './qa-seed.mjs';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../visual-artifacts/', import.meta.url).pathname;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.map': 'application/json',
};

const SHOTS = [
  { name: 'minimum-900x600', width: 900, height: 600 },
  { name: 'default-1280x800', width: 1280, height: 800 },
  { name: 'maximized-1920x1080', width: 1920, height: 1080 },
  { name: 'narrow-1024x700', width: 1024, height: 700 },
];

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const file = join(DIST, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port };
}

const main = async () => {
  const tagIdx = process.argv.indexOf('--tag');
  const tag = tagIdx > -1 ? process.argv[tagIdx + 1] : 'current';
  const full = process.argv.includes('--full');
  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch();

  for (const s of SHOTS) {
    const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    // Seed a populated office and mark onboarding done, otherwise every shot is
    // just the opening sequence over an empty founder's desk.
    await page.addInitScript((data) => {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
      window.localStorage.setItem('wmno.lang', 'en');
    }, qaSave());
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await page.waitForSelector('.floor', { timeout: 15000 });
    // Let the APNGs decode a frame and any intro settle.
    await page.waitForTimeout(1800);
    const file = join(OUT, `${tag}-${s.name}.png`);
    await page.screenshot({ path: file, fullPage: full });
    console.log(`wrote ${file}`);
    await page.close();
  }
  await browser.close();
  server.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
