import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { townStorage, SAVE_KEY } from '../src/services/townStorage';
import { createSyncService } from '../src/services/syncService';
let values, owner, api, sync, applied, canApply;
const profile = (coins = 1) => ({
  schemaVersion: 2,
  records: {},
  continuousRecords: {},
  powers: [],
  town: { era: 'frontier', buildings: {}, coins },
});
function remote(revision, coins = 1, id = townStorage.active().meta.id) {
  return {
    townId: id,
    name: 'Dustwater',
    revision,
    profile: profile(coins),
    updatedAt: 100,
    publicId: 'public-id',
    isPublic: false,
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setupAccount() {
  owner = { id: 'owner-a' };
  townStorage.account(owner);
  townStorage.attach(remote(1), owner.id, townStorage.active().meta.sequence);
}
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  townStorage.save(profile());
  owner = null;
  api = vi.fn();
  applied = vi.fn();
  canApply = vi.fn(() => true);
  sync = createSyncService({
    storage: townStorage,
    request: api,
    account: () => owner,
    applied,
    canApply,
  });
});
afterEach(() => vi.unstubAllGlobals());
it('does not call the backend when signed out, including after local progress', async () => {
  townStorage.save(profile(3));
  await sync.sync();
  expect(api).not.toHaveBeenCalled();
  expect(townStorage.active().profile.town.coins).toBe(3);
});
it('migrates a local save to an immutable identity and persists dirty metadata with gameplay', () => {
  const id = townStorage.active().meta.id;
  townStorage.save(profile(7));
  const raw = JSON.parse(values.get(SAVE_KEY));
  expect(raw.town.coins).toBe(7);
  expect(raw._cloud.active.id).toBe(id);
  expect(raw._cloud.active.dirty).toBe(true);
});
it('uploads changed local progress when the server has not changed', async () => {
  setupAccount();
  townStorage.save(profile(7));
  api.mockImplementation(async (_, body) =>
    body ? remote(2, body.profile.town.coins) : remote(1),
  );
  await sync.sync();
  expect(api.mock.calls[1][1]).toMatchObject({ baseRevision: 1, profile: { town: { coins: 7 } } });
  expect(townStorage.active().meta).toMatchObject({ baseRevision: 2, dirty: false });
});
it('downloads a newer cloud save automatically for an unchanged device', async () => {
  setupAccount();
  api.mockResolvedValue(remote(2, 10));
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(10);
  expect(applied).toHaveBeenCalledOnce();
});
it('does nothing when both copies are unchanged', async () => {
  setupAccount();
  api.mockResolvedValue(remote(1));
  await sync.sync();
  expect(api).toHaveBeenCalledTimes(1);
  expect(applied).not.toHaveBeenCalled();
});
it('preserves both branches when the same town diverges', async () => {
  setupAccount();
  townStorage.save(profile(9));
  api.mockResolvedValue(remote(2, 10));
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(9);
  expect(townStorage.active().meta.conflict.profile.town.coins).toBe(10);
  expect(api).toHaveBeenCalledTimes(1);
});
it('never clears changes made while an upload is in flight', async () => {
  setupAccount();
  townStorage.save(profile(4));
  const pending = deferred();
  api.mockImplementation(async (_, body) => (body ? pending.promise : remote(1)));
  const done = sync.sync();
  await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  townStorage.save(profile(5));
  pending.resolve(remote(2, 4));
  await done;
  expect(townStorage.active().profile.town.coins).toBe(5);
  expect(townStorage.active().meta).toMatchObject({ baseRevision: 2, dirty: true });
});
it('turns local progress made during a download into a conflict instead of overwriting it', async () => {
  setupAccount();
  const pending = deferred();
  api.mockReturnValue(pending.promise);
  const done = sync.sync();
  townStorage.save(profile(8));
  pending.resolve(remote(2, 9));
  await done;
  expect(townStorage.active().profile.town.coins).toBe(8);
  expect(townStorage.active().meta.conflict.revision).toBe(2);
});
it('keeps a lost upload response pending and retries the same snapshot and upload ID', async () => {
  setupAccount();
  townStorage.save(profile(4));
  api.mockImplementation(async (_, body) => {
    if (body) throw new Error('connection lost');
    return remote(1);
  });
  await expect(sync.sync()).rejects.toThrow('connection lost');
  const pending = townStorage.active().meta.pending;
  townStorage.save(profile(6));
  api.mockResolvedValue(remote(2, 4));
  await sync.sync();
  expect(api.mock.calls.at(-1)[1]).toEqual(pending.body);
  expect(townStorage.active().meta.dirty).toBe(true);
  expect(townStorage.active().profile.town.coins).toBe(6);
});
it('does not replace an in-progress mine with an automatic download', async () => {
  setupAccount();
  canApply.mockReturnValue(false);
  api.mockResolvedValue(remote(2, 20));
  await sync.sync();
  expect(townStorage.active().meta.baseRevision).toBe(1);
  expect(applied).not.toHaveBeenCalled();
});
it('invalidates late responses on sign-out and preserves the single local town', async () => {
  setupAccount();
  const pending = deferred();
  api.mockReturnValue(pending.promise);
  const done = sync.sync();
  owner = null;
  townStorage.logout();
  pending.resolve(remote(2, 20));
  await done;
  expect(townStorage.active().meta.owner).toBeNull();
  expect(townStorage.active().profile.town.coins).toBe(1);
  expect(applied).not.toHaveBeenCalled();
});
it('resolves only against the cloud revision shown to the player', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  api.mockImplementation(async (_, body) => {
    expect(body.baseRevision).toBe(2);
    return remote(3, body.profile.town.coins);
  });
  await sync.resolve(townStorage.active().meta.id, 'local');
  expect(api.mock.calls.at(-1)[0]).toContain('/resolve');
  expect(townStorage.active().meta).toMatchObject({
    dirty: false,
    baseRevision: 3,
    conflict: null,
  });
});
it('keeps the losing local copy when the player chooses cloud', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  await sync.resolve(townStorage.active().meta.id, 'cloud');
  expect(townStorage.active().profile.town.coins).toBe(9);
  expect(townStorage.active().meta.recovery.profile.town.coins).toBe(5);
});
it('asks again if the cloud changes while the comparison is open', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  api.mockResolvedValue(remote(3, 11));
  await expect(sync.resolve(townStorage.active().meta.id, 'cloud')).rejects.toThrow(
    'changed again',
  );
  expect(townStorage.active().profile.town.coins).toBe(5);
  expect(townStorage.active().meta.conflict.revision).toBe(3);
});
it('syncs other towns independently of a conflict', async () => {
  setupAccount();
  const first = townStorage.active().meta.id;
  townStorage.save(profile(4));
  const second = crypto.randomUUID();
  townStorage.remember(remote(1, 8, second), owner.id);
  api.mockImplementation(async (path) =>
    path.endsWith(first) ? remote(2, 5, first) : remote(2, 10, second),
  );
  await sync.sync();
  expect(townStorage.active().meta.conflict).toBeTruthy();
  expect(townStorage.records(owner.id).find((r) => r.meta.id === second).profile.town.coins).toBe(
    10,
  );
});
it('keeps deleted cloud towns locally without recreating them', async () => {
  setupAccount();
  townStorage.save(profile(6));
  api.mockRejectedValue(Object.assign(new Error('deleted'), { status: 404 }));
  await sync.sync();
  await sync.sync();
  expect(api).toHaveBeenCalledTimes(1);
  expect(townStorage.active().meta.missing).toBe(true);
  expect(townStorage.active().profile.town.coins).toBe(6);
});
it('offers one local slot and hides cached account towns on sign-out', () => {
  setupAccount();
  const second = crypto.randomUUID();
  townStorage.remember(remote(1, 20, second), owner.id);
  townStorage.select(second, owner.id);
  townStorage.logout();
  expect(townStorage.active().profile.town.coins).toBe(1);
  expect(() => townStorage.select(second, owner.id)).toThrow('Sign in');
  expect(townStorage.records(owner.id)).toHaveLength(2);
});
it('preserves saves atomically if storage is full', () => {
  const before = values.get(SAVE_KEY);
  localStorage.setItem = () => {
    throw new Error('quota');
  };
  expect(() => townStorage.save(profile(9))).toThrow('quota');
  expect(values.get(SAVE_KEY)).toBe(before);
});
it('restores clean cloud data after local storage loss once signed in', () => {
  setupAccount();
  const cloud = remote(7, 300);
  values.clear();
  townStorage.ensure(profile());
  townStorage.account(owner);
  townStorage.remember(cloud, owner.id);
  townStorage.select(cloud.townId, owner.id);
  expect(townStorage.active().profile.town.coins).toBe(300);
  expect(townStorage.active().meta).toMatchObject({ baseRevision: 7, dirty: false });
});

it('retries an interrupted explicit resolution before stopping for its saved conflict', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  api.mockRejectedValue(new Error('lost resolution response'));
  await expect(sync.resolve(townStorage.active().meta.id, 'local')).rejects.toThrow(
    'lost resolution response',
  );
  const pending = townStorage.active().meta.pending;
  townStorage.save(profile(6));
  api.mockResolvedValue(remote(3, 5));
  await sync.sync();
  expect(api.mock.calls.at(-1)[0]).toContain('/resolve');
  expect(api.mock.calls.at(-1)[1]).toEqual(pending.body);
  expect(townStorage.active().profile.town.coins).toBe(6);
  expect(townStorage.active().meta).toMatchObject({ baseRevision: 3, dirty: true, conflict: null });
});

it('retains a durable account creation attempt across reload and newer local progress', () => {
  setupAccount();
  const body = {
    townId: crypto.randomUUID(),
    name: 'New town',
    uploadId: crypto.randomUUID(),
    baseRevision: 0,
    profile: profile(),
  };
  townStorage.creation({ owner: owner.id, body });
  townStorage.save(profile(10));
  expect(JSON.parse(values.get(SAVE_KEY))._cloud.creation).toEqual({ owner: owner.id, body });
});

it('prevents stale game instances from saving into another selected town', async () => {
  const { localProfile } = await import('../src/services/localProfile');
  setupAccount();
  localProfile.load();
  const second = remote(1, 30, crypto.randomUUID());
  townStorage.remember(second, owner.id);
  townStorage.select(second.townId, owner.id);
  expect(localProfile.save(profile(99))).toBe(false);
  expect(townStorage.active().profile.town.coins).toBe(30);
  localProfile.load();
  localProfile.save(profile(31));
  expect(townStorage.active().profile.town.coins).toBe(31);
});

it('keeps an unchanged town clean when only its idle income checkpoint advances', () => {
  const saved = profile();
  saved.town.income = { at: 1000, stored: 0, remainder: 0 };
  townStorage.save(saved);
  setupAccount();
  const sequence = townStorage.active().meta.sequence;
  saved.town.income.at = 2000;
  townStorage.save(saved);
  expect(townStorage.active().meta).toMatchObject({ dirty: false, sequence });
  saved.town.income.stored = 1;
  townStorage.save(saved);
  expect(townStorage.active().meta.dirty).toBe(true);
});
