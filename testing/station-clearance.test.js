import { expect, it } from 'vitest';
import { Box3, Group, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { PLOTS, RAIL_EDGE, plotStreet } from '../src/game/town/TownLayout';
import { addEraActivity } from '../src/game/town/TownEraActivity';
import { createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { NPC_BODY_MARGIN, SIDEWALK_OFFSET } from '../src/data/townClearances';

it.each([...ERAS.filter((era) => era.id !== 'frontier').map((era) => era.id), 'future-station'])(
  'keeps the %s station, platform and scaffolding clear of trains and the front street',
  (era) => {
    const d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      scene: new Scene(),
      world: new Group(),
      geometries: createTownGeometries(),
      materials: new Map(),
      actors: [],
      motions: [],
      sign: () => {},
      town: createTown(),
    });
    d.town.era = era;
    d.town.buildings.railDepot = 1;
    d.town.buildingEras.railDepot = era;
    d.town.buildingEraLevels.railDepot = 3;
    addEraActivity(d, d.town);
    d.motions.forEach((motion) => motion(10)); // Train dwelling beside the platform.
    const train = new Box3().setFromObject(d.world.children[0]);
    const [x, z] = PLOTS.railDepot;
    try {
      for (const level of [1, 2, 3])
        for (const eraLevel of [1, 2, 3])
          for (const wins of [null, 0, 1, 2]) {
            d.town.buildings.railDepot = level;
            d.town.buildingEraLevels.railDepot = eraLevel;
            if (wins === null) delete d.town.projects.railDepot;
            else d.town.projects.railDepot = { stage: level + 1, wins, required: 3 };
            const root = new Group();
            root.position.set(x, 0.08, z);
            d.buildPlot('railDepot', root, d.town, { railDepot: 'Station' }, 0);
            const bounds = new Box3().setFromObject(root);
            const state = `${era} service=${level} upgrade=${eraLevel} construction=${wins}`;
            // The rendered ballast is 1.7 units wide; neither platforms nor
            // their canopy supports may cover its station-side edge.
            expect(bounds.min.z, state).toBeGreaterThan(RAIL_EDGE.from[1] + 0.85);
            expect(bounds.intersectsBox(train), state).toBe(false);
            expect(bounds.max.z, state).toBeLessThanOrEqual(
              plotStreet('railDepot')[1] - SIDEWALK_OFFSET - NPC_BODY_MARGIN + 1e-6,
            );
            d.clearGroup(root);
          }
    } finally {
      d.clearGroup(d.world);
      Object.values(d.geometries).forEach((geometry) => geometry.dispose());
      d.materials.forEach((material) => material.dispose());
    }
  },
);
