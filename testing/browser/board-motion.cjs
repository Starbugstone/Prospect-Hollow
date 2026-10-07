const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Board motion check: plays seeded hinted moves on shaped and rectangular boards and
// follows every gem frame by frame on an exact 60 fps clock. It fails when a falling
// gem slows down and speeds up again before it lands (a stutter at a bend or entry
// cell) or when two settled-looking gems overlap (refills stacked on one spot).
// Local only, not CI: see docs/deep-mine-levels.md.
const origin = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';
const MOVES = Number(process.env.PH_MOTION_MOVES || 5);
// The reported level 376, every shaped-board family, and a rectangular control.
const LEVELS = (process.env.PH_MOTION_LEVELS || '13,373,376,385,397').split(',').map(Number);
const LEVELS_PER_CHAPTER = 6;
const FRAME = 1000 / 60;
// Gems closer than this, in cells, are drawn on top of each other. Neighbouring lanes
// of a diagonal funnel pass corner to corner at about 0.71; stacked refills are at 0.
const MIN_GAP = 0.6;
// Speeds in cells per frame. A gem is resting below REST for REST_FRAMES frames.
const REST = 0.005,
  REST_FRAMES = 3;

// Replaces requestAnimationFrame, performance.now and Date.now (Phaser tweens time
// themselves with it) with a clock the check advances one frame at a time, so the
// headless software renderer's own frame drops cannot add or hide stutter.
function installClock(seed) {
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const realNow = performance.now.bind(performance),
    realDate = Date.now.bind(Date),
    realRaf = window.requestAnimationFrame.bind(window),
    realCancel = window.cancelAnimationFrame.bind(window);
  const queue = new Map();
  let manual = false,
    now = 0,
    dateOffset = 0,
    nextId = 1e6;
  performance.now = () => (manual ? now : realNow());
  Date.now = () => (manual ? Math.round(dateOffset + now) : realDate());
  window.requestAnimationFrame = (callback) => {
    if (!manual) return realRaf(callback);
    queue.set(nextId, callback);
    return nextId++;
  };
  window.cancelAnimationFrame = (id) => (queue.delete(id) ? undefined : realCancel(id));
  window.__motionClock = {
    start() {
      now = realNow();
      dateOffset = realDate() - now;
      manual = true;
    },
    step(ms) {
      now += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(now);
    },
  };
}

// Runs inside the page: plays hinted moves and samples every visible gem each frame.
async function playMoves({ moves, frame }) {
  const game = document
    .querySelector('#app')
    .__vue_app__.config.globalProperties.$pinia._s.get('game');
  const animator = game.renderer.animator;
  const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));
  window.__motionClock.start();
  const played = [];
  for (let move = 0; move < moves; move++) {
    game.computeHintMove();
    const swap = game.hintMove?.swap;
    if (!swap) break;
    const swapped = [swap.aIndex, swap.bIndex].map((index) => animator.indexToGemId[index]);
    const frames = [];
    const sample = () =>
      frames.push(
        [...animator.gemSprites]
          .filter(([, sprite]) => sprite.visible)
          .map(([id, sprite]) => [
            id,
            sprite.x / animator.cellSize,
            sprite.y / animator.cellSize,
            sprite.alpha,
          ]),
      );
    sample();
    game.resolveSwap(swap.aIndex, swap.bIndex);
    // Run until the move settles, then a few still frames.
    for (let i = 0, still = 0; i < 60 * 15 && still < 6; i++) {
      window.__motionClock.step(frame);
      await yieldTask();
      sample();
      still = game.animationInProgress ? 0 : still + 1;
    }
    played.push({ swapped, frames });
  }
  return played;
}

// Gems drawn on top of each other. The swapped pair crosses on purpose; a fading
// gem is on its way out.
function overlaps({ swapped, frames }) {
  const found = [];
  frames.forEach((gems, frame) => {
    const solid = gems.filter(([, , , alpha]) => alpha >= 0.9);
    for (let a = 0; a < solid.length; a++)
      for (let b = a + 1; b < solid.length; b++) {
        if (swapped.includes(solid[a][0]) && swapped.includes(solid[b][0])) continue;
        const gap = Math.hypot(solid[a][1] - solid[b][1], solid[a][2] - solid[b][2]);
        if (gap < MIN_GAP) found.push({ frame, gems: [solid[a][0], solid[b][0]], gap });
      }
  });
  return found;
}

// A gem that slows to under a fifth of its top speed and then speeds up again before
// reaching the cell it settles in. Gravity accelerates until landing; the bounce after
// landing and rests between cascade steps are fine.
function stutters({ frames }) {
  const tracks = new Map();
  frames.forEach((gems, frame) => {
    for (const [id, x, y] of gems) {
      if (!tracks.has(id)) tracks.set(id, []);
      tracks.get(id).push({ frame, x, y });
    }
  });
  const found = [];
  for (const [id, track] of tracks) {
    const speed = track.map((point, i) =>
      i && point.frame === track[i - 1].frame + 1
        ? Math.hypot(point.x - track[i - 1].x, point.y - track[i - 1].y)
        : 0,
    );
    // Split the track into movements separated by rests.
    let start = null;
    for (let i = 1; i <= track.length; i++) {
      const resting =
        i === track.length || speed.slice(i, i + REST_FRAMES).every((value) => value < REST);
      if (start === null && !resting) start = i;
      if (start === null || !resting) continue;
      const end = track[i - 1];
      const arrival = track.findIndex(
        (point, j) => j >= start && Math.hypot(point.x - end.x, point.y - end.y) < 0.02,
      );
      const approach = speed.slice(start, arrival + 1);
      const peak = Math.max(...approach);
      const fast = approach.findIndex((value) => value >= peak / 2);
      const slow = approach.findIndex((value, j) => j > fast && value < peak / 5);
      const again = approach.findIndex((value, j) => j > slow && value >= peak / 2);
      if (fast >= 0 && slow > 0 && again > 0)
        found.push({ id, frame: track[start + slow].frame, peak, low: approach[slow] });
      start = null;
    }
  }
  return found;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const failures = [];
  try {
    for (const level of LEVELS) {
      const context = await browser.newContext({
        viewport: { width: 412, height: 860 },
        locale: 'en-US',
      });
      context.setDefaultTimeout(60000);
      await context.addInitScript(installClock, level);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(origin, { timeout: 180000 });
      // A cold Vite dev server optimises dependencies on the first visit.
      await page.waitForFunction(() => window.prospectDebug, null, { timeout: 180000 });
      // mineStage opens a chapter's first level; a later level needs the next chapter.
      const chapter = Math.ceil(level / LEVELS_PER_CHAPTER);
      const first = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
      const store = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('game')`;
      await page.evaluate(`prospectDebug.mineStage(${level === first ? chapter : chapter + 1})`);
      await page.waitForFunction(`!!${store}.renderer?.animator`);
      if (level !== first)
        await page.evaluate(`${store}.startLevel(${level}, 'normal', { debugReplay: true })`);
      await page.waitForFunction(
        `(() => { const g = ${store}; return g.renderer?.animator && !g.animationInProgress && g.currentLevelId === ${level}; })()`,
      );
      // Close the mine guide and start screen.
      for (let i = 0; i < 10 && (await page.evaluate(`${store}.inputPaused`)); i++) {
        await page.keyboard.press('Escape');
        const play = page.locator('button.mine-play-button', { hasText: /^Play$/ });
        if (await play.isVisible().catch(() => false)) await play.click().catch(() => {});
        await page.waitForTimeout(400);
      }
      if (await page.evaluate(`${store}.inputPaused`)) throw new Error(`${level}: board is paused`);
      const moves = await page.evaluate(playMoves, { moves: MOVES, frame: FRAME });
      const frames = moves.reduce((sum, move) => sum + move.frames.length, 0);
      let worstGap = Infinity,
        overlapCount = 0,
        stutterCount = 0;
      moves.forEach((move, index) => {
        for (const overlap of overlaps(move)) {
          worstGap = Math.min(worstGap, overlap.gap);
          overlapCount++;
          failures.push(`${level} move ${index + 1}: gems overlap ${JSON.stringify(overlap)}`);
        }
        for (const stutter of stutters(move)) {
          stutterCount++;
          failures.push(`${level} move ${index + 1}: fall stutters ${JSON.stringify(stutter)}`);
        }
      });
      if (moves.length < MOVES) failures.push(`${level}: only ${moves.length} hinted moves`);
      if (errors.length) failures.push(`${level}: page errors ${errors.join(' | ')}`);
      console.log(
        `level ${level}: ${moves.length} moves, ${frames} frames, ` +
          `${overlapCount} overlapping frames, ${stutterCount} stutters` +
          (worstGap < Infinity ? `, closest gems ${worstGap.toFixed(2)} cells` : ''),
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(failures.slice(0, 40).join('\n'));
    console.error(`${failures.length} board motion problem(s).`);
    process.exit(1);
  }
  console.log('Board motion: no stutter or stacked gems.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
