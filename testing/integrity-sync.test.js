import { beforeEach, expect, it, vi } from 'vitest';
import { SAVE_KEY, createTownStorage, progressKey } from '../src/services/townStorage';
import { createSyncService } from '../src/services/syncService';
import { createHonours } from '../src/data/honours';
import {
  GUEST_JOURNAL_LIMIT,
  appendIntegrityAction,
  createIntegrity,
} from '../src/services/saveIntegrity';

const memory = () => {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const copy = (value) => structuredClone(value);
const owner = { id: 'integrity-owner' };
let storage, request, service, uploads, preserved, remote;

function advance() {
  const next = storage.active().profile;
  next.town.coins++;
  next.integrity = appendIntegrityAction(next.integrity, 'vip-spend', {
    key: crypto.randomUUID(),
    building: 'saloon',
    at: Date.now(),
  });
  storage.save(next);
}

function accepted(body) {
  const sequence =
    body.profile.integrity.actions.at(-1)?.sequence ?? body.profile.integrity.baseSequence;
  const integrity = { ...body.profile.integrity, baseSequence: sequence, actions: [] };
  return {
    ...remote,
    revision: remote.revision + 1,
    profile: { ...body.profile, integrity },
    integrity: { version: 1, epoch: integrity.epoch, ackSequence: sequence, status: 'tracked' },
  };
}

beforeEach(() => {
  const local = memory();
  const session = memory();
  storage = createTownStorage({ storage: () => local, session: () => session, changed: () => {} });
  storage.save({
    schemaVersion: 2,
    records: {},
    continuousRecords: {},
    powers: [],
    town: { era: 'frontier', buildings: {}, coins: 10 },
    integrity: createIntegrity(),
  });
  storage.account(owner);
  remote = {
    townId: storage.active().meta.id,
    name: 'Receipt Creek',
    revision: 1,
    updatedAt: 100,
    profile: storage.active().profile,
    isPublic: false,
    publicId: 'receipt-town',
  };
  storage.attach(remote, owner.id, storage.active().meta.sequence);
  uploads = new Map();
  preserved = new Map();
  request = vi.fn(async (_path, body) => {
    if (body) remote = accepted(body);
    return copy(remote);
  });
  service = createSyncService({
    storage,
    request,
    account: () => owner,
    recoveries: {
      put: async (value) => preserved.set(value.id, copy(value)),
      putUpload: async (value) => uploads.set(value.id, copy(value)),
      getUpload: async (id) => copy(uploads.get(id)),
      removeUpload: async (id) => uploads.delete(id),
    },
  });
});

it('acknowledges only the uploaded prefix while later offline actions and earnings remain dirty', async () => {
  advance();
  request.mockImplementation(async (_path, body) => {
    if (!body) return copy(remote);
    advance();
    return accepted(body);
  });
  await service.sync();
  const local = storage.active();
  expect(local.profile.town.coins).toBe(12);
  expect(local.profile.integrity.baseSequence).toBe(1);
  expect(local.profile.integrity.actions.map((action) => action.sequence)).toEqual([2]);
  expect(local.meta.dirty).toBe(true);
  expect(local.meta.baseRevision).toBe(2);
  expect(uploads.size).toBe(0);
});

it('retries the identical staged timestamp and actions after an acknowledgment is lost', async () => {
  advance();
  request.mockImplementation(async (_path, body) => {
    if (!body) return copy(remote);
    throw new Error('connection interrupted');
  });
  await expect(service.sync()).rejects.toThrow('connection interrupted');
  const sent = copy(request.mock.calls.at(-1)[1]);
  advance();
  request.mockImplementation(async (_path, body) => accepted(body));
  await service.sync();
  expect(request.mock.calls.at(-1)[1]).toEqual(sent);
  expect(storage.active().profile.town.coins).toBe(12);
  expect(storage.active().profile.integrity.actions.map((action) => action.sequence)).toEqual([2]);
  expect(storage.active().meta.dirty).toBe(true);
});

it('keeps progress and queued actions after a validation error without repeatedly resending it', async () => {
  advance();
  request.mockImplementation(async (_path, body) => {
    if (!body) return copy(remote);
    throw Object.assign(new Error('Your local save is kept.'), {
      status: 422,
      data: { code: 'save_integrity_mismatch' },
    });
  });
  await expect(service.sync()).rejects.toThrow('Your local save is kept.');
  const local = storage.active();
  expect(local.profile.town.coins).toBe(11);
  expect(local.profile.integrity.actions).toHaveLength(1);
  expect(local.meta.pending).toBeNull();
  expect(local.meta.uploadError.code).toBe('save_integrity_mismatch');
  request.mockClear();
  await service.sync();
  expect(request).not.toHaveBeenCalled();
});

it.each(['sequence', 'epoch'])(
  'retains an immutable retry when the server acknowledgment has an invalid %s',
  async (field) => {
    advance();
    request.mockImplementation(async (_path, body) => {
      if (!body) return copy(remote);
      const result = accepted(body);
      if (field === 'sequence') result.integrity.ackSequence++;
      else result.integrity.epoch = crypto.randomUUID();
      return result;
    });
    await expect(service.sync()).rejects.toThrow('invalid save receipt');
    const local = storage.active();
    expect(local.profile.town.coins).toBe(11);
    expect(local.profile.integrity.baseSequence).toBe(0);
    expect(local.profile.integrity.actions).toHaveLength(1);
    expect(local.meta.pending).not.toBeNull();
    expect(local.meta.baseRevision).toBe(1);
    expect(uploads.size).toBe(1);
  },
);

it.each(['save_rules_unsupported', 'save_integrity_unsupported'])(
  'waits for an explicit retry after %s while keeping new offline progress',
  async (code) => {
    advance();
    request.mockImplementation(async (_path, body) => {
      if (!body) return copy(remote);
      throw Object.assign(new Error('Compatible rules are needed. Your local save is kept.'), {
        status: 422,
        data: { code },
      });
    });
    await expect(service.sync()).rejects.toThrow('Compatible rules');
    advance();
    request.mockClear();
    await service.sync();
    expect(request).not.toHaveBeenCalled();
    expect(storage.active().profile.town.coins).toBe(12);
    expect(storage.active().profile.integrity.actions).toHaveLength(2);
    storage.mutate(storage.active().meta.id, owner.id, (record) => {
      record.meta.uploadError = null;
    });
    request.mockImplementation(async (_path, body) => (body ? accepted(body) : copy(remote)));
    await service.sync();
    expect(storage.active().profile.integrity.actions).toEqual([]);
    expect(storage.active().meta.dirty).toBe(false);
  },
);

it('does not turn receipt acknowledgment bookkeeping into gameplay changes or idle uploads', async () => {
  advance();
  const before = storage.active().profile;
  await service.sync();
  const local = storage.active();
  expect(local.profile.integrity.actions).toEqual([]);
  expect(local.profile.integrity.baseSequence).toBe(1);
  expect(progressKey(local.profile)).toBe(progressKey(before));
  storage.save({
    ...local.profile,
    integrity: { ...local.profile.integrity, clientAt: Date.now() },
  });
  expect(storage.active().meta.dirty).toBe(false);
  request.mockClear();
  await service.sync({ pull: false });
  expect(request).not.toHaveBeenCalled();
});

it('acknowledges attachment without discarding progress made while the request was in flight', () => {
  const local = memory();
  const session = memory();
  storage = createTownStorage({ storage: () => local, session: () => session, changed: () => {} });
  storage.save(copy(remote.profile));
  advance();
  const submitted = storage.active();
  const body = { profile: submitted.profile };
  advance();
  storage.account(owner);
  storage.attach(
    { ...accepted(body), townId: submitted.meta.id },
    owner.id,
    submitted.meta.sequence,
  );
  expect(storage.active().profile.town.coins).toBe(12);
  expect(storage.active().profile.integrity.baseSequence).toBe(1);
  expect(storage.active().profile.integrity.actions.map((action) => action.sequence)).toEqual([2]);
  expect(storage.active().meta.dirty).toBe(true);
});

it('routes an older signed file backup into an advanced owned town through resolve', async () => {
  const backup = copy(remote.profile);
  backup.integrity.checkpoint = 'signed-old-checkpoint';
  advance();
  await service.sync();
  expect(storage.active().profile.integrity.baseSequence).toBe(1);
  expect(remote.profile.town.coins).toBe(11);

  storage.import(backup, { id: remote.townId, name: remote.name });
  expect(storage.active().meta.restoreIntent).toBeTruthy();
  request.mockClear();
  await service.sync();

  const [path, submitted] = request.mock.calls.at(-1);
  expect(path).toBe(`towns/${remote.townId}/resolve`);
  expect(submitted.baseRevision).toBe(2);
  expect(submitted.profile.integrity.checkpoint).toBe('signed-old-checkpoint');
  expect(submitted.profile.town.coins).toBe(10);
  expect(storage.active().profile.town.coins).toBe(10);
  expect(storage.active().meta.baseRevision).toBe(3);
  expect(storage.active().meta.restoreIntent).toBeUndefined();
  expect(storage.active().meta.dirty).toBe(false);
});

it('retries a file restore exactly after a lost acknowledgment and retains later gameplay', async () => {
  const backup = copy(remote.profile);
  backup.integrity.checkpoint = 'signed-old-checkpoint';
  advance();
  await service.sync();
  storage.import(backup, { id: remote.townId });
  const intent = storage.active().meta.restoreIntent;
  let restored;
  request.mockImplementation(async (_path, body) => {
    if (!body) return copy(remote);
    restored = accepted(body);
    remote = copy(restored);
    advance();
    throw new Error('restore acknowledgment lost');
  });
  await expect(service.sync()).rejects.toThrow('restore acknowledgment lost');
  const [path, submitted] = copy(request.mock.calls.at(-1));
  expect(path).toBe(`towns/${remote.townId}/resolve`);
  expect(storage.active().meta.restoreIntent).toBe(intent);
  expect(storage.active().meta.pending.resolve).toBe(true);
  advance();
  request.mockImplementation(async () => copy(restored));
  await service.sync();

  expect(request.mock.calls.at(-1)).toEqual([path, submitted, 'PUT']);
  expect(storage.active().profile.town.coins).toBe(12);
  expect(storage.active().profile.integrity.actions.map((action) => action.sequence)).toEqual([
    1, 2,
  ]);
  expect(storage.active().meta.restoreIntent).toBeUndefined();
  expect(storage.active().meta.dirty).toBe(true);
  expect(uploads.size).toBe(0);
});

it('keeps an edited imported backup local and retains restore intent after server rejection', async () => {
  const backup = copy(remote.profile);
  backup.integrity.checkpoint = 'signed-old-checkpoint';
  advance();
  await service.sync();
  const cloud = copy(remote);
  backup.town.coins = 999999;
  storage.import(backup, { id: remote.townId });
  const intent = storage.active().meta.restoreIntent;
  request.mockImplementation(async (_path, body) => {
    if (!body) return copy(remote);
    throw Object.assign(
      new Error('The imported save could not be verified. Your local save is kept.'),
      {
        status: 422,
        data: { code: 'save_integrity_mismatch' },
      },
    );
  });
  await expect(service.sync()).rejects.toThrow('could not be verified');

  expect(request.mock.calls.at(-1)[0]).toBe(`towns/${remote.townId}/resolve`);
  expect(remote).toEqual(cloud);
  expect(storage.active().profile).toEqual(backup);
  expect(storage.active().meta.restoreIntent).toBe(intent);
  expect(storage.active().meta.pending).toBeNull();
  advance();
  expect(storage.active().meta.restoreIntent).toBe(intent);
  await expect(service.sync()).rejects.toThrow('could not be verified');
  expect(request.mock.calls.at(-1)[0]).toBe(`towns/${remote.townId}/resolve`);
  expect(remote).toEqual(cloud);
});

it('rejects another town backup before changing the current town or its restore intent', () => {
  const before = storage.active();
  expect(() => storage.import(copy(remote.profile), { id: crypto.randomUUID() })).toThrow(
    'belongs to another town',
  );
  expect(storage.active()).toEqual(before);
});

it('clears file restore intent when newer cloud progress replaces the selected snapshot', async () => {
  storage.import(copy(remote.profile), { id: remote.townId });
  const imported = copy(storage.active().profile);
  remote = { ...remote, revision: 2, profile: { ...remote.profile, town: { coins: 12 } } };
  await service.sync();
  expect(storage.active().profile).toEqual(remote.profile);
  expect(storage.active().meta.restoreIntent).toBeUndefined();
  expect(storage.active().meta.dirty).toBe(false);
  expect([...preserved.values()][0].profile).toEqual(imported);
  expect(request.mock.calls.every(([, body]) => !body)).toBe(true);
});

it('keeps every receipt of an account town and of a guest town being attached', () => {
  for (let i = 0; i <= GUEST_JOURNAL_LIMIT; i++) advance();
  expect(storage.active().profile.integrity.actions).toHaveLength(GUEST_JOURNAL_LIMIT + 1);
  const local = memory();
  const session = memory();
  storage = createTownStorage({ storage: () => local, session: () => session, changed: () => {} });
  storage.save(copy(remote.profile));
  storage.attachment({ profile: storage.active().profile }, storage.active().meta.sequence);
  for (let i = 0; i <= GUEST_JOURNAL_LIMIT; i++) advance();
  expect(storage.active().meta.owner).toBe(null);
  expect(storage.active().profile.integrity.actions).toHaveLength(GUEST_JOURNAL_LIMIT + 1);
  // Once attached, the retained guest copy shares the sealed journal and keeps it.
  storage.account(owner);
  const sealed = {
    ...accepted({ profile: storage.active().profile }),
    townId: storage.active().meta.id,
  };
  sealed.integrity.checkpoint = 'signed-server-checkpoint';
  storage.attach(sealed, owner.id, storage.active().meta.sequence);
  const guest = JSON.parse(local.getItem(SAVE_KEY));
  expect(guest.integrity.checkpoint).toBe('signed-server-checkpoint');
  storage.logout();
  advance();
  expect(storage.active().meta.owner).toBe(null);
  expect(storage.active().profile.integrity.actions).toHaveLength(1);
  expect(storage.active().profile.integrity.baseSequence).toBe(GUEST_JOURNAL_LIMIT + 1);
});

it('keeps a showcase cleared on another device when downloading the newer cloud copy', async () => {
  const honours = { ...createHonours(), showcase: ['stars'] };
  storage.save({ ...storage.active().profile, honours });
  await service.sync();
  expect(remote.profile.honours.showcase).toEqual(['stars']);
  expect(storage.active().meta.dirty).toBe(false);
  // Another device clears its last showcased honour and uploads first.
  const cleared = { ...remote.profile, honours: { ...honours, showcase: [] } };
  remote = { ...remote, revision: remote.revision + 1, profile: cleared };
  await service.sync();
  expect(storage.active().profile.honours.showcase).toEqual([]);
  expect(storage.active().meta.dirty).toBe(false);
  expect(request.mock.calls.at(-1)[1]).toBeUndefined();
});
