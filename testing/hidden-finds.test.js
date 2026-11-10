import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import fr from '../src/i18n/fr.json';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import {
  HIDDEN_FINDS,
  HIDDEN_FIND_IDS,
  HIDDEN_FIND_WORDS,
  hiddenFindCommands,
  hiddenFindFields,
} from '../src/data/hiddenFinds';
import {
  hiddenFindOut,
  hiddenFindReward,
  hiddenFindable,
  normalizeTown,
  saloonIncomeRate,
} from '../src/game/town/TownRules';
import rules from '../backend/content/save-rules.json';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
const eraOf = (id) => ERAS.findIndex((era) => era.id === id);
function town(id, completedRuns = 12) {
  const c = useCampaignStore();
  c.town = createTown();
  Object.assign(c.town.buildings, { saloon: 3, home: 3, farm: 3, well: 3 });
  Object.assign(c.town, { era: HIDDEN_FINDS[id].debut, completedRuns, coins: 100 });
  return c;
}

describe('the hidden-find contract', () => {
  it('keeps the space helmet in the shape its saves, journals and API shipped with', () => {
    expect(HIDDEN_FIND_IDS[0]).toBe('helmet');
    expect(hiddenFindFields('helmet')).toEqual({ run: 'helmetRun', visitAt: 'helmetVisitAt' });
    expect(hiddenFindCommands('helmet')).toEqual({
      find: 'helmet-find',
      visitor: 'helmet-visitor',
    });
    expect(HIDDEN_FINDS.helmet).toEqual({
      debut: 'tomorrow',
      rewardHours: { owner: 1, visitor: 0.5 },
    });
  });

  it('carries a save from before the contract over unchanged', () => {
    // Saved by a build that knew only the helmet: its fields stay, later finds start at 0.
    const old = { ...createTown(), helmetRun: 41, helmetVisitAt: 1_700_000_000_000 };
    for (const id of HIDDEN_FIND_IDS.slice(1))
      for (const key of Object.values(hiddenFindFields(id))) delete old[key];
    const loaded = normalizeTown(JSON.parse(JSON.stringify(old)));
    expect(loaded).toMatchObject({ helmetRun: 41, helmetVisitAt: 1_700_000_000_000 });
    for (const id of HIDDEN_FIND_IDS.slice(1))
      for (const key of Object.values(hiddenFindFields(id))) expect(loaded[key], key).toBe(0);
  });

  it.each(HIDDEN_FIND_IDS)('%s follows the contract', (id) => {
    const { debut, rewardHours } = HIDDEN_FINDS[id],
      fields = hiddenFindFields(id),
      commands = hiddenFindCommands(id);
    expect(eraOf(debut), 'a known debut era').toBeGreaterThan(0);
    ERAS.forEach((era, index) =>
      expect(hiddenFindOut({ era: era.id }, id), era.id).toBe(index >= eraOf(debut)),
    );
    expect(hiddenFindOut({ era: 'unknown-era' }, id)).toBe(false);
    expect(hiddenFindOut(null, id)).toBe(false);
    expect(createTown()).toMatchObject({ [fields.run]: 0, [fields.visitAt]: 0 });
    expect(rules.economy.hiddenFinds[id]).toEqual({ debut, rewardHours });

    // The owner: once per completed puzzle, a full hour of saloon takings.
    const c = town(id),
      rate = saloonIncomeRate(c.town);
    expect(rate).toBeGreaterThan(0);
    expect(hiddenFindable(c.town, id)).toBe(true);
    expect(hiddenFindReward(c.town, id, 'owner')).toBe(Math.floor(rate * rewardHours.owner));
    expect(c.findHidden(id, 5_000)).toBe(Math.floor(rate * rewardHours.owner));
    expect(c.town[fields.run]).toBe(12);
    expect(c.integrity.actions.at(-1)).toMatchObject({
      kind: commands.find,
      data: { at: 5_000, run: 12 },
    });
    expect(c.findHidden(id, 6_000)).toBeNull();
    // Another find is its own: this one being found uses up no other.
    for (const other of HIDDEN_FIND_IDS.filter((x) => x !== id))
      if (hiddenFindOut(c.town, other)) expect(hiddenFindable(c.town, other), other).toBe(true);
    c.town = { ...c.town, completedRuns: 13 };
    expect(c.findHidden(id, 7_000)).toBeGreaterThan(0);

    // A visiting find: each receipt once, half an hour of this town's own takings.
    const coins = c.town.coins,
      find = { at: 2_000, receipt: 'a'.repeat(64) };
    expect(c.redeemHiddenFind(id, find, 9_000)).toBe(Math.floor(rate * rewardHours.visitor));
    expect(c.town).toMatchObject({ coins: coins + Math.floor(rate / 2), [fields.visitAt]: 2_000 });
    expect(c.integrity.actions.at(-1)).toMatchObject({
      kind: commands.visitor,
      data: { at: 9_000, foundAt: 2_000, receipt: find.receipt },
    });
    expect(c.redeemHiddenFind(id, find, 9_500)).toBeNull();
    expect(c.redeemHiddenFind(id, { at: 3_000 }, 9_500)).toBeNull();
  });

  it('finds nothing for an unknown find', () => {
    const c = town('helmet');
    expect(c.findHidden('no-such-find', 5_000)).toBeNull();
    expect(c.redeemHiddenFind('no-such-find', { at: 5, receipt: 'a'.repeat(64) })).toBeNull();
    expect(c.town.coins).toBe(100);
  });

  it('has French for every word of every find', () => {
    for (const id of HIDDEN_FIND_IDS) {
      expect(Object.keys(HIDDEN_FIND_WORDS[id]).sort(), id).toEqual(
        Object.keys(HIDDEN_FIND_WORDS.helmet).sort(),
      );
      for (const text of Object.values(HIDDEN_FIND_WORDS[id])) expect(fr[text], text).toBeTruthy();
    }
  });
});
