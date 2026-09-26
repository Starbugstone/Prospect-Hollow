import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { createTown } from '../src/data/town';
import { mineAppearance, ERA_CONSTRUCTION } from '../src/data/mineEvolution';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownPresentation } from '../src/game/town/TownPresentation';
import { addMineWorks } from '../src/game/town/TownMineWorks';
import { PLOTS } from '../src/game/town/TownLayout';
import { geometryFootprints, registerFootprints } from '../src/game/town/BuildingFootprints';
import { townNavigation } from '../src/game/town/TownNavigation';
import { createTownGeometries } from '../src/game/town/TownGeometries';

const views = [];
function fixture(from = 'motor-age', to = 'aviation') {
  const d = Object.create(TownDiorama.prototype);
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  d.town = { ...createTown(), era: from, transition: { from, to, pending: true } };
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.camera = new PerspectiveCamera(40, 1.6, 0.1, 400);
  d.camera.position.set(12, 12, 25);
  d.controls = { target: new Vector3(0, 0.7, 0), enabled: true };
  d.elapsed = 0;
  d.overview = true;
  d.motionEnabled = false;
  d.renderer = { shadowMap: {} };
  d.frameCache = { valid: true };
  d.render = vi.fn();
  d.actorRenderer = { update: vi.fn() };
  d.motions = [];
  const permanent = addMineWorks(d, d.world, from);
  d.staticScenery = { entries: new Map([['mine-works', { group: permanent }]]) };
  d.buildingRenderer = { batches: new Map([[permanent, { visible: true }]]) };
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    d.cinematic?.presentation.dispose(false);
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
  delete ERA_BY_ID['future-mine'];
});

it.each(ERAS.slice(1).map((era, i) => [ERAS[i].id, era.id]))(
  'constructs a visibly different %s → %s mine, with arriving and working crews',
  (from, to) => {
    const d = fixture(from, to);
    // A completed neighbouring bank used to truncate the third worker's approach.
    d.town.buildings.bank = 3;
    d.town.buildingEras.bank = to;
    d.town.buildingEraLevels.bank = 3;
    d.sign = () => {};
    const bank = d.group(d.world, PLOTS.bank[0], 0.08, PLOTS.bank[1]);
    d.buildPlot('bank', bank, d.town, { bank: 'Bank' });
    registerFootprints(bank, geometryFootprints(bank), { owner: 'plot:bank' });
    d.navigation = townNavigation(d.world);
    const savedTown = JSON.stringify(d.town);
    d.setCinematic(true);
    const effect = d.cinematic.presentation.effect;
    const old = new Box3().setFromObject(effect.previous);
    effect.frame(3);
    expect(effect.previous.visible).toBe(true);
    const arrivals = effect.sequence.crew.map(({ worker }) => worker.root.position.clone());
    effect.frame(8);
    expect(effect.previous.visible).toBe(false);
    effect.sequence.crew.forEach(({ worker, hammer }, i) => {
      expect(worker.root.visible).toBe(true);
      expect(hammer.visible).toBe(true);
      expect(worker.root.position.distanceTo(arrivals[i])).toBeGreaterThan(1);
      expect(worker.root.position.z).toBeLessThan(-16);
      const deck = effect.scaffold.children.filter(
        (part) => part.name === 'Builder working platform',
      )[i];
      const bounds = new Box3().setFromObject(deck);
      expect(bounds.max.y).toBeCloseTo(worker.root.position.y, 4);
      expect(worker.root.position.x).toBeGreaterThan(bounds.min.x);
      expect(worker.root.position.x).toBeLessThan(bounds.max.x);
      expect(worker.root.position.z).toBeGreaterThan(bounds.min.z);
      expect(worker.root.position.z).toBeLessThan(bounds.max.z);
      expect(worker.root.position.x).toBeGreaterThan(-7);
      expect(d.navigation.clear(worker.root.position.toArray())).toBe(true);
    });
    const arm = effect.sequence.crew[0].worker.arms[1].upper.rotation.x;
    effect.frame(8.2);
    expect(effect.sequence.crew[0].worker.arms[1].upper.rotation.x).not.toBe(arm);
    effect.frame(ERA_CONSTRUCTION.duration);
    expect(effect.sequence.sections.every(({ part }) => part.visible && part.scale.y === 1)).toBe(
      true,
    );
    expect(effect.sequence.crew.every(({ worker }) => !worker.root.visible)).toBe(true);
    const complete = new Box3().setFromObject(effect.next);
    expect(complete.isEmpty()).toBe(false);
    expect(effect.next.userData.profile.portal).not.toBe(effect.previous.userData.profile.portal);
    expect(JSON.stringify(d.town)).toBe(savedTown);
  },
);

it('hides the new static batch after the era reveal and restores it on skip/cleanup', () => {
  const d = fixture();
  d.setCinematic(true);
  const shot = d.cinematic.presentation;
  d.eraFrame(0.2);
  const group = addMineWorks(d, d.world, 'aviation'),
    batch = { visible: true };
  d.staticScenery.entries.set('mine-works', { group });
  d.buildingRenderer.batches.set(group, batch);
  d.eraFrame(0.5);
  expect(batch.visible).toBe(false);
  d.setCinematic(false);
  expect(batch.visible).toBe(true);
  expect(shot.effect.root.parent).toBeNull();
  expect(shot.effect.sequence.actors.group.parent).toBeNull();
  expect(d.camera.position.toArray()).toEqual([12, 12, 25]);
  expect(d.controls.enabled).toBe(true);
  expect(d.eventCamera).toBeNull();
  expect(d.cinematic).toBeNull();
});

it('shows the completed assembly immediately for reduced motion without moving the camera', () => {
  const d = fixture();
  d.setCinematic(true);
  d.eraFrame(1, true);
  expect(d.camera.position.toArray()).toEqual([12, 12, 25]);
  const effect = d.cinematic.presentation.effect;
  expect(effect.previous.visible).toBe(false);
  expect(effect.scaffold.visible).toBe(false);
  expect(effect.sequence.sections.every(({ part }) => part.visible)).toBe(true);
  expect(effect.sequence.crew.every(({ worker }) => !worker.root.visible)).toBe(true);
  expect(TownPresentation.supports('era-mine')).toBe(true);
});

it('inherits mine architecture for a future era and safely handles unknown identifiers', () => {
  ERA_BY_ID['future-mine'] = { evolution: { ...eraEvolution('contemporary') } };
  expect(mineAppearance('future-mine')).toBe(mineAppearance('contemporary'));
  expect(mineAppearance('constructor')).toBe(mineAppearance('frontier'));
  ERA_BY_ID['future-mine'] = {
    evolution: { ...eraEvolution('contemporary'), cityAssets: 'missing' },
  };
  expect(mineAppearance('future-mine')).toBe(mineAppearance('frontier'));
});

it('retains hillside workshops through Motor Age and refits them to its architecture', () => {
  const d = fixture('post-war', 'motor-age');
  const previous = d.staticScenery.entries.get('mine-works').group;
  const next = addMineWorks(d, d.world, 'motor-age');
  for (const key of ['crusher', 'fan-house', 'upper-terrace']) {
    const oldFeature = previous.getObjectByName(`Mine feature ${key}`);
    const feature = next.getObjectByName(`Mine feature ${key}`);
    expect(oldFeature).toBeDefined();
    expect(feature).toBeDefined();
    expect(feature.children[0].position).toEqual(oldFeature.children[0].position);
    const glazing = feature.getObjectByName('Era workshop glazing');
    expect(glazing).toBeDefined();
    const colors = new Set();
    feature.traverse((o) => {
      if (o.material?.color) colors.add(`#${o.material.color.getHexString()}`);
    });
    expect(colors).toContain(mineAppearance('motor-age').wall);
    expect(colors).not.toContain(mineAppearance('post-war').wall);
  }
  expect(next.getObjectByName('Mine feature truck-bay')).toBeDefined();
});

it('uses the new receipt when entering an era before the static town needs rebuilding', () => {
  const d = fixture('post-war', 'motor-age');
  d.town.transition.pending = false;
  d.setCinematic(true, { from: 'motor-age', to: 'aviation', pending: true });
  expect(d.cinematic.presentation.definition).toMatchObject({ from: 'motor-age', to: 'aviation' });
  const effect = d.cinematic.presentation.effect;
  effect.frame(ERA_CONSTRUCTION.duration);
  expect(new Box3().setFromObject(effect.next).max.y).toBeGreaterThan(7);
});
