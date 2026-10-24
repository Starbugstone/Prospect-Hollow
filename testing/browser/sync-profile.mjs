// Browser-only diagnostic. Generate fixtures in Docker, then follow media-tooling
// for Playwright. Args: label, launch|return|idle, repetition, offline receipt count.
// LIVE=1 retains rendering in idle samples; default pauses it to isolate sync.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const [label = 'before', phase = 'idle', run = '1', receipts = '1500'] = process.argv.slice(2);
const output = process.env.OUT ?? '/tmp/moon-shots/sync';
fs.mkdirSync(output, { recursive: true });
const out = `${output}/${label}-${phase}-${run}`;
const profile = JSON.parse(fs.readFileSync(`${process.cwd()}/output/era-demo/motor-age-open.json`));
profile.integrity = {
  version: 1,
  epoch: 'test-epoch',
  baseSequence: 0,
  checkpoint: 'test-checkpoint',
  actions: Array.from({ length: Number(receipts) }, (_, i) => ({
    sequence: i + 1,
    id: `offline-${i}`,
    kind: 'run-start',
    data: {
      runId: i + 1,
      at: 1760000000000 + i,
      mode: 'normal',
      levelId: 1,
      board: Array.from({ length: 64 }, (_, j) => ({ type: 'normal', color: j % 5 })),
    },
  })),
};
const owner = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let remote = {
  townId: id,
  name: 'Sync profile town',
  revision: 1,
  updatedAt: 100,
  isPublic: false,
  publicId: 'sync-test',
  profile,
};
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let workers = 0;
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('worker', () => workers++);
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(
  ({ profile, owner, id, live }) => {
    window.__live = live;
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem(
      'prospect-account-v2',
      JSON.stringify({
        account: { id: owner, email: 'sync@example.test' },
        generation: 'sync-test',
      }),
    );
    localStorage.setItem(
      `prospect-town-v2:${owner}:${id}`,
      JSON.stringify({
        ...profile,
        _cloud: {
          version: 2,
          active: {
            id,
            owner,
            name: 'Sync profile town',
            baseRevision: 1,
            sequence: 0,
            dirty: false,
            pending: null,
            conflict: null,
          },
        },
      }),
    );
    sessionStorage.setItem('prospect-selected-town-v2', `prospect-town-v2:${owner}:${id}`);
    sessionStorage.setItem('seeded', '1');
    window.__long = [];
    new PerformanceObserver((l) =>
      l
        .getEntries()
        .forEach((e) => window.__long.push({ start: e.startTime, duration: e.duration })),
    ).observe({ type: 'longtask', buffered: true });
  },
  { profile, owner, id, live: process.env.LIVE === '1' },
);
let gets = 0,
  puts = 0;
await page.context().route('**/api/v1/**', async (route) => {
  const req = route.request(),
    path = new URL(req.url()).pathname.split('/api/v1/')[1];
  if (path === 'account')
    return route.fulfill({
      json: {
        account: { id: owner, email: 'sync@example.test' },
        csrf: 'test',
        towns: [{ ...remote, profile: undefined }],
      },
    });
  if (path?.includes('/visitors'))
    return route.fulfill({
      json: { present: [], uniqueVisitors: 0, townsVisited: 0, helmetFinds: [] },
    });
  if (path === `towns/${id}`) {
    if (req.method() === 'PUT') {
      puts++;
      const body = req.postDataJSON();
      remote = {
        ...remote,
        profile: body.profile,
        revision: remote.revision + 1,
        integrity: {
          version: 1,
          epoch: body.profile.integrity.epoch,
          ackSequence: body.profile.integrity.baseSequence,
          checkpoint: 'test-checkpoint',
        },
      };
    } else gets++;
    return route.fulfill({ json: remote });
  }
  return route.fulfill({ json: {} });
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
async function start() {
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8',
    transferMode: 'ReturnAsStream',
  });
  await cdp.send('Profiler.start');
}
if (phase === 'launch') await start();
await page.goto(process.env.URL ?? 'http://127.0.0.1:5191/play');
console.log('navigated');
await page.waitForSelector('.town-map-frame', { timeout: 90000 });
console.log('town ready');
if (phase !== 'launch') {
  await page.waitForTimeout(12000);
  await page.evaluate(async () => {
    const { townStorage } = await import('/src/services/townStorage.js');
    const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    window.__campaign = p._s.get('campaign');
    window.__game = p._s.get('game');
    if (!window.__live)
      document
        .querySelector('.town-scene')
        ?.__vueParentComponent.setupState.scene?.renderer.setAnimationLoop(null);
    window.__cloud = await import('/src/services/cloudProfile.js');
    window.__cloud.cloud.csrf = 'test';
    // Dirty bookkeeping only: model an outstanding offline upload without extra gameplay.
    const meta = townStorage.activeMeta();
    townStorage.mutate(meta.id, meta.owner, (r) => {
      r.meta.dirty = true;
      r.meta.sequence++;
    });
  });
  if (phase === 'return') {
    await page.evaluate(() => window.__game.startLevel(window.__campaign.nextLevel, 'normal'));
    await page.waitForTimeout(3500);
    const play = page.getByRole('button', { name: 'Play', exact: true });
    if (await play.count()) await play.first().click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const g = window.__game;
      g.remainingLayers = 0;
      g.oreOrders = g.oreOrders.map((o) => ({ ...o, progress: o.target }));
      g.board = g.board.map((gem) => (gem?.type === 'relic' ? { ...gem, type: 'normal' } : gem));
      g.completeLevel();
    });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 4 && (await page.locator('.showing-chest').count()); i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }
  }
  await start();
  await page.evaluate(() => {
    window.__long = [];
    performance.mark('probe-start');
  });
  if (phase === 'return') await page.locator('.arcade-victory .result-next').last().click();
  else await page.evaluate(() => window.__cloud.syncNow());
}
await page.waitForTimeout(phase === 'launch' ? 10000 : 7000);
const { profile: cpu } = await cdp.send('Profiler.stop');
fs.writeFileSync(`${out}.cpuprofile`, JSON.stringify(cpu));
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.end');
const { stream } = await done;
let trace = '';
for (;;) {
  const c = await cdp.send('IO.read', { handle: stream });
  trace += c.data;
  if (c.eof) break;
}
fs.writeFileSync(`${out}.trace.json`, trace);
const observed = await page.evaluate(() => window.__long);
const events = JSON.parse(trace).traceEvents,
  main = events.find((e) => e.name === 'thread_name' && e.args.name === 'CrRendererMain');
const tasks = events.filter(
  (e) =>
    e.pid === main.pid &&
    e.tid === main.tid &&
    e.ph === 'X' &&
    e.name === 'RunTask' &&
    e.dur > 50000 &&
    e.ts >= cpu.startTime &&
    e.ts + e.dur <= cpu.endTime,
);
const nodes = new Map(cpu.nodes.map((n) => [n.id, n])),
  parents = new Map();
cpu.nodes.forEach((n) => (n.children ?? []).forEach((c) => parents.set(c, n.id)));
let ts = cpu.startTime;
const samples = cpu.samples.map((id, i) => {
  ts += cpu.timeDeltas[i];
  const stack = [];
  for (let c = id; c != null; c = parents.get(c)) {
    const f = nodes.get(c).callFrame;
    if (f.url.includes('/src/'))
      stack.push(`${f.functionName} ${f.url.split('/src/')[1].split('?')[0]}`);
  }
  return { ts, dt: (cpu.timeDeltas[i + 1] ?? 0) / 1000, stack };
});
const syncTasks = tasks
  .map((t) => {
    const incl = new Map();
    let syncMs = 0;
    for (const s of samples) {
      if (s.ts < t.ts || s.ts > t.ts + t.dur) continue;
      for (const k of new Set(s.stack)) incl.set(k, (incl.get(k) ?? 0) + s.dt);
      if (s.stack.some((k) => /services\/(syncService|cloudProfile|townStorage)/.test(k)))
        syncMs += s.dt;
    }
    return {
      start: t.ts,
      ms: t.dur / 1000,
      syncMs,
      top: [...incl].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  })
  .filter((t) => t.syncMs > 5);
const result = {
  label,
  phase,
  run,
  live: process.env.LIVE === '1',
  load: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
  bytes: JSON.stringify(profile).length,
  gets,
  puts,
  workers,
  state: await page.evaluate(async () => {
    const { cloud } = await import('/src/services/cloudProfile.js');
    const { townStorage } = await import('/src/services/townStorage.js');
    return {
      status: cloud.status,
      error: cloud.error,
      busy: cloud.busy,
      meta: townStorage.activeMeta(),
    };
  }),
  longest: Math.max(0, ...syncTasks.map((t) => t.ms)),
  tbt: syncTasks.reduce((a, t) => a + Math.max(0, t.ms - 50), 0),
  syncTasks,
  observed,
};
fs.writeFileSync(`${out}.summary.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (process.env.SHOTS !== '0') {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => {
    const scene = document.querySelector('.town-scene')?.__vueParentComponent.setupState.scene;
    scene?.renderer.setAnimationLoop(null);
    scene?.render();
  });
  await page
    .screenshot({ path: `${out}.png`, timeout: 15000, animations: 'disabled' })
    .catch((e) => console.log('screenshot', e.message));
}
await browser.close();
