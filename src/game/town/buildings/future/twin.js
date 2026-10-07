import { futureShape } from '../futureShapes';
import { homesteadKit } from './homestead';

// Twin Hollows homecoming: the Moonward homestead lines, softened to silver-blue,
// with twin lanterns (teal for the valley, gold for the Moon) and an arch that
// carries a little Earth and Moon. Only a few landmarks are modernized this era.
function twinLanterns(d, g, p, x, z, y = 0) {
  d.rod(g, [x, y, z], [x, y + 1.25, z], 0.04, p.deep);
  d.rod(g, [x - 0.28, y + 1.22, z], [x + 0.28, y + 1.22, z], 0.03, p.deep);
  d.ball(g, x - 0.28, y + 1.06, z, [0.11, 0.14, 0.11], p.flower, 'rock');
  d.ball(g, x + 0.28, y + 1.06, z, [0.11, 0.14, 0.11], p.light, 'rock');
}

export const twinKit = {
  ...homesteadKit,
  // A welcome porch with a family bench under the twin lanterns.
  wing(d, g, s, { x, z, w = 1.4, dep = 1.1 }) {
    homesteadKit.wing(d, g, s, { x, z, w, dep });
    d.box(g, w * 0.7, 0.12, 0.3, x, 0.42, z + dep / 2 + 0.35, s.palette.timber);
  },
  // A homecoming arch over the roof, carrying the Earth and the Moon.
  crown(d, g, s, { x = 0, z = 0, y, r = 1 }) {
    const p = s.palette,
      span = Math.min(1.1, r);
    for (const side of [-1, 1])
      d.rod(
        g,
        [x + side * span, y - 0.35, z - 0.2],
        [x + side * span * 0.55, y + 0.9, z - 0.2],
        0.05,
        p.deep,
      );
    d.rod(
      g,
      [x - span * 0.55, y + 0.9, z - 0.2],
      [x + span * 0.55, y + 0.9, z - 0.2],
      0.05,
      p.deep,
    );
    d.ball(g, x - 0.28, y + 1.22, z - 0.2, 0.24, p.flower);
    d.ball(g, x - 0.22, y + 1.3, z - 0.1, [0.1, 0.06, 0.08], p.green, 'rock');
    d.ball(g, x + 0.3, y + 1.18, z - 0.2, 0.17, p.shell);
  },
  prop(d, g, s, x, z, y = 0) {
    twinLanterns(d, g, s.palette, x, z, y);
  },
};

// The homecoming hall: a long gabled hall, a moonstone display under glass and,
// finally, a welcome arch where crews step off the ribbon road.
export function homecomingHall(d, g, s, house) {
  const p = s.palette;
  house(d, g, s, { z: -0.6, w: 3.4, dep: 2.2, h: 2.4 });
  // Moonstone keepsakes from New Hollow on a glass-topped display.
  d.box(g, 1.3, 0.55, 0.6, 1.9, 0.28, 0.9, p.timber);
  d.mesh(g, futureShape(d, 'lowDome'), [0.5, 0.35, 0.25], [1.9, 0.56, 0.9], p.glass);
  for (const dx of [-0.3, 0, 0.3]) d.ball(g, 1.9 + dx, 0.62, 0.9, 0.08, p.shell, 'rock');
  if (s.level >= 2) {
    s.kit.wing(d, g, s, { x: -2.3, z: -1.2 });
    for (const x of [-2.4, 2.4]) twinLanterns(d, g, p, x, 1.6);
  }
  if (s.level >= 3) s.kit.crown(d, g, s, { x: 0, z: -0.6, y: 3.3, r: 1.3 });
  return { landmark: true };
}
