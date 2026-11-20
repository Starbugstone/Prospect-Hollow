import { afterEach, expect, it } from 'vitest';
import { Group } from 'three';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { buildPlot } from '../src/game/town/TownPlots';
import { BUILDINGS } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { PLOTS } from '../src/game/town/TownLayout';
import { reviewTownFor } from '../scripts/era-art-fixtures';
import { coplanarSurfaces } from './helpers/coplanarSurfaces';

const drawings = [];
function drawing(era) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = reviewTownFor(era);
  drawings.push(d);
  return d;
}
afterEach(() => drawings.splice(0).forEach((d) => d.disposePrimitives()));
const labels = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.name]));
const common = [
  'bank',
  'sheriff',
  'school',
  'doctor',
  'post',
  'shop',
  'powerHouse',
  'fireStation',
  'garage',
  'blacksmith',
  'warehouse',
  'mill',
  'saloon',
  'hotel',
  'market',
  'diner',
  'railDepot',
  'busDepot',
  'concertHall',
  'library',
  'cityHall',
  'transitHub',
  'armory',
  'stable',
  'supermarket',
  'maglevStation',
];

it('rejects exposed competing surfaces, accepts inset details, and ignores hidden joins', () => {
  const d = drawing(ERAS[0]),
    root = new Group();
  d.box(root, 2, 2, 2, 0, 1, 0, '#ffffff');
  const detail = d.box(root, 0.5, 0.5, 0.1, 0, 1, 0.95, '#ff0000');
  expect(coplanarSurfaces(root).length).toBeGreaterThan(0);
  detail.position.z += 0.03;
  expect(coplanarSurfaces(root)).toEqual([]);
  detail.position.z -= 0.03;
  const cover = d.box(root, 3, 3, 3, 0, 1, 0, '#000000');
  expect(coplanarSurfaces(root)).toEqual([]);
  cover.removeFromParent();
  root.rotation.y = 0.45;
  expect(coplanarSurfaces(root).length).toBeGreaterThan(0);
});

it.each(ERAS)(
  'keeps $id homes and working buildings free of exposed coplanar paint',
  (era) => {
    const d = drawing(era);
    // Match the overhaul gallery: the early civic cast, then every purpose massing
    // from Canopy onward, with all available home plots in every era.
    const available = common.filter((id) => PLOTS[id] && d.town.buildings[id]);
    const working =
      ERAS.indexOf(era) < ERAS.findIndex((e) => e.id === 'canopy')
        ? available.slice(0, 6)
        : available;
    const ids = [...working, 'home', 'home2', 'home3', 'home4', 'home5'].filter(
      (id) => PLOTS[id] && d.town.buildings[id],
    );
    for (const id of ids) {
      const root = new Group();
      root.userData.plot = id;
      buildPlot(d, id, root, d.town, labels);
      const overlaps = coplanarSurfaces(root).map(({ a, b, point }) => ({
        a: a.name || a.parent.name,
        b: b.name || b.parent.name,
        point: point.toArray(),
      }));
      expect(overlaps, `${era.id}/${id}`).toEqual([]);
    }
  },
  20000,
);
