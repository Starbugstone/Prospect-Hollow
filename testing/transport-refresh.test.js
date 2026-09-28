import { expect, it } from 'vitest';
import { Group, MeshBasicMaterial, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { addAviationActivity } from '../src/game/town/TownAviation';
import { addEraActivity, trackTransport } from '../src/game/town/TownEraActivity';
import { refreshTransport } from '../src/game/town/TownTransports';
import { BUILDINGS, createTown } from '../src/data/town';
import { plotInEra } from '../src/game/town/TownEras';

function scene(era) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    actors: [],
    motions: [],
    visitorTransports: new Map(),
  });
  d.sign = () => {};
  const town = createTown();
  town.era = era;
  for (const b of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = 'contemporary';
    town.buildingEraLevels[b.id] = 3;
  }
  d.town = town;
  d.transports = new Map();
  addEraActivity(d, town);
  trackTransport(d, 'airport', town, addAviationActivity(d, town));
  return { d, town };
}
const names = (d) => {
  const found = [];
  d.world.traverse((o) => {
    if (
      [
        'Passenger jet',
        'Sky saucer',
        'Solar river ferry',
        'Hover river ferry',
        'Electric city train',
        'Solar express train',
      ].includes(o.name)
    )
      found.push(o.name);
  });
  return found.sort();
};

// A finished modernization swaps one plot incrementally, without a full town rebuild.
// Its vehicle must follow the building's new era at once, not after the next reload.
it('restyles only the vehicle whose building finished a new-era modernization', () => {
  const { d, town } = scene('tomorrow');
  expect(names(d)).toEqual(['Electric city train', 'Passenger jet', 'Solar river ferry']);
  const motions = d.motions.length;
  const train = d.transports.get('railDepot').root;
  town.buildingEras.airport = 'tomorrow';
  expect(refreshTransport(d, 'airport', town)).toBe(true);
  expect(names(d)).toEqual(['Electric city train', 'Sky saucer', 'Solar river ferry']);
  expect(d.motions).toHaveLength(motions);
  expect(d.transports.get('railDepot').root).toBe(train);
  town.buildingEras.riverPort = 'tomorrow';
  town.buildingEras.railDepot = 'tomorrow';
  refreshTransport(d, 'riverPort', town);
  refreshTransport(d, 'railDepot', town);
  expect(names(d)).toEqual(['Hover river ferry', 'Sky saucer', 'Solar express train']);
  expect(d.motions).toHaveLength(motions);
  // The live motions drive the new vehicles and report them to visitor arrivals.
  d.motions.forEach((motion) => motion(3));
  expect(d.visitorTransports.get('airport').root.name).toBe('Sky saucer');
});

it('leaves vehicles alone when a swap does not change their building era', () => {
  const { d, town } = scene('contemporary');
  const plane = d.transports.get('airport').root;
  expect(refreshTransport(d, 'airport', town)).toBe(false);
  expect(refreshTransport(d, 'home', town)).toBe(false);
  expect(d.transports.get('airport').root).toBe(plane);
  expect(plane.parent).toBe(d.world);
});
