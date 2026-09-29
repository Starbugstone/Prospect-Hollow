import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVisitorPresence,
  createOwnerVisitorPoller,
  VISITOR_AWAY_MS,
  VISITOR_HEARTBEAT_MS,
  VISITOR_POLL_MS,
} from '../src/services/visitorPresence';
import { visitorLabel } from '../src/data/liveVisitors';
import { setLocale } from '../src/i18n';

let hidden;
beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
});
afterEach(() => {
  vi.useRealTimers();
  setLocale('en');
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function visit(options = {}) {
  let id = 0;
  const send = vi.fn(async () => ({ active: true })),
    leave = vi.fn(async () => ({})),
    changed = vi.fn();
  const presence = createVisitorPresence({
    send,
    leave,
    changed,
    hidden: () => hidden,
    token: () => `token-${++id}`,
    ...options,
  });
  return { presence, send: options.send ?? send, leave, changed };
}

describe('live visit lifecycle', () => {
  it('joins immediately without overlapping requests and fences a late response after departure', async () => {
    const pending = deferred();
    const v = visit({ send: vi.fn(() => pending.promise) });
    v.presence.start();
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(VISITOR_HEARTBEAT_MS * 3);
    expect(v.send).toHaveBeenCalledOnce();
    v.presence.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(v.leave).toHaveBeenCalledExactlyOnceWith({ token: 'token-1', sequence: 2 });
    pending.resolve({ active: true });
    await vi.advanceTimersByTimeAsync(VISITOR_HEARTBEAT_MS);
    expect(v.changed).not.toHaveBeenCalledWith(true);
  });

  it('keeps quick tab switches in one visit, then leaves after the hidden grace period', async () => {
    const v = visit();
    v.presence.start();
    await vi.advanceTimersByTimeAsync(0);
    hidden = true;
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(VISITOR_AWAY_MS - 1);
    expect(v.leave).not.toHaveBeenCalled();
    hidden = false;
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(v.send).toHaveBeenLastCalledWith({ token: 'token-1', sequence: 2 });
    hidden = true;
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(VISITOR_AWAY_MS);
    expect(v.leave).toHaveBeenCalledExactlyOnceWith({ token: 'token-1', sequence: 3 });
    hidden = false;
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(v.send).toHaveBeenLastCalledWith({ token: 'token-2', sequence: 1 });
    v.presence.stop();
  });

  it('does not join a background share link until it becomes visible', async () => {
    hidden = true;
    const v = visit();
    v.presence.start();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(v.send).not.toHaveBeenCalled();
    hidden = false;
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(v.send).toHaveBeenCalledOnce();
    v.presence.stop();
  });

  it('backs off connection failures and stops when a town is no longer public', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 404 }));
    const v = visit({ send });
    v.presence.start();
    await vi.advanceTimersByTimeAsync(VISITOR_HEARTBEAT_MS);
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(VISITOR_HEARTBEAT_MS);
    expect(send).toHaveBeenCalledTimes(2);
    expect(v.leave).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(send).toHaveBeenCalledTimes(2);
    v.presence.stop();
  });

  it('uses a fresh token when returning from the browser page cache', async () => {
    const v = visit();
    v.presence.start();
    await vi.advanceTimersByTimeAsync(0);
    v.presence.suspend();
    v.presence.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(v.leave).toHaveBeenCalledExactlyOnceWith({ token: 'token-1', sequence: 2 });
    expect(v.send).toHaveBeenLastCalledWith({ token: 'token-2', sequence: 1 });
    v.presence.stop();
  });
});

describe('owner presence updates', () => {
  it('polls immediately and regularly, but ignores results after switching towns', async () => {
    const pending = deferred(),
      apply = vi.fn();
    const load = vi
      .fn()
      .mockResolvedValueOnce({ present: [{ id: 'one' }] })
      .mockReturnValue(pending.promise);
    const poller = createOwnerVisitorPoller({ load, apply, hidden: () => hidden });
    poller.start();
    await vi.advanceTimersByTimeAsync(VISITOR_POLL_MS);
    expect(load).toHaveBeenCalledTimes(2);
    poller.stop();
    pending.resolve({ present: [{ id: 'wrong-town' }] });
    await vi.advanceTimersByTimeAsync(VISITOR_POLL_MS * 10);
    expect(apply).toHaveBeenCalledExactlyOnceWith({ present: [{ id: 'one' }] });
  });

  it('suspends a hidden owner page and backs off outages', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ present: [] });
    const failed = vi.fn();
    const poller = createOwnerVisitorPoller({ load, apply: vi.fn(), failed, hidden: () => hidden });
    poller.start();
    await vi.advanceTimersByTimeAsync(VISITOR_POLL_MS);
    expect(load).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(VISITOR_POLL_MS);
    expect(load).toHaveBeenCalledTimes(2);
    hidden = true;
    poller.resume();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(load).toHaveBeenCalledTimes(2);
    hidden = false;
    poller.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(3);
    poller.stop();
  });
});

it('formats names without exposing identifiers and handles unnamed mayors', () => {
  setLocale('en');
  expect(visitorLabel({ name: 'Camille', townName: 'Silver Creek', id: 'private' })).toBe(
    'Camille · Mayor of Silver Creek',
  );
  expect(visitorLabel({ name: '', townName: 'Silver Creek' })).toBe('Mayor of Silver Creek');
  expect(visitorLabel({ name: '', townName: null })).toBe('Visitor');
});
