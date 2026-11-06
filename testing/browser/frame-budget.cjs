// Frame budget check: the game's own JavaScript per frame on the busiest puzzle boards and a fully
// developed town, with a phone viewport and a 4x CPU slowdown standing in for a mid-range phone. Phones
// can't be driven from here, so this guards against our code getting slower; it doesn't measure a
// phone. SwiftShader draws on the CPU, so frame intervals mostly measure the software renderer: they're
// printed for comparison and the ceilings apply to script time. Baselines and reasoning are in
// docs/town-rendering-performance-log.md. Run it with nothing else busy. Needs `npm run demo:eras`
// for the town; the Docker commands are in docs/development-workflow.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  chromium,
  SOFTWARE_WEBGL,
  playedProfile,
  preparePage,
  testOrigin,
} = require('./helpers.cjs');

const origin = testOrigin();
const VIEWPORT = { width: 375, height: 690 };
const RATE = Number(process.env.PH_CPU_SLOWDOWN || 4);
const SECONDS = Number(process.env.PH_FRAME_SECONDS || 15);
const MINE_MS = Number(process.env.PH_MINE_SCRIPT_MS || 12);
const TOWN_MS = Number(process.env.PH_TOWN_SCRIPT_MS || 35);
const output = process.env.PH_FRAME_OUTPUT;
// Another town save to look round, served by the Vite server (a commission's residents, say).
const TOWN_SAVE = process.env.PH_FRAME_TOWN_SAVE || '/output/era-demo/twin-hollows-open.json';
const store = `window.stores?.()?.get('game')`;

async function measure(page, work) {
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const metrics = async () =>
    Object.fromEntries(
      (await client.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
    );
  const before = await metrics();
  const counting = page.evaluate(
    (seconds) =>
      new Promise((resolve) => {
        const intervals = [];
        let last = performance.now();
        const end = last + seconds * 1000;
        const tick = (now) => {
          intervals.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve(intervals);
        };
        requestAnimationFrame(tick);
      }),
    SECONDS,
  );
  const stop = await work();
  const intervals = await counting;
  await stop?.();
  const after = await metrics();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const sorted = [...intervals].sort((a, b) => a - b);
  return {
    frames: intervals.length,
    scriptMsPerFrame: +(
      ((after.ScriptDuration - before.ScriptDuration) * 1000) /
      intervals.length
    ).toFixed(1),
    frameP50: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
    frameP95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
  };
}

async function mine(browser, level) {
  const context = await browser.newContext({ viewport: VIEWPORT, hasTouch: true, locale: 'en-US' });
  await context.addInitScript(preparePage, { profile: playedProfile(level) });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  await page.goto(`${origin}/play`);
  await page.waitForFunction(`!!${store}`);
  assert.ok(
    await page.evaluate(`${store}.startLevel(${level}, 'normal')`),
    `level ${level} starts`,
  );
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
  const result = await measure(page, async () => {
    // A hurried player: the next hinted move as soon as the board accepts one.
    await page.evaluate(() => {
      const game = window.stores().get('game');
      window.__playing = setInterval(() => {
        if (game.animationInProgress || game.levelCleared) return;
        game.computeHintMove();
        const move = game.hintMove;
        if (move?.swap)
          game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
            activateInPlace: !!move.activateInPlace,
          });
      }, 120);
    });
    return () => page.evaluate(() => clearInterval(window.__playing));
  });
  const moves = await page.evaluate(`${store}.moves`);
  assert.ok(moves > 0, `level ${level} played moves`);
  const log = await page.evaluate(`window.prospectDebug.runLog()`);
  await context.close();
  return { ...result, moves, log };
}

async function town(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, hasTouch: true, locale: 'en-US' });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  await page.addInitScript(() =>
    localStorage.setItem('crystal-cascade-town-menu-introduced', 'true'),
  );
  await page.goto(`${origin}/play`);
  await page.waitForFunction(
    () => document.querySelector('.town-scene')?.__vueParentComponent.setupState.scene,
  );
  await page.evaluate(async (save) => {
    const { createSaveFile } = await import('/src/services/saveTransfer.js');
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const campaign = pinia._s.get('campaign');
    const profile = await (await fetch(save)).json();
    campaign.importSave(createSaveFile({ ...campaign.profile(), ...profile }));
  }, TOWN_SAVE);
  await page.waitForTimeout(8000);
  const result = await measure(page, async () => {
    const box = await page.locator('.town-scene canvas').first().boundingBox();
    // A slow orbit, so the camera keeps moving as it does while a player looks round.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    let step = 0;
    const orbit = setInterval(() => {
      step++;
      void page.mouse
        .move(box.x + box.width / 2 + Math.sin(step / 8) * 90, box.y + box.height / 2)
        .catch(() => {});
    }, 200);
    return async () => {
      clearInterval(orbit);
      await page.mouse.up();
    };
  });
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  const failures = [];
  const report = [];
  try {
    const levels = (process.env.PH_FRAME_LEVELS ?? '13,376,397').split(',').filter(Boolean);
    for (const level of levels.map(Number)) {
      const result = await mine(browser, level);
      const { log, ...numbers } = result;
      report.push({ scene: `level ${level}`, ...numbers });
      console.log(JSON.stringify(report.at(-1)));
      if (output && log)
        fs.writeFileSync(output.replace('.json', `-run-${level}.json`), JSON.stringify(log));
      if (result.scriptMsPerFrame > MINE_MS)
        failures.push(
          `level ${level}: ${result.scriptMsPerFrame} ms of script per frame, over ${MINE_MS}`,
        );
    }
    if (process.env.PH_FRAME_TOWN !== 'off') {
      const result = await town(browser);
      report.push({ scene: 'twin-hollows town', ...result });
      console.log(JSON.stringify(report.at(-1)));
      if (result.scriptMsPerFrame > TOWN_MS)
        failures.push(`town: ${result.scriptMsPerFrame} ms of script per frame, over ${TOWN_MS}`);
    }
  } finally {
    await browser.close();
  }
  if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
  assert.deepEqual(failures, []);
  console.log('Frame budgets passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
