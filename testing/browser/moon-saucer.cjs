// Deterministic screenshot capture with the Docker browser setup of the Moon input
// check (docs/future-eras.md#moon-input-check).
// PH_CAPTURE_VIDEO=1 also writes frames for ffmpeg (10 fps gives an accelerated visit).
const fs = require('node:fs');
const { chromium, SOFTWARE_WEBGL, fixturePage, openFixture, pageErrors } = require('./helpers.cjs');
const out = process.env.PH_SCREENSHOT_DIR || '/tmp/moon-shots/saucer';
fs.mkdirSync(out, { recursive: true });
const fixture = fixturePage({
  style: 'body{margin:0;background:#10162b}canvas{display:block;width:100vw;height:100vh}',
  body: '<canvas></canvas>',
  script: `
import {MoonScene} from '/src/game/town/moon/MoonScene.js';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
window.town={era:'twin-hollows',buildings:{airport:3,spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,3]))},buildingEras:{airport:'moonward'}};
window.moon=new MoonScene(document.querySelector('canvas'));
moon.update(town); moon.renderer.setAnimationLoop(null);moon.render();window.ready=true;
`,
});
(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = pageErrors(page);
  await openFixture(page, 'moon-saucer-capture', fixture);
  await page.waitForFunction(() => window.ready);
  const shot = async (name, time, unbuilt = false, close = false) => {
    const data = await page.evaluate(
      ({ time, unbuilt, close }) => {
        const { town, moon } = window;
        town.buildings.saucerPad = unbuilt ? 0 : 3;
        moon.update(town);
        moon.move(time);
        if (close) {
          moon.camera.position.set(31, 19, -6);
          moon.controls.target.set(15, 2, -30);
          moon.controls.update();
        } else moon.resetView();
        moon.render();
        return {
          phase: moon.saucer.craft?.root.userData.flightPhase,
          position: moon.saucer.craft?.root.position.toArray(),
          visible: moon.saucer.craft?.root.visible,
          draws: moon.renderer.info.render.calls,
        };
      },
      { time, unbuilt, close },
    );
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
    console.log(name, data);
  };
  await shot('before-unbuilt', 34, true);
  await shot('approach', 14);
  await shot('touchdown', 34);
  await shot('takeoff', 75);
  await shot('touchdown-detail', 34, false, true);
  await shot('settle-dust-detail', 33, false, true);
  if (process.env.PH_CAPTURE_VIDEO) {
    fs.mkdirSync(`${out}/frames`, { recursive: true });
    await page.setViewportSize({ width: 960, height: 700 });
    const times = [
      ...Array.from({ length: 24 }, (_, n) => 16 + n * 0.8),
      34,
      34,
      34,
      34,
      ...Array.from({ length: 20 }, (_, n) => 70 + n * 0.8),
    ];
    for (let n = 0; n < times.length; n++) {
      await page.evaluate((time) => {
        const { moon } = window;
        moon.move(time);
        moon.render();
      }, times[n]);
      await page.screenshot({
        path: `${out}/frames/${String(n).padStart(3, '0')}.png`,
        timeout: 60000,
      });
    }
  }
  console.log('errors', errors);
  fs.writeFileSync(`${out}/browser-errors.json`, JSON.stringify(errors));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
