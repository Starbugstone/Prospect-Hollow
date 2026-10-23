import { afterEach, expect, it, vi } from 'vitest';
import { deferSync, waitForSyncIdle } from '../src/services/syncIdle';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('defers boot and late replies past transitions, then waits for a browser idle opportunity', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  vi.stubGlobal('window', {});
  const idle = vi.fn((fn) => setTimeout(fn, 10));
  vi.stubGlobal('requestIdleCallback', idle);
  const done = vi.fn();
  deferSync();
  const waiting = waitForSyncIdle().then(done);
  await vi.advanceTimersByTimeAsync(1400);
  expect(done).not.toHaveBeenCalled();
  expect(idle).not.toHaveBeenCalled();
  deferSync();
  await vi.advanceTimersByTimeAsync(1499);
  expect(done).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(11);
  await waiting;
  expect(done).toHaveBeenCalledOnce();
});
