import { walkObstacle } from '../TownNavigation';
import { addSquareModernization } from '../TownSquare';
import { bridgeDeckHeight } from '../TownRiver';
import { addHeritageUpgrade } from './HeritageDetails';
import { addFishingDock } from './river';
import { INDUSTRIAL_VARIANTS, ELECTRIC_LAMPS, hasElectricity } from '../../../data/industrial';
import { t } from '../../../i18n';
import { renderLeisureBuilding } from '../LeisureAssets';

const brick = '#aa795f',
  trim = '#dfcba4',
  iron = '#53726d';
function masonry(d, parent, width, height, depth, color = brick) {
  d.box(parent, width, height, depth, 0, height / 2, 0, color);
  for (let y = 0.35; y < height; y += 0.45)
    d.box(parent, width + 0.04, 0.035, depth + 0.04, 0, y, 0, '#c29a7a');
  d.box(parent, width + 0.3, 0.18, depth + 0.3, 0, height + 0.08, 0, iron);
}
export function renderIndustrialBuilding(d, parent, kind, label, level = 1) {
  if (!['powerHouse', 'fireStation', 'rowHouses', 'mill'].includes(kind)) return false;
  if (kind === 'rowHouses') {
    for (const x of [-1.5, 0, 1.5]) {
      const house = d.group(parent, x, 0, 0);
      masonry(d, house, 1.4, 3.3, 2.4, x === 0 ? '#b59478' : brick);
      d.box(house, 0.42, 1.05, 0.1, 0, 0.6, 1.25, iron);
      d.window(house, 0, 2.3, 1.25);
      d.box(house, 0.35, 0.55, 0.35, 0.35, 3.65, -0.6, brick);
      d.box(house, 1.3, 0.12, 0.55, 0, 0.12, 1.4, trim);
    }
  } else {
    masonry(d, parent, 3.2, 2.8, 2.6, kind === 'fireStation' ? '#b57560' : brick);
    for (const x of [-1.05, 1.05]) d.window(parent, x, 1.9, 1.35);
    d.box(parent, 1.3, 1.25, 0.12, 0, 0.7, 1.35, iron);
    if (kind === 'fireStation') {
      const tower = d.group(parent, -1.9, 0, -0.35);
      masonry(d, tower, 0.9, 4.1, 1.1);
      for (const y of [3.3, 3.5, 3.7]) d.box(tower, 0.6, 0.1, 0.08, 0, y, 0.58, iron);
      d.box(parent, 1.3, 0.45, 0.65, 1.1, 0.45, 2, '#a64e3e');
      for (const x of [0.65, 1.55])
        for (const z of [1.62, 2.38]) d.ball(parent, x, 0.23, z, [0.22, 0.22, 0.08], iron);
      d.rod(parent, [0.4, 0.95, 2], [1.8, 0.95, 2], 0.08, trim);
    } else {
      masonry(d, d.group(parent, -1.7, 0, -0.8), 0.5, kind === 'mill' ? 4.3 : 3.8, 0.5);
      if (kind === 'powerHouse') {
        for (const x of [1.9, 2.6]) {
          d.mesh(parent, 'cylinder', [0.25, 1.1, 0.25], [x, 0.6, 0], iron);
          d.ball(parent, x, 1.25, 0, [0.16, 0.12, 0.16], trim);
        }
        d.rod(parent, [1.9, 1.3, 0], [2.6, 1.3, 0], 0.045, '#bd9b67');
      } else {
        d.box(parent, 2.2, 0.18, 1.4, 1, 0.15, 1.9, trim);
        for (const x of [0.4, 1.2, 2]) d.box(parent, 0.5, 0.65, 0.5, x, 0.55, 1.85, '#ad966c');
      }
    }
  }
  d.sign(parent, label, 2.8, 0, kind === 'rowHouses' ? 3.55 : 3.15, 1.45);
  addIndustrialTier(d, parent, kind, level);
  return true;
}

export function addIndustrialModernization(d, parent, kind, level = 1) {
  const variant = INDUSTRIAL_VARIANTS[kind];
  if (!variant) return;
  if (kind === 'square') return addSquareModernization(d, parent, level, iron);
  if (['bridge'].includes(kind)) addIndustrialTier(d, parent, kind, level);
  if (kind === 'square') {
    for (const x of [-2.5, 2.5]) d.box(parent, 0.22, 0.14, 5.2, x, 0.13, 0, trim);
    return;
  }
  if (kind === 'bridge') {
    for (const x of [-6.8, 6.8])
      for (const z of [-1.15, 1.15]) d.box(parent, 0.45, 1.35, 0.45, x, 0.65, z, '#a6aa99');
    return;
  }
  if (kind === 'well') {
    const tank = d.group(parent, 1.9, 0, -0.2);
    for (const x of [-0.5, 0.5])
      for (const z of [-0.5, 0.5]) d.rod(tank, [x, 0, z], [x, 2.3, z], 0.07, iron);
    d.mesh(tank, 'cylinder', [0.85, 1.3, 0.85], [0, 2.6, 0], '#89a39b');
    d.rod(parent, [1.9, 1.8, -0.2], [0.7, 1.8, -0.2], 0.09, iron);
    return;
  }
  for (const x of [-1.55, 1.55]) {
    d.box(parent, 0.3, 2.6, 0.4, x, 1.35, 1.5, brick);
    for (let y = 0.35; y < 2.6; y += 0.4) d.box(parent, 0.32, 0.035, 0.42, x, y, 1.5, trim);
  }
  d.box(parent, 3.7, 0.2, 1.2, 0, 2.6, 1.7, iron);
  d.sign(parent, t(variant[0]), 2.8, 0, 2.95, 1.6);
  if (kind === 'railDepot') {
    d.box(parent, 6.2, 0.18, 2.1, 0, 2.7, -2.3, iron);
    for (const x of [-2.8, 2.8]) d.rod(parent, [x, 0.2, -2.3], [x, 2.7, -2.3], 0.07, iron);
    const cabin = d.group(parent, 2.65, 0, 0);
    masonry(d, cabin, 1.1, 2.1, 1.2);
    d.window(cabin, 0, 1.5, 0.63);
    d.rod(cabin, [0, 2.2, 0], [0, 3.2, 0], 0.06, iron);
    d.box(cabin, 0.85, 0.15, 0.1, 0.35, 3.1, 0, '#b77560');
  }
}

export function addElectricLighting(d, town) {
  if (!hasElectricity(town)) return;
  const lights = d.group(d.world);
  lights.name = 'First Lights electric street lamps';
  lights.userData.static = true;
  for (const [x, z] of ELECTRIC_LAMPS) {
    walkObstacle(lights, x, z, 0.15);
    d.mesh(lights, 'cylinder', [0.15, 0.2, 0.15], [x, 0.13, z], iron);
    d.rod(lights, [x, 0.2, z], [x, 2.5, z], 0.055, iron);
    d.ball(lights, x, 2.62, z, [0.22, 0.27, 0.22], '#fff0b6');
    d.box(lights, 0.38, 0.09, 0.38, x, 2.9, z, iron);
  }
  // Static globes stay readable in daylight without adding seven shadow-casting lights.
  d.batch(lights);
  return lights;
}

// Whole architectural families replace the timber shells. Landmark positions,
// services and identifying details survive; the silhouette changes at completion.
export function renderIndustrialLandmark(d, parent, kind, label, level = 1) {
  if (renderLeisureBuilding(d, parent, kind, label, level)) return true;
  if (!INDUSTRIAL_VARIANTS[kind] || ['square', 'bridge'].includes(kind)) return false;
  if (kind === 'well') {
    masonry(d, parent, 2.2, 1.7, 2.1, '#9da99d');
    d.box(parent, 0.65, 1.1, 0.12, 0, 0.6, 1.1, iron);
    addIndustrialModernization(d, parent, kind);
  } else if (kind === 'farm') {
    masonry(d, parent, 3.3, 2.7, 3, '#ad795d');
    d.box(parent, 1.6, 1.7, 0.1, 0, 0.9, 1.55, iron);
    d.mesh(parent, 'cylinder', [0.75, 4.1, 0.75], [2.4, 2.1, -0.6], '#a6b0a0');
    d.mesh(parent, 'cone', [0.85, 0.75, 0.85], [2.4, 4.5, -0.6], iron);
    for (let n = 0; n < 4; n++) d.box(parent, 3, 0.1, 0.18, 0, 0.1, 1.9 + n * 0.3, '#9b9e62');
  } else if (['fisherman', 'riverPort'].includes(kind)) {
    addFishingDock(d, parent, level, kind === 'riverPort');
    masonry(d, parent, 2.7, 1.9, 2.3, '#a1a998');
    d.box(parent, 2.8, 0.25, 2.5, 2.8, 0.1, 0, '#9caa9d');
    d.box(parent, 3, 0.18, 2.7, 2.8, 2, 0, iron);
    for (const x of [1.5, 4])
      for (const z of [-1, 1]) d.rod(parent, [x, 0.2, z], [x, 2, z], 0.07, iron);
    for (const x of [1.9, 2.7, 3.5]) d.box(parent, 0.5, 0.5, 0.6, x, 0.45, 0, '#bb9f73');
  } else {
    const tall = [
      'home',
      'saloon',
      'hotel',
      'bank',
      'school',
      'museum',
      'post',
      'doctor',
      'sheriff',
    ].includes(kind);
    const height = tall ? 4.2 : 2.9;
    const color = ['school', 'doctor', 'museum', 'bank'].includes(kind) ? '#b6a38b' : brick;
    masonry(d, parent, 3.6, height, 2.9, color);
    for (const y of tall ? [1.5, 3.1] : [1.7])
      for (const x of [-1.15, 1.15]) d.window(parent, x, y, 1.5);
    d.box(parent, 0.8, 1.3, 0.12, 0, 0.7, 1.5, iron);
    d.box(parent, 3.9, 0.15, 1, 0, 2.2, 1.8, iron);
    if (kind === 'home') {
      for (const side of [-1, 1]) {
        const roof = d.box(parent, 2.3, 0.16, 3.3, side * 0.85, 4.7, 0, iron);
        roof.rotation.z = -side * 0.42;
      }
      d.box(parent, 0.45, 1, 0.5, 1, 4.7, -0.6, brick);
    }
    if (['saloon', 'hotel'].includes(kind)) {
      d.box(parent, 3.9, 0.16, 1, 0, 2.7, 1.8, trim);
      for (const x of [-1.7, 1.7]) d.rod(parent, [x, 0, 2.1], [x, 2.7, 2.1], 0.07, iron);
      d.rod(parent, [-1.8, 3.25, 2.2], [1.8, 3.25, 2.2], 0.04, iron);
    }
    if (['bank', 'museum', 'sheriff'].includes(kind)) {
      for (const x of [-0.65, 0.65]) d.box(parent, 0.25, 2.4, 0.3, x, 1.3, 1.8, trim);
      d.box(parent, 1.8, 0.3, 0.6, 0, 2.6, 1.8, trim);
      d.ball(parent, 0, 3.5, 1.52, [0.28, 0.28, 0.08], '#e5c47a');
    }
    if (kind === 'museum') {
      for (const x of [-1.3, 1.3]) {
        d.box(parent, 0.8, 0.65, 0.75, x, 0.45, 2.2, trim);
        d.ball(parent, x, 1.15, 2.2, [0.25, 0.4, 0.25], '#a28abd', 'rock');
      }
      d.box(parent, 1, 1.1, 1, 0, 4.8, -0.2, trim);
      d.ball(parent, 0, 4.9, 0.35, [0.32, 0.32, 0.05], '#e5c47a');
    }
    if (kind === 'school') {
      for (const x of [-0.35, 0.35])
        for (const z of [-0.35, 0.35]) d.rod(parent, [x, 4.2, z], [x, 5.1, z], 0.045, iron);
      d.box(parent, 1.05, 0.12, 1.05, 0, 5.1, 0, iron);
      d.mesh(parent, 'cone', [0.22, 0.35, 0.22], [0, 4.68, 0], '#c6a562');
      d.rod(parent, [0, 4.8, 0], [0, 5.1, 0], 0.025, iron);
    }
    if (kind === 'doctor') {
      d.box(parent, 0.22, 0.8, 0.1, 0, 3.35, 1.52, '#538e78');
      d.box(parent, 0.8, 0.22, 0.1, 0, 3.35, 1.53, '#538e78');
    }
    if (['blacksmith', 'armory', 'warehouse', 'stable'].includes(kind)) {
      const wing = d.group(parent, 2.3, 0, 0);
      masonry(d, wing, 1.3, 1.8, 2.5, '#a69b82');
      d.box(wing, 0.8, 1.2, 0.1, 0, 0.65, 1.3, iron);
    }
    if (kind === 'blacksmith') {
      d.group(parent, -1.8, 4.5, -0.7).name = 'chimney';
      masonry(d, d.group(parent, -1.8, 0, -0.7), 0.55, 4.4, 0.6);
      d.box(parent, 1, 0.6, 0.7, 1, 0.4, 2.2, iron);
    }
    if (kind === 'stable') {
      // A broad roller door makes the former stables read as a garage.
      d.box(parent, 2.35, 1.7, 0.15, 0, 0.95, 1.6, '#607c75');
      for (let n = 0; n < 6; n++)
        d.box(parent, 2.2, 0.045, 0.035, 0, 0.28 + n * 0.27, 1.7, '#bbc6b6');
      d.box(parent, 0.35, 0.85, 0.35, 2.4, 0.48, 1.7, '#bc9273');
    }
    if (kind === 'market') {
      d.box(parent, 4.4, 0.18, 2.1, 0, 2.2, 2.1, iron);
      for (const x of [-1.8, 0, 1.8]) {
        d.box(parent, 1.1, 0.7, 0.7, x, 0.4, 2.2, '#bd9b69');
        d.ball(parent, x, 0.9, 2.2, [0.3, 0.2, 0.3], '#b4b969');
      }
    }
    if (kind === 'railDepot') addIndustrialModernization(d, parent, kind);
  }
  d.sign(parent, t(INDUSTRIAL_VARIANTS[kind][0]) || label, 3, 0, kind === 'well' ? 2 : 3.2, 1.7);
  addIndustrialTier(d, parent, kind, level);
  return true;
}

function addIndustrialTier(d, parent, kind, level) {
  const tier = d.group(parent);
  tier.name = `Industrial ${kind} level ${level}`;
  tier.userData.eraLevel = level;
  if (level < 2) return;
  if (kind === 'bridge') {
    for (const z of [-1.15, 1.15]) {
      const height = (x) => bridgeDeckHeight(x + 31) + 0.3;
      for (let x = -6; x < 6; x += 0.5) {
        d.rod(tier, [x, height(x) + 0.9, z], [x + 0.5, height(x + 0.5) + 0.9, z], 0.1, iron);
        if (level >= 3) d.rod(tier, [x, height(x), z], [x, height(x) + 1.7, z], 0.06, iron);
      }
    }
    return;
  }
  if (['square', 'well', 'farm', 'fisherman', 'riverPort'].includes(kind)) {
    const annex = d.group(tier, -2.1, 0, 0);
    masonry(d, annex, 1, 1.25, 1.5, '#b0af98');
    if (level === 3) {
      d.rod(annex, [0, 1.4, 0], [0, 3.6, 0], 0.09, iron);
      d.ball(annex, 0, 3.7, 0, [0.3, 0.35, 0.3], '#ffe6a2');
    }
    return;
  }
  const wing = d.group(tier, -2.45, 0, 0.15);
  masonry(d, wing, 1.25, 2.5, 2.5, '#bd9678');
  d.window(wing, 0, 1.65, 1.3);
  if (level >= 3) addHeritageUpgrade(d, tier, kind, true);
}
