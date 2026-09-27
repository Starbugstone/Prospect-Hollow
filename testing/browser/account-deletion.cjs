const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const origin = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';
  const owner = 'account-to-delete',
    townId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const profile = (coins) => ({
    schemaVersion: 2,
    records: {},
    continuousRecords: {},
    powers: [],
    seenTips: ['town'],
    town: { coins, era: 'frontier', buildings: {} },
  });
  fs.mkdirSync('output/playwright', { recursive: true });
  try {
    for (const scenario of [
      { locale: 'en-US', width: 1440, failOnce: false, blockedArchive: false },
      { locale: 'fr-FR', width: 390, failOnce: true, blockedArchive: false },
      { locale: 'en-US', width: 390, failOnce: false, blockedArchive: true },
    ]) {
      const context = await browser.newContext({
        locale: scenario.locale,
        viewport: { width: scenario.width, height: 900 },
      });
      context.setDefaultTimeout(20000);
      const french = scenario.locale === 'fr-FR';
      const town = {
        townId,
        name: 'Account Town',
        revision: 1,
        updatedAt: 100,
        publicId: 'public-town',
        isPublic: false,
        profile: profile(50),
      };
      await context.addInitScript(
        ({ owner, town, guest }) => {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
            return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
          };
          if (localStorage.getItem('account-deletion-test-seeded')) return;
          localStorage.setItem('account-deletion-test-seeded', 'true');
          localStorage.setItem('crystal-cascade-profile-v3', JSON.stringify(guest));
          localStorage.setItem('unrelated-preference', 'keep');
          localStorage.setItem(
            'prospect-account-v2',
            JSON.stringify({
              account: { id: owner, email: 'delete@example.test' },
              generation: 'initial',
            }),
          );
          for (const account of [owner, 'other-account'])
            localStorage.setItem(
              `prospect-town-v2:${account}:${town.townId}`,
              JSON.stringify({
                ...town.profile,
                _cloud: {
                  version: 2,
                  active: {
                    id: town.townId,
                    name: town.name,
                    owner: account,
                    baseRevision: town.revision,
                    sequence: 1,
                    dirty: false,
                    updatedAt: 100,
                  },
                },
              }),
            );
        },
        { owner, town, guest: profile(25) },
      );
      let deleted = false,
        deletionRequests = 0,
        requestsAfterDeletion = 0;
      const errors = [];
      await context.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.split('/api/v1/')[1];
        if (deleted) {
          requestsAfterDeletion++;
          return route.fulfill({ status: 401, json: { error: 'Please sign in again.' } });
        }
        if (path === 'account' && request.method() === 'DELETE') {
          deletionRequests++;
          assert.equal(request.postDataJSON().confirmation, 'DELETE MY ACCOUNT');
          assert.equal(request.headers()['x-csrf-token'], 'test-csrf');
          if (scenario.failOnce && deletionRequests === 1)
            return route.fulfill({
              status: 503,
              json: { error: 'Deletion unavailable. Try again.' },
            });
          deleted = true;
          return route.fulfill({ json: { ok: true } });
        }
        if (path === 'account')
          return route.fulfill({
            json: {
              account: { id: owner, email: 'delete@example.test' },
              csrf: 'test-csrf',
              towns: [town],
            },
          });
        assert.equal(path, `towns/${townId}`);
        if (request.method() === 'PUT') {
          town.profile = request.postDataJSON().profile;
          town.revision++;
        }
        return route.fulfill({ json: town });
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/?play=${townId}`);
      await page
        .getByRole('button', { name: french ? 'Tout refuser' : 'Reject all', exact: true })
        .click();
      await page
        .getByRole('button', { name: french ? 'Réglages' : 'Settings', exact: true })
        .first()
        .click();
      await page
        .getByRole('button', {
          name: french ? 'Compte et suppression' : 'Account & deletion',
          exact: true,
        })
        .click();
      const panel = page.getByRole('dialog', { name: french ? 'Compte' : 'Account', exact: true });
      await panel
        .getByText('delete@example.test', { exact: true })
        .waitFor()
        .catch(async (error) => {
          await page.screenshot({ path: 'output/playwright/account-delete-failure.png' });
          console.error(await page.locator('dialog[open]').innerText());
          throw error;
        });
      const disclosure = panel
        .locator('summary')
        .filter({ hasText: french ? 'Supprimer mon compte…' : 'Delete my account…' });
      await disclosure.click();
      const input = panel.getByRole('textbox');
      const remove = panel.getByRole('button', {
        name: french ? 'Supprimer mon compte' : 'Delete my account',
        exact: true,
      });
      assert(await remove.isDisabled(), 'empty confirmation cannot delete');
      await input.fill('delete my account');
      assert(await remove.isDisabled(), 'incorrect confirmation cannot delete');
      await input.fill('DELETE MY ACCOUNT');
      assert(await remove.isEnabled());
      await disclosure.click();
      await disclosure.click();
      assert.equal(await input.inputValue(), '', 'collapsing confirmation resets it');
      assert.equal(deletionRequests, 0, 'opening confirmation does not delete');
      await input.fill('DELETE MY ACCOUNT');
      if (!scenario.blockedArchive)
        await page.evaluate(
          async ({ owner, townId }) => {
            const db = await new Promise((resolve, reject) => {
              const request = indexedDB.open('prospect-recovery-v1', 2);
              request.onupgradeneeded = () => {
                for (const bucket of ['copies', 'uploads']) {
                  const store = request.result.createObjectStore(bucket, { keyPath: 'id' });
                  store.createIndex('owner', 'owner');
                  store.createIndex('town', ['owner', 'townId']);
                }
              };
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
              const tx = db.transaction(['copies', 'uploads'], 'readwrite');
              tx.oncomplete = resolve;
              tx.onerror = () => reject(tx.error);
              for (const bucket of ['copies', 'uploads']) {
                tx.objectStore(bucket).put({ id: 'deleted', owner, townId });
                tx.objectStore(bucket).put({ id: 'kept', owner: 'other-account', townId });
              }
            });
            db.close();
          },
          { owner, townId },
        );
      await remove.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/playwright/account-delete-${scenario.locale}-${scenario.width}.png`,
      });
      if (scenario.blockedArchive)
        await page.evaluate(() => {
          const transaction = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
            if (this.name === 'prospect-recovery-v1' && mode === 'readwrite')
              throw new DOMException('Local archive unavailable', 'InvalidStateError');
            return transaction.call(this, stores, mode, ...args);
          };
        });
      await remove.click();
      if (scenario.failOnce) {
        await panel.getByText('Deletion unavailable. Try again.', { exact: true }).waitFor();
        assert.equal(
          await page.evaluate(
            () => JSON.parse(localStorage.getItem('prospect-account-v2')).account.id,
          ),
          owner,
        );
        await remove.click();
      }
      await page
        .getByRole('heading', {
          name: french ? 'Votre compte a été supprimé' : 'Your account has been deleted',
          exact: true,
        })
        .waitFor();
      if (scenario.blockedArchive)
        await page.getByText(/Some local copies could not be removed/).waitFor();
      const state = await page.evaluate(
        ({ owner, townId }) => ({
          account: JSON.parse(localStorage.getItem('prospect-account-v2')).account,
          deletedTown: localStorage.getItem(`prospect-town-v2:${owner}:${townId}`),
          keptTown: localStorage.getItem(`prospect-town-v2:other-account:${townId}`),
          guest: JSON.parse(localStorage.getItem('crystal-cascade-profile-v3')),
          preference: localStorage.getItem('unrelated-preference'),
        }),
        { owner, townId },
      );
      assert.equal(state.account, null);
      assert.equal(state.deletedTown, null);
      assert(state.keptTown);
      assert.equal(state.guest.town.coins, 25);
      assert.equal(state.preference, 'keep');
      if (!scenario.blockedArchive) {
        const archive = await page.evaluate(async () => {
          const db = await new Promise((resolve) => {
            const request = indexedDB.open('prospect-recovery-v1', 2);
            request.onsuccess = () => resolve(request.result);
          });
          const records = await Promise.all(
            ['copies', 'uploads'].map(
              (bucket) =>
                new Promise((resolve) => {
                  const request = db.transaction(bucket).objectStore(bucket).getAll();
                  request.onsuccess = () => resolve(request.result);
                }),
            ),
          );
          db.close();
          return records;
        });
        for (const entries of archive)
          assert.deepEqual(
            entries.map((entry) => entry.owner),
            ['other-account'],
          );
      }
      assert.equal(deletionRequests, scenario.failOnce ? 2 : 1);
      await page.reload();
      await page
        .getByRole('button', { name: french ? 'Réglages' : 'Settings', exact: true })
        .first()
        .waitFor();
      assert.equal(requestsAfterDeletion, 0, 'reload cannot resurrect a deleted account');
      assert.deepEqual(errors, [], 'no browser runtime errors');
      await context.close();
    }
    console.log(
      'Account deletion browser checks passed: desktop, mobile French, rejected deletion/retry, archive failure, and reload.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
