// Run with the Docker browser setup in docs/future-eras.md#moon-input-check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, SOFTWARE_WEBGL, moonPage, openFixture, pageErrors } = require('./helpers.cjs');

const fixture = moonPage(`
import {createApp,h,ref,nextTick} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {createTown} from '/src/data/town.js';
const town=ref(createTown());town.value.era='twin-hollows';
Object.assign(town.value.buildings,{spaceElevator:1,ribbonLanding:1,settlerDomes:1,willowkinDome:0});
window.app=createApp({render(){return h(Moon,{town:town.value,reducedMotion:true})}});
app.mount('#fixture');
window.getScene=()=>app._instance.subTree.component.setupState.scene;
window.residents=()=>getScene().settlers.filter(s=>s.species==='willowkinResident');
window.changeDome=async(level,project)=>{
  town.value={...town.value,buildings:{...town.value.buildings,willowkinDome:level},projects:project?{willowkinDome:project}:{}};
  await nextTick();
};
`);

(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  try {
    fs.mkdirSync('output/playwright/moon-willowkin', { recursive: true });
    fs.writeFileSync('output/moon-willowkin-review.html', fixture);
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 375, height: 740 },
    ]) {
      const page = await browser.newPage({ viewport });
      const errors = pageErrors(page);
      await openFixture(page, 'moon-willowkin-test', fixture);
      await page.waitForFunction(() => !!window.getScene?.());
      assert.equal(await page.evaluate(() => window.residents().length), 0);
      await page.evaluate(() => window.changeDome(0, { stage: 1, wins: 2, required: 2 }));
      assert.equal(
        await page.evaluate(() => window.residents().length),
        0,
        'ready is not finished',
      );
      for (const level of [1, 2, 3]) {
        await page.evaluate((level) => window.changeDome(level), level);
        await page.waitForFunction((count) => window.residents().length === count, level + 1);
        assert.equal(await page.evaluate(() => window.getScene().contextUnavailable), undefined);
        const motion = await page.evaluate(() => {
          const scene = window.getScene();
          scene.setMotion(false);
          return window.residents().map((resident) => {
            const segment = resident.plan.segments.find(({ route }) => route);
            const time = segment.start + segment.duration / 2 - resident.plan.offset;
            scene.move(time);
            const before = resident.root.position.clone();
            scene.move(time + 0.1);
            const result = {
              home: resident.plan.home,
              visible: resident.root.visible,
              distance: before.distanceTo(resident.root.position),
              helmet: !!resident.root.getObjectByName('Space helmet'),
              crown: !!resident.root.getObjectByName('Willowkin resident willow crown'),
              finite: resident.root.position.toArray().every(Number.isFinite),
            };
            return result;
          });
        });
        for (const resident of motion) {
          assert.equal(resident.home, 'willowkinDome');
          assert.ok(resident.visible && resident.helmet && resident.crown && resident.finite);
          assert.ok(resident.distance > 0.09 && resident.distance < 0.12, 'walks continuously');
        }
      }
      await page.evaluate(() => {
        const scene = window.getScene(),
          resident = window.residents()[0];
        const segment = resident.plan.segments.find(({ route }) => route);
        scene.move(segment.start + 14 - resident.plan.offset);
        const target = resident.root.position.clone();
        target.y += 1;
        scene.controls.target.copy(target);
        scene.camera.position.copy(target).add({ x: 4, y: 3, z: 6 });
        scene.controls.update();
        scene.render();
      });
      await page.screenshot({ path: `output/playwright/moon-willowkin/${viewport.width}.png` });
      await page.evaluate(() => window.changeDome(0));
      await page.waitForFunction(() => window.residents().length === 0);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${viewport.width}×${viewport.height}: completion, all upgrades, movement, model and removal`,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
