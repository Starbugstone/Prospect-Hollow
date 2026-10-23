import { afterEach, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Box3, Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { HONOURS } from '../src/data/honours';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  PERSONAL_AREAS,
  areaChoice,
  areaSettlement,
  areasForSettlement,
  areaUnlocked,
  advanceMonumentWorks,
  landmarkOffer,
  landmarkPayment,
  monumentWork,
  purchaseLandmark,
  unveilLandmark,
} from '../src/data/townLandmarks';
import { normalizePersonalisation } from '../src/data/townPersonalisation';
import { monumentPresentation } from '../src/data/townPresentations';
import {
  MOON_LOTS,
  MOON_CRATER_RADIUS,
  MOON_LOT_RADIUS,
  MOON_RING_ROAD,
  moonApproaches,
  moonSegmentDistance,
} from '../src/data/moonSettlement';
import { MoonScene, moonHeight } from '../src/game/town/moon/MoonScene';
import {
  buildMoonMonuments,
  moonMonumentSignature,
  moonMonumentLabels,
} from '../src/game/town/moon/MoonMonuments';
import { buildPersonalAreas } from '../src/game/town/TownPersonalisation';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { focusTownPlace } from '../src/game/town/TownCamera';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import TownMoonMonument from '../src/components/town/TownMoonMonument.vue';
import TownMonumentSite from '../src/components/town/TownMonumentSite.vue';
import schema from '../backend/content/public-schema.json';

const area = AREA_BY_ID['earthrise-plaza'];
const town = () => ({ ...createTown(), era: 'twin-hollows', coins: 1e8 });
const choose = (value, choice = area.choices[0]) => {
  const offer = landmarkOffer(value, area, choice);
  return offer && purchaseLandmark(value, { id: area.id, slot: 0, value: choice, ...offer });
};
const finish = (value, level) => {
  while (!monumentWork(value, area).ready) value = advanceMonumentWorks(value);
  return unveilLandmark(value, area.id, level);
};
const views = [];
function fixture(value = town()) {
  const d = new TownPrimitives();
  Object.assign(d, { town: value, world: new Group(), scene: new Scene(), sign: () => {} });
  d.scene.add(d.world);
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.scene);
    d.disposePrimitives();
  }
});
const render = (component, props) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

it('uses one settlement contract, with historical defaults and no speculative renderer', () => {
  expect(area).toMatchObject({
    era: 'twin-hollows',
    settlement: 'moon',
    currency: 'coins',
    radius: 7,
  });
  expect(areaUnlocked({ era: 'moonward' }, area)).toBe(false);
  expect(areaUnlocked(town(), area)).toBe(true);
  expect(areasForSettlement('moon')).toEqual([area]);
  expect(areasForSettlement()).not.toContain(area);
  expect(focusTownPlace({ town: town() }, area.id)).toBe(false);
  expect(areasForSettlement('unknown')).toEqual([]);
  const old = { id: 'old' },
    future = { settlement: 'unregistered' };
  expect(areaSettlement(old)).toBe('valley');
  expect(areasForSettlement('valley', [old, future])).toEqual([old]);
  expect(moonMonumentLabels({ era: 'moonward' })).toEqual([]);
  expect(moonMonumentLabels(town()).map((a) => a.id)).toEqual([area.id]);
});

it('reserves a flat lunar site clear of pads, ring, approaches, rovers and the saucer corridor', () => {
  const [x, z] = area.positions[0];
  expect(Math.hypot(x, z) + area.radius).toBeLessThan(MOON_CRATER_RADIUS);
  expect(Math.abs(Math.hypot(x, z) - MOON_RING_ROAD)).toBeGreaterThan(area.radius + 1);
  for (const [id, [px, pz]] of Object.entries(MOON_LOTS))
    expect(Math.hypot(px - x, pz - z), id).toBeGreaterThan(area.radius + MOON_LOT_RADIUS + 1);
  for (const route of moonApproaches())
    for (let n = 1; n < route.points.length; n++)
      expect(
        moonSegmentDistance(x, z, route.points[n - 1], route.points[n]),
        route.id,
      ).toBeGreaterThan(area.radius + route.width / 2);
  // Cross-agent reservation: Saucer Pad [15,-30], r6.4; flight moves away +x/-z.
  expect(Math.hypot(x - 15, z + 30)).toBeGreaterThan(area.radius + 6.4 + 1);
  for (let s = 0; s < 80; s++)
    expect(Math.hypot(x - 15 - 0.6 * s, z + 30 + s)).toBeGreaterThan(area.radius + 6.4);
  for (let dx = -7; dx <= 7; dx++)
    for (let dz = -7; dz <= 7; dz++)
      if (Math.hypot(dx, dz) <= 7) expect(moonHeight(x + dx, z + dz)).toBeCloseTo(0, 7);
});

it.each(area.choices)(
  '%s shares the five paid milestones, puzzle work, save normalization and permanent choice',
  (choice) => {
    let value = town();
    const before = moonMonumentSignature(value);
    for (let level = 1; level <= 5; level++) {
      const offer = landmarkOffer(value, area, choice),
        coins = value.coins;
      value = choose(value, choice);
      expect(value.coins).toBe(coins - offer.price);
      expect(monumentWork(value, area)).toMatchObject({
        level,
        wins: 0,
        required: level === 1 ? 3 : 1,
      });
      expect(unveilLandmark(value, area.id, level)).toBeNull();
      expect(landmarkOffer(value, area, choice)).toBeNull();
      value.personalisation = normalizePersonalisation(value.personalisation);
      value = finish(value, level);
      expect(areaChoice(value, area)).toBe(choice);
      expect(monumentWork(value, area)).toBeNull();
      for (const alternative of area.choices.filter((id) => id !== choice))
        expect(choose(value, alternative)).toBeNull();
    }
    expect(landmarkOffer(value, area, choice)).toBeNull();
    expect(moonMonumentSignature(value)).not.toBe(before);
  },
);

it('preserves the shipped Monument Square honour instead of widening it to lunar sites', () => {
  const honour = HONOURS.definitions.find((definition) => definition.id === 'monument-gold');
  expect(honour.measure).toEqual({ kind: 'landmark', area: 'monument' });
  const value = choose(town());
  expect(honour.qualifies({ town: value })).toBeFalsy();
  value.personalisation.areas.monument = ['guardian'];
  expect(honour.qualifies({ town: value })).toBeTruthy();
});

it('centralizes coin display, affordability and spending and rejects unsupported currencies', () => {
  const value = town();
  expect(landmarkPayment(value, {}, 100)).toMatchObject({
    currency: 'coins',
    icon: 'coin',
    affordable: true,
  });
  expect(landmarkPayment(value, area, 100).spend().coins).toBe(value.coins - 100);
  expect(landmarkPayment({ coins: 99 }, area, 100)).toMatchObject({
    affordable: false,
    missing: 1,
  });
  expect(landmarkPayment(value, { currency: 'moonstones' }, 1).spend()).toBeNull();
  expect(value.coins).toBe(1e8);
});

it('exports authoritative lunar IDs, settlement, currency and all three prices for the server', () => {
  expect(schema.personalisation.areas.find((a) => a.id === area.id)).toEqual(area);
  for (const choice of area.choices)
    expect(schema.personalisation.landmarks.find((a) => a.id === choice)).toEqual(
      LANDMARK_BY_ID[choice],
    );
});

it('shows empty, working and finished lunar sites without adding a valley site', () => {
  let value = town();
  const d = fixture(value);
  const valley = buildPersonalAreas(d, value);
  expect(valley.children.map((g) => g.userData.monumentSite)).not.toContain(area.id);
  expect(
    buildMoonMonuments(d, d.scene, value).children.some((g) => g.userData.monumentSite === area.id),
  ).toBe(true);
  value = advanceMonumentWorks(choose(value));
  const work = buildMoonMonuments(d, d.scene, value);
  expect(work.getObjectByName('Monument scaffolding')).toBeDefined();
  value = finish(value, 1);
  expect(
    buildMoonMonuments(d, d.scene, value).getObjectByName('Monument scaffolding'),
  ).toBeUndefined();
});

it.each(area.choices)(
  '%s fits its lunar site, retains distinct tiers and stays below 6000 triangles / 8 materials',
  (choice) => {
    const d = fixture(),
      signatures = new Set();
    for (let stage = 1; stage <= 5; stage++) {
      const root = buildLandmark(d, new Group(), choice, stage);
      let triangles = 0;
      const materials = new Set();
      root.traverse((mesh) => {
        if (!mesh.isMesh) return;
        triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
        materials.add(mesh.material);
      });
      expect(triangles, choice + stage).toBeLessThan(6000);
      expect(materials.size, choice + stage).toBeLessThanOrEqual(8);
      signatures.add(triangles);
      const box = new Box3().setFromObject(root);
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(area.radius);
      expect(root.getObjectByName('Monument fountain court')).toBeUndefined();
    }
    expect(signatures.size).toBe(5);
  },
);

it('preserves actual Moon building levels when monuments change the label catalog', () => {
  let value = town();
  value.buildings = { ...value.buildings, ribbonLanding: 3, settlerDomes: 2 };
  const d = fixture(value);
  const scene = Object.assign(Object.create(MoonScene.prototype), {
    d,
    scene: d.scene,
    signature: '',
    access: { geometry: { dispose() {} } },
    populate() {},
    requestFrame() {},
    construction: { sync() {} },
    saucer: { update() {} },
  });
  scene.update(value);
  expect(scene.buildings.getObjectByName('Moon ribbonLanding level 3')).toBeDefined();
  expect(scene.buildings.getObjectByName('Moon settlerDomes level 2')).toBeDefined();
  expect(scene.lots.some((lot) => lot.id === area.id)).toBe(true);
  const buildings = scene.buildings;
  value = advanceMonumentWorks(choose(value));
  scene.update(value);
  expect(scene.buildings).toBe(buildings);
  expect(scene.buildings.getObjectByName('Moon ribbonLanding level 3')).toBeDefined();
  expect(scene.monuments.getObjectByName('Monument scaffolding')).toBeDefined();
  scene.access.geometry.dispose();
});

it('plays the shared unveiling on the lunar camera with suited visitors and restores it', () => {
  const value = finish(choose(town()), 1),
    d = fixture(value);
  const scene = Object.assign(Object.create(MoonScene.prototype), {
    d,
    scene: d.scene,
    town: value,
    elapsed: 0,
    renderer: { shadowMap: {} },
    camera: new PerspectiveCamera(48, 1.5, 0.1, 600),
    controls: { target: new Vector3(0, 0, 4), enabled: true },
    render() {},
    requestFrame() {},
  });
  scene.camera.position.set(0, 26, 66);
  scene.camera.layers.enable(2);
  const pose = scene.camera.position.clone();
  const definition = monumentPresentation(area.id, area.choices[0], 1);
  expect(definition.settlement).toBe('moon');
  scene.setPresentation(definition);
  expect(scene.presentation.effect.origin.toArray()).toEqual([
    area.positions[0][0],
    0,
    area.positions[0][1],
  ]);
  expect(scene.presentation.effect.crowd).toHaveLength(14);
  scene.presentationFrame(8);
  expect(scene.camera.position.equals(pose)).toBe(false);
  expect(scene.controls.target.z).toBeLessThan(-30);
  expect(scene.presentation.effect.pieces.every(({ part }) => !part.visible)).toBe(true);
  scene.setPresentation(null);
  expect(scene.camera.position.equals(pose)).toBe(true);
  expect(scene.controls.enabled).toBe(true);
});

it('uses the common details panel and has fallback SVG art for empty, built and working sites', async () => {
  expect(await render(TownMonumentSite, { id: area.id, town: town() })).toContain(
    'Earthrise Plaza',
  );
  for (const choice of area.choices) {
    const html = await render(TownMoonMonument, { site: { choice, stage: 5 } });
    expect(html).toContain(`data-lunar-choice="${choice}"`);
    expect(html).not.toContain('landmark-fountain');
    expect(await render(TownMoonMonument, { site: { choice, stage: 1, work: {} } })).toContain(
      'landmark-scaffold',
    );
  }
  expect(await render(TownMoonMonument, { site: {} })).toContain('data-lunar-choice="open"');
  expect(PERSONAL_AREAS).toContain(area);
});
