import { ERAS } from '../src/data/eras';
import { afterEach, expect, it, vi } from 'vitest';
import { MeshBasicMaterial, Scene } from 'three';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { eraIndex } from '../src/game/town/TownEras';
import { BUILDINGS, createTown } from '../src/data/town';

const views = [];
function fixture() {
  const view = Object.create(TownDiorama.prototype);
  view.scene = new Scene();
  view.geometries = createTownGeometries();
  view.materials = new Map();
  view.contactShadowMaterial = new MeshBasicMaterial();
  view.sign = () => {};
  view.elapsed = 0;
  view.controls = {};
  view.renderer = { shadowMap: {} };
  view.render = () => {};
  view.actorRenderer = new TownActors(view.scene);
  view.buildingRenderer = new TownStatics(view.scene);
  view.upgradeGlow = new TownUpgradeGlow(view.scene);
  const town = createTown();
  Object.assign(town.buildings, { home: 2, farm: 3, well: 1 });
  const labels = Object.fromEntries(BUILDINGS.map(({ id, shortName }) => [id, shortName]));
  labels.mine = 'Mine';
  views.push(view);
  return { view, town, labels };
}
afterEach(() => {
  for (const view of views.splice(0)) {
    view.actorRenderer.dispose();
    view.buildingRenderer.dispose();
    view.upgradeGlow.dispose();
    view.staticScenery?.dispose(view);
    view.clearGroup(view.world);
    Object.values(view.geometries).forEach((geometry) => geometry.dispose());
    view.materials.forEach((material) => material.dispose());
    view.contactShadowMaterial.dispose();
  }
});

it('reuses unchanged plots and windmills while rebuilding a changed construction site', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  const home = view.plotCache.get('home').group;
  const farm = view.plotCache.get('farm');
  const rotorPosition = farm.movingPart.rotor.position.clone();
  const dispose = vi.spyOn(home.children.find((child) => child.isMesh).geometry, 'dispose');
  town.projects.home = { stage: 2, wins: 0, required: 2 };
  view.update(town, labels, 0, 'home');
  expect(view.plotCache.get('farm').group).toBe(farm.group);
  expect(farm.movingPart.rotor.parent).toBe(view.world);
  expect(farm.movingPart.rotor.position.equals(rotorPosition)).toBe(true);
  expect(view.motions).toContain(farm.movingPart.update);
  expect(view.plotCache.get('home').group).not.toBe(home);
  expect(dispose).toHaveBeenCalledOnce();
  const existingBatches = [...view.buildingRenderer.meshes];
  view.finishConstruction();
  expect(view.buildingRenderer.meshes).toHaveLength(existingBatches.length + 1);
  for (const batch of existingBatches) expect(view.buildingRenderer.meshes).toContain(batch);
  const settled = view.plotCache.get('home').group;
  const settledBatch = view.buildingRenderer.batches.get(settled);
  view.update(town, labels);
  expect(view.plotCache.get('home').group).toBe(settled);
  expect(view.buildingRenderer.batches.get(settled)).toBe(settledBatch);
});

it('rebuilds an interrupted reveal and invalidates models for progress, labels, mine stage and era', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels, 0, 'home');
  const interrupted = view.construction;
  view.update(town, labels, 0, 'farm');
  expect(interrupted.effects.parent).toBeNull();
  expect(view.plotCache.get('home').group).not.toBe(interrupted.group);
  expect(view.construction.group).toBe(view.plotCache.get('farm').group);
  view.finishConstruction();
  for (const change of [
    () => {
      town.projects.home = { stage: 2, wins: 1, required: 2 };
    },
    () => {
      labels.home = 'Maison';
    },
    () => {
      town.buildingEras.home = 'river-rail';
      town.buildingEraLevels.home = 2;
    },
    () => {
      town.era = 'river-rail';
    },
  ]) {
    const before = view.plotCache.get('home').group;
    change();
    view.update(town, labels);
    expect(view.plotCache.get('home').group).not.toBe(before);
  }
  const mine = view.plotCache.get('mine').group;
  view.update(town, labels, 1);
  expect(view.plotCache.get('mine').group).not.toBe(mine);
});

it.each(ERAS.map((era) => era.id))(
  'retains real %s plot geometry across updates and releases removed plots',
  (era) => {
    const { view, town, labels } = fixture();
    town.era = era;
    for (const building of BUILDINGS) {
      if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
      town.buildings[building.id] = building.upgrades.length;
      town.buildingEras[building.id] = era;
      town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
    }
    view.update(town, labels, 24);
    const groups = [...view.plotCache].map(([id, cached]) => [id, cached.group]);
    view.update(town, labels, 24);
    for (const [id, group] of groups) expect(view.plotCache.get(id).group).toBe(group);
    for (const mesh of view.buildingRenderer.meshes) {
      const positions = mesh.geometry.getAttribute('position');
      expect([...positions.array].every(Number.isFinite)).toBe(true);
      expect(mesh.geometry.index).not.toBeNull();
    }
    const home = view.plotCache.get('home').group;
    const dispose = vi.spyOn(home.children.find((child) => child.isMesh).geometry, 'dispose');
    view.update(createTown(), labels);
    expect(view.plotCache.get('home').group).not.toBe(home);
    expect(home.parent.parent).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
    expect(view.plotCache.has('garage')).toBe(false);
  },
);

it.each(ERAS.map((era) => era.id))(
  'keeps unrelated %s scenery and GPU buffers through a construction cycle',
  (era) => {
    const { view, town, labels } = fixture();
    town.era = era;
    for (const building of BUILDINGS) {
      if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
      town.buildings[building.id] = building.upgrades.length;
      town.buildingEras[building.id] = era;
      town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 2;
    }
    view.update(town, labels);
    const scenery = [...view.staticScenery.entries.values()].filter(({ group }) => group);
    const farm = view.plotCache.get('farm').group;
    const retained = [...scenery.map(({ group }) => group), farm].map((root) => ({
      root,
      mesh: view.buildingRenderer.batches.get(root),
    }));
    const disposals = retained.map(({ mesh }) => vi.spyOn(mesh.geometry, 'dispose'));
    town.projects.home = { id: 'home', stage: 3, wins: 0, required: 2 };
    view.update(town, labels, 0, 'home');
    view.finishConstruction();
    town.projects.home.wins = 2;
    view.update(town, labels);
    delete town.projects.home;
    town.buildingEraLevels.home = 3;
    view.update(town, labels, 0, 'home');
    view.finishConstruction();
    for (const { root, mesh } of retained) {
      expect(view.buildingRenderer.batches.get(root) === mesh).toBe(true);
      expect(root.parent === view.world).toBe(true);
      expect(mesh.parent === view.scene).toBe(true);
    }
    for (const dispose of disposals) expect(dispose).not.toHaveBeenCalled();
    expect(view.buildingRenderer.meshes.length).toBeLessThanOrEqual(
      view.plotCache.size + view.staticScenery.entries.size,
    );
  },
);

it('invalidates infrastructure when routes, road tiers, electricity or the railroad change', () => {
  const { view, town, labels } = fixture();
  town.era = 'industrial';
  const cached = (id) => view.staticScenery.entries.get(id).group;
  view.update(town, labels);
  const forecourt = cached('forecourt');
  let roads = cached('roads');
  town.buildings.bank = 5;
  town.buildings.shop = 3;
  view.update(town, labels);
  expect(cached('roads') === roads).toBe(false);
  const beforeElectric = cached('power');
  town.buildings.powerHouse = 1;
  view.update(town, labels);
  expect(cached('lights')).toBeTruthy();
  expect(cached('power') === beforeElectric).toBe(false);
  roads = cached('roads');
  const power = cached('power');
  town.buildings.bridge = 1;
  view.update(town, labels);
  expect(cached('roads') === roads).toBe(false);
  expect(cached('power') === power).toBe(false);
  town.buildings.railDepot = 1;
  view.update(town, labels);
  const rails = cached('railroad');
  const batch = view.buildingRenderer.batches.get(rails);
  const dispose = vi.spyOn(batch.geometry, 'dispose');
  expect(rails.name).toBe('Station connecting railroad');
  expect(cached('forecourt') === forecourt).toBe(true);
  view.update(createTown(), labels);
  expect(cached('railroad')).toBeNull();
  expect(cached('lights')).toBeUndefined();
  expect(cached('power')).toBeUndefined();
  expect(cached('forecourt') === forecourt).toBe(false);
  expect(batch.parent).toBeNull();
  expect(dispose).toHaveBeenCalledOnce();
});

it('removes cached overhead wires when entering Contemporary with the same road topology', () => {
  const { view, town, labels } = fixture();
  town.era = 'post-war';
  town.buildings.powerHouse = 1;
  view.update(town, labels);
  const wires = view.staticScenery.entries.get('power').group;
  expect(wires).toBeTruthy();
  const batch = view.buildingRenderer.batches.get(wires);
  town.era = 'contemporary';
  view.update(town, labels);
  expect(view.staticScenery.entries.get('power').group).toBeUndefined();
  expect(wires.parent).toBeNull();
  expect(batch.parent).toBeNull();
});

it('keeps the mine solid until the rail depot opens its tunnel, then restores it on reset', () => {
  const { view, town, labels } = fixture();
  const hillside = () => view.staticScenery.entries.get('mine-hillside');
  view.update(town, labels);
  const solid = hillside().group;
  expect(hillside().signature).toBe(false);
  town.era = 'river-rail';
  town.projects.railDepot = { stage: 1, wins: 1, required: 1 };
  view.update(town, labels);
  expect(hillside().group).toBe(solid);
  delete town.projects.railDepot;
  town.buildings.railDepot = 1;
  view.update(town, labels);
  expect(hillside().signature).toBe(true);
  const tunnel = hillside().group;
  expect(tunnel).not.toBe(solid);
  expect(solid.parent).toBeNull();
  view.update(createTown(), labels);
  expect(hillside().signature).toBe(false);
  expect(hillside().group).not.toBe(tunnel);
  expect(tunnel.parent).toBeNull();
});
