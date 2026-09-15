import { MINE_SHAFT } from './TownMineShaft';
import { pavedTown } from './TownEvolution';

// The encounter uses x ±3.4 from z -16.5 to -9.8. Keep that whole area
// walkable, with low worksite details tucked around the outside edges.
export function addMineForecourt(d, town) {
  const root = d.group(d.world);
  root.name = 'Mine forecourt';
  root.userData.static = true;
  const paved = pavedTown(town);
  const south = -8.7,
    north = MINE_SHAFT.rampStartZ;
  d.box(
    root,
    9.2,
    0.035,
    south - north,
    0,
    0.04,
    (south + north) / 2,
    paved ? '#b8b8a2' : '#c1ad85',
  );
  for (const side of [-1, 1]) {
    const width = 4.6 - MINE_SHAFT.bankWidth;
    d.box(
      root,
      width,
      0.035,
      north - MINE_SHAFT.portalZ,
      side * (4.6 - width / 2),
      0.04,
      (north + MINE_SHAFT.portalZ) / 2,
      paved ? '#b8b8a2' : '#c1ad85',
    );
  }
  for (const side of [-1, 1]) {
    for (let n = 0; n < 10; n++)
      d.box(
        root,
        0.14,
        0.08,
        0.75,
        side * 4.62,
        0.055,
        -18 + n * 0.92,
        paved ? '#d6d0b8' : '#9b8059',
      );
    const supplies = d.group(root, side * 4.95, 0, -18.5);
    supplies.name = 'Mine supplies outside the encounter lane';
    for (let n = 0; n < 3; n++) {
      d.box(
        supplies,
        0.55,
        0.48,
        0.55,
        (n % 2) * 0.6 - 0.3,
        0.27 + Math.floor(n / 2) * 0.48,
        0,
        '#a48b61',
      );
      d.box(
        supplies,
        0.08,
        0.44,
        0.57,
        (n % 2) * 0.6 - 0.3,
        0.27 + Math.floor(n / 2) * 0.48,
        0,
        '#d2b987',
      );
    }
    d.ball(supplies, side * 0.65, 0.17, 0.7, [0.35, 0.22, 0.3], '#8e9481', 'rock');
    d.ball(supplies, side * 0.6, 0.36, 0.7, [0.13, 0.2, 0.13], '#ad91bd', 'rock');
  }
  d.batch(root);
  return root;
}
