// Run against Docker Vite, with the same Playwright setup as moon-input.cjs.
const assert = require('node:assert/strict');
const { chromium, SOFTWARE_WEBGL, moonPage, openFixture, pageErrors } = require('./helpers.cjs');
const fixture = moonPage(`
import {createApp,h,reactive} from '/node_modules/.vite/deps/vue.js';
import Moon from '/src/components/town/TownMoonView.vue';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {createTown} from '/src/data/town.js';
import {areasForSettlement,areaUnlocked} from '/src/data/townLandmarks.js';
import {moonMapLabel} from '/src/game/town/moon/MoonLabelLayout.js';
window.moonMapLabel=moonMapLabel;
import {setLocale} from '/src/i18n/index.js';
window.setLocale=setLocale;
const town=reactive(createTown());window.town=town;town.era='twin-hollows';
Object.assign(town.buildings,{spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,3]))});
window.expectedCount=Object.keys(MOON_LOTS).length+areasForSettlement('moon').filter(area=>areaUnlocked(town,area)).length;
window.indicators=reactive({settlerDomes:'ready'});
town.projects.settlerDomes={id:'settlerDomes',stage:3,wins:2,required:2};
window.selected=[];
window.app=createApp({render:()=>h(Moon,{active:false,town,indicators:window.indicators,reducedMotion:true,onSelect:id=>selected.push(id)})});app.mount('#fixture');
window.getMoon=()=>app._instance.subTree.component.setupState;
`);
(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ hasTouch: true });
      page.setDefaultTimeout(120000);
      const errors = pageErrors(page, { echo: true });
      page.on('requestfailed', (request) =>
        console.error(request.url(), request.failure()?.errorText),
      );
      await openFixture(page, 'moon-label-test', fixture);
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
        // The view learns its size from a ResizeObserver, on a later frame under load:
        // measure only once it lays labels out for this size, and Vue has drawn them.
        await page.waitForFunction(
          ([w, h]) => {
            const { viewport } = window.getMoon();
            return viewport.width === w && viewport.height === h;
          },
          [width, height],
        );
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done())));
        const layout = await page.locator('.town-moon-lot').evaluateAll((elements) =>
          elements.map((el) => ({
            id: el.dataset.moonLot,
            box: el.getBoundingClientRect().toJSON(),
            pin: el.classList.contains('is-pin'),
          })),
        );
        assert.equal(
          await page.locator('.town-moon-lot.town-map-label').count(),
          layout.length,
          'Every Moon label uses the shared map renderer',
        );
        assert.ok(layout.length > 0, 'The map shows important names');
        assert.ok(
          layout.every((lot) => !lot.pin),
          'Every visible name uses a pill',
        );
        assert.ok(layout.length <= (await page.evaluate(() => window.expectedCount)));
        // The finish hammer stands apart from the labels on every screen, as the valley's.
        const hammer = page.locator('[data-moon-action="settlerDomes"]');
        const hammerBox = await hammer.boundingBox();
        assert.ok(
          (await hammer.isVisible()) &&
            hammerBox.x >= 0 &&
            hammerBox.x + hammerBox.width <= width &&
            hammerBox.y >= 0 &&
            hammerBox.y + hammerBox.height <= height,
          'Ready construction shows its finish icon on screen',
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
        const first = page.locator('.town-moon-lot').first();
        const firstId = await first.getAttribute('data-moon-lot');
        await first.focus();
        await page.keyboard.press('Enter');
        assert.equal(
          await page.evaluate(() => window.selected.at(-1)),
          firstId,
          'Keyboard opens the named lot',
        );
        // The Moon lot list lives in the Build tab; the Moon map has no directory overlay.
        assert.equal(await page.locator('.moon-lot-directory').count(), 0);
        const detached = await page.evaluate(() => {
          const moon = window.getMoon();
          const source = moon.unavailable
            ? moon.allLots.map((lot) => window.moonMapLabel(lot, moon.viewport))
            : moon.labels;
          return moon.shownLots
            .filter((lot) => {
              const anchor = source.find((point) => point.id === lot.id);
              return !anchor || lot.x !== anchor.x || lot.y !== anchor.y;
            })
            .map((lot) => lot.id);
        });
        assert.deepEqual(detached, [], 'Names stay at their projected buildings');
        await page
          .locator('#fixture')
          .evaluate((element) => element.classList.add('town-labels-hidden'));
        assert.equal(
          await page.locator('.town-moon-lots').isVisible(),
          false,
          'Hidden village labels hide the Moon labels too',
        );
        assert.ok(await hammer.isVisible(), 'Hidden labels keep the finish icon');
        await page.evaluate(() => window.selected.push(null));
        await hammer.tap({ timeout: 10000 });
        assert.equal(
          await page.evaluate(() => window.selected.at(-1)),
          'settlerDomes',
          'The finish icon opens its building with labels hidden',
        );
        await page
          .locator('#fixture')
          .evaluate((element) => element.classList.remove('town-labels-hidden'));
        // Long translated names and collection statuses must stay inside the pill.
        for (const language of ['en', 'fr']) {
          await page.evaluate((language) => {
            window.setLocale(language);
            window.getMoon().selectedLot = 'moonstoneWorkshop';
            window.town.moonstoneProduction = { stored: 30, wins: 0 };
          }, language);
          await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
          const overflow = await page.locator('.town-moon-lot:not(.is-pin)').evaluateAll((labels) =>
            labels.flatMap((label) => {
              const box = label.getBoundingClientRect();
              return [...label.querySelectorAll('.plot-name, small')]
                .filter((part) => {
                  const child = part.getBoundingClientRect();
                  return (
                    child.left < box.left - 1 ||
                    child.right > box.right + 1 ||
                    child.top < box.top - 1 ||
                    child.bottom > box.bottom + 1
                  );
                })
                .map((part) => `${label.dataset.moonLot}: ${part.textContent}`);
            }),
          );
          assert.deepEqual(overflow, [], `${language} label text stays inside its laid-out button`);
        }
        await page.evaluate(() => window.setLocale('en'));
        console.log(
          `${fallback ? 'SVG' : 'WebGL'} ${width}x${height}: ${layout.length} visible names stay separate and anchored; actions, touch, keyboard and translated bounds pass.`,
        );
      }
      assert.deepEqual(errors, []);
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
