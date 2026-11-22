import { MeshBasicMaterial, RingGeometry } from 'three';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { heritageUpgrade } from '../../../data/heritageUpgrades';
import { MOON_PAD_TOP, moonPadRadius } from '../../../data/moonSettlement';
import { futureShape } from './futureShapes';
import {
  airlock,
  dome,
  gable,
  habitatGlass,
  lamp,
  module,
  moonParcelPad,
  moonRover,
  purposeModule,
  solarFin,
  vaultFrame,
  willowkinTree,
} from './moonKit';
import { moonFinish } from './moonFinishes';
import { RISING_FORMS } from './moonRising';
import { SIGNAL_FORMS } from './moonSignal';

// New Hollow on the Moon. Every building is drawn from the shared lunar kit (moonKit.js).
export { moonParcelPad, moonRover };
const TAU = Math.PI * 2;

// The Moon end of the ribbon: the anchor tower, a docked climber and cargo bays.
const RIBBON_HEIGHT = 140;
// The landing's climber, docked when drawn; the Moon scene moves it along the ribbon.
export const MOON_CLIMBER = 'Moon ribbon climber';
const FIRST_FORMS = {
  saucerPad(d, g, level) {
    // Keep the whole vertical flight column empty. The service hatch and cargo
    // stand outside the landing circle, with a straight public path at the front.
    d.geometries['moon-saucer-ring'] ??= new RingGeometry(3.05, 3.2, 48);
    const ring = d.mesh(g, 'moon-saucer-ring', [1, 1, 1], [0, 0.268, 0], p.glass);
    ring.material = new MeshBasicMaterial({ color: p.glass });
    ring.material.userData.transient = true;
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    ring.name = 'Saucer pad landing lights';
    module(d, g, 0, 4.5, 1.8, 1.4, 1.4);
    for (const x of [-4, 4]) for (const z of [-4, 4]) lamp(d, g, x, z, 0.25);
    if (level >= 2) {
      d.mesh(g, 'cylinder', [0.5, 1.2, 0.5], [-4.7, 0.86, -1.2], p.shell);
      d.mesh(g, 'cylinder', [0.52, 0.1, 0.52], [-4.7, 1.5, -1.2], p.light);
      d.rod(g, [-4.7, 0.4, -1.2], [-4.7, 0.4, 1.2], 0.07, p.roof);
      d.box(g, 0.9, 0.6, 0.9, 4.7, 0.56, -1.5, p.timber);
    }
    if (level >= 3) {
      const cargo = d.group(g);
      cargo.name = `Lunar purpose module ${heritageUpgrade('saucerPad')}`;
      cargo.userData.upgradeFeature = heritageUpgrade('saucerPad');
      for (const z of [-2.4, -0.6]) d.rod(cargo, [4.7, 0.26, z], [4.7, 2, z], 0.05, p.deep);
      d.box(cargo, 1.5, 0.1, 2.2, 4.7, 2, -1.5, p.roof);
      d.box(cargo, 0.9, 0.5, 0.7, 4.7, 1.1, -1.5, p.timber);
      d.rod(g, [0.6, 1.65, 4.5], [0.6, 2.8, 4.5], 0.04, p.deep);
      d.ball(g, 0.6, 2.9, 4.5, 0.16, p.light);
    }
  },
  ribbonLanding(d, g, level) {
    d.mesh(g, futureShape(d, 'octagon'), [1.3, 4.2, 1.3], [0, 2.35, 0], p.shell);
    d.mesh(g, futureShape(d, 'octagon'), [1.45, 0.2, 1.45], [0, 4.5, 0], p.light);
    const ribbon = d.mesh(
      g,
      'cylinder',
      [0.08, RIBBON_HEIGHT, 0.08],
      [0, 4.6 + RIBBON_HEIGHT / 2, 0],
      p.glass,
    );
    ribbon.castShadow = false;
    ribbon.name = 'Moon ribbon';
    // Sky parts are not the building: taps on the sky around them pass by.
    ribbon.userData.sky = true;
    // The climber rides the ribbon, so it stays out of the merged settlement mesh.
    const climber = d.group(g);
    climber.name = MOON_CLIMBER;
    climber.userData.animated = true;
    d.box(climber, 0.85, 1.1, 0.85, 0, 5.4, 0, p.shell, true).castShadow = false;
    d.box(climber, 0.9, 0.16, 0.9, 0, 5.0, 0, p.flower).castShadow = false;
    module(d, g, -2.9, 1.6, 1.8, 1.4, 1.2);
    airlock(d, g, 0, 0.75, 1.32);
    if (level >= 2) {
      module(d, g, 2.9, 1.6, 1.8, 1.4, 1.2);
      for (const x of [-1.6, 1.6]) d.box(g, 0.7, 0.6, 0.7, x, 0.55, 3.3, p.timber);
    }
    if (level >= 3) {
      const halo = d.mesh(g, futureShape(d, 'hoop'), [2.6, 2.6, 2.6], [0, 13, 0], p.shell);
      halo.userData.sky = true;
      halo.rotation.x = Math.PI / 2;
      halo.castShadow = false;
      for (const [x, z] of [
        [-4.2, -3.2],
        [4.2, -3.2],
        [-4.2, 3.4],
        [4.2, 3.4],
      ])
        lamp(d, g, x, z, 0.25);
    }
  },
  settlerDomes(d, g, level) {
    dome(d, g, -1.5, -0.6, 1.25);
    dome(d, g, 1.5, -0.4, 1.05, 0.75);
    if (level >= 2) dome(d, g, 0, -2.6, 1.1, 1.1);
    if (level >= 3) {
      purposeModule(d, g, 'settlerDomes', 0, 0.2, 1.3, 1.2, 0.8);
      for (const x of [-2.9, 2.9]) lamp(d, g, x, 2.2, 0.25);
      d.box(g, 2.2, 0.16, 0.5, 0, 0.32, 2.4, p.timber);
    }
  },
  craterIceWell(d, g, level) {
    // A drilling tripod over the crater ice.
    for (let n = 0; n < 3; n++) {
      const a = (n * TAU) / 3;
      d.rod(g, [Math.sin(a) * 1.6, 0.25, Math.cos(a) * 1.6 - 0.6], [0, 3.4, -0.6], 0.07, p.deep);
    }
    d.ball(g, 0, 0.55, -0.6, [0.9, 0.45, 0.9], p.glass, 'rock');
    d.mesh(g, 'cylinder', [0.85, 1.6, 0.85], [2.2, 1.05, 0.4], p.shell);
    d.mesh(g, 'cylinder', [0.88, 0.1, 0.88], [2.2, 1.9, 0.4], p.light);
    if (level >= 2) d.mesh(g, 'cylinder', [0.7, 1.3, 0.7], [-2.2, 0.9, 0.6], p.shell);
    if (level >= 3) {
      d.rod(g, [2.2, 1.3, 0.4], [-2.2, 1.3, 0.6], 0.08, p.roof);
      for (const [x, z] of [
        [-1, 2.2],
        [1.2, 2.4],
      ])
        d.ball(g, x, 0.45, z, [0.35, 0.3, 0.3], p.glass, 'rock');
    }
  },
  earthlightGreenhouse(d, g, level) {
    const vault = (x, z, len) => {
      d.box(g, len, 0.3, 1.8, x, 0.4, z, p.shell);
      habitatGlass(
        d,
        d.mesh(g, futureShape(d, 'dome'), [len / 2, 0.95, 0.9], [x, 0.55, z], p.glass),
      );
      vaultFrame(d, g, x, z, len);
      for (let n = 0; n < 4; n++)
        d.ball(
          g,
          x - len / 2 + 0.5 + n * ((len - 1) / 3),
          0.75,
          z,
          [0.3, 0.26, 0.3],
          p.green,
          'rock',
        );
    };
    vault(-0.3, -1.4, 4);
    module(d, g, -2.3, -1.4, 0.8, 1, 1, -Math.PI / 2).name = 'Greenhouse exposed airlock';
    solarFin(d, g, 2.9, 1.2, 0.3);
    if (level >= 2) vault(-0.3, 0.9, 3.4);
    if (level >= 3) {
      purposeModule(d, g, 'earthlightGreenhouse', 1.8, 1.8, 1.2, 1, 1);
      solarFin(d, g, -3, 1.6, -0.3);
      lamp(d, g, 2.6, 2.8, 0.25);
    }
  },
  willowkinDome(d, g, level) {
    const top = dome(d, g, 0, -0.4, 2.3, 0.5);
    willowkinTree(d, g, 0, 0.3, -0.5, 1.1);
    d.mesh(g, 'cylinder', [1.15, 0.025, 1.1], [0, 0.77, -0.5], p.green);
    for (const [x, z] of [
      [-0.9, 0.5],
      [0.8, 0.6],
    ])
      d.ball(g, x, 0.82, z, 0.12, p.flower, 'rock');
    if (level >= 2) {
      purposeModule(d, g, 'willowkinDome', 0, 2.05, 1.25, 0.8, 1.05);
      for (const x of [-3.4, 3.4]) lamp(d, g, x, 1.8, 0.25);
    }
    if (level >= 3) {
      dome(d, g, 3, -2.2, 0.9, 0.4);
      willowkinTree(d, g, 3, 0.3, -2.3, 0.45);
      d.ball(g, 0, top + 0.12, -0.4, 0.14, p.light, 'rock');
    }
  },
  newHollowCommons(d, g, level) {
    module(d, g, 0, -0.6, 4, 2, 1.5);
    dome(d, g, 0, -0.9, 1.1, 1.35, false);
    // The Prospect Hollow pennant flies on the Moon.
    d.rod(g, [-2.4, 0.25, 1.4], [-2.4, 3.2, 1.4], 0.04, p.deep);
    d.mesh(g, futureShape(d, 'pennant'), [0.8, 0.5, 1], [-2.4, 2.7, 1.4], p.flower);
    if (level >= 2) module(d, g, 2.9, -1.8, 1.4, 1.6, 1.1, Math.PI / 2);
    if (level >= 3) {
      d.mesh(g, futureShape(d, 'octagon'), [0.35, 3.2, 0.35], [-2.9, 1.85, -1.8], p.shell);
      d.ball(g, -2.9, 3.6, -1.8, 0.2, p.light, 'rock');
      d.box(g, 2, 0.14, 0.45, 0.6, 0.35, 2.3, p.timber);
    }
  },
  craterHomesteads(d, g, level) {
    gable(d, g, -1.6, -1, 1.8, 1.8, 1.5);
    gable(d, g, 1.7, -0.4, 1.6, 1.7, 1.3, p.flower);
    if (level >= 2) gable(d, g, 0.1, -3, 1.6, 1.4, 1.4);
    if (level >= 3) {
      const fence = d.group(g);
      fence.name = 'Homestead open frontage gate';
      for (const x of [-2.6, -1.6, -0.65, 0.65, 1.6, 2.4])
        d.box(fence, 0.08, 0.5, 0.08, x, 0.5, 2.6, p.timber);
      for (const [x, w] of [
        [-1.63, 1.94],
        [1.53, 1.74],
      ])
        d.box(fence, w, 0.06, 0.06, x, 0.65, 2.6, p.timber);
      moonRover(d, g, 2.4, 2.4, 0.4);
    }
  },
  moonstoneWorkshop(d, g, level) {
    module(d, g, -0.6, -0.8, 3, 1.9, 1.4);
    d.mesh(g, 'cylinder', [0.3, 1.6, 0.3], [-1.6, 2.2, -1.2], p.deep);
    // Polished moonstones glow on the display table.
    d.box(g, 1.4, 0.5, 0.6, 1.9, 0.5, 1.2, p.timber);
    for (const dx of [-0.4, 0, 0.4]) d.ball(g, 1.9 + dx, 0.88, 1.2, 0.13, p.glass, 'rock');
    if (level >= 2) dome(d, g, 2.2, -1.4, 0.8, 0.6);
    if (level >= 3) {
      d.rod(g, [-0.6, 1.65, -0.8], [-0.6, 2.75, -0.8], 0.08, p.deep).name =
        'Moonstone beacon mount';
      const crystal = d.ball(g, -0.6, 2.75, -0.8, [0.28, 0.5, 0.28], p.glass, 'rock');
      crystal.name = 'Moonstone beacon';
      lamp(d, g, -3, 1.6, 0.25);
    }
  },
  roverBarn(d, g, level) {
    gable(d, g, -0.8, -1.2, 3, 2.2, 1.6, p.flower);
    moonRover(d, g, 1.9, 1.6, -0.5);
    if (level >= 2) moonRover(d, g, -1.6, 2, 0.6);
    if (level >= 2) {
      const bay = d.group(g);
      bay.name = `Lunar purpose module ${heritageUpgrade('roverBarn')}`;
      bay.userData.upgradeFeature = heritageUpgrade('roverBarn');
      for (const x of [2.4, 3.4])
        for (const z of [-2.3, -1.3]) d.rod(bay, [x, 0.25, z], [x, 1.85, z], 0.05, p.deep);
      d.box(bay, 1.5, 0.1, 1.2, 2.9, 1.85, -1.8, p.roof);
      // The linking beam meets the barn wall and the bay frame.
      d.box(bay, 1.7, 0.1, 0.6, 1.55, 1.85, -1.8, p.roof);
      if (level >= 3) {
        d.box(bay, 0.9, 0.65, 0.35, 2.9, 0.58, -2.15, p.timber);
        d.box(bay, 0.95, 0.08, 0.4, 2.9, 0.94, -2.15, p.deep);
        d.box(bay, 0.25, 0.4, 0.2, 3.2, 1.18, -2.15, p.light);
      }
    }
  },
  earthriseLookout(d, g, level) {
    // A deck on stilts with a telescope pointed at the valley.
    d.box(g, 3.2, 0.18, 2.4, 0, 1.6, -0.4, p.timber);
    for (const x of [-1.4, 1.4])
      for (const z of [-1.4, 0.6]) d.box(g, 0.14, 1.5, 0.14, x, 0.85, z, p.deep);
    d.rod(g, [0.6, 1.7, -0.4], [1.1, 2.6, -1.3], 0.12, p.light);
    const stairs = d.group(g);
    stairs.name = 'Lookout stair access';
    const x = -0.7;
    for (let n = 0; n < 6; n++) {
      const height = (6 - n) * 0.22;
      d.box(stairs, 0.95, height, 0.32, x, MOON_PAD_TOP + height / 2, 0.94 + n * 0.3, p.timber);
    }
    for (const side of [-1, 1]) {
      const sx = x + side * 0.5;
      d.rod(stairs, [sx, 2.18, 0.82], [sx, 1.02, 2.62], 0.035, p.deep);
      for (const [z, top] of [
        [0.88, 2.18],
        [2.58, 1.02],
      ])
        d.rod(stairs, [sx, 0.3, z], [sx, top, z], 0.035, p.deep);
    }

    if (level >= 2)
      for (const z of [-1.55, 0.75]) {
        if (z < 0) d.box(g, 3.2, 0.06, 0.06, 0, 2.2, z, p.deep);
        else {
          // The front rail leaves the stair's full arrival opening clear.
          d.box(g, 0.35, 0.06, 0.06, -1.425, 2.2, z, p.deep);
          d.box(g, 1.75, 0.06, 0.06, 0.725, 2.2, z, p.deep);
          for (const x of [-1.25, -0.15]) d.rod(g, [x, 1.6, z], [x, 2.2, z], 0.035, p.deep);
        }
        for (const x of [-1.4, 1.4])
          d.rod(g, [x, 1.6, z], [x, 2.2, z], 0.035, p.deep).name = 'Lookout railing post';
      }
    if (level >= 3) {
      dome(d, g, -2.4, 1.8, 0.8, 0.5);
      d.box(g, 1.4, 0.16, 0.4, 1.2, 0.45, 2.2, p.timber);
    }
  },
};

// Every Moon building kind's form: the first lots, the outer ring (moonRising.js), then the
// Far Rim (moonSignal.js).
const FORMS = { ...FIRST_FORMS, ...RISING_FORMS, ...SIGNAL_FORMS };
export const MOON_FORMS = Object.freeze(Object.keys(FORMS));

/**
 * Draw one Moon building at its level, or a marked empty lot before it is built. `finish` is
 * the building's modernized finish, `{ era, level }` (the era's id and its era level, 0 to 3):
 * it adds that era's pieces on top (moonFinishes.js). Without one, the building is as built.
 */
export function renderMoonBuilding(d, parent, kind, level, finish = null) {
  const root = d.group(parent);
  root.name = `Moon ${kind} level ${level}`;
  root.userData.eraLevel = level;
  // Every parcel, built or empty, stands on the shared pad; forms build on top of it.
  const r = moonPadRadius(kind);
  moonParcelPad(d, root, r);
  if (level > 0 && FORMS[kind]) {
    FORMS[kind](d, root, level);
    const modern = moonFinish(kind, finish);
    if (modern) {
      const pieces = d.group(root);
      pieces.name = `Moon finish ${modern.era} level ${modern.level}`;
      root.userData.finish = { era: modern.era, level: modern.level };
      modern.draw(d, pieces);
    }
  } else {
    // An empty lot: four survey beacons on the rim of its pad.
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4 + TAU / 8,
        x = Math.sin(a) * (r - 0.7),
        z = Math.cos(a) * (r - 0.7);
      d.rod(root, [x, MOON_PAD_TOP, z], [x, 0.96, z], 0.04, p.deep);
      d.ball(root, x, 1.01, z, 0.08, p.light, 'rock');
    }
  }
  return root;
}
