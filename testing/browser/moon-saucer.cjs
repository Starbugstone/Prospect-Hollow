// Deterministic screenshot capture; run with the media-tooling Playwright environment.
// PH_CAPTURE_VIDEO=1 also writes frames for ffmpeg (10 fps gives an accelerated visit).
const { chromium } = require(process.env.CLAUDE_MEDIA_TOOLS + '/node_modules/playwright');
const fs = require('node:fs');
const out = process.env.PH_SCREENSHOT_DIR || '/tmp/moon-shots/saucer';
fs.mkdirSync(out, { recursive: true });
const base = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:5194';
const fixture = `<!doctype html><html><head><style>body{margin:0;background:#10162b}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas></canvas><script type="module">
import {MoonScene} from '/src/game/town/moon/MoonScene.js';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
window.town={era:'twin-hollows',buildings:{airport:3,spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,3]))},buildingEras:{airport:'moonward'}};
window.moon=new MoonScene(document.querySelector('canvas'));
moon.update(town); moon.renderer.setAnimationLoop(null);moon.render();window.ready=true;
</script></body></html>`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/moon-saucer-capture', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixture }),
  );
  await page.goto(base + '/moon-saucer-capture');
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
