#!/usr/bin/env node
/**
 * Measure how the room and the characters in it respond to window size.
 *
 * This exists because of a specific reported bug: when the window is made
 * smaller the environment shrinks but the characters do not, so the cast
 * visually detaches from the room it is standing in. DOM presence tests cannot
 * see that -- it needs real measured boxes at real viewport sizes.
 *
 * For each viewport it reports the rendered width of the room, the rendered box
 * of every character sprite, and the ratio between them. If character scale is
 * bound to the scene, character_px / room_px stays constant across viewports.
 *
 * Usage: node scripts/measure-scene-scale.mjs [--json] [--out FILE]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { qaSave } from './qa-seed.mjs';

const DIST = new URL('../dist/', import.meta.url).pathname;
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

const VIEWPORTS = [
  { name: 'minimum', width: 900, height: 600 },
  { name: 'narrow', width: 1024, height: 700 },
  { name: 'default', width: 1280, height: 800 },
  { name: 'large', width: 1600, height: 900 },
  { name: 'maximized', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 2560, height: 1080 },
  { name: 'short', width: 1280, height: 560 },
  { name: 'tall', width: 1100, height: 1300 },
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

const probe = () => {
  const room = document.querySelector('.floor');
  const stage = document.querySelector('.floor__stage');
  if (!room) return { error: 'no .floor in DOM' };
  const rr = room.getBoundingClientRect();
  const sprites = [...document.querySelectorAll('.employee-sprite')].map((el) => {
    const r = el.getBoundingClientRect();
    return { src: (el.getAttribute('src') || '').split('/').pop(), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
  });
  const critters = [...document.querySelectorAll('.critter-btn svg')].map((el) => {
    const r = el.getBoundingClientRect();
    return { src: 'vector', w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
  });
  const cs = getComputedStyle(document.documentElement);
  const scope = getComputedStyle(room);
  return {
    room: { w: +rr.width.toFixed(2), h: +rr.height.toFixed(2) },
    stage: stage ? +stage.getBoundingClientRect().height.toFixed(2) : null,
    assetScale: scope.getPropertyValue('--asset-scale').trim(),
    uiScale: cs.getPropertyValue('--ui-scale').trim(),
    dpr: window.devicePixelRatio,
    figures: [...sprites, ...critters],
  };
};

const main = async () => {
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    // Measure the populated office, not an empty founder's desk behind an intro.
    await page.addInitScript((data) => {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
      window.localStorage.setItem('wmno.lang', 'en');
    }, qaSave());
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await page.waitForSelector('.floor', { timeout: 15000 });
    await page.waitForTimeout(900);
    const data = await page.evaluate(probe);
    const tallest = data.figures?.length ? Math.max(...data.figures.map((f) => f.h)) : 0;
    rows.push({ ...vp, ...data, tallest, ratio: data.room ? tallest / data.room.w : 0 });
    await page.close();
  }
  await browser.close();
  server.close();

  const json = process.argv.includes('--json');
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(
      '\n' +
        'viewport'.padEnd(11) +
        'win'.padEnd(12) +
        'room w'.padEnd(9) +
        'stage h'.padEnd(9) +
        'asset'.padEnd(7) +
        'figures'.padEnd(9) +
        'tallest'.padEnd(9) +
        'fig/room',
    );
    for (const r of rows) {
      console.log(
        r.name.padEnd(11) +
          `${r.width}x${r.height}`.padEnd(12) +
          String(r.room?.w ?? '-').padEnd(9) +
          String(r.stage ?? '-').padEnd(9) +
          String(r.assetScale || '-').padEnd(7) +
          String(r.figures?.length ?? 0).padEnd(9) +
          r.tallest.toFixed(2).padEnd(9) +
          (r.ratio * 100).toFixed(3) + '%',
      );
    }
    const ratios = rows.map((r) => r.ratio).filter((v) => v > 0);
    if (ratios.length > 1) {
      const spread = (Math.max(...ratios) / Math.min(...ratios) - 1) * 100;
      console.log(
        `\nfigure-to-room ratio spread across viewports: ${spread.toFixed(1)}%` +
          (spread > 5
            ? '  <-- characters are NOT tracking the scene'
            : '  <-- characters track the scene'),
      );
    }
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
