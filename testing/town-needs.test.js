import { describe, expect, it } from 'vitest';
import { ERAS } from '../src/data/eras';
import { continueSupplyTiers, defineEra } from '../src/data/eraDefinitions';
import { ERA_SUPPLY_STEP, HAPPINESS } from '../src/data/townNeeds';
import { CITY_BUILDINGS, cityBenefit } from '../src/data/city';
import { BUILDINGS, createTown } from '../src/data/town';
import { advanceEra, eraGate, modernization } from '../src/game/town/TownEras';
import { townNeeds, townSupply, visitorShare } from '../src/game/town/TownNeeds';
import {
  buildWithHammer,
  finishConstruction,
  needFixes,
  needsReport,
  nextGoal,
  saloonIncomeRate,
  upgradeOffer,
} from '../src/game/town/TownRules';
import { buildingBenefit } from '../src/game/town/TownBenefits';

// Buy an offer with a builder hammer and finish its construction at once.
function build(town, id) {
  const built = buildWithHammer(town, id, upgradeOffer(town, id).stage);
  const project = built.projects[id];
  if (!project) return built;
  return finishConstruction(
    { ...built, projects: { ...built.projects, [id]: { ...project, wins: 2 } } },
    id,
    project.stage,
  );
}
// Build every offer of the current era, as a player finishing the era would.
function completeEra(town) {
  for (let guard = 0; guard < 500; guard++) {
    const open = BUILDINGS.map((b) => [b.id, upgradeOffer(town, b.id)]).find(
      ([, offer]) => offer?.available,
    );
    if (!open) return town;
    town = build(town, open[0]);
  }
  throw new Error('An era did not finish');
}
const freshTown = () => ({
  ...createTown(),
  coins: 1e9,
  completedRuns: 9999,
  tourSeen: true,
  constructionTipSeen: true,
});
function everyEra() {
  const towns = [];
  let town = completeEra(freshTown());
  towns.push(town);
  while (eraGate(town).available) {
    const opened = advanceEra(town, town.era);
    town = completeEra({ ...opened, transition: { ...opened.transition, pending: false } });
    towns.push(town);
  }
  return towns;
}
const finishedEras = everyEra();

describe('water and food keep pace with every era', () => {
  it('raises the waterworks and farm at every modernization tier, era after era', () => {
    for (const field of ['waterworks', 'farmCapacity']) {
      const tiers = ERAS.slice(1).flatMap((era) => era.evolution[field]);
      tiers.forEach(
        (value, i) => i && expect(value, `${field} tier ${i}`).toBeGreaterThan(tiers[i - 1]),
      );
    }
  });

  it('continues the previous era for an era without its own tiers', () => {
    const eras = continueSupplyTiers(
      ['frontier', 'river-rail', 'industrial'].map((id, i) =>
        defineEra({
          ...ERAS[i],
          evolution: {
            ...ERAS[i].evolution,
            waterworks: i === 1 ? [10, 20, 30] : i === 0 ? [0, 0, 0] : null,
            farmCapacity: null,
          },
        }),
      ),
    );
    expect(eras[2].evolution.waterworks).toEqual([
      30 + ERA_SUPPLY_STEP,
      30 + 2 * ERA_SUPPLY_STEP,
      30 + 3 * ERA_SUPPLY_STEP,
    ]);
    expect(eras[0].evolution.farmCapacity).toEqual([10, 20, 30]);
  });

  it('houses everyone and welcomes every visitor once an era is finished', () => {
    expect(finishedEras.map((town) => town.era)).toEqual(ERAS.map((era) => era.id));
    for (const town of finishedEras) {
      const needs = townNeeds(town);
      expect(needs.water, town.era).toBeGreaterThanOrEqual(needs.demand);
      expect(needs.food, town.era).toBeGreaterThanOrEqual(needs.demand);
      expect(needs.population, town.era).toBe(needs.demand);
      expect(needs.happiness, town.era).toBeGreaterThanOrEqual(90);
    }
  });

  it('makes each era grow its town, so its water and food are needed', () => {
    finishedEras.slice(1).forEach((town, i) => {
      const before = townNeeds(finishedEras[i]);
      const after = townNeeds(town);
      expect(after.demand, town.era).toBeGreaterThan(before.demand);
      // The previous era's spare supply cannot cover the new demand on its own.
      expect(before.water - before.demand, town.era).toBeLessThan(after.demand - before.demand);
      expect(before.food - before.demand, town.era).toBeLessThan(after.demand - before.demand);
    });
  });

  it('previews the water a modernized waterworks adds and names it in the offer', () => {
    const town = (() => {
      const opened = advanceEra(finishedEras[0], 'frontier');
      return { ...opened, transition: { ...opened.transition, pending: false } };
    })();
    const offer = modernization(town, 'well');
    const preview = buildingBenefit(town, 'well', town.buildings.well, offer);
    expect(preview.label).toBe('Water capacity');
    expect(preview.after - preview.before).toBe(ERAS[1].evolution.waterworks[0]);
    expect(offer.benefitValues).toEqual({ count: preview.after - preview.before });
    expect(offer.benefit).toContain('{count}');
  });
});

describe('happiness follows comfort and supplies', () => {
  const town = () => {
    const base = freshTown();
    return { ...base, buildings: { ...base.buildings, well: 3, farm: 3, home: 3 } };
  };

  it('needs comfort for the size of the town, and short supplies cut it', () => {
    const plain = town();
    const supplied = townNeeds(plain);
    expect(supplied.comfort).toBe(0);
    expect(supplied.happiness).toBe(HAPPINESS.needs);
    const comfortable = { ...plain, buildings: { ...plain.buildings, square: 1, saloon: 1 } };
    expect(townNeeds(comfortable).happiness).toBe(100);
    const thirsty = { ...comfortable, buildings: { ...comfortable.buildings, well: 1 } };
    const needs = townNeeds(thirsty);
    expect(needs.water).toBeLessThan(needs.demand);
    expect(needs.happiness).toBe(Math.round((100 * needs.water) / needs.demand));
  });

  it('welcomes no visitors below 30%, a share in between and all of them from 90%', () => {
    expect(visitorShare(30)).toBe(0);
    expect(visitorShare(60)).toBe(0.5);
    expect(visitorShare(90)).toBe(1);
    const finished = finishedEras.at(-1);
    const happy = townNeeds(finished);
    const gloomy = { ...finished, buildings: { ...finished.buildings, square: 0, saloon: 1 } };
    const sad = townNeeds(gloomy);
    expect(sad.happiness).toBeLessThan(happy.happiness);
    expect(sad.visitors).toBe(
      Math.min(Math.floor(sad.visitorPlaces * visitorShare(sad.happiness)), sad.visitorPlaces),
    );
    expect(sad.visitors).toBeLessThan(happy.visitors);
    expect(saloonIncomeRate(gloomy)).toBeLessThan(saloonIncomeRate(finished));
  });
});

describe('the village points to the fix', () => {
  it('suggests the building that restores missing water, then comfort', () => {
    const opened = advanceEra(finishedEras[0], 'frontier');
    let town = { ...opened, transition: { ...opened.transition, pending: false } };
    // Two River & Rail homes before any water: the waterworks is the fix.
    for (const id of ['bridge', 'home5'])
      while (upgradeOffer(town, id)?.available && upgradeOffer(town, id).type !== 'modernization')
        town = build(town, id);
    const report = needsReport(town);
    expect(report.short.water).toBe(true);
    expect(report.fixes.water).toBe(needFixes(town, 'water')[0].id);
    expect(nextGoal(town).id).toBe(report.fixes.water);
    expect(townSupply(build(town, report.fixes.water)).water).toBeGreaterThan(
      townSupply(town).water,
    );
  });

  it('writes each city building benefit from its effects', () => {
    for (const building of CITY_BUILDINGS)
      building.upgrades.forEach((upgrade, index) => {
        expect(upgrade.benefit).toBe(cityBenefit(building.effects, index + 1));
        expect(upgrade.benefit).not.toMatch(/with food and water|happiness/);
      });
    expect(cityBenefit({ housing: 8, comfort: 1 }, 2)).toBe(
      'Room for 16 residents. Adds 2 comfort in total.',
    );
  });
});
