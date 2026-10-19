// Run against the Docker Vite server; see docs/future-eras.md#moon-input-check.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';
const fixture = `<!doctype html><html><head><link rel="stylesheet" href="/src/styles/town.css"><style>body{margin:0}#fixture{position:relative;width:100vw;height:100vh}</style></head><body><div id="fixture"></div><script type="module">
import {createApp,h} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
window.events={inspect:[],close:0,valley:0};
window.app=createApp({render(){return h('div',{style:'position:relative;width:100%;height:100%',onPointerdown(){window.events.valley++}},[h(Moon,{reducedMotion:true,town:{era:'moonward',buildings:{spaceElevator:1,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,1]))},projects:{}},onInspect(id){window.events.inspect.push(id)},onClose(){window.events.close++}})])}});
app.mount('#fixture');
window.getScene=()=>app._instance.subTree.children[0].component.setupState.scene;
</script></body></html>`;
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const touch of [false, true]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
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
      await page.waitForFunction(() => !!window.getScene());
      console.log('Scene ready');
      const activate = async (locator) => (touch ? locator.tap() : locator.click());
      const lot = page.getByRole('button', { name: /Ribbon landing/ });
      await activate(lot);
      await activate(lot);
      assert.deepEqual(await page.evaluate(() => window.events.inspect), [
        'ribbonLanding',
        'ribbonLanding',
      ]);
      await activate(page.getByRole('button', { name: 'Back to the valley' }));
      assert.equal(await page.evaluate(() => window.events.close), 1);
      const letters = page.locator('summary');
      await activate(letters);
      assert.equal(await page.locator('details').evaluate((element) => element.open), true);
      await activate(letters);
      assert.equal(await page.locator('details').evaluate((element) => element.open), false);
      await lot.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.events.inspect.length), 3);
      const start = await page.evaluate(() => window.getScene().camera.position.toArray());
      if (touch) {
        const cdp = await context.newCDPSession(page);
        for (const [type, touchPoints] of [
          ['touchStart', [{ x: 900, y: 600 }]],
          ['touchMove', [{ x: 980, y: 620 }]],
          ['touchEnd', []],
        ])
          await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        await page.waitForFunction(() => window.getScene().controls._pointers.length === 0);
        for (const [type, touchPoints] of [
          ['touchStart', [{ x: 900, y: 600 }]],
          ['touchMove', [{ x: 940, y: 600 }]],
          ['touchCancel', []],
        ])
          await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        await page.waitForFunction(
          () =>
            window.getScene().controls._pointers.length === 0 && window.getScene().pointer === null,
        );
      } else {
        await page.mouse.move(900, 600);
        await page.mouse.down();
        await page.mouse.move(980, 620, { steps: 8 });
        await page.mouse.up();
      }
      const after = await page.evaluate(() => ({
        camera: window.getScene().camera.position.toArray(),
        pointers: window.getScene().controls._pointers.length,
      }));
      assert.equal(after.pointers, 0, 'release must reach OrbitControls document cleanup');
      assert.notDeepEqual(after.camera, start, 'drag still orbits the Moon');
      await page.mouse.move(1100, 650);
      assert.deepEqual(
        await page.evaluate(() => window.getScene().camera.position.toArray()),
        after.camera,
        'hover after release must not continue orbiting',
      );
      await page.evaluate(() => window.getScene().resetView());
      await page.waitForFunction(() => !window.getScene().viewChanged && !window.getScene().frame);
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
        `${touch ? 'Touch' : 'Mouse'}: first/repeated lot, Back, letters, keyboard, orbit/release, Earth and valley isolation passed.`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
