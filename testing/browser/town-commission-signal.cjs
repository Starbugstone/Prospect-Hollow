// A player can see a commission from the moment it arrives until it stands, in the real game
// at desktop and phone sizes, in English and French. Needs `npm run demo:eras` first, then the
// Docker Vite/Playwright setup of moon-input.cjs. PH_SCREENSHOT_DIR saves captures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, SOFTWARE_WEBGL, testOrigin, pageErrors } = require('./helpers.cjs');

const shots = process.env.PH_SCREENSHOT_DIR;
if (shots) fs.mkdirSync(shots, { recursive: true });
const save = (page, name) =>
  shots ? page.screenshot({ path: path.join(shots, `${name}.png`), timeout: 60000 }) : null;
const PILL = '.town-map-frame .town-commission-goal';
const overlap = (a, b) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

const closeDialog = (page) => page.locator('.town-dialog-close').first().click();

async function openTown(browser, viewport) {
  const page = await browser.newPage({ viewport, locale: 'en-US' });
  page.setDefaultTimeout(120000);
  const errors = pageErrors(page);
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
    const profile = await (await fetch('/output/era-demo/twin-hollows-complete.json')).json();
    profile.town.coins = 1e7;
    campaign.importSave(createSaveFile({ ...campaign.profile(), ...profile }));
    window.campaign = campaign;
    const setup = document.querySelector('.town-scene').__vueParentComponent.setupState;
    await setup.update();
    while (!setup.scene.lifeReady || setup.scene.cameraFrame)
      await new Promise(requestAnimationFrame);
    setup.scene.setMotion(false);
    setup.scene.render();
  });
  return { page, errors };
}
// Chooses an outcome the way a player does, from the site's own card.
async function choose(page, site, design) {
  await page.evaluate(
    (site) =>
      document.querySelector('.town-view').__vueParentComponent.setupState.openMonument(site),
    site,
  );
  await page.locator('.monument-choices button', { hasText: design }).click();
  await page.locator('.monument-build .town-purchase').click();
  await page.locator('.monument-confirm .town-purchase').click();
  await page.locator('.monument-works').waitFor();
  await closeDialog(page);
}
// A town whose work has reached its last puzzle, loaded as a player's save would be.
const finishWork = (page, site) =>
  page.evaluate(async (site) => {
    const { createSaveFile } = await import('/src/services/saveTransfer.js');
    const { landmarkLevel } = await import('/src/data/townLandmarks.js');
    const profile = JSON.parse(JSON.stringify(window.campaign.profile()));
    const work = profile.town.personalisation.construction[site];
    work.wins = landmarkLevel(work.level).puzzles;
    window.campaign.importSave(createSaveFile(profile));
  }, site);
const state = (page, expected) =>
  page.locator(`${PILL}[data-commission-state="${expected}"]`).waitFor({ timeout: 20000 });
async function assertPillClear(page, viewport, label) {
  const box = await page.locator(PILL).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= viewport.width, `${label}: within the width`);
  assert.ok(box.height >= 44, `${label}: large enough to tap`);
  for (const selector of ['.town-project-goal:not(.town-commission-goal)', '.town-map-notice']) {
    const other = page.locator(`.town-map-frame ${selector}`);
    if (await other.count()) {
      const bounds = await other.first().boundingBox();
      if (bounds) assert.ok(!overlap(box, bounds), `${label}: clear of ${selector}`);
    }
  }
  const reached = await page.locator(PILL).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return element.contains(hit);
  });
  assert.ok(reached, `${label}: nothing covers the pill`);
  const overflow = await page
    .locator(`${PILL} small`)
    .evaluate((small) => small.getBoundingClientRect().right);
  assert.ok(overflow <= viewport.width, `${label}: the words stay on screen`);
}

async function run(browser, viewport, name) {
  const { page, errors } = await openTown(browser, viewport);
  await state(page, 'request');
  await assertPillClear(page, viewport, `${name} request`);
  await save(page, `${name}-request`);

  // The pill opens the waiting commission, on whichever settlement it is.
  await page.locator(PILL).click();
  await page.locator('[data-commission-request]').waitFor();
  await save(page, `${name}-letter`);
  await closeDialog(page);

  // The Moon's letter hangs over its site, and tapping it opens the same request.
  await page.waitForFunction(() => document.querySelector('.moon-view, [data-moon-action]'));
  const letter = page.locator('[data-moon-action="earthlight-conservatory"]').first();
  await letter.waitFor();
  await letter.click();
  await page.locator('[data-commission-request]').waitFor();
  await closeDialog(page);
  await page.evaluate(async () => {
    const { locale, loadFrench } = await import('/src/i18n/index.js');
    await loadFrench();
    locale.value = 'fr';
  });
  await assertPillClear(page, viewport, `${name} French request`);
  await save(page, `${name}-request-fr`);
  await page.evaluate(async () => {
    const { locale } = await import('/src/i18n/index.js');
    locale.value = 'en';
  });

  // Choosing it takes the letter down and starts the progress; the other waits behind it.
  await choose(page, 'earthlight-conservatory', 'Earthlight Bakehouse');
  await state(page, 'request');
  await choose(page, 'homecoming-commons', 'Homecoming Bandstand');
  await state(page, 'work');
  await page.locator(`${PILL} progress`).waitFor();
  await assertPillClear(page, viewport, `${name} work`);
  await save(page, `${name}-work`);

  await finishWork(page, 'earthlight-conservatory');
  await state(page, 'ready');
  await page.locator(`${PILL} img[src*="builder-hammer"]`).waitFor();
  await assertPillClear(page, viewport, `${name} ready`);
  await save(page, `${name}-ready`);

  assert.deepEqual(errors, [], `${name}: page errors`);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  try {
    await run(browser, { width: 1440, height: 900 }, 'desktop');
    await run(browser, { width: 375, height: 740 }, 'phone');
    console.log('The commission signal is clear on desktop and phone, in English and French.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
