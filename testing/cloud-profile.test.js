import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { townStorage } from '../src/services/townStorage';
import { createSyncService } from '../src/services/syncService';
const { backups, outbox } = vi.hoisted(() => ({ backups: new Map(), outbox: new Map() }));
vi.mock('../src/services/recoveryStore', () => ({
  recoveryStore: {
    putUpload: vi.fn(async (value) => outbox.set(value.id, structuredClone(value))),
    getUpload: vi.fn(async (id, owner, townId) => {
      const value = outbox.get(id);
      return value?.owner === owner && value?.townId === townId ? structuredClone(value) : null;
    }),
    removeUpload: vi.fn(async (id) => outbox.delete(id)),
    put: vi.fn(async (value) => backups.set(value.id, structuredClone(value))),
    get: vi.fn(async (id, owner, townId) => {
      const value = backups.get(id);
      return value?.owner === owner && value?.townId === townId ? structuredClone(value) : null;
    }),
  },
}));
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
  backups.clear();
  outbox.clear();
  values = new Map();
  vi.stubGlobal('localStorage', {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
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
  const raw = JSON.parse(values.get(townStorage.selectedKey()));
  expect(raw.town.coins).toBe(7);
  expect(raw._cloud.active.id).toBe(id);
  expect(raw._cloud.active.dirty).toBe(true);
});
it('does not echo normalized object ordering back as new gameplay or a dirty cloud save', () => {
  setupAccount();
  const original = townStorage.active().profile;
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  reordered.town = Object.fromEntries(Object.entries(original.town).reverse());
  townStorage.save(reordered);
  expect(townStorage.active().meta.dirty).toBe(false);
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
it('defaults to the server and preserves the complete local save when the town diverges', async () => {
  setupAccount();
  townStorage.save(profile(9));
  api.mockResolvedValue(remote(2, 10));
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(10);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(9);
  expect(townStorage.active().meta).toMatchObject({
    baseRevision: 2,
    dirty: false,
    conflict: null,
    desyncNotice: true,
  });
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
it('preserves progress made during a download before defaulting to the server', async () => {
  setupAccount();
  const pending = deferred();
  api.mockReturnValue(pending.promise);
  const done = sync.sync();
  townStorage.save(profile(8));
  pending.resolve(remote(2, 9));
  await done;
  expect(townStorage.active().profile.town.coins).toBe(9);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(8);
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
  expect(api.mock.calls.at(-1)[1]).toMatchObject(pending.body);
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
  const review = await sync.reviewRecovery(townStorage.active().meta.id);
  api.mockImplementation(async (_, body) => {
    expect(body.baseRevision).toBe(2);
    return remote(3, body.profile.town.coins);
  });
  await sync.overwriteRecovery(townStorage.active().meta.id, review);
  expect(api.mock.calls.at(-1)[0]).toContain('/resolve');
  expect(townStorage.active().meta).toMatchObject({
    dirty: false,
    baseRevision: 3,
    conflict: null,
  });
});
it('keeps the original recovery copy through later clean cloud updates', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  const recoveryId = townStorage.active().meta.recovery.id;
  api.mockResolvedValue(remote(3, 12));
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(12);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(5);
  expect(townStorage.active().meta.recovery.id).toBe(recoveryId);
});
it('asks again if the cloud changes while the comparison is open', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  const review = await sync.reviewRecovery(townStorage.active().meta.id);
  api.mockRejectedValue(
    Object.assign(new Error('conflict'), { status: 409, data: { cloud: remote(3, 11) } }),
  );
  await expect(sync.overwriteRecovery(townStorage.active().meta.id, review)).rejects.toThrow(
    'changed again',
  );
  expect(townStorage.active().profile.town.coins).toBe(11);
  expect(townStorage.active().meta.baseRevision).toBe(3);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(5);
  expect(townStorage.active().meta.pending).toBeNull();
  api.mockResolvedValue(remote(3, 11));
  await sync.sync();
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(1);
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
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(4);
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
  const before = values.get(townStorage.selectedKey());
  localStorage.setItem = () => {
    throw new Error('quota');
  };
  expect(() => townStorage.save(profile(9))).toThrow('quota');
  expect(values.get(townStorage.selectedKey())).toBe(before);
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

it('retries the exact confirmed overwrite after a lost response and recovers newer local progress', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  const review = await sync.reviewRecovery(townStorage.active().meta.id);
  api.mockRejectedValue(new Error('lost resolution response'));
  await expect(sync.overwriteRecovery(townStorage.active().meta.id, review)).rejects.toThrow(
    'lost resolution response',
  );
  const pending = townStorage.active().meta.pending;
  townStorage.save(profile(6));
  api.mockResolvedValue(remote(3, 5));
  await sync.sync();
  expect(api.mock.calls.at(-1)[0]).toContain('/resolve');
  expect(api.mock.calls.at(-1)[1]).toMatchObject(pending.body);
  expect(townStorage.active().profile.town.coins).toBe(6);
  expect(townStorage.active().meta.conflict.revision).toBe(3);
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(5);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(6);
  expect(townStorage.active().meta).toMatchObject({
    baseRevision: 3,
    dirty: false,
    conflict: null,
  });
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
  expect(townStorage.state().creation).toEqual({ owner: owner.id, body });
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

it('serializes two sync workers instead of replacing an unacknowledged upload', async () => {
  setupAccount();
  townStorage.save(profile(4));
  const pending = deferred();
  api.mockImplementation(async (_, body) => (body ? pending.promise : remote(1)));
  const other = createSyncService({ storage: townStorage, request: api, account: () => owner });
  const first = sync.sync(),
    second = other.sync({ pull: false });
  await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  const uploadId = townStorage.active().meta.pending.body.uploadId;
  pending.resolve(remote(2, 4));
  await Promise.all([first, second]);
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(1);
  expect(api.mock.calls[1][1].uploadId).toBe(uploadId);
  expect(townStorage.active().meta.pending).toBeNull();
});
it('does not permit a recovery overwrite review if a mine starts while it waits', async () => {
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 9));
  await sync.sync();
  const pending = deferred();
  api.mockReturnValue(pending.promise);
  const task = sync.reviewRecovery(townStorage.active().meta.id);
  await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  canApply.mockReturnValue(false);
  pending.resolve(remote(2, 9));
  await expect(task).rejects.toThrow('Return to the village');
  expect(townStorage.active().profile.town.coins).toBe(9);
});
it('persists history restoration for retry after a lost response', async () => {
  setupAccount();
  api.mockRejectedValue(new Error('lost response'));
  await expect(sync.restore(townStorage.active().meta.id, profile(40))).rejects.toThrow(
    'lost response',
  );
  const pending = townStorage.active().meta.pending;
  api.mockResolvedValue(remote(2, 40));
  await sync.sync();
  expect(api.mock.calls.at(-1)[1]).toMatchObject(pending.body);
  expect(townStorage.active().profile.town.coins).toBe(40);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(1);
});
it('does not download unchanged towns during automatic saves', async () => {
  setupAccount();
  await sync.sync({ pull: false });
  expect(api).not.toHaveBeenCalled();
});
it('keeps both local and cached progress when an old local town is attached again', () => {
  setupAccount();
  const id = townStorage.active().meta.id;
  townStorage.save(profile(90));
  townStorage.logout();
  townStorage.save(profile(12));
  townStorage.account(owner);
  expect(() => townStorage.attach(remote(1, 1, id), owner.id, 0)).toThrow(
    'already on your account',
  );
  expect(townStorage.active().profile.town.coins).toBe(12);
  expect(townStorage.get(id, owner.id).profile.town.coins).toBe(90);
});
it('does not acknowledge a replaced pending upload or erase its newer progress', async () => {
  setupAccount();
  townStorage.save(profile(4));
  const response = deferred();
  api.mockImplementation(async (_, body) => (body ? response.promise : remote(1)));
  const task = sync.sync();
  await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  townStorage.import(profile(50));
  response.resolve(remote(2, 4));
  await task;
  expect(townStorage.active().profile.town.coins).toBe(50);
  expect(townStorage.active().meta).toMatchObject({ baseRevision: 1, dirty: true });
});

it('replaces the whole village without combining spending, buildings or bonuses', async () => {
  setupAccount();
  const local = profile(25);
  local.town.buildings = { farm: 1 };
  local.powers = [{ id: 'tnt', quantity: 2 }];
  local.builderHammers = 3;
  townStorage.save(local);
  const cloud = remote(2, 25);
  cloud.profile.town.buildings = { home: 1 };
  cloud.profile.powers = [{ id: 'tnt', quantity: 1 }];
  cloud.profile.builderHammers = 0;
  api.mockResolvedValue(cloud);
  await sync.sync();
  expect(townStorage.active().profile).toEqual(cloud.profile);
  expect(backups.get(townStorage.active().meta.recovery.id).profile).toEqual(local);
  const id = townStorage.active().meta.id;
  const review = await sync.reviewRecovery(id);
  api.mockImplementation(async (_, body) => ({ ...remote(3), profile: body.profile }));
  await sync.overwriteRecovery(id, review);
  expect(townStorage.active().profile).toEqual(local);
  expect(backups.get(townStorage.active().meta.recovery.id).profile).toEqual(cloud.profile);
  expect(townStorage.active().meta.desyncNotice).toBe(false);
});

it('keeps offline progress playable and uploads it when the base revision is still current', async () => {
  setupAccount();
  townStorage.save(profile(30));
  api.mockRejectedValue(new Error('offline'));
  await expect(sync.sync()).rejects.toThrow('offline');
  townStorage.save(profile(40));
  expect(townStorage.active().profile.town.coins).toBe(40);
  expect(townStorage.active().meta.recovery).toBeUndefined();
  api.mockImplementation(async (_, body) =>
    body ? remote(2, body.profile.town.coins) : remote(1),
  );
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(40);
  expect(townStorage.active().meta).toMatchObject({ baseRevision: 2, dirty: false });
  expect(townStorage.active().meta.recovery).toBeUndefined();
});

it('defers a desync through a mine and preserves all local results before loading the latest server save', async () => {
  setupAccount();
  canApply.mockReturnValue(false);
  townStorage.save(profile(20));
  api.mockResolvedValue(remote(2, 50));
  await sync.sync();
  expect(townStorage.active().meta.conflict.revision).toBe(2);
  expect(townStorage.active().profile.town.coins).toBe(20);
  townStorage.save(profile(35));
  await sync.sync({ pull: false });
  expect(api).toHaveBeenCalledTimes(1);
  canApply.mockReturnValue(true);
  api.mockResolvedValue(remote(3, 60));
  await sync.sync({ pull: false });
  expect(townStorage.active().profile.town.coins).toBe(60);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(35);
  expect(townStorage.active().meta).toMatchObject({
    baseRevision: 3,
    conflict: null,
    dirty: false,
  });
  expect(applied).toHaveBeenCalledOnce();
});

it('preserves newer local changes when an in-flight upload receives a revision conflict', async () => {
  setupAccount();
  townStorage.save(profile(20));
  const response = deferred();
  api.mockImplementation(async (_, body) => (body ? response.promise : remote(1)));
  const task = sync.sync();
  await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  townStorage.save(profile(35));
  response.reject(
    Object.assign(new Error('conflict'), { status: 409, data: { cloud: remote(2, 50) } }),
  );
  await task;
  expect(townStorage.active().profile.town.coins).toBe(50);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(35);
  expect(townStorage.active().meta.pending).toBeNull();
});

it('keeps both versions after reload and requires a new review after local progress changes', async () => {
  setupAccount();
  townStorage.save(profile(20));
  api.mockResolvedValue(remote(2, 50));
  await sync.sync();
  const reopened = createSyncService({ storage: townStorage, request: api, account: () => owner });
  const id = townStorage.active().meta.id;
  const review = await reopened.reviewRecovery(id);
  expect(review.recovery.profile.town.coins).toBe(20);
  townStorage.save(profile(60));
  await expect(reopened.overwriteRecovery(id, review)).rejects.toThrow('Your save changed');
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(0);
  expect(townStorage.active().profile.town.coins).toBe(60);
});

it('keeps the original save intact if a recovery copy cannot be persisted', async () => {
  setupAccount();
  townStorage.save(profile(20));
  const saved = values.get(townStorage.selectedKey());
  api.mockResolvedValue(remote(2, 50));
  localStorage.setItem = () => {
    throw new Error('quota');
  };
  await expect(sync.sync()).rejects.toThrow('quota');
  expect(values.get(townStorage.selectedKey())).toBe(saved);
  expect(applied).not.toHaveBeenCalled();
});

it('rejects an older server response without discarding or re-uploading local progress', async () => {
  setupAccount();
  townStorage.save(profile(20));
  api.mockResolvedValue(remote(0, 50));
  await expect(sync.sync()).rejects.toThrow('older than this device');
  expect(townStorage.active().profile.town.coins).toBe(20);
  expect(townStorage.active().meta.baseRevision).toBe(1);
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(0);
});

it('does not confirm a preserved save after the account changed', async () => {
  setupAccount();
  townStorage.save(profile(20));
  api.mockResolvedValue(remote(2, 50));
  await sync.sync();
  const id = townStorage.active().meta.id;
  const review = await sync.reviewRecovery(id);
  owner = { id: 'another-owner' };
  townStorage.account(owner);
  await expect(sync.overwriteRecovery(id, review)).rejects.toThrow('Review this town again');
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(0);
});

it('archives consecutive conflicts and history replacements without erasing any preserved copy', async () => {
  setupAccount();
  townStorage.save(profile(10));
  api.mockResolvedValue(remote(2, 20));
  await sync.sync();
  const first = townStorage.active().meta.recovery.id;
  townStorage.mutate(townStorage.active().meta.id, owner.id, (r) => {
    r.meta.desyncNotice = false;
  });
  townStorage.save(profile(21));
  api.mockResolvedValue(remote(3, 30));
  await sync.sync();
  const second = townStorage.active().meta.recovery.id;
  api.mockResolvedValue(remote(4, 5));
  await sync.restore(townStorage.active().meta.id, profile(5));
  expect(backups.get(first).profile.town.coins).toBe(10);
  expect(backups.get(second).profile.town.coins).toBe(21);
  expect(backups.get(townStorage.active().meta.recovery.id).profile.town.coins).toBe(30);
  expect(townStorage.active().meta.recovery.profile).toBeUndefined();
  api.mockResolvedValue(remote(4, 5));
  const review = await sync.reviewRecovery(townStorage.active().meta.id, first);
  expect(review.recovery.profile.town.coins).toBe(10);
  api.mockResolvedValue(remote(5, 10));
  await sync.overwriteRecovery(townStorage.active().meta.id, review);
  expect(townStorage.active().profile.town.coins).toBe(10);
  expect(backups.get(second).profile.town.coins).toBe(21);
});
it('preserves gameplay accepted while an archive transaction is still committing', async () => {
  const { recoveryStore } = await import('../src/services/recoveryStore');
  const saved = deferred();
  recoveryStore.put.mockImplementationOnce(async (value) => {
    backups.set(value.id, structuredClone(value));
    await saved.promise;
  });
  setupAccount();
  townStorage.save(profile(10));
  api.mockResolvedValue(remote(2, 20));
  const task = sync.sync();
  await vi.waitFor(() => expect(backups.size).toBe(1));
  townStorage.save(profile(11));
  saved.resolve();
  await task;
  expect(townStorage.active().profile.town.coins).toBe(11);
  expect(townStorage.active().meta.conflict.revision).toBe(2);
  await sync.sync();
  expect([...backups.values()].map((b) => b.profile.town.coins)).toEqual([10, 11]);
  expect(townStorage.active().profile.town.coins).toBe(20);
});
it('keeps current progress when the archive is unavailable', async () => {
  const { recoveryStore } = await import('../src/services/recoveryStore');
  recoveryStore.put.mockRejectedValueOnce(new Error('archive unavailable'));
  setupAccount();
  townStorage.save(profile(10));
  api.mockResolvedValue(remote(2, 20));
  await expect(sync.sync()).rejects.toThrow('archive unavailable');
  expect(townStorage.active().profile.town.coins).toBe(10);
  expect(townStorage.active().meta.dirty).toBe(true);
  expect(applied).not.toHaveBeenCalled();
});
it.each([413, 422])(
  'stops retrying a rejected HTTP %s snapshot and can upload newer progress',
  async (status) => {
    setupAccount();
    townStorage.save(profile(10));
    api.mockImplementation(async (_, body) => {
      if (body) throw Object.assign(new Error('Rejected save'), { status });
      return remote(1);
    });
    await expect(sync.sync()).rejects.toMatchObject({ status });
    expect(townStorage.active().meta.pending).toBeNull();
    expect(townStorage.active().meta.uploadError.status).toBe(status);
    const calls = api.mock.calls.length;
    await sync.sync();
    // Only a read for a newer cloud save; the rejected snapshot is not resent.
    expect(api.mock.calls.slice(calls).every(([, body]) => !body)).toBe(true);
    townStorage.save(profile(11));
    api.mockImplementation(async (_, body) =>
      body ? remote(2, body.profile.town.coins) : remote(1),
    );
    await sync.sync();
    expect(townStorage.active().meta.dirty).toBe(false);
    expect(townStorage.active().meta.uploadError).toBeNull();
    expect(api.mock.calls.at(-1)[1].profile.town.coins).toBe(11);
  },
);
it('does not repeatedly submit an unsupported format as the player continues offline', async () => {
  setupAccount();
  townStorage.save(profile(10));
  api.mockImplementation(async (_, body) => {
    if (body)
      throw Object.assign(new Error('Needs an upgrade'), {
        status: 422,
        data: { code: 'save_format_unsupported' },
      });
    return remote(1);
  });
  await expect(sync.sync()).rejects.toThrow('Needs an upgrade');
  const calls = api.mock.calls.length;
  townStorage.save(profile(11));
  await sync.sync();
  expect(api.mock.calls.slice(calls).every(([, body]) => !body)).toBe(true);
  expect(townStorage.active().profile.town.coins).toBe(11);
});
it('refreshes metadata at an unchanged gameplay revision without replacing local progress', async () => {
  setupAccount();
  townStorage.save(profile(8));
  api.mockImplementation(async (_, body) => ({
    ...remote(body ? 2 : 1, body ? body.profile.town.coins : 1),
    name: 'Renamed Town',
    isPublic: true,
  }));
  await sync.sync();
  expect(townStorage.active().profile.town.coins).toBe(8);
  expect(townStorage.active().meta.name).toBe('Renamed Town');
  expect(townStorage.active().meta.isPublic).toBe(true);
  expect(backups.size).toBe(0);
});

it('keeps immutable upload snapshots out of localStorage and retries them after reload', async () => {
  setupAccount();
  townStorage.save(profile(40));
  api.mockImplementation(async (_, body) => {
    if (body) throw new Error('lost response');
    return remote(1);
  });
  await expect(sync.sync()).rejects.toThrow('lost response');
  const pending = townStorage.active().meta.pending;
  expect(pending.snapshot).toBe(true);
  expect(pending.body.profile).toBeUndefined();
  expect(outbox.get(pending.body.uploadId).profile.town.coins).toBe(40);
  townStorage.save(profile(42));
  const reopened = createSyncService({ storage: townStorage, request: api, account: () => owner });
  api.mockResolvedValue(remote(2, 40));
  await reopened.sync();
  expect(api.mock.calls.at(-1)[1].profile.town.coins).toBe(40);
  expect(townStorage.active().profile.town.coins).toBe(42);
  expect(townStorage.active().meta.dirty).toBe(true);
  expect(outbox.size).toBe(0);
});
it('recovers from an unavailable upload snapshot without permanently blocking the town', async () => {
  setupAccount();
  townStorage.save(profile(40));
  api.mockImplementation(async (_, body) => {
    if (body) throw new Error('offline');
    return remote(1);
  });
  await expect(sync.sync()).rejects.toThrow('offline');
  outbox.clear();
  await sync.sync();
  expect(townStorage.active().meta.pending).toBeNull();
  expect(townStorage.active().meta.uploadError.message).toContain('pending upload');
  expect(townStorage.active().profile.town.coins).toBe(40);
  townStorage.mutate(townStorage.active().meta.id, owner.id, (r) => {
    r.meta.uploadError = null;
  });
  api.mockImplementation(async (_, body) =>
    body ? remote(2, body.profile.town.coins) : remote(1),
  );
  await sync.sync();
  expect(townStorage.active().meta.dirty).toBe(false);
});
it('does not stage or upload progress when durable upload storage fails', async () => {
  const { recoveryStore } = await import('../src/services/recoveryStore');
  recoveryStore.putUpload.mockRejectedValueOnce(new Error('archive unavailable'));
  setupAccount();
  townStorage.save(profile(40));
  api.mockResolvedValue(remote(1));
  await expect(sync.sync()).rejects.toThrow('archive unavailable');
  expect(townStorage.active().meta.pending).toBeNull();
  expect(townStorage.active().profile.town.coins).toBe(40);
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(0);
});
it('requires a fresh confirmation if progress changes while a replacement is being staged', async () => {
  const { recoveryStore } = await import('../src/services/recoveryStore');
  setupAccount();
  townStorage.save(profile(5));
  api.mockResolvedValue(remote(2, 10));
  await sync.sync();
  const id = townStorage.active().meta.id,
    review = await sync.reviewRecovery(id),
    staged = deferred();
  recoveryStore.putUpload.mockImplementationOnce(async (value) => {
    outbox.set(value.id, value);
    await staged.promise;
  });
  const replacing = sync.overwriteRecovery(id, review);
  await vi.waitFor(() => expect(outbox.size).toBe(1));
  townStorage.save(profile(11));
  staged.resolve();
  await expect(replacing).rejects.toThrow('Your save changed');
  expect(townStorage.active().profile.town.coins).toBe(11);
  expect(api.mock.calls.filter(([, body]) => body)).toHaveLength(0);
  expect(outbox.size).toBe(0);
});
