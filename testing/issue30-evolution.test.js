import { describe, expect, it } from 'vitest';
import { Group, Scene, BoxGeometry, MeshBasicMaterial, Box3, Vector3 } from 'three';
import { createTown, BUILDINGS } from '../src/data/town';
import { TownDiorama } from '../src/game/town/TownDiorama';
import {
  pavedTown,
  modernTransport,
  motorTraffic,
  powerGrid,
} from '../src/game/town/TownEvolution';
import { PLOTS } from '../src/game/town/TownLayout';
import { addEraActivity } from '../src/game/town/TownEraActivity';
import { addTownVisitors } from '../src/game/town/TownActivity';
import { addMineEra } from '../src/game/town/TownMineEvolution';
import { addMineForecourt } from '../src/game/town/TownMineForecourt';
import {
  waterCapacity,
  foodCapacity,
  housingCapacity,
  visitorCapacity,
} from '../src/game/town/TownRules';

const townAt = (era) => {
  const town = createTown();
  town.era = era;
  const eras = [
    'frontier',
    'river-rail',
    'industrial',
    'post-war',
    'motor-age',
    'aviation',
    'broadcast',
    'contemporary',
  ];
  for (const b of BUILDINGS.filter((b) => eras.indexOf(b.introducedEra) <= eras.indexOf(era))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = 3;
  }
  return town;
};
function diorama() {
  const d = Object.create(TownDiorama.prototype);
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  const geometry = new BoxGeometry();
  d.geometries = Object.fromEntries(
    ['box', 'rounded', 'sphere', 'rock', 'cylinder', 'cone', 'shadow'].map((k) => [k, geometry]),
  );
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.motions = [];
  d.actors = [];
  d.sign = () => {};
  return d;
}
describe('Issue 30: visible village evolution', () => {
  it.each(['frontier', 'river-rail', 'industrial', 'motor-age'])(
    'can supply every resident and visitor in a completed %s town',
    (era) => {
      const town = townAt(era),
        demand = housingCapacity(town) + visitorCapacity(town);
      expect(waterCapacity(town)).toBeGreaterThanOrEqual(demand);
      expect(foodCapacity(town)).toBeGreaterThanOrEqual(demand);
    },
  );
  it('paves the town on entering Electric, but evolves vehicles when their own buildings finish', () => {
    const town = townAt('river-rail');
    expect(pavedTown(town)).toBe(false);
    town.era = 'industrial';
    expect(pavedTown(town)).toBe(true);
    for (const id of ['railDepot', 'riverPort', 'stable'])
      expect(modernTransport(town, id)).toBe(false);
    town.buildingEras.stable = 'industrial';
    town.buildingEraLevels.stable = 1;
    expect(motorTraffic(town)).toBe(false);
    town.buildingEraLevels.stable = 2;
    expect(motorTraffic(town)).toBe(true);
    town.era = 'motor-age';
    expect(motorTraffic(town)).toBe(true);
  });
  it.each(['industrial', 'motor-age'])(
    'connects every built plot and mine to power in %s, only after the power house opens',
    (era) => {
      const town = townAt(era),
        full = powerGrid(town);
      expect(full.connections.map((c) => c.id).sort()).toEqual(
        Object.keys(PLOTS)
          .filter((id) => id === 'mine' || town.buildings[id])
          .sort(),
      );
      expect(new Set(full.poles.map((p) => p.join(','))).size).toBe(full.poles.length);
      expect(full.poles.length).toBeLessThan(100);
      for (const [x, , z] of full.poles)
        if (z >= -17.3 && z < -8.7) expect(Math.abs(x)).toBeGreaterThan(4.6);
      town.buildings.powerHouse = 0;
      expect(powerGrid(town).poles).toEqual([]);
    },
  );
  it('replaces steamboat, train and visiting horses with moving modern transport', () => {
    for (const era of ['river-rail', 'industrial']) {
      const d = diorama(),
        town = townAt(era);
      addEraActivity(d, town);
      addTownVisitors(d, town);
      const boat = d.world.getObjectByName(
        era === 'industrial' ? 'Modern river launch' : 'Paddle-wheel steamboat',
      );
      const train = d.world.getObjectByName(
        era === 'industrial' ? 'Modern station railcar' : 'Station train',
      );
      const traffic = d.world.getObjectByName(
        era === 'industrial' ? 'Touring car' : 'Visiting horse rider',
      );
      expect(boat).toBeTruthy();
      expect(train).toBeTruthy();
      expect(traffic).toBeTruthy();
      d.motions.forEach((m) => m(1));
      const before = traffic.position.clone();
      d.motions.forEach((m) => m(5));
      expect(traffic.position.distanceTo(before)).toBeGreaterThan(0.1);
    }
  });
  it('gives each later mine a different entrance silhouette', () => {
    const signatures = [];
    for (const era of ['frontier', 'river-rail', 'industrial', 'motor-age']) {
      const d = diorama(),
        root = new Group();
      addMineEra(d, root, era);
      let count = 0;
      root.traverse((o) => {
        if (o.isMesh) count++;
      });
      signatures.push(count);
    }
    expect(new Set(signatures).size).toBe(4);
  });
  it('extends the mine floor across the encounter while keeping tall props outside its lanes', () => {
    const d = diorama();
    d.batch = () => {};
    const root = addMineForecourt(d, createTown());
    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.z).toBeLessThan(-20);
    expect(bounds.max.z).toBeGreaterThan(-9);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const b = new Box3().setFromObject(o);
      if (b.max.y > 0.15) expect(b.max.x < -4.3 || b.min.x > 4.3).toBe(true);
    });
    expect(root.userData.static).toBe(true);
  });
});
