// Six puzzles per chapter: introduce, practice, explore, stretch, rest, finale.
// Ice is arranged along readable seams; stone never closes the side columns.
const chapterIce = [
  [32, 34, 38, 38, 32, 40],
  [38, 38, 38, 38, 36, 37],
  [32, 36, 40, 44, 34, 46],
  [36, 40, 44, 48, 36, 50],
  [40, 44, 48, 52, 40, 54],
  [42, 46, 50, 54, 42, 56],
];
// Authored openings are measured across 30 refill seeds, not chosen from one lucky run.
const openingSeeds = { 2: 12007, 7: 8017, 8: 12007, 9: 8017, 10: 28001, 11: 12007, 12: 12007 };
const motifs = ['pocket', 'ribbon', 'twins', 'steps', 'pool', 'arch'];
const tips = {
  pocket: 'Follow the ice seam. Match three jewels on frost to clear it.',
  ribbon: 'Follow the ice seam. A match of four makes a blast bomb.',
  twins: 'Two small pockets. Build a bonus between them to reach both.',
  steps: 'Follow the stepping stones. Keep the open columns flowing.',
  pool: 'A quiet chamber. Enjoy the cascades and try a bonus combination.',
  arch: 'Open the arch from either side. A row or column blast can help.',
};

export const getEarlyLevelSpec = (id) => {
  const chapter = Math.floor((id - 1) / 6);
  const slot = (id - 1) % 6;
  const motif = motifs[(slot + (chapter === 4 ? 2 : 0)) % motifs.length];
  return {
    motif,
    seed: openingSeeds[id] ?? id * 1337,
    ice: chapterIce[chapter][slot],
    doubleIce: chapter < 2 ? 0 : [2, 3, 4, 5, 2, 6][slot],
    stoneCount:
      chapter === 0 ? 0 : chapter === 5 ? [1, 2, 3, 3, 1, 5][slot] : [1, 2, 3, 4, 1, 5][slot],
    reinforcedCount: chapter < 3 ? 0 : [1, 1, 2, 2, 0, 3][slot],
    frozenCount: chapter === 5 ? [1, 2, 2, 2, 1, 4][slot] : 0,
    // Keep this dense twin seam off the bottom edge, where a lone ice tile
    // otherwise dominates the final stretch after direct-only blast damage.
    ...(id === 33 ? { openExitRows: 1 } : {}),
    tip:
      chapter === 5
        ? 'Match beside a frozen gem to thaw it, then clear the ice underneath.'
        : chapter === 3 && slot !== 4
          ? 'Gold-banded stone takes two hits. Open the arch with adjacent matches or bonuses.'
          : chapter === 2 && slot === 0
            ? 'More room and five jewel colors. Match twice on the small patches of double ice.'
            : chapter === 1 && slot === 0
              ? 'Match beside the stone to break it. The open sides give you room to explore.'
              : tips[motif],
  };
};

export const stonePositions = (cols, rows, motif) => {
  const mid = Math.floor(cols / 2);
  const shapes = {
    pocket: [
      [mid, 3],
      [mid - 1, 3],
      [mid + 1, 3],
      [1, 5],
      [cols - 2, 5],
    ],
    ribbon: [
      [1, 2],
      [cols - 2, 4],
      [2, 2],
      [cols - 3, 4],
      [mid, 5],
    ],
    twins: [
      [1, 3],
      [cols - 2, 3],
      [1, 4],
      [cols - 2, 4],
      [mid, 2],
    ],
    steps: [
      [1, 2],
      [2, 2],
      [cols - 2, 4],
      [cols - 3, 4],
      [mid, rows - 2],
    ],
    pool: [[mid, 2]],
    arch: [
      [1, 3],
      [cols - 2, 3],
      [mid, 2],
      [1, 4],
      [cols - 2, 4],
    ],
  };
  return shapes[motif].map(([x, y]) => ({ x, y }));
};

// Lower ranks place ice nearer the motif. Favor central routes before outer-edge tiles.
export const iceRank = (index, cols, rows, motif) => {
  const x = index % cols,
    y = Math.floor(index / cols);
  const cx = (cols - 1) / 2,
    cy = (rows - 1) / 2;
  const edge = x === 0 || x === cols - 1 || y === 0 || y === rows - 1 ? 100 : 0;
  const ranks = {
    pocket: Math.abs(x - cx) + Math.abs(y - cy),
    ribbon: Math.abs(x - cx) * 3 + Math.abs(y - cy) * 0.2,
    twins: Math.min(Math.abs(x - 1.5), Math.abs(x - (cols - 2.5))) + Math.abs(y - cy) * 0.7,
    steps: Math.abs(x - (1 + (y % (cols - 2)))) + Math.abs(y - cy) * 0.2,
    pool: Math.abs(x - cx) * 0.4 + Math.abs(y - cy) * 2,
    arch: Math.abs(Math.abs(x - cx) + Math.abs(y - cy) - 2),
  };
  return edge + ranks[motif];
};
