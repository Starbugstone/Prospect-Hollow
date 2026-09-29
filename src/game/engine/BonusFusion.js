import { GEM_TYPES } from './GemFactory.js';
import { isAdjacent } from './TileRules.js';

export const FUSION_STYLES = {
  'bomb+bomb': {
    label: 'MEGA DETONATION!',
    detail: 'TWIN 5×5 BLASTS',
    color: 0xffbd60,
    accent: 0xff627e,
  },
  'bomb+cross': {
    label: 'ATOMIC CROSS!',
    detail: 'TRIPLE-WIDTH CROSSFIRE',
    color: 0xffd77a,
    accent: 0x79f3ff,
  },
  'bomb+rainbow': {
    label: 'PRISM BOMB!',
    detail: 'COLOR BOMB NETWORK',
    color: 0xff9fe9,
    accent: 0xffd679,
  },
  'cross+cross': {
    label: 'HYPER CROSS!',
    detail: '8-WAY LASER STORM',
    color: 0x79f3ff,
    accent: 0xa998ff,
  },
  'cross+rainbow': {
    label: 'SPECTRUM STORM!',
    detail: 'COLOR LASER NETWORK',
    color: 0xa8b0ff,
    accent: 0x80fff0,
  },
  'rainbow+rainbow': {
    label: 'SUPERNOVA!',
    detail: 'FULL BOARD · DOUBLE DAMAGE',
    color: 0xffc5ff,
    accent: 0x8cffff,
  },
};

export function dominantGemType(board) {
  const counts = new Map(GEM_TYPES.map((type) => [type, 0]));
  board.forEach((gem) => {
    if (counts.has(gem?.type)) counts.set(gem.type, counts.get(gem.type) + 1);
  });
  // Stable ties make the preview, hint and eventual detonation agree.
  return GEM_TYPES.reduce(
    (best, type) => (counts.get(type) > counts.get(best) ? type : best),
    GEM_TYPES[0],
  );
}

// Board is already swapped. Virtual network bombs/crosses never mutate its gems.
export function getBonusFusion(board, cols, rows, swap) {
  if (!swap || !cols || !rows) return null;
  const indices = [swap.aIndex, swap.bIndex];
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= board.length)) return null;
  const [a, b] = indices;
  if (!isAdjacent(a, b, cols)) return null;
  const pair = indices.map((index) => ({ index, type: board[index]?.type }));
  const key = pair
    .map(({ type }) => type)
    .sort()
    .join('+');
  if (!FUSION_STYLES[key]) return null;
  const targets = new Set(indices),
    nodes = [];
  const add = (row, col) => {
    if (row >= 0 && row < rows && col >= 0 && col < cols && row * cols + col < board.length)
      targets.add(row * cols + col);
  };
  const blast = (index, radius) => {
    nodes.push({ index, type: 'bomb', radius });
    const row = Math.floor(index / cols),
      col = index % cols;
    for (let y = -radius; y <= radius; y++)
      for (let x = -radius; x <= radius; x++) add(row + y, col + x);
  };
  const cross = (index, diagonals = false) => {
    nodes.push({ index, type: 'cross', diagonals });
    const row = Math.floor(index / cols),
      col = index % cols;
    for (let x = 0; x < cols; x++) add(row, x);
    for (let y = 0; y < rows; y++) {
      add(y, col);
      if (diagonals) {
        add(y, col + y - row);
        add(y, col - y + row);
      }
    }
  };
  let targetType = null;
  if (key === 'bomb+bomb') indices.forEach((index) => blast(index, 2));
  else if (key === 'bomb+cross') {
    const minRow = Math.min(...indices.map((i) => Math.floor(i / cols)));
    const maxRow = Math.max(...indices.map((i) => Math.floor(i / cols)));
    const minCol = Math.min(...indices.map((i) => i % cols));
    const maxCol = Math.max(...indices.map((i) => i % cols));
    for (let row = minRow - 1; row <= maxRow + 1; row++)
      for (let col = 0; col < cols; col++) add(row, col);
    for (let col = minCol - 1; col <= maxCol + 1; col++)
      for (let row = 0; row < rows; row++) add(row, col);
    nodes.push(...pair.map(({ index }) => ({ index, type: 'cross', width: 3 })));
  } else if (key === 'cross+cross') indices.forEach((index) => cross(index, true));
  else if (key === 'rainbow+rainbow') {
    for (let i = 0; i < Math.min(board.length, cols * rows); i++) targets.add(i);
  } else {
    targetType = dominantGemType(board);
    const type = pair.find((item) => item.type !== 'rainbow').type;
    const origins = [
      ...indices,
      ...board.flatMap((gem, i) => (gem?.type === targetType ? [i] : [])),
    ];
    origins.forEach((index) => (type === 'bomb' ? blast(index, 1) : cross(index)));
  }
  return { key, pair, nodes, targetType, damage: 2, targets: [...targets].sort((a, b) => a - b) };
}
