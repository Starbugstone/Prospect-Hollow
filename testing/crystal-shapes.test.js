import { expect, it } from 'vitest';
import { prototypeConfig } from '../src/data/prototypeBoards';
import { isPlayableCell } from '../src/game/engine/BoardTopology';

it.each(['arrowhead-inner-spring', 'twin-windows-crafting-spine'])(
  'keeps clearing-only crafting space at every cell: %s',
  (key) => {
    const level = prototypeConfig(key),
      { boardCols: cols, boardRows: rows, tiles, board } = level;
    expect(board.some((gem) => gem?.type === 'relic')).toBe(false);
    // Each socket belongs to at least one contiguous three-cell line; a window
    // cannot introduce a cell where no ordinary match could ever be made.
    for (let cell = 0; cell < tiles.length; cell++) {
      if (!isPlayableCell(tiles[cell])) continue;
      const x = cell % cols,
        y = Math.floor(cell / cols);
      const possible = [
        [1, 0],
        [0, 1],
      ].some(([dx, dy]) =>
        [-2, -1, 0].some((offset) =>
          [0, 1, 2].every((i) => {
            const cx = x + (offset + i) * dx,
              cy = y + (offset + i) * dy;
            return (
              cx >= 0 && cx < cols && cy >= 0 && cy < rows && isPlayableCell(tiles[cy * cols + cx])
            );
          }),
        ),
      );
      expect(possible, `${key} cell ${cell}`).toBe(true);
    }
  },
);
it('keeps windows to two rows with a three-wide crafting spine', () => {
  const { tiles, boardCols: cols } = prototypeConfig('twin-windows-crafting-spine');
  expect(tiles.flatMap((tile, index) => (tile.type === 'void' ? [index] : []))).toEqual([
    22, 26, 29, 33,
  ]);
  for (const row of [3, 4])
    for (const col of [2, 3, 4]) expect(isPlayableCell(tiles[row * cols + col])).toBe(true);
});
