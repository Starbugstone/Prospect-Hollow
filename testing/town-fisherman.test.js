import { afterEach, expect, it, vi } from 'vitest';
import { Group, MeshBasicMaterial, Raycaster, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { townNavigation } from '../src/game/town/TownNavigation';
import { animalSpace } from '../src/game/town/TownAnimalSpace';
import { geometryFootprints, registerFootprints } from '../src/game/town/BuildingFootprints';
import { addEraActivity } from '../src/game/town/TownEraActivity';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { PLOTS } from '../src/game/town/TownLayout';
import { RIVER, riverCenterX } from '../src/game/town/TownRiver';
import { createTown, BUILDING_BY_ID } from '../src/data/town';
import { ERAS } from '../src/data/eras';

const views = [];
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});

it.each([...ERAS.map(({ id }) => id), 'future-fishing-era'])(
  'fishes above the water from the supported %s pier and returns after a break',
  (era) => {
    const d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      scene: new Scene(),
      world: new Group(),
      geometries: createTownGeometries(),
      materials: new Map(),
      contactShadowMaterial: new MeshBasicMaterial(),
      actors: [],
      motions: [],
      elapsed: 0,
      town: createTown(),
      plotCache: new Map(),
      sign() {},
    });
    views.push(d);
    d.scene.add(d.world);
    d.town.era = era;
    d.town.buildings.fisherman = BUILDING_BY_ID.fisherman.upgrades.length;
    d.town.buildingEras.fisherman = era;
    d.town.buildingEraLevels.fisherman = 3;
    const [x, z] = PLOTS.fisherman;
    const plot = d.group(d.world, x, 0.08, z);
    d.buildPlot('fisherman', plot, d.town, { fisherman: 'Fishing pier' });
    registerFootprints(plot, geometryFootprints(plot), { owner: 'plot:fisherman' });
    d.plotCache.set('fisherman', { group: plot });
    d.navigation = townNavigation(d.world);
    const space = animalSpace(d);
    addEraActivity(d, d.town);
    const actor = d.actors.find((a) => a.work === 'fishing');
    for (let rebuild = 0; rebuild < 3; rebuild++) {
      d.retainedActors = new Map([[actor.persistentKey, actor]]);
      d.actors = [];
      addEraActivity(d, d.town);
      expect(d.actors).toContain(actor);
      expect(
        actor.arms[1].lower.children.filter((o) => o.name === 'Hand-held fishing rod'),
      ).toHaveLength(1);
    }
    const station = actor.root.position.clone();
    expect(station.x).toBeGreaterThan(riverCenterX(z) - RIVER.halfWidth);
    expect(station.x).toBeLessThan(riverCenterX(z) - 1.5);
    expect(actor.walkPath.total).toBeGreaterThan(2);
    const phases = new Set(),
      plan = vi.spyOn(d.navigation, 'plan');
    let returned = false;
    plot.updateMatrixWorld(true);
    const ray = new Raycaster();
    for (let frame = 0; frame < 1400; frame++) {
      const time = frame / 10;
      d.animatePerson(actor, time);
      updateTownLocomotion(d, 0.1);
      phases.add(actor.workRoutine.phase);
      const p = actor.root.position;
      expect(space.clear(p.toArray(), 0.29, 1.65), `body at ${p.toArray()}`).toBe(true);
      // A shoe spans the small gaps between adjacent pier boards.
      const support = [0, -0.06, 0.06].flatMap((offset) => {
        ray.set(new Vector3(p.x + offset, p.y + 0.03, p.z), new Vector3(0, -1, 0));
        return ray.intersectObject(plot, true).slice(0, 1);
      })[0];
      expect(support, `pier under ${p.toArray()}`).toBeTruthy();
      expect(p.y - support.point.y).toBeCloseTo(0.01, 3);
      if (actor.workActive) {
        expect(p.distanceTo(station)).toBeLessThan(1e-5);
        expect(Math.sin(actor.root.rotation.y)).toBeGreaterThan(0.99);
        returned ||= phases.has('rest');
      }
    }
    expect([...phases].sort()).toEqual(['approach', 'rest', 'return', 'work']);
    expect(returned).toBe(true);
    expect(plan).not.toHaveBeenCalled();
  },
  30000,
);
