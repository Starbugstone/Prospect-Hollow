import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import VillageVisit from '../src/components/community/VillageVisit.vue';
import TownResourceCollection from '../src/components/town/TownResourceCollection.vue';
import TownVisitorNotice from '../src/components/town/TownVisitorNotice.vue';
import { cloud, tapHelmet } from '../src/services/cloudProfile';
import { loadVisitorProfile } from '../src/services/visitorApi';
import { townStorage } from '../src/services/townStorage';
import { createTown } from '../src/data/town';
import { SPACE_HELMET } from '../src/data/townAnimals';
import { spaceHelmetReward } from '../src/game/town/TownRules';

vi.mock('../src/composables/useVillageVisitors', async () => {
  const { ref } = await import('vue');
  return { useVillageVisitors: () => ({ snapshot: ref(null), error: ref('') }) };
});

const home = { townId: 'home-town', name: 'Silver Creek' };
const origin = { x: 35, y: 60 };
let visitor, state;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  cloud.account = null;
  cloud.sessionExpired = false;
  cloud.csrf = '';
  visitor = { profile: { displayName: 'Alice' }, towns: [home], csrf: 'visit-csrf' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith('/profile') ? visitor : { readyAt: 44_200 }),
    })),
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function visit(extra = {}) {
  const town = { ...createTown(), era: SPACE_HELMET.debut };
  const village = { villageId: 'shared-town', name: 'Red Rock', appearance: town, ...extra };
  // Run the real setup and handlers without starting a WebGL scene or live polling.
  const app = createSSRApp({
    setup() {
      state = VillageVisit.setup({ village }, { expose() {} });
      return () => null;
    },
  });
  app.use(createPinia());
  await renderToString(app);
  const result = await loadVisitorProfile();
  // VisitPresence emits the server's selected town even on a direct share link,
  // where CloudRoot and its account/sync initialization never mount.
  state.homeTown.value = result.towns[0] ?? null;
  return state;
}

it('claims through the visit session without starting account sync', async () => {
  await loadVisitorProfile();
  expect(cloud.account).toBeNull();
  await expect(tapHelmet('shared-town', home.townId)).resolves.toEqual({ readyAt: 44_200 });
  expect(fetch).toHaveBeenLastCalledWith(
    '/api/v1/villages/shared-town/helmet',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'visit-csrf' }),
      body: JSON.stringify({ townId: home.townId }),
    }),
  );
});

it('bursts coins and confirms the rewarded town after a direct-link find', async () => {
  await visit();
  expect(cloud.account).toBeNull();
  await state.findHelmet(origin);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(state.helmetNote.value).toEqual({ kind: 'found', town: home.name });
  expect(state.helmetMessage.value).toContain('Silver Creek receives half an hour');
  expect(state.helmetBurst.value).toMatchObject({ amount: null, origin });
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(TownResourceCollection, { resource: 'helmet-coins', ...state.helmetBurst.value }),
    }),
  );
  expect(html).toContain('collection-particles');
  expect(html).toContain('Found the astronaut: coins for your town!');
  await state.findHelmet(origin);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('counts cached town takings on a direct link without changing either save', async () => {
  const town = createTown();
  Object.assign(town.buildings, { home: 3, well: 3, farm: 3, saloon: 3 });
  townStorage.account({ id: 'owner' });
  townStorage.remember({ ...home, revision: 1, profile: { town } }, 'owner');
  const before = localStorage.getItem(townStorage.selectedKey());
  const saved = townStorage.get(home.townId, 'owner');
  await visit();
  await state.findHelmet(origin);
  expect(state.helmetBurst.value?.amount).toBe(spaceHelmetReward(town, 'visitor'));
  expect(state.helmetBurst.value?.amount).toBeGreaterThan(0);
  expect(townStorage.get(home.townId, 'owner')).toEqual(saved);
  expect(localStorage.getItem(townStorage.selectedKey())).toBe(before);
});

it('does not claim for signed-out visitors or owners visiting their own town', async () => {
  visitor = { profile: null, towns: [] };
  await visit();
  await state.findHelmet(origin);
  expect(state.helmetNote.value).toEqual({ kind: 'signed-out' });
  expect(state.visitNotice.value.message).toContain('Sign in with a town of your own');
  expect(state.helmetBurst.value).toBeNull();
  state.homeTown.value = { own: true };
  await state.findHelmet(origin);
  expect(state.helmetNote.value).toEqual({ kind: 'own' });
  expect(state.visitNotice.value.message).toContain('This is your own town');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('announces a known cooldown on each tap without sending another claim', async () => {
  await visit({ helmetReadyAt: 44_200 });
  await state.findHelmet(origin);
  expect(state.helmetBurst.value).toBeNull();
  expect(state.visitNotice.value.message).toContain('Come back in 12 h.');
  const html = await renderToString(
    createSSRApp(TownVisitorNotice, { notice: state.visitNotice.value }),
  );
  expect(html).toContain('Come back in 12 h.');
  expect(html).toContain('role="status"');
  await vi.advanceTimersByTimeAsync(6000);
  expect(state.visitNotice.value).toBeNull();
  await state.findHelmet(origin);
  expect(state.visitNotice.value.message).toContain('Come back in 12 h.');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['helmet_taken', 'helmet_resting'])('announces a server %s cooldown', async (code) => {
  await visit();
  fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code, readyAt: 44_200 }),
  });
  await state.findHelmet(origin);
  expect(state.helmetBurst.value).toBeNull();
  expect(state.visitNotice.value.message).toContain('12 h.');
  expect(state.helmetBusy.value).toBe(false);
  await state.findHelmet(origin);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('announces failed claims and lets the player retry', async () => {
  await visit();
  fetch.mockRejectedValueOnce(new Error('Network unavailable.'));
  await state.findHelmet(origin);
  expect(state.visitNotice.value.message).toBe('Network unavailable.');
  expect(state.helmetBurst.value).toBeNull();
  await state.findHelmet(origin);
  expect(state.helmetNote.value.kind).toBe('found');
  expect(state.helmetBurst.value).toMatchObject({ origin });
});

it('keeps the accepted coin burst if the optional local estimate cannot be read', async () => {
  townStorage.account({ id: 'owner' });
  await visit();
  localStorage.setItem('prospect-town-v2:owner:home-town', 'damaged');
  await state.findHelmet(origin);
  expect(state.helmetNote.value.kind).toBe('found');
  expect(state.helmetBurst.value).toMatchObject({ amount: null, origin });
});

it('reports a visitor who has left in the dismissible map notice', async () => {
  await visit();
  await state.findVisitor('departed-visitor');
  expect(state.visitNotice.value).toEqual({ kind: 'unavailable' });
  const html = await renderToString(
    createSSRApp(TownVisitorNotice, { notice: state.visitNotice.value }),
  );
  expect(html).toContain('This visitor is no longer visible.');
  expect(html).toContain('Dismiss visitor notification');
  await vi.advanceTimersByTimeAsync(6000);
  expect(state.visitNotice.value).toBeNull();
});
