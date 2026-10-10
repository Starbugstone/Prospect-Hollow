import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSaveRules, rememberLevelTargets, saveRulesDigest } from '../scripts/save-rules.js';
import { CHAPTERS, LEVEL_COUNT, POWERS } from '../src/data/campaign.js';
import { ERAS, ERA_BY_ID } from '../src/data/eras.js';
import { defineEra } from '../src/data/eraDefinitions.js';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town.js';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator.js';
import { upgradeOffer } from '../src/game/town/TownRules.js';
import { chestCoinReward } from '../src/data/economy.js';
import { getLevelStarTarget } from '../src/data/starRating.js';

const additions = [];
afterEach(() => {
  for (const [kind, id] of additions.splice(0)) {
    const list = kind === 'era' ? ERAS : BUILDINGS;
    const byId = kind === 'era' ? ERA_BY_ID : BUILDING_BY_ID;
    list.splice(
      list.findIndex((entry) => entry.id === id),
      1,
    );
    delete byId[id];
  }
});

describe('known level target history', () => {
  const thresholds = (chestTarget, starScoreTarget, speedTargetMs) => ({
    chestTarget,
    starScoreTarget,
    speedTargetMs,
  });
  const catalog = (levels) => ({ version: 1, levels });

  it('remembers changed prior targets for the same level without trusting new or missing definitions', () => {
    const previous = catalog({
      1: { ...thresholds(100, 200, 60_000), miningMultiplier: 1 },
      2: thresholds(100, 200, 60_000),
      3: thresholds(100, 200, 60_000),
    });
    const current = catalog({
      1: { ...thresholds(120, 240, 70_000), miningMultiplier: 2 },
      2: thresholds(100, 200, 60_000),
      4: thresholds(120, 240, 70_000),
    });
    const original = structuredClone({ previous, current });
    expect(rememberLevelTargets(undefined, previous, current)).toEqual({
      version: 1,
      levels: {
        1: [thresholds(100, 200, 60_000), thresholds(120, 240, 70_000)],
        2: [thresholds(100, 200, 60_000)],
        4: [thresholds(120, 240, 70_000)],
      },
    });
    expect({ previous, current }).toEqual(original);
  });

  it('retains earlier versions, deduplicates repeated exports and orders known triples deterministically', () => {
    const history = {
      version: 1,
      levels: {
        12: [thresholds(200, 400, 90_000)],
        1: [thresholds(80, 160, 50_000), thresholds(80, 160, 50_000)],
      },
    };
    const previous = catalog({ 1: thresholds(100, 200, 60_000) });
    const current = catalog({ 1: thresholds(120, 240, 70_000) });
    const once = rememberLevelTargets(history, previous, current);
    expect(once.levels[1]).toEqual([
      thresholds(80, 160, 50_000),
      thresholds(100, 200, 60_000),
      thresholds(120, 240, 70_000),
    ]);
    expect(Object.keys(once.levels)).toEqual(['1', '12']);
    expect(rememberLevelTargets(once, previous, current)).toEqual(once);
    expect(rememberLevelTargets(once, current, current)).toEqual(once);
    expect(history.levels[1]).toHaveLength(2);
  });

  it('keeps known history while rejecting unsupported, incomplete or invalid candidate definitions', () => {
    const history = { version: 1, levels: { 1: [thresholds(80, 160, 50_000)] } };
    const previous = catalog({ 1: thresholds(100, 200, 60_000) });
    const incomplete = catalog({ 1: { chestTarget: 120, speedTargetMs: 70_000 } });
    const invalid = catalog({ 1: thresholds(-1, 240, 70_000) });
    expect(rememberLevelTargets(history, previous, incomplete)).toEqual(history);
    expect(rememberLevelTargets(history, previous, invalid)).toEqual(history);
    expect(rememberLevelTargets(history, { ...previous, version: 2 }, incomplete)).toEqual(history);
    expect(
      rememberLevelTargets(
        history,
        { ...previous, version: 2 },
        catalog({
          1: thresholds(120, 240, 70_000),
        }),
      ),
    ).toEqual({
      version: 1,
      levels: { 1: [thresholds(80, 160, 50_000), thresholds(120, 240, 70_000)] },
    });
    expect(rememberLevelTargets(history, null, incomplete)).toEqual(history);
    expect(rememberLevelTargets(history, previous, null)).toEqual(history);
  });

  it('exports only known triples for authoritative levels and includes them in the rules digest', () => {
    const baseline = buildSaveRules({ version: 1, levels: {} });
    const old = thresholds(1, 2, 3);
    const remembered = buildSaveRules({ version: 1, levels: { 1: [old], 999_999: [old] } });
    expect(remembered.levels[1].compatibleTargets).toEqual([old]);
    expect(remembered.levels[2]).not.toHaveProperty('compatibleTargets');
    expect(remembered.levels).not.toHaveProperty('999999');
    expect(remembered.contentDigest).not.toBe(baseline.contentDigest);
    const { contentDigest, ...payload } = remembered;
    expect(contentDigest).toBe(saveRulesDigest(payload));
    expect(() => buildSaveRules({ version: 2, levels: {} })).toThrow(
      'Unsupported save rule history',
    );
    expect(() => buildSaveRules({ version: 1, levels: { 1: [thresholds(-1, 2, 3)] } })).toThrow(
      'Invalid thresholds',
    );
  });

  it('seeds published current targets without changing the catalog and retains them after a local reexport', () => {
    const current = buildSaveRules({ version: 1, levels: {} });
    const published = rememberLevelTargets(undefined, null, current);
    expect(Object.keys(published.levels)).toHaveLength(LEVEL_COUNT);
    expect(published.levels[1]).toEqual([
      thresholds(
        current.levels[1].chestTarget,
        current.levels[1].starScoreTarget,
        current.levels[1].speedTargetMs,
      ),
    ]);
    expect(buildSaveRules(published)).toEqual(current);
    const changed = structuredClone(current);
    changed.levels[1].starScoreTarget += 100;
    const afterLocalExport = rememberLevelTargets(published, changed, changed);
    expect(afterLocalExport.levels[1]).toContainEqual(published.levels[1][0]);
    expect(afterLocalExport.levels[1]).toHaveLength(2);
  });
});

describe('shared save accounting catalog', () => {
  it('keeps the committed backend catalog synchronized with authoritative content', () => {
    const stored = JSON.parse(
      readFileSync(new URL('../backend/content/save-rules.json', import.meta.url), 'utf8'),
    );
    expect(stored).toEqual(buildSaveRules());
    const { contentDigest, ...payload } = stored;
    expect(contentDigest).toBe(saveRulesDigest(payload));
    expect(stored.defaultProfile).not.toHaveProperty('integrity');
  });

  it('exports every current level and era without a copied campaign ceiling', () => {
    const rules = buildSaveRules();
    expect(rules.levelCount).toBe(LEVEL_COUNT);
    expect(Object.keys(rules.levels)).toHaveLength(LEVEL_COUNT);
    expect(rules.chapters).toHaveLength(CHAPTERS.length);
    expect(rules.eraOrder).toEqual(ERAS.map((era) => era.id));
    expect(rules.powers).toEqual(POWERS.map((power) => power.id));
    for (const level of generateLevelConfigs()) {
      const saved = rules.levels[level.id];
      expect(saved).toMatchObject({
        id: level.id,
        chapterIndex: level.chapter,
        chestTarget: level.chestTarget,
        starScoreTarget: level.starScoreTarget,
        speedTargetMs: level.speedTargetMs,
        miningMultiplier: level.chapter + 1,
        chestCoins: { 1: chestCoinReward(level.id, 1), 2: chestCoinReward(level.id, 2) },
      });
      for (const era of ERAS)
        expect(Math.min(saved.chestCoins[3], rules.eras[era.id].chestCoinCap)).toBe(
          chestCoinReward(level.id, 3, era.id),
        );
      expect(saved).not.toHaveProperty('maxMoves');
      expect(saved).not.toHaveProperty('maxDurationMs');
    }
  });

  it('exports the actual river-rail charge and modernization price contract', () => {
    const rules = buildSaveRules();
    const town = createTown();
    town.era = 'river-rail';
    town.coins = 1_000_000;
    town.buildings.home = 1;
    const offer = upgradeOffer(town, 'well');
    expect(rules.eras['river-rail'].buildingOffers.well.normal[0].cost).toBe(offer.cost);
    expect(offer.cost).not.toBe(rules.buildings.well.upgrades[0].cost);
    const modern = rules.eras['river-rail'].buildingOffers.well.modernization;
    expect(modern.map((entry) => entry.cost)).toEqual(ERA_BY_ID['river-rail'].evolution.prices);
    expect(modern.map((entry) => entry.eraLevel)).toEqual([1, 2, 3]);
  });

  it('retains migration allowances and the shared inventory capacities', () => {
    const rules = buildSaveRules();
    expect(rules.buildings.well.maxLevel).toBe(3);
    expect(rules.buildings.well.legacyMaxLevel).toBe(5);
    expect(rules.buildings.well.legacyUpgradeCosts).toHaveLength(5);
    expect(rules.buildings.well.legacyUpgradeCosts[4]).toBeGreaterThan(
      rules.buildings.well.upgrades[2].cost,
    );
    expect(rules.buildings.well.serviceLevels).toEqual([0, 1, 2, 5]);
    expect(rules.buildings.well.shortSince).toBe(1);
    // Frontier's five-level services were shortened in progression version 2.
    for (const id of ['saloon', 'sheriff', 'bank', 'square', 'blacksmith']) {
      expect(rules.buildings[id], id).toMatchObject({
        maxLevel: 3,
        legacyMaxLevel: 5,
        shortSince: 2,
        serviceLevels: [0, 1, 2, 5],
      });
      expect(rules.buildings[id].legacyUpgradeCosts, id).toHaveLength(5);
    }
    expect(rules.defaultProfile.town.progressionVersion).toBe(2);
    expect(rules.rewards.hammerCapacity).toBe(5);
    expect(rules.economy.collectionCooldownMs).toBe(30_000);
    expect(rules.economy.incomeHoursCap).toBe(5);
  });

  it('accepts a newly registered era and plot through the same export pipeline', () => {
    const era = defineEra({
      id: 'save-rules-successor',
      label: 'Successor',
      yearLabel: '2200',
      enabled: true,
      evolution: { style: 'industrial', prices: [101, 202, 303] },
    });
    ERAS.push(era);
    ERA_BY_ID[era.id] = era;
    additions.push(['era', era.id]);
    const building = {
      id: 'save-rules-new-plot',
      kind: 'home',
      name: 'Successor home',
      shortName: 'Home',
      introducedEra: era.id,
      requiredForEraCompletion: true,
      effects: { housing: 7 },
      upgrades: [
        { cost: 80, runs: 1 },
        { cost: 120, runs: 1 },
        { cost: 160, runs: 2 },
      ],
    };
    BUILDINGS.push(building);
    BUILDING_BY_ID[building.id] = building;
    additions.push(['building', building.id]);
    const rules = buildSaveRules();
    expect(rules.eraOrder.at(-1)).toBe(era.id);
    expect(rules.buildings[building.id]).toMatchObject({ maxLevel: 3, introducedEra: era.id });
    // The new plot joins the shared needs model the server evaluates.
    expect(rules.needs.terms).toContainEqual({ stat: 'housing', per: 7, ids: [building.id] });
    expect(rules.needs.terms.find((term) => term.stat === 'housing' && term.service).ids).toContain(
      building.id,
    );
    expect(
      rules.eras[era.id].buildingOffers[building.id].normal.map((offer) => offer.cost),
    ).toEqual([80, 120, 160]);
    expect(rules.eras[era.id].buildingOffers.well.modernization.map((offer) => offer.cost)).toEqual(
      [101, 202, 303],
    );
    expect(rules.eras[era.id].buildingOffers.well.modernization[0].requiresPower).toBe(true);
  });

  it('fails safely for incomplete definitions and preserves canonical score fallback', () => {
    ERAS.push({ id: 'save-rules-incomplete', enabled: true });
    additions.push(['era', 'save-rules-incomplete']);
    expect(() => buildSaveRules()).toThrow('registered building style');
    expect(getLevelStarTarget(LEVEL_COUNT + 1, 12345)).toBe(12345);
  });

  it('produces a stable digest while detecting a changed price or new content', () => {
    expect(saveRulesDigest({ a: 1, b: { x: 2, y: 3 } })).toBe(
      saveRulesDigest({ b: { y: 3, x: 2 }, a: 1 }),
    );
    expect(saveRulesDigest({ cost: 20 })).not.toBe(saveRulesDigest({ cost: 21 }));
  });
});
