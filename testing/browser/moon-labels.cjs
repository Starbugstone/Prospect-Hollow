// Run against Docker Vite, with the same Playwright setup as moon-input.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';
const fixture = `<!doctype html><html><head><link rel="stylesheet" href="/src/styles/base.css"><link rel="stylesheet" href="/src/styles/town.css"><style>body{margin:0}#fixture{position:relative;width:100vw;height:100vh}</style></head><body><div id="fixture"></div><script type="module">
import {createApp,h,reactive} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {createTown} from '/src/data/town.js';
import {areasForSettlement,areaUnlocked} from '/src/data/townLandmarks.js';
const town=reactive(createTown());window.town=town;town.era='twin-hollows';
Object.assign(town.buildings,{spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,3]))});
window.expectedCount=Object.keys(MOON_LOTS).length+areasForSettlement('moon').filter(area=>areaUnlocked(town,area)).length;
window.indicators=reactive({settlerDomes:'ready'});
town.projects.settlerDomes={id:'settlerDomes',stage:3,wins:2,required:2};
window.selected=[];
window.app=createApp({render:()=>h(Moon,{active:false,town,indicators:window.indicators,reducedMotion:true,onSelect:id=>selected.push(id)})});app.mount('#fixture');
window.getMoon=()=>app._instance.subTree.component.setupState;
</script></body></html>`;
(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ hasTouch: true });
      page.setDefaultTimeout(120000);
      const errors = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
        console.error(error.message);
      });
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
          console.error(message.text());
        }
      });
      page.on('requestfailed', (request) =>
        console.error(request.url(), request.failure()?.errorText),
      );
      await page.route('**/moon-label-test', (route) =>
        route.fulfill({ contentType: 'text/html', body: fixture }),
      );
      await page.goto(base + '/moon-label-test');
      await page
        .waitForFunction(() => !!window.getMoon?.().scene)
        .catch(async (error) => {
          throw new Error(
            error.message +
              '\n' +
              JSON.stringify({ errors, text: await page.locator('body').innerText() }),
          );
        });
      await page.evaluate((fallback) => {
        window.getMoon().scene.setMotion(false);
        window.getMoon().scene.renderer.setAnimationLoop(null);
        if (fallback) window.getMoon().unavailable = true;
        // The 3D selection outline follows whichever lot the player selects.
        const scene = window.getMoon().scene,
          setSelected = scene.setSelected.bind(scene);
        window.outlined = [];
        scene.setSelected = (id) => {
          window.outlined.push(id);
          setSelected(id);
        };
      }, fallback);
      for (const [width, height] of [
        [1440, 900],
        [900, 360],
        [375, 740],
      ]) {
        await page.evaluate(() => {
          window.getMoon().selectedLot = null;
          document.activeElement?.blur();
        });
        await page.setViewportSize({ width, height });
        await page.evaluate(() => {
          const s = window.getMoon().scene;
          s.resize();
          s.viewChanged = true;
          s.render();
        });
        await page.waitForTimeout(100);
        const layout = await page.locator('.town-moon-lot').evaluateAll((elements) =>
          elements.map((el) => ({
            id: el.dataset.moonLot,
            box: el.getBoundingClientRect().toJSON(),
            pin: el.classList.contains('is-pin'),
          })),
        );
        assert.equal(
          layout.length,
          await page.evaluate(() => window.expectedCount),
          'Every lunar lot and site keeps a reachable label or pin',
        );
        const compact = width < 600 || height < 450;
        if (compact) {
          assert.ok(
            layout.some((lot) => lot.pin),
            'Routine lots collapse to pins',
          );
          assert.equal(
            layout.find((lot) => lot.id === 'settlerDomes').pin,
            false,
            'Ready construction always labelled',
          );
          const coverage =
            layout.reduce((sum, lot) => sum + lot.box.width * lot.box.height, 0) / (width * height);
          assert.ok(coverage <= 0.25, `Label/pin coverage ${coverage} exceeds 25%`);
        } else
          assert.ok(
            layout.every((lot) => !lot.pin),
            'Desktop labels preserved',
          );
        if (process.env.PH_SCREENSHOT_DIR) {
          await page.screenshot({
            animations: 'disabled',
            path: `${process.env.PH_SCREENSHOT_DIR}/moon-${fallback ? 'svg' : 'webgl'}-${width}.png`,
          });
        }
        for (const [i, a] of layout.entries()) {
          assert.ok(
            a.box.left >= 0 && a.box.right <= width && a.box.top >= 0 && a.box.bottom <= height,
            a.id + ' stays on screen',
          );
          for (const b of layout.slice(i + 1))
            assert.ok(
              a.box.right <= b.box.left ||
                b.box.right <= a.box.left ||
                a.box.bottom <= b.box.top ||
                b.box.bottom <= a.box.top,
              a.id + ' overlaps ' + b.id,
            );
          await page.locator(`[data-moon-lot="${a.id}"]`).tap({ timeout: 10000 });
          assert.equal(
            await page.evaluate(() => window.selected.at(-1)),
            a.id,
            'Tap still selects its own building',
          );
        }
        await page.locator('[data-moon-lot="settlerDomes"]').tap({ timeout: 10000 });
        assert.equal(
          await page.evaluate(() => window.selected.at(-1)),
          'settlerDomes',
          'Ready work retains its own touch target',
        );
        await page.waitForFunction(() => window.outlined.at(-1) === 'settlerDomes');
        if (compact) {
          const pin = page.locator('.town-moon-lot.is-pin').first();
          const pinId = await pin.getAttribute('data-moon-lot');
          await pin.focus();
          await page.keyboard.press('Enter');
          assert.equal(
            await page.evaluate(() => window.selected.at(-1)),
            pinId,
            'Keyboard opens a collapsed lot',
          );
          await page.waitForFunction(
            (id) => !document.querySelector(`[data-moon-lot="${id}"]`).classList.contains('is-pin'),
            pinId,
          );
          if (width === 375 && process.env.PH_SCREENSHOT_DIR)
            await page.screenshot({
              animations: 'disabled',
              path: `${process.env.PH_SCREENSHOT_DIR}/moon-${fallback ? 'svg' : 'webgl'}-375-revealed.png`,
            });
        }
        // The Moon lot list lives in the Build tab; the Moon map has no directory overlay.
        assert.equal(await page.locator('.moon-lot-directory').count(), 0);
        const leaders = await page.evaluate(() =>
          window
            .getMoon()
            .shownLots.filter((l) => l.leader)
            .map((l) => ({ line: l.leader, anchor: l.anchor })),
        );
        if (width < 1000) assert.ok(leaders.length > 0, 'Crowded labels expose their own leaders');
        for (const { line, anchor } of leaders) {
          assert.ok(Math.abs(line.x2 - (anchor.x * width) / 100) < 0.1);
          assert.ok(Math.abs(line.y2 - (anchor.y * height) / 100) < 0.1);
        }
        await page
          .locator('#fixture')
          .evaluate((element) => element.classList.add('town-labels-hidden'));
        assert.equal(
          await page.locator('.town-moon-lots').isVisible(),
          false,
          'Hidden village labels hide the Moon labels too',
        );
        await page
          .locator('#fixture')
          .evaluate((element) => element.classList.remove('town-labels-hidden'));
        console.log(
          `${fallback ? 'SVG' : 'WebGL'} ${width}x${height}: all ${layout.length} lots reachable, separate, anchored and within compact coverage budget.`,
        );
      }
      await page.evaluate(() => window.app.unmount());
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
