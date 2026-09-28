import { afterEach, expect, it, vi } from 'vitest';
import { createSyncScheduler } from '../src/services/syncScheduler';
afterEach(() => vi.useRealTimers());
it('makes no requests for clean checkpoints and caps debounce during continuous play', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  let dirty = false;
  const sync = vi.fn(async () => {
    dirty = false;
    return true;
  });
  const queue = createSyncScheduler({ pending: () => dirty, sync });
  queue.schedule();
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).not.toHaveBeenCalled();
  dirty = true;
  for (let i = 0; i < 10; i++) {
    queue.schedule();
    await vi.advanceTimersByTimeAsync(1000);
  }
  expect(sync).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60000);
  expect(sync).toHaveBeenCalledOnce();
  queue.dispose();
});
it('backs off failed uploads even when gameplay and visibility events continue', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const sync = vi.fn(async () => false);
  const queue = createSyncScheduler({ pending: () => true, sync, random: () => 0 });
  queue.schedule();
  await vi.advanceTimersByTimeAsync(2000);
  expect(sync).toHaveBeenCalledOnce();
  for (let i = 0; i < 4; i++) {
    queue.resume();
    await vi.advanceTimersByTimeAsync(1000);
  }
  expect(sync).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(2000);
  expect(sync).toHaveBeenCalledTimes(2);
  queue.dispose();
  await vi.advanceTimersByTimeAsync(600000);
  expect(sync).toHaveBeenCalledTimes(2);
});
it('coalesces checkpoints while a slow save runs and sends only the remaining progress', async () => {
  vi.useFakeTimers();
  let dirty = true,
    finish;
  const sync = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const queue = createSyncScheduler({ pending: () => dirty, sync });
  queue.schedule();
  await vi.advanceTimersByTimeAsync(2000);
  for (let i = 0; i < 30; i++) {
    queue.schedule();
    queue.resume();
    await vi.advanceTimersByTimeAsync(1000);
  }
  expect(sync).toHaveBeenCalledOnce();
  finish(true);
  await vi.advanceTimersByTimeAsync(1999);
  expect(sync).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(sync).toHaveBeenCalledTimes(2);
  dirty = false;
  finish(true);
  await vi.advanceTimersByTimeAsync(600000);
  expect(sync).toHaveBeenCalledTimes(2);
  queue.dispose();
});
it('caps outage retries at five minutes and stops once there is no pending save', async () => {
  vi.useFakeTimers();
  let dirty = true;
  const sync = vi.fn(async () => false);
  const queue = createSyncScheduler({ pending: () => dirty, sync, random: () => 0 });
  queue.schedule();
  await vi.advanceTimersByTimeAsync(2000);
  for (const delay of [5000, 10000, 20000, 40000, 80000, 160000, 300000, 300000]) {
    const calls = sync.mock.calls.length;
    queue.resume();
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(sync).toHaveBeenCalledTimes(calls);
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(calls + 1);
  }
  dirty = false;
  queue.schedule();
  await vi.advanceTimersByTimeAsync(3600000);
  expect(sync).toHaveBeenCalledTimes(9);
  queue.dispose();
});
