#!/usr/bin/env node
/**
 * Photograph the full-screen employee interaction mode, at several window sizes and
 * at several points in a conversation.
 *
 * The mode is only reachable by clicking a teammate, and only when they have something
 * to say, so this drives the real DOM rather than calling engine methods: it clicks the
 * roster's Talk button, shoots the opening node, takes an option, and shoots the reply
 * with its measured "what changed" readout. That is the only way to know the thing a
 * player actually sees is right.
 *
 * Usage: node scripts/shot-talk.mjs [--tag NAME] [--who EMPLOYEE_ID]
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
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.map': 'application/json',
};

const SIZES = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '900x600', width: 900, height: 600 },
  { name: '1500x560', width: 1500, height: 560 },
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
  const i = process.argv.indexOf('--tag');
  const tag = i > -1 ? process.argv[i + 1] : 'talk';
  // Which animal to interview. Was hard-coded to Pip, which meant the one character
  // whose artwork is hand-repaired and most-tested was also the only one this harness
  // could ever look at — so a newly imported animal could not be checked in the mode
  // that shows a character at their largest.
  const w = process.argv.indexOf('--who');
  const who = w > -1 ? process.argv[w + 1] : 'pip';
  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const problems = [];

  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    await page.addInitScript((data) => {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
      window.localStorage.setItem('wmno.lang', 'en');
    }, qaSave());
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await page.waitForSelector('.floor', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // Into the roster, which is the reliable entry point.
    await page.locator('.nav button').filter({ hasText: 'Team' }).first().click();
    await page.waitForTimeout(600);
    const talk = page.locator(`.employee-card__talk[data-employee="${who}"]`).first();
    if (!(await talk.count())) {
      problems.push(`[${size.name}] no Talk button rendered on the roster for ${who}`);
      await page.close();
      continue;
    }
    await talk.scrollIntoViewIfNeeded();
    await talk.click();
    await page.waitForSelector('.talk__sheet', { timeout: 8000 }).catch(() => {});
    if (!(await page.locator('.talk__sheet').count())) {
      problems.push(`[${size.name}] Talk button did not open the interaction mode`);
      await page.close();
      continue;
    }
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, `${tag}-open-${size.name}.png`) });

    // Measure the mode: does it fit, does the portrait actually use the dense build?
    const m = await page.evaluate(() => {
      const sheet = document.querySelector('.talk__sheet');
      const img = document.querySelector('.talk__portrait img');
      const r = sheet.getBoundingClientRect();
      return {
        sheet: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) },
        fits: r.bottom <= window.innerHeight + 1 && r.top >= -1,
        convoScrolls: (() => {
          const c = document.querySelector('.talk__convo');
          return c ? c.scrollHeight > c.clientHeight + 1 : false;
        })(),
        choices: document.querySelectorAll('.talk-choice').length,
        portrait: img
          ? {
              file: img.currentSrc.split('/').pop(),
              drawn: `${Math.round(img.getBoundingClientRect().width)}x${Math.round(img.getBoundingClientRect().height)}`,
              natural: `${img.naturalWidth}x${img.naturalHeight}`,
            }
          : null,
      };
    });
    console.log(
      `${size.name.padEnd(10)} sheet ${String(m.sheet.w).padStart(4)}x${String(m.sheet.h).padStart(3)}` +
        `  fits=${m.fits}  choices=${m.choices}` +
        `  portrait=${m.portrait?.file ?? '-'} drawn ${m.portrait?.drawn ?? '-'} of ${m.portrait?.natural ?? '-'}`,
    );
    if (!m.fits) problems.push(`[${size.name}] the interaction sheet does not fit the window`);
    if (!m.choices) problems.push(`[${size.name}] no options rendered`);
    if (m.portrait && m.portrait.file.includes('-1x')) {
      problems.push(
        `[${size.name}] portrait served the SMALL build (${m.portrait.file}) and is being enlarged`,
      );
    }
    // The portrait must never be drawn larger than the artwork it came from. Getting
    // this wrong is invisible in a test and obvious in a screenshot.
    if (m.portrait) {
      const [dw, dh] = m.portrait.drawn.split('x').map(Number);
      const [nw, nh] = m.portrait.natural.split('x').map(Number);
      const upscale = Math.max(dw / nw, dh / nh);
      if (upscale > 1.02) {
        problems.push(
          `[${size.name}] portrait is upscaled ${upscale.toFixed(2)}x ` +
            `(drawn ${m.portrait.drawn} from ${m.portrait.natural}) and will read soft`,
        );
      }
    }

    // Take an option and shoot the reply + measured consequences.
    await page.locator('.talk-choice[data-eligible="true"]').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `${tag}-reply-${size.name}.png`) });
    const after = await page.evaluate(() => ({
      reply: Boolean(document.querySelector('.talk__said--reply')),
      changed: [...document.querySelectorAll('.talk__changed li')].map((li) => li.textContent),
    }));
    console.log(`${' '.repeat(10)} reply=${after.reply} changed=${JSON.stringify(after.changed)}`);
    if (!after.reply) problems.push(`[${size.name}] no reply shown after taking an option`);
    if (!after.changed.length) {
      problems.push(`[${size.name}] no measured consequences shown after taking an option`);
    }
    await page.close();
  }

  await browser.close();
  server.close();
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exitCode = 1;
  } else {
    console.log('\ninteraction mode fits, renders options, replies and reports real changes');
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
