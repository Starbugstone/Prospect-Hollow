import {
  PERSONAL_AREAS,
  landmarkOffer,
  areaMaximum,
  areaStage,
  monumentWork,
} from '../src/data/townLandmarks.js';
import { createPinia, setActivePinia } from 'pinia';
import { freshProfile, useCampaignStore } from '../src/stores/campaignStore.js';
import { useGameStore } from '../src/stores/gameStore.js';
import { useInventoryStore } from '../src/stores/inventoryStore.js';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator.js';
import { BUILDINGS, BANDIT_EVENT } from '../src/data/town.js';
import { SPACE_HELMET } from '../src/data/townAnimals.js';
import { ERAS } from '../src/data/eras.js';
import { eraIndex } from '../src/game/town/TownEras.js';
import { HOUR_MS, projectRuns } from '../src/game/town/TownRules.js';
import { bonusCapacity, HAMMER_CAPACITY } from '../src/data/rewards.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};
const serverNow = 1780000000000;

function develop(profile, era = ERAS[0].id) {
  profile.town.era = era;
  profile.town.coins = 100000;
  for (const building of BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
    profile.town.buildings[building.id] = building.upgrades.length;
    profile.town.buildingEras[building.id] = era;
    profile.town.buildingEraLevels[building.id] = era === ERAS[0].id ? 0 : 3;
  }
}
function saloon(profile) {
  profile.town.buildings.well = 3;
  profile.town.buildings.farm = 3;
  profile.town.buildings.home = 3;
  profile.town.buildings.saloon = 3;
  profile.town.income.at = serverNow - 4 * HOUR_MS;
}
function incident(profile, protectedTown) {
  develop(profile);
  profile.town.completedRuns = 10;
  profile.town.events[BANDIT_EVENT] = {
    id: 1,
    atRun: 10,
    gangSize: 10,
    sheriffLevel: protectedTown ? 5 : 0,
    bankLevel: protectedTown ? 5 : 0,
    targets: ['mine', 'saloon'],
    outcome: protectedTown ? 'protected' : 'stolen',
    loss: protectedTown ? 0 : 20,
    seen: false,
  };
}

/** Actual frontend actions provide regression inputs for backend rule replay.
 * Setup edits describe an already accepted baseline; only the resulting action
 * journal may account for changes after that baseline.
 */
export function createIntegrityFixtures() {
  const original = {
    now: Date.now,
    random: Math.random,
    crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
  };
  let uuid = 0;
  let seed = 1;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
  });
  Date.now = () => serverNow;
  Math.random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const fixtures = [];
  const expectSuccess = (result, name) => {
    if (result === false || result === null || result === undefined)
      throw new Error(`Fixture action failed: ${name}`);
  };
  const fixture = (name, setup, action) => {
    seed = 12345;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
    setActivePinia(createPinia());
    const baseline = freshProfile();
    setup(baseline);
    const campaign = useCampaignStore();
    campaign.$patch(baseline);
    expectSuccess(campaign.save(), name);
    const before = clone(campaign.profile());
    action(campaign);
    const after = clone(campaign.profile());
    if (!after.integrity.actions.length) throw new Error(`Fixture has no journal: ${name}`);
    fixtures.push({ name, before, after, serverNow });
    campaign.endRun(campaign.activeRun);
  };
  const victory = (campaign, options = {}, level = generateLevelConfigs()[0]) => {
    const runId = campaign.beginRun('normal', level.id);
    const rewards = campaign.recordVictory({
      id: level.id,
      runId,
      score: level.chestTarget,
      target: level.chestTarget,
      starTarget: level.starScoreTarget,
      combo: 4,
      elapsedMs: level.speedTargetMs + 3600000,
      speedTargetMs: level.speedTargetMs,
      jewels: 217,
      bonusGems: 2,
      comboCounts: { 2: 3, 5: 1 },
      multiMatchCounts: { 2: 2 },
      ...options,
    });
    if (!rewards.length) throw new Error('Fixture victory was not settled.');
    return rewards;
  };
  try {
    fixture(
      'victory after 175 moves and an expired speed target',
      () => {},
      (campaign) => {
        const game = useGameStore();
        game.bootstrap();
        expectSuccess(game.startLevel(1), 'long victory start');
        game.moves = 175;
        game.remainingLayers = 0;
        game.playClock.started = true;
        game.playClock.elapsed = game.speedTargetMs + 3600000;
        game.score = game.starScoreTarget * 2;
        game.maxCascade = 5;
        game.collectedJewels = 1200;
        game.completeLevel();
        if (!campaign.records[1]) throw new Error('Long puzzle did not complete.');
        game.cancelHint(true);
        game.exitLevel();
      },
    );
    fixture(
      'run start saved while the puzzle is active',
      () => {},
      (campaign) => {
        expectSuccess(campaign.beginRun('normal', 1), 'run start');
      },
    );
    fixture(
      'chosen chest reward and victory shop refresh',
      (profile) => {
        profile.town.buildings.shop = 1;
      },
      (campaign) => {
        const [chest] = victory(campaign, { chooseRewards: true });
        expectSuccess(campaign.claimChest(chest.id, 'coins'), 'chosen chest');
      },
    );
    fixture(
      'reload settles a full-bag forced coin chest without changing its pity counter',
      (profile) => {
        profile.builderHammers = HAMMER_CAPACITY;
        profile.chestsWithoutBuilderHammer = 9;
        for (const power of profile.powers) power.quantity = bonusCapacity(profile.town);
      },
      (campaign) => {
        victory(campaign, { chooseRewards: true });
        campaign.reloadLocal();
        if (campaign.pendingChests.length)
          throw new Error('Reload did not settle the saved chest.');
      },
    );
    fixture(
      'shop purchase uses its real price and inventory quantity',
      (profile) => {
        profile.town.coins = 1000;
        profile.town.buildings.shop = 1;
        profile.shopVisit = 1;
        profile.shopStock = [{ id: 'clear-row', sold: false }];
      },
      (campaign) => expectSuccess(campaign.buyShopItem('clear-row', 1), 'shop purchase'),
    );
    fixture(
      'first free building and a paid construction purchase',
      (profile) => {
        profile.town.coins = 10000;
      },
      (campaign) => {
        for (const id of ['well', 'farm', 'home'])
          expectSuccess(campaign.upgradeBuilding(id, 0), id);
        expectSuccess(campaign.upgradeBuilding('home', 1), 'paid house construction');
      },
    );
    fixture(
      'finish ready normal construction',
      (profile) => {
        profile.town.buildings.home = 1;
        profile.town.projects.home = { id: 'home', stage: 2, wins: 1, required: 1 };
      },
      (campaign) => expectSuccess(campaign.finishConstruction('home', 2), 'finish house'),
    );
    fixture(
      'builder hammer finishes a new stage',
      (profile) => {
        profile.town.buildings.home = 1;
        profile.builderHammers = 1;
      },
      (campaign) => expectSuccess(campaign.useBuilderHammer('home', 1), 'hammer house'),
    );
    fixture(
      'modernization purchase uses its era price',
      (profile) => {
        develop(profile, 'river-rail');
        profile.town.buildingEras.well = 'frontier';
        profile.town.buildingEraLevels.well = 0;
      },
      (campaign) => expectSuccess(campaign.upgradeBuilding('well', 3), 'modernize well'),
    );
    fixture(
      'finish ready modernization keeps functional services',
      (profile) => {
        develop(profile, 'river-rail');
        profile.town.buildingEras.well = 'frontier';
        profile.town.buildingEraLevels.well = 0;
        profile.town.projects.well = {
          id: 'well',
          type: 'modernization',
          stage: 3,
          fromEra: 'frontier',
          targetEra: 'river-rail',
          eraLevel: 1,
          wins: 2,
          required: 2,
          cost: 800,
        };
      },
      (campaign) => expectSuccess(campaign.finishConstruction('well', 3), 'finish modernization'),
    );
    fixture(
      'forge collection grants one TNT',
      (profile) => {
        profile.town.buildings.blacksmith = 1;
        profile.town.forge = { progress: 0, charge: 1 };
      },
      (campaign) => expectSuccess(campaign.collectForgeTNT(), 'forge'),
    );
    fixture('saloon collection preserves four offline hours', saloon, (campaign) => {
      if (campaign.collectSaloonIncome() <= 0) throw new Error('Offline income was not collected.');
    });
    fixture('visitor reserve collection and a VIP purchase', saloon, (campaign) => {
      expectSuccess(campaign.collectSaloonForVisitor(serverNow - 1000), 'visitor collection');
      if (
        campaign.collectVipSpending({
          tour: 'fixture-tour',
          stop: 0,
          building: 'saloon',
          visitor: { vip: true },
        }) !== 5
      )
        throw new Error('VIP did not spend the ordinary reward.');
    });
    fixture(
      'space helmet found once for its completed puzzle',
      (profile) => {
        develop(profile, SPACE_HELMET.debut);
        profile.town.completedRuns = 12;
        profile.town.helmetRun = 11;
      },
      (campaign) => {
        if (!(campaign.findSpaceHelmet() > 0)) throw new Error('The helmet paid nothing.');
        if (campaign.findSpaceHelmet() !== null) throw new Error('The helmet paid twice.');
      },
    );
    fixture(
      'raid bell refund and ordinary raid acknowledgment',
      (profile) => {
        incident(profile, false);
      },
      (campaign) => {
        expectSuccess(campaign.ringTownBell(1), 'raid bell');
        expectSuccess(campaign.markRaidSeen(1), 'raid seen');
      },
    );
    fixture(
      'protected raid bounty and rescheduling retain the seen receipt',
      (profile) => {
        incident(profile, true);
      },
      (campaign) => {
        expectSuccess(campaign.markRaidSeen(1), 'capture bounty');
        campaign.resolveBandits();
        if (campaign.town.nextRaidRun === null) throw new Error('The next raid was not scheduled.');
      },
    );
    fixture(
      'continuous mode grants its existing economic reward',
      (profile) => {
        profile.town.buildings.museum = 1;
        profile.records[1] = { score: 1, stars: 1 };
      },
      (campaign) => {
        const runId = campaign.beginRun('continuous', 1);
        expectSuccess(
          campaign.recordContinuous({ id: 1, runId, jewels: 250, score: 10000 }),
          'continuous',
        );
        expectSuccess(
          campaign.recordContinuous({ id: 1, runId, jewels: 250, score: 20000 }),
          'continuous score after its economic reward',
        );
      },
    );
    fixture(
      'the first continuous score before ten jewels grants no coins',
      (profile) => {
        profile.town.buildings.museum = 1;
        profile.records[1] = { score: 1, stars: 1 };
      },
      (campaign) => {
        const runId = campaign.beginRun('continuous', 1);
        expectSuccess(
          campaign.recordContinuous({ id: 1, runId, jewels: 3, score: 300 }),
          'continuous score',
        );
      },
    );
    fixture(
      'era progression uses the shared next-era gate',
      (profile) => develop(profile),
      (campaign) => {
        expectSuccess(campaign.advanceEra('frontier'), 'era advance');
      },
    );
    fixture(
      'new cozy era plot uses the shared purchase lifecycle',
      (profile) => {
        const era = ERAS.find((entry) => entry.id === 'canopy') ?? ERAS.at(-1);
        develop(profile, era.id);
        const building = BUILDINGS.find((entry) => entry.introducedEra === era.id);
        if (!building) throw new Error('No current era plot is available to verify.');
        profile.town.buildings[building.id] = 0;
        profile.town.buildingEraLevels[building.id] = 0;
      },
      (campaign) => {
        const building = BUILDINGS.find(
          (entry) =>
            entry.introducedEra === campaign.town.era && !campaign.town.buildings[entry.id],
        );
        expectSuccess(campaign.upgradeBuilding(building.id, 0), 'cozy plot');
      },
    );
    fixture(
      'consuming a stored power records one deduction',
      (profile) => {
        profile.powers.find((power) => power.id === 'tnt').quantity = 1;
      },
      () => expectSuccess(useInventoryStore().consumeItem('tnt'), 'power spend'),
    );
    fixture(
      'finishing the sheriff fully defends a waiting raid',
      (profile) => {
        incident(profile, false);
        const event = profile.town.events[BANDIT_EVENT];
        // Receipts keep service levels: a level-2 sheriff covers 4 riders, a finished one 10.
        Object.assign(event, { sheriffLevel: 2, bankLevel: 5, outcome: 'stolen', loss: 15 });
        profile.town.buildings.sheriff = 2;
        profile.town.income.at = serverNow;
        const required = projectRuns('sheriff', 3);
        profile.town.projects.sheriff = { id: 'sheriff', stage: 3, wins: required, required };
      },
      (campaign) => {
        expectSuccess(campaign.finishConstruction('sheriff', 3), 'sheriff');
        if (campaign.town.events[BANDIT_EVENT].outcome !== 'protected')
          throw new Error('Full cover did not protect the waiting raid.');
      },
    );
    fixture(
      'a continuous score without coins is followed by another run',
      (profile) => {
        profile.town.buildings.museum = 1;
        profile.records[1] = { score: 1, stars: 1 };
      },
      (campaign) => {
        const runId = campaign.beginRun('continuous', 1);
        expectSuccess(
          campaign.recordContinuous({ id: 1, runId, jewels: 3, score: 300 }),
          'continuous score',
        );
        campaign.endRun(runId);
        campaign.beginRun('normal', 2);
      },
    );
    fixture(
      'an older saloon starts its income once before collecting',
      (profile) => {
        saloon(profile);
        profile.town.income = { at: null, stored: 0, remainder: 0 };
      },
      (campaign) => {
        campaign.accrueSaloonIncome(serverNow - 2 * HOUR_MS);
        if (campaign.collectSaloonIncome(serverNow) <= 0)
          throw new Error('Income since the first checkpoint was not collected.');
      },
    );
    fixture(
      'an era advance after the cloud saw the last transition pending',
      (profile) => {
        develop(profile, 'river-rail');
        profile.town.transition = {
          id: 'frontier:river-rail',
          from: 'frontier',
          to: 'river-rail',
          pending: true,
        };
      },
      (campaign) => {
        expectSuccess(campaign.acknowledgeEra(), 'era cinematic');
        expectSuccess(campaign.advanceEra('river-rail'), 'era advance');
      },
    );
    fixture(
      'offline Town Honours: claimed victories, a forge collection and a protected raid',
      (profile) => {
        incident(profile, true);
        profile.town.forge = { progress: 0, charge: 1 };
        // Levels 55 and 56 hold relics, which the server credits from the level itself.
        for (let id = 1; id < 55; id++) profile.records[id] = { score: 1, stars: 1 };
      },
      (campaign) => {
        expectSuccess(campaign.markRaidSeen(1), 'protected raid seen');
        expectSuccess(campaign.collectForgeTNT(), 'forge');
        const levels = generateLevelConfigs();
        victory(
          campaign,
          { tally: { gems: { ruby: 120, topaz: 40 }, fusions: { 'bomb+cross': 1 } } },
          levels[54],
        );
        victory(
          campaign,
          { tally: { gems: { ruby: 30, sapphire: 20 }, fusions: { 'cross+cross': 2 } } },
          levels[55],
        );
      },
    );
    for (const area of PERSONAL_AREAS)
      fixture(
        `optional landmark ${area.id}: construction and upgrades`,
        (profile) => {
          // Earlier landmarks keep their Riverlight fixture; later ones need their own era.
          develop(profile, eraIndex(area.era) > eraIndex('riverlight') ? area.era : 'riverlight');
          profile.town.coins = 10000000;
        },
        (campaign) => {
          const buy = (choice) => {
            const offer = landmarkOffer(campaign.town, area, choice);
            expectSuccess(
              campaign.personalise([
                {
                  kind: 'area',
                  id: area.id,
                  slot: 0,
                  value: choice,
                  expectedChoice: offer.expectedChoice,
                  expectedLevel: offer.expectedLevel,
                },
              ]),
              'landmark purchase',
            );
          };
          // Completed puzzles build each level; the player unveils it before the next.
          const build = () => {
            const work = monumentWork(campaign.town, area);
            for (let n = work.wins; n < work.required; n++) victory(campaign);
            expectSuccess(campaign.unveilMonument(area.id, work.level), 'monument unveiling');
          };
          buy(area.choices[0]);
          build();
          while (areaStage(campaign.town, area) < areaMaximum(campaign.town, area)) {
            buy(area.choices[0]);
            build();
          }
        },
      );
    return { version: 1, fixtures };
  } finally {
    Date.now = original.now;
    Math.random = original.random;
    for (const key of ['crypto', 'localStorage', 'sessionStorage']) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete globalThis[key];
    }
  }
}
