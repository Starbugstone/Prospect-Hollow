import { expect, it } from 'vitest';
import { createTownStorage, SAVE_KEY, townKey } from '../src/services/townStorage';
import { createTownCoordinator } from '../src/services/townCoordinator';
function memory() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
}
function browserLocks() {
  const held = new Set();
  return {
    async request(name, options, callback) {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };
}
const profile = (coins) => ({ schemaVersion: 2, town: { coins } });
const remote = (townId, coins) => ({ townId, name: townId, revision: 1, profile: profile(coins) });
it('keeps selection and atomic saves independent for two account towns', () => {
  const shared = memory();
  const tab = () => {
    const session = memory();
    return createTownStorage({ storage: () => shared, session: () => session });
  };
  const a = tab(),
    b = tab();
  a.save(profile(1));
  a.account({ id: 'user' });
  a.remember(remote('town-a', 10), 'user');
  b.remember(remote('town-b', 20), 'user');
  a.select('town-a', 'user');
  b.select('town-b', 'user');
  const beforeB = shared.getItem(townKey('town-b', 'user'));
  a.save(profile(11));
  expect(shared.getItem(townKey('town-b', 'user'))).toBe(beforeB);
  b.save(profile(21));
  expect(a.active().profile.town.coins).toBe(11);
  expect(b.active().profile.town.coins).toBe(21);
  expect(a.active().meta.id).toBe('town-a');
  expect(b.active().meta.id).toBe('town-b');
  b.logout();
  expect(a.active().meta.owner).toBeNull();
  expect(b.active().meta.owner).toBeNull();
  expect(a.records('user')).toHaveLength(2);
  expect(a.active().profile.town.coins).toBe(1);
});
it('migrates combined saves without losing any pending uploads or guest progress', () => {
  const shared = memory(),
    session = memory();
  const meta = (id, owner) => ({
    id,
    owner,
    sequence: 4,
    pending: { body: { uploadId: 'retry-me' } },
  });
  const legacy = {
    ...profile(30),
    _cloud: {
      version: 1,
      active: meta('town-a', 'user'),
      account: { id: 'user' },
      slots: { b: { profile: profile(20), meta: meta('town-b', 'user') } },
      local: { profile: profile(10), meta: meta('local', null) },
    },
  };
  shared.setItem(SAVE_KEY, JSON.stringify(legacy));
  const a = createTownStorage({ storage: () => shared, session: () => session });
  const original = shared.setItem;
  shared.setItem = (key, value) => {
    if (key === SAVE_KEY) throw new Error('quota');
    original(key, value);
  };
  expect(() => a.initialize()).toThrow('quota');
  expect(JSON.parse(shared.getItem(SAVE_KEY))).toEqual(legacy);
  shared.setItem = original;
  a.initialize();
  expect(a.active().profile.town.coins).toBe(30);
  expect(a.active().meta.pending.body.uploadId).toBe('retry-me');
  expect(
    a
      .records('user')
      .map((r) => r.profile.town.coins)
      .sort(),
  ).toEqual([20, 30]);
  a.logout();
  expect(a.active().profile.town.coins).toBe(10);
});
it('locks the same town while allowing another town and releases without polling', async () => {
  const locks = browserLocks(),
    a = createTownCoordinator(locks),
    b = createTownCoordinator(locks);
  expect(await a.acquire('town-a')).toBe(true);
  expect(await b.acquire('town-a')).toBe(false);
  expect(await b.acquire('town-b')).toBe(true);
  await expect(b.run('town-a', () => {})).rejects.toThrow('another tab');
  await a.release();
  await b.release();
  expect(await b.acquire('town-a')).toBe(true);
  await b.release();
});
it('serializes writes and holds ownership until an in-flight operation finishes', async () => {
  const locks = browserLocks(),
    a = createTownCoordinator(locks),
    b = createTownCoordinator(locks);
  await a.acquire('town-a');
  let finish;
  const order = [];
  const first = a.run('town-a', async () => {
    order.push(1);
    await new Promise((resolve) => {
      finish = resolve;
    });
  });
  const second = a.run('town-a', () => order.push(2));
  await Promise.resolve();
  await Promise.resolve();
  const released = a.release();
  expect(await b.acquire('town-a')).toBe(false);
  finish();
  await Promise.all([first, second, released]);
  expect(order).toEqual([1, 2]);
  expect(await b.acquire('town-a')).toBe(true);
  await b.release();
});
it('refuses unsafe saves when this tab does not own the selected town', () => {
  const shared = memory(),
    a = createTownStorage({ storage: () => shared, session: () => memory() });
  a.save(profile(2));
  a.setWriteGuard(() => false);
  expect(() => a.save(profile(90))).toThrow('another tab');
  expect(a.active().profile.town.coins).toBe(2);
});
