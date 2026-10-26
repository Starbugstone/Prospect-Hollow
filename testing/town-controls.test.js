import { expect, it } from 'vitest';
import { MOUSE, PerspectiveCamera, TOUCH } from 'three';
import { TOWN_CONTROL_GESTURES, createTownControls } from '../src/game/town/TownControls';

// Permanent rule (AGENTS.md, settlement maps): the valley and the Moon share one
// camera gesture set. ESLint keeps OrbitControls out of every other module, so any
// map with a camera goes through this factory.
const listeners = () => ({ addEventListener() {}, removeEventListener() {} });
const element = () => ({
  ...listeners(),
  style: {},
  ownerDocument: listeners(),
  getRootNode: listeners,
  setPointerCapture() {},
  releasePointerCapture() {},
});

it('pans with the middle or right button and pinches to zoom on every map', () => {
  const controls = createTownControls(new PerspectiveCamera(), element());
  expect(controls.mouseButtons).toMatchObject({
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.PAN,
    RIGHT: MOUSE.PAN,
  });
  expect(controls.touches).toMatchObject({ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN });
  expect(controls.enablePan).toBe(true);
  // Panning slides across the ground rather than the screen plane.
  expect(controls.screenSpacePanning).toBe(false);
  expect(controls.enableDamping).toBe(false);
  expect(controls.cursorStyle).toBe('grab');
  expect([controls.rotateSpeed, controls.zoomSpeed]).toEqual([
    TOWN_CONTROL_GESTURES.rotateSpeed,
    TOWN_CONTROL_GESTURES.zoomSpeed,
  ]);
  controls.dispose();
});
