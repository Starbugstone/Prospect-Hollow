import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Box3, Group, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS, eraEvolution } from '../src/data/eras';
import { townFauna } from '../src/data/townAnimals';
import { CREST_EMBLEM_IDS } from '../src/data/townCrests';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  LANDMARK_PROGRESSION,
  PERSONAL_AREAS,
  advanceMonumentWorks,
  areaShownStage,
  areaStage,
  landmarkOffer,
  monumentWork,
  unveilLandmark,
} from '../src/data/townLandmarks';
import { normalizePersonalisation, personaliseTown } from '../src/data/townPersonalisation';
import { monumentPresentation } from '../src/data/townPresentations';
import { isEraComplete } from '../src/game/town/TownEras';
import { buildingIndicators, normalizeTown } from '../src/game/town/TownRules';
import { projectLabelPositions } from '../src/game/town/TownLabelProjection';
import { TOWN_ACTIONS } from '../src/data/townIndicators';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownScenery } from '../src/game/town/TownScenery';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { buildPersonalAreas } from '../src/game/town/TownPersonalisation';
import { useCampaignStore } from '../src/stores/campaignStore';
import { setLocale } from '../src/i18n';
import TownMonumentSite from '../src/components/town/TownMonumentSite.vue';
import TownPresentationCinematic from '../src/components/town/TownPresentationCinematic.vue';

const meadow = AREA_BY_ID.meadow;
const square = PERSONAL_AREAS.find((area) => area.timeless);
const buy = (town, area, choice = area.choices[0]) => {
  const offer = landmarkOffer(town, area, choice);
  return personaliseTown(
    town,
    {
      kind: 'area',
      id: area.id,
      slot: 0,
      value: choice,
      expectedChoice: offer?.expectedChoice,
      expectedLevel: offer?.expectedLevel,
    },
    CREST_EMBLEM_IDS,
  );
};
const puzzles = (town, count) => {
  for (let n = 0; n < count; n++) town = advanceMonumentWorks(town);
  return town;
};
const rich = (era) => ({ ...createTown(), era, coins: 1e9 });
const render = (component, props) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Monument construction rules', () => {
  it('builds each paid level over completed puzzles, one level at a time', () => {
    expect(LANDMARK_PROGRESSION.levels.map((level) => level.puzzles)).toEqual([3, 2, 2, 2, 3]);
    for (const area of PERSONAL_AREAS) {
      let town = rich(area.era);
      const levels = area.timeless ? 1 : 5;
      for (let level = 1; level <= levels; level++) {
        const gate = isEraComplete(town);
        town = buy(town, area);
        const required = LANDMARK_PROGRESSION.levels[level - 1].puzzles;
        expect(monumentWork(town, area)).toEqual({ level, wins: 0, required, ready: false });
        // The paid stage counts at once; the town shows the previous one until unveiled.
        expect(areaStage(town, area)).toBe(level);
        expect(areaShownStage(town, area)).toBe(level - 1);
        expect(landmarkOffer(town, area, area.choices[0])).toBeNull();
        expect(unveilLandmark(town, area.id, level)).toBeNull();
        const coins = town.coins;
        town = puzzles(town, required - 1);
        expect(monumentWork(town, area).ready).toBe(false);
        town = puzzles(town, 1);
        expect(monumentWork(town, area)).toEqual({ level, wins: required, required, ready: true });
        // Further puzzles neither overshoot nor change the ready town.
        expect(advanceMonumentWorks(town)).toBe(town);
        expect(unveilLandmark(town, area.id, level + 1)).toBeNull();
        expect(unveilLandmark(town, 'unknown-site', level)).toBeNull();
        town = unveilLandmark(town, area.id, level);
        expect(monumentWork(town, area)).toBeNull();
        expect(areaShownStage(town, area)).toBe(level);
        expect(town.coins).toBe(coins);
        expect(isEraComplete(town)).toBe(gate);
        expect(normalizeTown(JSON.parse(JSON.stringify(town))).personalisation).toEqual(
          town.personalisation,
        );
      }
      expect(landmarkOffer(town, area, area.choices[0])).toBeNull();
    }
  });
  it('advances every unfinished monument with each completed puzzle', () => {
    let town = rich(ERAS.at(-1).id);
    town = buy(buy(town, meadow), square);
    town = puzzles(town, 1);
    expect(monumentWork(town, meadow).wins).toBe(1);
    expect(monumentWork(town, square).wins).toBe(1);
    expect(advanceMonumentWorks(createTown())).toEqual(createTown());
  });
  it('treats damaged, stale or legacy construction as a finished monument', () => {
    const saved = (construction, levels = { meadow: 2 }) =>
      normalizePersonalisation(
        {
          areas: { meadow: ['headframe'], monument: ['guardian'] },
          areaLevels: { ...levels, monument: 1 },
          construction,
        },
        CREST_EMBLEM_IDS,
      ).construction;
    expect(saved({ meadow: { level: 2, wins: 1 }, monument: { level: 1, wins: 3 } })).toEqual({
      meadow: { level: 2, wins: 1 },
      monument: { level: 1, wins: 3 },
    });
    for (const damaged of [
      { meadow: { level: 1, wins: 0 } },
      { meadow: { level: 2, wins: 3 } },
      { meadow: { level: 2, wins: -1 } },
      { meadow: { level: 2, wins: 1.5 } },
      { meadow: { level: 2, wins: '1' } },
      { meadow: { level: 2 } },
      { meadow: 'building' },
      { monument: { level: 2, wins: 0 } },
      { 'motor-court': { level: 1, wins: 0 } },
      { 'unknown-site': { level: 1, wins: 0 } },
      'scaffolding',
      null,
    ])
      expect(saved(damaged), JSON.stringify(damaged)).toEqual({});
    // Historical paid levels above the five milestones are never rebuilt.
    expect(saved({ meadow: { level: 11, wins: 0 } }, { meadow: 11 })).toEqual({});
    const town = createTown();
    town.personalisation.areas.meadow = ['headframe'];
    town.personalisation.areaLevels.meadow = 1;
    town.personalisation.construction.meadow = { level: 1, wins: 'x' };
    expect(monumentWork(town, meadow)).toEqual({ level: 1, wins: 0, required: 3, ready: false });
    expect(monumentWork(town, null)).toBeNull();
    const loaded = normalizeTown(town).personalisation;
    expect(loaded.construction).toEqual({});
    expect(normalizePersonalisation(loaded, CREST_EMBLEM_IDS)).toEqual(loaded);
  });
});

describe('Monument construction in the campaign', () => {
  const win = (campaign) =>
    campaign.recordVictory({
      id: 1,
      runId: campaign.beginRun('normal', 1),
      score: 1,
      target: 6000,
      combo: 1,
      elapsedMs: 600000,
      speedTargetMs: 60000,
    });
  it('builds through completed puzzles, reports progress and unveils once after a reload', () => {
    let campaign = useCampaignStore();
    campaign.town = { ...campaign.town, coins: 10000 };
    expect(
      campaign.personalise([
        {
          kind: 'area',
          id: 'meadow',
          slot: 0,
          value: 'headframe',
          expectedChoice: null,
          expectedLevel: 0,
        },
      ]),
    ).toBe(true);
    expect(campaign.integrity.actions.at(-1).kind).toBe('landmark-buy');
    win(campaign);
    win(campaign);
    expect(campaign.lastConstruction).toContainEqual({
      id: 'meadow',
      monument: 'headframe',
      stage: 1,
      wins: 2,
      required: 3,
      ready: false,
    });
    expect(campaign.unveilMonument('meadow', 1)).toBe(false);
    win(campaign);
    expect(campaign.lastConstruction.at(-1)).toMatchObject({ wins: 3, ready: true });
    // A fourth puzzle reports nothing new for a monument that is already ready.
    win(campaign);
    expect(campaign.lastConstruction.some((entry) => entry.monument)).toBe(false);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(monumentWork(campaign.town, meadow)?.ready).toBe(true);
    const actions = campaign.integrity.actions.length;
    expect(campaign.unveilMonument('meadow', 2)).toBe(false);
    expect(campaign.unveilMonument('meadow', 1)).toBe(true);
    expect(campaign.unveilMonument('meadow', 1)).toBe(false);
    // Unveiling is cosmetic: no money moves, so the journal records nothing.
    expect(campaign.integrity.actions).toHaveLength(actions);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(monumentWork(campaign.town, meadow)).toBeNull();
    expect(areaShownStage(campaign.town, meadow)).toBe(1);
  });
});

const views = [];
function fixture(town) {
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
});
const names = (root) => {
  const found = new Set();
  root.traverse((node) => node.name && found.add(node.name));
  return found;
};
const meshes = (root) => {
  let count = 0;
  root.traverse((node) => node.isMesh && count++);
  return count;
};

describe('Monument construction in the town', () => {
  it('shows a new step after every puzzle until the finished monument is unveiled', () => {
    let town = buy(rich('frontier'), meadow, 'windgarden');
    const views = [];
    for (let wins = 0; wins <= 3; wins++) {
      const d = fixture(town),
        root = buildPersonalAreas(d, town),
        site = root.children[0];
      expect(site.name).toBe('meadow 0: windgarden stage 1 under construction');
      // Nothing turns or splashes before the unveiling.
      expect(root.userData.movingParts).toEqual([]);
      views.push({
        parts: names(site),
        count: meshes(site),
        height: new Box3().setFromObject(site),
      });
      town = puzzles(town, 1);
    }
    const [foundation, first, second, ready] = views;
    expect(foundation.parts.has('Monument scaffolding')).toBe(false);
    expect(foundation.parts.has('Monument building materials')).toBe(true);
    for (const step of [first, second]) {
      expect(step.parts.has('Monument scaffolding')).toBe(true);
      expect(step.parts.has('Monument crane')).toBe(true);
    }
    expect(foundation.count).toBeLessThan(first.count);
    expect(first.height.max.y).toBeLessThan(second.height.max.y);
    for (const part of ['Monument scaffolding', 'Monument bunting', 'Monument opening ribbon'])
      expect(ready.parts.has(part)).toBe(true);
    expect(ready.parts.has('Monument crane')).toBe(false);
    expect(ready.parts.has('Monument building materials')).toBe(false);
    town = unveilLandmark(town, 'meadow', 1);
    const site = buildPersonalAreas(fixture(town), town).children[0];
    expect(site.name).toBe('meadow 0: windgarden stage 1');
    expect(names(site).has('Monument scaffolding')).toBe(false);
  });
  it('keeps the standing level inside the scaffolding while the next one is built', () => {
    let town = buy(rich('frontier'), meadow);
    town = unveilLandmark(puzzles(town, 3), 'meadow', 1);
    town = buy(town, meadow);
    const at = (wins) => names(buildPersonalAreas(fixture(town), puzzles(town, wins)).children[0]);
    // Flanking pavilions belong to level two: they appear only with the finished level.
    expect(at(0).has('Monument flanking pavilions')).toBe(false);
    expect(at(0).has('Monument scaffolding')).toBe(true);
    expect(at(0).has('Monument crane')).toBe(false);
    expect(at(1).has('Monument crane')).toBe(true);
    expect(at(2).has('Monument flanking pavilions')).toBe(true);
    expect(at(2).has('Monument opening ribbon')).toBe(true);
  });
  it('keeps every construction step of every design on its reserved site', () => {
    for (const area of PERSONAL_AREAS)
      for (const choice of area.choices)
        for (let level = 1; level <= (area.timeless ? 1 : 5); level++) {
          const required = LANDMARK_PROGRESSION.levels[level - 1].puzzles;
          // The widest steps: every material pile, the crane, then bunting once ready.
          for (const wins of [0, 1, required]) {
            const town = createTown();
            town.era = ERAS.at(-1).id;
            Object.assign(town.personalisation, {
              areas: { [area.id]: [choice] },
              areaLevels: { [area.id]: level },
              construction: { [area.id]: { level, wins } },
            });
            const site = buildPersonalAreas(fixture(town), town).children.find(
              (g) => g.userData.monumentSite === area.id,
            );
            site.rotation.y = 0;
            site.position.set(0, 0, 0);
            const box = new Box3().setFromObject(site);
            const reach = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
            expect(reach, `${choice} ${level} ${wins}`).toBeLessThanOrEqual(area.radius + 0.4);
          }
        }
  }, 30000);
  it('rebuilds only when a puzzle moves the work on', () => {
    let town = buy(rich('frontier'), meadow);
    const d = fixture(town),
      scenery = new TownScenery();
    scenery.update(d, town);
    const first = scenery.entries.get('personal-areas').group;
    scenery.update(d, { ...town });
    expect(scenery.entries.get('personal-areas').group).toBe(first);
    town = puzzles(town, 1);
    expect(scenery.update(d, town)).toContain('personal-areas');
    expect(scenery.entries.get('personal-areas').group).not.toBe(first);
    scenery.dispose(d);
  });
});

describe('Monument unveiling', () => {
  it('gives the founding, the town wonder and timeless monuments the grand version', () => {
    const levels = [1, 2, 3, 4, 5].map((level) =>
      monumentPresentation('meadow', 'headframe', level),
    );
    expect(levels.map((d) => d.grand)).toEqual([true, false, false, false, true]);
    expect(levels.map((d) => d.duration)).toEqual([16, 7, 7, 7, 16]);
    expect(levels[0].chapters.at(-1).text).toBe('The {monument} stands complete!');
    expect(levels[4].chapters.at(-1).text).toBe('The {monument} is now a town wonder!');
    expect(levels[0].chapters[2].text).toBe(LANDMARK_BY_ID.headframe.detail);
    const timeless = monumentPresentation('monument', 'guardian', 3);
    expect(timeless).toMatchObject({ grand: true, level: 1, area: 'monument', choice: 'guardian' });
    expect(monumentPresentation('meadow', 'guardian', 1)).toBeNull();
    expect(monumentPresentation('unknown-site', 'headframe', 1)).toBeNull();
  });
  it('captions the scene with translated monument and site names', async () => {
    setLocale('fr');
    const html = await render(TownPresentationCinematic, {
      definition: monumentPresentation('meadow', 'headframe', 1),
    });
    expect(html).toContain('Toute la ville se rassemble sur le site : Prairie des fondateurs.');
    expect(html).toContain('Un monument pour Prospect Hollow');
  });

  function diorama(town) {
    const d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      scene: new Scene(),
      geometries: createTownGeometries(),
      materials: new Map(),
      contactShadowMaterial: new MeshBasicMaterial(),
      elapsed: 0,
      sign: () => {},
      render: () => {},
      renderer: { shadowMap: {} },
      frameCache: { valid: true },
      camera: new PerspectiveCamera(45, 1.44, 0.1, 500),
      controls: { target: new Vector3(0, 0.7, 0), enabled: true },
      motionEnabled: false,
    });
    d.camera.position.set(20, 30, 50);
    d.actorRenderer = new TownActors(d.scene);
    d.buildingRenderer = new TownStatics(d.scene);
    d.upgradeGlow = new TownUpgradeGlow(d.scene);
    d.update(town, Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName])));
    return d;
  }
  function release(d) {
    d.presentation?.dispose(false);
    d.actorRenderer.dispose();
    d.buildingRenderer.dispose();
    d.upgradeGlow.dispose();
    d.staticScenery.dispose(d);
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
  it('shows the builder hammer over a monument ready to unveil, without a site label', () => {
    let town = buy(rich('frontier'), meadow, 'windgarden');
    expect(buildingIndicators(town).meadow).toBeUndefined();
    town = puzzles(town, 3);
    expect(TOWN_ACTIONS[buildingIndicators(town).meadow].icon).toContain('builder-hammer');
    expect(buildingIndicators(unveilLandmark(town, 'meadow', 1)).meadow).toBeUndefined();
    const d = diorama(town);
    try {
      // Only unlocked sites get an anchor: the Frontier opens Founders' Meadow alone.
      expect(d.anchors.filter((anchor) => anchor.site).map(({ id }) => id)).toEqual(['meadow']);
      const [x, z] = meadow.positions[0];
      d.controls.target.set(x, 0.7, z);
      d.camera.position.set(x, 30, z + 40);
      d.camera.lookAt(d.controls.target);
      d.camera.updateMatrixWorld();
      d.canvas = { clientWidth: 1280, clientHeight: 800 };
      d.onLabels = vi.fn();
      projectLabelPositions(d);
      const site = d.onLabels.mock.lastCall[0].find(({ id }) => id === 'meadow');
      expect(site).toMatchObject({ site: true, visible: false, collection: { visible: true } });
      expect(site.collection.x).toBeCloseTo(50, 0);
    } finally {
      release(d);
    }
  });
  it.each(['frontier', 'riverlight'])(
    'takes the scaffolding down around the real monument while %s gathers, then cleans up',
    (era) => {
      const town = { ...createTown(), era };
      town.personalisation.areas.meadow = ['longhall'];
      town.personalisation.areaLevels.meadow = 1;
      const d = diorama(town);
      try {
        const saved = JSON.stringify(town),
          pose = d.camera.position.clone();
        const monument = d.staticScenery.entries.get('personal-areas').group;
        d.setPresentation(monumentPresentation('meadow', 'longhall', 1));
        const effect = d.presentation.effect;
        expect(d.controls.enabled).toBe(false);
        // The finished monument stays in town; only temporary scaffolding surrounds it.
        expect(monument.visible).toBe(true);
        expect(effect.pieces.length).toBeGreaterThan(40);
        expect(effect.pieces.every(({ part }) => part.visible)).toBe(true);
        // Boxes and rods keep their authored dimensions until they come down.
        expect(effect.pieces.every(({ part, size }) => part.scale.equals(size))).toBe(true);
        expect(effect.pieces.some(({ size }) => size.x !== size.y)).toBe(true);
        expect(effect.bow.visible).toBe(true);
        const willowkin = effect.crowd.filter((member) => member.willowkin).length;
        expect(willowkin > 0).toBe(!!townFauna(eraEvolution(era)).companions);
        expect(effect.crowd.length).toBe(14);
        // Reduced motion settles the final scene without moving the camera.
        d.presentationFrame(16, true);
        expect(d.camera.position.equals(pose)).toBe(true);
        expect(effect.pieces.every(({ part }) => !part.visible)).toBe(true);
        d.presentationFrame(4);
        const standing = effect.pieces.filter(({ part }) => part.visible).length;
        expect(standing).toBeGreaterThan(0);
        expect(standing).toBeLessThan(effect.pieces.length);
        expect(effect.bow.visible).toBe(false);
        expect(effect.confetti.points.visible).toBe(false);
        d.presentationFrame(9);
        expect(effect.pieces.every(({ part }) => !part.visible)).toBe(true);
        expect(effect.confetti.points.visible).toBe(true);
        const dispose = vi.spyOn(effect.confetti.geometry, 'dispose');
        d.setPresentation(null);
        expect(effect.root.parent).toBeNull();
        expect(dispose).toHaveBeenCalledOnce();
        expect(d.controls.enabled).toBe(true);
        expect(d.camera.position.equals(pose)).toBe(true);
        expect(JSON.stringify(town)).toBe(saved);
      } finally {
        release(d);
      }
    },
  );
  it('plays a short reveal for the middle levels', () => {
    const town = createTown();
    town.personalisation.areas.meadow = ['headframe'];
    town.personalisation.areaLevels.meadow = 3;
    const d = diorama(town);
    try {
      d.setPresentation(monumentPresentation('meadow', 'headframe', 3));
      const effect = d.presentation.effect;
      expect(effect.crowd.length).toBe(8);
      d.presentationFrame(4.5);
      expect(effect.pieces.every(({ part }) => !part.visible)).toBe(true);
      expect(effect.confetti.points.visible).toBe(true);
    } finally {
      release(d);
    }
  });
});

describe('Monument card during construction', () => {
  const town = (wins, level = 1) => {
    const value = createTown();
    value.coins = 1e9;
    Object.assign(value.personalisation, {
      areas: { meadow: ['headframe'] },
      areaLevels: { meadow: level },
      construction: wins === null ? {} : { meadow: { level, wins } },
    });
    return value;
  };
  it('shows progress, then the unveiling, and offers a replay once it stands', async () => {
    const building = await render(TownMonumentSite, { id: 'meadow', town: town(1) });
    expect(building).toContain('Under construction');
    expect(building).toContain('1 of 3 puzzles complete');
    expect(building).not.toContain('Grow to stage');
    expect(building).not.toContain('Unveil the Prospectors’ Headframe');
    expect(building).toContain('landmark-scaffold');
    const ready = await render(TownMonumentSite, { id: 'meadow', town: town(3) });
    expect(ready).toContain('Unveil the Prospectors’ Headframe');
    expect(
      await render(TownMonumentSite, { id: 'meadow', town: town(3), readOnly: true }),
    ).not.toContain('Unveil the Prospectors’ Headframe');
    const standing = await render(TownMonumentSite, { id: 'meadow', town: town(null) });
    expect(standing).toContain('Watch the unveiling again');
    expect(standing).toContain('Grow to stage 2');
    expect(standing).toContain('Built over 2 puzzles.');
    expect(standing).not.toContain('landmark-scaffold');
    const upgrading = await render(TownMonumentSite, { id: 'meadow', town: town(0, 2) });
    expect(upgrading).toContain('is-building');
    expect(upgrading).not.toContain('Watch the unveiling again');
  });
});

describe('Monument progress after a puzzle', () => {
  it('names the monument taking shape and the one ready to unveil', async () => {
    const { default: VictoryModal } = await import('../src/components/VictoryModal.vue');
    const pinia = createPinia();
    const app = createSSRApp({
      render: () =>
        h(VictoryModal, {
          construction: [
            { id: 'meadow', monument: 'headframe', stage: 1, wins: 2, required: 3, ready: false },
            { id: 'monument', monument: 'guardian', stage: 1, wins: 3, required: 3, ready: true },
          ],
        }),
    });
    app.use(pinia);
    setActivePinia(pinia);
    const html = await renderToString(app);
    expect(html).toContain('Your monument is taking shape');
    expect(html).toMatch(/Prospectors’ Headframe\s*· 2\/3/);
    expect(html).toContain('Ready · Unveil it at its monument site');
    expect(html).toMatch(/Guardian of the Hollow\s*· 3\/3/);
  });
});
