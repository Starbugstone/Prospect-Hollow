// Browser-owned locks have no heartbeat or expiry to race a sleeping tab. A crash
// releases ownership; the next tab retries the outbox saved with the town.
export function createTownCoordinator(locks = globalThis.navigator?.locks) {
  const held = new Set(),
    queues = new Map();
  let gameKey, releaseGame, gameReleased, acquisition, releasing;
  const name = (key) => `prospect-writer:${key}`;
  const unavailable = () => new Error('This town is open in another tab.');
  async function locked(key, operation) {
    if (held.has(key)) return operation();
    if (!locks) throw new Error('Safe saving requires a browser with Web Locks support.');
    return locks.request(name(key), { ifAvailable: true }, async (lock) => {
      if (!lock) throw unavailable();
      held.add(key);
      try {
        return await operation();
      } finally {
        held.delete(key);
      }
    });
  }
  return {
    supported: !!locks,
    owns: (key) => held.has(key),
    async acquire(key, { signal } = {}) {
      if (releasing) await releasing;
      if (acquisition) return acquisition.key === key ? acquisition.promise : false;
      if (gameKey === key) return true;
      if (gameKey) throw new Error('Release the previous town before opening another.');
      if (!locks) throw new Error('Safe saving requires a browser with Web Locks support.');
      const promise = new Promise((resolve, reject) => {
        gameReleased = locks
          .request(name(key), signal ? { signal } : { ifAvailable: true }, async (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            gameKey = key;
            held.add(key);
            await new Promise((release) => {
              releaseGame = release;
              resolve(true);
            });
            held.delete(key);
            gameKey = undefined;
          })
          .catch((error) => {
            reject(error);
          });
      });
      acquisition = { key, promise };
      try {
        return await promise;
      } finally {
        acquisition = undefined;
      }
    },
    async drain(key) {
      while (queues.has(key)) await queues.get(key).catch(() => {});
    },
    release() {
      if (releasing) return releasing;
      const key = gameKey;
      if (!key) return Promise.resolve();
      releasing = (async () => {
        await this.drain(key);
        releaseGame();
        // Await the browser's released promise, not just a JS microtask.
        await gameReleased;
      })().finally(() => {
        releasing = undefined;
      });
      return releasing;
    },
    run(key, operation) {
      if (releasing && gameKey === key) return Promise.reject(unavailable());
      const result = (queues.get(key) ?? Promise.resolve())
        .catch(() => {})
        .then(() => locked(key, operation));
      queues.set(key, result);
      result
        .finally(() => {
          if (queues.get(key) === result) queues.delete(key);
        })
        .catch(() => {});
      return result;
    },
  };
}
export const townCoordinator = createTownCoordinator();
