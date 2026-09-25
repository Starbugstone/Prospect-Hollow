import { expect, it } from 'vitest';
import { Box3, Group } from 'three';
import airportLayout from '../src/data/airportLayout.json';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import {
  airplanePose,
  addAviationActivity,
  AIRPORT_FLIGHT_CYCLE,
} from '../src/game/town/TownAviation';
import { AIRPORT } from '../src/game/town/TownLayout';

it.each(['aviation', 'broadcast', 'contemporary'])(
  '%s parks the entire passenger aircraft beyond the hangar roof',
  (era) => {
    const d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      geometries: createTownGeometries(),
      materials: new Map(),
      world: new Group(),
      motions: [],
    });
    try {
      addAviationActivity(d, { buildings: { airport: 3 }, buildingEras: { airport: era } });
      const bounds = new Box3().setFromObject(d.world.children[0]);
      const hangarEnd =
        AIRPORT.center[1] + airportLayout.hangar.centerZ + airportLayout.hangar.roofRadius;
      expect(bounds.min.z).toBeGreaterThan(hangarEnd);
    } finally {
      d.clearGroup(d.world);
      Object.values(d.geometries).forEach((g) => g.dispose());
      d.materials.forEach((m) => m.dispose());
    }
  },
);

it('flies arrivals and departures in separate intervals with quiet time between them', () => {
  const phases = [];
  let previous;
  for (let t = 0; t < AIRPORT_FLIGHT_CYCLE * 2; t += 0.1) {
    const pose = airplanePose(t);
    if (pose.phase !== previous?.phase) phases.push(pose.phase);
    if (previous?.visible && pose.visible) {
      expect(
        Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z),
      ).toBeLessThan(1);
      const turn = Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw));
      expect(Math.abs(turn)).toBeLessThan(0.13);
    }
    if (pose.phase === 'takeoff' || pose.phase === 'landing') expect(pose.x).toBe(AIRPORT.runwayX);
    previous = pose;
  }
  expect(phases.filter((p) => p === 'takeoff')).toHaveLength(2);
  expect(phases.filter((p) => p === 'landing')).toHaveLength(2);
  expect(phases.indexOf('away')).toBeGreaterThan(phases.indexOf('takeoff'));
  expect(phases.indexOf('landing')).toBeGreaterThan(phases.indexOf('away'));
  expect(airplanePose(90).visible).toBe(false);
  expect(airplanePose(150).y).toBeGreaterThan(airplanePose(151).y);
  expect(airplanePose(151).y).toBeCloseTo(0.2);
  expect(airplanePose(0)).toEqual(airplanePose(AIRPORT_FLIGHT_CYCLE));
  expect(airplanePose(0).propellers).toBe(false);
});

it('uses one aircraft and one animation callback for every phase, and none before construction', () => {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.world = new Group();
  d.motions = [];
  try {
    addAviationActivity(d, { buildings: { airport: 0 } });
    expect(d.world.children).toHaveLength(0);
    expect(d.motions).toHaveLength(0);
    addAviationActivity(d, { buildings: { airport: 3 } });
    expect(d.world.children).toHaveLength(1);
    expect(d.motions).toHaveLength(1);
    const plane = d.world.children[0];
    for (let t = 0; t <= AIRPORT_FLIGHT_CYCLE * 2; t += 0.5) {
      d.motions[0](t);
      expect(d.world.children).toEqual([plane]);
      expect(plane.userData.flightPhase).toBe(airplanePose(t).phase);
      expect(plane.visible).toBe(airplanePose(t).visible);
    }
  } finally {
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
});
