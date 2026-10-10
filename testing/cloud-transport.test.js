import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const { uploads, cleanupArchive, cleanupTown } = vi.hoisted(() => ({
  uploads: new Map(),
  cleanupArchive: vi.fn(),
  cleanupTown: vi.fn(),
}));
vi.mock('../src/services/recoveryStore', () => ({
  recoveryStore: {
    putUpload: vi.fn(async (value) => uploads.set(value.id, structuredClone(value))),
    getUpload: vi.fn(async (id) => uploads.get(id)),
    removeUpload: vi.fn(async (id) => uploads.delete(id)),
    clearOwner: cleanupArchive,
    clearTown: cleanupTown,
  },
}));
let cloud, configureSync, request, disconnect, townStorage;
beforeEach(async () => {
  vi.resetModules();
  uploads.clear();
  cleanupArchive.mockClear();
  cleanupTown.mockClear();
  const values = new Map();
  vi.stubGlobal('localStorage', {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('navigator', {
    locks: { request: async (name, options, callback) => callback({ name }) },
  });
  ({ townStorage } = await import('../src/services/townStorage'));
  townStorage.save({
    schemaVersion: 2,
    town: { era: 'frontier', buildings: {}, coins: 5 },
    records: {},
    continuousRecords: {},
    powers: [],
  });
  ({ cloud, configureSync, request, disconnect } = await import('../src/services/cloudProfile'));
  configureSync({});
});
afterEach(() => vi.unstubAllGlobals());
it('keeps HTTP rejection status when hosting returns HTML instead of JSON', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  fetch.mockResolvedValue({
    ok: false,
    status: 413,
    json: async () => {
      throw new SyntaxError('HTML response');
    },
  });
  await expect(request('towns/test', {}, 'PUT')).rejects.toMatchObject({
    status: 413,
    message: expect.stringContaining('too large'),
  });
});
it('removes only an unused device copy and refuses the current or another tab’s town', async () => {
  const account = { id: 'account-a' },
    ownId = crypto.randomUUID(),
    otherId = crypto.randomUUID();
  const town = { name: 'Cached Town', revision: 1, profile: townStorage.active().profile };
  townStorage.account(account);
  townStorage.remember({ ...town, townId: ownId }, account.id);
  townStorage.remember({ ...town, townId: otherId }, account.id);
  townStorage.select(ownId, account.id);
  configureSync({});
  const { deleteCachedTown } = await import('../src/services/cloudProfile');
  await expect(deleteCachedTown(ownId)).rejects.toThrow('Open another town');
  expect(cleanupTown).not.toHaveBeenCalled();
  navigator.locks.request = async (name, options, callback) => callback(null);
  await expect(deleteCachedTown(otherId)).rejects.toThrow('another tab');
  expect(cleanupTown).not.toHaveBeenCalled();
  navigator.locks.request = async (name, options, callback) => callback({ name });
  await deleteCachedTown(otherId);
  expect(cleanupTown).toHaveBeenCalledWith(account.id, otherId);
  expect(townStorage.get(otherId, account.id)).toBeNull();
  expect(townStorage.get(ownId, account.id)).not.toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it('never fetches API data for an anonymous player', async () => {
  await expect(request('account')).rejects.toThrow('Sign in');
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps device progress and ends account transport when a session expires', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Please sign in again.' }),
  });
  await expect(request('account')).rejects.toMatchObject({ status: 401 });
  expect(cloud.account.id).toBe('account-a');
  expect(cloud.sessionExpired).toBe(true);
  expect(townStorage.active().profile.town.coins).toBe(5);
  await expect(request('account')).rejects.toThrow('Sign in');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('rejects an old session response after account switching', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  let complete;
  fetch.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const pending = request('account');
  disconnect();
  townStorage.account({ id: 'account-b' });
  configureSync({});
  complete({ ok: true, json: async () => ({ csrf: 'stale-csrf', account: { id: 'account-a' } }) });
  await expect(pending).rejects.toThrow('account changed');
  expect(cloud.account.id).toBe('account-b');
  expect(cloud.csrf).toBe('');
});
it('rejects a response for another town UUID, including conflict responses', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  for (const ok of [true, false]) {
    fetch.mockResolvedValue({
      ok,
      status: ok ? 200 : 409,
      json: async () => (ok ? { townId: 'wrong-town' } : { cloud: { townId: 'wrong-town' } }),
    });
    await expect(request('towns/expected-town')).rejects.toThrow('different town');
  }
});
it('rejects late responses after another tab signs into the same account again', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  let complete;
  fetch.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const task = request('account');
  townStorage.account({ id: 'account-a' }, true);
  complete({ ok: true, json: async () => ({ csrf: 'old-session' }) });
  await expect(task).rejects.toThrow('account changed');
  expect(cloud.csrf).toBe('');
});
it('shares account refresh while local startup and background sync run together', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  const { refreshAccount } = await import('../src/services/cloudProfile');
  let complete;
  fetch.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const first = refreshAccount(),
    second = refreshAccount();
  expect(first).toBe(second);
  expect(fetch).toHaveBeenCalledOnce();
  complete({
    ok: true,
    json: async () => ({ account: { id: 'account-a' }, csrf: 'current', towns: [] }),
  });
  await Promise.all([first, second]);
  expect(cloud.csrf).toBe('current');
});

it('keeps an expired account town selected and allows the same account to reconnect', async () => {
  const account = { id: 'account-a' },
    townId = crypto.randomUUID();
  townStorage.account(account, true);
  townStorage.remember(
    { townId, name: 'My Town', revision: 1, profile: townStorage.active().profile },
    account.id,
  );
  townStorage.select(townId, account.id);
  configureSync({});
  const key = townStorage.selectedKey();
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Please sign in again.' }),
  });
  await expect(request('account')).rejects.toMatchObject({ status: 401 });
  expect(townStorage.selectedKey()).toBe(key);
  expect(townStorage.auth().expired).toBe(true);
  townStorage.save({
    ...townStorage.active().profile,
    town: { ...townStorage.active().profile.town, coins: 8 },
  });
  expect(townStorage.active().profile.town.coins).toBe(8);
  townStorage.account(account, true);
  configureSync({});
  expect(cloud.sessionExpired).toBe(false);
  expect(townStorage.selectedKey()).toBe(key);
  expect(townStorage.active().meta.dirty).toBe(true);
});
it('rejects an invalid attachment name before changing or staging the local town', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  const { attachLocal } = await import('../src/services/cloudProfile');
  const before = townStorage.active();
  await expect(attachLocal('')).rejects.toThrow('3–24');
  expect(townStorage.active()).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
});
it('allows a new attachment name after a definitive rejection without renaming the local copy early', async () => {
  const account = { id: 'account-a' };
  townStorage.account(account);
  configureSync({});
  const { attachLocal } = await import('../src/services/cloudProfile');
  let remote,
    posted = [];
  fetch.mockImplementation(async (url, options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      posted.push(body);
      if (body.name === 'Taken Name')
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: 'Name taken', code: 'name_taken' }),
        };
      remote = { ...body, revision: 1, updatedAt: 10 };
    }
    return {
      ok: true,
      json: async () =>
        url.endsWith('/account') ? { account, towns: [remote], csrf: 'test' } : remote,
    };
  });
  const oldName = townStorage.active().meta.name;
  await expect(attachLocal('Taken Name')).rejects.toThrow('Name taken');
  expect(townStorage.active().meta.attachment).toBeNull();
  expect(townStorage.active().meta.name).toBe(oldName);
  await attachLocal('New Name');
  expect(posted.map((body) => body.name)).toEqual(['Taken Name', 'New Name']);
  expect(posted[0].townId).toBe(posted[1].townId);
  expect(townStorage.active().meta.name).toBe('New Name');
});
it('recovers a lost creation response under its original UUID even if the requested name changes', async () => {
  const account = { id: 'account-a' };
  townStorage.account(account);
  configureSync({});
  const { createAccountTown } = await import('../src/services/cloudProfile');
  const posted = [];
  let remote;
  fetch.mockImplementation(async (url, options) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      posted.push(body);
      if (!remote) {
        remote = { ...body, revision: 1, updatedAt: 10 };
        throw new Error('Response lost');
      }
    }
    return {
      ok: true,
      json: async () =>
        url.endsWith('/account') ? { account, towns: [remote], csrf: 'test' } : remote,
    };
  });
  await expect(createAccountTown('First Town', townStorage.active().profile)).rejects.toThrow(
    'Response lost',
  );
  const result = await createAccountTown('Second Town', townStorage.active().profile);
  expect(posted).toHaveLength(2);
  expect(posted[1]).toEqual(posted[0]);
  expect(result.name).toBe('First Town');
  expect(townStorage.records(account.id)).toHaveLength(1);
  expect(townStorage.state().creation).toBeNull();
});
it('creates a fresh UUID when recovering a missing cloud town and keeps the original cache', async () => {
  const account = { id: 'account-a' },
    oldId = crypto.randomUUID();
  townStorage.account(account);
  townStorage.remember(
    { townId: oldId, name: 'Missing Town', revision: 2, profile: townStorage.active().profile },
    account.id,
  );
  townStorage.select(oldId, account.id);
  townStorage.mutate(oldId, account.id, (r) => {
    r.meta.missing = true;
  });
  configureSync({});
  const { createAccountTown } = await import('../src/services/cloudProfile');
  let remote;
  fetch.mockImplementation(async (url, options) => {
    if (options.method === 'POST') remote = { ...JSON.parse(options.body), revision: 1 };
    return {
      ok: true,
      json: async () =>
        url.endsWith('/account') ? { account, towns: [remote], csrf: 'test' } : remote,
    };
  });
  const copy = await createAccountTown('Recovered Town', townStorage.active().profile);
  expect(copy.townId).not.toBe(oldId);
  expect(copy.profile.town.coins).toBe(5);
  expect(townStorage.get(oldId, account.id).meta.missing).toBe(true);
});

it('deleting an account clears only its local caches and archive after server confirmation', async () => {
  const account = { id: 'account-a' },
    ownId = crypto.randomUUID(),
    otherId = crypto.randomUUID();
  const town = { name: 'Cached Town', revision: 1, profile: townStorage.active().profile };
  townStorage.account(account);
  townStorage.remember({ ...town, townId: ownId }, account.id);
  townStorage.remember({ ...town, townId: otherId }, 'different-account');
  townStorage.select(ownId, account.id);
  configureSync({});
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  const { deleteAccount } = await import('../src/services/cloudProfile');
  await deleteAccount('DELETE MY ACCOUNT');
  expect(JSON.parse(fetch.mock.calls[0][1].body).confirmation).toBe('DELETE MY ACCOUNT');
  expect(cloud.account).toBeNull();
  expect(townStorage.records(account.id)).toHaveLength(0);
  expect(townStorage.records('different-account')).toHaveLength(1);
  expect(townStorage.active().meta.owner).toBeNull();
  expect(cleanupArchive).toHaveBeenCalledWith(account.id);
});
it('a rejected account deletion does not remove cached progress', async () => {
  townStorage.account({ id: 'account-a' });
  configureSync({});
  const before = townStorage.active();
  fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Rejected' }) });
  const { deleteAccount } = await import('../src/services/cloudProfile');
  await expect(deleteAccount('incorrect confirmation')).rejects.toThrow('Rejected');
  expect(townStorage.active()).toEqual(before);
  expect(cleanupArchive).not.toHaveBeenCalled();
});
it('deletes any cloud town at the revision the player reviewed and keeps its device copy', async () => {
  const account = { id: 'account-a' },
    ownId = crypto.randomUUID(),
    otherId = crypto.randomUUID();
  const town = { name: 'Cached Town', revision: 3, profile: townStorage.active().profile };
  townStorage.account(account);
  townStorage.remember({ ...town, townId: ownId }, account.id);
  townStorage.remember({ ...town, townId: otherId }, account.id);
  townStorage.select(ownId, account.id);
  configureSync({});
  const { deleteAccountTown } = await import('../src/services/cloudProfile');
  let rejectDelete = false;
  fetch.mockImplementation(async (url, options) => ({
    ok: !(rejectDelete && options.method === 'DELETE'),
    status: rejectDelete && options.method === 'DELETE' ? 409 : 200,
    json: async () =>
      url.endsWith('/account')
        ? { account, towns: [] }
        : rejectDelete
          ? { error: 'This town changed. Review it again before deleting.' }
          : { ok: true },
  }));
  const deletes = () =>
    fetch.mock.calls
      .filter(([, options]) => options.method === 'DELETE')
      .map(([url, options]) => [url.split('/').pop(), JSON.parse(options.body)]);

  // A town that is not being played deletes at the revision its card shows.
  await deleteAccountTown({ townId: otherId, name: 'Cached Town', revision: 7 }, 'Cached Town');
  expect(deletes()).toEqual([[otherId, { baseRevision: 7, confirmation: 'Cached Town' }]]);
  expect(townStorage.get(otherId, account.id).meta.missing).toBe(true);
  expect(fetch.mock.calls.at(-1)[0]).toMatch(/\/account$/);

  // A changed town is refused, refreshes its card and stays backed up.
  rejectDelete = true;
  fetch.mockClear();
  await expect(
    deleteAccountTown({ townId: ownId, name: 'Cached Town', revision: 9 }, 'Cached Town'),
  ).rejects.toMatchObject({ status: 409 });
  // The town being played deletes at its own base revision, not the listing's.
  expect(deletes()).toEqual([[ownId, { baseRevision: 3, confirmation: 'Cached Town' }]]);
  expect(townStorage.get(ownId, account.id).meta.missing).toBeFalsy();
  expect(fetch.mock.calls.at(-1)[0]).toMatch(/\/account$/);
});
