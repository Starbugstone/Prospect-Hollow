// Run against Vite or its production preview inside the Playwright Docker image.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    const origin = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:5194';
    const apiCalls = [],
      errors = [],
      failures = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(30000);
    await context.addInitScript(() => {
      // Count actual GPU draw calls to distinguish a running scene from an empty canvas.
      window.townDraws = 0;
      for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        for (const method of ['drawArrays', 'drawElements', 'drawElementsInstanced']) {
          const original = prototype[method];
          if (!original) continue;
          prototype[method] = function (...args) {
            window.townDraws++;
            return original.apply(this, args);
          };
        }
      }
    });
    await context.route('**/api/**', (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      apiCalls.push(`${request.method()} ${path}`);
      if (path === '/api/admin/me')
        return route.fulfill({ json: { stage: 'full', admin: { username: 'Test admin' } } });
      if (/^\/api\/admin\/towns\/(private|shared)$/.test(path)) {
        const id = path.split('/').at(-1);
        return route.fulfill({
          json: {
            town: {
              id,
              name: 'Test Hollow',
              revision: 1,
              isPublic: id === 'shared',
              owner: { id: 'owner', email: 'owner@example.test' },
              stats: {
                era: 'frontier',
                coins: 100,
                buildings: 3,
                levels: 3,
                stars: 9,
                score: 1234,
                highestLevel: 3,
              },
            },
            appearance: {
              name: 'Test Hollow',
              era: 'frontier',
              villageId: 'public-id',
              appearance: {
                era: 'frontier',
                buildings: { well: 1, saloon: 1, bank: 1 },
                buildingEras: {},
                buildingEraLevels: {},
                projects: {},
              },
            },
            profile: { town: { buildings: { well: 1, saloon: 1, bank: 1 } }, records: {} },
            history: [],
          },
        });
      }
      return route.fulfill({ status: 500, json: { error: 'Unexpected API request' } });
    });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => failures.push(request.url()));
    await page.goto(`${origin}/admin.html#/towns/private`);
    await page.getByRole('button', { name: 'Connect to town', exact: true }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0);
    assert(
      !requests.some((url) => /TownViewer|TownDiorama|TownScene/.test(url)),
      'renderer is lazy',
    );
    assert.equal(await page.evaluate(() => window.townDraws), 0);
    fs.mkdirSync('output/playwright', { recursive: true });
    await page.screenshot({ path: 'output/playwright/admin-town-disconnected.png' });

    async function connect() {
      await page.getByRole('button', { name: 'Connect to town', exact: true }).click();
      await page.locator('canvas[data-engine]').waitFor();
      await page.waitForFunction(() => !document.querySelector('.town-graphics-loading'));
      await page.waitForFunction(() => window.townDraws > 0);
      assert.equal(
        await page.locator('.town-action-icon:visible, .town-scene-labels button:visible').count(),
        0,
      );
    }
    await connect();
    const draws = await page.evaluate(() => window.townDraws);
    await page.waitForFunction((count) => window.townDraws > count, draws);
    await page.screenshot({ path: 'output/playwright/admin-town-connected.png' });
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 150, y: 200 } });
    await canvas.press('ArrowLeft');
    await page.locator('.town-camera-bar > summary').click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.getByRole('button', { name: 'Connect to town', exact: true }).waitFor();
    assert.equal(await canvas.count(), 0);
    const stopped = await page.evaluate(() => window.townDraws);
    // A bounded observation window verifies the renderer really stopped after unmount.
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.townDraws), stopped);
    await connect();
    await page.evaluate(() => {
      location.hash = '#/towns/shared';
    });
    await page.getByRole('button', { name: 'Connect to town', exact: true }).waitFor();
    assert.equal(await canvas.count(), 0, 'another town starts disconnected');
    await page.setViewportSize({ width: 390, height: 844 });
    await connect();
    assert(
      await page
        .locator('.admin-town-frame')
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    );
    await page.screenshot({ path: 'output/playwright/admin-town-mobile.png' });
    await page.reload();
    await page.getByRole('button', { name: 'Connect to town', exact: true }).waitFor();
    assert.equal(await canvas.count(), 0, 'reload does not reconnect');
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);

    // A failed lazy chunk shows an actionable error instead of leaving a blank frame.
    const failedPage = await context.newPage();
    await failedPage.route(/TownViewer.*\.(vue|js)/, (route) => route.abort());
    await failedPage.goto(`${origin}/admin.html#/towns/private`);
    await failedPage.getByRole('button', { name: 'Connect to town', exact: true }).click();
    await failedPage
      .getByRole('alert')
      .filter({ hasText: 'The town view could not load' })
      .waitFor();
    await failedPage.unroute(/TownViewer.*\.(vue|js)/);
    await failedPage.getByRole('button', { name: 'Reload page' }).click();
    await failedPage.getByRole('button', { name: 'Connect to town', exact: true }).click();
    await failedPage.locator('canvas[data-engine]').waitFor();
    await failedPage.close();

    // WebGL failure remains visible and never offers a gameplay escape from admin.
    const noGraphics = await context.newPage();
    await noGraphics.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return /webgl/i.test(kind) ? null : original.call(this, kind, ...args);
      };
    });
    await noGraphics.goto(`${origin}/admin.html#/towns/private`);
    await noGraphics.getByRole('button', { name: 'Connect to town', exact: true }).click();
    await noGraphics
      .getByRole('alert')
      .filter({ hasText: 'The village needs 3D graphics' })
      .waitFor();
    assert.equal(await noGraphics.getByRole('button', { name: 'Enter the mine' }).count(), 0);
    await noGraphics.close();
    assert(
      apiCalls.every((call) => /^GET \/api\/admin\/(me|towns\/(private|shared))$/.test(call)),
      apiCalls.join('\n'),
    );
    console.log(
      'Admin town view passed: lazy connection, rendering, read-only interaction, disconnect, navigation, mobile, failure feedback; no visitor or mutation requests.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
