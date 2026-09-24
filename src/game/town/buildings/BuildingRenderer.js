import { addSquareModernization } from '../TownSquare';
import { addHeritageUpgrade } from './HeritageDetails';
import { renderWatermill } from './watermill';
import { eraEvolution } from '../../../data/eras';
import { addCityModernization, renderCityBuilding } from './city';
import { CITY_BUILDINGS } from '../../../data/city';
import { renderFrontierBuilding } from './frontier';
import { addCivicDetails } from './civic';
import { addFishingDock } from './river';
import { renderBridge, addStationDetails } from './infrastructure';
import { RIVER_RAIL_VARIANTS } from '../../../data/riverRail';
import { BUILDINGS } from '../../../data/town';
import { t } from '../../../i18n';
import {
  renderIndustrialBuilding,
  addIndustrialModernization,
  renderIndustrialLandmark,
} from './industrial';
import { renderMotorBuilding, addMotorModernization, renderMotorLandmark } from './motorAge';
import { renderLeisureBuilding } from '../LeisureAssets';

const kinds = {
  powerHouse: 'armory',
  fireStation: 'sheriff',
  rowHouses: 'home',
  mill: 'farm',
  garage: 'armory',
  busDepot: 'museum',
  gardenCourt: 'home',
  diner: 'saloon',
  riverPort: 'fisherman',
  railDepot: 'museum',
  post: 'shop',
  warehouse: 'armory',
  hotel: 'saloon',
  market: 'shop',
};
export function renderBuilding({
  town: d,
  parent,
  kind,
  level,
  era = 'frontier',
  construction = false,
  label,
}) {
  if (kind === 'watermill' && !construction && level > 0)
    return renderWatermill(d, parent, era, level, label);
  if (!construction && level > 0 && renderCityBuilding(d, parent, kind, label, level, era, level))
    return;
  const city = CITY_BUILDINGS.find((b) => b.kind === kind);
  if (
    !construction &&
    level > 0 &&
    city &&
    renderCityBuilding(d, parent, kind, label, level, city.introducedEra, level)
  )
    return;
  if (kind === 'bridge') return renderBridge(d, parent, level);
  if (!construction && level > 0 && renderLeisureBuilding(d, parent, kind, label, level)) return;
  if (!construction && level > 0 && renderMotorBuilding(d, parent, kind, label, level)) return;
  if (!construction && level > 0 && renderIndustrialBuilding(d, parent, kind, label, level)) return;
  renderFrontierBuilding(d, parent, kinds[kind] ?? kind, level, label, construction, !kinds[kind]);
  if (construction) return;
  if (['blacksmith', 'school', 'doctor'].includes(kind)) addCivicDetails(d, parent, kind, level);
  if (kind === 'fisherman' || kind === 'riverPort')
    addFishingDock(d, parent, level, kind === 'riverPort');
  if (kind === 'railDepot') addStationDetails(d, parent);
  if (era !== 'frontier') renderModernization(d, parent, kind, era);
}
/**
 * @typedef {(d: Object, parent: Object, kind: string, era: string, level: number) => void} ModernizationRenderer
 * @typedef {(d: Object, parent: Object, kind: string, label: string, level: number, era: string, serviceLevel: number) => boolean} LandmarkRenderer
 * @type {Record<string, {modernize: ModernizationRenderer, landmark?: LandmarkRenderer}>}
 */
const ERA_RENDERERS = {
  'river-rail': {
    modernize: (d, parent, kind, era, level) => renderRiverModernization(d, parent, kind, level),
  },
  industrial: {
    modernize: (d, parent, kind, era, level) => addIndustrialModernization(d, parent, kind, level),
    landmark: (d, parent, kind, label, level) =>
      renderIndustrialLandmark(d, parent, kind, label, level),
  },
  'motor-age': {
    modernize: (d, parent, kind, era, level) => addMotorModernization(d, parent, kind, level),
    landmark: (d, parent, kind, label, level, era) =>
      renderMotorLandmark(d, parent, kind, label, level, era),
  },
  city: {
    modernize: addCityModernization,
    landmark: (d, parent, kind, label, level, era, serviceLevel) =>
      renderCityBuilding(d, parent, kind, label, level, era, serviceLevel),
  },
};
export function renderModernization(d, parent, kind, era, level = 1) {
  return ERA_RENDERERS[eraEvolution(era).style]?.modernize(d, parent, kind, era, level);
}
export function renderEraLandmark(d, parent, kind, label, level, era, serviceLevel) {
  if (kind === 'watermill') {
    renderWatermill(
      d,
      parent,
      era,
      eraEvolution(era).style === 'frontier' ? serviceLevel : level,
      label,
    );
    return true;
  }
  return (
    ERA_RENDERERS[eraEvolution(era).style]?.landmark?.(
      d,
      parent,
      kind,
      label,
      level,
      era,
      serviceLevel,
    ) ?? false
  );
}
function renderRiverModernization(d, parent, kind, level) {
  if (kind === 'square') return addSquareModernization(d, parent, level);
  const originalKind = kind;
  kind = kinds[kind] ?? kind;
  if (!RIVER_RAIL_VARIANTS[kind]) return;
  const modern = d.group(parent);
  modern.name = `River & Rail ${kind}`;
  parent = modern;
  modern.userData.eraLevel = level;
  if (level >= 2 && !['well', 'square', 'fisherman'].includes(kind)) {
    d.box(parent, 1.15, 2.15, 2.1, -1.95, 1.22, -0.2, '#ad725c');
    d.box(parent, 1.45, 0.18, 2.35, -1.95, 2.4, -0.2, '#526e79');
    d.window(parent, -1.95, 1.4, 0.9);
  }
  if (level >= 3) addHeritageUpgrade(d, parent, originalKind);
  if (level >= 2 && ['well', 'square', 'fisherman'].includes(kind)) {
    for (const side of [-1, 1]) {
      d.box(parent, 0.6, 0.55, 1.2, side * 1.75, 0.3, 0.3, '#aaa58f');
      if (level >= 3) d.mesh(parent, 'cone', [0.45, 1.1, 0.45], [side * 1.75, 1.1, 0.3], '#5d8176');
    }
  }
  const colors = {
    home: '#ad8e79',
    farm: '#ad795c',
    well: '#8b9b96',
    saloon: '#bb9c78',
    stable: '#a18e6c',
    sheriff: '#899c98',
    bank: '#aaa28b',
    shop: '#ac937b',
    museum: '#b6a78b',
    armory: '#8c9990',
    square: '#aeab90',
    blacksmith: '#976f57',
    fisherman: '#849b91',
    school: '#beaa85',
    doctor: '#9daa9b',
  };
  if (kind === 'square') {
    for (const x of [-2.3, 2.3])
      for (const z of [-2, 2]) {
        d.rod(parent, [x, 0, z], [x, 2.8, z], 0.05, '#69766c');
        d.box(parent, 0.25, 0.35, 0.25, x, 2.85, z, '#ebd2a0');
      }
    return;
  }
  if (kind === 'well') {
    for (const x of [-0.85, 0.85])
      for (const z of [-0.65, 0.65]) {
        d.rod(parent, [x, 0, z], [x, 2.55, z], 0.07, '#657d79');
        d.rod(parent, [x, 0.5, z], [-x, 2.4, z], 0.035, '#657d79');
      }
    d.mesh(parent, 'cylinder', [0.95, 0.85, 0.95], [0, 2.8, 0], '#698e8c');
    for (const y of [2.42, 3.18])
      d.mesh(parent, 'cylinder', [0.99, 0.08, 0.99], [0, y, 0], '#d3c9a7');
    d.mesh(parent, 'cone', [1.05, 0.45, 1.05], [0, 3.42, 0], '#526e75');
    d.rod(parent, [1.1, 0.2, 0.4], [1.1, 1.5, 0.4], 0.08, '#81918b');
    d.rod(parent, [1.1, 1.5, 0.4], [0.6, 1.5, 0.4], 0.08, '#81918b');
    return;
  }
  // Brick side walls and slate roof replace the timber appearance on the first modernization.
  const brick = ['home', 'saloon', 'school', 'blacksmith', 'farm'].includes(kind)
    ? '#a5624f'
    : '#9d9484';
  for (const side of [-1, 1]) {
    d.box(parent, 0.14, 1.9, 2.48, side * 1.4, 1.2, 0, brick);
    for (let row = 0; row < 9; row++) {
      const y = 0.37 + row * 0.2;
      d.box(parent, 0.16, 0.027, 2.5, side * 1.4, y, 0, '#d6c9ad');
      for (let z = -1; z <= 1; z += 0.5)
        d.box(parent, 0.16, 0.18, 0.025, side * 1.4, y + 0.1, z + (row % 2) * 0.23, '#d6c9ad');
    }
    const roof = d.box(parent, 1.9, 0.13, 2.95, side * 0.77, 2.61, 0, '#526e79');
    roof.rotation.z = -side * 0.54;
  }
  // A taller masonry street front, cornice and porch change the building silhouette.
  d.box(parent, 2.95, 1.12, 0.24, 0, 2.71, 1.45, brick);
  for (const y of [2.21, 3.22, 3.36]) d.box(parent, 3.32, 0.12, 0.4, 0, y, 1.49, '#e0cfac');
  for (const x of [-1.05, 0, 1.05]) d.box(parent, 0.25, 0.3, 0.35, x, 3.47, 1.49, '#c9ba99');
  d.box(parent, 3.25, 0.18, 0.95, 0, 0.23, 1.8, '#b7ad94');
  for (const x of [-1.4, 1.4]) d.box(parent, 0.11, 1.75, 0.11, x, 1.18, 2.2, '#e0cfac');
  if (['home', 'saloon', 'doctor'].includes(kind)) {
    for (let x = -1.3; x <= 1.3; x += 0.26)
      d.rod(parent, [x, 2.17, 2.1], [x, 2.56, 2.1], 0.025, '#e0cfac');
    d.rod(parent, [-1.45, 2.56, 2.1], [1.45, 2.56, 2.1], 0.04, '#e0cfac');
  }
  for (const x of [-1.47, 1.47]) {
    d.box(parent, 0.25, 1.9, 0.3, x, 1.02, 1.4, colors[kind]);
    for (let n = 0; n < 6; n++) d.box(parent, 0.27, 0.045, 0.32, x, 0.2 + n * 0.3, 1.4, '#d2c3a3');
  }
  d.box(parent, 3.25, 0.17, 0.95, 0, 2.05, 1.65, '#738f87');
  d.box(parent, 3.2, 0.22, 2.7, 0, 0.13, 0, colors[kind]);
  d.sign(
    parent,
    t(
      RIVER_RAIL_VARIANTS[originalKind]?.[0] ??
        BUILDINGS.find((b) => b.kind === originalKind)?.name ??
        originalKind,
    ),
    2.65,
    0,
    2.73,
    1.61,
  );
  if (kind === 'fisherman') d.box(parent, 2.8, 0.15, 1.5, 3, 0.15, 0, '#889c90');
}
