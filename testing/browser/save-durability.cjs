const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const owner = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const initial = {
      schemaVersion: 2,
      records: {},
      continuousRecords: {},
      powers: [],
      seenTips: ['town'],
      town: { coins: 50, era: 'frontier', buildings: {} },
    };
    let remote = {
      townId: id,
      name: 'Review Town',
      revision: 1,
      updatedAt: 100,
      isPublic: false,
      publicId: 'public',
      profile: initial,
    };
    const errors = [],
      requests = [],
      receipts = new Map(),
      history = [];
    async function device() {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: 'en-US',
      });
      context.setDefaultTimeout(20000);
      const mode = { offline: false, reject: 0, expired: false };
      await context.addInitScript(
        ({ owner, id, remote }) => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
            return /webgl/i.test(kind) ? null : get.call(this, kind, ...args);
          };
          if (!localStorage.getItem('prospect-account-v2')) {
            localStorage.setItem(
              'prospect-account-v2',
              JSON.stringify({
                account: { id: owner, email: 'review@example.test' },
                generation: crypto.randomUUID(),
              }),
            );
            localStorage.setItem(
              'prospect-town-v2:' + owner + ':' + id,
              JSON.stringify({
                ...remote.profile,
                _cloud: {
                  version: 2,
                  active: {
                    id,
                    owner,
                    name: remote.name,
                    baseRevision: remote.revision,
                    sequence: 0,
                    dirty: false,
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
            const p = document.querySelector('#app').__vue_app__._context.provides;
            return Object.getOwnPropertySymbols(p)
              .map((k) => p[k])
              .find((v) => v?._s?.get)?._s;
          };
        },
        { owner, id, remote },
      );
      await context.route('**/api/v1/**', async (route) => {
        const req = route.request(),
          path = new URL(req.url()).pathname.split('/api/v1/')[1];
        requests.push({ mode, path, method: req.method() });
        if (mode.offline) {
          await route.abort('internetdisconnected');
          return;
        }
        if (mode.expired) {
          await route.fulfill({ status: 401, json: { error: 'Please sign in again.' } });
          return;
        }
        if (path === 'account') {
          await route.fulfill({
            json: {
              account: { id: owner, email: 'review@example.test' },
              csrf: 'test',
              towns: [remote],
            },
          });
          return;
        }
        if (path === `towns/${id}/history`) {
          await route.fulfill({ json: { revisions: history } });
          return;
        }
        assert(path.startsWith('towns/' + id), path);
        if (req.method() === 'PUT') {
          const body = req.postDataJSON();
          if (mode.reject) {
            await route.fulfill({
              status: mode.reject,
              json: { error: 'The save was rejected for this test.' },
            });
            return;
          }
          if (receipts.has(body.uploadId)) {
            await route.fulfill({ json: receipts.get(body.uploadId) });
            return;
          }
          if (body.baseRevision !== remote.revision) {
            await route.fulfill({
              status: 409,
              json: { error: 'Conflict', code: 'save_conflict', cloud: remote },
            });
            return;
          }
          history.unshift({
            revision: remote.revision,
            updatedAt: remote.updatedAt,
            profile: structuredClone(remote.profile),
          });
          remote = {
            ...remote,
            profile: body.profile,
            revision: remote.revision + 1,
            updatedAt: remote.updatedAt + 10,
          };
          receipts.set(body.uploadId, structuredClone(remote));
        }
        await route.fulfill({ json: remote });
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto((process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192') + '/?play=' + id);
      await page.getByRole('button', { name: 'Play level 1', exact: true }).waitFor();
      return { context, page, mode };
    }
    const a = await device(),
      b = await device();
    const grant = (d, coins) =>
      d.page.evaluate((coins) => window.prospectDebug.grant({ coins, hammers: 0 }), coins);
    const sync = async (d) => {
      await d.page.waitForFunction(async () => !(await window.cloudModule()).cloud.busy);
      const result = await d.page.evaluate(async () => (await window.cloudModule()).syncNow());
      // A lost-response retry may acknowledge an older checkpoint first. Observe
      // the normal scheduler flushing newer progress before checking the server.
      if (result)
        await d.page.waitForFunction(async () => {
          const { townStorage } = document.querySelector('#app').__vue_app__._instance.setupState;
          const meta = townStorage.active().meta;
          return (
            (!meta.dirty && !meta.pending) || meta.uploadError || meta.conflict || meta.missing
          );
        });
      return result;
    };
    const current = (d) => d.page.evaluate(() => window.stores().get('campaign').town.coins);
    const archive = (d) =>
      d.page.evaluate(async (id) => {
        const m = await window.cloudModule();
        return m.listRecoveries(id);
      }, id);
    // Real independent browser stores model phone + computer with one cloud town.
    b.mode.offline = true;
    await grant(b, 7);
    await a.page.getByRole('button', { name: 'Build for free', exact: true }).click();
    await grant(a, 10);
    await sync(a);
    assert.equal(remote.profile.town.coins, 60);
    assert.equal(remote.profile.town.buildings.well, 1);
    b.mode.offline = false;
    await sync(b);
    assert.equal(await current(b), 60);
    let copies = await archive(b);
    assert.equal(copies.length, 1);
    assert.equal(copies[0].coins, 57);
    const firstId = copies[0].id;
    b.mode.offline = true;
    await grant(b, 5);
    await grant(a, 8);
    await sync(a);
    b.mode.offline = false;
    await sync(b);
    assert.equal(await current(b), 68);
    copies = await archive(b);
    assert.equal(copies.length, 2);
    assert.deepEqual(copies.map((c) => c.coins).sort(), [57, 65]);
    await b.page.reload();
    await b.page.getByRole('button', { name: 'Play level 1', exact: true }).waitFor();
    assert.equal((await archive(b)).length, 2);
    await b.page.getByRole('button', { name: 'Compare saves', exact: true }).click();
    await b.page.getByRole('combobox').selectOption(firstId);
    await b.page.locator('.recovery-choice dd').filter({ hasText: /^57/ }).waitFor();
    const downloadPromise = b.page.waitForEvent('download');
    await b.page.getByRole('button', { name: 'Download this device’s save', exact: true }).click();
    const download = await downloadPromise;
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.profile.town.coins, 57);
    await b.page.setViewportSize({ width: 390, height: 844 });
    fs.mkdirSync('output/playwright', { recursive: true });
    await b.page.screenshot({ path: 'output/playwright/durability-recovery-mobile.png' });
    await b.page.getByRole('button', { name: 'Switch to this save', exact: true }).click();
    await b.page.getByRole('button', { name: 'Switch save', exact: true }).click();
    await b.page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(remote.profile.town.coins, 57);
    assert.equal(await current(b), 57);
    assert.equal((await archive(b)).length, 3);
    await sync(a);
    assert.equal(await current(a), 57);
    // A history restore must add another archive entry, preserving earlier ones.
    await b.page.evaluate(
      async ({ id, profile }) => {
        const m = await window.cloudModule();
        await m.restoreSave(id, profile);
      },
      { id, profile: history.find((h) => h.profile.town.coins === 68).profile },
    );
    assert.equal((await archive(b)).length, 4);
    assert.equal(await current(b), 68);
    // A permanent rejection does not poll and newer valid progress is not held behind it.
    b.mode.reject = 413;
    await grant(b, 1);
    await sync(b);
    await b.page.getByRole('alert').filter({ hasText: 'Cloud saving is paused' }).waitFor();
    const count = requests.filter((r) => r.mode === b.mode && r.method === 'PUT').length;
    await b.page.waitForTimeout(3500);
    assert.equal(requests.filter((r) => r.mode === b.mode && r.method === 'PUT').length, count);
    b.mode.reject = 0;
    await grant(b, 1);
    await sync(b);
    assert.equal(remote.profile.town.coins, 70);
    // An IndexedDB failure must keep dirty progress until the player retries.
    await b.page.evaluate(() => {
      window.savedPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () {
        throw new DOMException('Full', 'QuotaExceededError');
      };
    });
    b.mode.offline = true;
    await grant(b, 3);
    await sync(a);
    await grant(a, 10);
    await sync(a);
    b.mode.offline = false;
    await sync(b);
    assert.equal(await current(b), 73);
    await b.page.getByRole('alert').filter({ hasText: 'Cloud saving is paused' }).waitFor();
    await b.page.evaluate(() => {
      IDBObjectStore.prototype.put = window.savedPut;
    });
    await b.page.getByRole('button', { name: 'Retry cloud saving', exact: true }).click();
    await b.page.waitForFunction(() => window.stores().get('campaign').town.coins === 80);
    // Cached towns remain accessible without a valid cloud session. Removing an
    // unused copy is explicit and clears only that town's device archive.
    const cachedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await b.page.evaluate(
      async ({ owner, id, cachedId }) => {
        const prefix = 'prospect-town-v2:' + owner + ':';
        const record = JSON.parse(localStorage.getItem(prefix + id));
        record._cloud.active.id = cachedId;
        record._cloud.active.name = 'Offline Town';
        record._cloud.active.recovery = null;
        record._cloud.active.desyncNotice = false;
        localStorage.setItem(prefix + cachedId, JSON.stringify(record));
        (await window.cloudModule()).cloud.storageVersion++;
      },
      { owner, id, cachedId },
    );
    b.mode.expired = true;
    await sync(b);
    await b.page.getByRole('button', { name: 'Sign in again', exact: true }).click();
    await b.page.getByText('Towns stored on this device', { exact: true }).click();
    await b.page.getByRole('button', { name: 'Open device copy', exact: true }).click();
    await b.page.waitForFunction((cachedId) => {
      return (
        document.querySelector('#app').__vue_app__._instance.setupState.townStorage.active().meta
          .id === cachedId
      );
    }, cachedId);
    await b.page.getByRole('dialog').waitFor({ state: 'hidden' });
    await b.page.getByRole('button', { name: 'Play level 1', exact: true }).waitFor();
    const callsWhileExpired = requests.length;
    await b.page.getByRole('button', { name: 'Sign in again', exact: true }).click();
    await b.page.getByText('Towns stored on this device', { exact: true }).click();
    await b.page.getByRole('button', { name: 'Remove device copy', exact: true }).click();
    await b.page.getByLabel('Type the town name to confirm', { exact: true }).fill('Review Town');
    await b.page
      .locator('form')
      .filter({ hasText: 'Type the town name to confirm' })
      .getByRole('button', { name: 'Remove device copy', exact: true })
      .click();
    await b.page.waitForFunction(
      ({ owner, id }) => !localStorage.getItem('prospect-town-v2:' + owner + ':' + id),
      { owner, id },
    );
    assert.equal((await archive(b)).length, 0);
    assert.equal(requests.length, callsWhileExpired);
    assert.equal(remote.profile.town.coins, 80);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        multiDevice: 'PASS',
        successiveRecoveryCopies: true,
        reload: true,
        download: true,
        explicitOverwrite: true,
        historyRestore: true,
        rejectedUploadNoPolling: true,
        storageFailureRecovery: true,
        offlineCacheManagement: true,
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
