const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  chromium,
  SOFTWARE_WEBGL,
  preparePage,
  playedProfile,
  pageErrors,
  testOrigin,
} = require('./helpers.cjs');
const french = require('../../src/i18n/fr.json');

(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  const results = [];
  fs.mkdirSync('output/playwright/town-name-menu', { recursive: true });
  try {
    for (const language of ['en', 'fr']) {
      const t = (message) => (language === 'fr' ? french[message] : message);
      const context = await browser.newContext({
        locale: language === 'fr' ? 'fr-FR' : 'en-US',
        viewport: language === 'fr' ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      });
      const profile = playedProfile(14);
      profile.town = {
        tourSeen: true,
        buildings: { well: 1, farm: 1, home: 1, saloon: 1 },
      };
      await context.addInitScript(preparePage, { profile });
      const page = await context.newPage();
      const errors = pageErrors(page, { echo: true });
      const requests = [];
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url());
      });
      await page.goto(testOrigin() + '/play', { timeout: 120000 });
      const trigger = page.locator('.save-pill');
      const frame = page.locator('.town-map-frame');
      const intro = page.getByRole('dialog', { name: t('Discover your town menu'), exact: true });
      const menu = page.getByRole('dialog', { name: t('Town & saves'), exact: true });
      await intro.waitFor({ timeout: 120000 });
      const originalSize = await frame.boundingBox();
      await page.screenshot({ path: `output/playwright/town-name-menu/${language}-intro.png` });
      await intro.getByRole('button', { name: t('Show me'), exact: true }).click();
      await menu.waitFor();
      await menu.getByRole('button', { name: new RegExp(t('Visit towns')) }).waitFor();
      await menu.getByRole('button', { name: new RegExp(t('Share my town')) }).waitFor();
      assert.deepEqual(
        await frame.boundingBox(),
        originalSize,
        'Opening the menu preserves the map size',
      );
      const bounds = await menu.boundingBox();
      const viewport = page.viewportSize();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width, 'Menu fits horizontally');
      assert(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, 'Menu fits vertically');
      assert(
        await menu.evaluate((element) => {
          const box = element.getBoundingClientRect();
          for (let x = 20; x < box.width - 20; x += 40)
            for (let y = 20; y < box.height - 20; y += 40)
              if (!element.contains(document.elementFromPoint(box.left + x, box.top + y)))
                return false;
          return true;
        }),
        'Project badges and other map controls never cover the town menu',
      );
      await page.screenshot({ path: `output/playwright/town-name-menu/${language}-menu.png` });
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'detached' });
      assert(
        await trigger.evaluate((el) => document.activeElement === el),
        'Escape restores focus to the town name',
      );
      await trigger.click();
      await page.locator('.town-tab-village').click();
      await menu.waitFor({ state: 'detached' });
      assert.equal(await intro.count(), 0, 'Outside tap does not repeat the introduction');
      await page.reload();
      await trigger.waitFor();
      assert.equal(await intro.count(), 0, 'Dismissal survives reload');
      assert.equal(
        await page.evaluate(() => localStorage.getItem('crystal-cascade-town-menu-introduced')),
        'true',
      );
      await trigger.click();
      await menu.getByRole('button', { name: t('Save online · Sign in'), exact: true }).click();
      await page
        .getByRole('heading', { name: t('Create an account / Sign in'), exact: true })
        .waitFor();
      await page.getByLabel(t('Email address'), { exact: true }).waitFor();
      await page
        .getByText(t('Your town stays private until you choose to share it.'), { exact: false })
        .waitFor();
      await page.getByRole('button', { name: t('Close account settings'), exact: true }).click();
      await trigger.click();
      await menu.getByRole('button', { name: new RegExp(t('Share my town')) }).click();
      await page.getByLabel(t('Email address'), { exact: true }).waitFor();
      await page.getByRole('button', { name: t('Close account settings'), exact: true }).click();
      assert.deepEqual(
        requests,
        [],
        'Opening menus and sign-in never publishes a town or calls the API',
      );
      assert.deepEqual(errors, []);
      results.push({
        language,
        viewport,
        mapSizePreserved: true,
        introDismissalPersisted: true,
        errors,
      });
      await context.close();
    }
    // A new player still sees the starter tutorial, without a competing introduction.
    const context = await browser.newContext({ locale: 'en-US' });
    await context.addInitScript(preparePage, { webgl: false });
    const page = await context.newPage();
    await page.goto(testOrigin() + '/play');
    await page.locator('.save-pill').waitFor({ timeout: 120000 });
    assert.equal(await page.locator('.save-pill-intro').count(), 0);
    await context.close();
    fs.writeFileSync(
      'output/playwright/town-name-menu/result.json',
      JSON.stringify(results, null, 2),
    );
    console.log(
      'PASS: town-name actions, keyboard/outside dismissal, unchanged map size, English/French mobile layout, persistent introduction and private sign-in.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
