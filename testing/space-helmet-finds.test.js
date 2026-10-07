import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { SPACE_HELMET } from '../src/data/townAnimals';
import {
  normalizeTown,
  saloonIncomeRate,
  spaceHelmetFindable,
  spaceHelmetOut,
  spaceHelmetReward,
} from '../src/game/town/TownRules';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.restoreAllMocks());

const debut = ERAS.findIndex(({ id }) => id === SPACE_HELMET.debut);
function helmetTown({ era = SPACE_HELMET.debut, completedRuns = 12 } = {}) {
  const c = useCampaignStore();
  c.town = createTown();
  Object.assign(c.town.buildings, { saloon: 3, home: 3, farm: 3, well: 3 });
  Object.assign(c.town, { era, completedRuns, coins: 100 });
  return c;
}
const lastAction = (c) => c.integrity.actions.at(-1);

describe('the space helmet', () => {
  it('is out to find from its debut era on', () => {
    expect(debut).toBeGreaterThan(0);
    ERAS.forEach(({ id }, index) => expect(spaceHelmetOut({ era: id }), id).toBe(index >= debut));
    expect(spaceHelmetOut({ era: 'unknown-era' })).toBe(false);
    expect(spaceHelmetOut(null)).toBe(false);
    const town = { ...createTown(), era: SPACE_HELMET.debut, completedRuns: 3, helmetRun: 2 };
    expect(spaceHelmetFindable(town)).toBe(true);
    expect(spaceHelmetFindable({ ...town, helmetRun: 3 })).toBe(false);
    expect(spaceHelmetFindable({ ...town, era: ERAS[debut - 1].id })).toBe(false);
  });

  it('pays an hour of saloon takings once for each completed puzzle', () => {
    const c = helmetTown();
    const rate = saloonIncomeRate(c.town);
    expect(rate).toBeGreaterThan(0);
    expect(c.findSpaceHelmet(5_000)).toBe(rate);
    expect(c.town).toMatchObject({ coins: 100 + rate, helmetRun: 12 });
    expect(lastAction(c)).toMatchObject({ kind: 'helmet-find', data: { at: 5_000, run: 12 } });
    // Found: it waits for the next completed puzzle to move to another animal.
    expect(c.findSpaceHelmet(6_000)).toBeNull();
    expect(c.town.coins).toBe(100 + rate);
    c.town = { ...c.town, completedRuns: 13 };
    expect(c.findSpaceHelmet(7_000)).toBe(rate);
    expect(c.town).toMatchObject({ coins: 100 + 2 * rate, helmetRun: 13 });
  });

  it('marks a find without saloon takings, and has nothing to find before its era', () => {
    const c = helmetTown();
    c.town.buildings.saloon = 0;
    expect(c.findSpaceHelmet(5_000)).toBe(0);
    expect(c.town).toMatchObject({ coins: 100, helmetRun: 12 });
    const early = helmetTown({ era: ERAS[debut - 1].id, completedRuns: 20 });
    const journal = early.integrity.actions.length;
    expect(early.findSpaceHelmet(6_000)).toBeNull();
    expect(early.integrity.actions).toHaveLength(journal);
    expect(early.town).toMatchObject({ coins: 100, helmetRun: 0 });
  });

  it("redeems finds made while visiting, each once, for half this town's own takings", () => {
    // The visitor's own town need not have a helmet: only its saloon decides the reward.
    const c = helmetTown({ era: ERAS[0].id });
    // Half an hour of takings: a visitor's find is worth half the owner's own.
    const rate = Math.floor(saloonIncomeRate(c.town) / 2);
    expect(spaceHelmetReward(c.town, 'visitor')).toBe(rate);
    expect(spaceHelmetReward(c.town, 'owner')).toBe(saloonIncomeRate(c.town));
    const find = { at: 2_000, receipt: 'a'.repeat(64) };
    expect(c.redeemHelmetVisit(find, 9_000)).toBe(rate);
    expect(c.town).toMatchObject({ coins: 100 + rate, helmetVisitAt: 2_000 });
    expect(lastAction(c)).toMatchObject({
      kind: 'helmet-visitor',
      data: { at: 9_000, foundAt: 2_000, receipt: find.receipt },
    });
    // Every poll offers the same recent finds; only newer ones pay.
    expect(c.redeemHelmetVisit(find, 9_000)).toBeNull();
    expect(c.redeemHelmetVisit({ ...find, at: 1_000 }, 9_000)).toBeNull();
    expect(c.redeemHelmetVisit({ at: 3_000 }, 9_000)).toBeNull();
    expect(c.redeemHelmetVisit(null, 9_000)).toBeNull();
    expect(c.redeemHelmetVisit({ at: 3_000, receipt: 'b'.repeat(64) }, 9_000)).toBe(rate);
    expect(c.town).toMatchObject({ coins: 100 + 2 * rate, helmetVisitAt: 3_000 });
  });

  it('keeps finds through saves and drops malformed values', () => {
    expect(normalizeTown({})).toMatchObject({ helmetRun: 0, helmetVisitAt: 0 });
    expect(normalizeTown({ helmetRun: 7, helmetVisitAt: 2_000 })).toMatchObject({
      helmetRun: 7,
      helmetVisitAt: 2_000,
    });
    for (const value of [-1, 1.5, '7', null])
      expect(normalizeTown({ helmetRun: value, helmetVisitAt: value })).toMatchObject({
        helmetRun: 0,
        helmetVisitAt: 0,
      });
  });
});
