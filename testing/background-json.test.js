import { afterEach, expect, it, vi } from 'vitest';
import { createBackgroundJson } from '../src/services/backgroundJson';
import {
  createJsonWorkerHandler,
  RECEIPTS_PER_MESSAGE,
} from '../src/services/backgroundJsonProtocol';
afterEach(() => vi.unstubAllGlobals());
const sample = () => ({
  profile: {
    schemaVersion: 2,
    town: { coins: 9 },
    integrity: {
      version: 1,
      actions: Array.from({ length: 31 }, (_, i) => ({
        sequence: i + 1,
        data: { board: [i, null, 'opal'] },
      })),
    },
  },
});
function worker(operations = {}) {
  const sent = [];
  const fake = {
    sent,
    postMessage: vi.fn((message) => {
      sent.push(structuredClone(message));
      setTimeout(() => handle(structuredClone(message)), 0);
    }),
    terminate: vi.fn(),
  };
  const handle = createJsonWorkerHandler(
    (data) => setTimeout(() => fake.onmessage({ data: structuredClone(data) }), 0),
    operations,
  );
  return fake;
}
it('round-trips save journals in bounded worker messages without changing JSON or input', async () => {
  const fake = worker(),
    codec = createBackgroundJson(() => fake),
    value = sample(),
    expected = JSON.stringify(value);
  expect(await codec.stringify(value)).toBe(expected);
  expect(value.profile.integrity.actions).toHaveLength(31);
  expect(await codec.parse(expected)).toEqual(value);
  expect(fake.sent.filter((m) => m.type === 'actions').map((m) => m.value.length)).toEqual([
    8, 8, 8, 7,
  ]);
  expect(RECEIPTS_PER_MESSAGE).toBe(8);
});
it('routes concurrent replies and preserves null/false JSON values and parse errors', async () => {
  const codec = createBackgroundJson(worker);
  expect(
    await Promise.all([codec.parse('null'), codec.parse('false'), codec.stringify(sample())]),
  ).toEqual([null, false, JSON.stringify(sample())]);
  await expect(codec.parse('{broken')).rejects.toMatchObject({ name: 'SyntaxError' });
});
it('keeps synchronous JSON semantics without Worker, including unavailable WebViews', async () => {
  const codec = createBackgroundJson(() => {
    throw new Error('Worker blocked');
  });
  const value = sample();
  value.optional = undefined;
  expect(await codec.stringify(value)).toBe(JSON.stringify(value));
  expect(await codec.parse('null')).toBeNull();
  await expect(codec.parse('{broken')).rejects.toBeInstanceOf(SyntaxError);
  const fallback = vi.fn(async () => ({ durable: true }));
  expect(await codec.run('putUpload', value, fallback)).toEqual({ durable: true });
  expect(fallback).toHaveBeenCalledOnce();
});
it('falls back after a worker loading failure without leaving a pending operation', async () => {
  const fake = {
    postMessage() {
      setTimeout(() => this.onerror(), 0);
    },
    terminate: vi.fn(),
  };
  const codec = createBackgroundJson(() => fake);
  expect(await codec.stringify({ town: { coins: 3 } })).toBe('{"town":{"coins":3}}');
  expect(await codec.parse('7')).toBe(7);
  expect(fake.terminate).toHaveBeenCalledOnce();
});
it('reuses immutable worker journals without cloning the same receipts back to the worker', async () => {
  const fake = worker(),
    codec = createBackgroundJson(() => fake),
    value = sample();
  const parsed = await codec.parse(JSON.stringify(value));
  expect(Object.isFrozen(parsed.profile.integrity.actions)).toBe(true);
  expect(() => {
    parsed.profile.integrity.actions[0].data.board[0] = 100;
  }).toThrow();
  const before = fake.sent.length;
  expect(await codec.stringify(parsed)).toBe(JSON.stringify(value));
  const sent = fake.sent.slice(before);
  expect(sent.filter((m) => m.type === 'actions')).toHaveLength(0);
  expect(sent.find((m) => m.type === 'start').journal).toBeTypeOf('number');
});
it('keeps concurrent parse/serialize jobs correct when older cached journals are evicted', async () => {
  const codec = createBackgroundJson(worker),
    text = JSON.stringify(sample());
  const results = await Promise.all(
    Array.from({ length: 5 }, () => codec.parse(text).then((value) => codec.stringify(value))),
  );
  expect(results).toEqual(Array(5).fill(text));
});
it('propagates worker operation failures without retrying network/storage work on the main thread', async () => {
  const fake = {
    postMessage(message) {
      if (message.type !== 'cancel')
        setTimeout(
          () =>
            this.onmessage({
              data: {
                id: message.id,
                type: 'error',
                name: 'TypeError',
                message: 'Network unavailable',
              },
            }),
          0,
        );
    },
  };
  const codec = createBackgroundJson(() => fake),
    fallback = vi.fn();
  await expect(codec.run('fetchText', { url: 'https://example.test' }, fallback)).rejects.toThrow(
    'Network unavailable',
  );
  expect(fallback).not.toHaveBeenCalled();
});
it('does not replay a network request after a worker crash with an unknown server outcome', async () => {
  const fake = {
    postMessage(message) {
      if (message.type !== 'cancel') setTimeout(() => this.onerror(), 0);
    },
    terminate: vi.fn(),
  };
  const codec = createBackgroundJson(() => fake),
    fallback = vi.fn(async () => ({ ok: true }));
  await expect(codec.run('fetchText', { url: 'https://example.test' }, fallback)).rejects.toThrow(
    'unavailable',
  );
  expect(fallback).not.toHaveBeenCalled();
  expect(await codec.run('fetchText', { url: 'https://example.test' }, fallback)).toEqual({
    ok: true,
  });
});
it('runs each durable worker operation once even when journal references expire during concurrent jobs', async () => {
  const put = vi.fn(async (value) => value.id),
    fake = worker({ putUpload: put }),
    codec = createBackgroundJson(() => fake),
    text = JSON.stringify(sample());
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, id) =>
      codec.parse(text).then((value) => codec.run('putUpload', { id, profile: value.profile })),
    ),
  );
  expect(results).toEqual([0, 1, 2, 3, 4]);
  expect(put).toHaveBeenCalledTimes(5);
  for (const [value] of put.mock.calls) expect(value.profile.integrity.actions).toHaveLength(31);
});
