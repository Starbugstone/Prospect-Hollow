// Run against the Docker Vite server; see docs/future-eras.md#moon-input-check.
const assert = require('node:assert/strict');
const { chromium, moonPage, openFixture, pageErrors } = require('./helpers.cjs');
const fixture = moonPage(`
import {createApp,h} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {createTown} from '/src/data/town.js';
const town=createTown();town.era='twin-hollows';
Object.assign(town.buildings,{spaceElevator:1,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,1]))});
window.events={inspect:[],close:0,document:0,escape:0};
// Moon input reaches the document (sheets close on Escape, a press unlocks audio); the
// valley's own scene ignores it while the Moon covers it (unit tests: moon-view).
document.addEventListener('pointerdown',()=>window.events.document++);
document.addEventListener('keydown',(event)=>event.key==='Escape'&&window.events.escape++);
window.app=createApp({render(){return h('div',{style:'position:relative;width:100%;height:100%'},[h(Moon,{reducedMotion:true,town,onSelect(id){window.events.inspect.push(id)},onClose(){window.events.close++}})])}});
app.mount('#fixture');
window.getScene=()=>app._instance.subTree.children[0].component.setupState.scene;
`);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const [width, height] of [
      [1440, 900],
      [900, 360],
      [375, 740],
    ]) {
      for (const touch of [false, true]) {
        const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: touch,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        const errors = pageErrors(page);
        console.log(touch ? 'Starting touch fixture' : 'Starting mouse fixture');
        await openFixture(page, 'moon-input-test', fixture);
        await page
          .getByRole('button', { name: /Ribbon landing/ })
          .waitFor()
          .catch(async (error) => {
            throw new Error(
              error.message +
                '\n' +
                JSON.stringify({ errors, text: await page.locator('body').innerText() }),
            );
          });
        await page.waitForFunction(() => !!window.getScene?.());
        console.log('Scene ready');
        await page.evaluate(() => window.getScene().setMotion(false));
        const activate = async (locator) => (touch ? locator.tap() : locator.click());
        const lot = page.locator('[data-moon-lot="ribbonLanding"]');
        await activate(lot);
        await activate(lot);
        assert.deepEqual(await page.evaluate(() => window.events.inspect), [
          'ribbonLanding',
          'ribbonLanding',
        ]);
        await activate(page.getByRole('button', { name: 'Back to the valley' }));
        assert.equal(await page.evaluate(() => window.events.close), 1);
        // Letters from New Hollow live in the Story tab, never over the Moon map.
        assert.equal(await page.locator('.town-moon-letters').count(), 0);
        await lot.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => window.events.inspect.length), 3);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.events.escape), 1, 'Escape reaches sheets');
        // A drag that starts on a label orbits, as in the valley, and opens nothing.
        const label = await lot.boundingBox();
        const from = { x: label.x + label.width / 2, y: label.y + label.height / 2 };
        const before = await page.evaluate(() => window.getScene().camera.position.toArray());
        if (touch) {
          const cdp = await context.newCDPSession(page);
          for (const [type, touchPoints] of [
            ['touchStart', [from]],
            ['touchMove', [{ x: from.x + 50, y: from.y + 10 }]],
            ['touchMove', [{ x: from.x + 80, y: from.y + 14 }]],
            ['touchEnd', []],
          ])
            await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        } else {
          await page.mouse.move(from.x, from.y);
          await page.mouse.down();
          await page.mouse.move(from.x + 80, from.y + 14, { steps: 8 });
          await page.mouse.up();
        }
        await page.waitForFunction(() => !window.getScene().tapGesture.pressed);
        assert.notDeepEqual(
          await page.evaluate(() => window.getScene().camera.position.toArray()),
          before,
          'a drag from a label orbits the Moon',
        );
        assert.equal(await page.evaluate(() => window.events.inspect.length), 3);
        const dragStart = { x: Math.round(width * 0.5), y: Math.round(height * 0.78) };
        const dragEnd = { x: dragStart.x + 60, y: dragStart.y + 12 };
        const start = await page.evaluate(() => window.getScene().camera.position.toArray());
        if (touch) {
          const cdp = await context.newCDPSession(page);
          for (const [type, touchPoints] of [
            ['touchStart', [dragStart]],
            ['touchMove', [dragEnd]],
            ['touchEnd', []],
          ])
            await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
          await page.waitForFunction(() => window.getScene().controls._pointers.length === 0);
          for (const [type, touchPoints] of [
            ['touchStart', [dragStart]],
            ['touchMove', [dragEnd]],
            ['touchCancel', []],
          ])
            await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
          // A cancelled touch leaves neither the camera nor the shared tap gesture pressed.
          await page.waitForFunction(
            () =>
              window.getScene().controls._pointers.length === 0 &&
              !window.getScene().tapGesture.pressed,
          );
        } else {
          await page.mouse.move(dragStart.x, dragStart.y);
          await page.mouse.down();
          await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 8 });
          await page.mouse.up();
        }
        const after = await page.evaluate(() => ({
          camera: window.getScene().camera.position.toArray(),
          pointers: window.getScene().controls._pointers.length,
        }));
        assert.equal(after.pointers, 0, 'release must reach OrbitControls document cleanup');
        assert.notDeepEqual(after.camera, start, 'drag still orbits the Moon');
        await page.mouse.move(width - 10, height - 10);
        assert.deepEqual(
          await page.evaluate(() => window.getScene().camera.position.toArray()),
          after.camera,
          'hover after release must not continue orbiting',
        );
        await page.evaluate(() => window.getScene().resetView());
        await page.waitForFunction(
          () => !window.getScene().viewChanged && !window.getScene().cameraFrame,
        );
        const earth = await page.evaluate(() => {
          const scene = window.getScene(),
            box = scene.canvas.getBoundingClientRect();
          const p = scene.earth.position.clone().project(scene.camera);
          const center = {
            x: box.left + ((p.x + 1) * box.width) / 2,
            y: box.top + ((1 - p.y) * box.height) / 2,
          };
          for (const dx of [0, -20, 20, -40, 40])
            for (const dy of [0, -20, 20, -40, 40]) {
              const point = { x: center.x + dx, y: center.y + dy };
              if (
                document.elementFromPoint(point.x, point.y) === scene.canvas &&
                scene.hitsEarth({ clientX: point.x, clientY: point.y })
              )
                return point;
            }
          throw new Error('No exposed Earth tap target');
        });
        if (touch) await page.touchscreen.tap(earth.x, earth.y);
        else await page.mouse.click(earth.x, earth.y);
        assert.equal(
          await page.evaluate(() => window.events.close),
          2,
          'Earth tap returns to valley',
        );
        assert.ok(
          (await page.evaluate(() => window.events.document)) > 0,
          'Moon presses reach the document',
        );
        assert.deepEqual(errors, []);
        console.log(
          `${width}x${height} ${touch ? 'Touch' : 'Mouse'}: first/repeated lot, Back, no letters overlay, keyboard, Escape, label drag, orbit/release, Earth and document events passed.`,
        );
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
