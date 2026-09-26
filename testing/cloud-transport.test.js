import { beforeEach, afterEach, expect, it, vi } from 'vitest';
let cloud, configureSync, request, disconnect, townStorage;
beforeEach(async () => {
  vi.resetModules();
  const values = new Map();
  vi.stubGlobal('localStorage', {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal('fetch', vi.fn());
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
  expect(cloud.account).toBeNull();
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
