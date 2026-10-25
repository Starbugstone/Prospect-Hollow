import { toRaw } from 'vue';

// These entry points implement the game's existing rules. Generic helpers cannot
// open a mutation scope by themselves, including on development/preprod builds.
const NORMAL_ACTIONS = new Set([
  'visitVillage',
  'markTipSeen',
  'focusTownProject',
  'acknowledgeFirstLights',
  'advanceEra',
  'acknowledgePresentation',
  'acknowledgeEra',
  'save',
  'reloadLocal',
  'importSave',
  'collectForgeTNT',
  'beginRun',
  'endRun',
  'recordContinuous',
  'resetProgress',
  'accrueSaloonIncome',
  'collectMoonstones',
  'sellMoonstones',
  'collectVipSpending',
  'collectSaloonIncome',
  'collectSaloonForVisitor',
  'findSpaceHelmet',
  'redeemHelmetVisit',
  'markGuestSeen',
  'upgradeBuilding',
  'personalise',
  'finishConstruction',
  'unveilMonument',
  'useBuilderHammer',
  'resolveBandits',
  'ringTownBell',
  'markRaidSeen',
  'ensureShopStock',
  'buyShopItem',
  'markObstaclesSeen',
  'finishTownTour',
  'claimChest',
  'settlePendingChests',
  'recordVictory',
  'consumePowerItem',
  'setHonourShowcase',
  'recordTownSocial',
  'markHonoursSeen',
  'markHonoursAnnounced',
]);
const INTERNAL_ACTIONS = new Set([
  'transaction',
  'commit',
  'recordAction',
  'completeProject',
  'rewardProjects',
  'updateEarnedHonours',
]);
// Every other campaign action must be read-only: the plugin leaves it unwrapped, so a
// state-changing action missing from both lists would fail to save in the shipped game.
// testing/local-integrity.test.js checks that every campaign action is classified.
export const guardedActionNames = () => ({
  normal: [...NORMAL_ACTIONS],
  internal: [...INTERNAL_ACTIONS],
});
const PROTECTED_FIELDS = [
  'town',
  'records',
  'continuousRecords',
  'powers',
  'builderHammers',
  'pendingChests',
  'shopStock',
  'shopVisit',
  'vipReceipts',
  'issuedRun',
  'settledRun',
  'chestsWithoutBuilderHammer',
  'integrity',
  'readOnly',
  // Honours change only through the actions above, never through console edits.
  'honours',
];
const guarded = new WeakSet();

// Installed before stores are created in the browser. Headless fixtures may seed
// ordinary unguarded stores; regression tests install this same production plugin.
export function createLocalIntegrityPlugin() {
  return ({ store, options }) => {
    if (store.$id !== 'campaign' || guarded.has(toRaw(store))) return;
    let depth = 0;
    const wrapped = new WeakMap();
    const run = (operation) => {
      depth++;
      try {
        const result = operation();
        if (result?.then) throw new Error('A protected mutation must finish synchronously.');
        return result;
      } finally {
        depth--;
      }
    };
    const protect = (value) => {
      if (!value || typeof value !== 'object') return value;
      const raw = toRaw(value);
      // Receipt trees already have immutable replacement semantics and stay raw
      // to avoid walking historical commands during each existing save.
      if (raw.__v_skip) return raw;
      if (wrapped.has(raw)) return wrapped.get(raw);
      const proxy = new Proxy(raw, {
        set(target, key, next) {
          if (!depth) return true;
          return Reflect.set(target, key, protect(next), target);
        },
        deleteProperty(target, key) {
          return depth ? Reflect.deleteProperty(target, key) : true;
        },
        defineProperty(target, key, descriptor) {
          if (!depth) return false;
          const next = { ...descriptor };
          if ('value' in next) next.value = protect(next.value);
          return Reflect.defineProperty(target, key, next);
        },
        setPrototypeOf() {
          return false;
        },
        preventExtensions() {
          return false;
        },
      });
      wrapped.set(raw, proxy);
      wrapped.set(proxy, proxy);
      for (const key of Object.keys(raw)) raw[key] = protect(raw[key]);
      return proxy;
    };
    guarded.add(toRaw(store));
    const state = toRaw(store.$state);
    const rawStore = toRaw(store);
    for (const key of PROTECTED_FIELDS) {
      let current = protect(state[key]);
      const descriptor = {
        enumerable: true,
        configurable: false,
        get: () => current,
        set: (next) => {
          if (depth) current = protect(next);
        },
      };
      Object.defineProperty(state, key, descriptor);
      Object.defineProperty(rawStore, key, {
        ...descriptor,
        get: () => store.$state[key],
        set: (next) => {
          store.$state[key] = next;
        },
      });
    }
    for (const name of Object.keys(options.actions ?? {})) {
      const original = store[name];
      if (NORMAL_ACTIONS.has(name)) store[name] = (...args) => run(() => original(...args));
      else if (INTERNAL_ACTIONS.has(name))
        store[name] = (...args) => (depth ? original(...args) : false);
    }
  };
}
