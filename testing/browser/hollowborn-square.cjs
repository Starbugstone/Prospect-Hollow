// Hollowborn Square on the Moon map: each design at levels 1, 3 and 5, in WebGL and on the
// SVG fallback, at desktop and phone sizes. Its name shows and a tap on it (label or 3D
// parcel) selects the site without moving the camera. Run against Docker Vite, with the
// same Playwright setup as moon-input.cjs; screenshots go to PH_SCREENSHOT_DIR when set.
const assert = require('node:assert/strict');
const { chromium, SOFTWARE_WEBGL, moonPage, openFixture, pageErrors } = require('./helpers.cjs');
const SITE = 'hollowborn-square';
const fixture = moonPage(`
import {createApp,h,reactive} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {createTown} from '/src/data/town.js';
const town=reactive(createTown());window.town=town;town.era='hollow-rising';
Object.assign(town.buildings,{spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,3]))});
window.selected=[];
window.app=createApp({render:()=>h(Moon,{active:false,town,indicators:{},reducedMotion:true,onSelect:id=>selected.push(id)})});app.mount('#fixture');
window.getMoon=()=>app._instance.subTree.component.setupState;
window.build=(choice,level)=>{
  town.personalisation.areas['${SITE}']=[choice];
  town.personalisation.areaLevels['${SITE}']=level;
  town.personalisation.construction={};
};
`);
const DESIGNS = ['silverbough-grove', 'first-bell', 'moonstone-carousel'];
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => {
          const s = window.getMoon().scene;
          s.viewChanged = true;
          s.render();
          requestAnimationFrame(() => done());
        }),
      ),
  );
(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ hasTouch: true });
      page.setDefaultTimeout(120000);
      const errors = pageErrors(page, { echo: true });
      await openFixture(page, 'hollowborn-square-test', fixture);
      await page.waitForFunction(() => !!window.getMoon?.().scene);
      await page.evaluate((fallback) => {
        const s = window.getMoon().scene;
        s.setMotion(false);
        s.renderer.setAnimationLoop(null);
        if (fallback) window.getMoon().unavailable = true;
      }, fallback);
      for (const [width, height] of [
        [1440, 900],
        [375, 740],
      ]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => window.getMoon().scene.resize());
        await page.waitForFunction(
          ([w, h]) => {
            const { viewport } = window.getMoon();
            return viewport.width === w && viewport.height === h;
          },
          [width, height],
        );
        // The square stands on the outer ring's front, below the first view: pan to it, as a
        // player drags the map.
        await page.evaluate(() => {
          const s = window.getMoon().scene;
          s.controls.target.set(-10.7, 0, 40);
          s.camera.position.set(-10.7, 20, 80);
          s.camera.lookAt(s.controls.target);
          s.controls.update?.();
        });
        for (const choice of DESIGNS)
          for (const level of [1, 3, 5]) {
            await page.evaluate(([c, l]) => window.build(c, l), [choice, level]);
            await settle(page);
            await settle(page);
            const label = page.locator(`[data-moon-lot="${SITE}"]`);
            const camera = () =>
              page.evaluate(() => window.getMoon().scene.camera.position.toArray());
            const before = await camera();
            if (await label.isVisible()) {
              await label.tap({ timeout: 10000 });
              assert.equal(await page.evaluate(() => window.selected.at(-1)), SITE);
              assert.deepEqual(await camera(), before, 'A tap never moves the camera');
            } else
              console.log(`${fallback ? 'svg' : 'webgl'} ${width} ${choice} ${level}: name hidden`);
            if (!fallback) {
              // A tap on the parcel in 3D selects the site too.
              const point = await page.evaluate((id) => {
                const s = window.getMoon().scene;
                const site = s.monuments.children.find((g) => g.userData.monumentSite === id);
                const v = site.getWorldPosition(new s.camera.position.constructor());
                v.y = 1;
                v.project(s.camera);
                const r = s.canvas.getBoundingClientRect();
                return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
              }, SITE);
              await page.evaluate(() => (window.selected.length = 0));
              await page.touchscreen.tap(...point);
              await page.waitForTimeout(80);
              assert.equal(
                await page.evaluate(() => window.selected.at(-1)),
                SITE,
                `${choice} ${level}: a 3D tap selects the square`,
              );
              assert.deepEqual(await camera(), before, 'A 3D tap never moves the camera');
            }
            await page.evaluate(() => {
              window.getMoon().selectedLot = null;
              document.activeElement?.blur();
            });
            await settle(page);
            if (process.env.PH_SCREENSHOT_DIR)
              await page.screenshot({
                animations: 'disabled',
                path: `${process.env.PH_SCREENSHOT_DIR}/${fallback ? 'svg' : 'webgl'}-${width}-${choice}-${level}.png`,
              });
            // A close view of the square on the 3D map, for looking at the design itself.
            if (!fallback && process.env.PH_SCREENSHOT_DIR) {
              await page.evaluate((id) => {
                const s = window.getMoon().scene;
                window.saved = [s.camera.position.clone(), s.controls.target.clone()];
                const site = s.monuments.children.find((g) => g.userData.monumentSite === id);
                const at = site.getWorldPosition(new s.camera.position.constructor());
                s.controls.target.set(at.x, 3, at.z);
                s.camera.position.set(at.x + 8, 11, at.z + 20);
                s.camera.lookAt(s.controls.target);
                s.viewChanged = true;
                s.render();
              }, SITE);
              await page.screenshot({
                animations: 'disabled',
                path: `${process.env.PH_SCREENSHOT_DIR}/close-${width}-${choice}-${level}.png`,
              });
              await page.evaluate(() => {
                const s = window.getMoon().scene;
                s.camera.position.copy(window.saved[0]);
                s.controls.target.copy(window.saved[1]);
                s.camera.lookAt(s.controls.target);
                s.viewChanged = true;
                s.render();
              });
            }
          }
      }
      assert.deepEqual(errors, [], 'No page errors');
      await page.close();
    }
    console.log('Hollowborn Square: three designs at levels 1, 3 and 5 in WebGL and SVG');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
