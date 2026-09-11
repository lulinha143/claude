#!/usr/bin/env node
/**
 * Screenshot ONE room, tightly cropped, at a given window size.
 *
 * Full-window shots are dominated by HUD and whichever rooms the scroll happens to
 * be over. To judge whether the cast reads as one scale, whether furniture is on
 * the floor and whether a room's composition works, the room itself has to fill
 * the frame.
 *
 * Usage: node scripts/shot-room.mjs --room founder-desk [--width 1280] [--tag t]
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

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};

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
  const room = arg('room', 'founder-desk');
  const width = Number(arg('width', 1280));
  const height = Number(arg('height', 900));
  const tag = arg('tag', 'room');
  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((data) => {
    window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    window.localStorage.setItem('wmno.lang', 'en');
  }, qaSave());
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForSelector(`.floor[data-room="${room}"]`, { timeout: 15000 });
  // Toasts sit over the scene; clear them so they cannot cover the room.
  await page.addStyleTag({ content: '.toasts{display:none !important}' });
  const el = page.locator(`.floor[data-room="${room}"]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);

  const info = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const figures = [...node.querySelectorAll('.employee-sprite')].map((s) => {
      const b = s.getBoundingClientRect();
      return {
        src: (s.getAttribute('src') || '').split('/').pop(),
        w: +b.width.toFixed(1),
        h: +b.height.toFixed(1),
        // distance from the sprite's feet to the room's floor line
        footGap: +(r.bottom - b.bottom).toFixed(1),
      };
    });
    const vectors = [...node.querySelectorAll('.critter-btn svg')].map((s) => {
      const b = s.getBoundingClientRect();
      return { src: 'vector', w: +b.width.toFixed(1), h: +b.height.toFixed(1), footGap: +(r.bottom - b.bottom).toFixed(1) };
    });
    return { room: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, figures: [...figures, ...vectors] };
  });

  const file = join(OUT, `${tag}-${room}-${width}.png`);
  await el.screenshot({ path: file });
  console.log(`wrote ${file}`);
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
  server.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
