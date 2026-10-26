import { afterEach, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownScenery } from '../src/game/town/TownScenery';
import { mineHillsideHeight } from '../src/game/town/TownMineHillside';
import { PLOTS } from '../src/game/town/TownLayout';

const SIZE = 400;
const views = [];
afterEach(() => {
  for (const d of views.splice(0)) d.disposePrimitives();
});

function village(era) {
  const town = createTown();
  town.era = era;
  town.personalisation.plaques.mine = 'player-alpha';
  town.displayDistinctions = { 'player-alpha': { at: 1 } };
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  views.push(d);
  Object.assign(d, {
    town,
    world: new Group(),
    scene: new Scene(),
    sign: () => {},
    motions: [],
    actors: [],
    targets: [],
    staticScenery: new TownScenery(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: SIZE, height: SIZE }) },
    raycaster: new Raycaster(),
    camera: new PerspectiveCamera(50, 1, 0.1, 500),
    showVillager: () => false,
    render: vi.fn(),
    onSelect: vi.fn(),
  });
  d.scene.add(d.world);
  d.raycaster.layers.enable(1);
  d.staticScenery.update(d, town);
  d.camera.position.set(PLOTS.mine[0], 16, PLOTS.mine[1] + 24);
  d.camera.lookAt(PLOTS.mine[0], 2, PLOTS.mine[1]);
  d.camera.updateMatrixWorld();
  d.world.updateMatrixWorld(true);
  return d;
}

const within = (object, root) => !!object && (object === root || within(object.parent, root));
// What a tap on each point of a coarse screen grid touches first among the mine scenery.
function taps(d, roots) {
  const probe = new Raycaster();
  probe.layers.enable(1);
  const found = [];
  for (let y = 4; y < SIZE; y += 12)
    for (let x = 4; x < SIZE; x += 12) {
      probe.setFromCamera(new Vector2((x / SIZE) * 2 - 1, 1 - (y / SIZE) * 2), d.camera);
      const hit = probe.intersectObjects(roots, true)[0];
      if (hit) found.push({ x, y, hit });
    }
  return found;
}

it.each(ERAS.filter((era) => era.enabled).map((era) => era.id))(
  'enters the mine from a tap anywhere on its %s structure or hill, not only its portal',
  (era) => {
    const d = village(era);
    const [works, hill, plaque] = ['mine-works', 'mine-hillside', 'mine-plaque'].map(
      (id) => d.staticScenery.entries.get(id).group,
    );
    let portal;
    works.traverse((object) => {
      if (!portal && object.name.startsWith('Mine portal')) portal = object;
    });
    const points = taps(d, [works, hill, plaque]);
    const rise = ({ hit }) => mineHillsideHeight(hit.point.x, hit.point.z, PLOTS.mine[1], 0);
    const cases = {
      works: points.find(({ hit }) => within(hit.object, works) && !within(hit.object, portal)),
      hill: points.find((point) => within(point.hit.object, hill) && rise(point) >= 0.5),
      slope: points.find((point) => within(point.hit.object, hill) && rise(point) < 0.5),
    };
    for (const [part, point] of Object.entries(cases)) {
      expect(point, `a ${part} tap`).toBeDefined();
      d.onSelect.mockClear();
      d.pickTown(point.x, point.y);
      if (part === 'slope') expect(d.onSelect, part).not.toHaveBeenCalledWith('mine');
      else expect(d.onSelect, part).toHaveBeenCalledWith('mine');
    }
    // The badge above the entrance stays in front of the works and still names itself.
    d.onSelect.mockClear();
    const badge = plaque.getWorldPosition(new Vector3()).project(d.camera);
    expect(d.pickTown(((badge.x + 1) / 2) * SIZE, ((1 - badge.y) / 2) * SIZE)).toBe(true);
    expect(d.namedPlaque).toBe(plaque);
    expect(d.onSelect).not.toHaveBeenCalled();
    // Empty sky above the valley still answers nothing.
    expect(d.pickTown(SIZE / 2, 2)).toBe(false);
    expect(d.onSelect).not.toHaveBeenCalled();
  },
  // The first era also builds the shared primitive caches.
  20000,
);
