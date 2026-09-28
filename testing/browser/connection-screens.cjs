const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const origin = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';
    const owner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
    const towns = ids.map((townId, i) => ({
      townId,
      name: i ? 'Other Device Town' : 'Current Town',
      revision: 1,
      updatedAt: Date.now() / 1000,
      isPublic: false,
      publicId: townId,
      summary: { era: i ? 'industrial' : 'frontier', coins: i ? 900 : 50, buildings: i ? 3 : 0 },
      profile: {
        schemaVersion: 2,
        records: {},
        continuousRecords: {},
        powers: [],
        seenTips: ['town'],
        town: { era: 'frontier', coins: 50, buildings: {} },
      },
    }));
    const calls = [],
      errors = [];
    async function device(signedIn) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: 'en-US',
      });
      context.setDefaultTimeout(20000);
      await context.addInitScript(
        ({ owner, signedIn, profile }) => {
          if (!signedIn)
            localStorage.setItem('crystal-cascade-profile-v3', JSON.stringify(profile));
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
            return /webgl/i.test(kind) ? null : get.call(this, kind, ...args);
          };
          if (signedIn && !localStorage.getItem('prospect-account-v2'))
            localStorage.setItem(
              'prospect-account-v2',
              JSON.stringify({
                account: { id: owner, email: 'test@example.test' },
                generation: 'test',
              }),
            );
          window.stores = () => {
            const provides = document.querySelector('#app').__vue_app__._context.provides;
            return Object.getOwnPropertySymbols(provides)
              .map((k) => provides[k])
              .find((v) => v?._s?.get)?._s;
          };
        },
        { owner, signedIn, profile: towns[0].profile },
      );
      await context.route('**/api/v1/**', async (route) => {
        const req = route.request(),
          path = new URL(req.url()).pathname.split('/api/v1/')[1];
        calls.push({ signedIn, path, method: req.method() });
        if (path === 'account')
          return route.fulfill({
            json: {
              account: { id: owner, email: 'test@example.test' },
              csrf: 'test',
              towns: towns.map(({ profile, ...town }) => town),
            },
          });
        if (path === 'auth/login-link')
          return route.fulfill({ json: { message: 'Check your email.' } });
        if (path === 'auth/confirm')
          return route.fulfill({
            json: { account: { id: owner, email: 'test@example.test' }, csrf: 'test' },
          });
        const town = towns.find((t) => path === `towns/${t.townId}`);
        assert(town, path);
        return route.fulfill({ json: town });
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + (signedIn ? '/?play=' + ids[0] : '/play'));
      await page.getByRole('button', { name: 'Play level 1', exact: true }).waitFor();
      return { page, context };
    }
    const { page } = await device(true);
    await page.evaluate(() => window.stores().get('settings').toggleSettings(true));
    await page.getByRole('button', { name: 'My towns & saves', exact: true }).click();
    const card = page.locator('.town-slot').filter({ hasText: 'Other Device Town' });
    await card.getByText('3 buildings · 900 coins', { exact: true }).waitFor();
    await card
      .locator('.town-slot-era')
      .filter({ hasText: 'Industrial / Electric Town' })
      .waitFor();
    assert.equal(
      calls.filter((c) => c.path === 'towns/' + ids[1]).length,
      0,
      'no full-save request for card',
    );
    assert.equal(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        `prospect-town-v2:${owner}:${ids[1]}`,
      ),
      null,
    );
    fs.mkdirSync('output/playwright', { recursive: true });
    await page.screenshot({ path: 'output/playwright/connection-towns-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await card
      .locator('.town-slot-era-mobile')
      .filter({ hasText: 'Industrial / Electric Town' })
      .waitFor();
    await card.getByText('3 buildings · 900 coins', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/playwright/connection-towns-mobile.png' });
    assert(
      await page.locator('.account-panel').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      'mobile dialog fits viewport',
    );
    await page.close();
    const { page: guest } = await device(false);
    assert.equal(calls.filter((c) => !c.signedIn).length, 0, 'guests do not use backend');
    await guest.getByRole('button', { name: /, save status: On this device$/ }).click();
    await guest.getByRole('button', { name: 'Protect my progress', exact: true }).click();
    await guest.getByLabel('Email address', { exact: true }).fill('guest@example.test');
    await guest.getByRole('button', { name: 'Email me a sign-in link', exact: true }).click();
    await guest.getByRole('heading', { name: 'Check your inbox', exact: true }).waitFor();
    await guest.evaluate(() => {
      location.hash = 'login=' + 'a'.repeat(64);
    });
    await guest.getByRole('button', { name: 'Sign in', exact: true }).click();
    await guest.getByText('2 of 3 slots used', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        coldDeviceCards: 'PASS',
        noExtraSaveRequests: true,
        mobileLayout: 'PASS',
        guestLocalOnly: true,
        signInWhileOpen: 'PASS',
        pageErrors: errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
