import { expect, it } from 'vitest';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town';
import { CITY_LEVEL_PRICES } from '../src/data/city';
import { eraIndex, eraBuildingLevel } from '../src/game/town/TownEras';
import {
  advanceConstruction,
  constructionReady,
  finishConstruction,
  normalizeTown,
  purchase,
  upgradeOffer,
} from '../src/game/town/TownRules';

function townFor(id, era = BUILDING_BY_ID[id].introducedEra) {
  const town = createTown();
  town.era = era;
  town.coins = 1e7;
  for (const b of BUILDINGS.filter((b) => eraIndex(b.introducedEra) <= eraIndex(era))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = 3;
  }
  town.buildings[id] = 0;
  town.buildingEraLevels[id] = 0;
  return town;
}
it.each(['airport', 'skyline', 'cityHomes'])(
  '%s costs more, takes two runs initially, and one per upgrade',
  (id) => {
    let town = townFor(id);
    for (const [index, cost] of [15000, 18750, 22500].entries()) {
      const offer = upgradeOffer(town, id);
      expect(offer).toMatchObject({ cost, runs: index === 0 ? 2 : 1, available: true });
      town = purchase(town, id, offer.stage);
      const paid = town.coins;
      town = normalizeTown(advanceConstruction(town));
      expect(constructionReady(town.projects[id])).toBe(index !== 0);
      if (!index) {
        expect(finishConstruction(town, id, index + 1)).toBeNull();
        town = advanceConstruction(town);
      }
      town = finishConstruction(town, id, index + 1);
      expect(town.coins).toBe(paid);
      expect(town.buildings[id]).toBe(index + 1);
    }
  },
);
it.each(['airport', 'skyline'])(
  '%s modernization remains a one-run upgrade at the landmark price',
  (id) => {
    let town = townFor(id, 'contemporary');
    town.buildings[id] = 3;
    town.buildingEras[id] = BUILDING_BY_ID[id].introducedEra;
    for (let level = 0; level < 3; level++) {
      const offer = upgradeOffer(town, id);
      expect(offer).toMatchObject({ runs: 1, cost: CITY_LEVEL_PRICES.contemporary[level] * 1.25 });
      town = normalizeTown(advanceConstruction(purchase(town, id, offer.stage)));
      expect(constructionReady(town.projects[id])).toBe(true);
      town = finishConstruction(town, id, offer.stage);
      expect(eraBuildingLevel(town, id)).toBe(level + 1);
    }
  },
);
it.each([0, 1])(
  'preserves a paid legacy one-run landmark project with %s wins on reload',
  (wins) => {
    let town = townFor('airport');
    town.coins = 321;
    town.projects.airport = { id: 'airport', stage: 1, required: 1, wins };
    town = normalizeTown(town);
    expect(town.projects.airport).toEqual({ id: 'airport', stage: 1, required: 1, wins });
    expect(town.coins).toBe(321);
    if (!wins) town = advanceConstruction(town);
    expect(finishConstruction(town, 'airport', 1).buildings.airport).toBe(1);
  },
);
it('keeps regular city building prices and construction times unchanged', () => {
  const town = townFor('television');
  expect(upgradeOffer(town, 'television')).toMatchObject({ cost: 12000, runs: 1 });
});
