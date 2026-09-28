import { createTown } from '../data/town';

// Build an isolated render model. Never patch campaign/game stores from a visit.
export function villageAppearance(village) {
  const town = createTown();
  const appearance = village.appearance;
  town.era = appearance.era;
  for (const key of ['buildings', 'buildingEras', 'buildingEraLevels'])
    for (const id of Object.keys(town[key]))
      if (Object.hasOwn(appearance[key], id)) town[key][id] = appearance[key][id];
  for (const [id, project] of Object.entries(appearance.projects ?? {})) {
    if (!Object.hasOwn(town.buildings, id)) continue;
    town.projects[id] = {
      id,
      stage: project.stage,
      type: project.type,
      targetEra: project.targetEra,
      eraLevel: project.eraLevel,
      required: 3,
      wins: project.visualStage,
    };
  }
  town.infrastructure = {
    bridge: town.buildings.bridge,
    rail: town.buildings.railDepot,
    riverPort: town.buildings.riverPort,
  };
  return town;
}
