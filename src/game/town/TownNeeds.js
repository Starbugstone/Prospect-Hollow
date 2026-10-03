import { BUILDINGS } from '../../data/town';
import { eraEvolution } from '../../data/eras';
import { buildingServiceLevel } from '../../data/buildingProgression';
import { NEED_SOURCES, HAPPINESS } from '../../data/townNeeds';

// Every source with explicit building ids, followed by each building's declared
// per-level effects. Rebuilt when a plot is registered, so a new era or building
// joins the model (and the exported server rules) without another list to edit.
let terms = null,
  termsFor = -1;
export function needTerms() {
  if (termsFor !== BUILDINGS.length) {
    terms = [
      ...NEED_SOURCES.map(({ kind, id, ...term }) => ({
        ...term,
        ids: kind ? BUILDINGS.filter((b) => b.kind === kind).map((b) => b.id) : [id],
      })),
      ...BUILDINGS.flatMap((building) =>
        Object.entries(building.effects ?? {}).map(([stat, per]) => ({
          stat,
          per,
          ids: [building.id],
        })),
      ),
    ];
    termsFor = BUILDINGS.length;
  }
  return terms;
}

// The buildings that can raise a need.
export const needProviders = (stat) =>
  new Set(
    needTerms()
      .filter((term) => term.stat === stat)
      .flatMap((term) => term.ids),
  );

// The main waterworks or farm capacity of the era tier the building reached.
const eraTierValue = (town, id, tiers) => {
  if (!town.buildings[id]) return 0;
  const tier = Math.min(2, Math.max(0, (town.buildingEraLevels[id] || 1) - 1));
  return eraEvolution(town.buildingEras[id])[tiers]?.[tier] ?? 0;
};
const termValue = (town, term, id) => {
  const built = town.buildings[id] ?? 0;
  if (term.eraTiers) return eraTierValue(town, id, term.eraTiers);
  if (term.table) return term.table[built] ?? 0;
  const level = term.service ? buildingServiceLevel(id, built) : built;
  return term.per * Math.min(term.max ?? Infinity, Math.max(0, level + (term.offset ?? 0)));
};

/** Water, food, housing, visitor places and comfort points of a town. */
export function townSupply(town) {
  const supply = { water: 0, food: 0, housing: 0, visitors: 0, comfort: 0 };
  for (const term of needTerms())
    for (const id of term.ids) supply[term.stat] += termValue(town, term, id);
  return supply;
}

/** Everything the town's needs decide, computed in one pass. */
export function townNeeds(town) {
  const { water, food, housing, visitors: visitorPlaces, comfort } = townSupply(town);
  const demand = housing + visitorPlaces;
  const supplied = demand ? Math.min(1, water / demand, food / demand) : 0;
  const comfortShare = demand ? Math.min(1, comfort / (demand * HAPPINESS.comfortPerPerson)) : 0;
  const happiness = Math.round(supplied * (HAPPINESS.needs + HAPPINESS.comfort * comfortShare));
  const residents = Math.min(housing, water, food);
  const welcome = visitorShare(happiness);
  const visitors = Math.min(
    Math.floor(visitorPlaces * welcome),
    Math.max(0, water - residents),
    Math.max(0, food - residents),
  );
  return {
    water,
    food,
    housing,
    visitorPlaces,
    comfort,
    demand,
    happiness,
    residents,
    visitors,
    population: residents + visitors,
  };
}

/** The share of visitor places a town of this happiness fills. */
export const visitorShare = (happiness) =>
  Math.min(
    1,
    Math.max(
      0,
      (happiness - HAPPINESS.visitorsFrom) / (HAPPINESS.visitorsFull - HAPPINESS.visitorsFrom),
    ),
  );
