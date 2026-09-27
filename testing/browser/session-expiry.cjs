const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'fr-FR',
    });
    context.setDefaultTimeout(15000);
    const owner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
    const profile = (coins) => ({
      schemaVersion: 2,
      records: {},
      continuousRecords: {},
      powers: [],
      seenTips: ['town'],
      town: { coins, era: 'frontier', buildings: {} },
    });
    const towns = ids.map((townId, i) => ({
      townId,
      name: ['Belle Prairie', 'Autre Ville'][i],
      revision: 1,
      profile: profile(50 + i * 50),
      updatedAt: 100,
      isPublic: false,
      publicId: townId,
    }));
    await context.addInitScript(
      ({ towns, owner }) => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return /webgl/i.test(kind) ? null : get.call(this, kind, ...args);
        };
        if (!localStorage.getItem('prospect-account-v2')) {
          localStorage.setItem(
            'prospect-account-v2',
            JSON.stringify({
              account: { id: owner, email: 'test@example.test' },
              generation: 'test-generation',
            }),
          );
          for (const town of towns)
            localStorage.setItem(
              'prospect-town-v2:' + owner + ':' + town.townId,
              JSON.stringify({
                ...town.profile,
                _cloud: {
                  version: 2,
                  active: {
                    id: town.townId,
                    name: town.name,
                    owner,
                    baseRevision: 1,
                    sequence: 0,
                    dirty: false,
                    pending: null,
                    conflict: null,
                  },
                },
              }),
            );
        }
        window.cloudModule = async () => {
          const active = document.querySelector('#app').__vue_app__._instance.setupState.cloud;
          const urls = performance
            .getEntriesByType('resource')
            .map((e) => e.name)
            .filter((url) => new URL(url).pathname === '/src/services/cloudProfile.js')
            .reverse();
          for (const url of urls) {
            const module = await import(url);
            if (module.cloud === active) return module;
          }
          throw new Error('Cannot locate the mounted cloud module.');
        };
        window.stores = () => {
          const provides = document.querySelector('#app').__vue_app__._context.provides;
          return Object.getOwnPropertySymbols(provides)
            .map((k) => provides[k])
            .find((v) => v?._s?.get)?._s;
        };
      },
      { towns, owner },
    );
    const errors = [],
      calls = [],
      receipts = new Map();
    let expired = false;
    await context.route('**/api/v1/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname.split('/api/v1/')[1];
      calls.push({ page: req.frame().page(), path, method: req.method() });
      if (path === 'auth/confirm') {
        expired = false;
        await route.fulfill({
          json: { account: { id: owner, email: 'test@example.test' }, csrf: 'test-only' },
        });
        return;
      }
      if (expired) {
        await route.fulfill({ status: 401, json: { error: 'Please sign in again.' } });
        return;
      }
      let data;
      if (path === 'account')
        data = {
          account: { id: owner, email: 'test@example.test' },
          csrf: 'test-only',
          towns: towns.map(({ profile, ...t }) => t),
        };
      else {
        const t = towns.find((t) => path === 'towns/' + t.townId);
        assert(t, path);
        if (req.method() === 'PUT') {
          const body = req.postDataJSON(),
            key = t.townId + ':' + body.uploadId;
          if (receipts.has(key)) data = receipts.get(key);
          else {
            assert.equal(body.baseRevision, t.revision);
            t.profile = body.profile;
            t.revision++;
            data = structuredClone(t);
            receipts.set(key, data);
          }
        } else data = structuredClone(t);
      }
      await route.fulfill({ json: data });
    });
    const page = async (id) => {
      const p = await context.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto((process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192') + '/?play=' + id);
      return p;
    };

    const a = await page(ids[0]),
      b = await page(ids[1]);
    for (const p of [a, b]) {
      await p.getByRole('button', { name: 'Jouer au niveau 1', exact: true }).waitFor();
      await p.bringToFront();
      await p.getByRole('button', { name: 'Jouer au niveau 1', exact: true }).click();
      await p.waitForFunction(() => {
        const g = window.stores().get('game');
        return g.sessionActive && g.renderer && !g.animationInProgress;
      });
      await p.evaluate(() => {
        const g = window.stores().get('game');
        g.moves = 25;
        g.score = 100;
      });
    }
    await a.bringToFront();
    await a.evaluate(() => window.stores().get('settings').toggleSettings(true));
    expired = true;
    await a.getByRole('button', { name: 'Synchroniser', exact: true }).click();

    for (const p of [a, b]) {
      await p.waitForFunction(
        () => JSON.parse(localStorage.getItem('prospect-account-v2')).expired === true,
      );
      await p.getByRole('button', { name: 'Se reconnecter', exact: true }).waitFor();
    }
    for (const p of [a, b]) {
      const state = await p.evaluate(() => ({
        active: window.stores().get('game').sessionActive,
        moves: window.stores().get('game').moves,
        selected: sessionStorage.getItem('prospect-selected-town-v2'),
      }));
      assert(state.active);
      assert.equal(state.moves, 25);
      assert(state.selected.includes('prospect-town-v2:'));
    }
    await a.evaluate(async () => {
      const m = await window.cloudModule();
      await m.confirmLogin('a'.repeat(64));
    });
    for (const p of [a, b]) {
      await p.waitForFunction(
        () => JSON.parse(localStorage.getItem('prospect-account-v2')).expired === false,
      );
      const state = await p.evaluate(() => ({
        active: window.stores().get('game').sessionActive,
        moves: window.stores().get('game').moves,
      }));
      assert(state.active);
      assert.equal(state.moves, 25);
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        expiry: 'PASS',
        sameTownsAndPuzzles: true,
        reauthentication: 'PASS',
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
