import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, BUILDING_BY_ID, MOON_BUILDINGS, createTown } from '../src/data/town';
import { TOWN_PRESENTATIONS, queueBuildingPresentations } from '../src/data/townPresentations';
import {
  canPresentEvent,
  eventSettlement,
  townEventStage,
} from '../src/game/town/TownEventSettlement';
import { raidBounty } from '../src/game/town/TownRules';
import { useCampaignStore } from '../src/stores/campaignStore';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => saves.get(k) ?? null,
    setItem: (k, v) => saves.set(k, v),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());
const stage = (town, settlement, extra = {}) =>
  townEventStage({ town, settlement, definitions: TOWN_PRESENTATIONS, ...extra });

it.each(
  ['bandits', 'cargo-theft', 'workshop-fire', 'storm-cleanup'].flatMap((kind) =>
    ['stolen', 'protected'].map((outcome) => ({ kind, outcome })),
  ),
)(
  'holds $kind ($outcome) on the Moon across return/reload and acknowledges its unchanged outcome once',
  ({ kind, outcome }) => {
    const store = useCampaignStore();
    store.town = createTown();
    store.town.completedRuns = 1;
    const receipt = {
      id: 77,
      kind,
      atRun: 1,
      outcome,
      loss: outcome === 'stolen' ? 23 : 0,
      seen: false,
      gangSize: 4,
      sheriffLevel: 1,
      bankLevel: 0,
      targets: ['mine'],
    };
    store.town.events['dusty-trail-visitors'] = receipt;
    store.town.coins = 1000;
    const saved = JSON.stringify(store.town);
    for (let n = 0; n < 3; n++) {
      const view = stage(store.town, 'moon', { raid: receipt });
      expect(view.raid).toBeNull();
      expect(view.waiting.settlement).toBe('valley');
      expect(stage(store.town, 'moon', { raid: receipt, active: false }).waiting).toBeNull();
    }
    expect(JSON.stringify(store.town)).toBe(saved);
    store.save();
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    const event = reloaded.town.events['dusty-trail-visitors'];
    expect(stage(reloaded.town, 'valley', { raid: event }).raid).toMatchObject({
      id: receipt.id,
      loss: receipt.loss,
      outcome,
      seen: false,
    });
    const beforeReward = reloaded.town.coins;
    const reward = raidBounty(event);
    expect(reloaded.markRaidSeen(77)).toBe(true);
    const paid = reloaded.town.coins;
    expect(paid).toBe(beforeReward + reward);
    expect(reloaded.markRaidSeen(77)).toBe(false);
    expect(reloaded.town.coins).toBe(paid);
    expect(reloaded.town.events['dusty-trail-visitors'].loss).toBe(receipt.loss);
    expect(stage(reloaded.town, 'moon').waiting).toBeNull();
  },
);
it('holds era construction, railway, celebrations, monument unveiling and a saved guest in the valley', () => {
  const town = createTown();
  town.transition = { id: 'era-2', from: 'frontier', to: 'river-rail', pending: true };
  town.presentations = { 'railway-opening': 'pending', 'three-star-celebration': 'pending' };
  const monument = { id: 'monument-unveiling', area: 'hill' };
  const raid = { id: 4 };
  expect(stage(town, 'moon', { monument, raid }).presentation).toBeUndefined();
  expect(stage(town, 'moon', { monument, raid }).era).toBe(false);
  expect(stage(town, 'valley', { monument, raid })).toMatchObject({
    era: true,
    raid: null,
    presentation: null,
  });
  town.transition.pending = false;
  expect(stage(town, 'valley', { raid }).raid).toBe(raid);
  expect(stage(town, 'valley', { monument }).presentation).toBe(monument);
  expect(stage(town, 'valley').presentation.id).toBe('three-star-celebration');
  town.presentations = {};
  expect(stage(town, 'moon', { attention: [{ id: 'guest-5' }] }).waiting.settlement).toBe('valley');
});
it.each(MOON_BUILDINGS.map((b) => b.id))(
  'finishes %s on the Moon without a cinematic, like a valley building',
  (id) => {
    const before = createTown();
    const next = { ...before, buildings: { ...before.buildings, [id]: 1 } };
    const town = queueBuildingPresentations(before, next);
    expect(town.presentations).toEqual({});
    expect(stage(town, 'moon').presentation).toBeUndefined();
    expect(stage(town, 'valley').waiting).toBeNull();
    expect(Object.values(TOWN_PRESENTATIONS).some((d) => d.building === id)).toBe(false);
  },
);
it('selects a local presentation even when an older receipt waits in the other settlement; defaults unknown content to the valley', () => {
  const definitions = {
    ...TOWN_PRESENTATIONS,
    lunar: { id: 'lunar-test', building: 'roverBarn', duration: 1 },
  };
  const town = {
    ...createTown(),
    presentations: { 'railway-opening': 'pending', 'lunar-test': 'pending' },
  };
  expect(stage(town, 'moon', { definitions }).presentation.building).toBe('roverBarn');
  expect(eventSettlement({ building: 'roverBarn' })).toBe(BUILDING_BY_ID.roverBarn.settlement);
  expect(eventSettlement({ building: 'future-unknown', settlement: 'unimplemented' })).toBe(
    'valley',
  );
  expect(canPresentEvent(null, 'valley')).toBe(false);
  expect(canPresentEvent({ id: 'future', settlement: 'moon' }, 'moon', false)).toBe(false);
});

it('persists a real Moon construction completion without queueing a cinematic or paying twice', () => {
  const store = useCampaignStore();
  store.town = createTown();
  store.town.era = 'twin-hollows';
  for (const building of BUILDINGS) store.town.buildings[building.id] = building.upgrades.length;
  store.town.buildings.roverBarn = 0;
  store.town.projects.roverBarn = { id: 'roverBarn', stage: 1, required: 2, wins: 2 };
  const coins = store.town.coins;
  expect(store.finishConstruction('roverBarn', 1)).toBe(true);
  expect(store.finishConstruction('roverBarn', 1)).toBe(false);
  expect(store.town.buildings.roverBarn).toBe(1);
  expect(stage(store.town, 'valley').waiting).toBeNull();
  expect(stage(store.town, 'moon').presentation).toBeUndefined();
  setActivePinia(createPinia());
  const reloaded = useCampaignStore();
  expect(reloaded.town.buildings.roverBarn).toBe(1);
  expect(reloaded.town.coins).toBe(coins);
});
it('extends to a future settlement definition and safely ignores incomplete definitions', () => {
  const definitions = {
    bad: null,
    missingId: {},
    future: { id: 'future-moon', settlement: 'moon', building: 'future-lot' },
  };
  const town = { presentations: { 'future-moon': 'pending' } };
  expect(stage(town, 'moon', { definitions }).presentation).toBe(definitions.future);
  expect(stage(town, 'valley', { definitions }).waiting.settlement).toBe('moon');
});
