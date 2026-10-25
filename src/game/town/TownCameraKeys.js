// The keyboard's camera keys, the same on every settlement map: arrows orbit, plus and
// minus zoom, Home frames the whole map. Each map's camera runs the shared
// cameraAction (TownCamera) for them.
const CAMERA_KEYS = Object.freeze({
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  '+': 'in',
  '=': 'in',
  '-': 'out',
  Home: 'reset',
});

/** The camera action for a keydown, or null; a handled key's default is prevented. */
export function cameraKeyAction(event) {
  const action = CAMERA_KEYS[event.key] ?? null;
  if (action) event.preventDefault();
  return action;
}
