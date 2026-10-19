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
 *        [--staff pip,bia,moss]   place exactly these animals in the room, so 1/2/3/4
 *                                 employee layouts can each be photographed
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { qaSave } from './qa-seed.mjs';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../visual-artifacts/', import.meta.url).pathname;
const METRICS = new URL('../assets/sources/characters/figure-metrics.json', import.meta.url)
  .pathname;

/**
 * Each character's dead transparent headroom, as a fraction of canvas height, so the
 * harness can measure the mood bubble against the top of the HEAD rather than the top
 * of the sprite box. Read from the committed measurements rather than re-derived, so
 * the harness and the renderer agree by construction.
 */
function headroomByAsset() {
  const metrics = JSON.parse(readFileSync(METRICS, 'utf8'));
  return Object.fromEntries(
    Object.entries(metrics.characters).map(([asset, m]) => [asset, m.topPadFraction]),
  );
}
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
  // Rooms adapt their whole composition to how many animals are in them, so all four
  // occupancies have to be photographable. The default roster fills rooms to the cap,
  // which means 3-employee layouts — the one arrangement that is neither "full" nor
  // trivially centred — could not be looked at at all without this.
  const staff = arg('staff', '');
  const roster = staff
    ? staff
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => ({ id, room }))
    : undefined;
  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((data) => {
    window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    window.localStorage.setItem('wmno.lang', 'en');
  }, qaSave(roster));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForSelector(`.floor[data-room="${room}"]`, { timeout: 15000 });
  // Toasts sit over the scene; clear them so they cannot cover the room.
  await page.addStyleTag({ content: '.toasts{display:none !important}' });
  const el = page.locator(`.floor[data-room="${room}"]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);

  const info = await el.evaluate((node, headroom) => {
    const r = node.getBoundingClientRect();
    const figures = [...node.querySelectorAll('.employee-sprite')].map((s) => {
      const b = s.getBoundingClientRect();
      const asset = (s.getAttribute('src') || '')
        .split('/')
        .pop()
        .replace(/-1x\.png$|\.png$/, '');
      // The sprite box includes dead transparent headroom above the animal, so the
      // top of the BOX is not the top of the head. Measuring the bubble against the
      // box is exactly the mistake that left bubbles hanging a different distance
      // above every character, so resolve the real head line here.
      const topPad = headroom[asset] ?? 0;
      const headTop = b.top + topPad * b.height;
      const bubble = s.closest('.critter-btn')?.querySelector('.employee-bubble');
      const bb = bubble?.getBoundingClientRect();
      return {
        src: (s.getAttribute('src') || '').split('/').pop(),
        w: +b.width.toFixed(1),
        h: +b.height.toFixed(1),
        // distance from the sprite's feet to the room's floor line
        footGap: +(r.bottom - b.bottom).toFixed(1),
        // Positive = clear air between bubble and head. Negative = overlapping the
        // head. Both are defects past a small tolerance.
        bubbleGap: bb ? +(headTop - bb.bottom).toFixed(1) : null,
        bubbleH: bb ? +bb.height.toFixed(1) : null,
      };
    });
    // ONLY the code-drawn fallback critters. `svg.critter` and not `svg`, because
    // the mood bubble is also an inline svg inside .critter-btn — matching every
    // svg reported four phantom "vector" figures per full room, which would both
    // mask a real fallback regression and invent one that was not there.
    const vectors = [...node.querySelectorAll('.critter-btn svg.critter')].map((s) => {
      const b = s.getBoundingClientRect();
      return {
        src: 'vector',
        w: +b.width.toFixed(1),
        h: +b.height.toFixed(1),
        footGap: +(r.bottom - b.bottom).toFixed(1),
      };
    });
    return {
      room: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      figures: [...figures, ...vectors],
    };
  }, headroomByAsset());

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
