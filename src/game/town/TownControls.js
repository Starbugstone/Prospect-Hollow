import { MOUSE, TOUCH } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// One camera gesture vocabulary for every settlement map, the valley and the Moon
// alike: left drag orbits, middle or right drag pans across the ground, the wheel
// and pinch zoom, two fingers pan. Scenes add only their own target and limits.
// ESLint keeps OrbitControls out of every other file, so a new map cannot drift.
export const TOWN_CONTROL_GESTURES = Object.freeze({
  mouseButtons: Object.freeze({ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }),
  touches: Object.freeze({ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }),
  rotateSpeed: 0.7,
  zoomSpeed: 0.85,
});

export function createTownControls(camera, element) {
  const controls = new OrbitControls(camera, element);
  controls.cursorStyle = 'grab';
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.enableDamping = false;
  Object.assign(controls.mouseButtons, TOWN_CONTROL_GESTURES.mouseButtons);
  Object.assign(controls.touches, TOWN_CONTROL_GESTURES.touches);
  controls.rotateSpeed = TOWN_CONTROL_GESTURES.rotateSpeed;
  controls.zoomSpeed = TOWN_CONTROL_GESTURES.zoomSpeed;
  return controls;
}
