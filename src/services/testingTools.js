import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { HAMMER_CAPACITY } from '../data/rewards';
import { CHAPTERS, LEVEL_COUNT } from '../data/campaign';
import { queueCampaignPresentations } from '../data/townPresentations';
import { ERAS, FRONTIER_ERA } from '../data/eras';
import { BUILDINGS, BANDIT_EVENT } from '../data/town';
import { ERA_BUILDING_LEVELS, eraGate, plotInEra } from '../game/town/TownEras';
import { normalizeTown, settleSaloonIncome } from '../game/town/TownRules';

export const TESTING_TOWN_CHANGED = 'prospect-debug-town-changed';

function saveChanges(campaign, changes) {
  const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, campaign[key]]));
  Object.assign(campaign, changes);
  if (!campaign.save()) {
    Object.assign(campaign, previous);
    throw new Error('Test changes could not be saved. Previous progress was restored.');
  }
}

// Console-only tools for this device-local game, also available in preview builds.
export function createTestingTools(pinia) {
  return Object.freeze({
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
      town.eraTransitionSeen = Object.fromEntries(
        ERAS.slice(0, index + 1).map(({ id }) => [id, true]),
      );
      town.tourSeen = town.constructionTipSeen = true;
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
      saveChanges(campaign, { town: ready, townProjectFocus: '', lastConstruction: [] });
      globalThis.window?.dispatchEvent(new Event(TESTING_TOWN_CHANGED));
      const gate = eraGate(ready);
      return { era, nextEra: gate.next?.id ?? null, readyToChange: gate.available };
    },
    mineStage(chapter) {
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTERS.length)
        throw new TypeError(`Mine chapter must be an integer from 1 to ${CHAPTERS.length}.`);
      const campaign = useCampaignStore(pinia);
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      const firstLevel = (chapter - 1) * 6 + 1;
      const records = { ...campaign.records };
      for (let id = 1; id < firstLevel; id++) records[id] ??= { score: 0, stars: 1 };
      saveChanges(campaign, { records });
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
      saveChanges(campaign, { records, town: queueCampaignPresentations(town, records) });
      return { levels: LEVEL_COUNT, stars: LEVEL_COUNT * 3, celebration: 'pending' };
    },
    grant({ coins = 100000, hammers = HAMMER_CAPACITY } = {}) {
      if (![coins, hammers].every((value) => Number.isSafeInteger(value) && value >= 0))
        throw new TypeError('Coins and hammers must be non-negative safe integers.');
      const campaign = useCampaignStore(pinia);
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      const previousCoins = campaign.town.coins;
      const previousHammers = campaign.builderHammers;
      campaign.town.coins = Math.min(Number.MAX_SAFE_INTEGER, previousCoins + coins);
      campaign.builderHammers = Math.min(HAMMER_CAPACITY, previousHammers + hammers);
      if (!campaign.save()) {
        campaign.town.coins = previousCoins;
        campaign.builderHammers = previousHammers;
        throw new Error('Test resources could not be saved. Balances were restored.');
      }
      return { coins: campaign.town.coins, builderHammers: campaign.builderHammers };
    },
  });
}
