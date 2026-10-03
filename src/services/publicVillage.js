import { createTown } from '../data/town';
import { LEVEL_COUNT } from '../data/campaign';

// Public completion awards only; never fall back to this visitor's campaign store.
export function villageLevels(village) {
  const appearance = village.appearance ?? {};
  const records = {};
  for (const [key, record] of Object.entries(appearance.levelRecords ?? {})) {
    const id = Number(key);
    if (
      Number.isInteger(id) &&
      id >= 1 &&
      id <= LEVEL_COUNT &&
      Number.isInteger(record?.stars) &&
      record.stars >= 1 &&
      record.stars <= 3
    )
      records[id] = { stars: record.stars };
  }
  const mineLevel = Number.isInteger(appearance.mineLevel)
    ? Math.max(0, Math.min(LEVEL_COUNT, appearance.mineLevel))
    : 0;
  return {
    records,
    levelIds: Array.from({ length: LEVEL_COUNT }, (_, index) => index + 1).filter(
      (id) => id <= mineLevel || records[id],
    ),
    available: appearance.levelRecords != null,
  };
}

// Build an isolated render model. Never patch campaign/game stores from a visit.
export function villageAppearance(village) {
  const town = createTown();
  const appearance = village.appearance;
  town.era = appearance.era;
  // Completed puzzles pick the same space-helmet wearer the owner sees.
  if (Number.isSafeInteger(appearance.completedRuns) && appearance.completedRuns > 0)
    town.completedRuns = appearance.completedRuns;
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
  return town;
}
