import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { HAMMER_CAPACITY } from '../data/rewards';
import { CHAPTERS, LEVEL_COUNT } from '../data/campaign';
import { chapterLevelIds } from '../data/chapters';
import { queueCampaignPresentations } from '../data/townPresentations';
import { ERAS, FRONTIER_ERA } from '../data/eras';
import { BUILDINGS, BANDIT_EVENT } from '../data/town';
import { ERA_BUILDING_LEVELS, eraGate, plotInEra } from '../game/town/TownEras';
import { normalizeTown, settleSaloonIncome } from '../game/town/TownRules';
import { townFrameStats, townTimings } from '../game/town/TownProfiler';
import { runRegisteredTestingMutation } from './localIntegrity';

export const TESTING_TOWN_CHANGED = 'prospect-debug-town-changed';

// Console cheats exist for development, the preprod site and explicitly flagged local
// builds (VITE_DEBUG_TOOLS=true npm run build). The public game never installs them.
export const debugToolsAllowed = (
  env = import.meta.env,
  hostname = globalThis.location?.hostname ?? '',
) => !!env.DEV || env.VITE_DEBUG_TOOLS === 'true' || hostname.startsWith('preprod.');
const testingPermits = new WeakSet();
export const isRegisteredTestingPermit = (permit) =>
  testingPermits.has(permit) && debugToolsAllowed();

function saveChanges(campaign, changes, permit) {
  if (!runRegisteredTestingMutation(campaign, permit, () => campaign.commit(changes)))
    throw new Error('Test changes could not be saved. Previous progress was restored.');
}

// Console-only tools for this device-local game; see debugToolsAllowed.
export function createTestingTools(pinia) {
  const permit = {};
  if (debugToolsAllowed()) testingPermits.add(permit);
  return Object.freeze({
    async showNavigation(value = true) {
      return (await import('../game/town/NavigationDebug')).showNavigation(value);
    },
    // Construction and rebuild phase timings (ms) plus browser long tasks, for phones.
    townTimings(options) {
      return townTimings(options);
    },
    // Per-frame render costs over a window, e.g. `await prospectDebug.townFrameStats(5)`
    // while orbiting the camera. Includes draw calls, triangles and quality settings.
    townFrameStats(seconds) {
      return townFrameStats(seconds);
    },
    prepareEra(era) {
      const campaign = useCampaignStore(pinia);
      era ??= campaign.town.era;
      const index = ERAS.findIndex((entry) => entry.id === era && entry.enabled);
      if (index < 0) throw new TypeError('Choose an enabled era ID from the README.');
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      if (campaign.activeRun || useGameStore(pinia).sessionActive)
        throw new Error('Exit the mine before preparing an era.');
      const town = JSON.parse(JSON.stringify(settleSaloonIncome(campaign.town, Date.now()).town));
      town.era = era;
      town.projects = {};
      town.transition = null;
      town.tourSeen = true;
      for (const building of BUILDINGS) {
        const visible = plotInEra(town, building.id);
        town.buildings[building.id] = visible ? building.upgrades.length : 0;
        town.buildingEras[building.id] = visible ? era : FRONTIER_ERA;
        town.buildingEraLevels[building.id] =
          visible && era !== FRONTIER_ERA
            ? building.introducedEra === era
              ? building.upgrades.length
              : ERA_BUILDING_LEVELS
            : 0;
      }
      town.firstLightsSeen = town.buildings.powerHouse > 0;
      if (town.events[BANDIT_EVENT]) town.events[BANDIT_EVENT].seen = true;
      town.presentations = Object.fromEntries(
        Object.keys(town.presentations).map((id) => [id, 'seen']),
      );
      const ready = normalizeTown(town);
      saveChanges(campaign, { town: ready, townProjectFocus: '', lastConstruction: [] }, permit);
      globalThis.window?.dispatchEvent(new Event(TESTING_TOWN_CHANGED));
      const gate = eraGate(ready);
      return { era, nextEra: gate.next?.id ?? null, readyToChange: gate.available };
    },
    mineStage(chapter) {
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTERS.length)
        throw new TypeError(`Mine chapter must be an integer from 1 to ${CHAPTERS.length}.`);
      const campaign = useCampaignStore(pinia);
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      const [firstLevel] = chapterLevelIds(chapter - 1);
      const records = { ...campaign.records };
      for (let id = 1; id < firstLevel; id++) records[id] ??= { score: 0, stars: 1 };
      saveChanges(campaign, { records }, permit);
      const game = useGameStore(pinia);
      game.exitLevel();
      globalThis.window?.dispatchEvent(new Event(TESTING_TOWN_CHANGED));
      game.bootstrap();
      game.startLevel(firstLevel, 'normal', { debugReplay: true });
      return { chapter, name: CHAPTERS[chapter - 1].name, level: firstLevel };
    },
    completeMine() {
      const campaign = useCampaignStore(pinia);
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      if (!useGameStore(pinia).sessionActive)
        throw new Error(
          'Enter the mine before completing its collection. Leave afterward to see the celebration.',
        );
      const records = { ...campaign.records };
      for (let id = 1; id <= LEVEL_COUNT; id++)
        records[id] = { score: 0, ...records[id], stars: 3 };
      const town = { ...campaign.town, presentations: { ...campaign.town.presentations } };
      // Explicitly re-arm this debug preview even if it was already watched.
      // The normal presentation lifecycle starts it on the next village visit.
      delete town.presentations['three-star-celebration'];
      saveChanges(campaign, { records, town: queueCampaignPresentations(town, records) }, permit);
      return { levels: LEVEL_COUNT, stars: LEVEL_COUNT * 3, celebration: 'pending' };
    },
    grant({ coins = 100000, hammers = HAMMER_CAPACITY } = {}) {
      if (![coins, hammers].every((value) => Number.isSafeInteger(value) && value >= 0))
        throw new TypeError('Coins and hammers must be non-negative safe integers.');
      const campaign = useCampaignStore(pinia);
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      const granted = runRegisteredTestingMutation(campaign, permit, () =>
        campaign.commit({
          town: {
            ...campaign.town,
            coins: Math.min(Number.MAX_SAFE_INTEGER, campaign.town.coins + coins),
          },
          builderHammers: Math.min(HAMMER_CAPACITY, campaign.builderHammers + hammers),
        }),
      );
      if (!granted) throw new Error('Test resources could not be saved. Balances were restored.');
      return { coins: campaign.town.coins, builderHammers: campaign.builderHammers };
    },
  });
}
