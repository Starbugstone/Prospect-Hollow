const { mkdir, writeFile } = require('node:fs/promises');
const {
  chromium,
  SOFTWARE_WEBGL,
  preparePage,
  playedProfile,
  testOrigin,
} = require('./helpers.cjs');
const keys = (process.env.PH_CRYSTAL_KEYS || 'trace-twins-first-impression').split(',');
const folder = 'output/new-mechanics';
(async () => {
  await mkdir(folder, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  const report = [];
  try {
    for (const key of keys)
      for (const [width, height] of [
        [375, 740],
        [1440, 900],
      ]) {
        const context = await browser.newContext({ viewport: { width, height }, locale: 'en-US' });
        await context.addInitScript(preparePage, { profile: playedProfile(1) });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${testOrigin()}/play`, { timeout: 180000 });
        await page.waitForFunction(() => window.stores?.()?.get('game'), null, { timeout: 180000 });
        await page.evaluate(
          (key) => window.stores().get('game').startLevel(key, 'prototype', { seed: 871 }),
          key,
        );
        await page.waitForFunction(() => window.stores().get('game').renderer?.animator);
        for (
          let i = 0;
          i < 10 && (await page.evaluate(() => window.stores().get('game').inputPaused));
          i++
        ) {
          await page.keyboard.press('Escape');
          const play = page.locator('button.mine-play-button', { hasText: /^Play$/ });
          if (await play.isVisible().catch(() => false)) await play.click();
          await page.waitForTimeout(250);
        }
        await page.evaluate(() => {
          const g = window.stores().get('game'),
            a = g.renderer.animator;
          window.__crystalEvents = [];
          const original = a.playSteps.bind(a);
          a.playSteps = async (steps) => {
            for (const step of steps) {
              const event = step.traceCopies?.length
                ? 'trace'
                : step.crystalChanges?.length
                  ? 'crystal'
                  : null;
              if (event) window.__crystalEvents.push({ event, step });
            }
            return original(steps);
          };
          const copy = a.playTraceCopies.bind(a);
          a.playTraceCopies = async (copies) => {
            const effect = copy(copies);
            await new Promise((resolve) => setTimeout(resolve, 60));
            a.scene.tweens.pauseAll();
            window.__crystalMoment = true;
            await new Promise((resolve) => {
              window.__releaseCrystal = resolve;
            });
            a.scene.tweens.resumeAll();
            await effect;
          };
        });
        const shot = async (label) =>
          page.screenshot({
            path: `${folder}/${key}-${width}x${height}-${label}.png`,
            timeout: 60000,
          });
        await shot('start');
        let captured = false;
        for (let turn = 0; turn < 150; turn++) {
          const state = await page.evaluate(() => {
            const g = window.stores().get('game');
            if (g.levelCleared) return 'done';
            g.computeHintMove();
            if (!g.hintMove) return 'no-hint';
            const { swap, activateInPlace } = g.hintMove;
            window.__moveDone = false;
            g.resolveSwap(swap.aIndex, swap.bIndex, { activateInPlace: !!activateInPlace }).then(
              () => {
                window.__moveDone = true;
              },
            );
            return 'moving';
          });
          if (state === 'done') break;
          if (state === 'no-hint') {
            await page.evaluate(() => window.stores().get('game').ensurePlayableBoard());
            continue;
          }
          await page.waitForFunction(() => window.__crystalMoment || window.__moveDone, null, {
            timeout: 60000,
          });
          if (await page.evaluate(() => !!window.__crystalMoment)) {
            if (!captured) {
              await shot('acts');
              captured = true;
            }
            await page.evaluate(() => {
              window.__crystalMoment = false;
              window.__releaseCrystal();
            });
          }
          await page.waitForFunction(() => window.__moveDone, null, { timeout: 60000 });
          if (!captured && (await page.evaluate(() => window.__crystalEvents.length > 0))) {
            await shot('acts');
            captured = true;
          }
          if (turn === 1) await shot('mid');
        }
        await shot('complete');
        report.push({
          key,
          width,
          height,
          errors,
          events: await page.evaluate(() => window.__crystalEvents),
          complete: await page.evaluate(() => window.stores().get('game').levelCleared),
        });
        await context.close();
      }
  } finally {
    await browser.close();
  }
  await writeFile(`${folder}/captures.json`, JSON.stringify(report, null, 2));
  if (report.some((row) => row.errors.length || !row.complete))
    throw new Error('Capture journey failed; see captures.json');
  console.log(
    JSON.stringify(
      report.map(({ key, width, height, complete, errors }) => ({
        key,
        width,
        height,
        complete,
        errors,
      })),
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
