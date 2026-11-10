import { readFileSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSeed } from '../src/game/engine/gameRandom';
import { HintEngine } from '../src/game/engine/HintEngine';
import { replayRun, runFingerprint, runReport } from '../src/stores/game/runLog';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';

const hints = new HintEngine();

function fresh(level) {
  setActivePinia(createPinia());
  const campaign = useCampaignStore();
  campaign.records = Object.fromEntries(
    Array.from({ length: level - 1 }, (_, i) => [i + 1, { score: 1, stars: 1 }]),
  );
  const game = useGameStore();
  game.bootstrap();
  return game;
}

async function play(game, turns) {
  for (let turn = 0; turn < turns && !game.levelCleared; turn++) {
    const move = hints.findBestMove(game.board, game.tiles, game.boardCols, game.boardRows, {
      oreOrders: game.oreOrders,
    });
    if (!move) {
      await game.ensurePlayableBoard();
      continue;
    }
    await game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
      activateInPlace: !!move.activateInPlace,
    });
  }
}

beforeEach(() => useSeed(null));

describe('a puzzle replays exactly from its seed and moves', () => {
  it.each([3, 12, 30, 60])('level %i, through cascades and new gems', async (level) => {
    const live = fresh(level);
    expect(live.startLevel(level)).toBe(true);
    await play(live, 25);
    const log = JSON.parse(JSON.stringify(runReport(live)));
    expect(log.actions.length).toBeGreaterThan(2);
    const again = fresh(level);
    expect(await replayRun(again, log)).toBe(log.fingerprint);
  });

  it('leaves out a power the board refused, so the log still replays', async () => {
    const live = fresh(55);
    expect(live.startLevel(55, 'normal', { seed: 11 })).toBe(true);
    const relic = live.board.findIndex((gem) => gem?.type === 'relic');
    expect(relic).toBeGreaterThanOrEqual(0);
    // A color wand has no color to take from a relic: the power is refused and not spent.
    expect(await live._activatePower('color-wand', relic, false)).toBe(false);
    expect(live.runLog.actions).toEqual([]);
    const target = live.board.findIndex((gem) => gem && gem.type !== 'relic');
    expect(await live._activatePower('tnt', target, false)).toBe(true);
    expect(live.runLog.actions).toEqual([{ type: 'power', name: 'tnt', index: target }]);
    const log = JSON.parse(JSON.stringify(runReport(live)));
    const again = fresh(55);
    expect(await replayRun(again, log)).toBe(log.fingerprint);
  });

  it('replays the player shuffle and powers, which roll the same dice', async () => {
    const live = fresh(12);
    // A fixed seed: about one in ten clears level 12 before the shuffle, and a cleared level
    // refuses one.
    expect(live.startLevel(12, 'normal', { seed: 12 })).toBe(true);
    await play(live, 4);
    expect(await live.activateOneTimeBonus('clear-row')).toBe(true);
    await play(live, 2);
    useCampaignStore().powers.find((power) => power.id === 'shuffle').quantity = 1;
    expect(await live.shuffleBoard({ consume: 'shuffle' })).toBe(true);
    await live.ensurePlayableBoard();
    await play(live, 2);
    const log = JSON.parse(JSON.stringify(runReport(live)));
    expect(log.actions.map((action) => action.type)).toEqual(
      expect.arrayContaining(['one-time', 'shuffle', 'swap']),
    );
    const again = fresh(12);
    expect(await replayRun(again, log)).toBe(log.fingerprint);
  });

  it('gives another seed another game, so the fingerprint really tracks the dice', async () => {
    const live = fresh(12);
    live.startLevel(12);
    await play(live, 20);
    const log = runReport(live);
    const other = fresh(12);
    other.startLevel(12, undefined, { seed: (log.seed + 1) >>> 0 });
    await play(other, 20);
    expect(runFingerprint(other)).not.toBe(log.fingerprint);
  });

  it('refuses a log from a puzzle moved over from another tab', async () => {
    await expect(replayRun(fresh(1), { resumed: true, actions: [] })).rejects.toThrow(
      /no replayable start/,
    );
  });

  it('notices when a move in the log is refused', async () => {
    const game = fresh(1);
    await expect(
      replayRun(game, {
        level: 1,
        mode: 'normal',
        seed: 1,
        actions: [{ type: 'swap', a: 0, b: 63 }],
      }),
    ).rejects.toThrow(/diverged/);
  });

  it('plays a log from a bug report', async () => {
    const path = process.env.REPLAY_LOG;
    if (!path) return;
    const log = JSON.parse(readFileSync(path, 'utf8'));
    expect(await replayRun(fresh(log.level), log)).toBe(log.fingerprint);
  });
});

describe('the dice rule', () => {
  it('keeps Math.random out of puzzle rules', async () => {
    const { ESLint } = await import('eslint');
    const eslint = new ESLint();
    const lint = async (filePath, code) =>
      (await eslint.lintText(code, { filePath }))[0].messages.filter(
        (message) => message.ruleId === 'no-restricted-properties',
      ).length;
    const roll = 'export const roll = () => Math.random();\n';
    expect(await lint('src/game/engine/Example.js', roll)).toBe(1);
    expect(await lint('src/stores/game/example.js', roll)).toBe(1);
    expect(await lint('src/game/phaser/Sparkle.js', roll)).toBe(0);
  });
});
