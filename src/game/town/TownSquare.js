import { walkObstacle } from './TownNavigation';
import { addTownFountain } from './TownFountains';
// The era's static fountain shares the scenery batch; no water simulation or extra frame work.
export const SQUARE_ANCHORS = Object.freeze({
  corners: [
    [-2.35, -2.3],
    [2.35, -2.3],
    [-2.35, 2.3],
    [2.35, 2.3],
  ],
  bell: [0, -2.05],
});
export function addSquareModernization(d, parent, level, color = '#718b80') {
  const root = d.group(parent);
  root.name = 'Square street furniture';
  for (const [x, z] of SQUARE_ANCHORS.corners) {
    // Complete the existing corner lighting at tier two without covering the fountain.
    if (level < 2 && z > 0) continue;
    walkObstacle(root, x, z, 0.065);
    d.rod(root, [x, 0.2, z], [x, 2.8, z], 0.065, color);
    d.ball(root, x, 2.9, z, 0.22, '#f4d58d');
  }
  if (level >= 3)
    for (const x of [-2.7, 2.7]) {
      walkObstacle(root, x, 0, Math.hypot(0.325, 0.75), 1.1);
      d.box(root, 0.65, 0.4, 1.5, x, 0.25, 0, '#b69c70');
      d.ball(root, x, 0.65, 0, [0.32, 0.45, 0.7], '#81996a');
    }
  return root;
}
export function buildTownSquare(d, parent, stage, lamps = true, era = 'frontier') {
  d.box(parent, 5.4, 0.12, 5.2, 0, 0.06, 0, '#c5b797');
  d.box(parent, 4.9, 0.035, 4.7, 0, 0.14, 0, '#dcccad');
  for (const x of [-2.6, 2.6]) d.box(parent, 0.16, 0.18, 5.2, x, 0.1, 0, '#aaa182');
  for (const z of [-2.5, 2.5]) d.box(parent, 5.3, 0.18, 0.16, 0, 0.1, z, '#aaa182');
  addTownFountain(d, parent, stage, era);
  if (stage >= 2) {
    for (const x of [-2.05, 2.05]) {
      for (const z of [-1.3, 1.3]) {
        const bench = d.group(parent, x, 0.15, z);
        walkObstacle(bench, 0, 0, Math.hypot(0.28, 0.575), 0.8);
        for (const dz of [-0.4, 0.4]) d.box(bench, 0.35, 0.3, 0.09, 0, 0.15, dz, '#7c816c');
        d.box(bench, 0.48, 0.09, 1.15, 0, 0.35, 0, '#9f8157');
        d.box(bench, 0.08, 0.32, 1.15, Math.sign(x) * 0.23, 0.52, 0, '#b09061');
      }
    }
  }
  if (stage >= 4) {
    const bell = d.group(parent, 0, 0.15, -2.05);
    bell.name = 'Town warning bell';
    for (const x of [-0.55, 0.55]) walkObstacle(bell, x, 0, 0.1, 2.2);
    for (const x of [-0.55, 0.55]) d.box(bell, 0.13, 2.1, 0.15, x, 1.05, 0, '#94744f');
    d.box(bell, 1.35, 0.17, 0.2, 0, 2.1, 0, '#94744f');
    d.rod(bell, [0, 2.05, 0], [0, 1.8, 0], 0.06, '#84613b');
    d.mesh(bell, 'cone', [0.34, 0.5, 0.34], [0, 1.55, 0], '#e9bc61');
    d.mesh(bell, 'cylinder', [0.38, 0.08, 0.38], [0, 1.3, 0], '#d7a64e');
    d.ball(bell, 0, 1.2, 0, 0.09, '#84613b');
    d.rod(bell, [0, 1.2, 0], [0, 0.55, 0], 0.025, '#cdb58b');
    for (const x of [-1.5, 1.5])
      for (const z of [-2.1, 2.1]) {
        walkObstacle(parent, x, z, Math.hypot(0.5, 0.4), 1);
        d.box(parent, 0.9, 0.35, 0.65, x, 0.3, z, '#9c9276');
        d.ball(parent, x, 0.62, z, [0.5, 0.28, 0.4], '#87a075');
        for (const dx of [-0.22, 0.22]) d.ball(parent, x + dx, 0.86, z, 0.15, '#d9a380');
      }
  }
  if (stage >= 5 && lamps) {
    for (const x of [-2.25, 2.25])
      for (const z of [-2.15, 2.15]) {
        walkObstacle(parent, x, z, 0.065);
        d.rod(parent, [x, 0.2, z], [x, 2.65, z], 0.065, '#718b80');
        d.box(parent, 0.38, 0.55, 0.38, x, 2.65, z, '#f4d58d');
        d.mesh(parent, 'cone', [0.3, 0.25, 0.3], [x, 3.03, z], '#718b80');
      }
    for (const z of [-1.8, 1.8]) {
      d.box(parent, 1.5, 0.03, 0.45, 0, 0.18, z, '#b69e72');
      for (const x of [-0.5, 0, 0.5]) d.box(parent, 0.25, 0.02, 0.25, x, 0.21, z, '#7b9c8e');
    }
  }
}
