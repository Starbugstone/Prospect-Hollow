import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Box3, Group, Scene } from 'three';
import { createTown } from '../src/data/town';
import { landmarkOffer, areaChoice, areaMaximum, LANDMARK_BY_ID } from '../src/data/townLandmarks';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { isEraComplete } from '../src/game/town/TownEras';
import { riverDistance, RIVER } from '../src/game/town/TownRiver';
import { ERAS } from '../src/data/eras';
import { CREST_EMBLEMS, CREST_EMBLEM_IDS } from '../src/data/townCrests';
import {
  PERSONAL_AREAS,
  DEFAULT_EMBLEM_COLOUR,
  areaStage,
  areaUnlocked,
  createPersonalisation,
  normalizePersonalisation,
  personaliseTown,
} from '../src/data/townPersonalisation';
import { normalizeTown } from '../src/game/town/TownRules';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { buildPlot, plotSignatures } from '../src/game/town/TownPlots';
import {
  buildPersonalAreas,
  buildTownBanner,
  buildMinePlaque,
  plaqueDefinition,
} from '../src/game/town/TownPersonalisation';
import { TownScenery } from '../src/game/town/TownScenery';
import { TownStatics } from '../src/game/town/TownStatics';
import { sceneryObstacles } from '../src/game/town/TownNavigation';
import { PLOTS } from '../src/game/town/TownLayout';
import { villageAppearance } from '../src/services/publicVillage';
import { useCampaignStore } from '../src/stores/campaignStore';
import { HONOURS } from '../src/data/honours';
import { addPerson } from '../src/game/town/TownPeople';

const edit = (town, command, earned = []) =>
  personaliseTown(town, command, CREST_EMBLEM_IDS, earned);
const buy = (town, area, choice = area.choices[0]) => {
  const offer = landmarkOffer(town, area, choice);
  return edit(town, {
    kind: 'area',
    id: area.id,
    slot: 0,
    value: choice,
    expectedChoice: offer?.expectedChoice,
    expectedLevel: offer?.expectedLevel,
  });
};
const crest = {
  shape: 'swallowtail',
  pattern: 'quartered',
  emblem: 'otter',
  primary: '#367673',
  secondary: '#e8bf79',
  emblemColour: '#9f4f48',
};
const views = [];
function fixture(town = createTown()) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = town;
  d.world = new Group();
  d.scene = new Scene();
  d.scene.add(d.world);
  d.sign = () => {};
  d.motions = [];
  d.actors = [];
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) d.disposePrimitives();
  vi.unstubAllGlobals();
});

describe('Personalisation save and progression contract', () => {
  it('keeps a legacy town visually original and normalization idempotent', () => {
    const old = createTown();
    delete old.personalisation;
    old.buildings.home = 2;
    const loaded = normalizeTown(old);
    expect(loaded.personalisation).toEqual(createPersonalisation());
    expect(edit(loaded, { kind: 'choice', id: 'home', value: 'garden' })).toBeNull();
    expect(normalizeTown(loaded)).toEqual(loaded);
    expect(normalizeTown(createTown())).toEqual(createTown());
  });
  it('supports a broad authored library without duplicate or empty emblems', () => {
    expect(CREST_EMBLEMS.length).toBeGreaterThanOrEqual(60);
    expect(CREST_EMBLEMS.filter((e) => e.category === 'Animals').length).toBeGreaterThanOrEqual(25);
    expect(new Set(CREST_EMBLEM_IDS).size).toBe(CREST_EMBLEM_IDS.length);
    for (const emblem of CREST_EMBLEMS) expect(emblem.path).toMatch(/^M/);
  });
  it.each([
    null,
    [],
    12,
    'bad',
    {
      crest: { shape: 'shield', emblem: '<script>' },
      paint: {
        home: { walls: 'url(bad)', roof: '#ABCDEF', extra: '#123456' },
        unknown: { walls: '#123456' },
      },
      clothing: { skin: '#000000' },
      areas: { meadow: ['unknown', 'pavilion', 'workshop'] },
    },
  ])('bounds malformed and future fields: %j', (saved) => {
    const p = normalizePersonalisation(saved, CREST_EMBLEM_IDS);
    expect(p.crest).toBeNull();
    expect(p.paint).toBeUndefined();
    expect(p.choices).toBeUndefined();
    expect(p.clothing).toBeUndefined();
    expect(normalizePersonalisation(p, CREST_EMBLEM_IDS)).toEqual(p);
  });
  it.each(PERSONAL_AREAS)(
    'develops $id through the final era without gating progression',
    (area) => {
      let town = createTown();
      town.coins = 1e9;
      const intro = ERAS.findIndex((e) => e.id === area.era);
      if (intro) {
        town.era = ERAS[intro - 1].id;
        expect(buy(town, area)).toBeNull();
      }
      town.era = area.era;
      const gate = isEraComplete(town);
      town = buy(town, area);
      expect(isEraComplete(town)).toBe(gate);
      expect(areaStage(town, area)).toBe(1);
      if (area.timeless) return;
      expect(buy(town, area, area.choices[1])).toBeNull();
      for (const era of ERAS.slice(intro)) {
        town.era = era.id;
        while (areaStage(town, area) < areaMaximum(town, area)) {
          const before = town.coins,
            offer = landmarkOffer(town, area, area.choices[0]);
          town = buy(town, area);
          expect(before - town.coins).toBe(offer.price);
          expect(normalizeTown(JSON.parse(JSON.stringify(town))).personalisation).toEqual(
            town.personalisation,
          );
        }
        expect(buy(town, area)).toBeNull();
      }
      town.era = 'unknown-successor';
      expect(areaUnlocked(town, area)).toBe(false);
    },
  );
  it.each(PERSONAL_AREAS.find((a) => a.timeless).choices)(
    'charges the full price of monument %s once, rejects stale submissions and never replaces it',
    (choice) => {
      const area = PERSONAL_AREAS.find((a) => a.timeless);
      let town = createTown();
      town.era = 'industrial';
      town.coins = 100000;
      const offer = landmarkOffer(town, area, choice);
      const command = {
        kind: 'area',
        id: area.id,
        value: choice,
        slot: 0,
        expectedChoice: offer.expectedChoice,
        expectedLevel: offer.expectedLevel,
      };
      expect(edit({ ...town, coins: offer.price - 1 }, command)).toBeNull();
      town = edit(town, command);
      expect(town.coins).toBe(100000 - LANDMARK_BY_ID[choice].price);
      expect(areaChoice(town, area)).toBe(choice);
      expect(edit(town, command)).toBeNull();
      for (const other of area.choices) expect(buy(town, area, other)).toBeNull();
      town.era = ERAS.at(-1).id;
      for (const other of area.choices) expect(landmarkOffer(town, area, other)).toBeNull();
      expect(areaStage(town, area)).toBe(1);
    },
  );
  it.each(PERSONAL_AREAS.filter((a) => !a.timeless))(
    'keeps the first monument built on $id through every later era',
    (area) => {
      let town = createTown();
      town.era = area.era;
      town.coins = 1e9;
      town = buy(town, area, area.choices[1]);
      for (const era of ERAS.slice(ERAS.findIndex((e) => e.id === area.era))) {
        town.era = era.id;
        for (const other of area.choices.filter((c) => c !== area.choices[1]))
          expect(buy(town, area, other)).toBeNull();
      }
      expect(areaChoice(town, area)).toBe(area.choices[1]);
    },
  );
  it('extends landmark upgrade capacity through a newly registered era', () => {
    const area = PERSONAL_AREAS[0],
      town = createTown();
    town.era = ERAS.at(-1).id;
    town.coins = 1000000;
    town.personalisation.areas[area.id] = [area.choices[0]];
    town.personalisation.areaLevels[area.id] = areaMaximum(town, area);
    const previous = areaStage(town, area);
    ERAS.push({ ...ERAS.at(-1), id: 'personalisation-future-era' });
    try {
      town.era = 'personalisation-future-era';
      expect(areaMaximum(town, area)).toBe(previous + 3);
      const upgraded = buy(town, area);
      expect(
        normalizePersonalisation(upgraded.personalisation, CREST_EMBLEM_IDS).areaLevels[area.id],
      ).toBe(previous + 1);
    } finally {
      ERAS.pop();
    }
  });
  it.each([1, 2])(
    'drops retired version %s cosmetics while preserving the crest and paid plots',
    (version) => {
      const town = createTown();
      town.personalisation = {
        version,
        crest: { ...crest, emblemColour: undefined },
        paint: { all: { walls: '#abcdef' }, home: { roof: '#123456' } },
        choices: { home: 'garden' },
        clothing: { shirt: '#123456' },
        areas: { meadow: ['roundhouse'] },
        areaLevels: { meadow: 2 },
        plaques: { home: 'player-alpha', meadow: 'player-alpha', mine: 'player-alpha' },
      };
      const loaded = normalizeTown(town);
      expect(loaded.personalisation).toEqual({
        version: 3,
        crest: { ...crest, emblemColour: DEFAULT_EMBLEM_COLOUR },
        areas: { meadow: ['roundhouse'] },
        areaLevels: { meadow: 2 },
        plaques: { mine: 'player-alpha' },
      });
      expect(normalizeTown(loaded)).toEqual(loaded);
      for (const command of [
        { kind: 'paint', group: 'walls', value: '#123456' },
        { kind: 'choice', id: 'home', value: 'garden' },
        { kind: 'clothing', group: 'shirt', value: '#123456' },
        { kind: 'plaque', id: 'home', value: 'player-alpha' },
        { kind: 'plaque', id: 'meadow', value: 'player-alpha' },
      ])
        expect(edit(loaded, command, ['player-alpha'])).toBeNull();
      expect(edit(loaded, { kind: 'plaque', id: 'mine', value: 'unearned' })).toBeNull();
      expect(
        edit(loaded, { kind: 'plaque', id: 'mine', value: null }).personalisation.plaques,
      ).toEqual({});
    },
  );
  it('bounds the emblem colour and preserves it independently from both banner colours', () => {
    const town = edit(createTown(), {
      kind: 'crest',
      value: { ...crest, emblemColour: '#ABCDEF' },
    });
    expect(normalizeTown(town).personalisation.crest).toEqual({
      ...crest,
      emblemColour: '#abcdef',
    });
    expect(edit(town, { kind: 'crest', value: { ...crest, emblemColour: 'url(bad)' } })).toBeNull();
    town.personalisation.crest.emblemColour = 'bad';
    expect(normalizeTown(town).personalisation.crest.emblemColour).toBe(DEFAULT_EMBLEM_COLOUR);
  });
  it('rejects an invalid crest command without silently removing the existing banner', () => {
    const town = edit(createTown(), { kind: 'crest', value: crest });
    expect(edit(town, { kind: 'crest', value: { ...crest, emblem: 'unknown' } })).toBeNull();
    expect(town.personalisation.crest).toEqual(crest);
  });
  it('publishes the same cosmetic render state without mutating the owner or visiting player', () => {
    let town = edit(createTown(), { kind: 'crest', value: crest });
    town.coins = 10000;
    town = buy(town, PERSONAL_AREAS[0]);
    const visit = villageAppearance({ appearance: JSON.parse(JSON.stringify(town)) });
    expect(visit.personalisation).toEqual(town.personalisation);
    visit.personalisation.crest.primary = '#ffffff';
    expect(town.personalisation.crest.primary).toBe(crest.primary);
  });
  it('saves all edits atomically through the campaign store and restores them', () => {
    const values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    });
    setActivePinia(createPinia());
    const campaign = useCampaignStore();
    const before = JSON.stringify(campaign.town);
    expect(
      campaign.personalise([
        { kind: 'crest', value: crest },
        { kind: 'area', id: 'invalid', slot: 0, value: 'pavilion' },
      ]),
    ).toBe(false);
    expect(JSON.stringify(campaign.town)).toBe(before);
    expect(campaign.personalise([{ kind: 'crest', value: crest }])).toBe(true);
    setActivePinia(createPinia());
    const restored = useCampaignStore();
    expect(restored.town.personalisation.crest).toEqual(crest);
    expect(restored.town.personalisation.paint).toBeUndefined();
  });
});

describe('Personalisation rendering', () => {
  it.each(ERAS.filter((e) => e.enabled).map((e) => e.id))(
    'ignores removed building cosmetics in %s without changing original artwork',
    (era) => {
      const town = createTown();
      town.era = era;
      town.buildings.home = 2;
      town.buildingEras.home = era;
      town.buildingEraLevels.home = 3;
      const d = fixture(town);
      const original = new Group();
      buildPlot(d, 'home', original, town, { home: 'Home' });
      town.personalisation.paint = { all: { walls: '#ab1234', roof: '#ab1234' } };
      town.personalisation.choices = { home: 'garden' };
      town.personalisation.plaques.mine = 'player-alpha';
      town.displayDistinctions = { 'player-alpha': { at: 1 } };
      const legacy = new Group();
      buildPlot(d, 'home', legacy, town, { home: 'Home' });
      const parts = (root) => {
        const result = [];
        root.traverse((m) => {
          if (m.isMesh)
            result.push([
              m.geometry.uuid,
              m.material.uuid,
              m.position.toArray(),
              m.scale.toArray(),
            ]);
        });
        return result;
      };
      expect(parts(legacy)).toEqual(parts(original));
    },
  );
  it('reserves real navigation obstacles for each garden choice, clear of existing plots', () => {
    for (const area of PERSONAL_AREAS)
      for (const choice of area.choices) {
        const town = createTown();
        town.era = area.era;
        town.personalisation.areas[area.id] = [choice];
        const d = fixture(town),
          root = buildPersonalAreas(d, town);
        const [ax, az] = area.positions[0];
        const obstacles = sceneryObstacles(root).filter(
          (o) => Math.hypot(o.x - ax, o.z - az) < area.radius,
        );
        expect(obstacles).toHaveLength(1);
        expect(obstacles[0].radius).toBe(area.radius);
        for (const obstacle of obstacles)
          for (const [x, z] of Object.values(PLOTS))
            expect(Math.hypot(x - obstacle.x, z - obstacle.z)).toBeGreaterThan(5);
        expect(root.children.map((g) => g.userData.monumentSite)).toEqual(
          PERSONAL_AREAS.filter((a) => areaUnlocked(town, a)).map((a) => a.id),
        );
      }
  });
  it('marks every open monument site of an unlocked era, and no site of a later era', () => {
    for (const era of ERAS) {
      const town = createTown();
      town.era = era.id;
      const d = fixture(town),
        root = buildPersonalAreas(d, town);
      const open = PERSONAL_AREAS.filter((a) => areaUnlocked(town, a));
      if (!open.length) {
        expect(root).toBeNull();
        continue;
      }
      expect(root.children.map((g) => g.userData.monumentSite)).toEqual(open.map((a) => a.id));
      for (const site of root.children) {
        const area = PERSONAL_AREAS.find((a) => a.id === site.userData.monumentSite);
        expect(site.name).toBe(`${area.id} 0: open site`);
        // A small plinth: walkers keep using the open court.
        expect(sceneryObstacles(site).every((o) => o.radius < 2)).toBe(true);
        expect(new Box3().setFromObject(site).max.y - site.position.y).toBeLessThan(2);
      }
    }
  });
  it('keeps all new parcels clear of one another, the river and existing buildings', () => {
    for (const area of PERSONAL_AREAS) {
      const [x, z] = area.positions[0];
      expect(riverDistance(x, z)).toBeGreaterThan(area.radius + RIVER.bankWidth);
      for (const other of PERSONAL_AREAS)
        if (area !== other)
          expect(Math.hypot(x - other.positions[0][0], z - other.positions[0][1])).toBeGreaterThan(
            area.radius + other.radius + 2,
          );
      for (const [px, pz] of Object.values(PLOTS))
        expect(Math.hypot(x - px, z - pz)).toBeGreaterThan(area.radius + 4);
    }
  });
  it('renders distinct monument silhouettes that never change with age or upgrades', () => {
    const d = fixture(),
      signatures = new Set();
    const signature = (root) => {
      const meshes = [];
      root.traverse((m) => {
        if (m.isMesh)
          meshes.push([
            m.geometry.type,
            m.position.toArray(),
            m.scale.toArray(),
            m.rotation.toArray(),
            m.material.color.getHexString(),
          ]);
      });
      return JSON.stringify(meshes);
    };
    for (const choice of PERSONAL_AREAS.find((a) => a.timeless).choices) {
      const initial = signature(buildLandmark(d, new Group(), choice, 1, true));
      expect(signature(buildLandmark(d, new Group(), choice, 33, true))).toBe(initial);
      signatures.add(initial);
    }
    expect(signatures.size).toBe(5);
    for (const area of PERSONAL_AREAS.filter((a) => !a.timeless))
      for (const choice of area.choices) {
        const stages = new Set();
        for (let stage = 1; stage <= areaMaximum({ era: ERAS.at(-1).id }, area); stage++) {
          const root = buildLandmark(d, new Group(), choice, stage);
          stages.add(signature(root));
          const bounds = new Box3().setFromObject(root);
          expect(
            Math.max(
              Math.abs(bounds.min.x),
              Math.abs(bounds.max.x),
              Math.abs(bounds.min.z),
              Math.abs(bounds.max.z),
            ),
          ).toBeLessThanOrEqual(area.radius);
        }
        expect(stages.size).toBe(areaMaximum({ era: ERAS.at(-1).id }, area));
      }
  });
  it('keeps a blank hill for legacy towns and builds an identified banner when chosen', () => {
    const town = createTown(),
      d = fixture(town);
    expect(buildTownBanner(d, town)).toBeNull();
    town.personalisation.crest = crest;
    expect(buildTownBanner(d, town).getObjectByName('Crest emblem: otter')).toBeTruthy();
  });
  it('uses the chosen emblem ink in the hill banner texture', () => {
    const ctx = Object.fromEntries(
      ['scale', 'clip', 'fillRect', 'fill', 'beginPath', 'arc', 'translate', 'stroke'].map(
        (name) => [name, vi.fn()],
      ),
    );
    vi.stubGlobal('Path2D', class {});
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
    const town = edit(createTown(), { kind: 'crest', value: crest });
    const banner = buildTownBanner(fixture(town), town);
    expect(ctx.stroke).toHaveBeenCalledOnce();
    expect(ctx.strokeStyle).toBe(crest.emblemColour);
    const material = banner.getObjectByName('Crest emblem: otter').material;
    material.map.dispose();
    material.dispose();
  });
  it('only displays earned town honours or verified player distinctions', () => {
    const town = createTown(),
      rank = HONOURS.definitions[0];
    town.personalisation.plaques.mine = rank.id;
    expect(plaqueDefinition(town)).toBeNull();
    town.displayHonours = { earned: { [rank.id]: {} } };
    expect(plaqueDefinition(town)).toBe(rank);
    town.personalisation.plaques.mine = 'player-alpha';
    expect(plaqueDefinition(town)).toBeNull();
    town.displayDistinctions = { 'player-alpha': { at: 1 } };
    expect(plaqueDefinition(town).id).toBe('player-alpha');
  });
  it('keeps every building cached when the crest, badge or obsolete paint changes', () => {
    const town = createTown();
    town.buildings.home = town.buildings.well = 1;
    const before = plotSignatures({}, town, {});
    town.personalisation.paint = { all: { roof: '#123456' } };
    town.personalisation.choices = { home: 'garden' };
    town.personalisation.crest = crest;
    town.personalisation.plaques.mine = 'player-alpha';
    town.displayDistinctions = { 'player-alpha': { at: 1 } };
    expect(plotSignatures({}, town, {})).toEqual(before);
  });
  it('mounts the single earned badge above the mineshaft on the sloping rock face', () => {
    const town = edit(createTown(), { kind: 'plaque', id: 'mine', value: 'player-alpha' }, [
      'player-alpha',
    ]);
    const d = fixture(town);
    expect(buildMinePlaque(d, town)).toBeNull();
    town.displayDistinctions = { 'player-alpha': { at: 1 } };
    const plaque = buildMinePlaque(d, town);
    const bounds = new Box3().setFromObject(plaque);
    expect(bounds.min.y).toBeGreaterThan(2);
    expect(bounds.max.y).toBeLessThan(4);
    expect(plaque.position.x).toBe(0);
    expect(plaque.position.z).toBeLessThan(PLOTS.mine[1]);
    expect(plaque.position.z).toBeGreaterThan(PLOTS.mine[1] - 1);
    expect(plaque.rotation.x).toBeLessThan(0);
    expect(plaque.userData.distinction).toBe('player-alpha');
  });
  it('flutters only the cloth and retires its animation and geometry when replaced or removed', () => {
    const town = edit(createTown(), { kind: 'crest', value: crest });
    const d = fixture(town),
      scenery = new TownScenery();
    scenery.update(d, town);
    const banner = scenery.entries.get('town-banner').group;
    const cloth = banner.getObjectByName('Crest emblem: otter');
    const positions = cloth.geometry.attributes.position;
    const before = Array.from(positions.array);
    const material = cloth.material,
      geometry = cloth.geometry;
    const motion = banner.userData.sceneryUpdate;
    expect(d.motions.filter((m) => m === motion)).toHaveLength(1);
    motion(2);
    expect(Array.from(positions.array)).not.toEqual(before);
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) > 1.39) expect(positions.getZ(i)).toBeCloseTo(0);
      expect(Math.abs(positions.getZ(i))).toBeLessThan(0.15);
    }
    expect(cloth.material).toBe(material);
    expect(cloth.geometry).toBe(geometry);
    expect(cloth.layers.mask).toBe(1 << 2);
    const statics = new TownStatics(d.scene);
    statics.sync([banner]);
    expect(cloth.visible).toBe(true);
    expect(cloth.parent.visible).toBe(true);
    const disposed = vi.fn();
    geometry.addEventListener('dispose', disposed);
    const same = scenery.update(d, town);
    expect(same).toEqual([]);
    expect(d.motions.filter((m) => m === motion)).toHaveLength(1);
    const next = edit(town, { kind: 'crest', value: { ...crest, emblem: 'fox' } });
    expect(scenery.update(d, next)).toEqual(['town-banner']);
    expect(d.motions).not.toContain(motion);
    expect(disposed).toHaveBeenCalledOnce();
    const nextMotion = scenery.entries.get('town-banner').group.userData.sceneryUpdate;
    // A full scene rebuild clears motions, then reattaches retained scenery.
    scenery.detach();
    d.motions = [];
    scenery.update(d, next);
    expect(d.motions.filter((m) => m === nextMotion)).toHaveLength(1);
    scenery.update(d, edit(next, { kind: 'crest', value: null }));
    expect(d.motions).not.toContain(nextMotion);
    expect(scenery.entries.get('town-banner').group).toBeNull();
    statics.dispose();
    scenery.dispose(d);
    expect(d.motions).toEqual([]);
  });
  it.each(ERAS.filter((e) => e.enabled).map((e) => e.id))(
    'ignores legacy clothing overrides and preserves individual outfits in %s',
    (era) => {
      const town = createTown();
      town.era = era;
      town.personalisation.clothing = {
        shirt: '#123456',
        trousers: '#234567',
        hat: '#345678',
        accent: '#456789',
      };
      const d = fixture(town);
      const args = {
        color: '#889977',
        skin: '#ca9876',
        hat: '#997755',
        route: [
          [0, 0],
          [1, 1],
        ],
        seed: 42,
        manual: true,
      };
      const resident = addPerson(d, args);
      const originalTown = createTown();
      originalTown.era = era;
      const original = addPerson(fixture(originalTown), args);
      expect(resident.shirt.material.color.getHexString()).toBe(
        original.shirt.material.color.getHexString(),
      );
      expect(resident.clothing.trousers.map((m) => m.material.color.getHexString())).toEqual(
        original.clothing.trousers.map((m) => m.material.color.getHexString()),
      );
      const officer = addPerson(d, { ...args, sheriff: true });
      expect(officer.shirt.material.color.getHexString()).not.toBe('123456');
      expect([...d.materials.keys()]).toContain('#ca9876');
    },
  );
});
