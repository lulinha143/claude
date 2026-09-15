import { test, expect, type Page } from '@playwright/test';
import { cableLevelEdges, cableLevelSlots } from '../../src/sim/minigames';
import { cableScratchRows, cableScratchPoint } from './support/cable-scratch';
import { watchCableClears, cableClears } from './support/cable-watch';

const SAVE = {
  version: 7,
  onboardingComplete: true,
  lastSaved: Date.now(),
  resources: {
    nuts: 5_000_000,
    goldenNuts: 40,
    reputation: 4_000,
    morale: 82,
    permanentKernels: 3,
  },
  achievements: {
    'nuts-and-bolts': 1,
    'shell-company': 1,
    'touch-grass': 1,
    reputable: 1,
    minigamer: 1,
  },
  employees: { pip: { hired: true, level: 6, room: 'founder-desk', x: 0.4 } },
  collections: { nuts: [], outfits: [], logos: [], moments: [], secrets: [] },
  decorationInstances: [],
  settings: { reducedMotion: false, language: 'en' },
};

async function boot(page: Page, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript((save) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(save));
    localStorage.setItem('wmno.lang', 'en');
  }, SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15_000 });
  for (let index = 0; index < 4; index += 1) {
    const dismiss = page.locator('.popup__actions button, .modal button').first();
    if (await dismiss.count()) await dismiss.click({ timeout: 1_000 }).catch(() => {});
    await page.waitForTimeout(100);
  }
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.locator('.microgame-menu')).toBeVisible();
}

async function openGame(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  const game = page.locator('.microgame');
  await expect(game).toHaveAttribute('data-phase', 'intro');
  await expect(game.locator('.microgame-emblem')).toBeVisible();
  await page.waitForTimeout(750);
  return game;
}

async function startGame(page: Page) {
  await page.locator('.microgame__start').click();
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'countdown');
  await expect(page.locator('.microgame__countdown')).toBeVisible();
  await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'play', {
    timeout: 5_000,
  });
  await expect(page.locator('.microgame__bar')).toBeVisible();
  await page.waitForTimeout(500);
}

async function setDocumentVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((nextState) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: nextState,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/* No retries, deliberately.
   The Cable case in here was intermittent for a long time and collected a documented
   retry to absorb it. The retry is gone because the cause is: a cleared desk advances to
   the next one 1450ms later, and both the solve loop and the assertions used to keep
   working against a board that had already been replaced. Nothing about that was random
   — it just needed the machine to be slow enough. It is now recorded in the page as it
   happens (support/cable-watch.ts) and the celebration is frozen before anything is
   asserted, so the window cannot be missed.
   Verified by removing the retry and running both cable specs five times at
   --workers=2 with five of eight cores saturated: 13 passed, five times out of five.
   If this file starts flaking again, that is new information and should be diagnosed,
   not absorbed. */

test.describe.serial('premium minigame presentation', () => {
  test('opens, plays, and safely leaves Coffee Rescue without a reward', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-intro-1280x800.png' });
    await startGame(page);
    await expect(game.locator('.coffee__cafe')).toBeVisible();
    const drop = game.locator('.coffee__drop').first();
    await expect(drop).toBeVisible({ timeout: 3_000 });
    const dropBox = await drop.boundingBox();
    const areaBox = await game.locator('.coffee__area').boundingBox();
    if (dropBox && areaBox) {
      await page.mouse.move(dropBox.x + dropBox.width / 2, areaBox.y + areaBox.height - 22);
      await expect(game.locator('.microgame__score b')).not.toHaveText('0', { timeout: 4_000 });
    }
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-play-1280x800.png' });
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();
    await expect(page.locator('.microgame__reward-slip')).toHaveCount(0);
  });

  test('opens and plays Bug Squash with a tactile hit', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-intro-1280x800.png' });
    await startGame(page);
    await expect(game.locator('.bugsquash__desk')).toBeVisible();
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    const activeIndex = await activeBug.evaluate((element) =>
      [...element.parentElement!.children].indexOf(element),
    );
    const claimedBurrow = game.locator('.burrow').nth(activeIndex);
    await claimedBurrow.click();
    await expect(game.locator('.burrow.is-hit')).toBeVisible();
    await expect(game.locator('.microgame__score b')).toHaveText('2');
    // A duplicate activation that lands inside the just-hit grace window must
    // not become an unfair empty-drawer penalty.
    // Dispatch synchronously because Playwright's actionability checks wait for
    // the intentional drawer-hit animation, which would no longer exercise the
    // real duplicate-event race window.
    await claimedBurrow.dispatchEvent('click');
    await expect(game.locator('.microgame__score b')).toHaveText('2');
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-hit-1280x800.png' });
    await page.waitForTimeout(220);
    const emptyBurrow = game.locator('.burrow').nth((activeIndex + 1) % 9);
    await emptyBurrow.click();
    await expect(emptyBurrow).toHaveClass(/is-wrong/);
    // ASCII hyphen-minus, not U+2212: the bundled fonts are Latin subsets and the
    // typographic minus sign renders as a tofu box without a system fallback.
    await expect(emptyBurrow.locator('.burrow__miss b')).toHaveText('-2');
    await expect(emptyBurrow.locator('.burrow__miss b')).toBeVisible();
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-penalty-1280x800.png' });
    await expect(game.locator('.microgame__score b')).toHaveText('0');
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();
  });

  test('untangles the Cable desk with robust pointer movement and one clear rule', async ({
    page,
  }) => {
    await boot(page);
    const game = await openGame(page, 'Cable Untangle Desk');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-intro-1280x800.png' });
    await startGame(page);
    const board = game.locator('.cable__board');
    const plugs = game.locator('.cable__node');
    await expect(board).toBeVisible();
    await expect(plugs).toHaveCount(5);
    /* Cable count comes from the desk that actually loaded, not from a constant.
       Asserting "5 cables for 5 plugs" quietly assumed every desk is a single ring;
       a wheel wires four rim cables plus four spokes to the same five plugs. Checking
       against the authored edge list is the stronger claim anyway: the renderer must
       draw exactly the cabling the level defines, whatever its shape. */
    const levelId = await board.getAttribute('data-level');
    expect(levelId).toBeTruthy();
    const authoredEdges = cableLevelEdges(levelId!);
    expect(authoredEdges.length).toBeGreaterThanOrEqual(5);
    await expect(game.locator('.cable__strand-body')).toHaveCount(authoredEdges.length);
    await expect(
      game.locator('.cable__port, .cable__desk-art, .cable__tag, .cable__node-label'),
    ).toHaveCount(0);
    await expect(game.locator('.cable__crossings')).not.toContainText('0');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-tangled-1280x800.png' });

    // A press/release completed in the same turn must never strand active drag
    // state, which was the source of the intermittent stuck-cable regression.
    const firstPlug = await plugs.nth(0).boundingBox();
    expect(firstPlug).not.toBeNull();
    await page.mouse.move(
      firstPlug!.x + firstPlug!.width / 2,
      firstPlug!.y + firstPlug!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.up();
    await expect(game.locator('.cable__node.is-active')).toHaveCount(0);

    // An interrupted native pointer sequence restores the original position.
    const beforeCancel = await plugs.nth(0).boundingBox();
    const beforeCancelPosition = await plugs.nth(0).evaluate((element) => ({
      left: (element as HTMLElement).style.left,
      top: (element as HTMLElement).style.top,
    }));
    await page.mouse.move(
      beforeCancel!.x + beforeCancel!.width / 2,
      beforeCancel!.y + beforeCancel!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(beforeCancel!.x + 90, beforeCancel!.y + 70, { steps: 4 });
    await plugs
      .nth(0)
      .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
    await page.mouse.up();
    await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
    await expect
      .poll(() =>
        plugs.nth(0).evaluate((element) => ({
          left: (element as HTMLElement).style.left,
          top: (element as HTMLElement).style.top,
        })),
      )
      .toEqual(beforeCancelPosition);

    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();
    // The board reports its own horizontal flip; inferring it from where plug 0
    // happens to have been tangled is a guess that a non-ring shape can get wrong.
    const mirrored = (await board.getAttribute('data-mirrored')) === 'true';
    const target = (x: number, y: number) => ({
      x: boardBox!.x + (mirrored ? 1 - x : x) * boardBox!.width,
      y: boardBox!.y + y * boardBox!.height,
    });
    /* Press where the intended plug is ACTUALLY on top, not at its centre and hope.
       A plug is a round button about 40px across and a tangled desk routinely overlaps
       two of them, so a press at plug N's centre can land on plug M and drag the wrong
       node — the real cause of this test's intermittency. Rather than separating the
       plugs first (a keyboard pass could do it, but 5 plugs x up to 48 nudges x a
       position read per nudge does not fit inside the game's own 45-second round, which
       is how that attempt ended up asserting against a board whose clock had already
       expired), just ask the page who owns the pixel and offset within the plug until
       the answer is the plug we mean. Costs one evaluate per drag in the common case. */
    const GRAB_OFFSETS: [number, number][] = [
      [0.5, 0.5],
      [0.5, 0.25],
      [0.5, 0.75],
      [0.25, 0.5],
      [0.75, 0.5],
      [0.32, 0.32],
      [0.68, 0.32],
      [0.32, 0.68],
      [0.68, 0.68],
    ];

    /* Either a point that belongs to plug `id`, or the plug sitting on top of it. */
    const grabTarget = async (id: number) => {
      const box = await plugs.nth(id).boundingBox();
      expect(box, `plug ${id} has no box`).not.toBeNull();
      const owners = await page.evaluate(
        ({ rect, offsets }) =>
          offsets.map(([fx, fy]) => ({
            x: rect.x + rect.width * fx,
            y: rect.y + rect.height * fy,
            owner:
              document
                .elementFromPoint(rect.x + rect.width * fx, rect.y + rect.height * fy)
                ?.closest('.cable__node')
                ?.getAttribute('data-node-id') ?? null,
          })),
        {
          rect: { x: box!.x, y: box!.y, width: box!.width, height: box!.height },
          offsets: GRAB_OFFSETS,
        },
      );
      const mine = owners.find((sample) => sample.owner === String(id));
      if (mine) return { point: { x: mine.x, y: mine.y } };
      // Whatever is on top at the plug's own centre is what has to move first.
      const centre = owners[0].owner;
      return { coveredBy: centre !== null && centre !== String(id) ? Number(centre) : null };
    };

    /* Drag, then CHECK the plug actually arrived, and try again if it did not.
       Solving a desk from its authored slots means ten drags rather than the five fixed
       moves this test used to make, and under load a coalesced pointer move can leave a
       plug short of its target. That matters most during the scatter pass: a plug that
       stops short can end up overlapping another, and then the next pick-up grabs the
       wrong one and the whole solve wanders off. Verifying each drag removes the timing
       sensitivity at its source. */
    /* Move whatever is on top of plug `id` out of the way, so `id` becomes grabbable.
       This is what makes separation deterministic rather than hopeful. The covering plug
       is by definition the one being hit-tested at that point, so ITS centre is always
       grabbable — which means each displacement is guaranteed to make progress, and the
       recursion can only run as deep as the number of plugs. The coverer is parked on the
       far side of the board from the plug it was burying, so it cannot immediately bury
       it again. */
    const displaceCoverer = async (coverer: number, buriedId: number) => {
      const buried = await plugs.nth(buriedId).boundingBox();
      const parkX = buried && buried.x > boardBox!.x + boardBox!.width / 2 ? 0.12 : 0.88;
      const box = await plugs.nth(coverer).boundingBox();
      if (!box) return;
      const destination = target(parkX, 0.5);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(destination.x, destination.y, { steps: 6 });
      await page.mouse.up();
      await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
    };

    /* `dig` is only safe while SCATTERING.
       Displacing a coverer is the right move on a tangled desk, where no plug is where it
       needs to be yet. It is actively destructive during seating: a plug that has already
       been placed on its slot can briefly sit over the next one, and dragging it to the
       board edge throws away work the pass just did. Enabling it in both phases made every
       seating pass undo the previous one, and the desk finished at "Tangles: 5" — no
       progress at all — under load.
       During seating it is also unnecessary: scratch rows are chosen to be clear of the
       solution slots, so an unseated plug parked on a scratch row is not under a seated
       one. A plug found buried there is a stray from an incomplete drag, and the attempt
       loop below re-drags it. */
    const dragPlug = async (id: number, x: number, y: number, dig = false) => {
      const destination = target(x, y);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let found = await grabTarget(id);
        // A buried plug is UNBURIED rather than reported as unreachable. Bounded by the
        // plug count, so this cannot spin.
        for (let depth = 0; dig && depth < 5 && !found.point; depth += 1) {
          if (found.coveredBy === null || found.coveredBy === id) break;
          await displaceCoverer(found.coveredBy, id);
          found = await grabTarget(id);
        }
        const grab = found.point;
        // A plug with no reachable pixel cannot be dragged at all, so this attempt has
        // nothing to do; the caller's verification decides whether that mattered.
        if (!grab) continue;
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        await page.mouse.move(destination.x, destination.y, { steps: 8 });
        await page.mouse.up();
        await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
        /* Compare the COMMITTED position, not the painted one. The node carries its
           position as `style.left/top` percentages straight from game state, while its
           bounding box is still easing into place for a moment afterwards. Measuring the
           rect immediately after mouse-up therefore reported "did not arrive" under load
           even when the drag had registered perfectly, all three attempts were spent, and
           the plug was abandoned mid-board — which is how this ended up leaving "Tangles:
           3" in parallel runs while passing on its own. */
        const committed = await plugs.nth(id).evaluate((el) => ({
          left: parseFloat((el as HTMLElement).style.left),
          top: parseFloat((el as HTMLElement).style.top),
        }));
        const wantX = (mirrored ? 1 - x : x) * 100;
        if (Math.abs(committed.left - wantX) <= 1.5 && Math.abs(committed.top - y * 100) <= 1.5) {
          return;
        }
      }
    };

    /* Solve from the desk's OWN authored slots rather than from a fixed sequence of
       coordinates. The previous sequence used the centre of the board as spare space
       and then walked the plugs around the perimeter, which only clears a single ring
       — a wheel wires a hub INTO that centre, so no perimeter-only ordering can ever
       finish it. Scatter clear of the slots first so each pick-up grabs its own plug,
       then seat every plug on its slot. */
    const solveSlots = cableLevelSlots(levelId!);
    expect(solveSlots).toHaveLength(5);
    const rows = cableScratchRows(solveSlots);

    /* Arm the clear recorder BEFORE the first plug is touched, and let it freeze the
       celebration. See support/cable-watch.ts for why this has to happen in the page.
       Arming it before the scatter matters on its own: the SCATTER pass can solve the desk
       by itself — laying five plugs out in index order across two rows is frequently
       already untangled, especially for a cycle. The desk then cleared, advanced to a
       different desk, and the seating pass dragged plugs to the old desk's slots on the
       new board, which of course never solved. That was the real cause of this test's
       long-running intermittency, and it presented as "a plug never moved". */
    await watchCableClears(page, { pauseOnClear: true });
    const solvedRecord = async () => (await cableClears(page))[0] ?? null;

    let solved = await solvedRecord();
    for (let id = 0; id < solveSlots.length && !solved; id += 1) {
      const scratch = cableScratchPoint(id, solveSlots.length, rows);
      await dragPlug(id, scratch.x, scratch.y, true);
      solved = await solvedRecord();
    }

    /* Establish — and then STATE — the invariant the scatter pass exists for.
       The seating pass relies on picking up each plug individually. If a scatter drag did
       not land, a plug can be left mid-board underneath another, and then a pick-up grabs
       the wrong node and the solve wanders. So: find any plug that does not own its own
       centre, re-scatter exactly those, and assert the invariant holds before seating
       begins. Bounded passes, no blanket retry, and a failure names the plugs. */
    const coveredPlugs = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.cable__node')]
          .map((node) => {
            const rect = node.getBoundingClientRect();
            const owner = document
              .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
              ?.closest('.cable__node');
            return owner === node ? null : Number(node.getAttribute('data-node-id'));
          })
          .filter((id): id is number => id !== null),
      );

    if (!solved) {
      for (let pass = 0; pass < 3; pass += 1) {
        const covered = await coveredPlugs();
        if (covered.length === 0) break;
        for (const id of covered) {
          const scratch = cableScratchPoint(id, solveSlots.length, rows);
          await dragPlug(id, scratch.x, scratch.y, true);
        }
      }
      expect(
        await coveredPlugs(),
        'these plugs are still buried at their own centre after scattering, so the seating pass cannot pick them up reliably',
      ).toEqual([]);
    }

    /* Seat the plugs, and STOP THE INSTANT THE DESK CLEARS.
       This is the fix for the long-running intermittency in this test, and the cause was
       never a stuck plug. A cleared desk auto-advances after TRANSITION_MS (1450ms, see
       CableUntangle) so the celebration can play. The loop used to seat all five plugs and
       only then look at the tangle count — so once the desk cleared partway through, it
       carried on dragging plugs around a celebrating board, spent the 1450ms window, and
       the assertions below then described the NEXT desk: "Tangles: 5" for a board that had
       in fact been solved, no `.cable__cleared` panel, and plug positions that indexed off
       the end of this desk's slot list. Every time this solve got more thorough it got
       more likely to overshoot, which is why it looked like a load-sensitive flake.
       Checking after every single drag closes that window. */
    for (let attempt = 0; attempt < 6 && !solved; attempt += 1) {
      for (let id = 0; id < solveSlots.length && !solved; id += 1) {
        await dragPlug(id, solveSlots[id].x, solveSlots[id].y);
        solved = await solvedRecord();
      }
    }

    /* What the board looked like at the instant it cleared. These are the load-proof
       assertions; the live ones below additionally prove the pause held. */
    expect(
      solved,
      `desk ${levelId} never reached a cleared state during the seating passes`,
    ).not.toBeNull();
    expect(solved!.level, 'a different desk cleared than the one under test').toBe(levelId);
    expect(solved!.crossings, 'the desk cleared without reporting zero crossings').toMatch(/\b0\b/);
    expect(solved!.panel, 'the cleared panel did not announce itself').toContain(
      'All cables clear!',
    );
    /* Say so if the ROUND ran out rather than the solve failing. A cable round lasts 45
       real seconds, so a solve that gets slower — more drags, more verification, slower
       CPU — eventually stops being a puzzle failure and becomes a clock failure. Those
       look identical from the outside: plugs simply stop responding and sit wherever
       they were, which reads as "a plug is stuck". Checking the phase first means the
       next person gets told which of the two happened. */
    await expect(
      page.locator('.microgame'),
      'the 45s round expired before the solve finished — this is a test-speed failure, not a stuck plug',
    ).toHaveAttribute('data-phase', 'play');
    /* If the desk is still tangled, say WHICH plug is not where it was sent. "Tangles: 5"
       on its own cannot distinguish "the drags did not land" from "the authored slots do
       not actually solve this desk", and those need opposite fixes. */
    /* Assert we are still looking at the desk we solved. If the board advanced, every
       assertion below is about a different puzzle, and saying so is far more useful than
       letting a tangle count from the next desk masquerade as a failure to solve. */
    await expect(
      board,
      `the board advanced to a different desk before this test could assert on ${levelId}; the solve did not fail, it finished too close to the ${1450}ms auto-advance`,
    ).toHaveAttribute('data-level', levelId!);
    const placement = await page.evaluate(
      ({ slots, flip }) =>
        [...document.querySelectorAll('.cable__node')].map((node) => {
          const id = Number(node.getAttribute('data-node-id'));
          const slot = slots[id];
          if (!slot) return { id, at: 'n/a', want: 'no such slot on this desk', off: 'n/a' };
          const want = { x: (flip ? 1 - slot.x : slot.x) * 100, y: slot.y * 100 };
          const at = {
            x: parseFloat((node as HTMLElement).style.left),
            y: parseFloat((node as HTMLElement).style.top),
          };
          return {
            id,
            at: `${at.x.toFixed(1)},${at.y.toFixed(1)}`,
            want: `${want.x.toFixed(1)},${want.y.toFixed(1)}`,
            off: Math.max(Math.abs(at.x - want.x), Math.abs(at.y - want.y)).toFixed(1),
          };
        }),
      { slots: solveSlots, flip: mirrored },
    );
    await expect(
      game.locator('.cable__crossings'),
      `desk ${levelId} still tangled. Plug placement (off = worst-axis error in board %):\n` +
        placement.map((p) => `  plug ${p.id}: at ${p.at} want ${p.want} off ${p.off}`).join('\n'),
    ).toContainText('0');
    await expect(game.locator('.cable__cleared')).toBeVisible();
    await expect(game.locator('.cable__cleared')).toContainText('All cables clear!');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-complete-1280x800.png' });
    // The board was paused the moment it cleared, so this is the real claim: a paused
    // celebration does not advance, however long the test sits on it. (The unpaused
    // transition to the next desk is covered by cable-progression.spec.ts.)
    await page.waitForTimeout(1_600);
    await expect(game.locator('.cable__cleared')).toBeVisible();
    await expect(board).toHaveAttribute('data-level', levelId!);
  });

  test('every minigame stays readable and pointer-playable at compact size', async ({ page }) => {
    await boot(page, { width: 390, height: 700 });

    let game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const area = await game.locator('.coffee__area').boundingBox();
    expect(area).not.toBeNull();
    /* PLAY it, rather than parking the mug on one drop's starting column.
       Two things made the parked version unreliable, and both are real behaviour:
       the drop kinds fall at different speeds, so the one that was measured is not
       necessarily the one that reaches the mug; and the decaf is a hazard, so a mug
       left sitting in one column happily catches it — and since a first mug pays 2
       while a caught decaf costs 3, the score can land back on "0" and the check that
       it is non-zero fails a moment after it passed.
       Following the lowest catchable drop and stepping aside for the hazard is what a
       player does, and it is what "pointer-playable" actually means. */
    const mugY = area!.y + area!.height - 18;
    let scored = false;
    for (let i = 0; i < 90 && !scored; i += 1) {
      const next = await page.evaluate(() => {
        const drops = [...document.querySelectorAll('.coffee__drop')].map((el) => {
          const b = el.getBoundingClientRect();
          return {
            hazard: el.classList.contains('coffee__drop--decaf'),
            cx: b.x + b.width / 2,
            cy: b.y + b.height / 2,
          };
        });
        if (!drops.length) return null;
        drops.sort((a, b) => b.cy - a.cy);
        return drops[0];
      });
      if (next) {
        // Chase what is catchable; slide away from what is not.
        const toX = next.hazard
          ? next.cx - area!.x > area!.width / 2
            ? area!.x + 10
            : area!.x + area!.width - 10
          : next.cx;
        await page.mouse.move(toX, mugY);
      }
      await page.waitForTimeout(60);
      scored = (await game.locator('.microgame__score b').textContent())?.trim() !== '0';
    }
    expect(scored, 'a compact Coffee board never paid out for a caught drop').toBe(true);
    await page.screenshot({ path: 'visual-artifacts/minigame-coffee-play-390x700.png' });
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();

    game = await openGame(page, 'Bug Squash');
    await startGame(page);
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    await activeBug.dispatchEvent('click');
    await expect(game.locator('.burrow.is-hit')).toBeVisible();
    await expect(game.locator('.bug.is-squashed')).toBeVisible();
    await expect(game.locator('.microgame__score b')).not.toHaveText('0');
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'visual-artifacts/minigame-bug-hit-390x700.png' });
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();

    game = await openGame(page, 'Cable Untangle Desk');
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-intro-390x700.png' });
    await startGame(page);
    const cableBoard = game.locator('.cable__board');
    const cablePlug = game.locator('.cable__node').first();
    const cablePlugBox = await cablePlug.boundingBox();
    expect(cablePlugBox).not.toBeNull();
    await page.mouse.move(
      cablePlugBox!.x + cablePlugBox!.width / 2,
      cablePlugBox!.y + cablePlugBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(cablePlugBox!.x + 35, cablePlugBox!.y + 55, { steps: 4 });
    await page.mouse.up();
    await expect(game.locator('.cable__node.is-active')).toHaveCount(0);
    await expect(cableBoard).toBeVisible();

    const bounds = await game.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'visual-artifacts/minigame-cable-play-390x700.png' });
  });

  test('a hidden countdown stays frozen until the app is visible again', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await game.locator('.microgame__start').click();
    await expect(game).toHaveAttribute('data-phase', 'countdown');
    await setDocumentVisibility(page, 'hidden');
    const countdown = game.locator('.microgame__countdown strong');
    const frozenValue = await countdown.textContent();
    await page.waitForTimeout(1_200);
    await expect(countdown).toHaveText(frozenValue ?? '3');
    await setDocumentVisibility(page, 'visible');
    await expect(game).toHaveAttribute('data-phase', 'play', { timeout: 5_000 });
  });

  test('pause safety freezes play and preserves a manual pause across visibility changes', async ({
    page,
  }) => {
    await boot(page);
    const game = await openGame(page, 'Bug Squash');
    await startGame(page);

    const timer = game.locator('.microgame__timer');
    const pause = game.locator('.microgame__pause');
    const timeBefore = await timer.textContent();
    const activeBefore = await game.locator('.burrow.is-up').count();
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.microgame__paused')).toBeVisible();
    await page.waitForTimeout(1_250);
    await expect(timer).toHaveText(timeBefore ?? '');
    expect(await game.locator('.burrow.is-up').count()).toBe(activeBefore);
    await expect(game.locator('.burrow').first()).toBeDisabled();

    await setDocumentVisibility(page, 'hidden');
    await setDocumentVisibility(page, 'visible');
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(game.locator('.microgame__paused')).toBeVisible();

    await game.locator('.microgame__paused .buy-btn').click();
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(1_100);
    expect(await timer.textContent()).not.toBe(timeBefore);
  });

  test('leaving active rounds never grants a reward and a fresh round starts cleanly', async ({
    page,
  }) => {
    await boot(page);
    let game = await openGame(page, 'Bug Squash');
    await startGame(page);
    const activeBug = game.locator('.burrow.is-up');
    await expect(activeBug).toBeVisible({ timeout: 3_000 });
    await activeBug.click();
    await game.locator('.microgame__exit').click();
    await expect(page.locator('.microgame-menu')).toBeVisible();

    game = await openGame(page, 'Bug Squash');
    await startGame(page);
    await expect(game.locator('.microgame__score b')).toHaveText('0');
    await game.locator('.microgame__exit').click();
    await page.getByRole('button', { name: 'Stats', exact: true }).click();
    const row = page.locator('.stats-table tr').filter({ hasText: 'Micro-games played' });
    await expect(row.locator('td')).toHaveText('0');
  });

  test('Coffee keyboard control is scoped, pause is inert, and compact geometry stays visible', async ({
    page,
  }) => {
    await boot(page, { width: 320, height: 520 });
    const game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const area = game.locator('.coffee__area');
    const mug = game.locator('.coffee__mug');
    await area.scrollIntoViewIfNeeded();
    await area.focus();
    const before = Number.parseFloat(
      (await mug.getAttribute('style'))?.match(/left:\s*([\d.]+)/)?.[1] ?? '0',
    );
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () =>
        Number.parseFloat((await mug.getAttribute('style'))?.match(/left:\s*([\d.]+)/)?.[1] ?? '0'),
      )
      .toBeGreaterThan(before);

    const moved = await mug.getAttribute('style');
    await game.locator('.microgame__exit').focus();
    await page.keyboard.press('ArrowRight');
    await expect(mug).toHaveAttribute('style', moved ?? '');

    await game.locator('.microgame__pause').click();
    await expect(game.locator('.microgame__playfield')).toHaveAttribute('inert', '');
    const resume = game.locator('.microgame__paused .buy-btn');
    await expect(resume).toBeFocused();
    await resume.click();
    await expect(area).toBeFocused();

    const areaBox = await area.boundingBox();
    const mugBox = await mug.boundingBox();
    expect(areaBox).not.toBeNull();
    expect(mugBox).not.toBeNull();
    expect(mugBox!.x).toBeGreaterThanOrEqual(areaBox!.x);
    expect(mugBox!.x + mugBox!.width).toBeLessThanOrEqual(areaBox!.x + areaBox!.width);
    await expect(game.locator('.coffee__streak')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test('reduced-motion Coffee feedback clears while preserving its awarded score', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const drop = game.locator('.coffee__drop--tap').first();
    await expect(drop).toBeVisible({ timeout: 3_000 });
    await drop.dispatchEvent('click');
    await expect(game.locator('.microgame__score b')).not.toHaveText('0');
    await expect(game.locator('.coffee__catch-fx')).toHaveCount(0);
  });

  test('changing the OS motion preference waits until the next round', async ({ page }) => {
    await boot(page);
    const game = await openGame(page, 'Coffee Rescue');
    await startGame(page);
    const fallingDrop = game.locator('.coffee__drop:not(.coffee__drop--tap)').first();
    await expect(fallingDrop).toBeVisible({ timeout: 3_000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(600);
    await expect(game.locator('.coffee__drop--tap')).toHaveCount(0);
    await expect(game.locator('.coffee__area')).toHaveAttribute('tabindex', '0');
  });
});
