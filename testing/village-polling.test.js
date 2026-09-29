import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createVillagePoller, VILLAGE_POLL_MS } from '../src/services/villagePolling';

let hidden;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  hidden = false;
});
afterEach(() => vi.useRealTimers());

function poller(load) {
  const apply = vi.fn(),
    gone = vi.fn();
  const queue = createVillagePoller({ load, apply, gone, hidden: () => hidden });
  return { queue, apply, gone };
}
const failure = (status) => Object.assign(new Error('failed'), { status });

it('follows the owner with one request per interval, applying each result', async () => {
  let level = 1;
  const load = vi.fn(async () => ({ level: level++ }));
  const { queue, apply } = poller(load);
  queue.start();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS - 1);
  expect(load).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(apply).toHaveBeenLastCalledWith({ level: 1 });
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 3);
  expect(load).toHaveBeenCalledTimes(4);
  expect(apply).toHaveBeenLastCalledWith({ level: 4 });
  queue.stop();
});

it('never overlaps a slow request with the next one', async () => {
  let finish;
  const load = vi.fn(() => new Promise((resolve) => (finish = resolve)));
  const { queue, apply } = poller(load);
  queue.start();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 5);
  queue.resume();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS);
  expect(load).toHaveBeenCalledOnce();
  finish({ level: 2 });
  await vi.advanceTimersByTimeAsync(0);
  expect(apply).toHaveBeenCalledExactlyOnceWith({ level: 2 });
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS);
  expect(load).toHaveBeenCalledTimes(2);
  queue.stop();
});

it('sends nothing from a hidden page and catches up once when it is shown again', async () => {
  const load = vi.fn(async () => ({}));
  const { queue } = poller(load);
  queue.start();
  hidden = true;
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 30);
  expect(load).not.toHaveBeenCalled();
  hidden = false;
  queue.resume();
  await vi.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledOnce();
  // A quick return within the interval waits for the normal cadence.
  queue.resume();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS - 1);
  expect(load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(2);
  queue.stop();
});

it('backs off failures, keeps the last view, and returns to the cadence after a success', async () => {
  let fail = true;
  const load = vi.fn(async () => {
    if (fail) throw failure(503);
    return { level: 2 };
  });
  const { queue, apply, gone } = poller(load);
  queue.start();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS);
  expect(load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 2 - 1);
  expect(load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(2);
  // Returning to the page respects the backoff instead of hammering a failing server.
  queue.resume();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 4 - 1);
  expect(load).toHaveBeenCalledTimes(2);
  fail = false;
  await vi.advanceTimersByTimeAsync(1);
  expect(apply).toHaveBeenCalledExactlyOnceWith({ level: 2 });
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS);
  expect(load).toHaveBeenCalledTimes(4);
  // Backoff is capped, so a long outage still recovers within minutes.
  fail = true;
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 100);
  expect(load.mock.calls.length).toBeGreaterThan(8);
  expect(gone).not.toHaveBeenCalled();
  queue.stop();
});

it('stops for good once the town is no longer shared', async () => {
  const load = vi.fn(async () => {
    throw failure(404);
  });
  const { queue, apply, gone } = poller(load);
  queue.start();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS);
  expect(gone).toHaveBeenCalledOnce();
  queue.resume();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 10);
  expect(load).toHaveBeenCalledOnce();
  expect(apply).not.toHaveBeenCalled();
});

it('ignores a response that arrives after the visit closed', async () => {
  let finish;
  const load = vi.fn(() => new Promise((resolve) => (finish = resolve)));
  const { queue, apply } = poller(load);
  queue.start();
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS);
  queue.stop();
  finish({ level: 3 });
  await vi.advanceTimersByTimeAsync(VILLAGE_POLL_MS * 10);
  expect(apply).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledOnce();
});
