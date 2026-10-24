import { afterEach, expect, it, vi } from 'vitest';
import { createTownStorage } from '../src/services/townStorage';
import { backgroundJson } from '../src/services/backgroundJson';
afterEach(() => vi.restoreAllMocks());
function setup() {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const towns = createTownStorage({
    storage: () => storage,
    session: () => null,
    changed: () => {},
  });
  towns.save({ town: { coins: 1 } });
  towns.account({ id: 'owner' });
  const id = towns.activeMeta().id;
  towns.attach({ townId: id, name: 'Town', revision: 1 }, 'owner', 0);
  return { towns, id, storage };
}
it('retries a worker commit against new gameplay rather than overwriting it', async () => {
  const { towns, id } = setup();
  const stringify = backgroundJson.stringify.bind(backgroundJson);
  let resume;
  vi.spyOn(backgroundJson, 'stringify')
    .mockImplementationOnce(
      (value) =>
        new Promise((resolve) => {
          resume = () => resolve(JSON.stringify(value));
        }),
    )
    .mockImplementation(stringify);
  const update = towns.mutateAsync(id, 'owner', (r) => {
    r.meta.cloudAt = 900;
  });
  await vi.waitFor(() => expect(resume).toBeTypeOf('function'));
  towns.save({ town: { coins: 20 } });
  resume();
  expect(await update).toBe(true);
  expect(towns.active()).toMatchObject({
    profile: { town: { coins: 20 } },
    meta: { cloudAt: 900, dirty: true },
  });
});
it('discards worker results after the same account signs in again', async () => {
  const { towns, id } = setup();
  let resume;
  vi.spyOn(backgroundJson, 'stringify').mockImplementationOnce(
    (value) =>
      new Promise((resolve) => {
        resume = () => resolve(JSON.stringify(value));
      }),
  );
  const update = towns.mutateAsync(id, 'owner', (r) => {
    r.profile.town.coins = 99;
  });
  await vi.waitFor(() => expect(resume).toBeTypeOf('function'));
  towns.account({ id: 'owner' }, true);
  resume();
  expect(await update).toBe(false);
  expect(towns.active().profile.town.coins).toBe(1);
});
it('makes metadata available to save notifications without parsing the serialized profile', () => {
  const { towns } = setup();
  const parse = vi.spyOn(JSON, 'parse');
  towns.save({ town: { coins: 2 } });
  parse.mockClear();
  expect(towns.activeMeta().owner).toBe('owner');
  expect(towns.activeMeta().dirty).toBe(true);
  expect(parse).not.toHaveBeenCalled();
});
it('avoids large metadata reads in the browser and invalidates them for another tab', () => {
  const { towns, storage, id } = setup();
  const target = new EventTarget(),
    stop = towns.observeMetadata(target);
  const get = vi.spyOn(storage, 'getItem');
  expect(towns.activeMeta().id).toBe(id);
  expect(get.mock.calls.some(([key]) => key.startsWith('prospect-town-v2:'))).toBe(false);
  const key = towns.selectedKey(),
    root = JSON.parse(storage.getItem(key));
  root._cloud.active.name = 'Changed elsewhere';
  storage.setItem(key, JSON.stringify(root));
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: key });
  target.dispatchEvent(event);
  expect(towns.activeMeta().name).toBe('Changed elsewhere');
  stop();
});
it('keeps observed metadata and the durable save unchanged when a write fails', () => {
  const { towns, storage, id } = setup(),
    stop = towns.observeMetadata(new EventTarget());
  const before = towns.activeMeta();
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(() =>
    towns.mutate(id, 'owner', (r) => {
      r.meta.name = 'Unstored';
    }),
  ).toThrow('Quota exceeded');
  expect(towns.activeMeta()).toBe(before);
  expect(towns.activeMeta().name).not.toBe('Unstored');
  stop();
});
it('retries a stale no-op decision after gameplay changes while the worker parses', async () => {
  const { towns, id } = setup(),
    parse = backgroundJson.parse.bind(backgroundJson);
  let resume;
  vi.spyOn(backgroundJson, 'parse')
    .mockImplementationOnce(
      (text) =>
        new Promise((resolve) => {
          resume = () => resolve(JSON.parse(text));
        }),
    )
    .mockImplementation(parse);
  const update = towns.mutateAsync(id, 'owner', (r) => {
    if (r.profile.town.coins === 1) return false;
    r.meta.cloudAt = 42;
  });
  await vi.waitFor(() => expect(resume).toBeTypeOf('function'));
  towns.save({ town: { coins: 20 } });
  resume();
  expect(await update).toBe(true);
  expect(towns.activeMeta().cloudAt).toBe(42);
});
