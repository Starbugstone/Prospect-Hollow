import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSSRApp, effectScope, nextTick, reactive } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useVillageVisitors } from '../src/composables/useVillageVisitors';
import { useTownVisitors } from '../src/composables/useTownVisitors';
import { visitorChanges } from '../src/data/liveVisitors';
import { townVisitors, villageVisitors } from '../src/services/visitorApi';
import { cloud } from '../src/services/cloudProfile';
import { townStorage } from '../src/services/townStorage';
import { VISITOR_POLL_MS } from '../src/services/visitorPresence';
import { setLocale } from '../src/i18n';
import TownVisitorNotice from '../src/components/town/TownVisitorNotice.vue';

const hooks = vi.hoisted(() => ({ mounted: [], unmounted: [] }));
vi.mock('vue', async (original) => ({
  ...(await original()),
  onMounted: (callback) => hooks.mounted.push(callback),
  onBeforeUnmount: (callback) => hooks.unmounted.push(callback),
}));
vi.mock('../src/services/cloudProfile', async () => ({
  cloud: (await import('vue')).reactive({ account: { id: 'owner' }, storageVersion: 0 }),
}));
vi.mock('../src/services/townStorage', () => ({ townStorage: { active: vi.fn() } }));
vi.mock('../src/services/visitorApi', () => ({ townVisitors: vi.fn(), villageVisitors: vi.fn() }));

const alice = { id: 'visit-a', name: 'Alice', townName: 'Silver Creek' };
const anonymous = { id: 'visit-b', name: '', townName: null };
let scope, state, visitors, result, collectSaloon, collectedAt;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('window', new EventTarget());
  Object.assign(cloud, { account: { id: 'owner' }, sessionExpired: false, storageVersion: 0 });
  townStorage.active.mockReturnValue({ meta: { id: 'town-a', owner: 'owner' } });
  result = { present: [], history: [] };
  townVisitors.mockImplementation(async () => result);
  collectedAt = 0;
  cloud.towns = [];
  collectSaloon = vi.fn((at) => {
    if (at <= collectedAt) return null;
    collectedAt = at;
    return 120;
  });
  state = reactive({ active: true });
  scope = effectScope();
  visitors = scope.run(() => useTownVisitors(() => state.active, { collectSaloon }));
  hooks.mounted.forEach((callback) => callback());
});
afterEach(() => {
  hooks.unmounted.forEach((callback) => callback());
  scope.stop();
  hooks.mounted.length = hooks.unmounted.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setLocale('en');
});
const poll = () => vi.advanceTimersByTimeAsync(VISITOR_POLL_MS);

it('uses stay IDs and ignores first loads, heartbeat updates, reordering and duplicate entries', () => {
  expect(visitorChanges(null, [alice])).toEqual([]);
  expect(visitorChanges([alice, anonymous], [anonymous, { ...alice, lastSeenAt: 999 }])).toEqual(
    [],
  );
  expect(visitorChanges([], [alice, alice])).toEqual([{ kind: 'arrival', visitor: alice }]);
  const returning = { ...alice, id: 'new-stay' };
  expect(visitorChanges([alice], [returning])).toEqual([
    { kind: 'departure', visitor: alice },
    { kind: 'arrival', visitor: returning },
  ]);
});

it('queues arrivals and departures once, with dismissal and automatic expiry', async () => {
  await vi.advanceTimersByTimeAsync(0);
  result = { present: [alice, anonymous] };
  await poll();
  expect(visitors.notice.value).toEqual({ kind: 'arrival', visitor: alice });
  visitors.dismissNotice();
  expect(visitors.notice.value).toEqual({ kind: 'arrival', visitor: anonymous });
  await vi.advanceTimersByTimeAsync(6000);
  expect(visitors.notice.value).toBeNull();
  result = { present: [anonymous] };
  await poll();
  expect(visitors.notice.value).toEqual({ kind: 'departure', visitor: alice });
  visitors.dismissNotice();
  await poll();
  expect(visitors.notice.value).toBeNull();
});

it('does not invent departures during an outage or repeat arrivals on recovery', async () => {
  await vi.advanceTimersByTimeAsync(0);
  result = { present: [alice] };
  await poll();
  visitors.dismissNotice();
  townVisitors.mockRejectedValueOnce(new Error('offline'));
  await poll();
  expect(visitors.present.value).toEqual([]);
  expect(visitors.error.value).toBeTruthy();
  expect(visitors.notice.value).toBeNull();
  await vi.advanceTimersByTimeAsync(VISITOR_POLL_MS * 2);
  expect(visitors.present.value).toEqual([alice]);
  expect(visitors.notice.value).toBeNull();
  result = { present: [] };
  await poll();
  expect(visitors.notice.value).toEqual({ kind: 'departure', visitor: alice });
});

it('clears notices and stops polling in puzzles, and does not replay arrivals on return', async () => {
  await vi.advanceTimersByTimeAsync(0);
  result = { present: [alice] };
  await poll();
  state.active = false;
  await nextTick();
  expect(visitors.notice.value).toBeNull();
  const requests = townVisitors.mock.calls.length;
  await vi.advanceTimersByTimeAsync(30000);
  expect(townVisitors).toHaveBeenCalledTimes(requests);
  state.active = true;
  await nextTick();
  await vi.advanceTimersByTimeAsync(0);
  expect(visitors.present.value).toEqual([alice]);
  expect(visitors.notice.value).toBeNull();
});

it('clears old-town notices and fences an in-flight response when switching towns', async () => {
  await vi.advanceTimersByTimeAsync(0);
  result = { present: [alice] };
  await poll();
  let resolve;
  townVisitors.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await poll();
  townStorage.active.mockReturnValue({ meta: { id: 'town-b', owner: 'owner' } });
  result = { present: [anonymous] };
  cloud.storageVersion++;
  await nextTick();
  await vi.advanceTimersByTimeAsync(0);
  resolve({ present: [] });
  await vi.advanceTimersByTimeAsync(0);
  expect(visitors.townId.value).toBe('town-b');
  expect(visitors.present.value).toEqual([anonymous]);
  expect(visitors.notice.value).toBeNull();
  expect(townVisitors).toHaveBeenLastCalledWith('town-b');
});

it('renders accessible, localized notices with public names and no visitor IDs', async () => {
  for (const [language, kind, visitor, text] of [
    ['en', 'arrival', alice, 'Alice · Mayor of Silver Creek arrived in your town.'],
    ['en', 'departure', anonymous, 'Visitor left your town.'],
    ['fr', 'departure', alice, 'Alice · Maire de Silver Creek a quitté votre ville.'],
  ]) {
    setLocale(language);
    const html = await renderToString(
      createSSRApp(TownVisitorNotice, { notice: { kind, visitor } }),
    );
    expect(html).toContain(text);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain(visitor.id);
  }
});

it('announces and credits a collection once across live polls and cached account receipts', async () => {
  await vi.advanceTimersByTimeAsync(0);
  result = { present: [], saloonCollectedAt: 1000 };
  await poll();
  expect(visitors.notice.value).toEqual({ kind: 'collection', coins: 120 });
  visitors.dismissNotice();
  cloud.towns = [{ townId: 'town-a', saloonCollectedAt: 1000 }];
  await nextTick();
  await poll();
  expect(visitors.notice.value).toBeNull();
  state.active = false;
  await nextTick();
  result = { present: [], saloonCollectedAt: 2000 };
  cloud.towns = [{ townId: 'town-a', saloonCollectedAt: 2000 }];
  await poll();
  expect(collectedAt).toBe(1000);
  expect(visitors.notice.value).toBeNull();
  state.active = true;
  await nextTick();
  await vi.advanceTimersByTimeAsync(0);
  expect(collectedAt).toBe(2000);
  expect(visitors.notice.value).toEqual({ kind: 'collection', coins: 120 });
  visitors.dismissNotice();
  expect(visitors.notice.value).toBeNull();
});

// Every tap on a far-off animal asks to zoom in; the hint waits once, not once per tap.
it('queues a repeated tap hint once while it waits', async () => {
  await vi.advanceTimersByTimeAsync(0);
  visitors.enqueue([{ kind: 'helmet-zoom' }]);
  visitors.enqueue([{ kind: 'helmet-zoom' }]);
  expect(visitors.notice.value).toEqual({ kind: 'helmet-zoom' });
  visitors.dismissNotice();
  expect(visitors.notice.value).toBeNull();
  visitors.enqueue([{ kind: 'helmet-zoom' }]);
  expect(visitors.notice.value).toEqual({ kind: 'helmet-zoom' });
  // Notices with their own details still queue each time.
  visitors.enqueue([{ kind: 'collection', coins: 120 }]);
  visitors.enqueue([{ kind: 'collection', coins: 120 }]);
  visitors.dismissNotice();
  visitors.dismissNotice();
  expect(visitors.notice.value).toEqual({ kind: 'collection', coins: 120 });
  for (const [language, text] of [
    ['en', 'Zoom in closer to the animals to find the astronaut.'],
    ['fr', 'Zoomez plus près des animaux pour trouver l’astronaute.'],
  ]) {
    setLocale(language);
    const html = await renderToString(
      createSSRApp(TownVisitorNotice, { notice: { kind: 'helmet-zoom' } }),
    );
    expect(html).toContain(text);
  }
});

it('renders a collection notification in French', async () => {
  setLocale('fr');
  const html = await renderToString(
    createSSRApp(TownVisitorNotice, { notice: { kind: 'collection', coins: 120 } }),
  );
  expect(html).toContain('120');
  expect(html).toContain('saloon');
  expect(html).toContain('role="status"');
});

it('refreshes public guests, clears stale characters on failure and ignores old-town replies', async () => {
  let resolve;
  villageVisitors.mockResolvedValue({ present: [alice], history: [alice] });
  const route = reactive({ id: 'public-a' });
  const publicVisitors = scope.run(() => useVillageVisitors(() => route.id));
  await vi.advanceTimersByTimeAsync(0);
  expect(publicVisitors.snapshot.value.present).toEqual([alice]);
  villageVisitors.mockRejectedValueOnce(new Error('offline'));
  await poll();
  expect(publicVisitors.snapshot.value.present).toEqual([]);
  expect(publicVisitors.snapshot.value.history).toEqual([alice]);
  expect(publicVisitors.error.value).toBeTruthy();
  await vi.advanceTimersByTimeAsync(VISITOR_POLL_MS * 2);
  expect(publicVisitors.snapshot.value.present).toEqual([alice]);
  villageVisitors.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await poll();
  villageVisitors.mockResolvedValue({ present: [anonymous] });
  route.id = 'public-b';
  await nextTick();
  await vi.advanceTimersByTimeAsync(0);
  resolve({ present: [alice] });
  await vi.advanceTimersByTimeAsync(0);
  expect(publicVisitors.snapshot.value.present).toEqual([anonymous]);
  route.id = null;
  await nextTick();
  const requests = villageVisitors.mock.calls.length;
  await poll();
  expect(publicVisitors.snapshot.value).toBeNull();
  expect(villageVisitors).toHaveBeenCalledTimes(requests);
});
