import { version as contentVersion } from '../../backend/content/game.json';
import { reactive } from 'vue';
import { MatchEngine } from '../game/engine/MatchEngine';

import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { locale } from '../i18n';

const matchEngine = new MatchEngine();

export const cloud = reactive({
  ready: false,
  accountBusy: false,
  busy: false,
  status: 'Connecting',
  error: '',
  csrf: '',
  playerId: '',
  revision: 0,
  linked: false,
  community: { listed: false, villageName: '' },
  run: null,
  pending: false,
});
const PREFIX = 'prospect-cloud-command:';
let queue = Promise.resolve();
let identityEpoch = 0;
let campaign, game;
let installed = false;
export async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
  const epoch = identityEpoch;
  const response = await fetch(`/api/v1/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'X-CSRF-Token': cloud.csrf,
      ...(path === 'actions'
        ? { 'X-Player-Id': cloud.playerId, 'X-Content-Version': contentVersion }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (epoch !== identityEpoch)
    throw new Error('The account changed while this request was in progress.');
  if (!response.ok) {
    const error = new Error(
      value.error?.message ?? value.message ?? value.error ?? 'The request failed.',
    );
    error.status = response.status;
    throw error;
  }
  if (value.csrf) cloud.csrf = value.csrf;
  return value;
}
function applyProfile(result) {
  if (result.playerId !== cloud.playerId || result.revision >= cloud.revision) {
    campaign.$patch(result.profile);
    cloud.playerId = result.playerId;
    cloud.revision = result.revision;
    cloud.linked = result.linked;
    cloud.community = result.profile.community ?? { listed: false, villageName: '' };
    if (result.locale) locale.value = result.locale;
  }
  campaign.saveWarning = '';
  cloud.status = 'Saved';
  try {
    localStorage.setItem(
      `prospect-cloud-cache:${cloud.playerId}`,
      JSON.stringify({ profile: result.profile, revision: result.revision }),
    );
  } catch {
    /* cache is optional */
  }
}
export async function refresh() {
  const epoch = identityEpoch;
  const result = await request('profile');
  if (epoch !== identityEpoch) throw new Error('The account changed.');
  if (cloud.playerId && result.playerId !== cloud.playerId) {
    identityEpoch++;
    game.exitLevel();
    cloud.run = null;
  }
  if (result.contentVersion && result.contentVersion !== contentVersion)
    throw new Error('The game has been updated. Reload this page before continuing.');
  if (result.playerId === cloud.playerId && result.revision < cloud.revision)
    return { ...result, run: cloud.run };
  applyProfile(result);
  cloud.run = result.run;
  cloud.pending = pendingCommands().length > 0;
  if (game.sessionActive && !game.levelCleared && !game.animationInProgress) {
    if (result.run?.runId === game.runId) applyRun(result.run);
    else game.exitLevel();
  }
  return result;
}
function pendingCommands() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(PREFIX))
    .map((key) => {
      try {
        return { ...JSON.parse(localStorage.getItem(key)), key };
      } catch {
        return null;
      }
    })
    .filter(
      (entry) =>
        entry?.playerId === cloud.playerId &&
        entry.body &&
        entry.key === PREFIX + entry.body.actionId &&
        /^[a-zA-Z0-9-]{16,64}$/.test(entry.body.actionId) &&
        Number.isSafeInteger(entry.body.revision) &&
        entry.body.revision >= 0 &&
        typeof entry.body.type === 'string' &&
        entry.body.args &&
        typeof entry.body.args === 'object' &&
        !Array.isArray(entry.body.args),
    )
    .sort((a, b) => a.body.revision - b.body.revision);
}
async function deliver(entry) {
  const epoch = identityEpoch;
  if (entry.playerId !== cloud.playerId)
    throw new Error('This pending action belongs to a different village.');
  try {
    const result = await request('actions', entry.body);
    localStorage.removeItem(entry.key);
    applyProfile(result);
    cloud.pending = pendingCommands().length > 0;
    return result;
  } catch (error) {
    if (epoch !== identityEpoch || entry.playerId !== cloud.playerId) throw error;
    if (error.status && error.status < 500 && ![401, 403, 429].includes(error.status)) {
      localStorage.removeItem(entry.key);
      cloud.pending = pendingCommands().length > 0;
      if (error.status === 409) {
        await refresh();
      }
    } else {
      cloud.pending = true;
      cloud.status = 'Waiting for connection';
    }
    throw error;
  }
}
export function retryPending() {
  if (cloud.busy || cloud.accountBusy) return Promise.resolve();
  const epoch = identityEpoch;
  const operation = queue.then(async () => {
    if (cloud.accountBusy || epoch !== identityEpoch) return;
    cloud.busy = true;
    try {
      await refresh();
      for (const entry of pendingCommands()) {
        const saved = await deliver(entry);
        if (saved.run && game.sessionActive && saved.revision >= cloud.revision)
          applyRun(saved.run);
      }
      await refresh();
      cloud.pending = false;
      cloud.error = '';
    } catch (error) {
      if (epoch === identityEpoch) cloud.error = error.message;
    } finally {
      if (epoch === identityEpoch) cloud.busy = false;
    }
  });
  queue = operation.catch(() => {});
  return operation;
}
export function command(type, args = {}) {
  const owner = cloud.playerId;
  const epoch = identityEpoch;
  if (cloud.accountBusy) return Promise.reject(new Error('Wait for the account change to finish.'));
  const operation = queue.then(async () => {
    if (owner !== cloud.playerId || epoch !== identityEpoch)
      throw new Error('The account changed before this action was sent.');
    if (cloud.pending) throw new Error('Retry the pending save before making another move.');
    cloud.busy = true;
    cloud.status = 'Saving';
    cloud.error = '';
    const body = { actionId: crypto.randomUUID(), revision: cloud.revision, type, args };
    const entry = { key: PREFIX + body.actionId, playerId: cloud.playerId, body };
    // If durable queuing is unavailable, do not send a mutation we cannot safely retry.
    localStorage.setItem(entry.key, JSON.stringify(entry));
    return deliver(entry);
  });
  queue = operation
    .catch(() => {})
    .finally(() => {
      cloud.busy = false;
    });
  return operation.catch((error) => {
    if (epoch !== identityEpoch || owner !== cloud.playerId) throw error;
    cloud.error = error.message;
    if (!cloud.pending) cloud.status = 'Not saved';
    throw error;
  });
}
const safely = async (type, args) => {
  try {
    return await command(type, args);
  } catch {
    return false;
  }
};
export function applyRun(run) {
  if (!run) return;
  if (!['active', 'completed'].includes(run.status)) {
    game.exitLevel();
    cloud.run = null;
    return;
  }
  cloud.run = run.status === 'active' ? run : null;
  game.bootstrap();
  const config = game.availableLevels.find((l) => l.id === run.level)?.config;
  if (!config) throw new Error('This mine needs a newer version of the game.');
  const starting = !game.sessionActive || game.runId !== run.runId;
  if (starting) {
    game.sessionVersion++;
    game.renderer?.animator?.clear();
    game.renderer?.input?.reset();
    game.playClock.reset();
    game.cascadeMultiplier = 1;
    game.arcadeImpact = null;
    game.arcadeBanner = null;
    game.reshuffleNotice = null;
    game.clearBonusPreview(true);
  }
  game.$patch({
    sessionActive: true,
    runId: run.runId,
    currentLevelId: run.level,
    playMode: run.mode,
    board: run.board,
    tiles: run.tiles,
    boardCols: run.cols,
    boardRows: run.rows,
    boardSize: run.cols,
    currentBoardLayout: config.boardLayout,
    objectives: config.objectives.map((o) => ({ ...o })),
    totalLayers: run.totalLayers,
    remainingLayers: run.remainingLayers,
    totalRelics: run.totalRelics,
    oreOrders: run.oreOrders ?? [],
    score: run.score,
    moves: run.moves,
    collectedJewels: run.jewels,
    maxCascade: run.maxCascade,
    comboCounts: run.comboCounts ?? {},
    multiMatchCounts: run.multiMatchCounts ?? {},
    levelCleared: run.cleared,
    animationInProgress: false,
    pendingBoardState: null,
    queuedSwap: null,
    queuedBonus: null,
    activeBonusMode: null,
    speedTargetMs: config.speedTargetMs,
    elapsedMs: Math.max(0, Date.now() - run.startedAt * 1000),
    levelRewards: run.receipt?.chests ?? [],
    coinReward: run.receipt?.coins ?? 0,
    constructionReward: run.receipt?.construction ?? [],
  });
  campaign.activeRun = run.cleared ? null : run.runId;
  campaign.lastConstruction = run.receipt?.construction ?? [];
  campaign.lastChapterReward = run.receipt?.chapterReward ?? null;
  game.remainingBonusGems = run.board.filter((gem) =>
    ['bomb', 'cross', 'rainbow'].includes(gem?.type),
  ).length;
  if (game.renderer?.animator) game.renderer.animator.boardLayout = config.boardLayout;
  game.updateObjectives({ reset: true });
  game.boardVersion++;
  game.refreshBoardVisuals(true);
  game.cancelHint(true);
  if (!run.cleared) game.scheduleHint();
}
export function installCloudAdapters() {
  if (installed) return;
  installed = true;
  campaign = useCampaignStore();
  game = useGameStore();
  // All progress mutations are replaced. Presentation methods may still mutate local UI flags.
  const townActions = {
    upgradeBuilding: (id, stage) => ['town.upgrade', { id, stage }],
    finishConstruction: (id, stage) => ['town.finish', { id, stage }],
    useBuilderHammer: (id, stage) => ['town.hammer', { id, stage }],
    buyShopItem: (id, visit) => ['shop.buy', { id, visit }],
    advanceEra: (era) => ['town.era', { era }],
    acknowledgeEra: () => ['town.era-seen', {}],
    acknowledgeFirstLights: () => ['town.lights', {}],
    acknowledgePresentation: (id) => ['town.presentation-seen', { id }],
    finishTownTour: () => ['town.tour', {}],
    markRaidSeen: (id) => ['town.raid-seen', { id }],
    collectForgeTNT: () => ['town.collect', { source: 'blacksmith' }],
  };
  for (const [name, build] of Object.entries(townActions))
    campaign[name] = (...args) => safely(...build(...args));
  campaign.collectSaloonIncome = async () => {
    const before = campaign.town.coins;
    return (await safely('town.collect', { source: 'saloon' })) ? campaign.town.coins - before : 0;
  };
  let lastSync = 0;
  campaign.accrueSaloonIncome = () => {
    if (
      !cloud.ready ||
      cloud.busy ||
      cloud.pending ||
      game.sessionActive ||
      Date.now() - lastSync < 30000
    )
      return 0;
    lastSync = Date.now();
    const epoch = identityEpoch;
    const operation = queue.then(async () => {
      if (epoch !== identityEpoch || cloud.accountBusy || cloud.pending) return;
      await refresh();
    });
    queue = operation.catch(() => {});
    return 0;
  };
  campaign.save = () => false;
  campaign.resolveBandits = () => false;
  campaign.ringTownBell = () => false;
  campaign.resetProgress = () => false;
  campaign.importSave = () => {
    throw new Error('Local saves stay in local demo mode. They cannot replace a cloud village.');
  };
  campaign.awardReward = () => false;
  campaign.recordVictory = () => [];
  campaign.recordContinuous = () => false;
  campaign.beginRun = () => null;
  campaign.endRun = () => {};
  campaign.ensureShopStock = () => {};
  campaign.claimChest = (id) =>
    game.levelRewards.find((chest) => chest.id === id)?.items[0] ?? null;
  campaign.settlePendingChests = () => [];
  // Pure presentation preference; does not grant any gameplay benefit.
  campaign.markObstaclesSeen = (ids) => {
    campaign.seenObstacles = [...new Set([...campaign.seenObstacles, ...ids])];
  };
  game.startLevel = async (level, mode = 'normal') => {
    if (cloud.busy || cloud.pending) return false;
    const result = await safely('run.start', { level, mode });
    if (!result) return false;
    applyRun(result.run);
    return true;
  };
  const localExit = game.exitLevel.bind(game);
  game.exitLevel = () => {
    localExit();
  }; // Saved active runs survive navigation/reload; explicit abandon below.
  game.syncRunClock = () => {
    if (cloud.run && game.sessionActive)
      game.elapsedMs = Math.max(0, Date.now() - cloud.run.startedAt * 1000);
  };
  game.completeLevel = () => {};
  game.syncContinuous = () => {};
  game.ensurePlayableBoard = async () => false;
  game.commitResolution = () => {};
  game._applyScoring = () => 0;
  game.shuffleBoard = async () => false;
  game.activateOneTimeBonus = async () => false;
  const execute = async (type, args) => {
    if (
      !game.sessionActive ||
      game.levelCleared ||
      game.inputPaused ||
      game.animationInProgress ||
      cloud.busy ||
      cloud.pending ||
      cloud.accountBusy
    )
      return false;
    game.animationInProgress = true;
    game.cancelHint(true);
    game.clearBonusPreview(true);
    const session = game.sessionVersion;
    const epoch = identityEpoch;
    const current = () => session === game.sessionVersion && epoch === identityEpoch;
    const reconcile = () => {
      if (cloud.run?.runId === game.runId) applyRun(cloud.run);
      else game.exitLevel();
    };
    const animator = game.renderer?.animator;
    const swap = type === 'run.move' && !args.activate;
    const payload = { aIndex: args.a, bIndex: args.b };
    try {
      // Local validation only avoids round trips for obvious mis-swaps. The server
      // independently validates every submitted move and generates every refill.
      if (type === 'run.move') {
        const evaluation = args.activate
          ? matchEngine.evaluateActivation(
              game.board,
              game.boardCols,
              game.boardRows,
              args.a,
              game.tiles,
            )
          : matchEngine.evaluateSwap(
              game.board,
              game.boardCols,
              game.boardRows,
              args.a,
              args.b,
              game.tiles,
            );
        if (!evaluation.matches.length) {
          try {
            if (swap && matchEngine.areAdjacent(args.a, args.b, game.boardCols))
              await animator?.animateInvalidSwap(payload);
          } catch {
            game.refreshBoardVisuals(true);
          }
          return false;
        }
      }
      // Start reversible visual feedback immediately, overlapping network latency.
      // Catch renderer failures independently so they cannot hide a saved receipt.
      const animation = (async () => {
        try {
          if (swap) await animator?.animateSwap(payload);
        } catch {
          /* repaired below */
        }
      })();
      const saving = safely(type, { runId: game.runId, ...args });
      const [result] = await Promise.all([saving, animation]);
      if (!current()) return false;
      if (result && result.revision < cloud.revision) {
        reconcile();
        return false;
      }
      if (result) {
        try {
          if (animator && !result.run.shuffled && result.run.steps?.length)
            await animator.playSteps(result.run.steps);
        } catch {
          /* final server snapshot repairs presentation */
        }
        if (!current()) return false;
        if (result.revision < cloud.revision) {
          reconcile();
          return false;
        }
        const queuedSwap = game.queuedSwap;
        applyRun(result.run);
        // Preserve one buffered gesture only if its visible gems survive unchanged.
        game.queuedSwap = queuedSwap;
      } else {
        // A conflict may have refreshed the server board while the swap was moving.
        // A lost response keeps its durable ID pending; no speculative progress survives.
        reconcile();
      }
      return !!result;
    } finally {
      if (current()) {
        game.animationInProgress = false;
        if (!cloud.pending && !cloud.accountBusy) game.processQueuedInput();
        if (!game.animationInProgress && !game.levelCleared && game.sessionActive)
          game.scheduleHint();
      }
    }
  };
  game.resolveSwap = (a, b, { activateInPlace = false } = {}) => {
    if (game.animationInProgress && !cloud.pending && !cloud.accountBusy && !activateInPlace)
      return game.queueSwap(a, b);
    return execute('run.move', { a, b, activate: activateInPlace });
  };
  game.resolveBonusClick = (index) => {
    const power = game.activeBonusMode?.replaceAll('_', '-');
    if (!power) return false;
    return execute('run.power', { power, index });
  };
  const inventory = useInventoryStore();
  inventory.consumeItem = () => false;
  inventory.awardPower = () => false;
  inventory.usePowerUp = async (id) => {
    if (!inventory.availableQuantity(id) || cloud.busy || cloud.pending) return false;
    if (['tnt', 'color-wand', 'tile-breaker'].includes(id))
      return game.setBonusMode(id.replaceAll('-', '_'));
    return execute('run.power', { power: id });
  };
}
// Account transitions drain old commands and invalidate every earlier read response.
export async function changeAccount(operation, reload = false) {
  if (!cloud.ready) throw new Error('Wait for your village to connect before changing accounts.');
  if (cloud.accountBusy) throw new Error('An account change is already in progress.');
  cloud.accountBusy = true;
  try {
    await queue;
    identityEpoch++;
    await operation();
    if (reload) {
      location.reload();
      return;
    }
    game.exitLevel();
    cloud.playerId = '';
    cloud.revision = 0;
    cloud.run = null;
    cloud.pending = false;
    await refresh();
    cloud.error = '';
  } finally {
    cloud.accountBusy = false;
  }
}

let bootstrapPromise;
export function bootstrapCloud() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    installCloudAdapters();
    try {
      await refresh();
    } catch (error) {
      if (error.status !== 401) throw error;
      await request('guests', {});
      await refresh();
    }
    cloud.ready = true;
    cloud.pending = pendingCommands().length > 0;
    if (cloud.pending) await retryPending();
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}
