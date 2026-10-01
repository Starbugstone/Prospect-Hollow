import { afterEach, describe, expect, it, vi } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { PLOTS } from '../src/game/town/TownLayout';
import { ERAS, eraEvolution } from '../src/data/eras';
import { createTown } from '../src/data/town';
import { electricLamps } from '../src/data/industrial';
import { SQUARE_CORNERS, squareLampCorners } from '../src/data/townSquare';

const views = [];
afterEach(() => {
  for (const d of views.splice(0)) {
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});
function electrifiedTown(era, squareEra, stage, level) {
  const town = createTown();
  town.era = era;
  town.buildings.powerHouse = 1;
  town.buildings.square = stage;
  town.buildingEras.square = squareEra;
  town.buildingEraLevels.square = level;
  return town;
}
// Tall thin posts the square itself draws, in square-relative coordinates.
function squarePosts(town) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    town,
    sign: vi.fn(),
  });
  views.push(d);
  const root = new Group();
  d.buildPlot('square', root, town, { square: 'Town square' });
  root.updateMatrixWorld(true);
  const posts = [];
  root.traverse((part) => {
    if (!part.isMesh) return;
    const b = new Box3().setFromObject(part),
      size = b.getSize(new Vector3());
    if (size.x < 0.2 && size.z < 0.2 && size.y > 2.3) {
      const c = b.getCenter(new Vector3());
      posts.push([c.x, c.z]);
    }
  });
  return posts;
}
const electrified = ERAS.filter((era) => eraEvolution(era.id).electricity).map((era) => era.id);
const cases = electrified.flatMap((era) => [
  [era, 'frontier', 4, 1],
  [era, 'frontier', 5, 1],
  ...[1, 2, 3].map((level) => [era, era, 5, level]),
  [era, 'unknown-square-era', 5, 1],
]);

describe('Town square corner lighting', () => {
  it.each(cases)(
    'lights each square corner once in %s (square %s, stage %i, level %i)',
    (era, squareEra, stage, level) => {
      const town = electrifiedTown(era, squareEra, stage, level);
      const [sx, sz] = PLOTS.square;
      const posts = [
        ...squarePosts(town),
        ...electricLamps(town).map(([x, z]) => [x - sx, z - sz]),
      ];
      for (const [cx, cz] of SQUARE_CORNERS) {
        const near = posts.filter(([x, z]) => Math.hypot(x - cx, z - cz) < 1.2);
        expect(near).toHaveLength(1);
      }
    },
  );

  it('keeps the street lamps away from the square', () => {
    const town = electrifiedTown('tomorrow', 'tomorrow', 5, 3);
    expect(squareLampCorners(town)).toEqual([0, 1, 2, 3]);
    expect(electricLamps(town)).toEqual([
      [-2, 6, 0],
      [2, 14, 0],
      [-14, -15.5, 0],
    ]);
    // A level-one square lights only its back corners, so the front lamps remain,
    // standing on the square's raised paving.
    town.buildingEraLevels.square = 1;
    expect(electricLamps(town).slice(0, 2)).toEqual([
      [-2.35, -2.7, 0.16],
      [2.35, -2.7, 0.16],
    ]);
    town.buildings.powerHouse = 0;
    expect(electricLamps(town)).toEqual([]);
  });
});
