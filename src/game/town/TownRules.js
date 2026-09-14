import { RIVER_RAIL_LEVEL_PRICES } from '../../data/economy';
import { buildingServiceLevel, hasShortProgression } from '../../data/buildingProgression';
import { t } from '../../i18n';
import { miningDepthBonus } from '../../data/economy';
import { isCityEra, cityCapacity } from '../../data/city';
import { hasElectricity } from '../../data/industrial';
import { eventKind, eraEventKind, fireProtection, civicIncident } from '../../data/townEvents';
import { forgeProductionRuns } from '../../data/eras';
import { plotInEra, modernization, normalizeEraState, eraGate } from './TownEras';
import { BUILDINGS, BUILDING_BY_ID, INTRO_ORDER, BANDIT_EVENT, createTown } from '../../data/town';
import {
  COMBO_COIN_STEP,
  MULTI_MATCH_COIN_STEP,
  matchRewardBreakdown,
} from '../engine/MatchRewards';

export const BONUS_GEM_COINS = 10;
const collectedCount = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);
export function miningPayout(
  jewels,
  bonusGems = 0,
  comboCounts = {},
  multiMatchCounts = {},
  levelId = 1,
) {
  const baseCoins = Math.min(
    Number.MAX_SAFE_INTEGER,
    collectedCount(jewels) +
      collectedCount(bonusGems) * BONUS_GEM_COINS +
      [
        ...matchRewardBreakdown(comboCounts, COMBO_COIN_STEP),
        ...matchRewardBreakdown(multiMatchCounts, MULTI_MATCH_COIN_STEP),
      ].reduce((total, reward) => total + reward.coins, 0),
  );

  return baseCoins + miningDepthBonus(baseCoins, levelId);
}

export function normalizeTown(saved) {
  const town = createTown();
  for (const id of Object.keys(town.lastCollections)) {
    const at = saved?.lastCollections?.[id];
    if (Number.isSafeInteger(at) && at >= 0) town.lastCollections[id] = at;
  }
  // Missing or malformed additions leave existing v3 receipts intact.
  const forge = saved?.forge;
  town.forge.charge = forge?.charge === 1 ? 1 : 0;
  town.forge.progress =
    !town.forge.charge &&
    Number.isInteger(forge?.progress) &&
    forge.progress >= 0 &&
    // Older saves can carry up to 19 puzzles from the previous forge cycle.
    forge.progress < 20
      ? forge.progress
      : 0;
  if (Number.isSafeInteger(saved?.coins) && saved.coins >= 0) town.coins = saved.coins;
  for (const building of BUILDINGS) {
    const stage = saved?.buildings?.[building.id];
    if (
      Number.isInteger(stage) &&
      stage >= 0 &&
      stage <=
        (hasShortProgression(building.id) && !saved?.progressionVersion
          ? 5
          : building.upgrades.length)
    )
      town.buildings[building.id] = Math.min(stage, building.upgrades.length);
  }
  normalizeEraState(town, saved);
  if (Number.isSafeInteger(saved?.completedRuns) && saved.completedRuns >= 0)
    town.completedRuns = saved.completedRuns;
  if (Number.isSafeInteger(saved?.nextRaidRun) && saved.nextRaidRun >= 0)
    town.nextRaidRun = saved.nextRaidRun;
  const income = saved?.income;
  if (Number.isSafeInteger(income?.at) && income.at >= 0)
    town.income = {
      at: income.at,
      stored: Number.isSafeInteger(income.stored) && income.stored >= 0 ? income.stored : 0,
      remainder:
        Number.isInteger(income.remainder) && income.remainder >= 0 && income.remainder < HOUR_MS
          ? income.remainder
          : 0,
    };
  const event = saved?.events?.[BANDIT_EVENT];
  if (
    event &&
    ['protected', 'stolen', 'harmless'].includes(event.outcome) &&
    Number.isInteger(event.loss) &&
    event.loss >= 0 &&
    event.loss <= 30
  ) {
    if (
      Number.isSafeInteger(event.id) &&
      event.id > 0 &&
      Number.isSafeInteger(event.atRun) &&
      event.atRun >= 0 &&
      event.atRun <= town.completedRuns &&
      [2, 4, 6, 8, 10].includes(event.gangSize) &&
      Number.isInteger(event.sheriffLevel) &&
      event.sheriffLevel >= 0 &&
      event.sheriffLevel <= BUILDING_BY_ID.sheriff.upgrades.length
    ) {
      town.events[BANDIT_EVENT] = {
        id: event.id,
        atRun: event.atRun,
        gangSize: event.gangSize,
        sheriffLevel: event.sheriffLevel,
        bankLevel:
          Number.isInteger(event.bankLevel) &&
          event.bankLevel >= 0 &&
          event.bankLevel <= BUILDING_BY_ID.bank.upgrades.length
            ? event.bankLevel
            : 0,
        outcome: event.outcome,
        loss: event.loss,
        seen: event.seen === true,
        ...(event.seen === true &&
        Number.isInteger(event.bounty) &&
        event.bounty >= 0 &&
        event.bounty <= event.gangSize * 10
          ? { bounty: event.bounty }
          : {}),
        ...(event.bellRung === true ? { bellRung: true } : {}),
        targets: [
          'mine',
          ...(Array.isArray(event.targets)
            ? event.targets
                .filter((id) => Object.hasOwn(BUILDING_BY_ID, id) && town.buildings[id] > 0)
                .slice(0, 1)
            : []),
        ],
      };
      if (['cargo-theft', 'workshop-fire', 'storm-cleanup'].includes(event.kind)) {
        const receipt = town.events[BANDIT_EVENT];
        receipt.kind = event.kind;
        receipt.fireStationLevel =
          Number.isInteger(event.fireStationLevel) &&
          event.fireStationLevel >= 0 &&
          event.fireStationLevel <= 3
            ? event.fireStationLevel
            : 0;
        receipt.targets = (Array.isArray(event.targets) ? event.targets : [])
          .filter((id) => Object.hasOwn(BUILDING_BY_ID, id) && town.buildings[id] > 0)
          .slice(0, 1);
        if (!receipt.targets.length)
          receipt.targets = [
            event.kind === 'storm-cleanup'
              ? 'riverPark'
              : event.kind === 'workshop-fire'
                ? 'blacksmith'
                : 'railDepot',
          ];
      }
    }
  }
  for (const { id, upgrades } of BUILDINGS) {
    let project = saved?.projects?.[id];
    if (!saved?.progressionVersion && hasShortProgression(id)) {
      if (project?.type === 'modernization')
        project = { ...project, stage: Math.min(project.stage, upgrades.length) };
      else if (
        project?.id === id &&
        project.stage > upgrades.length &&
        project.stage <= 5 &&
        project.stage === saved.buildings[id] + 1 &&
        project.required === 1 &&
        Number.isInteger(project.wins) &&
        project.wins >= 0 &&
        project.wins <= 1
      ) {
        // An already-paid redundant tier is cancelled and refunded exactly once.
        town.coins = Math.min(
          Number.MAX_SAFE_INTEGER,
          town.coins + BUILDING_BY_ID[id].legacyUpgradeCosts[project.stage - 1],
        );
        continue;
      }
    }
    if (project?.type === 'modernization') {
      const offer = modernization(town, id);
      if (
        offer &&
        project.id === id &&
        project.stage === offer.stage &&
        project.targetEra === offer.targetEra &&
        project.fromEra === town.buildingEras[id] &&
        Number.isInteger(project.required) &&
        project.required >= 1 &&
        project.required <= 5 &&
        Number.isInteger(project.wins) &&
        project.wins >= 0 &&
        project.wins <= project.required &&
        Number.isSafeInteger(project.cost) &&
        project.cost >= 0
      ) {
        town.projects[id] = {
          id,
          type: 'modernization',
          stage: project.stage,
          fromEra: project.fromEra,
          targetEra: project.targetEra,
          eraLevel: offer.eraLevel,
          wins: Math.min(project.wins, offer.runs),
          required: Math.min(project.required, offer.runs),
          cost: project.cost,
        };
      }
      continue;
    }
    if (
      project?.id === id &&
      project.stage === town.buildings[id] + 1 &&
      project.stage <= upgrades.length &&
      projectRuns(id, project.stage) > 0 &&
      (project.required === projectRuns(id, project.stage) ||
        (BUILDING_BY_ID[id].introducedEra === 'river-rail' &&
          project.stage > 1 &&
          project.required === 2)) &&
      Number.isInteger(project.wins) &&
      project.wins >= 0 &&
      project.wins <= project.required
    ) {
      town.projects[id] = {
        id,
        stage: project.stage,
        wins: Math.min(project.wins, projectRuns(id, project.stage)),
        required: projectRuns(id, project.stage),
      };
    }
  }
  town.constructionTipSeen = saved?.constructionTipSeen === true;
  town.tourSeen = saved?.tourSeen === true;
  town.infrastructure = {
    bridge: town.buildings.bridge,
    rail: town.buildings.railDepot,
    riverPort: town.buildings.riverPort,
  };
  return settleForgeProduction(town);
}

export const projectRuns = (id, stage) =>
  Math.min(2, BUILDING_BY_ID[id]?.upgrades[stage - 1]?.runs ?? 1);
export const constructionRuns = (project) =>
  Math.min(2, project.required ?? projectRuns(project.id, project.stage));
export const constructionVisual = (project) =>
  project ? Math.min(2, Math.ceil((project.wins / constructionRuns(project)) * 3)) : null;

export const constructionReady = (project) =>
  !!project && project.wins >= constructionRuns(project);

export function advanceConstruction(town) {
  if (!Object.keys(town.projects).length) return town;
  return {
    ...town,
    projects: Object.fromEntries(
      Object.entries(town.projects).map(([id, project]) => [
        id,
        { ...project, wins: Math.min(constructionRuns(project), project.wins + 1) },
      ]),
    ),
  };
}

// Readiness survives reloads. Benefits start only when the player removes the scaffolding.
export function finishConstruction(town, id, expectedStage) {
  const project = town.projects[id];
  if (
    !constructionReady(project) ||
    project.stage !== expectedStage ||
    (project.type === 'modernization'
      ? project.stage !== modernization(town, id)?.stage ||
        project.fromEra !== town.buildingEras[id] ||
        project.targetEra !== town.era
      : project.stage !== town.buildings[id] + 1)
  )
    return null;
  const projects = { ...town.projects };
  delete projects[id];
  return {
    ...town,
    buildings: {
      ...town.buildings,
      [id]: project.type === 'modernization' ? town.buildings[id] : project.stage,
    },
    buildingEraLevels: {
      ...town.buildingEraLevels,
      [id]:
        project.type === 'modernization'
          ? (project.eraLevel ?? 1)
          : town.era !== 'frontier'
            ? project.stage
            : 0,
    },
    buildingEras: { ...town.buildingEras, [id]: project.targetEra ?? town.era },
    infrastructure: {
      ...town.infrastructure,
      ...(id === 'bridge' || id === 'riverPort'
        ? { [id]: project.type === 'modernization' ? town.buildings[id] : project.stage }
        : {}),
      ...(id === 'railDepot'
        ? { rail: project.type === 'modernization' ? town.buildings[id] : project.stage }
        : {}),
    },
    projects,
    constructionTipSeen: true,
  };
}

const totalLevels = (town, kind) =>
  BUILDINGS.filter((b) => b.kind === kind).reduce(
    (sum, b) => sum + buildingServiceLevel(b.id, town.buildings[b.id] ?? 0),
    0,
  );
export const foodCapacity = (town) =>
  totalLevels(town, 'farm') * 6 +
  Math.min(5, Math.max(0, buildingServiceLevel('fisherman', town.buildings.fisherman ?? 0))) +
  (town.buildings.market ?? 0) * 10 +
  ((town.buildingEras.farm === 'motor-age' && town.buildingEraLevels.farm === 3) ||
  ['aviation', 'broadcast', 'contemporary'].includes(town.buildingEras.farm)
    ? 20
    : 0) +
  cityCapacity(town, 'food');
export const waterCapacity = (town) => {
  const era = town.buildingEras.well,
    level = town.buildingEraLevels.well || 1;
  const waterworks = !town.buildings.well
    ? 0
    : ['aviation', 'broadcast', 'contemporary'].includes(era)
      ? 80
      : era === 'post-war'
        ? 60
        : era === 'motor-age'
          ? 60 + (level === 3 ? 20 : 0)
          : era === 'industrial'
            ? 40 + (level === 3 ? 20 : 0)
            : era === 'river-rail'
              ? Math.max(0, level - 1) * 20
              : 0;
  return totalLevels(town, 'well') * 6 + waterworks + cityCapacity(town, 'water');
};
export const housingCapacity = (town) =>
  totalLevels(town, 'home') * 2 +
  (town.buildings.home5 ?? 0) * 8 +
  [0, 6, 12, 16][town.buildings.rowHouses ?? 0] +
  (town.buildings.gardenCourt ?? 0) * 6 +
  cityCapacity(town, 'housing');
export function settleForgeProduction(town) {
  if (
    !town.buildings.blacksmith ||
    town.forge.charge ||
    town.forge.progress < forgeProductionRuns(town.buildings.blacksmith)
  )
    return town;
  return { ...town, forge: { progress: 0, charge: 1 } };
}
export function advanceForge(town) {
  if (!town.buildings.blacksmith || town.forge.charge) return town;
  return settleForgeProduction({
    ...town,
    forge: { progress: town.forge.progress + 1, charge: 0 },
  });
}
export const residentPopulation = (town) =>
  Math.min(housingCapacity(town), waterCapacity(town), foodCapacity(town));
export const visitorCapacity = (town) =>
  buildingServiceLevel('stable', town.buildings.stable) * 2 +
  Math.max(0, buildingServiceLevel('museum', town.buildings.museum) - 1) * 2 +
  (town.buildings.railDepot ?? 0) * 2 +
  (town.buildings.hotel ?? 0) * 2 +
  (town.buildings.busDepot ?? 0) * 2 +
  cityCapacity(town, 'visitors');
export const visitorPopulation = (town) =>
  Math.min(
    visitorCapacity(town),
    Math.max(0, waterCapacity(town) - residentPopulation(town)),
    Math.max(0, foodCapacity(town) - residentPopulation(town)),
  );
export const population = (town) => residentPopulation(town) + visitorPopulation(town);
export const happiness = (town) => {
  const demand = housingCapacity(town) + visitorCapacity(town);
  const needs = demand ? Math.min(1, waterCapacity(town) / demand, foodCapacity(town) / demand) : 0;
  return Math.min(
    100,
    Math.round(
      needs * 40 +
        (town.buildings.square ?? 0) * 8 +
        buildingServiceLevel('museum', town.buildings.museum) * 2 +
        town.buildings.saloon * 2 +
        Math.min(5, Math.max(0, buildingServiceLevel('school', town.buildings.school ?? 0))) +
        (town.buildings.horseField ?? 0) * 2 +
        (town.buildings.park ?? 0) * 3 +
        cityCapacity(town, 'happiness'),
    ),
  );
};
const development = (town) => Object.values(town.buildings).reduce((sum, level) => sum + level, 0);
export const roadLevel = (town) =>
  development(town) >= 24 ? 3 : development(town) >= 12 ? 2 : development(town) >= 3 ? 1 : 0;
// Completed buildings and paid projects stay accessible when unlock rules change.
export function plotRequirement(town, id) {
  if (town.buildings[id] > 0 || town.projects[id]) return null;
  return BUILDING_BY_ID[id]?.unlock?.find(({ id, level }) => town.buildings[id] < level) ?? null;
}
export function plotUnlocked(town, id) {
  return plotInEra(town, id) && !plotRequirement(town, id);
}
export const HOUR_MS = 3_600_000;
const INCOME_HOURS_CAP = 8;
const COLLECTION_COOLDOWN_MS = 30_000;
export function collectionCooldownRemaining(town, id, now = Date.now()) {
  const collectedAt = town.lastCollections?.[id];
  if (!Number.isSafeInteger(collectedAt) || collectedAt < 0) return 0;
  return Math.min(
    COLLECTION_COOLDOWN_MS,
    Math.max(0, COLLECTION_COOLDOWN_MS - (now - collectedAt)),
  );
}
export const saloonHappinessBonus = (town) => 1.25 * happiness(town);
export const saloonIncomeRate = (town) =>
  Math.floor(
    (2.25 *
      town.buildings.saloon *
      population(town) *
      (100 + saloonHappinessBonus(town)) *
      (1 + (town.buildings.diner ?? 0) * 0.05)) /
      100,
  );
// Remainder is stored as coin-milliseconds, avoiding rounding loss between visits.
// Settle BEFORE changing buildings, so their new rates never apply to old time.
export function settleSaloonIncome(town, now) {
  const checkpoint = town.income ?? { at: null, remainder: 0, stored: 0 };
  if (!Number.isSafeInteger(now) || now < 0 || (checkpoint.at !== null && now <= checkpoint.at))
    return { town, earned: 0 };
  const rate = saloonIncomeRate(town);
  const elapsed =
    checkpoint.at === null ? 0 : Math.min(now - checkpoint.at, INCOME_HOURS_CAP * HOUR_MS);
  const credit = elapsed * rate + checkpoint.remainder;
  const stored = checkpoint.stored ?? 0;
  const capacity = rate * INCOME_HOURS_CAP;
  const earned = Math.max(0, Math.min(Math.floor(credit / HOUR_MS), capacity - stored));
  return {
    town: {
      ...town,
      income: {
        at: now,
        stored: stored + earned,
        remainder: stored + earned >= capacity ? 0 : credit % HOUR_MS,
      },
    },
    earned,
  };
}

export function upgradeOffer(town, id) {
  if (!Object.hasOwn(BUILDING_BY_ID, id)) return null;
  const building = BUILDING_BY_ID[id];
  const stage = town.buildings[id];
  const requirement = plotRequirement(town, id);
  const upgrade = building.upgrades[stage] ?? modernization(town, id);
  if (!upgrade) return null;
  const needsPower = upgrade.requiresPower && !hasElectricity(town);
  const firstProject =
    !Object.keys(town.projects).length && BUILDINGS.every(({ id }) => !town.buildings[id]);
  const eraCost =
    town.era === 'river-rail'
      ? upgrade.type === 'modernization'
        ? upgrade.cost
        : (RIVER_RAIL_LEVEL_PRICES[stage] ?? upgrade.cost)
      : upgrade.cost;
  const cost = firstProject && plotUnlocked(town, id) ? 0 : eraCost;
  return {
    ...upgrade,
    targetEra: town.era,
    cost,
    stage: upgrade.stage ?? stage,
    runs: Math.min(2, upgrade.runs ?? projectRuns(id, stage + 1)),
    available: plotUnlocked(town, id) && !town.projects[id] && !needsPower,
    reason: !plotInEra(town, id)
      ? 'Available in the next era.'
      : needsPower
        ? 'Finish the power house to unlock electric modernization.'
        : requirement
          ? t('Unlock by upgrading {building} to level {level}.', {
              building: t(BUILDING_BY_ID[requirement.id].shortName),
              level: requirement.level,
            })
          : town.projects[id]
            ? 'This building is already under construction.'
            : town.coins < cost
              ? t('Earn {value0} more coins in the mine.', { value0: t(cost - town.coins) })
              : '',
  };
}

// Immediate collection/completion takes priority over an affordable coin purchase.
// Hammers do not affect these ambient hints.
export function buildingIndicators(town, forgeCollectible = true, now = Date.now()) {
  const indicators = Object.fromEntries(availablePurchases(town).map(({ id }) => [id, 'upgrade']));
  for (const { id } of BUILDINGS) {
    if (constructionReady(town.projects[id])) indicators[id] = 'ready';
    else if (
      id === 'saloon' &&
      town.buildings.saloon > 0 &&
      town.income.stored > 0 &&
      !collectionCooldownRemaining(town, id, now)
    )
      indicators[id] = 'coins';
    else if (
      id === 'blacksmith' &&
      town.buildings.blacksmith > 0 &&
      town.forge.charge === 1 &&
      forgeCollectible &&
      !collectionCooldownRemaining(town, id, now)
    )
      indicators[id] = 'tnt';
  }
  if (eraGate(town).available) indicators.square = 'era';
  if (canRingTownBell(town) && !constructionReady(town.projects.square)) indicators.square = 'bell';
  return indicators;
}

export const availablePurchases = (town, builderHammers = 0) =>
  BUILDINGS.map((place) => ({ ...place, offer: upgradeOffer(town, place.id) }))
    .filter(({ offer }) => offer?.available && (town.coins >= offer.cost || builderHammers > 0))
    .sort((a, b) => a.offer.cost - b.offer.cost);

export const availableParcels = (town, builderHammers = 0) => [
  ...BUILDINGS.filter(({ id }) => plotInEra(town, id) && constructionReady(town.projects[id])).map(
    (place) => ({ ...place, ready: true }),
  ),
  ...availablePurchases(town, builderHammers),
];

export function nextGoal(town) {
  const available = BUILDINGS.filter((b) => upgradeOffer(town, b.id)?.available);
  const cheapest = (choices) =>
    choices.sort((a, b) => upgradeOffer(town, a.id).cost - upgradeOffer(town, b.id).cost)[0]?.id;
  const demand = housingCapacity(town) + visitorCapacity(town);
  const need = waterCapacity(town) < demand ? 'well' : foodCapacity(town) < demand ? 'farm' : null;
  // Put essential services and balanced defenses ahead of optional expansion.
  // An active project already covers its need; suggest another useful project.
  const defense = ['sheriff', 'bank']
    .filter((id) => available.some((b) => b.id === id) && town.buildings[id] * 2 < gangSize(town))
    .sort((a, b) => town.buildings[a] - town.buildings[b])[0];
  const id =
    INTRO_ORDER.find((key) => available.some((b) => b.id === key) && !town.buildings[key]) ??
    (need && !BUILDINGS.some((b) => b.kind === need && town.projects[b.id])
      ? cheapest(
          available.filter(
            (b) => b.kind === need && upgradeOffer(town, b.id).type !== 'modernization',
          ),
        )
      : null) ??
    (need && !town.projects[need === 'well' ? 'waterPlant' : 'supermarket']
      ? available.find(
          (b) =>
            b.id === (need === 'well' ? 'waterPlant' : 'supermarket') &&
            upgradeOffer(town, b.id).type !== 'modernization',
        )?.id
      : null) ??
    (town.era === 'industrial' &&
    available.some((b) => b.id === 'powerHouse') &&
    !town.buildings.powerHouse
      ? 'powerHouse'
      : null) ??
    (population(town) > 0 && !civicIncident(eraEventKind(town.era)) ? defense : null) ??
    (civicIncident(eraEventKind(town.era)) &&
    town.buildings.fireStation < 3 &&
    available.some((b) => b.id === 'fireStation')
      ? 'fireStation'
      : null) ??
    (need && ['industrial', 'motor-age'].includes(town.era)
      ? available.find((b) => b.id === need)?.id
      : null) ??
    (town.era !== 'frontier'
      ? (available.find((b) => b.id === 'bridge' && b.introducedEra === town.era)?.id ??
        cheapest(available.filter((b) => b.introducedEra === town.era)))
      : null) ??
    ['saloon', 'museum', 'home', 'blacksmith'].find(
      (id) => available.some((b) => b.id === id) && !town.buildings[id],
    ) ??
    cheapest(available);
  return id ? { id, ...upgradeOffer(town, id) } : null;
}

// A forecast uses saved puzzle progress, never real time or a new random roll.
export function raidForecast(town) {
  const event = town.events[BANDIT_EVENT];
  const active = event && !event.seen ? event : null;
  const riders = active?.gangSize ?? gangSize(town);
  const kind = active ? eventKind(active) : eraEventKind(town.era);
  const protection = raidProtection(town, riders, kind);
  const runs = Number.isSafeInteger(town.nextRaidRun)
    ? Math.max(0, town.nextRaidRun - town.completedRuns)
    : null;
  return { kind, riders, protection, runs, soon: !active && runs !== null && runs <= 2, active };
}

// Commands carry the stage visible when clicked, so a double tap cannot buy the next tier.
export function purchase(town, id, expectedStage) {
  const offer = upgradeOffer(town, id);
  if (!offer || offer.reason || offer.stage !== expectedStage) return null;
  if (offer.type === 'modernization')
    return {
      ...town,
      coins: town.coins - offer.cost,
      projects: {
        ...town.projects,
        [id]: {
          id,
          type: 'modernization',
          stage: expectedStage,
          fromEra: town.buildingEras[id],
          targetEra: offer.targetEra,
          eraLevel: offer.eraLevel,
          wins: 0,
          required: offer.runs,
          cost: offer.cost,
        },
      },
    };
  return {
    ...town,
    coins: town.coins - offer.cost,
    buildings: offer.runs === 0 ? { ...town.buildings, [id]: expectedStage + 1 } : town.buildings,
    buildingEras: offer.runs === 0 ? { ...town.buildingEras, [id]: town.era } : town.buildingEras,
    projects:
      offer.runs === 0
        ? town.projects
        : {
            ...town.projects,
            [id]: { id, stage: expectedStage + 1, wins: 0, required: offer.runs },
          },
  };
}

export const raidIntervalRange = (town) => (town.era === 'frontier' ? [3, 7] : [6, 14]);
export function scheduleRaid(town, random = Math.random) {
  if (town.nextRaidRun !== null || population(town) <= 0) return town;
  const [min, max] = raidIntervalRange(town);
  const gap = min + Math.floor(random() * (max - min + 1));
  return { ...town, nextRaidRun: Math.min(Number.MAX_SAFE_INTEGER, town.completedRuns + gap) };
}
export const gangSize = (town) => {
  const size = development(town);
  return size >= 70 ? 10 : size >= 50 ? 8 : size >= 30 ? 6 : size >= 16 ? 4 : 2;
};
export function raidReady(town) {
  const previous = town.events[BANDIT_EVENT];
  return (
    (town.era !== 'river-rail' || town.buildings.railDepot > 0 || town.buildings.riverPort > 0) &&
    (town.era !== 'industrial' || town.buildings.powerHouse > 0 || town.buildings.mill > 0) &&
    population(town) > 0 &&
    Number.isSafeInteger(town.nextRaidRun) &&
    town.completedRuns >= town.nextRaidRun &&
    (!previous || previous.seen)
  );
}
const CAPTURE_BOUNTY = 10;
export const raidBounty = (event) =>
  !civicIncident(eventKind(event)) && event?.outcome === 'protected' && event.loss === 0
    ? Math.min(event.gangSize, event.sheriffLevel * 2) * CAPTURE_BOUNTY
    : 0;
export const raidProtection = (town, riders = gangSize(town), kind = eraEventKind(town.era)) =>
  civicIncident(kind)
    ? fireProtection(town.buildings.fireStation)
    : (Math.min(riders, town.buildings.sheriff * 2) +
        Math.min(riders, (town.buildings.bank ?? 0) * 2)) /
      (riders * 2);

export function canRingTownBell(town) {
  const event = town.events[BANDIT_EVENT];
  return !!(
    town.buildings.square >= 4 &&
    event &&
    !event.seen &&
    !event.bellRung &&
    event.loss > 0
  );
}
export function ringTownBell(town, raidId) {
  const event = town.events[BANDIT_EVENT];
  if (!canRingTownBell(town) || event.id !== raidId) return null;
  const loss = Math.floor(event.loss / 2);
  return {
    ...town,
    coins: Math.min(Number.MAX_SAFE_INTEGER, town.coins + event.loss - loss),
    events: {
      ...town.events,
      [BANDIT_EVENT]: { ...event, loss, bellRung: true, outcome: loss ? 'stolen' : 'harmless' },
    },
  };
}

export function banditEncounter(town, random = Math.random) {
  if (!raidReady(town)) return null;
  const riders = gangSize(town),
    sheriffLevel = town.buildings.sheriff;
  const bankLevel = town.buildings.bank ?? 0;
  const kind = eraEventKind(town.era);
  const protection = raidProtection(town, riders, kind);
  const protectedTown = protection === 1;
  const loss = protectedTown
    ? 0
    : Math.min(
        30,
        Math.ceil(5 * riders * (1 - protection)),
        Math.floor(town.coins / 10),
        Math.max(0, town.coins - 50),
      );
  const target = (
    kind === 'storm-cleanup'
      ? ['riverPark', 'riverPort', 'square']
      : kind === 'workshop-fire'
        ? ['mill', 'blacksmith', 'powerHouse']
        : kind === 'cargo-theft'
          ? ['warehouse', 'railDepot', 'riverPort']
          : ['saloon', 'armory', 'farm', 'home']
  ).find((id) => town.buildings[id]);
  const event = {
    id: (town.events[BANDIT_EVENT]?.id ?? 0) + 1,
    atRun: town.completedRuns,
    gangSize: riders,
    sheriffLevel,
    bankLevel,
    ...(kind !== 'bandits' ? { kind, fireStationLevel: town.buildings.fireStation ?? 0 } : {}),
    targets: [...(kind === 'bandits' ? ['mine'] : []), ...(target ? [target] : [])],
    outcome: protectedTown ? 'protected' : loss ? 'stolen' : 'harmless',
    loss,
    seen: false,
  };
  return scheduleRaid(
    {
      ...town,
      coins: town.coins - loss,
      events: { ...town.events, [BANDIT_EVENT]: event },
      nextRaidRun: null,
    },
    random,
  );
}

// An unfinished raid can benefit from defenses opened before the riders leave.
// Refund only the reduction to its saved loss; later income and gang growth do not change it.
export function reinforceRaid(town) {
  const event = town.events[BANDIT_EVENT];
  if (!event || event.seen) return town;
  if (civicIncident(eventKind(event))) {
    const level = Math.max(event.fireStationLevel ?? 0, town.buildings.fireStation ?? 0);
    if (level === event.fireStationLevel) return town;
    const protection = fireProtection(level);
    const remaining = Math.ceil(5 * event.gangSize * (1 - protection));
    const loss = Math.min(event.loss, event.bellRung ? Math.floor(remaining / 2) : remaining);
    return {
      ...town,
      coins: Math.min(Number.MAX_SAFE_INTEGER, town.coins + event.loss - loss),
      events: {
        ...town.events,
        [BANDIT_EVENT]: {
          ...event,
          fireStationLevel: level,
          loss,
          outcome: protection === 1 ? 'protected' : loss ? 'stolen' : 'harmless',
        },
      },
    };
  }
  const sheriffLevel = Math.max(event.sheriffLevel, town.buildings.sheriff);
  const bankLevel = Math.max(event.bankLevel ?? 0, town.buildings.bank);
  if (sheriffLevel === event.sheriffLevel && bankLevel === (event.bankLevel ?? 0)) return town;
  const protection = raidProtection(
    { buildings: { sheriff: sheriffLevel, bank: bankLevel } },
    event.gangSize,
  );
  const defenseLoss = Math.ceil(5 * event.gangSize * (1 - protection));
  const loss = Math.min(event.loss, event.bellRung ? Math.floor(defenseLoss / 2) : defenseLoss);
  return {
    ...town,
    coins: Math.min(Number.MAX_SAFE_INTEGER, town.coins + event.loss - loss),
    events: {
      ...town.events,
      [BANDIT_EVENT]: {
        ...event,
        sheriffLevel,
        bankLevel,
        loss,
        outcome: protection === 1 ? 'protected' : loss ? 'stolen' : 'harmless',
      },
    },
  };
}

// Carry the displayed level so stale/double taps cannot spend on the next tier.
export function buildWithHammer(town, id, expectedStage) {
  const offer = upgradeOffer(town, id);
  if (!offer?.available) return null;
  if (
    town.projects[id] ||
    offer.stage !== expectedStage ||
    (!BUILDING_BY_ID[id].upgrades[expectedStage] && offer.type !== 'modernization')
  )
    return null;
  return {
    ...town,
    buildings: {
      ...town.buildings,
      [id]: offer.type === 'modernization' ? town.buildings[id] : expectedStage + 1,
    },
    buildingEras: { ...town.buildingEras, [id]: town.era },
    buildingEraLevels: {
      ...town.buildingEraLevels,
      [id]: offer.eraLevel ?? (town.era !== 'frontier' ? expectedStage + 1 : 0),
    },
    infrastructure: {
      ...town.infrastructure,
      ...(id === 'bridge' || id === 'riverPort'
        ? { [id]: offer.type === 'modernization' ? town.buildings[id] : expectedStage + 1 }
        : {}),
      ...(id === 'railDepot'
        ? { rail: offer.type === 'modernization' ? town.buildings[id] : expectedStage + 1 }
        : {}),
    },
  };
}
