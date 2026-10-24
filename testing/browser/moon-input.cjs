// Run against the Docker Vite server; see docs/future-eras.md#moon-input-check.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';
const fixture = `<!doctype html><html><head><link rel="stylesheet" href="/src/styles/base.css"><link rel="stylesheet" href="/src/styles/town.css"><style>body{margin:0}#fixture{position:relative;width:100vw;height:100vh}</style></head><body><div id="fixture"></div><script type="module">
import {createApp,h} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {createTown} from '/src/data/town.js';
const town=createTown();town.era='twin-hollows';
Object.assign(town.buildings,{spaceElevator:1,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,1]))});
window.events={inspect:[],close:0,valley:0};
window.app=createApp({render(){return h('div',{style:'position:relative;width:100%;height:100%',onPointerdown(){window.events.valley++}},[h(Moon,{reducedMotion:true,town,onSelect(id){window.events.inspect.push(id)},onClose(){window.events.close++}})])}});
app.mount('#fixture');
window.getScene=()=>app._instance.subTree.children[0].component.setupState.scene;
</script></body></html>`;
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
        const errors = [];
        console.log(touch ? 'Starting touch fixture' : 'Starting mouse fixture');
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        await page.route('**/moon-input-test', (route) =>
          route.fulfill({ contentType: 'text/html', body: fixture }),
        );
        await page.goto(base + '/moon-input-test');
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
        const letters = page.locator('.town-moon-letters summary');
        await activate(letters);
        // Opening the bottom-anchored panel moves its summary. Let layout settle
        // before the second pointer activation, particularly under software WebGL.
        await page.waitForFunction(() => document.querySelector('.town-moon-letters').open);
        await letters.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        assert.equal(
          await page.locator('.town-moon-letters').evaluate((element) => element.open),
          true,
        );
        await activate(letters);
        await page.waitForFunction(() => !document.querySelector('.town-moon-letters').open);
        assert.equal(
          await page.locator('.town-moon-letters').evaluate((element) => element.open),
          false,
        );
        await lot.focus();
        await page.keyboard.press('Enter');
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
          await page.waitForFunction(
            () =>
              window.getScene().controls._pointers.length === 0 &&
              window.getScene().pointer === null,
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
          () => !window.getScene().viewChanged && !window.getScene().frame,
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
        assert.equal(
          await page.evaluate(() => window.events.valley),
          0,
          'Moon presses stay out of valley controls',
        );
        assert.deepEqual(errors, []);
        console.log(
          `${width}x${height} ${touch ? 'Touch' : 'Mouse'}: first/repeated lot, Back, letters, keyboard, orbit/release, Earth and valley isolation passed.`,
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
