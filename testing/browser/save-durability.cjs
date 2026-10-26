const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  chromium,
  closeTownPanel,
  openNextStep,
  preparePage,
  testOrigin,
} = require('./helpers.cjs');
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
      await context.addInitScript(preparePage, {
        webgl: false,
        account: {
          id: owner,
          email: 'review@example.test',
          towns: [{ id, name: remote.name, revision: remote.revision, profile: remote.profile }],
        },
      });
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
      await page.goto(testOrigin() + '/?play=' + id);
      await openNextStep(page, 1);
      await closeTownPanel(page);
      return { context, page, mode };
    }
    const a = await device(),
      b = await device();
    // Local progress through the normal game: win the next level, collecting exactly
    // `coins` gems in chapter 1 (1x depth), then open its chest as the player does,
    // tapping while the reel shows a supply. An unopened chest is claimed later with
    // its random prize, which may be 500 coins: when the next run starts, or when
    // another device loads this save from the cloud.
    const earn = (d, coins) =>
      d.page.evaluate(async (coins) => {
        const { availableChestDrops } = await import('/src/data/rewards.js');
        const campaign = window.stores().get('campaign');
        const id = campaign.nextLevel,
          before = campaign.town.coins;
        const runId = campaign.beginRun('normal', id);
        const chests = campaign.recordVictory({
          id,
          runId,
          score: 100,
          target: 6000,
          combo: 1,
          jewels: coins,
          chooseRewards: true,
        });
        for (const chest of chests) {
          const supply = availableChestDrops(campaign).find((drop) => drop.kind !== 'coins');
          campaign.claimChest(chest.id, supply.id);
          const receipt = campaign.integrity.actions.at(-1);
          if (
            receipt.kind !== 'chest-claim' ||
            receipt.data.chestId !== chest.id ||
            receipt.data.selection !== supply.id
          )
            throw new Error(`Level ${id} did not open its chest on ${supply.id}.`);
        }
        if (!chests.length || campaign.pendingChests.length)
          throw new Error(`Level ${id} left a chest unopened.`);
        if (campaign.town.coins !== before + coins)
          throw new Error(`Level ${id} did not pay exactly ${coins} coins.`);
      }, coins);
    const sync = async (d) => {
      // syncNow declines while another sync runs, such as the scheduler retrying
      // offline progress. Wait for that one and ask again, so the check observes a
      // sync it requested before reading the result.
      let result = 'declined';
      for (let tries = 0; result === 'declined'; tries++) {
        assert(tries < 10, 'Another sync kept the cloud busy.');
        await d.page.waitForFunction(async () => !(await window.cloudModule()).cloud.busy);
        result = await d.page.evaluate(async () => {
          const { cloud, syncNow } = await window.cloudModule();
          const synced = await syncNow();
          return synced === undefined && cloud.account && !cloud.sessionExpired
            ? 'declined'
            : synced;
        });
      }
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
    await earn(b, 7);
    await openNextStep(a.page);
    await a.page.getByRole('button', { name: 'Build for free', exact: true }).click();
    await closeTownPanel(a.page);
    await earn(a, 10);
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
    await earn(b, 5);
    await earn(a, 8);
    await sync(a);
    b.mode.offline = false;
    await sync(b);
    assert.equal(await current(b), 68);
    copies = await archive(b);
    assert.equal(copies.length, 2);
    assert.deepEqual(copies.map((c) => c.coins).sort(), [57, 65]);
    await b.page.reload();
    await openNextStep(b.page);
    await closeTownPanel(b.page);
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
    await earn(b, 1);
    await sync(b);
    await b.page.getByRole('alert').filter({ hasText: 'Cloud saving is paused' }).waitFor();
    const count = requests.filter((r) => r.mode === b.mode && r.method === 'PUT').length;
    await b.page.waitForTimeout(3500);
    assert.equal(requests.filter((r) => r.mode === b.mode && r.method === 'PUT').length, count);
    b.mode.reject = 0;
    await earn(b, 1);
    await sync(b);
    assert.equal(remote.profile.town.coins, 70);
    // An IndexedDB failure must keep dirty progress until the player retries. The
    // background worker writes the archive, so the storage fails there as well.
    const archiveScopes = [b.page, ...b.page.workers()];
    assert(b.page.workers().some((worker) => worker.url().includes('backgroundJson.worker')));
    const failStorage = (full) =>
      Promise.all(
        archiveScopes.map((scope) =>
          scope.evaluate((full) => {
            if (!full) IDBObjectStore.prototype.put = self.savedPut;
            else {
              self.savedPut = IDBObjectStore.prototype.put;
              IDBObjectStore.prototype.put = function () {
                throw new DOMException('Full', 'QuotaExceededError');
              };
            }
          }, full),
        ),
      );
    await failStorage(true);
    b.mode.offline = true;
    await earn(b, 3);
    await sync(a);
    await earn(a, 10);
    await sync(a);
    b.mode.offline = false;
    await sync(b);
    assert.equal(await current(b), 73);
    await b.page.getByRole('alert').filter({ hasText: 'Cloud saving is paused' }).waitFor();
    await failStorage(false);
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
    await openNextStep(b.page);
    await closeTownPanel(b.page);
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
