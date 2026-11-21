import { expect, it, vi } from 'vitest';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { OBSTACLES } from '../src/data/obstacles';

// Hard rule (AGENTS.md): once the player completes a board obstacle, nothing of
// it stays on the cell: no dimmed icon, check mark, tint or border. Every entry
// in the obstacle registry needs a sample here, so a new obstacle cannot ship
// without this check.
const ACTIVE = {
  chord: {
    type: 'standard',
    health: 0,
    signal: 'chord',
    signalHealth: 1,
    chordColors: 'ruby,sapphire',
    chordWilds: 0,
  },
  crossgrain: {
    type: 'standard',
    health: 0,
    signal: 'crossgrain',
    signalHealth: 1,
    grainRemaining: 2,
  },
  'trace-twins': {
    type: 'standard',
    health: 0,
    signal: 'trace',
    signalHealth: 1,
    tracePeer: 0,
    traceFacet: 'diamond',
  },
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
  floatstone: { type: 'standard', health: 0, floatStart: true },
  starglass: { type: 'blocker', bonusOnly: true, lensOnly: true, health: 2, maxHealth: 2 },
  lens: { type: 'void', health: 0, lens: 'se' },
  portal: { type: 'standard', health: 0, portal: 'in', portalPair: 0 },
  'cracked-wall': { type: 'blocker', bonusOnly: true, waist: 'a', health: 2, maxHealth: 2 },
  'moon-lock': { type: 'standard', health: 0, gravitySwitch: 'lock' },
  'moon-dial': { type: 'standard', health: 0, gravitySwitch: 'dial', fall: 'up' },
  'phase-seal': {
    type: 'standard',
    health: 2,
    maxHealth: 2,
    phaseSeal: true,
    phaseNext: 'sapphire',
  },
};
// Lens mirrors, portals and moon dials are fixtures the player uses, never completes
// (agreed with the user, like permanent voids). A dial stays for the whole level,
// like the other fixtures.
const FIXTURES = new Set(['lens', 'portal', 'moon-dial']);
// Ore orders are shown in the goal panel, not on a cell. Floatstones are pieces
// rather than cell markers; their sky hatches follow the relic exit sample.
const OFF_BOARD = new Set(['ore-orders', 'floatstone']);
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
  ...(tile.gravitySwitch === 'lock' ? { gravitySwitch: null } : {}),
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
        image: vi.fn(node),
        sprite: node,
        rectangle: node,
        container: node,
        circle: node,
        graphics: node,
      },
      make: { text: vi.fn(() => ({ width: 20, height: 16, canvas: {}, destroy() {} })) },
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
  fixture: animator.fixtureSprites.has(index),
  fill: animator.cellHighlights.get(index)?.fill,
  stroke: animator.cellHighlights.get(index)?.stroke,
});

it('has a completion sample for every board obstacle', () => {
  expect(Object.keys(ACTIVE).sort()).toEqual(OBSTACLES.map(({ id }) => id).sort());
  for (const { id, present } of OBSTACLES) expect(present(ACTIVE[id]), id).toBe(true);
});

it.each(OBSTACLES.map(({ id }) => id).filter((id) => !FIXTURES.has(id)))(
  'removes every trace of %s once completed',
  (id) => {
    const animator = renderer();
    animator.tiles = [PLAIN, ACTIVE[id]];
    animator.drawCells();
    if (!OFF_BOARD.has(id)) expect(look(animator, 1)).not.toEqual(look(animator, 0));
    animator.updateTiles([PLAIN, complete(ACTIVE[id])]);
    animator.syncToBoard([null, null]);
    expect(look(animator, 1)).toEqual(look(animator, 0));
  },
);

it('only exempts fixtures that are never completed', () => {
  for (const id of FIXTURES) expect(complete(ACTIVE[id])).toEqual(ACTIVE[id]);
});

it('keeps a relic exit while a relic is on the board', () => {
  const animator = renderer();
  animator.tiles = [PLAIN, ACTIVE.relic];
  animator.reset([{ id: 1, type: 'relic' }, null], { boardCols: 2, boardRows: 1, cellSize: 48 });
  expect(animator.tileOverlays.has(1)).toBe(true);
  animator.syncToBoard([{ id: 2, type: 'ruby' }, null]);
  expect(animator.tileOverlays.has(1)).toBe(false);
});

it('keeps a moon dial and updates its arrow after the last cargo leaves its exit', () => {
  const animator = renderer();
  const dial = { ...ACTIVE['moon-dial'], fall: 'down' };
  animator.tiles = [PLAIN, dial, ACTIVE.relic];
  animator.reset([{ id: 1, type: 'relic' }, null, null], {
    boardCols: 3,
    boardRows: 1,
    cellSize: 48,
  });
  // The dial fills its own cell as a fixture: no gem slot and no gem overlay.
  expect(animator.fixtureSprites.has(1)).toBe(true);
  expect(animator.cellHighlights.has(1)).toBe(false);
  expect(animator.tileOverlays.has(2)).toBe(true);
  const before = animator.fixtureSprites.get(1);
  animator.syncToBoard([{ id: 2, type: 'ruby' }, null, null]);
  expect(animator.fixtureSprites.get(1)).toBe(before);
  expect(look(animator, 1)).not.toEqual(look(animator, 0));
  expect(look(animator, 2)).toEqual(look(animator, 0));
  animator.updateTiles([PLAIN, { ...dial, fall: 'up' }, ACTIVE.relic]);
  expect(animator.fixtureSprites.get(1)).not.toBe(before);
  expect(animator.scene.add.image).toHaveBeenCalledWith(
    0,
    expect.any(Number),
    expect.stringContaining('glyph:↑:'),
  );
  expect(animator.scene.add.image).toHaveBeenCalledWith(0, 0, expect.any(String), 'tile-moon-dial');
  expect(look(animator, 2)).toEqual(look(animator, 0));
});

// Every marker an obstacle draws stays inside its own cell, so it reads as part of that
// cell and never as a badge on the neighbouring gem. The board's drawing calls are
// recorded with their sizes: images at their display size (glyph labels at their
// rendered text size), circles with their stroke, graphics with their line width.
function measuringRenderer(cellSize) {
  const shapes = [];
  const glyphs = new Map();
  const shape = (kind, x, y, extra = {}) => {
    const object = {
      kind,
      x,
      y,
      origin: [0.5, 0.5],
      lines: [],
      lineWidth: 0,
      ...extra,
      add(...children) {
        for (const child of children.flat()) child.parent = object;
        return object;
      },
      destroy() {},
      setDisplaySize(width, height) {
        Object.assign(object, { width, height });
        return object;
      },
      setSize(width, height) {
        Object.assign(object, { width, height });
        return object;
      },
      setPosition(px, py = px) {
        Object.assign(object, { x: px, y: py });
        return object;
      },
      setOrigin(ox, oy = ox) {
        object.origin = [ox, oy];
        return object;
      },
      setStrokeStyle(width = 0) {
        object.lineWidth = width;
        return object;
      },
      lineStyle(width) {
        object.lineWidth = Math.max(object.lineWidth, width);
        return object;
      },
      moveTo(px, py) {
        object.lines.push([px, py]);
        return object;
      },
      lineTo(px, py) {
        object.lines.push([px, py]);
        return object;
      },
    };
    for (const name of [
      'setTexture',
      'setCrop',
      'setAlpha',
      'setActive',
      'setVisible',
      'setAngle',
      'setFillStyle',
      'setDepth',
      'setScale',
      'setTint',
      'beginPath',
      'strokePath',
      'fillStyle',
      'fillCircle',
      'fillRect',
    ])
      object[name] = () => object;
    shapes.push(object);
    return object;
  };
  // Arial's digits are about 0.56 em wide; symbols and emoji fall back to wider fonts,
  // so they are measured at a full em.
  const measure = (text, style) => {
    const font = parseFloat(style.fontSize);
    const pad = style.padding ?? {};
    const em = [...text].reduce((sum, char) => sum + (/[0-9]/.test(char) ? 0.56 : 1), 0);
    const stroke = style.strokeThickness ?? 0;
    return {
      width: font * em + 2 * (pad.x ?? 0) + stroke,
      height: font * 1.2 + 2 * (pad.y ?? 0) + stroke,
    };
  };
  const textures = {
    exists: (key) => !key.startsWith('glyph:') || glyphs.has(key),
    get: () => ({ has: () => true }),
    createCanvas: (key, width, height) => {
      glyphs.set(key, { width, height });
      return { draw() {} };
    },
  };
  const animator = new BoardAnimator({
    scene: {
      textures,
      add: {
        image: (x, y, key) => shape('image', x, y, glyphs.get(key) ?? {}),
        sprite: (x, y) => shape('image', x, y),
        rectangle: (x, y, width, height) => shape('image', x, y, { width, height }),
        container: (x = 0, y = 0) => shape('container', x, y),
        circle: (x, y, radius) => shape('circle', x, y, { radius }),
        graphics: () => shape('graphics', 0, 0),
      },
      make: {
        text: ({ text, style }) => ({ ...measure(text, style), canvas: {}, destroy() {} }),
      },
    },
    backgroundLayer: shape('layer', 0, 0),
    tileLayer: shape('layer', 0, 0),
    gemLayer: shape('layer', 0, 0),
    textures: { relic: { key: 'gem-relic' }, ruby: { key: 'gem-ruby' } },
  });
  Object.assign(animator, { boardCols: 1, boardRows: 1, cellSize });
  return { animator, shapes };
}
// Where a recorded shape reaches on the board, from its own origin plus its parents'.
function reach(object) {
  let [dx, dy] = [0, 0];
  for (let parent = object.parent; parent; parent = parent.parent) {
    dx += parent.x;
    dy += parent.y;
  }
  if (object.kind === 'circle') {
    const r = object.radius + object.lineWidth / 2;
    return [object.x + dx - r, object.y + dy - r, object.x + dx + r, object.y + dy + r];
  }
  if (object.kind === 'graphics') {
    const xs = object.lines.map(([x]) => x),
      ys = object.lines.map(([, y]) => y),
      half = object.lineWidth / 2;
    return [
      Math.min(...xs) + dx - half,
      Math.min(...ys) + dy - half,
      Math.max(...xs) + dx + half,
      Math.max(...ys) + dy + half,
    ];
  }
  const left = object.x + dx - object.width * object.origin[0],
    top = object.y + dy - object.height * object.origin[1];
  return [left, top, left + object.width, top + object.height];
}
// Variants that draw differently from the registry sample: each Crossgrain stage, both
// Trace facets, a thick seal and a long survey number.
const VARIANTS = {
  'crossgrain (uncut)': { ...ACTIVE.crossgrain, grainRemaining: 3 },
  'crossgrain (one cut left)': { ...ACTIVE.crossgrain, grainRemaining: 1 },
  'trace-twins (hexagon)': { ...ACTIVE['trace-twins'], traceFacet: 'hexagon' },
  'spore (row)': { ...ACTIVE.spore, sporeAxis: 'row' },
  'survey (two digits)': { ...ACTIVE.survey, surveyOrder: 12 },
  'triple ice': { type: 'standard', health: 3, maxHealth: 3 },
  'cracked blast gate': { type: 'blocker', bonusOnly: true, health: 1, maxHealth: 2 },
};
// Fixtures, a moon lock and single ice or stone are whole-cell pictures with no markers.
const UNMARKED = new Set([...FIXTURES, ...OFF_BOARD, 'moon-lock', 'ice', 'stone']);
const MARKED = [
  ...OBSTACLES.map(({ id }) => id)
    .filter((id) => !UNMARKED.has(id))
    .map((id) => [id, ACTIVE[id]]),
  ...Object.entries(VARIANTS),
];

it.each(MARKED)('draws every marker of %s inside its own cell', (_, tile) => {
  for (const cellSize of [40, 48, 56, 64, 80]) {
    const { animator, shapes } = measuringRenderer(cellSize);
    animator.tiles = [tile];
    animator.drawCells();
    // The cell's markers: what its overlay holds. Fixtures and fossil pieces are full
    // pictures drawn to their own extent.
    const overlay = animator.tileOverlays.get(0);
    const drawn = shapes.filter(({ parent }) => parent && parent === overlay);
    expect(drawn.length, `${cellSize}px cell`).toBeGreaterThan(0);
    for (const object of drawn) {
      expect(object.width ?? object.radius ?? object.lines.length, 'a measured size').toBeTruthy();
      const [left, top, right, bottom] = reach(object);
      const where = `${object.kind} at ${object.x},${object.y} in a ${cellSize}px cell`;
      expect(left, where).toBeGreaterThanOrEqual(-0.01);
      expect(top, where).toBeGreaterThanOrEqual(-0.01);
      expect(right, where).toBeLessThanOrEqual(cellSize + 0.01);
      expect(bottom, where).toBeLessThanOrEqual(cellSize + 0.01);
    }
  }
});
