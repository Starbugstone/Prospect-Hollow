import { cityModel } from './city';
import { CITY_BUILDINGS, CITY_FAMILIES } from '../../../data/city';
import { MOTOR_AGE_VARIANTS } from '../../../data/motorAge';
import { t } from '../../../i18n';
import { renderIndustrialLandmark } from './industrial';
import { renderLeisureBuilding } from '../LeisureAssets';

const cream = '#e1cfab',
  teal = '#648d89',
  glass = '#9cbbb5';
import { motorVehicle } from '../TownVehicles';
export { motorVehicle } from '../TownVehicles';
export function renderMotorBuilding(d, parent, kind, label, level = 1) {
  if (!['garage', 'busDepot', 'gardenCourt', 'diner'].includes(kind)) return false;
  const root = d.group(parent);
  root.name = `Motor Age ${kind} level ${level}`;
  root.userData.eraLevel = level;
  if (kind === 'gardenCourt') {
    for (let n = 0; n < level; n++) {
      const house = d.group(root, (n - (level - 1) / 2) * 1.8, 0, n % 2 ? -0.4 : 0);
      d.box(house, 1.6, 1.9, 2.3, 0, 1.03, 0, '#c4a38b');
      d.box(house, 1.8, 0.17, 2.5, 0, 2.05, 0, teal);
      d.box(house, 0.45, 1.05, 0.1, 0, 0.65, 1.2, teal);
      for (const x of [-0.5, 0.5]) d.window(house, x, 1.35, 1.22);
      d.box(house, 1.65, 0.12, 0.6, 0, 0.16, 1.5, cream);
    }
  } else {
    d.box(root, 3.6, 2.3, 2.7, 0, 1.22, 0, kind === 'diner' ? '#b88073' : cream);
    d.box(root, 3.9, 0.18, 2.95, 0, 2.5, 0, teal);
    if (kind === 'garage') {
      d.box(root, 1.75, 1.6, 0.14, -0.4, 0.9, 1.42, '#526b65');
      for (let n = 0; n < 5; n++)
        d.box(root, 1.65, 0.045, 0.04, -0.4, 0.35 + n * 0.28, 1.51, '#a3b8a8');
      motorVehicle(d, d.group(root, -0.45, 0, 2.05));
      d.window(root, 1.17, 1.4, 1.42);
    } else {
      for (const x of [-1.2, -0.4, 0.4, 1.2]) d.window(root, x, 1.5, 1.42);
      d.box(root, 4.1, 0.13, 1.1, 0, 1.95, 1.85, kind === 'diner' ? '#ead8af' : teal);
      for (const x of [-1.85, 1.85]) d.rod(root, [x, 0.15, 2.2], [x, 1.93, 2.2], 0.055, cream);
      if (kind === 'busDepot')
        motorVehicle(d, d.group(root, 0, 0, 2.5), true).rotation.y = Math.PI / 2;
      else
        for (const x of [-1.1, 1.1]) {
          d.box(root, 0.6, 0.1, 0.6, x, 0.7, 2.15, cream);
          d.rod(root, [x, 0, 2.15], [x, 0.7, 2.15], 0.065, teal);
        }
    }
    if (level >= 2) {
      d.box(root, 1.1, 2.55, 2.1, -2.2, 1.32, -0.1, cream);
      d.box(root, 1.3, 0.16, 2.3, -2.2, 2.68, -0.1, teal);
      d.window(root, -2.2, 1.6, 1.02);
    }
    if (level >= 3) {
      for (let n = 0; n < 3; n++)
        d.box(root, 1.3 - n * 0.22, 0.34, 0.6, 0.8, 2.75 + n * 0.34, 0.9, cream);
      d.ball(root, 0.8, 3.13, 1.24, [0.23, 0.23, 0.035], '#e9be68');
    }
  }
  for (let n = 0; n < level + 1; n++) {
    d.box(root, 0.55, 0.3, 0.5, 1.85 - n * 0.6, 0.18, -1.75, cream);
    d.ball(root, 1.85 - n * 0.6, 0.48, -1.75, [0.28, 0.32, 0.25], '#92aa78');
  }
  d.sign(root, label, 2.8, 0, kind === 'gardenCourt' ? 2.3 : 2.7, 1.55);
  return true;
}
export function addMotorModernization(d, parent, kind, level = 1) {
  const variant = MOTOR_AGE_VARIANTS[kind];
  if (!variant) return;
  const root = d.group(parent);
  root.name = `Motor Age ${kind} frontage ${level}`;
  if (['square', 'bridge', 'well', 'farm', 'fisherman', 'riverPort'].includes(kind)) {
    const reach = kind === 'bridge' ? 6.7 : 2.3;
    for (const side of [-1, 1]) {
      d.box(root, 0.42, 0.8 + level * 0.2, 0.45, side * reach, 0.45, 1.9, cream);
      d.rod(root, [side * reach, 0.8, 1.9], [side * reach, 2 + level * 0.25, 1.9], 0.045, teal);
      d.ball(root, side * reach, 2.05 + level * 0.25, 1.9, 0.18, '#f6db98');
    }
    if (kind === 'well' && level >= 2) {
      d.mesh(root, 'cylinder', [1.3, 0.5 + level * 0.3, 1.3], [0, 3.6, 0], '#8caaa3');
      d.mesh(root, 'cone', [1.38, 0.35, 1.38], [0, 4.4, 0], teal);
    }
    if (kind === 'farm' && level >= 2) {
      d.box(root, 2, 1.2, 1.7, -2, 0.7, 0, glass);
      for (const x of [-2.9, -2, -1.1]) d.rod(root, [x, 0.15, 0.9], [x, 1.3, 0.9], 0.035, cream);
    }
    return;
  }
  d.box(root, 3.8, 0.55, 0.2, 0, 3.05, 1.65, cream);
  d.box(root, 4.05, 0.16, 1.15, 0, 2.7, 1.9, teal);
  for (const x of [-1.65, 1.65]) d.box(root, 0.26, 2.45, 0.32, x, 1.45, 1.6, cream);
  if (level >= 2) {
    d.box(root, 1.1, 2.6, 1.7, -2.15, 1.38, 0, cream);
    d.box(root, 1.3, 0.18, 1.95, -2.15, 2.82, 0, teal);
    d.window(root, -2.15, 1.6, 0.92);
  }
  if (level >= 3)
    for (let n = 0; n < 3; n++)
      d.box(root, 1.45 - n * 0.3, 0.35, 0.5, 0.8, 3.46 + n * 0.35, 1.48, cream);
  d.sign(root, t(variant[0]), 3.1, 0, 3.04, 1.8);
}
export function renderMotorLandmark(d, parent, kind, label, level = 1) {
  if (
    renderLeisureBuilding(
      d,
      parent,
      kind,
      label,
      level,
      kind === 'horseField' && (d.town?.buildings.horseField ?? 3) >= 3,
    )
  )
    return true;
  if (renderMotorBuilding(d, parent, kind, label, level)) return true;
  if (CITY_BUILDINGS.some((b) => b.kind === kind && b.introducedEra === 'post-war')) {
    cityModel(d, parent, `post-war-${CITY_FAMILIES[kind]}`);
    addMotorModernization(d, parent, kind, level);
    return true;
  }
  const base = Object.create(d);
  base.sign = () => {};
  if (!renderIndustrialLandmark(base, parent, kind, label, level)) return false;
  addMotorModernization(d, parent, kind, level);
  return true;
}
