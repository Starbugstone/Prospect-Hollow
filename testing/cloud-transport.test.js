import { beforeEach, afterEach, expect, it, vi } from 'vitest';
let cloud, configureSync, request, disconnect, townStorage;
beforeEach(async () => {
  vi.resetModules();
  const values = new Map();
  vi.stubGlobal('localStorage', {
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
