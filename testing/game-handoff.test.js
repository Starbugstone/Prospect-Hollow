import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { localProfile } from '../src/services/localProfile';
import { townStorage } from '../src/services/townStorage';
import { HintEngine } from '../src/game/engine/HintEngine';
let games;
beforeEach(() => {
  games = [];
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  for (const game of games) game.cancelHint();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const gameStore = () => {
  const game = useGameStore();
  games.push(game);
  return game;
};
function transfer(game) {
  const snapshot = game.captureHandoff();
  expect(useCampaignStore().save()).toBe(true);
  townStorage.handoff(snapshot);
  const resume = localProfile.suspendWrites();
  game.exitLevel();
  resume();
  setActivePinia(createPinia());
  const next = gameStore();
  useCampaignStore();
  next.bootstrap();
  next.comboCounts.stale = 999;
  next.currentBoardLayout.stale = true;
  next.restoreHandoff(townStorage.handoff());
  expect(next.comboCounts.stale).toBeUndefined();
  expect(next.currentBoardLayout.stale).toBeUndefined();
  townStorage.handoff(null);
  return next;
}
it('resumes the exact board beyond 100 moves and the speed target, without issuing a new run', async () => {
  const game = gameStore();
  game.bootstrap();
  game.startLevel(1);
  game.moves = 105;
  game.score = 500;
  game.playClock.elapsed = game.speedTargetMs + 60000;
  game.playClock.started = true;
  const runId = game.runId,
    board = JSON.parse(JSON.stringify(game.board));
  const next = transfer(game);
  expect(next.board).toEqual(board);
  expect(next.score).toBe(500);
  expect(next.moves).toBe(105);
  expect(next.elapsedMs).toBeGreaterThan(next.speedTargetMs);
  expect(next.runId).toBe(runId);
  expect(useCampaignStore().issuedRun).toBe(runId);
  expect(useCampaignStore().activeRun).toBe(runId);
  next.inputPaused = false;
  const hint = new HintEngine().findBestMove(
    next.board,
    next.tiles,
    next.boardCols,
    next.boardRows,
  );
  await next.resolveSwap(hint.swap.aIndex, hint.swap.bIndex);
  expect(next.moves).toBe(106);
  expect(next.sessionActive).toBe(true);
  next.remainingLayers = 0;
  next.completeLevel();
  expect(next.levelCleared).toBe(true);
  const coins = useCampaignStore().town.coins;
  next.completeLevel();
  expect(useCampaignStore().town.coins).toBe(coins);
});
it('does not snapshot a half-committed move', () => {
  const game = gameStore();
  game.bootstrap();
  game.startLevel(1);
  game.animationInProgress = true;
  expect(() => game.captureHandoff()).toThrow('still finishing');
  expect(game.sessionActive).toBe(true);
});
it('does not award a completed puzzle twice after transfer', () => {
  const game = gameStore();
  game.bootstrap();
  game.startLevel(1);
  game.remainingLayers = 0;
  game.completeLevel();
  const next = transfer(game),
    campaign = useCampaignStore();
  const coins = campaign.town.coins,
    settled = campaign.settledRun;
  expect(next.levelCleared).toBe(true);
  expect(campaign.activeRun).toBeNull();
  next.completeLevel();
  expect(campaign.town.coins).toBe(coins);
  expect(campaign.settledRun).toBe(settled);
});
it('preserves continuous mine earnings without crediting the same jewels again', () => {
  const campaign = useCampaignStore();
  campaign.records[1] = { score: 10, stars: 1 };
  campaign.town.buildings.museum = 1;
  const game = gameStore();
  game.bootstrap();
  game.startLevel(1, 'continuous');
  expect(game.sessionActive).toBe(true);
  game.collectedJewels = 25;
  game.score = 100;
  game.syncContinuous();
  const coins = campaign.town.coins,
    credited = campaign.continuousRun.credited;
  const next = transfer(game);
  next.syncContinuous();
  expect(next.playMode).toBe('continuous');
  expect(useCampaignStore().town.coins).toBe(coins);
  expect(useCampaignStore().continuousRun.credited).toBe(credited);
});
it('rejects a stale puzzle snapshot from a different run', () => {
  const game = gameStore();
  game.bootstrap();
  game.startLevel(1);
  const snapshot = game.captureHandoff();
  useCampaignStore().issuedRun++;
  expect(() => game.restoreHandoff(snapshot)).toThrow('saved copy has been kept');
});

it('recovers a transferred mine renderer without replaying the intro or leaving input blocked', () => {
  const game = gameStore();
  game.bootstrap();
  game.startLevel(1);
  const next = transfer(game);
  const audio = { playAmbientLoop: vi.fn() };
  next.setAudioManager(audio);
  expect(audio.playAmbientLoop).toHaveBeenCalledOnce();
  next.setAudioManager(audio);
  expect(audio.playAmbientLoop).toHaveBeenCalledOnce();
  const board = JSON.parse(JSON.stringify(next.board));
  const runId = next.runId;
  vi.spyOn(next, 'refreshBoardVisuals').mockImplementation(() => {});
  vi.spyOn(next, 'scheduleHint').mockImplementation(() => {});
  vi.spyOn(next, 'clearBonusPreview').mockImplementation(() => {});
  const queued = vi.spyOn(next, 'processQueuedInput').mockImplementation(() => {});
  next.rendererRecovering = true;
  next.animationInProgress = true;
  next.attachRenderer({ scene: {}, boardContainer: {} });
  expect(next.animationInProgress).toBe(false);
  expect(next.rendererRecovering).toBe(false);
  expect(next.introFinalized).toBe(next.sessionVersion);
  expect(queued).toHaveBeenCalledOnce();
  expect(next.board).toEqual(board);
  expect(next.runId).toBe(runId);
  expect(audio.playAmbientLoop).toHaveBeenCalledOnce();
});
