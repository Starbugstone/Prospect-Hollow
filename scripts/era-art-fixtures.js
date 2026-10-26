import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { finishEra, modernizesInEra } from '../src/game/town/TownEras';

// Developer review fixture only. Use the same saved stage/finish fields as a
// real town; production buildPlot owns modelLevel, native art and road setbacks.
export function reviewTownFor(era, level = 3) {
  const town = createTown();
  town.era = era.id;
  town.projects = {};
  const index = ERAS.findIndex(({ id }) => id === era.id);
  for (const building of BUILDINGS) {
    if (ERAS.findIndex(({ id }) => id === building.introducedEra) > index) continue;
    const native = building.introducedEra === era.id;
    town.buildings[building.id] = native
      ? Math.min(level, building.upgrades.length)
      : building.upgrades.length;
    town.buildingEras[building.id] = finishEra(building.id, era.id);
    town.buildingEraLevels[building.id] =
      era.id === 'frontier' ? 0 : native || modernizesInEra(era.id, building.id) ? level : 3;
  }
  return town;
}

export const reviewStageCount = (building, era) =>
  building.introducedEra === era.id
    ? building.upgrades.length
    : modernizesInEra(era.id, building.id)
      ? 3
      : 1;
