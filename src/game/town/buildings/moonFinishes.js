import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { futureShape } from './futureShapes';
import { habitatGlass, habitatRim, lamp } from './moonKit';
import {
  GROUND,
  expeditionRover,
  glassVault,
  orchardTree,
  planter,
  platformCanopy,
  tramCar,
  turned,
} from './moonRising';

// Modernized finishes of the first Moon lots. An era that modernizes a Moon building adds
// its own pieces to the building's form, one step for each era level (1 to 3). A finish
// only adds: the building beneath it, its hatch and its public path stay as they are, at
// every building level. A new era adds one entry to MOON_FINISHES.
const TAU = Math.PI * 2;

const HOLLOW_RISING = {
  // Ribbon Terminal: a second berth behind the tower, then a covered tram interchange.
  ribbonLanding(d, g, step) {
    const octagon = futureShape(d, 'octagon');
    // The berth stands off the tower's shoulder, so the town sees both climbers.
    const [x, z] = [1.5, -2.8];
    d.mesh(g, octagon, [0.75, 2.4, 0.75], [x, 1.45, z], p.shell).name = 'Terminal second berth';
    d.mesh(g, octagon, [0.86, 0.14, 0.86], [x, 2.7, z], p.light);
    d.rod(g, [0.6, 2.3, -1], [1.2, 2.3, -2.2], 0.14, p.roof);
    // A spare climber waits on the berth; the working one still rides the ribbon.
    d.box(g, 0.85, 1.1, 0.85, x, 3.4, z, p.shell, true);
    d.box(g, 0.9, 0.16, 0.9, x, 2.95, z, p.flower);
    if (step >= 2) {
      const halt = turned(d, g, -3, -1.3, Math.PI / 2);
      halt.name = 'Terminal tram interchange';
      for (const z of [-0.25, 0.25]) d.box(halt, 2.9, 0.05, 0.08, 0, 0.275, z, p.deep);
      tramCar(d, halt, 0, 0);
      platformCanopy(d, halt, 0, 0, 2.9, { posts: [-1.3, 1.3], depth: 1.5 });
      for (const px of [-1.3, 1.3]) d.rod(halt, [px, GROUND, 0.7], [px, 2.02, 0.7], 0.05, p.deep);
    }
    if (step >= 3) {
      const shelter = turned(d, g, 3, -1.3, Math.PI / 2);
      platformCanopy(d, shelter, 0, 0, 2.9, { posts: [-1.3, 1.3], depth: 1.5 });
      for (const px of [-1.3, 1.3])
        d.rod(shelter, [px, GROUND, 0.7], [px, 2.02, 0.7], 0.05, p.deep);
      d.box(shelter, 1.6, 0.14, 0.34, 0, 0.42, 0, p.timber);
      // A glazed control ring round the tower.
      d.mesh(g, octagon, [1.36, 0.5, 1.36], [0, 3.5, 0], p.glass).name = 'Terminal control ring';
      for (const y of [3.2, 3.8]) d.mesh(g, octagon, [1.42, 0.08, 1.42], [0, y, 0], p.light);
    }
  },
  // Deep Ice Works: a drill tower over the well.
  craterIceWell(d, g, step) {
    const z = -0.6,
      top = 5,
      spread = (y) => 1.15 - (0.85 * (y - GROUND)) / (top - GROUND);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        d.rod(
          g,
          [sx * 1.15, GROUND, z + sz * 1.15],
          [sx * 0.3, top, z + sz * 0.3],
          0.06,
          p.deep,
        ).name = 'Ice works derrick leg';
    for (const y of [2, 3.5]) {
      const r = spread(y);
      for (let n = 0; n < 4; n++) {
        const a = (n * TAU) / 4 + TAU / 8,
          b = a + TAU / 4,
          k = r * Math.SQRT2;
        d.rod(
          g,
          [Math.sin(a) * k, y, z + Math.cos(a) * k],
          [Math.sin(b) * k, y, z + Math.cos(b) * k],
          0.035,
          p.roof,
        );
      }
    }
    d.box(g, 0.9, 0.3, 0.9, 0, top + 0.1, z, p.shell).name = 'Ice works crown block';
    d.rod(g, [0, 0.7, z], [0, top, z], 0.07, p.glass).name = 'Ice works drill string';
    d.ball(g, 0, top + 0.4, z, 0.14, p.light, 'rock');
    if (step >= 2) {
      // A work deck in the tower, and a main that carries meltwater to the tank.
      const deck = spread(2) * 2;
      d.box(g, deck, 0.1, deck, 0, 2.06, z, p.roof).name = 'Ice works deck';
      d.box(g, deck + 0.06, 0.06, deck + 0.06, 0, 2.02, z, p.light);
      d.box(g, 0.5, 0.5, 0.5, 0.25, 2.36, z, p.shell);
      d.rod(g, [0.8, 2.1, z], [2.2, 1.95, 0.4], 0.07, p.glass);
    }
    if (step >= 3) {
      d.mesh(g, 'cylinder', [0.28, 3.2, 0.28], [-1.6, 1.85, -2.6], p.shell).name =
        'Ice works vent stack';
      d.mesh(g, 'cylinder', [0.31, 0.1, 0.31], [-1.6, 3.2, -2.6], p.light);
      d.mesh(g, 'cylinder', [0.34, 0.12, 0.34], [-1.6, 3.5, -2.6], p.roof);
      d.mesh(g, 'cylinder', [0.75, 0.9, 0.75], [1.9, 0.7, -2.3], p.shell);
      d.ball(g, 1.9, 1.16, -2.3, [0.55, 0.16, 0.55], p.glass).name = 'Meltwater sight tank';
      habitatGlass(
        d,
        d.mesh(g, futureShape(d, 'dome'), [0.7, 0.5, 0.7], [1.9, 1.15, -2.3], p.glass),
      );
      habitatRim(d, g, 1.9, 1.156, -2.3, 0.78);
      for (const side of [-1, 1]) d.ball(g, side * 0.5, top + 0.1, z + 0.5, 0.09, p.light, 'rock');
    }
  },
  // Double greenhouse: a second vault wing across the end of the first.
  earthlightGreenhouse(d, g, step) {
    const wing = turned(d, g, 2.55, -1.4, Math.PI / 2);
    wing.name = 'Greenhouse second wing';
    glassVault(d, wing, 0, 0, 3, { half: 0.75 });
    if (step < 2)
      for (const x of [-0.9, 0, 0.9]) d.ball(wing, x, 0.75, 0, [0.3, 0.26, 0.3], p.green, 'rock');
    if (step >= 2) {
      // Fruit trees fill the wing, and a glazed lantern rides the first vault's ridge.
      for (const x of [-0.9, 0, 0.9]) orchardTree(d, wing, x, 0, 0.62);
      d.box(g, 2.2, 0.14, 0.8, -0.3, 1.42, -1.4, p.shell).name = 'Greenhouse ridge lantern';
      habitatGlass(
        d,
        d.mesh(g, futureShape(d, 'dome'), [1.05, 0.55, 0.36], [-0.3, 1.49, -1.4], p.glass),
      );
    }
    if (step >= 3) {
      d.mesh(g, 'cylinder', [0.5, 1.3, 0.5], [-2.3, 0.9, -3], p.shell).name =
        'Greenhouse irrigation tank';
      d.mesh(g, 'cylinder', [0.53, 0.08, 0.53], [-2.3, 1.4, -3], p.light);
      d.rod(g, [-2.3, 0.6, -2.6], [-2, 0.6, -2.2], 0.06, p.roof);
      for (const x of [-1.3, -0.3, 0.7])
        d.ball(g, x, 2.08, -1.4, 0.08, p.light, 'rock').name = 'Grow light';
      for (const x of [-1, 0, 1])
        d.ball(wing, x, 0.61 + 0.95 * Math.sqrt(1 - (x / 1.5) ** 2), 0, 0.08, p.light, 'rock');
    }
  },
  // Town hall: a columned porch with flanking steps, then a cupola with a bell.
  newHollowCommons(d, g, step) {
    for (const x of [-1.6, -0.6, 0.6, 1.6])
      d.mesh(g, 'cylinder', [0.12, 1.5, 0.12], [x, 1, 0.8], p.shell).name = 'Town hall column';
    d.box(g, 3.7, 0.14, 0.5, 0, 1.82, 0.75, p.shell);
    d.mesh(g, futureShape(d, 'gable'), [3.7, 0.55, 0.5], [0, 1.89, 0.75], p.roof).name =
      'Town hall pediment';
    // The steps flank the hatch: the public path between them stays level.
    for (const side of [-1, 1]) {
      d.box(g, 1.5, 0.1, 0.45, side * 1.25, 0.3, 0.675, p.shell).name = 'Town hall step';
      d.box(g, 1.5, 0.1, 0.22, side * 1.25, 0.4, 0.56, p.shell);
    }
    if (step >= 2) {
      const x = 0,
        z = -0.9;
      d.mesh(g, futureShape(d, 'octagon'), [0.42, 0.2, 0.42], [x, 2.48, z], p.shell);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          d.rod(
            g,
            [x + sx * 0.26, 2.55, z + sz * 0.26],
            [x + sx * 0.26, 3.25, z + sz * 0.26],
            0.03,
            p.deep,
          );
      d.mesh(g, futureShape(d, 'peak'), [0.52, 0.48, 0.52], [x, 3.25, z], p.roof).name =
        'Town hall cupola';
      d.mesh(g, 'cone', [0.2, 0.28, 0.2], [x, 2.95, z], p.light).name = 'Town hall bell';
      d.ball(g, x, 3.78, z, 0.08, p.light, 'rock');
    }
    if (step >= 3) {
      const clock = d.group(g, 0, 2.08, 1.01);
      d.mesh(clock, futureShape(d, 'octagon'), [0.19, 0.06, 0.19], [0, 0, 0], p.shell).rotation.x =
        Math.PI / 2;
      d.mesh(
        clock,
        futureShape(d, 'octagon'),
        [0.24, 0.04, 0.24],
        [0, 0, -0.02],
        p.light,
      ).rotation.x = Math.PI / 2;
      d.box(g, 4.06, 0.08, 2.06, 0, 1.68, -0.6, p.light);
      lamp(d, g, 2.4, 1.6, GROUND);
      lamp(d, g, -2.7, 2.7, GROUND);
      planter(d, g, 2.95, 0.85, 0.8);
      planter(d, g, -3.2, 0.5, 0.8);
    }
  },
  // Rover depot: a second bay beside the barn, then the kit of a working depot.
  roverBarn(d, g, step) {
    d.box(g, 1.4, 1.3, 1.8, -3, 0.9, -1, p.shell).name = 'Depot second bay';
    const roof = d.mesh(g, 'cylinder', [0.7, 2, 0.4], [-3, 1.55, -1], p.roof);
    roof.rotation.x = Math.PI / 2;
    d.box(g, 1.46, 0.07, 1.86, -3, 1.52, -1, p.light);
    d.box(g, 1, 0.95, 0.06, -3, 0.725, -0.08, p.deep);
    if (step >= 2) {
      // A charging pylon and lamps along the barn's ridge.
      d.rod(g, [-3.6, GROUND, 2], [-3.6, 2.1, 2], 0.05, p.deep).name = 'Depot charging pylon';
      d.box(g, 0.3, 0.4, 0.3, -3.6, 0.9, 2, p.shell);
      d.ball(g, -3.6, 2.2, 2, 0.13, p.light, 'rock');
      for (const z of [-2, -1.2, -0.4]) d.ball(g, -0.8, 2.92, z, 0.09, p.light, 'rock');
    }
    if (step >= 3) {
      expeditionRover(d, g, -3, 0.75, 0.25);
      d.rod(g, [-0.8, 2.8, -1.2], [-0.8, 4.2, -1.2], 0.035, p.deep).name = 'Depot mast';
      d.mesh(g, futureShape(d, 'pennant'), [0.7, 0.42, 1], [-0.8, 3.74, -1.2], p.flower);
    }
  },
};

const MOON_FINISHES = { 'hollow-rising': HOLLOW_RISING };
/** Every (era, kind) that has a modernized Moon finish, for tests and fixtures. */
export const MOON_FINISH_KINDS = Object.freeze(
  Object.fromEntries(
    Object.entries(MOON_FINISHES).map(([era, kinds]) => [era, Object.freeze(Object.keys(kinds))]),
  ),
);
// A modernization has this many era levels, as in the valley.
const FINISH_LEVELS = 3;
/**
 * The pieces a finish adds to a Moon building, as `(d, group)`, or null: no finish, era
 * level 0, an era without Moon finishes or a kind it leaves alone all draw the building
 * exactly as it was.
 */
export function moonFinish(kind, finish) {
  const era = finish?.era,
    kinds = Object.hasOwn(MOON_FINISHES, era ?? '') ? MOON_FINISHES[era] : null,
    step = Math.min(FINISH_LEVELS, Math.floor(Number(finish?.level) || 0));
  if (!kinds || !Object.hasOwn(kinds, kind) || step < 1) return null;
  return { era, level: step, draw: (d, g) => kinds[kind](d, g, step) };
}
