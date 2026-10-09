import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Box3, Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import {
  landmarkOffer,
  areaChoice,
  areaMaximum,
  LANDMARK_BY_ID,
  LANDMARK_OPTIONS,
  LANDMARK_PROGRESSION,
  advanceMonumentWorks,
  monumentWork,
  siteYaw,
  unveilLandmark,
} from '../src/data/townLandmarks';
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
import { projectPlaque } from '../src/game/town/TownLabelProjection';
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
// Completed puzzles finish the level under construction, then the player unveils it.
const finish = (town, area) => {
  const work = monumentWork(town, area);
  for (let n = 0; n < work.required; n++) town = advanceMonumentWorks(town);
  return unveilLandmark(town, area.id, work.level);
};
const buyBuilt = (town, area, choice) => finish(buy(town, area, choice), area);
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
      // The level being built never gates the era either.
      town = finish(town, area);
      expect(isEraComplete(town)).toBe(gate);
      if (area.timeless) return;
      expect(buy(town, area, area.choices[1])).toBeNull();
      for (const era of ERAS.slice(intro)) {
        town.era = era.id;
        while (areaStage(town, area) < areaMaximum(town, area)) {
          const before = town.coins,
            offer = landmarkOffer(town, area, area.choices[0]);
          town = buyBuilt(town, area);
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
  it('opens a monument site every other era, each design with its own silhouette', () => {
    const eras = PERSONAL_AREAS.map((area) => ERAS.findIndex((era) => era.id === area.era));
    expect(eras).not.toContain(-1);
    const sorted = [...eras].sort((a, b) => a - b);
    for (let n = 1; n < sorted.length; n++)
      expect(sorted[n] - sorted[n - 1]).toBeGreaterThanOrEqual(2);
    const choices = PERSONAL_AREAS.flatMap((area) => area.choices);
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices.sort()).toEqual(LANDMARK_OPTIONS.map((o) => o.id).sort());
    expect(new Set(LANDMARK_OPTIONS.map((o) => o.form)).size).toBe(LANDMARK_OPTIONS.length);
  });
  it.each(PERSONAL_AREAS.filter((a) => !a.timeless))(
    'offers five fixed milestones for $id immediately after its site opens',
    (area) => {
      let town = { ...createTown(), era: area.era, coins: 1e9 };
      for (const [index, milestone] of LANDMARK_PROGRESSION.levels.entries()) {
        expect(areaMaximum(town, area)).toBe(5);
        const offer = landmarkOffer(town, area, area.choices[0]);
        expect(offer.level).toBe(index + 1);
        expect(offer.price).toBe(LANDMARK_BY_ID[area.choices[0]].price * milestone.multiplier);
        expect(buy({ ...town, coins: offer.price - 1 }, area)).toBeNull();
        town = buy(town, area);
        // One level at a time: the next is offered once this one is unveiled.
        expect(landmarkOffer(town, area, area.choices[0])).toBeNull();
        town = finish(town, area);
      }
      expect(buy(town, area)).toBeNull();
      town.era = ERAS.at(-1).id;
      expect(buy(town, area)).toBeNull();
    },
  );
  it('preserves historical paid levels but displays the completed wonder', () => {
    const area = PERSONAL_AREAS[0],
      town = createTown();
    town.personalisation.areas[area.id] = [area.choices[0]];
    town.personalisation.areaLevels[area.id] = 11;
    expect(normalizeTown(town).personalisation.areaLevels[area.id]).toBe(11);
    expect(areaStage(town, area)).toBe(5);
    expect(landmarkOffer(town, area, area.choices[0])).toBeNull();
  });
  it('does not add monument bills when a new era is registered', () => {
    const area = PERSONAL_AREAS[0],
      town = createTown();
    town.personalisation.areas[area.id] = [area.choices[0]];
    town.personalisation.areaLevels[area.id] = 5;
    ERAS.push({ ...ERAS.at(-1), id: 'personalisation-future-era' });
    try {
      town.era = 'personalisation-future-era';
      expect(areaMaximum(town, area)).toBe(5);
      expect(buy(town, area)).toBeNull();
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
        areas: { meadow: ['headframe'] },
        areaLevels: { meadow: 2 },
        plaques: { home: 'player-alpha', meadow: 'player-alpha', mine: 'player-alpha' },
      };
      const loaded = normalizeTown(town);
      expect(loaded.personalisation).toEqual({
        version: 3,
        crest: { ...crest, emblemColour: DEFAULT_EMBLEM_COLOUR },
        areas: { meadow: ['headframe'] },
        areaLevels: { meadow: 2 },
        // Monuments bought before construction existed stand complete.
        construction: {},
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
  it('turns every site, open or built, so its monument fronts the declared direction', () => {
    const town = createTown();
    town.era = ERAS.at(-1).id;
    const open = buildPersonalAreas(fixture(town), town);
    for (const area of PERSONAL_AREAS) {
      town.personalisation.areas[area.id] = [area.choices.at(-1)];
      town.personalisation.areaLevels[area.id] = area.timeless ? 1 : 5;
    }
    const built = buildPersonalAreas(fixture(town), town);
    for (const root of [open, built])
      expect(root.children.map((site) => site.rotation.y)).toEqual(PERSONAL_AREAS.map(siteYaw));
    built.updateMatrixWorld(true);
    for (const site of built.children) {
      const area = PERSONAL_AREAS.find((a) => a.id === site.userData.monumentSite);
      // The fountain court and entrance stand at the front of every design.
      const fountain = site.getObjectByName('Monument fountain court');
      const offset = fountain
        .getWorldPosition(new Vector3())
        .sub(site.position)
        .setY(0)
        .normalize();
      expect(offset.x, area.id).toBeCloseTo(Math.sin(siteYaw(area)));
      expect(offset.z, area.id).toBeCloseTo(Math.cos(siteYaw(area)));
      expect(sceneryObstacles(site)).toEqual([
        expect.objectContaining({ x: site.position.x, z: site.position.z, radius: area.radius }),
      ]);
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
  it('animates every choice from level three, and timeless masterpieces immediately', () => {
    const d = fixture();
    for (const area of PERSONAL_AREAS)
      for (const choice of area.choices) {
        for (const stage of area.timeless ? [1] : [1, 2, 3, 4, 5]) {
          const root = buildLandmark(d, new Group(), choice, stage, area.timeless);
          const moving = [];
          root.traverse((node) => {
            if (node.userData.animated) moving.push(node);
          });
          expect(moving.length > 0, `${choice} ${stage}`).toBe(area.timeless || stage >= 3);
          const pose = () =>
            JSON.stringify(
              moving.map((node) => [
                node.position.toArray(),
                node.rotation.toArray(),
                node.scale.toArray(),
              ]),
            );
          const initial = pose();
          for (const node of moving) node.traverse((part) => expect(part.layers.mask).toBe(1 << 2));
          root.userData.sceneryUpdate(4);
          if (moving.length) expect(pose(), choice).not.toBe(initial);
          root.userData.sceneryUpdate(0);
          expect(pose()).toBe(initial);
          for (const time of [0, 2, 8, 20]) {
            root.userData.sceneryUpdate(time);
            const bounds = new Box3().setFromObject(root);
            expect(
              Math.max(
                Math.abs(bounds.min.x),
                Math.abs(bounds.max.x),
                Math.abs(bounds.min.z),
                Math.abs(bounds.max.z),
              ),
              `${choice} motion bounds`,
            ).toBeLessThanOrEqual(area.radius);
          }
        }
      }
  });
  it('reuses monument motion on scenery refresh and removes it on disposal', () => {
    const town = createTown();
    town.personalisation.areas.meadow = ['windgarden'];
    town.personalisation.areaLevels.meadow = 3;
    const d = fixture(town),
      scenery = new TownScenery();
    d.motions = [];
    scenery.update(d, town);
    const root = scenery.entries.get('personal-areas').group;
    const motion = root.userData.sceneryUpdate;
    expect(d.motions.filter((m) => m === motion)).toHaveLength(1);
    scenery.update(d, town);
    expect(scenery.entries.get('personal-areas').group).toBe(root);
    expect(d.motions.filter((m) => m === motion)).toHaveLength(1);
    scenery.dispose(d);
    expect(d.motions).not.toContain(motion);
  });
  it('draws moving monument and mine parts as a few shared instances, never stale ones', () => {
    const town = createTown();
    town.era = 'industrial';
    for (const area of PERSONAL_AREAS.filter((a) => areaUnlocked(town, a))) {
      town.personalisation.areas[area.id] = [area.choices.at(-1)];
      town.personalisation.areaLevels[area.id] = area.timeless ? 1 : 5;
    }
    const d = fixture(town),
      scenery = new TownScenery();
    scenery.update(d, town);
    const parts = (root) => {
      const meshes = [];
      for (const part of root.userData.movingParts)
        part.traverse((mesh) => mesh.isMesh && !mesh.isInstancedMesh && meshes.push(mesh));
      return meshes;
    };
    const moving = () =>
      ['personal-areas', 'mine-works'].flatMap((id) => parts(scenery.entries.get(id).group));
    const instanced = () => scenery.movingParts.buckets.flatMap((bucket) => bucket.objects);
    const monuments = scenery.entries.get('personal-areas').group;
    expect(parts(monuments).length).toBeGreaterThan(40);
    expect(parts(scenery.entries.get('mine-works').group).length).toBeGreaterThan(0);
    expect(new Set(instanced())).toEqual(new Set(moving()));
    expect(instanced()).toHaveLength(moving().length);
    // Dozens of parts share their primitive shapes: a handful of draw calls in all.
    expect(scenery.movingParts.buckets.length).toBeLessThanOrEqual(8);
    for (const mesh of moving()) expect(mesh.layers.mask).toBe(1 << 1);
    // A changed monument replaces its instances instead of drawing the old parts.
    const old = parts(monuments);
    town.personalisation.areas.meadow = [PERSONAL_AREAS[0].choices[0]];
    scenery.update(d, town);
    expect(scenery.entries.get('personal-areas').group).not.toBe(monuments);
    expect(new Set(instanced())).toEqual(new Set(moving()));
    expect(instanced().some((mesh) => old.includes(mesh))).toBe(false);
    const group = scenery.movingParts.group;
    scenery.dispose(d);
    expect(scenery.movingParts).toBeNull();
    expect(group.parent).toBeNull();
  });
  it('keeps moving mechanisms out of static batches and honors reduced motion', () => {
    const preference = { matches: false };
    vi.stubGlobal('matchMedia', () => preference);
    const town = createTown();
    town.personalisation.areas.meadow = ['windgarden'];
    town.personalisation.areaLevels.meadow = 3;
    const d = fixture(town),
      root = buildPersonalAreas(d, town);
    const renderer = new TownStatics(d.scene);
    renderer.sync([root]);
    const parts = [];
    root.traverse((node) => {
      if (node.userData.animated) parts.push(node);
    });
    const pose = () =>
      JSON.stringify(parts.map((node) => [node.rotation.toArray(), node.scale.toArray()]));
    const initial = pose();
    root.userData.sceneryUpdate(5);
    expect(pose()).not.toBe(initial);
    for (const node of parts) {
      expect(node.matrixAutoUpdate).toBe(true);
      expect(node.visible).toBe(true);
    }
    preference.matches = true;
    root.userData.sceneryUpdate(8);
    expect(pose()).toBe(initial);
    renderer.dispose();
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
    expect(plaque.userData.distinctionName).toBe('Alpha Player');
  });
  it('names the tapped plaque above it until the plaque is replaced', () => {
    const town = edit(createTown(), { kind: 'plaque', id: 'mine', value: 'player-alpha' }, [
      'player-alpha',
    ]);
    town.displayDistinctions = { 'player-alpha': { at: 1 } };
    const d = fixture(town);
    const plaque = buildMinePlaque(d, town);
    d.camera = new PerspectiveCamera(50, 1, 0.1, 500);
    d.camera.position.set(0, 8, PLOTS.mine[1] + 20);
    d.camera.lookAt(0, 3, PLOTS.mine[1]);
    d.camera.updateMatrixWorld();
    d.world.updateMatrixWorld(true);
    const labels = [];
    d.onPlaqueLabel = (label) => labels.push(label);
    d.namedPlaque = plaque;
    projectPlaque(d);
    expect(labels.at(-1)).toMatchObject({ name: 'Alpha Player' });
    expect(labels.at(-1).x).toBeCloseTo(50, 0);
    plaque.removeFromParent();
    projectPlaque(d);
    expect(labels.at(-1)).toBeNull();
    expect(d.namedPlaque).toBeNull();
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
