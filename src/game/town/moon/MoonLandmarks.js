import { futureShape } from '../buildings/futureShapes';
import { buildTownFlag } from '../TownEmblems';

const SHELL = '#e5e8e7',
  REGOLITH = '#aaa79f',
  METAL = '#657481',
  GOLD = '#eacb80';
export const LUNAR_LANDMARK_FORMS = ['footprints', 'earthrise', 'orbital-beacon'];

// Shared monument tiers keep the lunar silhouettes. No open water or vegetation
// in the vacuum: later milestones add solar wings, lamps and a moonstone crown.
export function buildMoonLandmark(d, g, option, tier, move) {
  const colour = option.colour;
  const h = 3.5 + tier * 0.7;
  if (option.form === 'footprints') {
    d.mesh(g, 'cylinder', [3.7, 0.3, 3.7], [0, 0.8, 0], REGOLITH);
    // Impressed sole shapes and heel blocks remain visible through the dome.
    for (const [x, z] of [
      [-1.3, 1],
      [-0.2, 0],
      [-1.3, -1],
    ]) {
      d.box(g, 0.46, 0.03, 0.8, x, 0.97, z, METAL, true);
      for (let n = 0; n < 3; n++) d.box(g, 0.48, 0.035, 0.04, x, 0.99, z - 0.25 + n * 0.2, SHELL);
    }
    const flag = buildTownFlag(d, g, d.town?.personalisation?.crest, { still: true });
    if (flag) {
      flag.position.set(1.2, 0.95, -0.4);
      flag.scale.setScalar(0.55);
    } else {
      // Towns without a chosen crest retain the original mission pennant.
      d.rod(g, [1.2, 0.95, -0.4], [1.2, h, -0.4], 0.07, GOLD);
      d.box(g, 1.6, 0.9, 0.05, 2, h - 0.6, -0.4, colour);
      d.ball(g, 2, h - 0.6, -0.35, [0.24, 0.24, 0.04], GOLD, 'rock');
    }
    const glass = d.material('#a4dbea');
    glass.transparent = true;
    glass.opacity = 0.28;
    glass.depthWrite = false;
    const dome = d.mesh(g, futureShape(d, 'dome'), [3.8, h + 0.8, 3.8], [0, 0.95, 0], '#a4dbea');
    dome.castShadow = false;
    // Meridians make the protective glass legible from the overview.
    for (let n = 0; n < 4; n++) {
      const a = (n * Math.PI) / 2;
      let last;
      for (let k = 0; k <= 10; k++) {
        const t = ((k / 10) * Math.PI) / 2;
        const point = [
          Math.cos(a) * 3.8 * Math.cos(t),
          0.95 + (h + 0.8) * Math.sin(t),
          Math.sin(a) * 3.8 * Math.cos(t),
        ];
        if (last) d.rod(g, last, point, 0.035, SHELL);
        last = point;
      }
    }
    move(d.ball(g, 0, h + 1.85, 0, 0.24, GOLD, 'rock'), 'turn', 'y', 0.3);
  } else if (option.form === 'earthrise') {
    // A real open arch frames the actual Earth in the sky beyond the lunar rim.
    for (const x of [-3.4, 3.4]) d.box(g, 1.1, h, 1.5, x, h / 2 + 0.6, 0, REGOLITH);
    for (let n = 0; n <= 10; n++) {
      const a = (n * Math.PI) / 10;
      const stone = d.box(
        g,
        1.05,
        0.8,
        1.5,
        Math.cos(a) * 3.4,
        h + 0.6 + Math.sin(a) * 2.7,
        0,
        n % 3 ? SHELL : REGOLITH,
      );
      stone.rotation.z = a - Math.PI / 2;
    }
    for (const x of [-3.4, 3.4]) {
      const crystal = d.ball(g, x, h + 1.6, 0, [0.55, 1.15, 0.55], colour, 'rock');
      move(crystal, 'turn', 'y', 0.2);
    }
    d.box(g, 2.5, 0.5, 0.7, 0, 0.85, 2.8, METAL);
    d.box(g, 1.8, 0.12, 0.74, 0, 1.16, 2.8, GOLD);
  } else {
    d.mesh(g, 'cylinder', [0.45, h, 0.45], [0, h / 2 + 0.6, 0], METAL);
    const rotor = d.group(g, 0, h + 0.8, 0);
    for (const [n, tilt] of [0.6, -0.6].entries()) {
      const orbit = d.mesh(rotor, 'ring', [3, 3, 3], [0, 0, 0], n ? GOLD : colour);
      orbit.rotation.x = tilt;
    }
    d.ball(rotor, 0, 0, 0, 0.75, SHELL, 'rock');
    d.ball(rotor, 2.9, 0, 0, 0.36, colour, 'rock');
    move(rotor, 'turn', 'y', 0.16);
    d.mesh(g, 'cone', [0.65, 1.7, 0.65], [0, h + 3.8, 0], GOLD);
  }
  if (tier >= 2)
    for (const side of [-1, 1]) {
      d.rod(g, [side * 4.4, 0.6, -2.8], [side * 4.4, 1.8, -2.8], 0.1, METAL);
      d.box(g, 1.7, 0.12, 2.2, side * 4.4, 1.8, -2.8, colour).rotation.z = side * 0.2;
    }
  if (tier >= 3)
    for (const x of [-4, 4]) {
      d.rod(g, [x, 0.6, 3.2], [x, 2.3, 3.2], 0.07, METAL);
      d.ball(g, x, 2.4, 3.2, 0.3, GOLD, 'rock');
    }
  if (tier >= 4)
    for (const side of [-1, 1]) {
      d.box(g, 0.5, 3.5, 0.7, side * 4.6, 2.35, -4.2, SHELL);
      d.ball(g, side * 4.6, 4.7, -4.2, [0.4, 1, 0.4], colour, 'rock');
    }
  if (tier >= 5) {
    d.box(g, 9.6, 0.35, 0.6, 0, 4.3, -4.2, SHELL);
    for (const x of [-1.4, 0, 1.4])
      d.ball(g, x, 5, -4.2, [0.45, x ? 0.7 : 1.1, 0.45], colour, 'rock');
    d.box(g, 3.2, 0.15, 0.9, 0, 0.75, 4.5, GOLD);
  }
}
