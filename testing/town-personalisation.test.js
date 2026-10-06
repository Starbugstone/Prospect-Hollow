import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Box3, Group, Scene } from 'three';
import { createTown } from '../src/data/town';
import { landmarkOffer, areaMaximum, LANDMARK_BY_ID } from '../src/data/townLandmarks';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { isEraComplete } from '../src/game/town/TownEras';
import { riverDistance, RIVER } from '../src/game/town/TownRiver';
import { ERAS } from '../src/data/eras';
import { CREST_EMBLEMS, CREST_EMBLEM_IDS } from '../src/data/townCrests';
import {
  BUILDING_CHOICES,
  PERSONAL_AREAS,
  PAINT_GROUPS,
  areaStage,
  areaUnlocked,
  choiceLocked,
  createPersonalisation,
  normalizePersonalisation,
  personaliseTown,
} from '../src/data/townPersonalisation';
import {
  normalizeTown,
  purchase,
  buildWithHammer,
  advanceConstruction,
  finishConstruction,
} from '../src/game/town/TownRules';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { buildPlot, plotSignatures } from '../src/game/town/TownPlots';
import { paintBuilding } from '../src/game/town/TownPaint';
import { buildingPaintRole } from '../src/data/buildingPaint';
import {
  addBuildingChoice,
  buildPersonalAreas,
  buildTownBanner,
  plaqueDefinition,
} from '../src/game/town/TownPersonalisation';
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
    const town = createTown();
    const p = normalizePersonalisation(saved, town, CREST_EMBLEM_IDS);
    expect(p.crest).toBeNull();
    expect(p.paint.unknown).toBeUndefined();
    expect(p.clothing.skin).toBeUndefined();
    expect(p.paint.home?.walls).toBeUndefined();
    expect(p.paint.home?.extra).toBeUndefined();
    expect(normalizePersonalisation(p, town, CREST_EMBLEM_IDS)).toEqual(p);
  });
  it.each(Object.entries(BUILDING_CHOICES))(
    'locks %s at construction and preserves each alternative on reload',
    (id, choices) => {
      for (const value of choices) {
        let town = createTown();
        town.coins = 1e7;
        town = edit(town, { kind: 'choice', id, value });
        expect(town).not.toBeNull();
        town.projects[id] = { id, stage: 1, wins: 0, required: 1 };
        expect(choiceLocked(town, id)).toBe(true);
        expect(edit(town, { kind: 'choice', id, value: choices.at(-1) })).toBeNull();
        expect(
          normalizePersonalisation(
            JSON.parse(JSON.stringify(town.personalisation)),
            town,
            CREST_EMBLEM_IDS,
          ).choices[id] ?? 'original',
        ).toBe(value);
      }
    },
  );
  it.each(['coins', 'hammer'])(
    'carries a selected frontage through a real %s construction',
    (method) => {
      let town = edit(createTown(), { kind: 'choice', id: 'home', value: 'orchard' });
      expect(town).toBeNull(); // Not a home option.
      town = edit(createTown(), { kind: 'choice', id: 'home', value: 'garden' });
      town = purchase(town, 'well', 0);
      town.coins = 10000;
      town = method === 'hammer' ? buildWithHammer(town, 'home', 0) : purchase(town, 'home', 0);
      if (town.projects.home) {
        town = advanceConstruction(town);
        town = finishConstruction(town, 'home', 1);
      }
      expect(town.buildings.home).toBe(1);
      expect(normalizeTown(town).personalisation.choices.home).toBe('garden');
      expect(edit(town, { kind: 'choice', id: 'home', value: 'veranda' })).toBeNull();
    },
  );
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
  it('charges full monument prices, rejects stale submissions and never refunds replacements', () => {
    const area = PERSONAL_AREAS.find((a) => a.timeless);
    let town = createTown();
    town.era = 'industrial';
    town.coins = 100000;
    for (const choice of area.choices) {
      const before = town.coins,
        offer = landmarkOffer(town, area, choice);
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
      expect(town.coins).toBe(before - LANDMARK_BY_ID[choice].price);
      expect(edit(town, command)).toBeNull();
      expect(buy(town, area, choice)).toBeNull();
      expect(areaStage(town, area)).toBe(1);
    }
  });
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
        normalizePersonalisation(upgraded.personalisation, upgraded, CREST_EMBLEM_IDS).areaLevels[
          area.id
        ],
      ).toBe(previous + 1);
    } finally {
      ERAS.pop();
    }
  });
  it('rejects an invalid crest command without silently removing the existing banner', () => {
    const town = edit(createTown(), { kind: 'crest', value: crest });
    expect(edit(town, { kind: 'crest', value: { ...crest, emblem: 'unknown' } })).toBeNull();
    expect(town.personalisation.crest).toEqual(crest);
  });
  it('publishes the same cosmetic render state without mutating the owner or visiting player', () => {
    let town = edit(createTown(), { kind: 'crest', value: crest });
    town = edit(town, { kind: 'paint', id: 'home', group: 'walls', value: '#112233' });
    town = edit(town, { kind: 'clothing', group: 'shirt', value: '#334455' });
    town.coins = 10000;
    town = buy(town, PERSONAL_AREAS[0]);
    const visit = villageAppearance({ appearance: JSON.parse(JSON.stringify(town)) });
    expect(visit.personalisation).toEqual(town.personalisation);
    visit.personalisation.paint.home.walls = '#ffffff';
    expect(town.personalisation.paint.home.walls).toBe('#112233');
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
    expect(
      campaign.personalise([
        { kind: 'crest', value: crest },
        { kind: 'clothing', group: 'hat', value: '#abcdef' },
      ]),
    ).toBe(true);
    setActivePinia(createPinia());
    const restored = useCampaignStore();
    expect(restored.town.personalisation.crest).toEqual(crest);
    expect(restored.town.personalisation.clothing.hat).toBe('#abcdef');
  });
});

describe('Personalisation rendering', () => {
  it.each(ERAS.filter((e) => e.enabled).map((e) => e.id))(
    'paints a home in %s without editing geometry or shared materials',
    (era) => {
      const town = createTown();
      town.era = era;
      town.buildings.home = 2;
      town.buildingEras.home = era;
      town.buildingEraLevels.home = 3;
      const d = fixture(town),
        root = new Group();
      buildPlot(d, 'home', root, town, { home: 'Home' });
      const before = [];
      root.traverse((m) => {
        if (m.isMesh) before.push([m, m.material, m.material.color?.getHexString(), m.geometry]);
      });
      const paint = Object.fromEntries(PAINT_GROUPS.map((g, i) => [g.id, `#${i + 1}12233`]));
      paintBuilding(d, root, paint, era);
      expect(before.some(([m, material]) => m.material !== material)).toBe(true);
      for (const [m, material, colour, geometry] of before) {
        expect(m.geometry).toBe(geometry);
        expect(material.color?.getHexString()).toBe(colour);
      }
    },
  );
  it('paints the actual Industrial main walls and roof, leaving window glass unchanged', () => {
    const town = createTown();
    town.era = 'industrial';
    town.buildings.home = 3;
    town.buildingEras.home = 'industrial';
    town.buildingEraLevels.home = 3;
    const d = fixture(town),
      root = new Group();
    buildPlot(d, 'home', root, town, { home: 'Home' });
    const surfaces = [];
    root.traverse((mesh) => {
      const colour = mesh.material?.color?.getHexString();
      if (['aa795f', '53726d', '9bbbbb'].includes(colour)) surfaces.push([mesh, colour]);
    });
    expect(surfaces.some(([, colour]) => colour === 'aa795f')).toBe(true);
    expect(surfaces.some(([, colour]) => colour === '53726d')).toBe(true);
    paintBuilding(d, root, { walls: '#83b5aa', roof: '#b54f5c' }, 'industrial');
    for (const [mesh, source] of surfaces)
      expect(mesh.material.color.getHexString()).toBe(
        { aa795f: '83b5aa', '53726d': 'b54f5c', '9bbbbb': '9bbbbb' }[source],
      );
    // The corresponding SVG preview uses these distinct authored colours.
    expect(buildingPaintRole('#b37e65', '', 'industrial')).toBe('walls');
    expect(buildingPaintRole('#66877b', '', 'industrial')).toBe('roof');
    expect(buildingPaintRole('#b5d1bd', '', 'industrial')).toBeNull();
  });
  it('renders every frontage distinctly and adds visible growth', () => {
    const d = fixture();
    const signatures = new Set();
    for (const choice of new Set(Object.values(BUILDING_CHOICES).flat())) {
      const counts = [];
      for (const level of [1, 3]) {
        const root = new Group();
        addBuildingChoice(d, root, choice, level);
        const parts = [];
        root.traverse((m) => {
          if (m.isMesh)
            parts.push([m.position.toArray(), m.scale.toArray(), m.material.color.getHexString()]);
        });
        counts.push(JSON.stringify(parts));
        const bounds = new Box3().setFromObject(root);
        if (choice !== 'original') {
          expect(bounds.min.x).toBeGreaterThan(-3);
          expect(bounds.max.x).toBeLessThan(3);
        }
      }
      if (choice !== 'original') expect(counts[0]).not.toBe(counts[1]);
      signatures.add(counts[1]);
    }
    expect(signatures.size).toBe(new Set(Object.values(BUILDING_CHOICES).flat()).size);
  });
  it('reserves real navigation obstacles for each garden choice, clear of existing plots', () => {
    for (const area of PERSONAL_AREAS)
      for (const choice of area.choices) {
        const town = createTown();
        town.era = area.era;
        town.personalisation.areas[area.id] = [choice];
        const d = fixture(town),
          root = buildPersonalAreas(d, town);
        const obstacles = sceneryObstacles(root);
        expect(obstacles).toHaveLength(1);
        for (const obstacle of obstacles)
          for (const [x, z] of Object.values(PLOTS))
            expect(Math.hypot(x - obstacle.x, z - obstacle.z)).toBeGreaterThan(5);
        expect(root.children).toHaveLength(1);
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
  it('only displays earned town honours or verified player distinctions', () => {
    const town = createTown(),
      rank = HONOURS.definitions[0];
    town.personalisation.plaques.home = rank.id;
    expect(plaqueDefinition(town, 'home')).toBeNull();
    town.displayHonours = { earned: { [rank.id]: {} } };
    expect(plaqueDefinition(town, 'home')).toBe(rank);
    town.personalisation.plaques.home = 'player-alpha';
    expect(plaqueDefinition(town, 'home')).toBeNull();
    town.displayDistinctions = { 'player-alpha': { at: 1 } };
    expect(plaqueDefinition(town, 'home').id).toBe('player-alpha');
  });
  it('invalidates a painted plot without invalidating a neighbour', () => {
    const town = createTown();
    town.buildings.home = town.buildings.well = 1;
    const before = plotSignatures({}, town, {});
    town.personalisation.paint.home = { roof: '#123456' };
    const after = plotSignatures({}, town, {});
    expect(before.get('home')).not.toBe(after.get('home'));
    expect(before.get('well')).toBe(after.get('well'));
  });
  it.each(ERAS.filter((e) => e.enabled).map((e) => e.id))(
    'uses town clothing for residents in %s, preserving skin and uniforms',
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
      expect(resident.shirt.material.color.getHexString()).toBe('123456');
      expect(
        resident.clothing.trousers.every((m) => m.material.color.getHexString() === '234567'),
      ).toBe(true);
      const officer = addPerson(d, { ...args, sheriff: true });
      expect(officer.shirt.material.color.getHexString()).not.toBe('123456');
      expect([...d.materials.keys()]).toContain('#ca9876');
    },
  );
});
