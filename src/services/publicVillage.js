import { normalizePersonalisation } from '../data/townPersonalisation';
import { CREST_EMBLEM_IDS } from '../data/townCrests';
import { createTown } from '../data/town';
import { LEVEL_COUNT } from '../data/campaign';
import { HONOURS, validShowcase } from '../data/honours';
import { publishedDistinction } from '../data/playerDistinctions';

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

// The owner's public Town Honours: null when the field is missing (an older owner or
// server, so unknown), otherwise catalog ranks with a valid date, the public score
// evidence and a showcase of earned families, each shown at its best rank, with the
// owner's showcased player distinction (`received`, by ID) when the server sent one.
// IDs this version does not know are ignored. Never read from this visitor's save.
export function villageHonours(village) {
  const saved = village.appearance?.honours;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const earned = {};
  const entries = saved.earned && typeof saved.earned === 'object' ? saved.earned : {};
  for (const [id, entry] of Object.entries(entries)) {
    if (!Object.hasOwn(HONOURS.byId, id) || !entry || typeof entry !== 'object') continue;
    earned[id] = { at: Number.isSafeInteger(entry.at) && entry.at > 0 ? entry.at : null };
    const { levelId, score, target } = entry.evidence ?? {};
    if (
      HONOURS.byId[id].measure.kind === 'score' &&
      Number.isInteger(levelId) &&
      [score, target].every(Number.isFinite)
    )
      earned[id].evidence = { levelId, score, target };
  }
  const showcase = Array.isArray(saved.showcase)
    ? saved.showcase.filter((id) => typeof id === 'string')
    : [];
  const received = publishedDistinction(saved.distinction);
  return {
    version: Number.isSafeInteger(saved.version) && saved.version > 0 ? saved.version : 1,
    earned,
    received,
    showcase: validShowcase(showcase, { earned }, { received }),
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
  town.personalisation = normalizePersonalisation(appearance.personalisation, CREST_EMBLEM_IDS);
  town.displayHonours = villageHonours(village);
  town.displayDistinctions = appearance.plaqueDistinctions ?? {};
  return town;
}
