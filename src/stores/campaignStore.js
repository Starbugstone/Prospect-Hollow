import {
  VIP_SPEND,
  VIP_RECEIPT_LIMIT,
  vipVisitBuildings,
  normalizeVipReceipts,
  vipReceipt,
} from '../data/vipVisits';
import {
  queueBuildingPresentations,
  queueCampaignPresentations,
  acknowledgePresentation,
} from '../data/townPresentations';
import { campaignCompletion } from '../data/campaignCompletion';
import { miningDepthBonus, CHEST_ECONOMY_VERSION } from '../data/economy';
import { defineStore } from 'pinia';
import { SHOP_ITEMS, rollShopStock, shopSlots, shopSpace } from '../data/shop';
import { CHAPTERS, LEVEL_COUNT, POWERS, runChests, getStars } from '../data/campaign';
import { chapterLevelIds } from '../data/chapters';
import { TIP_IDS } from '../data/guidance';
import { grantChapterGift } from '../data/journey';
import { TOWN_PROJECTS } from '../data/townProjects';

import { townStorage } from '../services/townStorage';
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
import { newerGuest } from '../data/guestVip';
import { advanceEra } from '../game/town/TownEras';
import {
  normalizeTown,
  saloonIncomeRate,
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
export const freshProfile = () => profileData(defaults());

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
  vipReceipts: [],
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
    state.vipReceipts = normalizeVipReceipts(saved?.vipReceipts);
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
    state.town = queueCampaignPresentations(state.town, state.records);
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
  vipReceipts: state.vipReceipts,
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
        chapters < CHAPTERS.length &&
        chapterLevelIds(chapters).every((id) => state.records[id])
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
    completion: (state) => campaignCompletion(state.records),
    totalStars: (state) =>
      Object.values(state.records).reduce((sum, record) => sum + record.stars, 0),
  },
  actions: {
    // Persist a change atomically: apply it, save, and restore every listed field if the
    // save fails, so the village never shows progress that was not stored.
    transaction(fields, apply) {
      const previous = Object.fromEntries(fields.map((key) => [key, this[key]]));
      apply();
      if (this.save()) return true;
      Object.assign(this, previous);
      return false;
    },
    commit(changes) {
      return this.transaction(Object.keys(changes), () => Object.assign(this, changes));
    },
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
      return this.commit({ townProjectFocus: id });
    },
    acknowledgeFirstLights() {
      if (
        this.town.era !== 'industrial' ||
        !this.town.buildings.powerHouse ||
        this.town.firstLightsSeen
      )
        return false;
      return this.commit({ town: { ...this.town, firstLightsSeen: true } });
    },
    advanceEra(expectedEra) {
      if (this.activeRun) return false;
      const next = advanceEra(this.town, expectedEra);
      return !!next && this.commit({ town: next });
    },
    acknowledgePresentation(id) {
      const next = acknowledgePresentation(this.town, id);
      return !!next && this.commit({ town: next });
    },
    acknowledgeEra() {
      const town = this.town;
      if (!town.transition?.pending) return false;
      return this.commit({
        town: {
          ...town,
          transition: { ...town.transition, pending: false },
        },
      });
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
    // The persisted fields of this profile, as saved locally and synced.
    profile() {
      return profileData(this);
    },
    save() {
      if (this.readOnly || localProfile.writesSuspended) return false;
      const saved = localProfile.save(this.profile());
      this.saveWarning = saved
        ? ''
        : 'Your progress is not saving. Keep this page open to continue.';
      return saved;
    },
    exportSave() {
      if (this.readOnly)
        throw new Error('This save cannot be exported by this version of the game.');
      return createSaveFile(this.profile());
    },
    reloadLocal() {
      this.$patch((state) => Object.assign(state, load()));
    },
    importSave(text) {
      const parsed = parseSaveFile(text);
      const next = load({ data: parsed }, false);
      // Commit the normalized profile before replacing any live progress.
      try {
        townStorage.import(profileData(next), parsed._backupTown);
      } catch (error) {
        throw new Error(
          `${error.message || 'The save could not be stored.'} Your current progress has not changed.`,
          { cause: error },
        );
      }
      localProfile.load();
      this.$patch((state) => Object.assign(state, next));
    },
    collectForgeTNT(now = Date.now()) {
      if (!Number.isSafeInteger(now) || now < 0 || this.activeRun || !this.canCollectForge(now))
        return false;
      return this.commit({
        town: {
          ...this.town,
          forge: { progress: 0, charge: 0 },
          lastCollections: { ...this.town.lastCollections, blacksmith: now },
        },
        powers: this.powers.map((power) =>
          power.id === 'tnt' ? { ...power, quantity: power.quantity + 1 } : power,
        ),
      });
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
      try {
        townStorage.reset(profileData(defaults()));
      } catch {
        return false;
      }
      localProfile.load();
      this.$patch((state) => Object.assign(state, defaults()));
      return true;
    },
    // Refresh the displayed reserve without creating an idle save. Collections and
    // other lasting changes persist it; reloads recalculate from the saved checkpoint.
    accrueSaloonIncome(now = Date.now()) {
      const initialize = this.town.income.at === null && saloonIncomeRate(this.town) > 0;
      const result = settleSaloonIncome(this.town, now);
      if (result.town === this.town) return 0;
      this.town = result.town;
      // Older imports may have no starting timestamp. Establish it once so their
      // earnings survive a reload even before the first collection or town change.
      if (initialize) this.save();
      return result.earned;
    },
    collectVipSpending(receipt) {
      const key = vipReceipt(receipt);
      if (
        !key ||
        this.vipReceipts.includes(key) ||
        !vipVisitBuildings(this.town).includes(receipt.building) ||
        this.town.coins > Number.MAX_SAFE_INTEGER - VIP_SPEND
      )
        return 0;
      const saved = this.commit({
        town: { ...this.town, coins: this.town.coins + VIP_SPEND },
        vipReceipts: [...this.vipReceipts, key].slice(-VIP_RECEIPT_LIMIT),
      });
      return saved ? VIP_SPEND : 0;
    },
    collectSaloonIncome(now = Date.now()) {
      if (!Number.isSafeInteger(now) || now < 0 || !this.town.buildings.saloon) return 0;
      this.accrueSaloonIncome(now);
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
      const town = this.town;
      const saved = this.commit({
        town: {
          ...town,
          income: { ...town.income, stored: town.income.stored - coins },
          coins: town.coins + coins,
          lastCollections: { ...town.lastCollections, saloon: now },
        },
        lastSaloonIncome: coins,
      });
      return saved ? coins : 0;
    },
    // A share-link visitor collects up to one hour of income from the reserved coins,
    // once per collection, leaving the rest for the owner. Returns coins moved.
    collectSaloonForVisitor(at, now = Date.now()) {
      if (!Number.isSafeInteger(at) || at <= this.town.saloonVisitAt || !Number.isSafeInteger(now))
        return null;
      let town = this.town,
        coins = 0;
      if (town.buildings.saloon) {
        town = settleSaloonIncome(town, now).town;
        coins = Math.min(
          town.income.stored ?? 0,
          saloonIncomeRate(town),
          Number.MAX_SAFE_INTEGER - town.coins,
        );
        town = {
          ...town,
          coins: town.coins + coins,
          income: { ...town.income, stored: town.income.stored - coins },
        };
      }
      const changes = { town: { ...town, saloonVisitAt: at } };
      if (coins) changes.lastSaloonIncome = coins;
      return this.commit(changes) ? coins : null;
    },
    // A signed-in visitor viewed the shared town: only the latest becomes the guest VIP.
    welcomeGuest(remote) {
      const guest = newerGuest(this.town.guestVip, remote);
      if (!guest) return null;
      return this.commit({ town: { ...this.town, guestVip: guest } }) ? guest.name : null;
    },
    // The guest walked into the village: they arrive once per visit.
    markGuestSeen(at) {
      const guest = this.town.guestVip;
      if (!guest || guest.at !== at || guest.seen) return false;
      return this.commit({ town: { ...this.town, guestVip: { ...guest, seen: true } } });
    },
    upgradeBuilding(id, expectedStage) {
      this.accrueSaloonIncome();
      const next = purchase(this.town, id, expectedStage);
      if (!next) return false;
      // A purchase stays usable in memory when storage fails; save() reports the warning.
      this.town = queueBuildingPresentations(this.town, next);
      this.ensureShopStock();
      this.save();
      return true;
    },
    finishConstruction(id, expectedStage) {
      const next = finishConstruction(this.town, id, expectedStage);
      return !!next && this.completeProject(next);
    },
    useBuilderHammer(id, expectedStage) {
      if (this.builderHammers < 1) return false;
      const next = buildWithHammer(this.town, id, expectedStage);
      return !!next && this.completeProject(next, { builderHammers: this.builderHammers - 1 });
    },
    // A finished building opens its services, refunds prevented raid losses and restocks
    // the shop; the settled balance and income checkpoint carry over unchanged.
    completeProject(next, extra = {}) {
      this.accrueSaloonIncome();
      next.coins = this.town.coins;
      next.income = this.town.income;
      return this.transaction(['town', 'shopStock', 'shopVisit', ...Object.keys(extra)], () => {
        Object.assign(this, extra);
        this.town = queueBuildingPresentations(
          this.town,
          settleForgeProduction(reinforceRaid(next)),
        );
        this.ensureShopStock();
      });
    },
    awardReward(reward) {
      const granted = grantReward(this, reward);
      if (granted) this.save();
      return granted;
    },
    resolveBandits() {
      this.accrueSaloonIncome();
      const previous = this.town;
      const scheduled = scheduleRaid(previous);
      const next = banditEncounter(scheduled);
      if (!next && scheduled === previous) return false;
      return this.commit({ town: next ?? scheduled }) && !!next;
    },
    ringTownBell(raidId) {
      const next = ringTownBell(this.town, raidId);
      return !!next && this.commit({ town: next });
    },
    markRaidSeen(id) {
      const event = this.town.events[BANDIT_EVENT];
      if (!event || event.id !== id || event.seen) return false;
      const town = this.town;
      const bounty = Math.min(raidBounty(event), Number.MAX_SAFE_INTEGER - town.coins);
      return this.commit({
        town: {
          ...town,
          coins: town.coins + bounty,
          events: { ...town.events, [BANDIT_EVENT]: { ...event, seen: true, bounty } },
        },
      });
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
      starTarget = target,
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
        stars: Math.max(previous?.stars ?? 0, getStars(score, starTarget, combo)),
      };
      const validTime = Number.isFinite(elapsedMs) && elapsedMs > 0;
      const bestTimeMs = Math.min(
        previous?.bestTimeMs ?? Infinity,
        validTime ? elapsedMs : Infinity,
      );
      if (Number.isFinite(bestTimeMs)) this.records[id].bestTimeMs = bestTimeMs;
      this.accrueSaloonIncome();
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
      for (const { source, label } of runChests(score, target, elapsedMs, speedTargetMs)) {
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
          id: `${runId}-${source}`,
          label,
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
      this.town = queueCampaignPresentations(this.town, this.records);
      // Campaign, chest rewards, and town income move together before any reveal.
      this.save();
      return rewards;
    },
  },
});
