const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  chromium,
  SOFTWARE_WEBGL,
  preparePage,
  pageErrors,
  testOrigin,
  openNextStep,
  closeTownPanel,
} = require('./helpers.cjs');

(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    const context = await browser.newContext({
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
    });
    // Expose inspection helpers, but never reseed on reload: this journey proves persistence.
    await context.addInitScript(preparePage);
    const page = await context.newPage();
    const errors = pageErrors(page);
    const apiRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.goto(testOrigin() + '/play');
    await openNextStep(page, 1);
    const state = () =>
      page.evaluate(() => {
        const campaign = window.stores().get('campaign');
        return {
          well: campaign.town.buildings.well || 0,
          coins: campaign.town.coins,
          next: campaign.nextLevel,
        };
      });
    const before = await state();
    assert.equal(before.well, 0);
    await page.getByRole('button', { name: 'Build for free', exact: true }).click();
    await page.waitForFunction(() => window.stores().get('campaign').town.buildings.well === 1);
    await closeTownPanel(page);
    const built = await state();
    assert.equal(built.coins, before.coins, 'Free well must not charge coins');
    assert.equal(built.next, 1, 'Building must not consume a puzzle');
    const nextTip = page.getByText(
      'Fresh water at last! Coins come from the mine. Tap Mine to play a puzzle.',
    );
    await nextTip.waitFor();
    fs.mkdirSync('output/playwright/valley', { recursive: true });
    await page.screenshot({ path: 'output/playwright/valley/built.png' });
    await page.reload();
    await openNextStep(page, 1);
    assert.deepEqual(await state(), built, 'Well and coins survive a real page reload');
    assert.equal(
      await page.getByRole('button', { name: 'Build for free', exact: true }).count(),
      0,
    );
    await closeTownPanel(page);
    await nextTip.waitFor();
    await page.screenshot({ path: 'output/playwright/valley/reloaded.png' });
    assert.deepEqual(apiRequests, [], 'Signed-out construction must stay local');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      'output/playwright/valley/result.json',
      JSON.stringify({ before, built, reloaded: await state(), apiRequests, errors }, null, 2),
    );
    console.log(
      'PASS: free well built through Build tab, preserved after reload, no duplicate free build or backend requests.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
