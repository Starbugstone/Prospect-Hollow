// Run with the Docker Vite/Playwright setup used by moon-input.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, SOFTWARE_WEBGL, testOrigin, pageErrors } = require('./helpers.cjs');

const publicId = 'a'.repeat(32);
const home = { townId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Silver Creek' };
const village = {
  villageId: publicId,
  name: 'Red Rock',
  era: 'tomorrow',
  appearance: {
    era: 'tomorrow',
    completedRuns: 12,
    buildings: { home: 3, well: 3, farm: 3, saloon: 3 },
    buildingEras: {},
    buildingEraLevels: {},
  },
};

async function aimAtAstronaut(page) {
  return page.evaluate(async () => {
    const { TOWN_ANIMALS } = await import('/src/data/townAnimals.js');
    const scene = document.querySelector('.town-scene').__vueParentComponent.setupState.scene;
    scene.setMotion(false);
    const wearer = scene.animals.find((animal) => animal.costume === 'space-helmet');
    if (!wearer?.root.visible) throw new Error('No visible astronaut');
    const position = wearer.root.position;
    scene.camera.position.set(position.x + 3, position.y + 4, position.z + 5);
    scene.controls.target.copy(position);
    scene.controls.update();
    scene.render();
    const middle = position.clone();
    middle.y += (TOWN_ANIMALS[wearer.species].height * wearer.root.scale.y) / 2;
    middle.project(scene.camera);
    const rect = scene.canvas.getBoundingClientRect();
    return {
      x: rect.left + ((middle.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - middle.y) * rect.height) / 2,
      camera: scene.camera.position.toArray(),
      target: scene.controls.target.toArray(),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    const results = [];
    fs.mkdirSync('output/playwright/village-helmet', { recursive: true });
    for (const [label, viewport, fullscreen] of [
      ['desktop', { width: 1440, height: 1000 }, false],
      ['mobile-fullscreen', { width: 390, height: 844 }, true],
    ]) {
      const page = await browser.newPage({ viewport, locale: 'en-US' });
      page.setDefaultTimeout(60000);
      const errors = pageErrors(page);
      let claims = 0;
      const requests = [];
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.split('/api/v1/')[1];
        requests.push(path);
        if (path === 'account/profile')
          return route.fulfill({
            json: { profile: { displayName: 'Alice' }, towns: [home], csrf: 'visit-csrf' },
          });
        if (path === `villages/${publicId}/presence`)
          return route.fulfill({ json: { active: true, visitId: 'visit' } });
        if (path === `villages/${publicId}/visitors`)
          return route.fulfill({ json: { present: [], history: [], page: 1, hasNext: false } });
        if (path === `villages/${publicId}/helmet`) {
          claims++;
          assert.equal(request.headers()['x-csrf-token'], 'visit-csrf');
          assert.deepEqual(request.postDataJSON(), { townId: home.townId });
          return route.fulfill({ json: { readyAt: Math.floor(Date.now() / 1000) + 43200 } });
        }
        assert([`villages/${publicId}`, `villages/${publicId}/latest`].includes(path), path);
        return route.fulfill({ json: village });
      });
      await page.goto(`${testOrigin()}/visit#town=${publicId}`);
      await page.getByLabel('Visiting as').selectOption(home.townId);
      await page.waitForFunction(() => {
        const scene = document.querySelector('.town-scene')?.__vueParentComponent.setupState.scene;
        return scene?.animals?.some((animal) => animal.costume === 'space-helmet');
      });
      if (fullscreen)
        await page.getByRole('button', { name: 'Full screen village', exact: true }).click();
      const spot = await aimAtAstronaut(page);
      await page.mouse.click(spot.x, spot.y);
      const burst = page.locator('.town-resource-collection');
      await burst.waitFor();
      assert.equal(await burst.locator('.collection-particles > *').count(), 10);
      const notice = page.locator('.town-visitor-notice');
      await notice.getByText(/Silver Creek receives half an hour/).waitFor();
      const box = await notice.boundingBox();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1);
      if (fullscreen) {
        const caption = await page.locator('.village-fullscreen-caption').boundingBox();
        const actions = await page.locator('.village-guestbook-actions').boundingBox();
        assert(box.y >= caption.y + caption.height, 'notice clears the full-screen caption');
        assert(box.y + box.height <= actions.y, 'notice clears the guestbook buttons');
      }
      await page.screenshot({ path: `output/playwright/village-helmet/${label}.png` });
      assert.equal(claims, 1);
      assert.deepEqual(
        await page.evaluate(() => {
          const scene = document.querySelector('.town-scene').__vueParentComponent.setupState.scene;
          return {
            camera: scene.camera.position.toArray(),
            target: scene.controls.target.toArray(),
          };
        }),
        { camera: spot.camera, target: spot.target },
      );
      await notice.getByRole('button', { name: 'Dismiss visitor notification' }).click();
      await page.mouse.click(spot.x, spot.y);
      await notice.getByText(/Silver Creek receives half an hour/).waitFor();
      assert.equal(claims, 1, 'repeat taps cannot pay twice');
      assert(!requests.some((path) => path === 'account' || path.startsWith('towns/')));
      assert.deepEqual(errors, []);
      results.push({ label, claims, coinParticles: 10, notice: await notice.innerText(), errors });
      await page.close();
    }
    fs.writeFileSync(
      'output/playwright/village-helmet/result.json',
      JSON.stringify(results, null, 2),
    );
    console.log(
      'Astronaut visit browser checks passed: direct links, coin bursts, visible notices, repeated taps and unchanged camera on desktop and mobile full screen.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
