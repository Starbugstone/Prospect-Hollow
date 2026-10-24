import { BUILDINGS } from '../../src/data/town';
import { FRONTIER_ERA } from '../../src/data/eras';
import { ERA_BUILDING_LEVELS, finishEra, plotInEra } from '../../src/game/town/TownEras';
import { normalizeTown } from '../../src/game/town/TownRules';

// A stored town in `era` with every building of that era fully built and modernized and
// the next transition not started: what a player has after finishing the era's
// construction. Tests seed it as a saved profile, never through a store mutation.
export function completedEraTown(town, era) {
  const next = structuredClone(town);
  Object.assign(next, { era, projects: {}, transition: null, tourSeen: true });
  for (const building of BUILDINGS) {
    const visible = plotInEra(next, building.id);
    next.buildings[building.id] = visible ? building.upgrades.length : 0;
    next.buildingEras[building.id] = visible ? finishEra(building.id, era) : FRONTIER_ERA;
    next.buildingEraLevels[building.id] =
      visible && era !== FRONTIER_ERA
        ? building.introducedEra === era
          ? building.upgrades.length
          : ERA_BUILDING_LEVELS
        : 0;
  }
  next.firstLightsSeen = next.buildings.powerHouse > 0;
  return normalizeTown(next);
}
