import { mineTrackHeight, mineTrackPitch } from '../TownMineShaft';
import { MINE_SHAFT } from '../../../data/mineSite';

export function mineCart(d, parent, model) {
  const root = d.group(parent),
    body = d.group(root),
    load = d.group(body),
    wheels = [];
  root.name = `Mine ${model}`;
  root.userData.animated = true;
  const timber = model === 'hand-tub',
    electric = model === 'electric-haul';
  const color = timber ? '#a68155' : electric ? '#779fa1' : '#637783';
  d.box(body, 0.72, 0.38, 0.58, 0, 0.42, 0, color, true);
  for (const x of [-0.37, 0.37]) {
    d.box(body, 0.05, 0.09, 0.62, x, 0.55, 0, timber ? '#534c40' : '#bec1ad');
    for (const z of [-0.21, 0.21]) {
      const pivot = d.group(root, x, 0.17, z);
      wheels.push(pivot);
      d.mesh(pivot, 'cylinder', [0.14, 0.07, 0.14], [0, 0, 0], '#414b4c').rotation.z = Math.PI / 2;
    }
  }
  if (model === 'side-tip' || model === 'tipping-tubs') {
    for (const x of [-0.31, 0.31]) d.rod(body, [x, 0.2, -0.2], [x, 0.7, 0.2], 0.045, '#bdc2ab');
    d.box(body, 0.83, 0.07, 0.66, 0, 0.68, 0, color);
  }
  if (model === 'paired-tubs') {
    d.box(body, 0.68, 0.14, 0.6, 0, 0.68, 0, '#9eaeaa');
  }
  if (model === 'compact-haul') {
    d.box(body, 0.5, 0.26, 0.3, 0, 0.65, -0.17, '#c5b995');
    d.box(body, 0.24, 0.08, 0.06, 0, 0.75, 0.31, '#f0d590');
  }
  if (model === 'standard-tub') {
    d.box(body, 0.78, 0.22, 0.64, 0, 0.59, 0, '#a5bbc1');
    for (const z of [-0.25, 0.25]) d.rod(body, [-0.34, 0.8, z], [0.34, 0.8, z], 0.025, '#637783');
  }
  if (electric) {
    d.box(body, 0.4, 0.2, 0.18, 0, 0.66, -0.25, '#d5d4b7');
    d.box(body, 0.22, 0.07, 0.03, 0, 0.66, 0.3, '#a6e3ce');
  }
  if (model === 'iron-car')
    for (const z of [-0.23, 0.23]) d.box(body, 0.77, 0.06, 0.06, 0, 0.38, z, '#b5ad8a');
  for (let i = 0; i < 4; i++)
    d.ball(
      load,
      (i % 2) * 0.26 - 0.13,
      0.68,
      Math.floor(i / 2) * 0.21 - 0.1,
      0.14,
      i % 2 ? '#ac85bf' : '#87b8b2',
      'rock',
    );
  root.userData.envelope = { halfWidth: 0.43, halfLength: 0.36, height: 0.9 };
  return { root, body, load, wheels };
}
export function haulCycle(time) {
  const phase = ((time % 16) + 16) % 16;
  if (phase < 2) return { progress: 0, loaded: true, state: 'load' };
  if (phase < 7) return { progress: (phase - 2) / 5, loaded: true, state: 'travel' };
  if (phase < 10) return { progress: 1, loaded: phase < 8.5, state: 'unload' };
  if (phase < 15) return { progress: 1 - (phase - 10) / 5, loaded: false, state: 'return' };
  return { progress: 0, loaded: false, state: 'load' };
}
export function addMineHaul(d, parent, profile) {
  const carts = [mineCart(d, parent, profile.cart)];
  if (profile.cart === 'paired-tubs' || profile.cart === 'tipping-tubs')
    carts.push(mineCart(d, parent, profile.cart));
  return (time) => {
    const cycle = haulCycle(time);
    for (const [i, cart] of carts.entries()) {
      const z =
        MINE_SHAFT.portalZ -
        0.7 +
        (MINE_SHAFT.rampStartZ - MINE_SHAFT.portalZ - 0.05) * cycle.progress -
        i * 0.8;
      cart.root.position.set(0, mineTrackHeight(z) + 0.07, z);
      cart.root.rotation.x = mineTrackPitch(z);
      cart.load.visible = cycle.loaded;
      cart.body.rotation.z =
        cycle.state === 'unload' && ['side-tip', 'tipping-tubs'].includes(profile.cart)
          ? Math.sin((((time % 16) - 7) / 3) * Math.PI) * 0.65
          : 0;
      for (const wheel of cart.wheels) wheel.rotation.x = (cycle.progress * 4) / 0.14;
    }
  };
}
