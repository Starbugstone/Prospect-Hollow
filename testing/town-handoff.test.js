import { afterEach, expect, it, vi } from 'vitest';
import { createTownCoordinator } from '../src/services/townCoordinator';
import { createTownHandoff } from '../src/services/townHandoff';

// Model queued/abortable locks and the released promise, not only ifAvailable.
function browserLocks() {
  const held = new Set(),
    queues = new Map();
  function process(name) {
    const queue = queues.get(name);
    if (held.has(name) || !queue?.length) return;
    const request = queue.shift();
    request.signal?.removeEventListener('abort', request.abort);
    held.add(name);
    Promise.resolve()
      .then(() => request.callback({ name }))
      .then(request.resolve, request.reject);
  }
  return {
    request(name, options, callback) {
      if (options.ifAvailable && (held.has(name) || queues.get(name)?.length))
        return Promise.resolve(callback(null));
      return new Promise((resolve, reject) => {
        const request = {
          callback,
          resolve: (value) => {
            held.delete(name);
            process(name);
            resolve(value);
          },
          reject: (error) => {
            held.delete(name);
            process(name);
            reject(error);
          },
          signal: options.signal,
        };
        const queue = queues.get(name) ?? [];
        queues.set(name, queue);
        request.abort = () => {
          const i = queue.indexOf(request);
          if (i >= 0) queue.splice(i, 1);
          reject(options.signal.reason);
        };
        if (options.signal?.aborted) return request.abort();
        options.signal?.addEventListener('abort', request.abort, { once: true });
        queue.push(request);
        process(name);
      });
    },
  };
}
function channels() {
  const peers = new Set(),
    messages = [];
  return {
    messages,
    open() {
      const listeners = new Set();
      const channel = {
        addEventListener: (_, fn) => listeners.add(fn),
        removeEventListener: (_, fn) => listeners.delete(fn),
        postMessage(data) {
          messages.push(data);
          for (const peer of peers)
            if (peer !== channel) Promise.resolve().then(() => peer.deliver(data));
        },
        deliver(data) {
          for (const fn of listeners) fn({ data: structuredClone(data) });
        },
        close() {
          peers.delete(channel);
        },
      };
      peers.add(channel);
      return channel;
    },
  };
}
const resources = [];
afterEach(async () => {
  for (const [handoff, coordinator] of resources.splice(0)) {
    handoff.dispose();
    await coordinator.release();
  }
  vi.useRealTimers();
});
function setup(prepare = async () => {}, timeout = 20000) {
  const locks = browserLocks(),
    bus = channels();
  const tab = (callback = prepare) => {
    const coordinator = createTownCoordinator(locks);
    const handoff = createTownHandoff({
      coordinator,
      prepare: callback,
      locks,
      channel: bus.open(),
      timeout,
    });
    resources.push([handoff, coordinator]);
    return { coordinator, handoff };
  };
  return { locks, bus, tab };
}
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
it('transfers one owner/UUID without affecting another town and without idle messages', async () => {
  const prepare = vi.fn();
  const { tab, bus } = setup(prepare);
  const a = tab(),
    b = tab(),
    other = tab();
  const key = 'prospect-town-v2:user:town-a';
  await a.coordinator.acquire(key);
  await other.coordinator.acquire('prospect-town-v2:user:town-b');
  expect(bus.messages).toEqual([]);
  const sender = bus.open();
  sender.postMessage({
    type: 'request',
    key: 'prospect-town-v2:other-user:town-a',
    id: 'foreign',
    until: Date.now() + 10000,
  });
  await tick();
  expect(prepare).not.toHaveBeenCalled();
  bus.messages.length = 0;
  sender.close();
  expect(await b.handoff.openHere(key)).toBe(true);
  expect(prepare).toHaveBeenCalledOnce();
  expect(prepare.mock.calls[0][0]).toBe(key);
  expect(a.coordinator.owns(key)).toBe(false);
  expect(b.coordinator.owns(key)).toBe(true);
  expect(other.coordinator.owns('prospect-town-v2:user:town-b')).toBe(true);
  expect(bus.messages.map((m) => m.type)).toEqual(['request']);
  await expect(
    a.coordinator.run(key, () => {
      throw new Error('stale write');
    }),
  ).rejects.toThrow('another tab');
  await a.handoff.openHere(key);
  expect(a.coordinator.owns(key)).toBe(true);
  expect(b.coordinator.owns(key)).toBe(false);
});
it('finishes a pending upload before allowing the requester to own the town', async () => {
  const { tab } = setup();
  const a = tab(),
    b = tab();
  await a.coordinator.acquire('town');
  let finish;
  const upload = a.coordinator.run(
    'town',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await tick();
  let acquired = false;
  const transfer = b.handoff.openHere('town').then(() => {
    acquired = true;
  });
  await tick();
  expect(acquired).toBe(false);
  expect(a.coordinator.owns('town')).toBe(true);
  finish();
  await upload;
  await transfer;
  expect(b.coordinator.owns('town')).toBe(true);
  expect(a.coordinator.owns('town')).toBe(false);
});
it('keeps the original owner when saving the handoff fails', async () => {
  const { tab } = setup(async () => {
    throw new Error('save failed');
  });
  const a = tab(),
    b = tab();
  await a.coordinator.acquire('town');
  await expect(b.handoff.openHere('town')).rejects.toThrow('save failed');
  expect(a.coordinator.owns('town')).toBe(true);
  expect(b.coordinator.owns('town')).toBe(false);
});
it('times out an unresponsive owner without stealing, and ignores expired messages', async () => {
  vi.useFakeTimers();
  const { locks, tab, bus } = setup(undefined, 1000);
  const original = createTownCoordinator(locks);
  await original.acquire('town'); // An older client with no handoff listener.
  const b = tab();
  const transfer = expect(b.handoff.openHere('town')).rejects.toThrow('did not respond');
  await tick();
  await vi.advanceTimersByTimeAsync(1001);
  await transfer;
  expect(original.owns('town')).toBe(true);
  const prepare = vi.fn(),
    a = tab(prepare);
  await original.release();
  await a.coordinator.acquire('town');
  bus.open().postMessage(bus.messages[0]);
  await tick();
  expect(prepare).not.toHaveBeenCalled();
  expect(a.coordinator.owns('town')).toBe(true);
});
it('allows only one transfer request at a time for the same town', async () => {
  let finish;
  const { tab } = setup(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const a = tab(),
    b = tab(),
    c = tab();
  await a.coordinator.acquire('town');
  const transfer = b.handoff.openHere('town');
  await tick();
  await expect(c.handoff.openHere('town')).rejects.toThrow('already transferring');
  finish();
  await transfer;
  expect(b.coordinator.owns('town')).toBe(true);
  expect(c.coordinator.owns('town')).toBe(false);
});
it('cancels a queued handoff without later pausing its owner', async () => {
  let finish;
  const { tab } = setup(async (_, check) => {
    await new Promise((resolve) => {
      finish = resolve;
    });
    check();
  });
  const a = tab(),
    b = tab();
  await a.coordinator.acquire('town');
  const transfer = expect(b.handoff.openHere('town')).rejects.toThrow('cancelled');
  await tick();
  b.handoff.cancel();
  await transfer;
  finish();
  await tick();
  expect(a.coordinator.owns('town')).toBe(true);
  expect(b.coordinator.owns('town')).toBe(false);
});
it('deduplicates acquisition and rejects late work while releasing an upload', async () => {
  const { tab } = setup();
  const a = tab(),
    b = tab();
  expect(await Promise.all([a.coordinator.acquire('town'), a.coordinator.acquire('town')])).toEqual(
    [true, true],
  );
  let finish;
  const upload = a.coordinator.run(
    'town',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await tick();
  const release = a.coordinator.release();
  await expect(
    a.coordinator.run('town', () => {
      throw new Error('late write');
    }),
  ).rejects.toThrow('another tab');
  expect(await b.coordinator.acquire('town')).toBe(false);
  finish();
  await upload;
  await release;
  expect(await b.coordinator.acquire('town')).toBe(true);
});
it('deduplicates two acquisitions waiting for this window to release its previous town', async () => {
  const { tab } = setup();
  const a = tab(),
    b = tab();
  await a.coordinator.acquire('old');
  const release = a.coordinator.release();
  expect(await Promise.all([a.coordinator.acquire('new'), a.coordinator.acquire('new')])).toEqual([
    true,
    true,
  ]);
  await release;
  expect(await b.coordinator.acquire('new')).toBe(false);
  await a.coordinator.release();
  expect(await b.coordinator.acquire('new')).toBe(true);
});
