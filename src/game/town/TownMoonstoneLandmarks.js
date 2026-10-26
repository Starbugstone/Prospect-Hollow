// Keepsake monuments use a small shared mineral palette. Each form owns its
// silhouette and tier additions; lunar designs contain only carved lunar rock.
export const MOONSTONE_LANDMARK_FORMS = [
  'moonstone-fountain',
  'homeward-obelisk',
  'lunar-pavilion',
  'moonstone-henge',
  'earthlight-spire',
  'crater-amphitheatre',
];
const ROCK = '#aaa79f',
  CRYSTAL = '#a6cfdf',
  VIOLET = '#b8a4d8';
export function buildMoonstoneLandmark(d, g, option, tier, move) {
  const h = 3.5 + tier * 1.05;
  d.group(g, 0, 0, 4.8).name = 'Monument entrance';
  const glint = d.ball(g, 0, 1.1, 4.5, [0.18, 0.3, 0.18], CRYSTAL, 'rock');
  move(glint, 'pulse', 'y', 0.8, 0.12);
  const crystal = (x, y, z, width, height, colour = option.colour) =>
    d.ball(g, x, y, z, [width, height, width], colour, 'rock');
  if (option.form === 'moonstone-fountain') {
    for (let n = 0; n < 3; n++) {
      const r = 3.4 - n * 0.85;
      d.mesh(g, 'cylinder', [r, 0.5, r], [0, 1 + n * h * 0.2, 0], ROCK);
      d.mesh(g, 'cylinder', [r - 0.2, 0.06, r - 0.2], [0, 1.27 + n * h * 0.2, 0], CRYSTAL);
    }
    crystal(0, h * 0.7, 0, 0.65, h * 0.3);
    for (let n = 0; n < 4 + tier; n++) {
      const a = (n * Math.PI * 2) / (4 + tier);
      const droplet = crystal(Math.cos(a) * 2.6, 2.3, Math.sin(a) * 2.6, 0.12, 0.4);
      move(droplet, 'lift', 'y', 1.2, 0.4, a);
    }
  } else if (option.form === 'homeward-obelisk') {
    d.box(g, 2.8, 0.7, 2.8, 0, 0.95, 0, ROCK);
    crystal(0, h / 2 + 1.3, 0, 1.15, h / 2);
    // A tilted annulus frames the solitary needle.
    const halo = d.mesh(g, 'ring', [2.5, 2.5, 2.5], [0, h * 0.65, 0], VIOLET);
    halo.rotation.x = 0.35;
    move(halo, 'turn', 'y', 0.15);
  } else if (option.form === 'lunar-pavilion') {
    for (const x of [-2.6, 2.6])
      for (const z of [-2.4, 2.4]) crystal(x, h / 2 + 0.6, z, 0.35, h / 2);
    d.mesh(g, 'cone', [4.2, 2.3, 4.2], [0, h + 1.6, 0], VIOLET);
    d.mesh(g, 'cylinder', [4.2, 0.22, 4.2], [0, h + 0.5, 0], CRYSTAL);
    crystal(0, 1.8, 0, 0.75, 1.1);
  } else if (option.form === 'moonstone-henge') {
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      const x = Math.cos(a) * 3.4,
        z = Math.sin(a) * 3.4;
      d.box(g, 0.85, h * 0.65, 1.2, x, 0.6 + h * 0.325, z, ROCK).rotation.y = -a;
      crystal(x, h * 0.65 + 1, z, 0.5, 0.65);
      if (n % 2 === 0) {
        const b = a + Math.PI / 3;
        d.rod(
          g,
          [x, h * 0.65 + 0.8, z],
          [Math.cos(b) * 3.4, h * 0.65 + 0.8, Math.sin(b) * 3.4],
          0.45,
          ROCK,
        );
      }
    }
    crystal(0, 1.6, 0, 0.8, 1);
  } else if (option.form === 'earthlight-spire') {
    for (const side of [-1, 1]) {
      const shard = crystal(side * 1.1, h / 2 + 0.6, 0, 0.9, h / 2, side < 0 ? VIOLET : CRYSTAL);
      shard.rotation.z = -side * 0.14;
    }
    for (let n = 0; n < 3 + tier; n++) {
      const a = (n * Math.PI * 2) / (3 + tier);
      crystal(Math.cos(a) * 3.6, 1.25, Math.sin(a) * 3.6, 0.35, 0.65);
    }
  } else if (option.form === 'crater-amphitheatre') {
    // A horseshoe of ascending terraces leaves the audience entrance open.
    for (let row = 0; row < 2 + tier; row++) {
      const r = 2.4 + row * 0.42;
      for (let n = 0; n < 10; n++) {
        const a = Math.PI * (0.05 + (n / 10) * 1.9);
        const seat = d.box(
          g,
          1.15,
          0.35 + row * 0.3,
          0.55,
          Math.cos(a) * r,
          0.8 + row * 0.15,
          -Math.sin(a) * r,
          ROCK,
        );
        seat.rotation.y = a;
      }
    }
    d.mesh(g, 'cylinder', [1.6, 0.4, 1.6], [0, 0.8, 0], VIOLET);
    crystal(0, 1.9, 0, 0.55, 1);
  }
  // Milestones add a mineral procession and a faceted rear crown, never metal or water on the Moon.
  for (let n = 0; n < tier - 1; n++)
    for (const side of [-1, 1])
      crystal(side * 4.6, 1.2 + n * 0.2, 2.8 - n * 1.5, 0.3, 0.6 + n * 0.2);
  if (tier >= 4) for (const x of [-3, 0, 3]) crystal(x, 2, -4.3, 0.5, 1.4, VIOLET);
  if (tier >= 5) d.rod(g, [-3, 3.2, -4.3], [3, 3.2, -4.3], 0.25, CRYSTAL);
}
