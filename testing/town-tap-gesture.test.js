import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAP_SLOP, createTapGesture, keyboardActivation } from '../src/game/town/TownTapGesture';
import { MoonScene } from '../src/game/town/moon/MoonScene';

// Permanent rule (AGENTS.md, settlement maps): the valley and the Moon settle taps
// through this one gesture, so a pinch, pan or modified click never opens a card and
// a tap's trailing click never lands on the card it opened.
const press = (pointerId, x, y, extra = {}) => ({
  pointerId,
  clientX: x,
  clientY: y,
  button: 0,
  ...extra,
});
function gesture() {
  const listeners = new Map();
  const root = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
  };
  const onTap = vi.fn();
  return { tap: createTapGesture({ map: null, onTap, root }), onTap, listeners };
}

it('settles a still primary press as a tap with what it began on', () => {
  const { tap, onTap, listeners } = gesture();
  tap.down(press(1, 10, 10), 'well');
  expect(tap.pressed).toBe(true);
  tap.move(press(1, 10 + TAP_SLOP - 1, 10));
  expect(tap.up(press(1, 10 + TAP_SLOP - 1, 10))).toBe(true);
  expect(onTap).toHaveBeenCalledWith(expect.objectContaining({ pointerId: 1 }), 'well');
  expect(tap.pressed).toBe(false);
  // The trailing click is guarded until it arrives or the next press.
  expect([...listeners.keys()].sort()).toEqual(['click', 'pointerdown']);
});

it.each([
  ['a drag past the slop', (tap) => tap.move(press(1, 10 + TAP_SLOP + 1, 10))],
  ['a second finger (pinch)', (tap) => tap.down(press(2, 60, 60))],
  ['a cancelled pointer', (tap) => tap.cancel(press(1, 10, 10))],
])('treats %s as a camera gesture, not a tap', (_, interrupt) => {
  const { tap, onTap } = gesture();
  tap.down(press(1, 10, 10));
  interrupt(tap);
  expect(tap.up(press(1, 10, 10))).toBe(false);
  tap.up(press(2, 60, 60));
  expect(onTap).not.toHaveBeenCalled();
});

it.each([
  ['middle button pan', { button: 1 }],
  ['right button pan', { button: 2 }],
  ['shift click', { shiftKey: true }],
  ['ctrl click', { ctrlKey: true }],
  ['meta click', { metaKey: true }],
])('never opens a card from a %s', (_, extra) => {
  const { tap, onTap } = gesture();
  tap.down(press(1, 10, 10, extra));
  expect(tap.up(press(1, 10, 10, extra))).toBe(false);
  expect(onTap).not.toHaveBeenCalled();
});

it('starts fresh after a gesture ends', () => {
  const { tap, onTap } = gesture();
  tap.down(press(1, 10, 10));
  tap.move(press(1, 80, 10));
  tap.up(press(1, 80, 10));
  tap.down(press(3, 20, 20));
  expect(tap.up(press(3, 20, 20))).toBe(true);
  expect(onTap).toHaveBeenCalledOnce();
});

// The Moon settles taps on its labels and action buttons through the same gesture, on
// the same surface as its camera (the canvas's parent), as the valley's labels do: a
// drag that starts on a label orbits instead of opening the lot.
describe('Moon labels and action buttons', () => {
  afterEach(() => vi.unstubAllGlobals());
  function moon() {
    vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
    const listeners = new Map();
    const surface = { addEventListener: (type, listener) => listeners.set(type, listener) };
    const canvas = { style: {} };
    const scene = Object.assign(Object.create(MoonScene.prototype), {
      canvas,
      onSelect: vi.fn(),
      tap: vi.fn(),
    });
    scene.attachInput(surface);
    const fire = (type, target, x = 10) => listeners.get(type)({ ...press(1, x, 10), target });
    return { scene, fire, canvas };
  }
  const tagged = (data) => ({ closest: () => ({ dataset: data }) });
  it.each([
    ['lot label', { moonLot: 'settlerDomes' }],
    ['action button', { moonAction: 'settlerDomes' }],
  ])('opens its lot from a tap on its %s, without the native click', (_, data) => {
    const { scene, fire } = moon();
    fire('pointerdown', tagged(data));
    fire('pointerup', tagged(data));
    expect(scene.onSelect).toHaveBeenCalledWith('settlerDomes');
    expect(scene.tap).not.toHaveBeenCalled();
    // The click a pointer tap leaves behind opens nothing; keyboard activation does.
    expect(keyboardActivation({ detail: 1 })).toBe(false);
    expect(keyboardActivation({ detail: 0 })).toBe(true);
  });
  it('orbits rather than opens when a drag starts on a label', () => {
    const { scene, fire } = moon();
    fire('pointerdown', tagged({ moonLot: 'settlerDomes' }));
    fire('pointermove', tagged({ moonLot: 'settlerDomes' }), 10 + TAP_SLOP + 4);
    fire('pointerup', tagged({ moonLot: 'settlerDomes' }), 10 + TAP_SLOP + 4);
    expect(scene.onSelect).not.toHaveBeenCalled();
    expect(scene.tap).not.toHaveBeenCalled();
  });
  it('picks the scene under a tap on the canvas and ignores other overlays', () => {
    const { scene, fire, canvas } = moon();
    fire('pointerdown', canvas);
    fire('pointerup', canvas);
    expect(scene.tap).toHaveBeenCalledOnce();
    fire('pointerdown', { closest: () => null });
    fire('pointerup', { closest: () => null });
    expect(scene.tap).toHaveBeenCalledOnce();
    expect(scene.onSelect).not.toHaveBeenCalled();
  });
});
