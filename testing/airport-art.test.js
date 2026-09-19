import { afterEach, expect, it } from 'vitest';
import { Box3, Group, Vector3 } from 'three';
import { airportAppearance } from '../src/data/airport';
import { defineEra } from '../src/data/eraDefinitions';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import future from '../src/assets/future-meshes.json';

afterEach(() => {
  delete ERA_BY_ID['airport-test-era'];
});

it.each(['aviation', 'broadcast', 'contemporary'])(
  '%s has a complete three-stage airport inside its site and clear of the aircraft wings',
  (era) => {
    const view = Object.create(TownDiorama.prototype);
    view.geometries = createTownGeometries();
    view.materials = new Map();
    view.sign = () => {};
    const { asset } = airportAppearance(era);
    for (const level of [1, 2, 3]) {
      const root = new Group();
      expect(renderCityBuilding(view, root, 'airport', 'Airport', level, era)).toBe(true);
      const names = [];
      root.traverse((part) => {
        if (part.name.startsWith('Blender ')) names.push(part.name.slice(8));
      });
      expect(names).toEqual([asset, `${asset}-wing`, `${asset}-finish`].slice(0, level));
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-10);
      expect(bounds.max.x).toBeLessThanOrEqual(10);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-20);
      expect(bounds.max.z).toBeLessThanOrEqual(20);
    }
    const parts = [asset, `${asset}-wing`, `${asset}-finish`].flatMap(
      (name) => future.models[name],
    );
    // Plane's right wing ends at local x=-0.9; structures start beyond the apron.
    for (const part of parts)
      for (let i = 0; i < part.positions.length; i += 3)
        if (part.positions[i + 1] > 0.5) expect(part.positions[i]).toBeGreaterThan(-0.8);
    expect(parts.reduce((n, part) => n + part.indices.length / 3, 0)).toBeLessThan(5000);
  },
);

it('changes the airport architecture across eras, not only a generic rooftop cue', () => {
  const names = ['aviation', 'broadcast', 'contemporary'].map(
    (era) => airportAppearance(era).asset,
  );
  expect(new Set(names).size).toBe(3);
  const positions = names.map((name) =>
    JSON.stringify(future.models[name].flatMap((part) => part.positions)),
  );
  expect(new Set(positions).size).toBe(3);
});

it.each(['aviation', 'broadcast', 'contemporary'])(
  '%s keeps the runway-facing hangar exit clear of all three construction stages',
  (era) => {
    const plane = new Box3();
    for (const part of future.models.airplane)
      for (let i = 0; i < part.positions.length; i += 3)
        plane.expandByPoint(
          new Vector3(
            part.positions[i] + part.pivot[0],
            part.positions[i + 1] + part.pivot[1],
            part.positions[i + 2] + part.pivot[2],
          ),
        );
    // Aircraft points west: its wings span Z. This entire route must remain
    // clear, including inside the hangar, not just along the runway centerline.
    // Low paving and runway edge lights sit below the wings and are excluded.
    const exit = new Box3(
      new Vector3(-5 - plane.max.z, 0.5, 10 + plane.min.x - 0.15),
      new Vector3(4.625 - plane.min.z, plane.max.y + 0.3, 10 + plane.max.x + 0.15),
    );
    const { asset } = airportAppearance(era);
    const triangle = new Box3();
    const point = new Vector3();
    for (const stage of [asset, `${asset}-wing`, `${asset}-finish`])
      for (const part of future.models[stage])
        for (let i = 0; i < part.indices.length; i += 3) {
          triangle.makeEmpty();
          for (const index of part.indices.slice(i, i + 3)) {
            point.fromArray(part.positions, index * 3);
            triangle.expandByPoint(point);
          }
          expect(triangle.intersectsBox(exit), `${stage}: ${part.name}, triangle ${i / 3}`).toBe(
            false,
          );
        }
  },
);

it('inherits airport art from a future era definition and falls back for incomplete styles', () => {
  const define = (airportStyle) => {
    ERA_BY_ID['airport-test-era'] = defineEra({
      ...ERAS.find((era) => era.id === 'contemporary'),
      id: 'airport-test-era',
      evolution: { ...eraEvolution('contemporary'), airportStyle },
    });
  };
  define('connected');
  expect(airportAppearance('airport-test-era')).toBe(airportAppearance('contemporary'));
  for (const style of [null, undefined, 'missing', '__proto__', 'constructor']) {
    define(style);
    expect(airportAppearance('airport-test-era')).toBe(airportAppearance('aviation'));
  }
  expect(airportAppearance('unknown-era')).toBe(airportAppearance('aviation'));
});
