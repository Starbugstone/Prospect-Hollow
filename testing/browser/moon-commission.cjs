// Screenshots every commission outcome and stage, with the Docker browser setup of the Moon
// input check (docs/future-eras.md#moon-input-check). It fails on a page error or when a
// resident never reaches the finished place's door.
const fs = require('node:fs');
const { chromium, SOFTWARE_WEBGL, fixturePage, openFixture, pageErrors } = require('./helpers.cjs');
const out = process.env.PH_SCREENSHOT_DIR || '/tmp/moon-shots/commission';
fs.mkdirSync(out, { recursive: true });
const fixture = fixturePage({
  style: 'body{margin:0;background:#10162b}canvas{display:block;width:100vw;height:100vh}',
  body: '<canvas></canvas>',
  script: `
import {MoonScene} from '/src/game/town/moon/MoonScene.js';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {AREA_BY_ID} from '/src/data/townLandmarks.js';
window.area=AREA_BY_ID['earthlight-conservatory'];
window.town={era:'twin-hollows',personalisation:{areas:{},areaLevels:{},construction:{}},buildings:{airport:3,spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map((id)=>[id,3]))},projects:{},coins:0};
window.moon=new MoonScene(document.querySelector('canvas'));
moon.update(town); moon.renderer.setAnimationLoop(null);moon.render();window.ready=true;
`,
});
(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = pageErrors(page);
  await openFixture(page, 'moon-commission-capture', fixture);
  await page.waitForFunction(() => window.ready);
  const show = (choice, stage, view, time = 40) =>
    page.evaluate(
      ({ choice, stage, view, time }) => {
        const { moon, town, area } = window;
        const [x, z] = area.positions[0];
        town.personalisation = {
          ...town.personalisation,
          areas: choice ? { [area.id]: [choice] } : {},
          areaLevels: choice ? { [area.id]: stage } : {},
        };
        moon.update({ ...town });
        moon.move(time);
        if (view === 'close') {
          moon.camera.position.set(x + 8, 9, z + 15);
          moon.controls.target.set(x, 1.8, z);
          moon.controls.update();
        } else moon.resetView();
        moon.render();
        const door = moon.settlers?.flatMap(({ plan }) =>
          (plan.segments ?? []).filter(({ inside }) => inside === area.id),
        );
        return { visits: door?.length ?? 0, draws: moon.renderer.info.render.calls };
      },
      { choice, stage, view, time },
    );
  const shot = async (name, ...args) => {
    const data = await show(...args);
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 });
    console.log(name, data);
    return data;
  };
  await shot('open-site', null, 0, 'close');
  const choices = await page.evaluate(() => window.area.choices);
  for (const choice of choices) {
    for (const stage of [1, 3, 5]) await shot(`${choice}-${stage}`, choice, stage, 'close');
    const { visits } = await shot(`${choice}-overview`, choice, 5, 'wide');
    if (!visits) throw new Error(`${choice} has no resident visits`);
  }
  console.log('errors', errors);
  if (errors.length) throw new Error(errors.join('\n'));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
