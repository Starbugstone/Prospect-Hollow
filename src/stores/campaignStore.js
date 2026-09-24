import { queueBuildingPresentations, acknowledgePresentation } from '../data/townPresentations';
import { miningDepthBonus, CHEST_ECONOMY_VERSION } from '../data/economy';
import { defineStore } from 'pinia';
import { SHOP_ITEMS, rollShopStock, shopSlots, shopSpace } from '../data/shop';
import {
  LEVEL_COUNT,
  POWERS,
  CHEST_TIERS,
  getChestTier,
  getSpeedChestTier,
  getStars,
} from '../data/campaign';
import { TIP_IDS } from '../data/guidance';
import { grantChapterGift } from '../data/journey';
import { TOWN_PROJECTS } from '../data/townProjects';

import { localProfile, SAVE_KEY } from '../services/localProfile';
import { createSaveFile, parseSaveFile } from '../services/saveTransfer';
import {
  bonusCapacity,
  CONTINUOUS_COIN_CAP,
  HAMMER_CAPACITY,
  OVERFLOW_COINS,
  grantReward,
  rollChestReward,
  CHEST_DROPS,
  chestReward,
  chestRewardFits,
} from '../data/rewards';
import { createTown, BANDIT_EVENT } from '../data/town';
import { advanceEra } from '../game/town/TownEras';
import {
  normalizeTown,
  settleSaloonIncome,
  collectionCooldownRemaining,
  raidBounty,
  miningPayout,
  purchase,
  banditEncounter,
  scheduleRaid,
  reinforceRaid,
  ringTownBell,
  advanceConstruction,
  advanceForge,
  settleForgeProduction,
  constructionRuns,
  constructionReady,
  finishConstruction,
  buildWithHammer,
} from '../game/town/TownRules';
export { SAVE_KEY };

const defaults = () => ({
  hasVisitedVillage: false,
  seenTips: [],
  townProjectFocus: '',
  records: {},
  continuousRecords: {},
  continuousRun: null,
  activeRun: null,
  town: createTown(),
  issuedRun: 0,
  settledRun: 0,
  saveWarning: '',
  readOnly: false,
  lastConstruction: [],
  lastChapterReward: null,
  builderHammers: 0,
  chestsWithoutBuilderHammer: 0,
  pendingChests: [],
  shopStock: [],
  shopVisit: 0,
  seenObstacles: [],
  inventoryNotice: '',
  lastSaloonIncome: 0,
  powers: POWERS.map((power) => ({ ...power, quantity: 0 })),
});
const load = (loaded = localProfile.load(), persistRecovered = true) => {
  const state = defaults();
  try {
    const saved = loaded.data;
    state.hasVisitedVillage =
      !!saved?.town && typeof saved.town === 'object' && !Array.isArray(saved.town);
    state.seenTips = Array.isArray(saved?.seenTips)
      ? [...new Set(saved.seenTips.filter((id) => TIP_IDS.includes(id)))]
      : [];
    state.saveWarning = loaded.warning ?? '';
    state.readOnly = !!loaded.readOnly;
    state.town = normalizeTown(saved?.town);
    if (
      TOWN_PROJECTS.some(
        (project) => project.id === saved?.townProjectFocus && project.era === state.town.era,
      )
    )
      state.townProjectFocus = saved.townProjectFocus;
    if (Number.isSafeInteger(saved?.shopVisit) && saved.shopVisit >= 0)
      state.shopVisit = saved.shopVisit;
    if (Array.isArray(saved?.shopStock)) {
      for (const savedOffer of saved.shopStock) {
        const offer = savedOffer?.id === 'hammer' ? { ...savedOffer, id: 'tnt' } : savedOffer;
        if (
          !SHOP_ITEMS.some((item) => item.id === offer?.id) ||
          state.shopStock.some((item) => item.id === offer?.id)
        )
          continue;
        state.shopStock.push({ id: offer.id, sold: offer.sold === true });
      }
      state.shopStock = state.shopStock.slice(0, shopSlots(state.town.buildings.shop));
    }
    state.seenObstacles = Array.isArray(saved?.seenObstacles)
      ? saved.seenObstacles.filter((id) => typeof id === 'string')
      : [];
    if (Number.isInteger(saved?.chestsWithoutBuilderHammer))
      state.chestsWithoutBuilderHammer = Math.max(0, Math.min(9, saved.chestsWithoutBuilderHammer));
    if (Number.isSafeInteger(saved?.issuedRun) && saved.issuedRun >= 0)
      state.issuedRun = saved.issuedRun;
    if (
      Number.isSafeInteger(saved?.settledRun) &&
      saved.settledRun >= 0 &&
      saved.settledRun <= state.issuedRun
    )
      state.settledRun = saved.settledRun;
    for (let id = 1; id <= LEVEL_COUNT; id++) {
      const continuous = saved?.continuousRecords?.[id];
      if (
        continuous &&
        Number.isSafeInteger(continuous.coins) &&
        continuous.coins >= 0 &&
        Number.isFinite(continuous.score) &&
        continuous.score >= 0
      )
        state.continuousRecords[id] = {
          coins: Math.min(CONTINUOUS_COIN_CAP, continuous.coins),
          score: continuous.score,
        };
      const record = saved?.records?.[id];
      if (
        record &&
        Number.isFinite(record.score) &&
        Number.isInteger(record.stars) &&
        record.stars >= 1 &&
        record.stars <= 3
      ) {
        state.records[id] = { score: Math.max(0, record.score), stars: record.stars };
        if (Number.isFinite(record.bestTimeMs) && record.bestTimeMs > 0) {
          state.records[id].bestTimeMs = record.bestTimeMs;
        }
      }
    }
    if (Number.isSafeInteger(saved?.builderHammers) && saved.builderHammers >= 0)
      state.builderHammers = Math.min(HAMMER_CAPACITY, saved.builderHammers);
    let overflow = Math.max(
      0,
      (Number.isSafeInteger(saved?.builderHammers) ? saved.builderHammers : 0) - HAMMER_CAPACITY,
    );
    state.powers.forEach((power) => {
      const savedPower =
        saved?.powers?.find?.((entry) => entry.id === power.id) ??
        (power.id === 'tnt' ? saved?.powers?.find?.((entry) => entry.id === 'hammer') : null);
      if (Number.isSafeInteger(savedPower?.quantity) && savedPower.quantity >= 0) {
        power.quantity = Math.min(bonusCapacity(state.town), savedPower.quantity);
        overflow += savedPower.quantity - power.quantity;
      }
    });
    // An interrupted reveal automatically claims its saved fallback once. Inventory and
    // pending receipts are written together before another run can start.
    const recovered = (Array.isArray(saved?.pendingChests) ? saved.pendingChests : []).filter(
      (chest) =>
        chest?.runId > 0 &&
        chest.runId === state.settledRun &&
        ['completion', 'score', 'speed'].includes(chest.source),
    );
    const recoveredSources = new Set();
    for (const chest of recovered) {
      if (recoveredSources.has(chest.source)) continue;
      recoveredSources.add(chest.source);
      const savedId = chest.items?.[0]?.id;
      const drop = chestReward(
        savedId === 'hammer' ? 'tnt' : savedId,
        chest.levelId,
        chest.economyVersion ?? 1,
      );
      if (drop) grantReward(state, drop);
    }
    if (overflow) {
      state.town.coins = Math.min(
        Number.MAX_SAFE_INTEGER,
        state.town.coins + overflow * OVERFLOW_COINS,
      );
      state.inventoryNotice =
        'Bonus storage now has a limit. Extra saved bonuses were exchanged for 10 coins each.';
    }
    if (
      persistRecovered &&
      recovered.length &&
      !state.readOnly &&
      !localProfile.save({
        ...saved,
        powers: state.powers,
        town: state.town,
        townProjectFocus: state.townProjectFocus,
        builderHammers: state.builderHammers,
        pendingChests: [],
      })
    )
      state.saveWarning = 'Your progress is not saving. Keep this page open to continue.';
  } catch (error) {
    if (!persistRecovered) throw error;
    /* Unavailable or invalid storage starts a fresh in-memory journey. */
  }
  return state;
};

const profileData = (state) => ({
  schemaVersion: 2,
  records: state.records,
  continuousRecords: state.continuousRecords,
  powers: state.powers,
  builderHammers: state.builderHammers,
  chestsWithoutBuilderHammer: state.chestsWithoutBuilderHammer,
  pendingChests: state.pendingChests,
  shopStock: state.shopStock,
  shopVisit: state.shopVisit,
  seenObstacles: state.seenObstacles,
  seenTips: state.seenTips,
  town: state.town,
  townProjectFocus: state.townProjectFocus,
  issuedRun: state.issuedRun,
  settledRun: state.settledRun,
});

export const useCampaignStore = defineStore('campaign', {
  state: load,
  getters: {
    mineStage: (state) => {
      let chapters = 0;
      while (
        chapters < LEVEL_COUNT / 6 &&
        Array.from({ length: 6 }, (_, i) => chapters * 6 + i + 1).every((id) => state.records[id])
      )
        chapters++;
      return chapters;
    },
    bonusLimit: (state) => bonusCapacity(state.town),
    canCollectForge:
      (state) =>
      (now = Date.now()) =>
        state.town.buildings.blacksmith > 0 &&
        state.town.forge.charge === 1 &&
        state.powers.find((power) => power.id === 'tnt').quantity < bonusCapacity(state.town) &&
        !collectionCooldownRemaining(state.town, 'blacksmith', now),
    canReplay: (state) => state.town.buildings.museum > 0,
    nextLevel(state) {
      for (let id = 1; id <= LEVEL_COUNT; id++) if (!state.records[id]) return id;
      return LEVEL_COUNT;
    },
    completedCount: (state) => Object.keys(state.records).length,
    totalStars: (state) =>
      Object.values(state.records).reduce((sum, record) => sum + record.stars, 0),
  },
  actions: {
    visitVillage() {
      if (this.hasVisitedVillage) return;
      this.hasVisitedVillage = true;
      this.save();
    },
    markTipSeen(id) {
      if (!TIP_IDS.includes(id) || this.seenTips.includes(id)) return;
      this.seenTips.push(id);
      this.save();
    },
    focusTownProject(id) {
      if (!TOWN_PROJECTS.some((project) => project.id === id && project.era === this.town.era))
        return false;
      const previous = this.townProjectFocus;
      this.townProjectFocus = id;
      if (this.save()) return true;
      this.townProjectFocus = previous;
      return false;
    },
    acknowledgeFirstLights() {
      if (
        this.town.era !== 'industrial' ||
        !this.town.buildings.powerHouse ||
        this.town.firstLightsSeen
      )
        return false;
      const previous = this.town;
      this.town = { ...previous, firstLightsSeen: true };
      if (this.save()) return true;
      this.town = previous;
      return false;
    },
    advanceEra(expectedEra) {
      if (this.activeRun) return false;
      const next = advanceEra(this.town, expectedEra);
      if (!next) return false;
      const previous = this.town;
      this.town = next;
      if (this.save()) return true;
      this.town = previous;
      return false;
    },
    acknowledgePresentation(id) {
      const next = acknowledgePresentation(this.town, id);
      if (!next) return false;
      const previous = this.town;
      this.town = next;
      if (this.save()) return true;
      this.town = previous;
      return false;
    },
    acknowledgeEra() {
      if (!this.town.transition?.pending) return;
      const previous = this.town;
      this.town = {
        ...previous,
        transition: { ...previous.transition, pending: false },
        eraTransitionSeen: { ...previous.eraTransitionSeen, [previous.era]: true },
      };
      if (this.save()) return true;
      this.town = previous;
      return false;
    },
    canPlay(id, mode = 'normal') {
      return (
        this.isUnlocked(id) &&
        (mode === 'continuous' ? this.canReplay : !this.records[id] || this.canReplay)
      );
    },
    isUnlocked(id) {
      return Number.isInteger(id) && id >= 1 && id <= this.nextLevel;
    },
    save() {
      if (this.readOnly) return false;
      const saved = localProfile.save(profileData(this));
      this.saveWarning = saved
        ? ''
        : 'Your progress is not saving. Keep this page open to continue.';
      return saved;
    },
    exportSave() {
      if (this.readOnly)
        throw new Error('This save cannot be exported by this version of the game.');
      return createSaveFile(profileData(this));
    },
    importSave(text) {
      const next = load({ data: parseSaveFile(text) }, false);
      // Commit the normalized profile before replacing any live progress.
      if (!localProfile.save(profileData(next)))
        throw new Error('The save could not be stored. Your current progress has not changed.');
      this.$patch((state) => Object.assign(state, next));
    },
    collectForgeTNT(now = Date.now()) {
      if (!Number.isSafeInteger(now) || now < 0 || this.activeRun || !this.canCollectForge(now))
        return false;
      const slot = this.powers.find((power) => power.id === 'tnt');
      const previous = this.town;
      this.town = {
        ...previous,
        forge: { progress: 0, charge: 0 },
        lastCollections: { ...previous.lastCollections, blacksmith: now },
      };
      slot.quantity++;
      if (this.save()) return true;
      slot.quantity--;
      this.town = previous;
      return false;
    },
    beginRun(mode = 'normal', id = null) {
      this.settlePendingChests();
      this.lastChapterReward = null;
      this.issuedRun += 1;
      this.activeRun = this.issuedRun;
      this.continuousRun =
        mode === 'continuous' ? { runId: this.issuedRun, id, credited: 0 } : null;
      this.save();
      return this.issuedRun;
    },
    endRun(runId) {
      if (this.activeRun === runId) this.activeRun = null;
    },
    recordContinuous({ id, runId, jewels, score }) {
      const run = this.continuousRun;
      if (
        !this.canReplay ||
        !this.isUnlocked(id) ||
        !run ||
        run.runId !== runId ||
        run.id !== id ||
        runId !== this.issuedRun ||
        runId <= this.settledRun
      )
        return false;
      if (!Number.isSafeInteger(jewels) || jewels < 0 || !Number.isFinite(score) || score < 0)
        return false;
      const previous = this.continuousRecords[id] ?? { coins: 0, score: 0 };
      const baseCoins = Math.floor(jewels / 10);
      const earned = Math.min(CONTINUOUS_COIN_CAP, baseCoins + miningDepthBonus(baseCoins, id));
      const delta = Math.min(
        CONTINUOUS_COIN_CAP - previous.coins,
        Math.max(0, earned - run.credited),
      );
      run.credited = Math.max(run.credited, earned);
      const best = Math.max(previous.score, score);
      if (!delta && previous.score === best && this.continuousRecords[id]) return true;
      this.continuousRecords[id] = { coins: previous.coins + delta, score: best };
      this.town.coins = Math.min(Number.MAX_SAFE_INTEGER, this.town.coins + delta);
      this.save();
      return true;
    },
    resetProgress() {
      this.$patch((state) => Object.assign(state, defaults()));
      return this.save();
    },
    accrueSaloonIncome(now = Date.now(), persist = true) {
      const result = settleSaloonIncome(this.town, now);
      if (result.town === this.town) return 0;
      this.town = result.town;
      if (persist) this.save();
      return result.earned;
    },
    collectSaloonIncome(now = Date.now()) {
      if (!Number.isSafeInteger(now) || now < 0 || !this.town.buildings.saloon) return 0;
      this.accrueSaloonIncome(now, false);
      if (collectionCooldownRemaining(this.town, 'saloon', now)) {
        this.save();
        return 0;
      }
      const coins = Math.min(
        this.town.income.stored ?? 0,
        Number.MAX_SAFE_INTEGER - this.town.coins,
      );
      if (!coins) {
        this.save();
        return 0;
      }
      const previous = this.town;
      const previousIncome = this.lastSaloonIncome;
      this.town = {
        ...previous,
        income: { ...previous.income, stored: previous.income.stored - coins },
        coins: previous.coins + coins,
        lastCollections: { ...previous.lastCollections, saloon: now },
      };
      this.lastSaloonIncome = coins;
      if (!this.save()) {
        this.town = previous;
        this.lastSaloonIncome = previousIncome;
        return 0;
      }
      return coins;
    },
    upgradeBuilding(id, expectedStage) {
      this.accrueSaloonIncome(Date.now(), false);
      const next = purchase(this.town, id, expectedStage);
      if (!next) return false;
      this.town = queueBuildingPresentations(this.town, next);
      this.ensureShopStock();
      this.save();
      return true;
    },
    finishConstruction(id, expectedStage) {
      const next = finishConstruction(this.town, id, expectedStage);
      if (!next) return false;
      this.accrueSaloonIncome(Date.now(), false);
      next.coins = this.town.coins;
      next.income = this.town.income;
      const previous = this.town;
      const previousStock = this.shopStock;
      const previousVisit = this.shopVisit;
      this.town = queueBuildingPresentations(previous, settleForgeProduction(reinforceRaid(next)));
      this.ensureShopStock();
      if (!this.save()) {
        this.town = previous;
        this.shopStock = previousStock;
        this.shopVisit = previousVisit;
        return false;
      }
      return true;
    },
    useBuilderHammer(id, expectedStage) {
      if (this.builderHammers < 1) return false;
      const next = buildWithHammer(this.town, id, expectedStage);
      if (!next) return false;
      this.accrueSaloonIncome(Date.now(), false);
      // Keep the settled balance/checkpoint when applying this construction result.
      next.coins = this.town.coins;
      next.income = this.town.income;
      this.builderHammers--;
      const previous = this.town;
      const previousStock = this.shopStock;
      const previousVisit = this.shopVisit;
      this.town = queueBuildingPresentations(previous, settleForgeProduction(reinforceRaid(next)));
      this.ensureShopStock();
      if (!this.save()) {
        this.town = previous;
        this.shopStock = previousStock;
        this.shopVisit = previousVisit;
        this.builderHammers++;
        return false;
      }
      return true;
    },
    awardReward(reward) {
      const granted = grantReward(this, reward);
      if (granted) this.save();
      return granted;
    },
    resolveBandits() {
      this.accrueSaloonIncome(Date.now(), false);
      const previous = this.town;
      const scheduled = scheduleRaid(previous);
      const next = banditEncounter(scheduled);
      if (!next && scheduled === previous) return false;
      this.town = next ?? scheduled;
      if (!this.save()) {
        this.town = previous;
        return false;
      }
      return !!next;
    },
    ringTownBell(raidId) {
      const previous = this.town;
      const next = ringTownBell(previous, raidId);
      if (!next) return false;
      this.town = next;
      if (!this.save()) {
        this.town = previous;
        return false;
      }
      return true;
    },
    markRaidSeen(id) {
      const event = this.town.events[BANDIT_EVENT];
      if (!event || event.id !== id || event.seen) return false;
      const previous = this.town;
      const bounty = Math.min(raidBounty(event), Number.MAX_SAFE_INTEGER - previous.coins);
      this.town = {
        ...previous,
        coins: previous.coins + bounty,
        events: { ...previous.events, [BANDIT_EVENT]: { ...event, seen: true, bounty } },
      };
      if (this.save()) return true;
      this.town = previous;
      return false;
    },
    ensureShopStock(refresh = false) {
      if (!this.town.buildings.shop) return;
      if (refresh || this.shopStock.length < shopSlots(this.town.buildings.shop)) {
        this.shopStock = rollShopStock(
          this.town.buildings.shop,
          Math.random,
          refresh ? [] : this.shopStock,
        );
        this.shopVisit++;
      }
    },
    buyShopItem(id, visit) {
      const offer = this.shopStock.find((entry) => entry.id === id);
      const item = SHOP_ITEMS.find((entry) => entry.id === id);
      if (
        !this.town.buildings.shop ||
        visit !== this.shopVisit ||
        !offer ||
        offer.sold ||
        !item ||
        shopSpace(this, item) < 1 ||
        this.town.coins < item.price
      )
        return false;
      this.town.coins -= item.price;
      grantReward(this, item);
      offer.sold = true;
      this.save();
      return true;
    },
    markObstaclesSeen(ids) {
      this.seenObstacles = [...new Set([...this.seenObstacles, ...ids])];
      this.save();
    },
    finishTownTour() {
      this.town.tourSeen = true;
      this.save();
    },
    claimChest(id, selection) {
      const chest = this.pendingChests.find((entry) => entry.id === id);
      if (!chest) return null;
      const chosen = chestReward(selection, chest.levelId, chest.economyVersion ?? 1);
      const fallback = chestReward(chest.items[0].id, chest.levelId, chest.economyVersion ?? 1);
      const granted = grantReward(this, chosen ?? fallback);
      this.pendingChests = this.pendingChests.filter((entry) => entry.id !== id);
      this.save();
      return granted;
    },
    settlePendingChests() {
      return this.pendingChests.map((chest) => ({
        id: chest.id,
        reward: this.claimChest(chest.id),
      }));
    },
    recordVictory({
      id,
      score,
      target,
      combo,
      elapsedMs,
      speedTargetMs,
      runId,
      jewels = 0,
      bonusGems = 0,
      comboCounts = {},
      multiMatchCounts = {},
      chooseRewards = false,
    }) {
      if (
        !this.isUnlocked(id) ||
        (this.continuousRun && (runId == null || this.continuousRun.runId === runId))
      )
        return [];
      // Older callers can settle a fresh run; the game always supplies its issued identity.
      if (runId == null) runId = ++this.issuedRun;
      if (runId !== this.issuedRun || runId <= this.settledRun) return [];
      const previous = this.records[id];
      const previousChapter = this.mineStage;
      this.records[id] = {
        score: Math.max(previous?.score ?? 0, score),
        stars: Math.max(previous?.stars ?? 0, getStars(score, target, combo)),
      };
      const validTime = Number.isFinite(elapsedMs) && elapsedMs > 0;
      const bestTimeMs = Math.min(
        previous?.bestTimeMs ?? Infinity,
        validTime ? elapsedMs : Infinity,
      );
      if (Number.isFinite(bestTimeMs)) this.records[id].bestTimeMs = bestTimeMs;
      this.accrueSaloonIncome(Date.now(), false);
      this.town.completedRuns = Math.min(Number.MAX_SAFE_INTEGER, this.town.completedRuns + 1);
      const projects = Object.values(this.town.projects).filter(
        (project) => !constructionReady(project),
      );
      this.town = advanceConstruction(this.town);
      this.town = advanceForge(this.town);
      this.endRun(runId);
      this.ensureShopStock(true);
      this.lastConstruction = projects.map((project) => ({
        id: project.id,
        stage: project.stage,
        wins: Math.min(constructionRuns(project), project.wins + 1),
        required: constructionRuns(project),
        ready: constructionReady(this.town.projects[project.id]),
      }));
      this.lastChapterReward =
        this.mineStage > previousChapter
          ? { chapter: this.mineStage, gift: grantChapterGift(this, this.mineStage) }
          : null;
      const rewards = [];
      const scoreTier = getChestTier(score, target);
      const speedTier = getSpeedChestTier(elapsedMs, speedTargetMs);
      for (const [source, tier] of [
        [scoreTier ? 'score' : 'completion', scoreTier ?? (speedTier ? null : CHEST_TIERS[0])],
        ['speed', speedTier],
      ]) {
        if (!tier) continue;
        const rolled =
          this.chestsWithoutBuilderHammer >= 9
            ? CHEST_DROPS.find(
                (drop) =>
                  drop.id ===
                  (chestRewardFits(this, chestReward('builder-hammer'))
                    ? 'builder-hammer'
                    : 'coins'),
              )
            : rollChestReward(Math.random, this);
        this.chestsWithoutBuilderHammer =
          rolled.kind === 'builder-hammer' ? 0 : this.chestsWithoutBuilderHammer + 1;
        const reward = chestReward(rolled.id, id);
        const drop = chooseRewards
          ? { id: reward.id, kind: reward.kind, label: reward.label, quantity: reward.quantity }
          : grantReward(this, reward);
        const chest = {
          ...tier,
          id: `${runId}-${source}`,
          runId,
          levelId: id,
          economyVersion: CHEST_ECONOMY_VERSION,
          count: 1,
          source,
          items: [drop],
        };
        if (chooseRewards) this.pendingChests.push(chest);
        rewards.push(chest);
      }
      this.town.coins = Math.min(
        Number.MAX_SAFE_INTEGER,
        this.town.coins + miningPayout(jewels, bonusGems, comboCounts, multiMatchCounts, id),
      );
      this.settledRun = runId;
      // Campaign, chest rewards, and town income move together before any reveal.
      this.save();
      return rewards;
    },
  },
});
