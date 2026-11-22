// The share-link visit and the privacy notice are documents: they open where the game
// cannot save (no Web Locks, a save from a newer version), and a page whose chunk fails to
// load (an old chunk after a release) offers a reload instead of staying blank.
// Run against a Vite server with the Docker setup of docs/future-eras.md#moon-input-check.
const assert = require('node:assert/strict');
const { chromium, pageErrors, testOrigin } = require('./helpers.cjs');

const appearance = { era: 'frontier', buildings: {}, buildingEras: {}, buildingEraLevels: {} };
const village = { villageId: 'scene', name: 'Host Town', era: 'frontier', appearance };
const replies = {
  'account/profile': { profile: null, towns: [] },
  'villages/scene': village,
  'villages/scene/latest': village,
  'villages/scene/visitors': { history: [], present: [] },
  'villages/scene/presence': { active: true, visitId: 'stay', expiresAt: Date.now() + 30000 },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  async function check(name, action, { init, arg } = {}) {
    const context = await browser.newContext({ locale: 'en-US' });
    context.setDefaultTimeout(60000);
    const calls = [];
    await context.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname.split('/api/v1/')[1];
      calls.push(`${route.request().method()} ${path}`);
      const json = replies[path];
      return json
        ? route.fulfill({ json })
        : route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
    if (init) await context.addInitScript(init, arg);
    const page = await context.newPage();
    const errors = pageErrors(page, { consoleErrors: false });
    try {
      await action(page, calls);
      assert.deepEqual(errors, []);
      console.log('PASS', name);
    } catch (error) {
      failures.push(name);
      console.error('FAIL', name, error.message);
    } finally {
      await context.close();
    }
  }
  const origin = testOrigin();

  await check(
    'a share link opens without Web Locks and beside a save from a newer version',
    async (page, calls) => {
      await page.goto(`${origin}/visit#town=scene`);
      await page.getByRole('heading', { name: 'Host Town' }).waitFor();
      assert.ok(calls.includes('GET villages/scene'), calls.join(', '));
      assert.equal(await page.getByText('This page cannot save safely').count(), 0);
      assert.equal(await page.getByText('Unable to open this town').count(), 0);
    },
    {
      init: () => {
        Object.defineProperty(navigator, 'locks', { value: undefined });
        localStorage.setItem('crystal-cascade-profile-v3', JSON.stringify({ schemaVersion: 999 }));
      },
    },
  );

  await check('a first-time visitor joins the visit anonymously', async (page, calls) => {
    await page.goto(`${origin}/visit#town=scene`);
    await page.getByText('You appear as Visitor while visiting.').waitFor();
    assert.ok(calls.includes('POST villages/scene/presence'), calls.join(', '));
    assert.equal(await page.getByText('Live visit unavailable').count(), 0);
  });

  for (const [route, chunk, heading] of [
    ['/privacy', 'src/components/privacy/PrivacyPage.vue', 'Privacy at Prospect Hollow'],
    ['/visit#town=scene', 'src/components/community/VisitRoot.vue', 'Village visit'],
  ])
    await check(`${route} offers a reload when its page fails to load`, async (page) => {
      const failing = (request) => request.abort();
      await page.route(`**/${chunk}*`, failing);
      await page.goto(`${origin}${route}`);
      const alert = page.getByRole('alert');
      await alert.getByText('This view could not load').waitFor();
      await page.unroute(`**/${chunk}*`, failing);
      await alert.getByRole('button', { name: 'Reload the game' }).click();
      await page.getByRole('heading', { name: heading }).first().waitFor();
    });

  await browser.close();
  if (failures.length) {
    console.error(`${failures.length} check(s) failed`);
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
