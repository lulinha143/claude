#!/usr/bin/env node
/**
 * Measure AND photograph the running game, at many window sizes.
 *
 * `visual-qa.mjs` captures whole viewports, which is the right tool for "does the
 * office still look like the office". This one answers the questions that a picture
 * alone cannot settle, and that a unit test cannot reach because they are only true
 * of real layout:
 *
 *   - do the window controls ever collide with the nav or drift out of the letterhead?
 *   - does the scene scale coherently, i.e. do characters, desks, stations and floor
 *     all keep the same relative size as the window changes?
 *   - is every character actually rendered at the cast scale, feet on the floor?
 *   - do mood bubbles sit above the HEAD rather than above the canvas?
 *   - does anything overflow, clip, or overlap that should not?
 *
 * It reports numbers to stdout (and optionally JSON), fails loudly on a violated
 * invariant, and writes per-room screenshots so the composition can be looked at.
 *
 * Usage:
 *   node scripts/qa-inspect.mjs                     # measure + shoot, default sizes
 *   node scripts/qa-inspect.mjs --tag before        # prefix the PNG names
 *   node scripts/qa-inspect.mjs --json out.json     # machine-readable report
 *   node scripts/qa-inspect.mjs --rooms founder-desk,lab
 *   node scripts/qa-inspect.mjs --no-shots          # measurements only (fast)
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

// Deliberately awkward shapes as well as ordinary ones: the point is to catch the
// layout that only breaks at an aspect ratio nobody designs against.
const SIZES = [
  { name: 'min-900x600', width: 900, height: 600 },
  { name: 'small-1024x640', width: 1024, height: 640 },
  { name: 'default-1280x800', width: 1280, height: 800 },
  { name: 'hd-1600x900', width: 1600, height: 900 },
  { name: 'full-1920x1080', width: 1920, height: 1080 },
  { name: 'ultrawide-2560x1080', width: 2560, height: 1080 },
  { name: 'tall-1100x1400', width: 1100, height: 1400 },
  { name: 'squat-1500x560', width: 1500, height: 560 },
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

/** Everything measured inside the page, in one pass. */
const probe = () => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: +r.x.toFixed(1),
      y: +r.y.toFixed(1),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      right: +r.right.toFixed(1),
    };
  };
  const q = (sel, root = document) => root.querySelector(sel);
  const all = (sel, root = document) => [...root.querySelectorAll(sel)];

  const office = q('.office');
  const assetScale = office
    ? parseFloat(getComputedStyle(office).getPropertyValue('--asset-scale')) || 1
    : 1;

  const rooms = all('.floor[data-room]').map((floor) => {
    const stage = q('.floor__stage', floor);
    const critters = all('.critter-btn', floor).map((btn) => {
      const sprite = q('.employee-sprite', btn);
      const vector = q('svg', btn);
      const bubble = q('.speech-note, .mood-badge, .employee-bubble', btn);
      const art = sprite ?? vector;
      return {
        employee: btn.getAttribute('data-employee') ?? btn.getAttribute('aria-label') ?? '?',
        kind: sprite ? 'sprite' : vector ? 'vector' : 'none',
        btn: rect(btn),
        art: rect(art),
        // Natural size of the bitmap, to catch a distorted aspect ratio.
        natural: sprite ? { w: sprite.naturalWidth, h: sprite.naturalHeight } : null,
        chosen: sprite ? sprite.currentSrc.split('/').pop() : null,
        srcset: sprite ? sprite.getAttribute('srcset') : null,
        attrH: sprite ? sprite.getAttribute('height') : null,
        bubble: rect(bubble),
      };
    });
    return {
      room: floor.getAttribute('data-room'),
      floor: rect(floor),
      stage: rect(stage),
      floorBandPx: stage
        ? +(parseFloat(getComputedStyle(floor).getPropertyValue('--floor-h')) || 0).toFixed(1)
        : 0,
      critters,
      stations: all('.station-btn', floor).map((b) => ({
        kind: [...b.classList].find((c) => c.startsWith('station-btn--')) ?? '?',
        rect: rect(b),
      })),
      decorations: all('.floor__deco', floor).map((d) => ({
        id: d.getAttribute('data-deco') ?? '?',
        rect: rect(d),
        z: getComputedStyle(d).zIndex,
      })),
    };
  });

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    assetScale,
    uiScale:
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1,
    header: rect(q('.header')),
    identity: rect(q('.header__identity')),
    strip: rect(q('.header__strip')),
    windowControls: rect(q('.window-controls')),
    controlButtons: all('.wc-btn').map(rect),
    headerButtons: all('.header__controls button').map(rect),
    nav: rect(q('.nav')),
    navTabs: all('.nav button, .nav a').map((b) => ({
      label: b.textContent.trim(),
      rect: rect(b),
    })),
    main: rect(q('.app__main')),
    notifications: all('.notification, .notif, .toast').map(rect),
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    rooms,
  };
};

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}

const main = async () => {
  const arg = (flag, dflt = null) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : dflt;
  };
  const tag = arg('--tag', 'inspect');
  const jsonOut = arg('--json');
  const shots = !process.argv.includes('--no-shots');
  const wantRooms = (arg('--rooms', 'founder-desk,lab,research,marketing') ?? '')
    .split(',')
    .filter(Boolean);

  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const report = [];
  const problems = [];

  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    await page.addInitScript((data) => {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
      window.localStorage.setItem('wmno.lang', 'en');
    }, qaSave());
    // Desktop chrome (frameless window controls) only renders when the platform
    // adapter reports a desktop shell, so fake just enough of the bridge.
    // The window controls only render when the platform adapter reports a desktop
    // shell, which it decides by the presence of the preload bridge on
    // `window.desktop` (electron/preload.ts). Faking it is what lets the frameless
    // chrome be measured in a plain browser.
    await page.addInitScript(() => {
      const noop = async () => undefined;
      const unsub = () => () => {};
      window.desktop = {
        getWindowSettings: async () => ({}),
        setWindowSettings: noop,
        setScale: noop,
        hideToTray: noop,
        show: noop,
        minimize: noop,
        toggleMaximize: async () => false,
        isMaximized: async () => false,
        closeWindow: noop,
        quit: noop,
        getIdleSeconds: async () => 0,
        getPlatformInfo: async () => ({
          isDesktop: true,
          platform: 'win32',
          isSteamDeck: false,
          appVersion: 'qa',
        }),
        onToggleVisibility: unsub,
        onQuietMode: unsub,
        onFocusChanged: unsub,
        onShowSettings: unsub,
        onMaximizeChanged: unsub,
      };
    });
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    await page.waitForSelector('.floor', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const m = await page.evaluate(probe);
    m.size = size.name;
    report.push(m);

    // ---- invariants -------------------------------------------------------
    const fail = (msg) => problems.push(`[${size.name}] ${msg}`);

    if (m.windowControls) {
      if (m.header && m.windowControls.bottom > m.header.bottom + 0.5) {
        fail(
          `window controls spill below the letterhead ` +
            `(controls bottom ${m.windowControls.bottom} > header bottom ${m.header.bottom})`,
        );
      }
      if (overlaps(m.windowControls, m.nav)) fail('window controls overlap the nav');
      if (overlaps(m.windowControls, m.main)) fail('window controls overlap the play area');
      if (m.windowControls.right > m.viewport.w + 0.5) fail('window controls overflow the window');
      for (const [i, b] of m.controlButtons.entries()) {
        if (!b || b.w < 18 || b.h < 18) fail(`window control ${i} is ${b?.w}x${b?.h}, too small`);
      }
      // All three must sit on one row.
      const ys = m.controlButtons.map((b) => b.y);
      if (ys.length && Math.max(...ys) - Math.min(...ys) > 1) {
        fail(
          `window controls are not on one row (y spread ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)})`,
        );
      }
    }
    if (m.nav && m.header && m.nav.y < m.header.bottom - 0.5) fail('nav overlaps the letterhead');
    if (m.docScrollW > m.docClientW + 1) {
      fail(`horizontal overflow: scrollWidth ${m.docScrollW} > clientWidth ${m.docClientW}`);
    }

    for (const room of m.rooms) {
      for (const c of room.critters) {
        if (c.kind === 'sprite' && c.natural && c.art) {
          const naturalAspect = c.natural.w / c.natural.h;
          const drawnAspect = c.art.w / c.art.h;
          if (Math.abs(naturalAspect - drawnAspect) / naturalAspect > 0.02) {
            fail(
              `${room.room}/${c.employee} is distorted: drawn ${drawnAspect.toFixed(3)} vs ` +
                `art ${naturalAspect.toFixed(3)}`,
            );
          }
        }
        if (c.art && room.stage && c.art.bottom > room.stage.bottom + 24) {
          fail(
            `${room.room}/${c.employee} sinks ${(c.art.bottom - room.stage.bottom).toFixed(1)}px below the stage`,
          );
        }
      }
    }

    // ---- shots ------------------------------------------------------------
    if (shots) {
      await page.screenshot({ path: join(OUT, `${tag}-${size.name}.png`) });
      if (size.name === 'default-1280x800') {
        for (const roomId of wantRooms) {
          const el = page.locator(`.floor[data-room="${roomId}"]`).first();
          if (!(await el.count())) continue;
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await el.screenshot({ path: join(OUT, `${tag}-room-${roomId}.png`) }).catch(() => {});
        }
      }
    }
    await page.close();
  }

  await browser.close();
  server.close();

  // ---- report -----------------------------------------------------------
  console.log(
    `\n${'size'.padEnd(20)}${'scale'.padStart(7)}${'header h'.padStart(10)}${'wc y'.padStart(7)}${'nav y'.padStart(7)}`,
  );
  for (const m of report) {
    console.log(
      m.size.padEnd(20) +
        String(m.assetScale).padStart(7) +
        String(m.header?.h ?? '-').padStart(10) +
        String(m.windowControls?.y ?? '-').padStart(7) +
        String(m.nav?.y ?? '-').padStart(7),
    );
  }

  // Scene coherence: everything scene-side should scale by the SAME factor between
  // the smallest and largest window. If characters move and desks do not, the room
  // stops being one place.
  const first = report[0];
  const last = report[report.length - 1];
  const pick = (m, room) => m.rooms.find((r) => r.room === room);
  console.log(
    `\nscene coherence, ${first.size} -> ${last.size} (scale ${first.assetScale} -> ${last.assetScale})`,
  );
  for (const roomId of wantRooms) {
    const a = pick(first, roomId);
    const b = pick(last, roomId);
    if (!a || !b) continue;
    const ratios = [];
    const push = (label, x, y) => {
      if (x && y && x > 0) ratios.push(`${label} ${(y / x).toFixed(3)}`);
    };
    push('floorBand', a.floorBandPx, b.floorBandPx);
    push('stageH', a.stage?.h, b.stage?.h);
    if (a.critters[0]?.art && b.critters[0]?.art) {
      push('characterH', a.critters[0].art.h, b.critters[0].art.h);
    }
    if (a.stations[0]?.rect && b.stations[0]?.rect) {
      push('stationH', a.stations[0].rect.h, b.stations[0].rect.h);
    }
    if (a.decorations[0]?.rect && b.decorations[0]?.rect) {
      push('decoH', a.decorations[0].rect.h, b.decorations[0].rect.h);
    }
    console.log(`  ${roomId.padEnd(16)}${ratios.join('  ')}`);
  }

  const cast = (
    pick(
      report.find((m) => m.size === 'default-1280x800'),
      'founder-desk',
    )?.critters ?? []
  ).concat(
    pick(
      report.find((m) => m.size === 'default-1280x800'),
      'lab',
    )?.critters ?? [],
  );
  if (cast.length) {
    console.log('\ncharacter render @1280x800');
    for (const c of cast) {
      console.log(
        `  ${String(c.employee).padEnd(22)}${c.kind.padEnd(8)}` +
          `${(c.art ? `${c.art.w}x${c.art.h}` : '-').padStart(10)}` +
          ` attrH=${String(c.attrH ?? '-').padStart(4)}` +
          `  file=${(c.chosen ?? '-').padEnd(16)}` +
          `  srcset=${(c.srcset ?? '-').replace(/[^ ]*\//g, '')}`,
      );
    }
  }

  if (jsonOut) {
    await writeFile(jsonOut, JSON.stringify({ sizes: report, problems }, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }

  if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exitCode = 1;
  } else {
    console.log('\nno layout invariant violated');
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
