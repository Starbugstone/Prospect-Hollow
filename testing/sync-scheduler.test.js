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
