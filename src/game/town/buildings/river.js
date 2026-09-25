import { RIVER, riverCenterX } from '../TownRiver';

export function addFishingDock(d, parent, level, wharf = false) {
  const world = parent.position;
  const reach = riverCenterX(world.z) - RIVER.halfWidth + 0.3 - world.x;
  const width = wharf ? 2.3 : 1;
  for (let n = 0; n < Math.ceil(reach * 4); n++)
    d.box(parent, 0.22, 0.13, width, 1 + n * 0.25, 0.1, 0, '#a58a62');
  for (const x of [1.5, reach])
    for (const z of [-width / 2, width / 2])
      d.rod(parent, [x, -1, z], [x, 0.4, z], 0.085, '#806c50');
  for (let n = 0; n < level; n++)
    d.mesh(parent, 'cylinder', [0.22, 0.45, 0.22], [-1 + n * 0.48, 0.28, 1.8], '#a78a60');
  if (level >= 2 || wharf) {
    for (const x of [-1.4, 0.3]) d.rod(parent, [x, 0, -1.6], [x, 1.1, -1.6], 0.045, '#a48a62');
    for (let n = 0; n < 7; n++)
      d.rod(parent, [-1.4 + n * 0.28, 0.2, -1.6], [-1.4 + n * 0.28, 1, -1.6], 0.015, '#b6aa86');
    d.rod(parent, [-1.4, 1, -1.6], [0.3, 1, -1.6], 0.03, '#b6aa86');
  }
  if (level >= 2) {
    d.box(parent, 2.6, 0.15, 1.2, 2.2, 0.18, 0, '#a58a62');
    for (const x of [1.1, 3.3]) d.rod(parent, [x, -0.7, -0.5], [x, 0.7, -0.5], 0.065, '#806c50');
  }
  if (level >= 3) {
    d.box(parent, 1.4, 1.8, 1.3, -1.8, 1, -1.4, '#849b91');
    d.box(parent, 1.6, 0.15, 1.5, -1.8, 1.98, -1.4, '#947b54');
    d.box(parent, 0.25, 0.7, 0.25, -2.1, 2.25, -1.5, '#806c50');
  }
  if (level >= 4) d.box(parent, 0.7, 0.7, 0.65, 1.8, 0.4, -1.4, '#b89d70');
  const boat = d.group(parent, reach + 0.2, RIVER.waterHeight - world.y + 0.12, width / 2 + 0.8);
  boat.name = 'Fishing skiff';
  d.ball(boat, 0, 0, 0, [0.35, 0.15, 0.9], '#876f4d');
  d.box(boat, 0.43, 0.08, 1.15, 0, 0.11, 0, '#b59b6f');
  d.rod(boat, [-0.3, 0.15, -0.4], [0.55, 0.2, 0.55], 0.025, '#c0a779');
}
