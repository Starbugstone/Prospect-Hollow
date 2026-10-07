import { normalizePersonalisation } from '../../data/townPersonalisation';
import { CREST_EMBLEM_IDS } from '../../data/townCrests';
import { normalizePresentations } from '../../data/townPresentations';
import { normalizeGuestVip } from '../../data/guestVip';
import { RIVER_RAIL_LEVEL_PRICES } from '../../data/economy';
import { hasShortProgression } from '../../data/buildingProgression';
import { t } from '../../i18n';
import { miningDepthBonus } from '../../data/economy';
import { isMajorCityBuilding } from '../../data/city';
import { hasElectricity } from '../../data/industrial';
import {
  eventKind,
  eraEventKind,
  fireProtection,
  civicIncident,
  INCIDENT_TARGETS,
  LEGACY_INCIDENT_TARGET,
} from '../../data/townEvents';
import { forgeProductionRuns } from '../../data/eras';
import { needProviders, townNeeds, townSupply } from './TownNeeds';
import { plotInEra, modernization, normalizeEraState, eraGate, eraIndex } from './TownEras';
import { SPACE_HELMET } from '../../data/townAnimals';
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

// Saved counters are trusted only as whole numbers inside their range.
const intIn = (value, min, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const builtTargets = (targets, town) =>
  (Array.isArray(targets) ? targets : [])
    .filter((id) => Object.hasOwn(BUILDING_BY_ID, id) && town.buildings[id] > 0)
    .slice(0, 1);
// A saved raid receipt, or null when it is malformed or from another run history.
function normalizeRaidEvent(event, town) {
  if (
    !event ||
    !['protected', 'stolen', 'harmless'].includes(event.outcome) ||
    !intIn(event.loss, 0, 30) ||
    !intIn(event.id, 1) ||
    !intIn(event.atRun, 0, town.completedRuns) ||
    ![2, 4, 6, 8, 10].includes(event.gangSize) ||
    !intIn(event.sheriffLevel, 0, BUILDING_BY_ID.sheriff.upgrades.length)
  )
    return null;
  const receipt = {
    id: event.id,
    atRun: event.atRun,
    gangSize: event.gangSize,
    sheriffLevel: event.sheriffLevel,
    bankLevel: intIn(event.bankLevel, 0, BUILDING_BY_ID.bank.upgrades.length) ? event.bankLevel : 0,
    outcome: event.outcome,
    loss: event.loss,
    seen: event.seen === true,
    ...(event.seen === true && intIn(event.bounty, 0, event.gangSize * 10)
      ? { bounty: event.bounty }
      : {}),
    ...(event.bellRung === true ? { bellRung: true } : {}),
    targets: ['mine', ...builtTargets(event.targets, town)],
  };
  if (['cargo-theft', 'workshop-fire', 'storm-cleanup'].includes(event.kind)) {
    receipt.kind = event.kind;
    receipt.fireStationLevel = intIn(event.fireStationLevel, 0, 3) ? event.fireStationLevel : 0;
    receipt.targets = builtTargets(event.targets, town);
    if (!receipt.targets.length) receipt.targets = [LEGACY_INCIDENT_TARGET[event.kind]];
  }
  return receipt;
}

export function normalizeTown(saved) {
  const town = createTown();
  for (const id of Object.keys(town.lastCollections)) {
    const at = saved?.lastCollections?.[id];
    if (intIn(at, 0)) town.lastCollections[id] = at;
  }
  for (const key of ['saloonVisitAt', 'helmetRun', 'helmetVisitAt'])
    if (intIn(saved?.[key], 1)) town[key] = saved[key];
  town.guestVip = normalizeGuestVip(saved?.guestVip);
  // Missing or malformed additions leave existing v3 receipts intact.
  const forge = saved?.forge;
  town.forge.charge = forge?.charge === 1 ? 1 : 0;
  // Older saves can carry up to 19 puzzles from the previous forge cycle.
  town.forge.progress = !town.forge.charge && intIn(forge?.progress, 0, 19) ? forge.progress : 0;
  if (intIn(saved?.coins, 0)) town.coins = saved.coins;
  for (const building of BUILDINGS) {
    const stage = saved?.buildings?.[building.id];
    const highest =
      hasShortProgression(building.id) && !saved?.progressionVersion ? 5 : building.upgrades.length;
    if (intIn(stage, 0, highest))
      town.buildings[building.id] = Math.min(stage, building.upgrades.length);
  }
  normalizeEraState(town, saved);
  if (intIn(saved?.completedRuns, 0)) town.completedRuns = saved.completedRuns;
  if (intIn(saved?.nextRaidRun, 0)) town.nextRaidRun = saved.nextRaidRun;
  const income = saved?.income;
  if (intIn(income?.at, 0))
    town.income = {
      at: income.at,
      stored: intIn(income.stored, 0) ? income.stored : 0,
      remainder: intIn(income.remainder, 0, HOUR_MS - 1) ? income.remainder : 0,
    };
  const raid = normalizeRaidEvent(saved?.events?.[BANDIT_EVENT], town);
  if (raid) town.events[BANDIT_EVENT] = raid;
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
        intIn(project.wins, 0, 1)
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
        intIn(project.required, 1, 5) &&
        intIn(project.wins, 0, project.required) &&
        intIn(project.cost, 0)
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
        (isMajorCityBuilding(id) && project.stage === 1 && project.required === 1) ||
        (BUILDING_BY_ID[id].introducedEra === 'river-rail' &&
          project.stage > 1 &&
          project.required === 2)) &&
      intIn(project.wins, 0, project.required)
    ) {
      town.projects[id] = {
        id,
        stage: project.stage,
        wins: Math.min(project.wins, projectRuns(id, project.stage)),
        // Honor already-paid one-run landmark projects from earlier saves.
        required: Math.min(project.required, projectRuns(id, project.stage)),
      };
    }
  }
  town.personalisation = normalizePersonalisation(saved?.personalisation, CREST_EMBLEM_IDS);
  town.tourSeen = saved?.tourSeen === true;
  town.presentations = normalizePresentations(saved?.presentations, town);
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
  return { ...withProject(town, id, project), projects };
}
// The building as its finished project leaves it.
function withProject(town, id, project) {
  const modernizing = project.type === 'modernization';
  return completeStage(town, id, {
    stage: modernizing ? town.buildings[id] : project.stage,
    era: project.targetEra ?? town.era,
    eraLevel: modernizing ? (project.eraLevel ?? 1) : town.era !== 'frontier' ? project.stage : 0,
  });
}
// The town once every project under construction has finished.
const townWithProjects = (town) =>
  Object.entries(town.projects).reduce(
    (next, [id, project]) => withProject(next, id, project),
    town,
  );
// A modernization keeps the building's level and records its new era appearance.
function completeStage(town, id, { stage, era, eraLevel }) {
  return {
    ...town,
    buildings: { ...town.buildings, [id]: stage },
    buildingEraLevels: { ...town.buildingEraLevels, [id]: eraLevel },
    buildingEras: { ...town.buildingEras, [id]: era },
  };
}

// The town as it will be once an offer is finished, for previews and guidance.
function townAfterOffer(town, id, offer) {
  const modernizing = offer.type === 'modernization';
  return completeStage(town, id, {
    stage: modernizing ? town.buildings[id] : offer.stage + 1,
    era: offer.targetEra ?? town.era,
    eraLevel: modernizing ? offer.eraLevel : town.era !== 'frontier' ? offer.stage + 1 : 0,
  });
}

// Water, food, homes, visitors and happiness come from the shared needs model.
export const foodCapacity = (town) => townSupply(town).food;
export const waterCapacity = (town) => townSupply(town).water;
export const housingCapacity = (town) => townSupply(town).housing;
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
export const residentPopulation = (town) => townNeeds(town).residents;
export const visitorCapacity = (town) => townSupply(town).visitors;
export const visitorPopulation = (town) => townNeeds(town).visitors;
export const population = (town) => townNeeds(town).population;
export const happiness = (town) => townNeeds(town).happiness;
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
const INCOME_HOURS_CAP = 5;
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
// The space helmet is out from its debut era on. Finding its wearer pays saloon takings
// (`SPACE_HELMET.rewardHours`), once each time a completed puzzle moves the helmet.
export const spaceHelmetOut = (town) => {
  const index = eraIndex(town?.era);
  return index >= 0 && index >= eraIndex(SPACE_HELMET.debut);
};
export const spaceHelmetFindable = (town) =>
  spaceHelmetOut(town) && town.completedRuns > town.helmetRun;
// The coins a find pays this town, for the owner's own find or a find while visiting.
export const spaceHelmetReward = (town, finder) =>
  Math.floor(saloonIncomeRate(town) * SPACE_HELMET.rewardHours[finder]);
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

// The very first project of a new town is free.
const isFirstProject = (town) =>
  !Object.keys(town.projects).length && BUILDINGS.every(({ id }) => !town.buildings[id]);

export function upgradeOffer(town, id, firstProject = isFirstProject(town)) {
  if (!Object.hasOwn(BUILDING_BY_ID, id)) return null;
  const building = BUILDING_BY_ID[id];
  const stage = town.buildings[id];
  const requirement = plotRequirement(town, id);
  const upgrade = building.upgrades[stage] ?? modernization(town, id);
  if (!upgrade) return null;
  const needsPower = upgrade.requiresPower && !hasElectricity(town);
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
              ? t('Earn {coins} more coins in the mine.', { coins: cost - town.coins })
              : '',
  };
}

// Immediate collection/completion takes priority over an affordable coin purchase.
// Hammers do not affect these ambient hints. Callers that re-check every second can
// pass `purchases` computed once per town, since only the collection cooldowns use `now`.
export function buildingIndicators(
  town,
  forgeCollectible = true,
  now = Date.now(),
  purchases = availablePurchases(town),
) {
  const indicators = Object.fromEntries(purchases.map(({ id }) => [id, 'upgrade']));
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

// Every building whose next offer could start now, cheapest first.
export function openOffers(town) {
  const firstProject = isFirstProject(town);
  return BUILDINGS.map((place) => ({ ...place, offer: upgradeOffer(town, place.id, firstProject) }))
    .filter(({ offer }) => offer?.available)
    .sort((a, b) => a.offer.cost - b.offer.cost);
}

// Offers the town can pay for now, in coins or with a builder hammer. Callers showing
// both views of one town can share `offers` from openOffers().
export const availablePurchases = (town, builderHammers = 0, offers = openOffers(town)) =>
  offers.filter(({ offer }) => town.coins >= offer.cost || builderHammers > 0);

export const availableParcels = (town, builderHammers = 0) => [
  ...BUILDINGS.filter(({ id }) => plotInEra(town, id) && constructionReady(town.projects[id])).map(
    (place) => ({ ...place, ready: true }),
  ),
  ...availablePurchases(town, builderHammers),
];

// Available offers that raise a need (water, food, housing, visitors or comfort),
// fewest coins per person supplied first, so small tweaks do not crowd out real
// fixes. Modernizing the waterworks or the farm counts like any building.
export function needFixes(town, stat, offers = new Map()) {
  const before = townSupply(town)[stat];
  const providers = needProviders(stat);
  return BUILDINGS.filter(({ id }) => providers.has(id))
    .map((place) => {
      const offer = offers.get(place.id) ?? upgradeOffer(town, place.id);
      const gain = offer?.available
        ? townSupply(townAfterOffer(town, place.id, offer))[stat] - before
        : 0;
      return { ...place, offer, gain };
    })
    .filter(({ gain }) => gain > 0)
    .sort((a, b) => a.offer.cost / a.gain - b.offer.cost / b.gain || a.offer.cost - b.offer.cost);
}
// Below this, guidance suggests comfort before optional expansion.
export const CONTENT_HAPPINESS = 70;

// What the village shows for its needs: supplies against demand, whether each runs
// short, and the cheapest available building that would raise it.
export function needsReport(town) {
  const needs = townNeeds(town);
  const offers = new Map(BUILDINGS.map(({ id }) => [id, upgradeOffer(town, id)]));
  const fix = (stat) => needFixes(town, stat, offers)[0]?.id ?? null;
  return {
    ...needs,
    short: {
      water: needs.water < needs.demand,
      food: needs.food < needs.demand,
      comfort: needs.demand > 0 && needs.happiness < CONTENT_HAPPINESS,
    },
    fixes: {
      water: fix('water'),
      food: fix('food'),
      housing: fix('housing'),
      comfort: fix('comfort'),
    },
  };
}

export function nextGoal(town) {
  const offers = new Map(BUILDINGS.map(({ id }) => [id, upgradeOffer(town, id)]));
  const available = BUILDINGS.filter((b) => offers.get(b.id)?.available);
  const cheapest = (choices) =>
    choices.toSorted((a, b) => offers.get(a.id).cost - offers.get(b.id).cost)[0]?.id;
  // Shortages the projects under construction will cover need no new suggestion.
  const needs = townNeeds(townWithProjects(town));
  const need = needs.water < needs.demand ? 'water' : needs.food < needs.demand ? 'food' : null;
  const unhappy = !need && needs.demand > 0 && needs.happiness < CONTENT_HAPPINESS;
  // A frontier town opens its first saloon, museum and forge before more comfort.
  const essential = ['saloon', 'museum', 'home', 'blacksmith'].find(
    (id) => available.some((b) => b.id === id) && !town.buildings[id],
  );
  // Put essential services and balanced defenses ahead of optional expansion.
  // An active project already covers its need; suggest another useful project.
  const defense = ['sheriff', 'bank']
    .filter((id) => available.some((b) => b.id === id) && town.buildings[id] * 2 < gangSize(town))
    .sort((a, b) => town.buildings[a] - town.buildings[b])[0];
  const id =
    INTRO_ORDER.find((key) => available.some((b) => b.id === key) && !town.buildings[key]) ??
    (need ? needFixes(town, need, offers)[0]?.id : null) ??
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
    (town.era === 'frontier' ? essential : null) ??
    (unhappy ? needFixes(town, 'comfort', offers)[0]?.id : null) ??
    (town.era !== 'frontier'
      ? (available.find((b) => b.id === 'bridge' && b.introducedEra === town.era)?.id ??
        cheapest(available.filter((b) => b.introducedEra === town.era)))
      : null) ??
    essential ??
    cheapest(available);
  return id ? { id, ...offers.get(id) } : null;
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
  const target = INCIDENT_TARGETS[kind].find((id) => town.buildings[id]);
  const event = {
    id: (town.events[BANDIT_EVENT]?.id ?? 0) + 1,
    atRun: town.completedRuns,
    gangSize: riders,
    sheriffLevel,
    bankLevel,
    ...(kind !== 'bandits' ? { kind, fireStationLevel: town.buildings.fireStation ?? 0 } : {}),
    targets: [...(kind === 'bandits' ? ['mine'] : []), ...(target ? [target] : [])],
    outcome: raidOutcome(protection, loss),
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

const raidOutcome = (protection, loss) =>
  protection === 1 ? 'protected' : loss ? 'stolen' : 'harmless';
// Refund the part of a saved loss that stronger defenses now prevent. A rung bell
// still halves what remains.
function reviseRaid(town, event, protection, changes) {
  const remaining = Math.ceil(5 * event.gangSize * (1 - protection));
  const loss = Math.min(event.loss, event.bellRung ? Math.floor(remaining / 2) : remaining);
  return {
    ...town,
    coins: Math.min(Number.MAX_SAFE_INTEGER, town.coins + event.loss - loss),
    events: {
      ...town.events,
      [BANDIT_EVENT]: { ...event, ...changes, loss, outcome: raidOutcome(protection, loss) },
    },
  };
}
// An unfinished raid can benefit from defenses opened before the riders leave.
// Refund only the reduction to its saved loss; later income and gang growth do not change it.
export function reinforceRaid(town) {
  const event = town.events[BANDIT_EVENT];
  if (!event || event.seen) return town;
  if (civicIncident(eventKind(event))) {
    const level = Math.max(event.fireStationLevel ?? 0, town.buildings.fireStation ?? 0);
    if (level === event.fireStationLevel) return town;
    return reviseRaid(town, event, fireProtection(level), { fireStationLevel: level });
  }
  const sheriffLevel = Math.max(event.sheriffLevel, town.buildings.sheriff);
  const bankLevel = Math.max(event.bankLevel ?? 0, town.buildings.bank);
  if (sheriffLevel === event.sheriffLevel && bankLevel === (event.bankLevel ?? 0)) return town;
  const protection = raidProtection(
    { buildings: { sheriff: sheriffLevel, bank: bankLevel } },
    event.gangSize,
  );
  return reviseRaid(town, event, protection, { sheriffLevel, bankLevel });
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
  return completeStage(town, id, {
    stage: offer.type === 'modernization' ? town.buildings[id] : expectedStage + 1,
    era: town.era,
    eraLevel: offer.eraLevel ?? (town.era !== 'frontier' ? expectedStage + 1 : 0),
  });
}
