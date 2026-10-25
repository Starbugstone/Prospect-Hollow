// Town construction frame check (issue #54): measures how long the valley's main thread
// stalls while a building starts or finishes its construction reveal and the player
// keeps orbiting the camera. It is a measurement, not a pass/fail test: each run prints
// the long frames, long tasks, input delay and the renderer's own phase timings
// (TownProfiler) so two builds can be compared. Software WebGL and a CPU slowdown stand
// in for a phone; read the numbers as relative, never as a physical-device result.
//
// Scenarios, each in a fresh page:
// - start:           buying an upgrade raises its scaffolding (one-plot swap with a reveal);
// - finish-swap:     finishing a construction that leaves the layout alone (swap path);
// - finish-topology: finishing one that unlocks plots or services, so the renderer falls
//                    back to a full rebuild (prepared update path).
// Run it against Docker Vite with the board motion check's Playwright setup
// (docs/town-rendering-performance-log.md#construction-frame-check).
const fs = require('node:fs');
const os = require('node:os');
const { chromium, SOFTWARE_WEBGL, fixturePage, openFixture, pageErrors } = require('./helpers.cjs');

const env = process.env;
const RUNS = Number(env.PH_TOWN_RUNS ?? 3);
const SCENARIOS = (env.PH_TOWN_SCENARIOS ?? 'start,finish-swap,finish-topology').split(',');
const ERA = env.PH_TOWN_ERA ?? 'industrial';
const THROTTLE = Number(env.PH_TOWN_THROTTLE ?? 4);
const TIER = env.PH_TOWN_TIER ?? 'low';
const VIEWPORT = { width: 412, height: 732 };

const fixture = fixturePage({
  style: 'body{margin:0;overflow:hidden}#frame{position:fixed;inset:0}canvas{display:block;width:100%;height:100%}',
  body: '<div id="frame"><canvas id="town"></canvas></div>',
  script: `
import { BANDIT_EVENT, BUILDINGS, createTown } from '/src/data/town.js';
import { CHAPTERS } from '/src/data/campaign.js';
import { advanceEra } from '/src/game/town/TownEras.js';
import { buildWithHammer, finishConstruction, purchase, upgradeOffer } from '/src/game/town/TownRules.js';
import { TownDiorama } from '/src/game/town/TownDiorama.js';
import { topologySignature } from '/src/game/town/TownPlots.js';
import { loadFamilies, requiredFamilies } from '/src/game/town/assets/MeshCatalog.js';
import { loadFootprints } from '/src/game/town/FootprintCatalog.js';
import { townTimings } from '/src/game/town/TownProfiler.js';
import { afterPaint } from '/src/game/PresentationWork.js';

const labels = { ...Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName])), mine: 'Mine' };
const topology = (town) => JSON.parse(topologySignature(null, town, labels));

// The era demo's progression (scripts/create-era-demo.mjs): every earlier era finished,
// the requested one just opened with its own buildings still to build.
function finishEra(state) {
  for (const pass of [true, false])
    for (const b of BUILDINGS.filter((b) => (b.introducedEra === state.era) === pass)) {
      if (!pass && !state.buildings[b.id]) continue;
      let offer;
      while ((offer = upgradeOffer(state, b.id))) state = buildWithHammer(state, b.id, offer.stage);
    }
  return state;
}
function openEra(era) {
  let town = createTown();
  const completed = (CHAPTERS.findIndex((chapter) => chapter.id === 'river-discovery') + 1) * 6;
  Object.assign(town, { coins: 30000, completedRuns: completed, tourSeen: true, constructionTipSeen: true });
  for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
    town.buildings[b.id] = b.upgrades.length;
  town.forge.charge = 1;
  town.events[BANDIT_EVENT] = { id: 1, atRun: completed, gangSize: 10, sheriffLevel: 5, bankLevel: 5,
    outcome: 'protected', loss: 0, seen: true, targets: ['mine'] };
  while (town.era !== era) {
    town.coins = 10000000;
    const opening = advanceEra(town, town.era);
    if (!opening) throw new Error('Cannot open the era after ' + town.era);
    town = { ...opening, transition: { ...opening.transition, pending: false },
      eraTransitionSeen: { ...opening.eraTransitionSeen, [opening.era]: true }, nextRaidRun: 999 };
    if (town.era !== era) town = finishEra(town);
  }
  town.coins = 10000000;
  return town;
}
// Every construction the open era offers: its start, its finish and the layout parts the
// finish changes.
function constructions(era) {
  const base = openEra(era);
  return BUILDINGS.flatMap(({ id }) => {
    const offer = upgradeOffer(base, id);
    if (!offer?.available || !offer.runs) return [];
    const started = purchase(base, id, offer.stage);
    if (!started?.projects[id]) return [];
    const ready = { ...started, projects: { ...started.projects,
      [id]: { ...started.projects[id], wins: started.projects[id].required } } };
    const finished = finishConstruction(ready, id, started.projects[id].stage);
    if (!finished) return [];
    const before = topology(ready), after = topology(finished);
    return [{ id, type: offer.type ?? 'upgrade', stage: offer.stage, base, started, ready, finished,
      changes: Object.keys(after).filter((key) => after[key] !== before[key]) }];
  });
}
window.listConstructions = (era) =>
  constructions(era).map(({ id, type, stage, changes }) => ({ id, type, stage, changes }));

let scene = null, errors = [];
const measure = (window.measure = { active: false, frames: [], inputs: [] });
addEventListener('pointermove', (event) => {
  if (measure.active) measure.inputs.push(performance.now() - event.timeStamp);
}, { capture: true, passive: true });
function sampleFrames(time) {
  if (measure.active) measure.frames.push(time);
  requestAnimationFrame(sampleFrames);
}
requestAnimationFrame(sampleFrames);

// Opens the scenario's town as TownScene does and returns what it will change.
window.prepare = async (scenario, era, tier, wanted) => {
  localStorage.setItem('prospect.renderTier', tier);
  const options = constructions(era);
  const pick = wanted ? options.find(({ id }) => id === wanted)
    : scenario === 'start' ? options.find(({ stage }) => stage > 0) ?? options[0]
    : scenario === 'finish-swap' ? options.find(({ changes }) => !changes.length)
    : options.find(({ changes }) => changes.length);
  if (!pick) throw new Error('No construction fits ' + scenario + ' in ' + era);
  const [from, to] = scenario === 'start' ? [pick.base, pick.started] : [pick.ready, pick.finished];
  window.next = { id: pick.id, town: to };
  for (const town of [from, to]) {
    await loadFamilies(requiredFamilies(town));
    await loadFootprints(town);
  }
  scene = window.scene = new TownDiorama(document.getElementById('town'), {
    onSelect() {}, onLabels() {}, onCameraDistance() {}, onFirstFrame() {},
    onUnavailable: (error) => errors.push(String(error)),
  });
  // A pinned tier keeps runs comparable: adaptive quality would change it mid-run.
  scene.renderQuality.sample = () => null;
  scene.setReducedMotion(false);
  scene.changeTown(from, labels, 30, null);
  scene.setAvailable([]);
  scene.setUpgradeable([]);
  scene.setMotion(true);
  scene.setPaused(false);
  scene.focusPlace(pick.id);
  return { id: pick.id, type: pick.type, stage: pick.stage, changes: pick.changes };
};
window.ready = () => !!scene && scene.lifeReady === true && !scene.plotsPending() && !errors.length;
window.settings = () => ({
  dpr: scene.renderer.getPixelRatio(), tier: scene.renderQuality.tier,
  cacheSamples: scene.frameCache.target.samples, shadowMap: scene.sun.shadow.mapSize.x,
  drawingBuffer: [scene.canvas.width, scene.canvas.height],
});

// TownScene.update() for a construction: the hammer cue, a painted frame, then the change.
window.trigger = async () => {
  townTimings({ clear: true });
  measure.frames = [];
  measure.inputs = [];
  measure.active = true;
  measure.start = performance.now();
  scene.beginConstructionCue(next.id);
  await new Promise((resolve) => afterPaint(resolve));
  await loadFamilies(requiredFamilies(next.town));
  await loadFootprints(next.town);
  measure.changeAt = performance.now();
  scene.changeTown(next.town, labels, 30, next.id, { keepCamera: true });
};
// The reveal has ended and its settlement has drawn the new shadows.
window.settled = () =>
  !scene.construction && !scene.plotsPending() && scene.lifeReady === true &&
  townTimings().entries.some(({ name, start }) => name === 'settle-shadow-render' && start > measure.start);
window.collect = () => {
  measure.active = false;
  const end = performance.now();
  const frames = measure.frames.slice(1).map((time, i) => time - measure.frames[i]);
  const timings = townTimings();
  return { frames, inputs: measure.inputs, timings, window: end - measure.start, errors };
};
`,
});

const sorted = (list) => [...list].sort((a, b) => a - b);
const percentile = (list, p) => sorted(list)[Math.floor((list.length - 1) * p)] ?? 0;
const median = (list) => percentile(list, 0.5);
const round = (value) => Math.round(value * 10) / 10;

function summarize(raw) {
  const { frames, inputs, timings } = raw;
  const longTasks = timings.longTasks.map(({ ms }) => ms);
  const stages = {};
  for (const { name, ms, detail } of timings.entries) {
    const stage = (stages[name] ??= { count: 0, max: 0, total: 0 });
    stage.count++;
    stage.max = round(Math.max(stage.max, ms));
    stage.total = round(stage.total + ms);
    if (detail?.longest !== undefined) stage.longestStep = round(Math.max(stage.longestStep ?? 0, detail.longest));
    if (detail?.steps !== undefined) stage.steps = (stage.steps ?? 0) + detail.steps;
  }
  const change = timings.entries.find(({ name }) => name === 'town-change');
  return {
    path: change?.detail?.path ?? null,
    topology: change?.detail?.topology ?? [],
    window: round(raw.window),
    frames: {
      count: frames.length,
      p50: round(median(frames)),
      p95: round(percentile(frames, 0.95)),
      worst: round(Math.max(0, ...frames)),
      over50: frames.filter((ms) => ms > 50).length,
      over100: frames.filter((ms) => ms > 100).length,
      // Frame time beyond a 60 Hz budget, summed: the stall the player sees.
      jank: round(frames.reduce((sum, ms) => sum + Math.max(0, ms - 16.7), 0)),
    },
    longTasks: {
      count: longTasks.length,
      worst: round(Math.max(0, ...longTasks)),
      blocking: round(longTasks.reduce((sum, ms) => sum + Math.max(0, ms - 50), 0)),
      during: timings.longTasks
        .filter(({ ms }) => ms > 100)
        .map(({ ms, during }) => `${Math.round(ms)}ms:${[...new Set(during)].join('+') || '-'}`),
    },
    input: {
      events: inputs.length,
      worstDelay: round(Math.max(0, ...inputs)),
      over50: inputs.filter((ms) => ms > 50).length,
    },
    stages,
  };
}

// Orbits the camera with a held mouse until `stop()` resolves, like a player dragging.
function orbit(page, box) {
  let running = true;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height * 0.55;
  const done = (async () => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let t = 0; running; t += 0.12) {
      await page.mouse.move(cx + Math.sin(t) * 110, cy + Math.sin(t * 0.37) * 18);
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
    await page.mouse.up();
  })().catch((error) => {
    // A run that failed closes its page under the drag; report the run's own error.
    if (running) throw error;
  });
  return async () => {
    running = false;
    await done;
  };
}

async function runOnce(browser, scenario, run) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  const errors = pageErrors(page);
  await openFixture(page, 'town-construction-frames', fixture);
  await page.waitForFunction(() => typeof window.prepare === 'function');
  const pick = await page.evaluate(
    ([scenario, era, tier, wanted]) => window.prepare(scenario, era, tier, wanted),
    [scenario, ERA, TIER, env.PH_TOWN_BUILDING || null],
  );
  await page.waitForFunction(() => window.ready(), null, { polling: 250 });
  // Let the deferred life, animal and route work finish before measuring.
  await page.waitForTimeout(4000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const profiling = env.PH_TOWN_PROFILE_DIR;
  if (profiling) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  }
  const stop = orbit(page, await page.locator('#town').boundingBox());
  try {
  // A second of plain orbiting first: the camera-frame cost without construction work.
  await page.waitForTimeout(1500);
  const steady = summarize(
    await page.evaluate(async () => {
      window.measure.active = true;
      window.measure.start = performance.now();
      window.measure.frames = [];
      window.measure.inputs = [];
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return window.collect();
    }),
  );
  if (profiling) await cdp.send('Profiler.start');
  const loadAverage = os.loadavg()[0];
  await page.evaluate(() => window.trigger());
  await page.waitForFunction(() => window.settled(), null, { polling: 250, timeout: 240000 });
  // Animal and route repair continue after the shadow render; keep orbiting through them.
  await page.waitForTimeout(2500);
  var raw = await page.evaluate(() => window.collect());
  } finally {
    await stop().catch(() => {});
  }
  if (profiling) {
    const { profile } = await cdp.send('Profiler.stop');
    fs.mkdirSync(profiling, { recursive: true });
    fs.writeFileSync(`${profiling}/${scenario}-${run}.cpuprofile`, JSON.stringify(profile));
  }
  const settings = await page.evaluate(() => window.settings());
  await context.close();
  if (raw.errors.length || errors.length)
    throw new Error(`${scenario}: ${[...raw.errors, ...errors].join('\n')}`);
  return { scenario, run, ...pick, loadAverage: round(loadAverage * 100) / 100, settings, steady: steady.frames, ...summarize(raw) };
}

(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    if (env.PH_TOWN_LIST) {
      const page = await browser.newPage();
      page.setDefaultTimeout(240000);
      await openFixture(page, 'town-construction-frames', fixture);
      await page.waitForFunction(() => typeof window.listConstructions === 'function');
      console.log(JSON.stringify(await page.evaluate((era) => window.listConstructions(era), ERA), null, 1));
      return;
    }
    const results = [];
    for (let run = 1; run <= RUNS; run++)
      for (const scenario of SCENARIOS) {
        const result = await runOnce(browser, scenario, run);
        results.push(result);
        const { frames, longTasks, input, path, id } = result;
        console.log(
          `${scenario} #${run} ${id} (${path}, load ${result.loadAverage}): worst frame ${frames.worst} ms, ` +
            `${frames.over50} frames >50 ms, ${longTasks.count} long tasks (worst ${longTasks.worst} ms, ` +
            `blocking ${longTasks.blocking} ms), worst input delay ${input.worstDelay} ms`,
        );
      }
    const summary = {};
    for (const scenario of SCENARIOS) {
      const runs = results.filter((result) => result.scenario === scenario);
      const pick = (read) => round(median(runs.map(read)));
      const names = new Set(runs.flatMap(({ stages }) => Object.keys(stages)));
      summary[scenario] = {
        building: runs[0].id,
        path: runs[0].path,
        topology: runs[0].topology,
        runs: runs.length,
        loadAverage: runs.map(({ loadAverage }) => loadAverage),
        steadyWorstFrame: pick((r) => r.steady.worst),
        steadyP50: pick((r) => r.steady.p50),
        worstFrame: pick((r) => r.frames.worst),
        framesOver50: pick((r) => r.frames.over50),
        framesOver100: pick((r) => r.frames.over100),
        jank: pick((r) => r.frames.jank),
        longTasks: pick((r) => r.longTasks.count),
        worstLongTask: pick((r) => r.longTasks.worst),
        blocking: pick((r) => r.longTasks.blocking),
        worstInputDelay: pick((r) => r.input.worstDelay),
        // Median of each stage's longest single call across runs.
        stages: Object.fromEntries(
          [...names].map((name) => [
            name,
            {
              max: pick((r) => r.stages[name]?.max ?? 0),
              total: pick((r) => r.stages[name]?.total ?? 0),
              ...(runs.some((r) => r.stages[name]?.longestStep !== undefined)
                ? { longestStep: pick((r) => r.stages[name]?.longestStep ?? 0) }
                : {}),
            },
          ]),
        ),
      };
    }
    const report = { era: ERA, throttle: THROTTLE, tier: TIER, viewport: VIEWPORT, cpus: os.cpus().length, summary, results };
    if (env.PH_TOWN_OUTPUT) fs.writeFileSync(env.PH_TOWN_OUTPUT, JSON.stringify(report, null, 1));
    console.log(JSON.stringify(summary, null, 1));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
