import { expect, it } from 'vitest';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS, eraEvolution } from '../src/data/eras';
import { buildingSupply, townSupply } from '../src/game/town/TownNeeds';
import { createModernizationOffer } from '../src/game/town/TownModernization';
it('matches full-town supply deltas for every current era, building and modernization tier', () => {
  for (const era of ERAS) {
    const town = createTown();
    town.era = era.id;
    for (const b of BUILDINGS) {
      town.buildings[b.id] = b.upgrades.length;
      town.buildingEras[b.id] = b.introducedEra;
      town.buildingEraLevels[b.id] = 1;
    }
    const before = townSupply(town);
    for (const b of BUILDINGS)
      for (let level = 0; level < 3; level++) {
        const next = {
          ...town,
          buildingEras: { ...town.buildingEras, [b.id]: town.era },
          buildingEraLevels: { ...town.buildingEraLevels, [b.id]: level + 1 },
        };
        const after = townSupply(next),
          singleBefore = buildingSupply(town, b.id),
          singleAfter = buildingSupply(next, b.id);
        const overridden = buildingSupply(town, b.id, { era: town.era, level: level + 1 });
        expect(overridden).toEqual(singleAfter);
        for (const stat of Object.keys(before))
          expect(singleAfter[stat] - singleBefore[stat], `${era.id}/${b.id}/${level}/${stat}`).toBe(
            after[stat] - before[stat],
          );
        const offer = eraEvolution(era.id).prices ? createModernizationOffer(town, b, level) : null;
        if (offer?.benefitValues)
          expect(offer.benefitValues.count).toBe(
            Math.max(after.water - before.water, after.food - before.food),
          );
      }
  }
}, 20000);
it('includes newly registered providers through the shared needs contract', () => {
  const building = {
    id: 'future-provider',
    kind: 'future-provider',
    effects: { water: 7, food: 3 },
  };
  BUILDINGS.push(building);
  try {
    const town = createTown();
    town.buildings[building.id] = 2;
    expect(buildingSupply(town, building.id)).toMatchObject({ water: 14, food: 6 });
  } finally {
    BUILDINGS.pop();
  }
});
