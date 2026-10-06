import { toRaw } from 'vue';

// Named timeouts owned by one store instance. A replaced store (another test, a
// reloaded tab) can never fire a stale banner or hint into the current one.
const owners = new WeakMap();

export function storeTimers(store) {
  const owner = toRaw(store.$state);
  if (!owners.has(owner)) owners.set(owner, new Map());
  const timers = owners.get(owner);
  return {
    set(name, callback, ms) {
      clearTimeout(timers.get(name));
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          callback();
        }, ms),
      );
    },
    clear(name) {
      clearTimeout(timers.get(name));
      timers.delete(name);
    },
    has: (name) => timers.has(name),
  };
}
