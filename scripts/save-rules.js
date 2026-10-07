import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CHAPTERS, LEVEL_COUNT, POWERS } from '../src/data/campaign.js';
import { LEVELS_PER_CHAPTER } from '../src/data/chapters.js';
import { ERAS, FORGE_PRODUCTION_RUNS } from '../src/data/eras.js';
import { defineEra } from '../src/data/eraDefinitions.js';
import { STAR_CASCADE_TARGET, STAR_SCORE_MULTIPLIER } from '../src/data/starRating.js';
import { BUILDINGS, BANDIT_EVENT, INTRO_ORDER, createTown } from '../src/data/town.js';
import { buildingServiceLevel, hasShortProgression } from '../src/data/buildingProgression.js';
import {
  CHEST_ECONOMY_VERSION,
  chestCoinCap,
  chestCoinReward,
  chestLevelCoins,
  depthBonusPercent,
} from '../src/data/economy.js';
import { chapterGift } from '../src/data/journey.js';
import {
  BONUS_CAPACITIES,
  CHEST_DROPS,
  COIN_TIERS,
  CONTINUOUS_COIN_CAP,
  HAMMER_CAPACITY,
  OVERFLOW_COINS,
  bonusCapacity,
} from '../src/data/rewards.js';
import { SHOP_ITEMS, shopSlots } from '../src/data/shop.js';
import { VIP_SPEND, vipVisitBuildings } from '../src/data/vipVisits.js';
import { INCIDENT_TARGETS, fireProtection } from '../src/data/townEvents.js';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator.js';
import { SPACE_HELMET } from '../src/data/townAnimals.js';
import { COMBO_COIN_STEP, MULTI_MATCH_COIN_STEP } from '../src/game/engine/MatchRewards.js';
import {
  BONUS_GEM_COINS,
  HOUR_MS,
  collectionCooldownRemaining,
  raidBounty,
  raidIntervalRange,
  saloonIncomeRate,
  settleSaloonIncome,
  upgradeOffer,
} from '../src/game/town/TownRules.js';
import { ERA_BUILDING_LEVELS, eraIndex } from '../src/game/town/TownEras.js';
import { needTerms } from '../src/game/town/TownNeeds.js';
import { HAPPINESS } from '../src/data/townNeeds.js';
import { levelElements } from '../src/data/honours.js';
import { GEM_TYPES } from '../src/game/engine/GemFactory.js';
import { FUSION_STYLES } from '../src/game/engine/BonusFusion.js';
import { freshProfile } from '../src/stores/campaignStore.js';

// Object keys are canonicalized so the digest survives formatting and irrelevant
// authoring key-order changes. Content and array order still affect the digest.
export function saveRulesDigest(payload) {
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(payload)))
    .digest('hex');
}

const TARGET_FIELDS = ['chestTarget', 'starScoreTarget', 'speedTargetMs'];
const emptyHistory = () => ({ version: 1, levels: {} });
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const levelId = (id) =>
  Number.isSafeInteger(Number(id)) && Number(id) > 0 && String(Number(id)) === id;
const targetTuple = (level) =>
  object(level) &&
  TARGET_FIELDS.every((field) => Number.isSafeInteger(level[field]) && level[field] >= 0)
    ? Object.fromEntries(TARGET_FIELDS.map((field) => [field, level[field]]))
    : null;
const compareTargets = (left, right) => {
  for (const field of TARGET_FIELDS) {
    if (left[field] !== right[field]) return left[field] - right[field];
  }
  return 0;
};

function normalizeHistory(history) {
  if (!object(history) || history.version !== 1 || !object(history.levels))
    throw new Error('Unsupported save rule history. Preserve the last working catalog.');
  const levels = {};
  for (const id of Object.keys(history.levels).sort(
    (left, right) => Number(left) - Number(right),
  )) {
    if (!levelId(id) || !Array.isArray(history.levels[id]))
      throw new Error('Invalid level in save rule history. Preserve the last working catalog.');
    const tuples = history.levels[id].map((tuple) => {
      const known = targetTuple(tuple);
      if (!known)
        throw new Error(
          'Invalid thresholds in save rule history. Preserve the last working catalog.',
        );
      return known;
    });
    const unique = [...new Map(tuples.map((tuple) => [JSON.stringify(tuple), tuple])).values()];
    if (unique.length) levels[id] = unique.sort(compareTargets);
  }
  return { version: 1, levels };
}

/** Build-only persistent history; an absent initial file starts with no old rules. */
export function readSaveRuleHistory() {
  try {
    return normalizeHistory(
      JSON.parse(
        readFileSync(new URL('../backend/content/save-rule-history.json', import.meta.url), 'utf8'),
      ),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return emptyHistory();
    throw error;
  }
}

/** Seed canonical current triples and retain prior ones when targets change.
 * Receipt claims never enter this history. Missing/unsupported prior definitions
 * add no historical allowances, preserving the fallback for unknown content.
 */
export function rememberLevelTargets(history = emptyHistory(), previousRules, currentRules) {
  const remembered = normalizeHistory(history);
  if (currentRules?.version !== 1 || !object(currentRules.levels)) return remembered;
  const previousLevels =
    previousRules?.version === 1 && object(previousRules.levels) ? previousRules.levels : {};
  for (const [id, current] of Object.entries(currentRules.levels)) {
    if (!levelId(id)) continue;
    const currentTargets = targetTuple(current);
    if (!currentTargets) continue;
    // Persist current published targets as well, so a separately regenerated
    // local catalog cannot erase the authoritative previous deployment's tuple.
    (remembered.levels[id] ??= []).push(currentTargets);
    const oldTargets = targetTuple(previousLevels[id]);
    if (oldTargets && compareTargets(oldTargets, currentTargets) !== 0)
      remembered.levels[id].push(oldTargets);
  }
  return normalizeHistory(remembered);
}

function compatibleTargets(level, knownTargets) {
  const current = targetTuple(level);
  if (!current) return {};
  const compatible = (knownTargets[level.id] ?? []).filter(
    (tuple) => compareTargets(tuple, current) !== 0,
  );
  return compatible.length ? { compatibleTargets: compatible } : {};
}

// Town Honours mine elements a completed level credits to the server's counters.
function honourElements(level) {
  const elements = levelElements(level);
  return Object.keys(elements).length ? { honourElements: elements } : {};
}

const economicOffer = (offer) =>
  offer
    ? {
        stage: offer.stage,
        cost: offer.cost,
        runs: offer.runs,
        requiresPower: offer.requiresPower === true,
        ...(offer.eraLevel ? { eraLevel: offer.eraLevel } : {}),
        ...(offer.targetEra ? { targetEra: offer.targetEra } : {}),
      }
    : null;

function developedTown(era) {
  const town = createTown();
  town.era = era;
  town.coins = Number.MAX_SAFE_INTEGER;
  for (const building of BUILDINGS) {
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = era;
    town.buildingEraLevels[building.id] = ERA_BUILDING_LEVELS;
  }
  return town;
}

function offersForEra(era) {
  const town = developedTown(era.id);
  return Object.fromEntries(
    BUILDINGS.filter((building) => eraIndex(building.introducedEra) <= eraIndex(era.id)).map(
      (building) => {
        const normal = building.upgrades.map((_, stage) => {
          town.buildings[building.id] = stage;
          return economicOffer(upgradeOffer(town, building.id));
        });
        town.buildings[building.id] = building.upgrades.length;
        const modernization = Array.from({ length: ERA_BUILDING_LEVELS }, (_, level) => {
          town.buildingEras[building.id] = level ? era.id : building.introducedEra;
          town.buildingEraLevels[building.id] = level;
          return economicOffer(upgradeOffer(town, building.id));
        });
        town.buildingEras[building.id] = era.id;
        town.buildingEraLevels[building.id] = ERA_BUILDING_LEVELS;
        return [building.id, { normal, modernization }];
      },
    ),
  );
}

/** Build backend accounting data from the same definitions used by gameplay.
 * This runs during export/checks only, never on a move or a render frame.
 */
export function buildSaveRules(history = readSaveRuleHistory()) {
  // Invalid/incomplete authoring must fail export before replacing the last
  // working catalog. Registered definitions retain their shared safe defaults.
  for (const era of ERAS) defineEra(era);
  const knownTargets = normalizeHistory(history).levels;
  const { integrity, ...defaultProfile } = freshProfile();
  const town = developedTown(ERAS[0].id);
  town.coins = 0;
  const hour = settleSaloonIncome({ ...town, income: { at: 0, stored: 0, remainder: 0 } }, HOUR_MS);
  const full = settleSaloonIncome(
    { ...town, income: { at: 0, stored: 0, remainder: 0 } },
    HOUR_MS * 24,
  );
  const rate = saloonIncomeRate(town);
  if (!rate || hour.earned !== rate || !Number.isInteger(full.earned / rate))
    throw new Error('The shared income contract could not be exported.');
  const garageBase = bonusCapacity({ buildings: { armory: 0, garage: 0 } });
  const payload = {
    version: 1,
    profileSchemaVersion: defaultProfile.schemaVersion,
    maxSafeInteger: Number.MAX_SAFE_INTEGER,
    levelCount: LEVEL_COUNT,
    levelsPerChapter: LEVELS_PER_CHAPTER,
    eraBuildingLevels: ERA_BUILDING_LEVELS,
    eraOrder: ERAS.map((era) => era.id),
    eras: Object.fromEntries(
      ERAS.map((era) => [
        era.id,
        {
          enabled: era.enabled === true,
          style: era.evolution.style,
          requiresPower: era.evolution.requiresPower,
          electricity: era.evolution.electricity,
          incident: era.evolution.incident,
          waterworks: era.evolution.waterworks,
          farmCapacity: era.evolution.farmCapacity,
          chestCoinCap: chestCoinCap(era.id),
          buildingOffers: offersForEra(era),
        },
      ]),
    ),
    buildings: Object.fromEntries(
      BUILDINGS.map((building) => [
        building.id,
        {
          kind: building.kind,
          introducedEra: building.introducedEra,
          maxLevel: building.upgrades.length,
          legacyMaxLevel: hasShortProgression(building.id) ? 5 : building.upgrades.length,
          legacyUpgradeCosts: building.legacyUpgradeCosts ?? [],
          requiredForEraCompletion: building.requiredForEraCompletion === true,
          unlock: building.unlock ?? [],
          serviceLevels: Array.from({ length: building.upgrades.length + 1 }, (_, stage) =>
            buildingServiceLevel(building.id, stage),
          ),
          upgrades: building.upgrades.map((upgrade, stage) => ({
            cost: upgrade.cost,
            runs: Math.min(2, upgrade.runs ?? 1),
            requiresPower: upgrade.requiresPower === true,
            stage,
          })),
        },
      ]),
    ),
    // Water, food, homes, visitors and comfort: the server evaluates the same terms.
    needs: { terms: needTerms(), happiness: HAPPINESS },
    powers: POWERS.map((power) => power.id),
    rewards: {
      bonusCapacities: BONUS_CAPACITIES,
      garageCapacityPerLevel: bonusCapacity({ buildings: { armory: 0, garage: 1 } }) - garageBase,
      hammerCapacity: HAMMER_CAPACITY,
      overflowCoins: OVERFLOW_COINS,
      continuousCoinCap: CONTINUOUS_COIN_CAP,
      chestEconomyVersion: CHEST_ECONOMY_VERSION,
      chestDrops: CHEST_DROPS.map(({ id, kind, quantity, weight }) => ({
        id,
        kind,
        quantity,
        weight,
      })),
      coinTiers: COIN_TIERS.map(({ id, kind, scale }) => ({ id, kind, scale })),
    },
    shop: {
      items: SHOP_ITEMS.map(({ id, kind, price, quantity }) => ({ id, kind, price, quantity })),
      slotsByStage: Array.from({ length: town.buildings.shop + 1 }, (_, stage) => shopSlots(stage)),
    },
    levels: Object.fromEntries(
      generateLevelConfigs().map((level) => [
        level.id,
        {
          id: level.id,
          chapterIndex: level.chapter,
          chestTarget: level.chestTarget,
          starScoreTarget: level.starScoreTarget,
          speedTargetMs: level.speedTargetMs,
          ...compatibleTargets(level, knownTargets),
          miningMultiplier: 1 + depthBonusPercent(level.id) / 100,
          // Version 3 is the chapter value; the chest's town era caps it (eras.chestCoinCap).
          chestCoins: {
            1: chestCoinReward(level.id, 1),
            2: chestCoinReward(level.id, 2),
            3: chestLevelCoins(level.id),
          },
          ...honourElements(level),
        },
      ]),
    ),
    chapters: CHAPTERS.map((chapter, index) => {
      const { id, kind, quantity } = chapterGift(index + 1);
      return {
        index,
        id: chapter.id ?? null,
        gift: { id, kind, quantity },
        overflowCoins: (index + 1) * 100,
      };
    }),
    economy: {
      bonusGemCoins: BONUS_GEM_COINS,
      comboCoinStep: COMBO_COIN_STEP,
      multiMatchCoinStep: MULTI_MATCH_COIN_STEP,
      starCascadeTarget: STAR_CASCADE_TARGET,
      starScoreMultiplier: STAR_SCORE_MULTIPLIER,
      vipSpend: VIP_SPEND,
      vipBuildings: vipVisitBuildings(town),
      forgeRuns: FORGE_PRODUCTION_RUNS,
      hourMs: HOUR_MS,
      collectionCooldownMs: collectionCooldownRemaining(
        { lastCollections: { saloon: 0 } },
        'saloon',
        0,
      ),
      incomeHoursCap: full.earned / rate,
      fireProtectionByLevel: Array.from({ length: town.buildings.fireStation + 1 }, (_, stage) =>
        fireProtection(stage),
      ),
      incidentTargets: INCIDENT_TARGETS,
      raidIntervalByEra: Object.fromEntries(
        ERAS.map((era) => [era.id, raidIntervalRange({ era: era.id })]),
      ),
      bountyPerCaptured: raidBounty({
        kind: 'bandits',
        outcome: 'protected',
        loss: 0,
        gangSize: 1,
        sheriffLevel: 1,
      }),
      banditEvent: BANDIT_EVENT,
      introOrder: INTRO_ORDER,
      // The first era with a space-helmet wearer to find, and the hours of saloon takings
      // a find pays the owner and a visitor.
      spaceHelmetDebut: SPACE_HELMET.debut,
      spaceHelmetRewardHours: SPACE_HELMET.rewardHours,
    },
    // The keys a victory receipt's Town Honours claim may credit (gem types, fusions).
    honours: { gems: GEM_TYPES, fusions: Object.keys(FUSION_STYLES) },
    defaultTown: defaultProfile.town,
    defaultProfile,
  };
  // Materialize JSON now: undefined properties in authoring definitions should
  // not hash differently from their on-disk representation.
  const serialized = JSON.parse(JSON.stringify(payload));
  return { ...serialized, contentDigest: saveRulesDigest(serialized) };
}
