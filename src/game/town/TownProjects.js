import { TOWN_PROJECTS, PROJECT_MILESTONES } from '../../data/townProjects';
import { BUILDING_BY_ID } from '../../data/town';
import { eraBuildingLevel } from './TownEras';
import { constructionReady, constructionRuns, upgradeOffer } from './TownRules';

// Progress comes from finished buildings, so purchases, hammers, imports and
// construction elsewhere in town all count without a second completion receipt.
export function townProjects(town) {
  return TOWN_PROJECTS.filter((project) => project.era === town.era).map((project) => {
    const buildings = project.buildings.map((id) => {
      const construction = town.projects[id];
      return {
        id,
        target: PROJECT_MILESTONES.length,
        name: BUILDING_BY_ID[id].shortName,
        level: eraBuildingLevel(town, id),
        construction,
        ready: !!construction && constructionReady(construction),
        runs: construction ? constructionRuns(construction) : 0,
        offer: upgradeOffer(town, id),
      };
    });
    const done = buildings.reduce((sum, building) => sum + building.level, 0);
    const total = buildings.length * PROJECT_MILESTONES.length;
    return {
      ...project,
      buildings,
      done,
      total,
      complete: done === total,
      milestones: PROJECT_MILESTONES.map((title, index) => ({
        title,
        level: index + 1,
        done: buildings.filter((building) => building.level > index).length,
        total: buildings.length,
      })),
    };
  });
}
