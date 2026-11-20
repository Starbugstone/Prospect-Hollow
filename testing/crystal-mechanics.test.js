import { expect, it } from 'vitest';
import { TileManager } from '../src/game/engine/TileManager';
import { createGem } from '../src/game/engine/GemFactory';

const manager = new TileManager();
const plain = () => ({ type: 'standard', health: 0, state: 'PLAYABLE' });
const fixture = () => {
  const tiles = Array.from({ length: 63 }, plain);
  for (const [index, peer] of [
    [17, 45],
    [45, 17],
  ])
    Object.assign(tiles[index], {
      signal: 'trace',
      signalHealth: 1,
      tracePeer: peer,
      traceFacet: 'diamond',
    });
  tiles[44] = { ...plain(), type: 'blocker', health: 1, maxHealth: 1, bonusOnly: true };
  const board = tiles.map((tile, i) =>
    tile.type === 'blocker'
      ? null
      : createGem(
          ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'][(i + Math.floor(i / 7)) % 5],
        ),
  );
  return {
    tiles,
    board,
    cols: 7,
    rows: 9,
    swap: { aIndex: 10, bIndex: 17 },
    gemTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'],
  };
};
it('copies a swap match to its twin and breaks a remote gate before gravity', () => {
  const input = fixture();
  const result = manager.getResolution({
    ...input,
    matches: [{ type: 'ruby', indices: [16, 17, 18], orientation: 'horizontal' }],
  });
  expect(input.tiles[44].health).toBe(0);
  expect(input.tiles[17].signalHealth).toBe(0);
  expect(input.tiles[45].signalHealth).toBe(0);
  expect(result.steps.flatMap((step) => step.traceCopies ?? [])).toEqual([
    expect.objectContaining({ from: 17, to: 45, targets: [44, 45, 46] }),
  ]);
});
it('does not spend a stamp on a neighbouring match or a direct blast', () => {
  for (const match of [
    { type: 'ruby', indices: [9, 10, 11], orientation: 'horizontal' },
    { type: 'bonus-activation', indices: [17] },
  ]) {
    const input = fixture();
    manager.getResolution({ ...input, matches: [match] });
    expect(input.tiles[17].signalHealth).toBe(1);
    expect(input.tiles[45].signalHealth).toBe(1);
  }
});

it('copies both lines of a T, clips by coordinates, and never fills voids', async () => {
  const { traceCopies } = await import('../src/game/engine/CrystalMechanics');
  const input = fixture();
  input.tiles[46] = { type: 'void', health: 0 };
  const matches = [
    { type: 'ruby', indices: [16, 17, 18], orientation: 'horizontal' },
    { type: 'ruby', indices: [10, 17, 24], orientation: 'vertical' },
  ];
  expect(traceCopies(input.tiles, matches, 7, 9, true)[0].targets).toEqual([44, 45, 38, 52]);
  expect(traceCopies(input.tiles, matches, 7, 9, false)).toEqual([]);
  input.tiles[17].tracePeer = 42;
  input.tiles[42] = { ...input.tiles[45], tracePeer: 17 };
  expect(traceCopies(input.tiles, matches, 7, 9, true)[0].targets).not.toContain(41);
});
it('requires a real swap, so shuffle matches cannot fire stamps', () => {
  const input = fixture();
  manager.getResolution({
    ...input,
    swap: null,
    matches: [{ type: 'ruby', indices: [16, 17, 18], orientation: 'horizontal' }],
  });
  expect(input.tiles[17].signalHealth).toBe(1);
});
it('rejects an unpaired trace facet during authoring', async () => {
  const { parseMineBoard } = await import('../src/data/deepMineLevels');
  expect(() => parseMineBoard('t../.../...', { cols: 3, rows: 3 })).toThrow(/exactly two/);
});

it('does not turn a copied footprint at a lens', () => {
  const input = fixture();
  input.tiles[48] = { type: 'void', health: 0, lens: 'n' };
  input.board[48] = null;
  input.tiles[41] = {
    ...plain(),
    type: 'blocker',
    health: 1,
    maxHealth: 1,
    bonusOnly: true,
    lensOnly: true,
  };
  input.board[41] = null;
  const result = manager.getResolution({
    ...input,
    matches: [{ type: 'ruby', indices: [14, 15, 16, 17, 18, 19, 20], orientation: 'horizontal' }],
  });
  expect(input.tiles[41].health).toBe(1);
  expect(result.steps.flatMap((step) => step.lensBeams ?? [])).toEqual([]);
});

it('consumes simultaneous twins once, and preserves both copied footprints', () => {
  const input = fixture();
  const result = manager.getResolution({
    ...input,
    matches: [
      { type: 'ruby', indices: [16, 17, 18], orientation: 'horizontal' },
      { type: 'sapphire', indices: [38, 45, 52], orientation: 'vertical' },
    ],
  });
  expect(result.steps.flatMap((step) => step.traceCopies ?? [])).toHaveLength(2);
  expect(
    result.steps.flatMap((step) => step.tileUpdates).filter((update) => update.signalHealth === 0),
  ).toHaveLength(2);
});

it('crossgrain needs two distinct axes, and a blast seals only one crack', async () => {
  const { crystalHits } = await import('../src/game/engine/CrystalMechanics');
  const tiles = [{ ...plain(), signal: 'crossgrain', signalHealth: 2, grainRemaining: 3 }];
  const h = { type: 'ruby', indices: [0], orientation: 'horizontal' },
    v = { ...h, orientation: 'vertical' };
  const [first] = crystalHits(tiles, [h], []);
  expect(first.signalHealth).toBe(1);
  Object.assign(tiles[0], first);
  expect(crystalHits(tiles, [h], [])).toEqual([]);
  expect(crystalHits(tiles, [v], [])[0].signalHealth).toBe(0);
  tiles[0].grainRemaining = 3;
  tiles[0].signalHealth = 2;
  expect(crystalHits(tiles, [], [0])[0].signalHealth).toBe(1);
  expect(crystalHits(tiles, [h, v], [])[0].signalHealth).toBe(0);
});

it('chord remembers different colours, ignores repeats and accepts a white wildcard', async () => {
  const { crystalHits } = await import('../src/game/engine/CrystalMechanics');
  const tiles = [{ ...plain(), signal: 'chord', signalHealth: 3, chordColors: '', chordWilds: 0 }];
  const match = (type) => ({ type, indices: [0], orientation: 'horizontal' });
  Object.assign(tiles[0], crystalHits(tiles, [match('ruby')], [])[0]);
  expect(tiles[0].signalHealth).toBe(2);
  expect(crystalHits(tiles, [match('ruby')], [])).toEqual([]);
  Object.assign(tiles[0], crystalHits(tiles, [], [0])[0]);
  expect(tiles[0].chordWilds).toBe(1);
  expect(crystalHits(tiles, [], [0], new Set([0]))).toEqual([]);
  const [last] = crystalHits(tiles, [match('sapphire')], []);
  expect(last.signalHealth).toBe(0);
  expect(last.chordColors).toBe('ruby,sapphire');
});

it('preserves progress under opposite direction and colour orderings', async () => {
  const { crystalHits } = await import('../src/game/engine/CrystalMechanics');
  for (const axes of [
    ['horizontal', 'vertical'],
    ['vertical', 'horizontal'],
    ['horizontal', 'horizontal', 'vertical'],
  ]) {
    const tiles = [{ ...plain(), signal: 'crossgrain', signalHealth: 2, grainRemaining: 3 }];
    let removed = 0;
    for (const orientation of axes)
      for (const update of crystalHits(tiles, [{ type: 'ruby', indices: [0], orientation }], [])) {
        removed += tiles[0].signalHealth - update.signalHealth;
        Object.assign(tiles[0], update);
      }
    expect(removed).toBe(2);
    expect(tiles[0].signalHealth).toBe(0);
  }
  for (const colors of [
    ['ruby', 'emerald', 'sapphire'],
    ['sapphire', 'ruby', 'ruby', 'emerald'],
  ]) {
    const tiles = [
      { ...plain(), signal: 'chord', signalHealth: 3, chordColors: '', chordWilds: 0 },
    ];
    for (const type of colors)
      for (const update of crystalHits(
        tiles,
        [{ type, indices: [0], orientation: 'horizontal' }],
        [],
      ))
        Object.assign(tiles[0], update);
    expect(tiles[0].signalHealth).toBe(0);
    expect(new Set(tiles[0].chordColors.split(',')).size).toBe(3);
  }
});

it('a copied cell fires a bonus chain without becoming a spore beam', () => {
  const input = fixture();
  input.board[46] = createGem('cross');
  input.tiles[60] = { ...plain(), type: 'blocker', health: 1, maxHealth: 1, bonusOnly: true };
  input.board[60] = null;
  const result = manager.getResolution({
    ...input,
    matches: [{ type: 'ruby', indices: [16, 17, 18], orientation: 'horizontal' }],
  });
  expect(input.tiles[60].health).toBe(0);
  expect(result.steps.flatMap((step) => step.sporeBursts ?? [])).toEqual([]);
  expect(result.steps.flatMap((step) => step.traceCopies ?? [])).toHaveLength(1);
});
