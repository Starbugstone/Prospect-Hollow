// Phone layouts of the town and the shared town: nothing the player needs sits under
// something else. Needs `npm run demo:eras` first, then the Docker Vite/Playwright setup
// used by moon-input.cjs. PH_SCREENSHOT_DIR saves captures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, SOFTWARE_WEBGL, testOrigin, pageErrors } = require('./helpers.cjs');

const shots = process.env.PH_SCREENSHOT_DIR;
const save = (page, name) =>
  shots ? page.screenshot({ path: path.join(shots, `${name}.png`) }) : null;
const overlap = (a, b) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;
// The element a tap at the centre of `selector` reaches is that element or inside it.
const reachable = (page, selector) =>
  page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return element.contains(hit);
  });
const useFrench = (page) =>
  page.evaluate(async () => {
    const { locale, loadFrench } = await import('/src/i18n/index.js');
    await loadFrench();
    locale.value = 'fr';
  });

// A developed save with Moon access, with saloon coins and forge TNT both waiting.
async function openTown(browser, viewport) {
  const page = await browser.newPage({ viewport, locale: 'en-US' });
  page.setDefaultTimeout(120000);
  const errors = pageErrors(page);
  // The first-visit menu introduction is modal and would cover what these checks measure.
  await page.addInitScript(() =>
    localStorage.setItem('crystal-cascade-town-menu-introduced', 'true'),
  );
  await page.goto(`${testOrigin()}/play`);
  await page.waitForFunction(
    () => document.querySelector('.town-scene')?.__vueParentComponent.setupState.scene,
  );
  await page.evaluate(async () => {
    const { createSaveFile } = await import('/src/services/saveTransfer.js');
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const campaign = pinia._s.get('campaign');
    const profile = await (await fetch('/output/era-demo/twin-hollows-open.json')).json();
    profile.town.income.stored = 100;
    campaign.importSave(createSaveFile({ ...campaign.profile(), ...profile }));
    const setup = document.querySelector('.town-scene').__vueParentComponent.setupState;
    await setup.update();
    while (!setup.scene.lifeReady || setup.scene.cameraFrame)
      await new Promise(requestAnimationFrame);
    setup.scene.setMotion(false);
    setup.scene.render();
  });
  return { page, errors };
}

const ownerNotice = (page) =>
  page.evaluate(() =>
    document
      .querySelector('.town-view')
      .__vueParentComponent.setupState.enqueueVisitorNotice([
        { kind: 'arrival', visitor: { id: 'a', name: 'Alexandra', townName: 'Silver Creek' } },
      ]),
  );

async function checkActions(browser, viewport) {
  const { page, errors } = await openTown(browser, viewport);
  const label = `actions-${viewport.width}x${viewport.height}`;
  const actions = page.locator('.town-action-icon');
  await page.locator('.town-action-icon[data-town-plot="saloon"]').waitFor();
  await page.locator('.town-action-icon[data-town-plot="blacksmith"]').waitFor();
  const boxes = await actions.evaluateAll((icons) =>
    icons.map((icon) => {
      const { x, y, width, height } = icon.getBoundingClientRect();
      const hit = document.elementFromPoint(x + width / 2, y + height / 2);
      return { id: icon.dataset.townPlot, x, y, width, height, own: icon.contains(hit) };
    }),
  );
  await save(page, label);
  for (const [n, a] of boxes.entries()) {
    assert(a.own, `${label}: a tap on ${a.id} reaches ${a.id}`);
    for (const b of boxes.slice(n + 1))
      assert(!overlap(a, b), `${label}: ${a.id} and ${b.id} do not overlap`);
  }
  const stock = () =>
    page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const campaign = pinia._s.get('campaign');
      return {
        coins: campaign.town.coins,
        tnt: campaign.powers.find(({ id }) => id === 'tnt').quantity,
      };
    });
  const before = await stock();
  const saloon = await page.locator('.town-action-icon[data-town-plot="saloon"]').boundingBox();
  await page.mouse.click(saloon.x + saloon.width / 2, saloon.y + saloon.height / 2);
  await page.waitForFunction(
    (coins) =>
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('campaign')
        .town.coins > coins,
    before.coins,
  );
  assert.equal((await stock()).tnt, before.tnt, `${label}: the coin tap leaves TNT waiting`);
  assert.deepEqual(errors, []);
  await page.close();
  return { label, targets: boxes.length };
}

async function checkBuild(browser, viewport, language) {
  const { page, errors } = await openTown(browser, viewport);
  if (language === 'fr') await useFrench(page);
  const label = `build-${language}-${viewport.width}x${viewport.height}`;
  await page.locator('.town-tab-build').click();
  const next = page.locator('.town-build-next');
  await next.waitFor();
  const sheet = page.locator('.town-dialog.town-sheet');
  const widths = await sheet.evaluate((element) => {
    const scroller = [element, ...element.querySelectorAll('*')].find(
      (node) =>
        ['auto', 'scroll'].includes(getComputedStyle(node).overflowX) &&
        node.scrollWidth > node.clientWidth + 1,
    );
    return scroller ? `${scroller.className}: ${scroller.scrollWidth}/${scroller.clientWidth}` : '';
  });
  assert.equal(widths, '', `${label}: the sheet does not scroll sideways`);
  const sheetBox = await sheet.boundingBox();
  for (const selector of ['.next-step-primary', '.next-step-mine']) {
    const button = next.locator(selector);
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert(
      box.x >= sheetBox.x &&
        box.x + box.width <= Math.min(sheetBox.x + sheetBox.width, viewport.width),
      `${label}: ${selector} stays in the sheet`,
    );
    assert(
      await reachable(page, `.town-build-next ${selector}`),
      `${label}: ${selector} is tappable`,
    );
  }
  const strip = await next.locator('.village-needs-strip').boundingBox();
  for (const item of await next.locator('.village-needs-strip > *').all()) {
    const box = await item.boundingBox();
    assert(
      box.x >= strip.x - 0.5 && box.x + box.width <= strip.x + strip.width + 0.5,
      `${label}: every statistic fits`,
    );
  }
  const name = next.locator('.next-step-copy > strong');
  const nameBox = await name.boundingBox();
  assert(
    await name.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    `${label}: the building name fits its column`,
  );
  for (const selector of ['.next-step-primary', '.next-step-mine'])
    assert(
      !overlap(nameBox, await next.locator(selector).boundingBox()),
      `${label}: the name clears ${selector}`,
    );
  await next.locator('.next-step-mine').scrollIntoViewIfNeeded();
  assert(
    await reachable(page, '.town-dialog.town-sheet .town-dialog-close'),
    `${label}: the scrolled panel stays under the close button`,
  );
  await save(page, label);
  assert.deepEqual(errors, []);
  await page.close();
  return { label };
}

async function checkOwnerNotices(browser) {
  const { page, errors } = await openTown(browser, { width: 390, height: 844 });
  await page.locator('.save-pill').click();
  const menu = page.locator('.save-pill-pop');
  await menu.waitFor();
  await ownerNotice(page);
  const notice = page.locator('.town-visitor-notice');
  await notice.waitFor();
  assert(
    await menu.evaluate((element) => {
      const box = element.getBoundingClientRect();
      for (let x = box.left + 8; x < box.right - 8; x += 24)
        for (let y = box.top + 8; y < box.bottom - 8; y += 24)
          if (!element.contains(document.elementFromPoint(x, y))) return false;
      return true;
    }),
    'the visitor notice stays behind the open town menu',
  );
  await save(page, 'notice-town-menu');
  assert.deepEqual(errors, []);
  await page.close();
  const results = [];
  for (const language of ['en', 'fr']) {
    const moon = await openTown(browser, { width: 320, height: 568 });
    if (language === 'fr') await useFrench(moon.page);
    await moon.page.evaluate(() =>
      document.querySelector('.town-scene').__vueParentComponent.setupState.openMoon(),
    );
    const header = moon.page.locator('.town-moon-header');
    await header.waitFor();
    await ownerNotice(moon.page);
    const moonNotice = moon.page.locator('.town-visitor-notice');
    await moonNotice.waitFor();
    assert(
      !overlap(await header.boundingBox(), await moonNotice.boundingBox()),
      `${language}: the notice clears the Moon header`,
    );
    await save(moon.page, `notice-moon-${language}`);
    assert.deepEqual(moon.errors, []);
    await moon.page.close();
    results.push(`moon-${language}`);
  }
  return results;
}

const publicId = 'a'.repeat(32);
const home = { townId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Silver Creek' };
const village = {
  villageId: publicId,
  name: 'Red Rock',
  era: 'tomorrow',
  appearance: {
    era: 'tomorrow',
    completedRuns: 12,
    mineLevel: 121,
    buildings: { home: 3, well: 3, farm: 3, saloon: 3 },
    buildingEras: {},
    buildingEraLevels: {},
    honours: { version: 1, earned: {}, showcase: [] },
  },
};

async function checkSharedTown(browser, viewport, language) {
  const page = await browser.newPage({ viewport, locale: 'en-US' });
  page.setDefaultTimeout(120000);
  const label = `shared-${language}-${viewport.width}x${viewport.height}`;
  await page.route('**/api/v1/**', (route) => {
    const api = new URL(route.request().url()).pathname.split('/api/v1/')[1];
    if (api === 'account/profile')
      return route.fulfill({
        json: { profile: { displayName: 'Alice' }, towns: [home], csrf: 'visit-csrf' },
      });
    if (api.endsWith('/presence'))
      return route.fulfill({ json: { active: true, visitId: 'visit' } });
    if (api.endsWith('/visitors'))
      return route.fulfill({
        json: { present: [{ id: 'visit', name: 'Alice' }], history: [], page: 1, hasNext: false },
      });
    return route.fulfill({ json: village });
  });
  await page.goto(`${testOrigin()}/visit#town=${publicId}`);
  await page.locator('.town-scene canvas').waitFor();
  // Visiting as a town adds Find me, the third button that wraps the footer on a phone.
  await page.getByLabel('Visiting as').selectOption(home.townId);
  await page.getByRole('button', { name: 'Find me', exact: true }).waitFor();
  if (language === 'fr') await useFrench(page);
  await page.locator('.town-fullscreen-button').click();
  const frame = page.locator('.community-world');
  const footer = page.locator('.village-guestbook-actions');
  await footer.waitFor();
  const notice = page.locator('.town-visitor-notice');
  const caption = page.locator('.village-fullscreen-caption');
  const run = (handler) =>
    frame.evaluate(
      (node, handler) => node.__vueParentComponent.setupState[handler]('gone'),
      handler,
    );
  for (const [name, handler] of [
    ['astronaut', 'notifyHelmet'],
    ['visitor', 'findVisitor'],
  ]) {
    await run(handler);
    await notice.waitFor();
    // ResizeObserver reports the wrapped buttons on a following frame.
    await page.waitForFunction(
      () =>
        document
          .querySelector('.community-world')
          .style.getPropertyValue('--village-footer-height') ===
        `${document.querySelector('.village-guestbook-actions').offsetHeight}px`,
    );
    const box = await notice.boundingBox();
    assert(
      !overlap(box, await footer.boundingBox()),
      `${label} ${name}: notice clears the buttons`,
    );
    assert(
      !overlap(box, await caption.boundingBox()),
      `${label} ${name}: notice clears the caption`,
    );
    assert(
      box.y >= 0 && box.x + box.width <= viewport.width,
      `${label} ${name}: notice is on screen`,
    );
    const dismiss = notice.getByRole('button').last();
    assert(
      await dismiss.evaluate((button) => {
        const { x, y, width, height } = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(x + width / 2, y + height / 2));
      }),
      `${label} ${name}: dismiss is tappable`,
    );
    await save(page, `${label}-${name}`);
    await dismiss.click();
    await notice.waitFor({ state: 'hidden' });
  }
  assert.equal(await footer.evaluate((node) => getComputedStyle(node).pointerEvents), 'none');
  await page.close();
  return { label };
}

(async () => {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  const results = [];
  const failures = [];
  // One layout failing does not hide the others.
  const attempt = async (check, ...args) => {
    try {
      results.push(await check(browser, ...args));
    } catch (error) {
      failures.push(error.message.split('\n')[0]);
    }
  };
  try {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
    ])
      await attempt(checkActions, viewport);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 667, height: 375 },
      { width: 844, height: 390 },
      { width: 1280, height: 900 },
    ])
      for (const language of ['en', 'fr']) await attempt(checkBuild, viewport, language);
    await attempt(checkOwnerNotices);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ])
      for (const language of ['en', 'fr']) await attempt(checkSharedTown, viewport, language);
    console.log(JSON.stringify(results));
    assert.deepEqual(failures, []);
    console.log('Mobile town layout checks passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
