import { expect, it, vi } from 'vitest';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { OBSTACLES } from '../src/data/obstacles';

// Hard rule (AGENTS.md): once the player completes a board obstacle, nothing of
// it stays on the cell: no dimmed icon, check mark, tint or border. Every entry
// in the obstacle registry needs a sample here, so a new obstacle cannot ship
// without this check.
const ACTIVE = {
  'encased-fossil': {
    type: 'blocker',
    bonusOnly: true,
    fossilGroup: 'shell',
    fossilPart: 0,
    fossilCollected: false,
    health: 2,
    maxHealth: 2,
  },
  'blast-gate': { type: 'blocker', bonusOnly: true, health: 2, maxHealth: 2 },
  spore: { type: 'standard', health: 0, signal: 'spore', signalHealth: 1, sporeAxis: 'column' },
  fossil: {
    type: 'standard',
    fossilGroup: 'shell',
    fossilPart: 0,
    fossilCollected: false,
    health: 2,
    maxHealth: 2,
  },
  'root-knot': { type: 'blocker', rootKnot: true, rootGroup: 'root', health: 2, maxHealth: 2 },
  lantern: { type: 'standard', health: 0, signal: 'lantern', signalHealth: 1 },
  survey: { type: 'standard', health: 0, signal: 'survey', signalHealth: 1, surveyOrder: 1 },
  'ore-orders': { type: 'standard', health: 0, oreOrderGuide: true },
  'charge-core': { type: 'standard', health: 0, signal: 'core', signalHealth: 3, coreCharges: 3 },
  ice: { type: 'standard', health: 1, maxHealth: 1 },
  stone: { type: 'blocker', health: 1, maxHealth: 1 },
  'double-ice': { type: 'standard', health: 2, maxHealth: 2 },
  reinforced: { type: 'blocker', health: 2, maxHealth: 2 },
  frozen: { type: 'standard', health: 1, maxHealth: 1, state: 'FROZEN' },
  chain: { type: 'standard', health: 0, chainHealth: 2 },
  ...Object.fromEntries(
    ['ruby', 'sapphire', 'emerald'].map((color) => [
      `seal-${color}`,
      { type: 'seal', sealColor: color, health: 1, maxHealth: 1 },
    ]),
  ),
  relic: { type: 'standard', health: 0, exit: true },
};
// Ore orders are shown in the goal panel, not on a cell.
const OFF_BOARD = new Set(['ore-orders']);
const PLAIN = { type: 'standard', health: 0 };

// The tile as the engine leaves it once completed. Relic exits are complete
// when every relic has been delivered, which `syncToBoard` reports below.
const complete = (tile) => ({
  ...tile,
  health: 0,
  ...(tile.type === 'blocker' ? { type: 'standard' } : {}),
  ...(tile.chainHealth ? { chainHealth: 0 } : {}),
  ...(tile.signal ? { signalHealth: 0 } : {}),
  ...(tile.fossilGroup != null ? { fossilCollected: true } : {}),
  ...(tile.state === 'FROZEN' ? { state: 'PLAYABLE' } : {}),
});

function renderer() {
  const node = () => {
    const object = {
      add: vi.fn(),
      destroy: vi.fn(),
      setFillStyle(...fill) {
        object.fill = fill;
        return object;
      },
      setStrokeStyle(...stroke) {
        object.stroke = stroke;
        return object;
      },
    };
    for (const name of [
      'setTexture',
      'setPosition',
      'setDisplaySize',
      'setSize',
      'setCrop',
      'setAlpha',
      'setOrigin',
      'setActive',
      'setVisible',
      'setAngle',
      'lineStyle',
      'beginPath',
      'moveTo',
      'lineTo',
      'strokePath',
    ])
      object[name] = () => object;
    return object;
  };
  const textures = {
    exists: () => true,
    get: () => ({ has: () => true }),
    createCanvas: () => ({ draw() {} }),
  };
  const animator = new BoardAnimator({
    scene: {
      textures,
      add: {
        image: node,
        sprite: node,
        rectangle: node,
        container: node,
        circle: node,
        graphics: node,
      },
      make: { text: () => ({ width: 20, height: 16, canvas: {}, destroy() {} }) },
    },
    backgroundLayer: node(),
    tileLayer: node(),
    gemLayer: node(),
    textures: { relic: { key: 'gem-relic' }, ruby: { key: 'gem-ruby' } },
  });
  Object.assign(animator, { boardCols: 2, boardRows: 1, cellSize: 48 });
  return animator;
}
const look = (animator, index) => ({
  overlay: animator.tileOverlays.has(index),
  floor: animator.iceSprites.has(index),
  fossil: animator.fossilSprites.has(index),
  fill: animator.cellHighlights.get(index).fill,
  stroke: animator.cellHighlights.get(index).stroke,
});

it('has a completion sample for every board obstacle', () => {
  expect(Object.keys(ACTIVE).sort()).toEqual(OBSTACLES.map(({ id }) => id).sort());
  for (const { id, present } of OBSTACLES) expect(present(ACTIVE[id]), id).toBe(true);
});

it.each(OBSTACLES.map(({ id }) => id))('removes every trace of %s once completed', (id) => {
  const animator = renderer();
  animator.tiles = [PLAIN, ACTIVE[id]];
  animator.drawCells();
  if (!OFF_BOARD.has(id)) expect(look(animator, 1)).not.toEqual(look(animator, 0));
  animator.updateTiles([PLAIN, complete(ACTIVE[id])]);
  animator.syncToBoard([null, null]);
  expect(look(animator, 1)).toEqual(look(animator, 0));
});

it('keeps a relic exit while a relic is on the board', () => {
  const animator = renderer();
  animator.tiles = [PLAIN, ACTIVE.relic];
  animator.reset([{ id: 1, type: 'relic' }, null], { boardCols: 2, boardRows: 1, cellSize: 48 });
  expect(animator.tileOverlays.has(1)).toBe(true);
  animator.syncToBoard([{ id: 2, type: 'ruby' }, null]);
  expect(animator.tileOverlays.has(1)).toBe(false);
});
