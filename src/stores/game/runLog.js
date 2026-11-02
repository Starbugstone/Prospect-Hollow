import { markRaw, toRaw } from 'vue';
import { gameRandom, useSeed } from '../../game/engine/gameRandom';

// A puzzle replays exactly from its level, seed and the player's accepted moves. The log is the bug
// report: `prospectDebug.runLog()`, or Copy this puzzle's run in Settings on preprod.
const SEED_RANGE = 2 ** 32;

export function beginRunLog(store, level, mode, seed = Math.floor(gameRandom() * SEED_RANGE)) {
  useSeed(seed);
  store.runLog = markRaw({ version: 1, level, mode, seed, resumed: false, actions: [] });
}

export function endRunLog(store) {
  useSeed(null);
  store.runLog = null;
}

// A puzzle moved over from another tab has a board this seed didn't produce: it starts a fresh stream,
// and its log says it can't be replayed from the start.
export function resumeRunLog(store) {
  useSeed(Math.floor(gameRandom() * SEED_RANGE));
  store.runLog = markRaw({ version: 1, level: store.currentLevelId, resumed: true, actions: [] });
}

export function logRunAction(store, action) {
  if (!store.runLogMuted) store.runLog?.actions.push(action);
}

// For one action that calls another: runs up to the inner action's first await, which is where it logs.
export function muteRunLog(store, operation) {
  store.runLogMuted = true;
  try {
    return operation();
  } finally {
    store.runLogMuted = false;
  }
}

// Exact board, tiles and score. Gem IDs are left out: they come from a counter shared across runs.
export function runFingerprint(store) {
  const text = JSON.stringify([
    toRaw(store.board).map((gem) => (gem ? { ...gem, id: undefined } : null)),
    toRaw(store.tiles),
    store.score,
    store.moves,
    store.objectives,
    store.oreOrders,
  ]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const runReport = (store) =>
  store.runLog ? { ...store.runLog, fingerprint: runFingerprint(store) } : null;

// A move still animating hasn't reached the board yet, so the fingerprint waits for it.
export async function settledRunReport(store) {
  while (store.runLog && store.animationInProgress)
    await new Promise((resolve) => setTimeout(resolve, 50));
  return runReport(store);
}

// Plays a log back on a store with no renderer. Inventory limits don't apply: powers run without
// spending, because the player's stock isn't part of the board.
export async function replayRun(store, log) {
  if (log.resumed)
    throw new Error('This puzzle was moved from another tab: it has no replayable start.');
  if (!store.startLevel(log.level, log.mode, { seed: log.seed }))
    throw new Error(`Level ${log.level} can't be started here.`);
  for (const action of log.actions) {
    const accepted = await perform(store, action);
    if (!accepted) throw new Error(`Replay diverged: ${JSON.stringify(action)} was refused.`);
  }
  return runFingerprint(store);
}

async function replayShuffle(store) {
  if (!(await store.shuffleBoard())) return false;
  await store.ensurePlayableBoard();
  return true;
}

function perform(store, action) {
  switch (action.type) {
    case 'swap':
      return store.resolveSwap(action.a, action.b, { activateInPlace: action.inPlace });
    case 'power':
      return store._activatePower(action.name, action.index, false);
    case 'one-time':
      return store.activateOneTimeBonus(action.name);
    case 'shuffle':
      return replayShuffle(store);
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}
