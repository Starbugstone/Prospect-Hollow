import { Box3, Matrix4 } from 'three';
import { cityAppearance } from '../../../data/cityAppearance';
import { parkedVehicle } from '../TownVehicles';
import { addSquareModernization } from '../TownSquare';
import { ERAS, eraEvolution } from '../../../data/eras';
import { resolveCityAsset } from '../../../data/eraDefinitions';
import { buildingStages } from '../../../data/buildingStages';
import { airportAppearance } from '../../../data/airport';
import airportLayout from '../../../data/airportLayout.json';
import { addCityLandmarkDetails } from './CityLandmarkDetails';
import {
  addAirportFinish,
  addCityFinish,
  addConnectedCityIdentity,
  supportCityModel,
} from './CityBuildingDetails';
import { addFishingDock } from './river';
import { CITY_FAMILIES, isCityEra } from '../../../data/city';
import { blenderModel, leisureModel } from '../LeisureAssets';
import { buildTownSquare } from '../TownSquare';
import { cityFamily, resolveModel } from '../assets/MeshCatalog';
import { addRoundedLounge, renderRoundedBuilding } from './rounded';
import { addCozyAirportDetails, addCozyBridge, addCozyLounge, renderCozyBuilding } from './cozy';
import {
  addFutureAirportDetails,
  addFutureBridge,
  addFutureLounge,
  renderFutureBuilding,
} from './future';

const FUTURE = {
  render: renderFutureBuilding,
  lounge: addFutureLounge,
  airport: addFutureAirportDetails,
  bridge: addFutureBridge,
};
/** Procedural city architectures by the era's `architecture` capability. A renderer
 * returning false leaves that kind to the shared Blender shells (e.g. the airport).
 * Optional hooks dress the airport lounge, airport grounds and bridge approaches. */
const ARCHITECTURES = {
  rounded: { render: renderRoundedBuilding, lounge: addRoundedLounge },
  cozy: {
    render: renderCozyBuilding,
    lounge: addCozyLounge,
    airport: addCozyAirportDetails,
    bridge: addCozyBridge,
  },
  sail: FUTURE,
  observatory: FUTURE,
  homestead: FUTURE,
  twin: FUTURE,
};

export const futureModel = (d, parent, name) => {
  const root = blenderModel(d, parent, null, name, 'future');
  return name === 'concert' ? supportCityModel(d, root) : root;
};
export const cityModel = (d, parent, name) => {
  const inherited = resolveCityAsset(name, ERAS);
  const root = blenderModel(d, parent, null, inherited, cityFamily(inherited));
  const marker = inherited.indexOf('-kind-');
  return marker >= 0 && !inherited.endsWith('-finish')
    ? supportCityModel(
        d,
        root,
        cityAppearance(inherited.slice(0, marker), inherited.slice(marker + 6)),
      )
    : root;
};

// The five home plots share one shell. Each gets its own addition in the era's wall and
// roof colours, so a street of homes reads as five households; the first stays plain.
function addHomeCharacter(d, root, { wall, roof, brick }, variant) {
  if (!(variant % 5)) return;
  // The additions stand against the house as built so far: its shell, wing and finishes.
  root.updateWorldMatrix(true, true);
  const bounds = new Box3()
    .setFromObject(root)
    .applyMatrix4(new Matrix4().copy(root.matrixWorld).invert());
  if (bounds.isEmpty()) return;
  const side = bounds.max.x,
    west = bounds.min.x,
    height = bounds.max.y,
    front = bounds.max.z;
  const extra = d.group(root);
  extra.name = 'Home character';
  switch (variant % 5) {
    case 1:
      // A garden room on the west side.
      d.box(extra, 1.05, 1.3, 1.5, west - 0.45, 0.72, -0.35, wall, true);
      d.box(extra, 1.25, 0.12, 1.7, west - 0.45, 1.43, -0.35, roof, true);
      d.box(extra, 0.6, 0.5, 0.06, west - 0.45, 0.85, 0.42, '#8fb0a8');
      break;
    case 2:
      // A roof room behind a parapet.
      d.box(extra, 1.25, 0.75, 1.1, 0.35, height + 0.37, -0.6, wall, true);
      d.box(extra, 1.45, 0.1, 1.3, 0.35, height + 0.8, -0.6, roof, true);
      d.box(extra, 0.7, 0.36, 0.06, 0.35, height + 0.4, -0.03, '#8fb0a8');
      break;
    case 3:
      // A tall brick chimney on the east gable and a clipped hedge.
      d.box(extra, 0.44, height + 0.85, 0.44, side + 0.12, (height + 0.85) / 2, -0.7, brick, true);
      d.box(extra, 0.56, 0.1, 0.56, side + 0.12, height + 0.9, -0.7, roof, true);
      for (const x of [-0.5, 0, 0.5])
        d.ball(extra, west + 0.6 + x * 0.9, 0.3, front + 0.3, [0.3, 0.26, 0.26], '#7f9a6a');
      break;
    case 4: {
      // A shed and a tree in the east garden.
      d.box(extra, 0.85, 0.85, 0.85, side + 0.5, 0.5, -0.95, brick, true);
      d.box(extra, 1, 0.1, 1, side + 0.5, 0.97, -0.95, roof, true);
      d.rod(extra, [side + 0.55, 0.05, 0.7], [side + 0.55, 1.15, 0.7], 0.07, '#7a5f45');
      d.ball(extra, side + 0.55, 1.6, 0.7, [0.55, 0.6, 0.55], '#7f9a6a');
      break;
    }
    default:
  }
}

// Meshes are shared architectural pieces exported from Blender, not per-plot copies.
// `lifecycleEra` lets a later style reuse a shell while keeping its own stages
// and square centerpiece.
export function renderCityBuilding(
  d,
  parent,
  kind,
  label,
  level,
  era,
  serviceLevel = 3,
  lifecycleEra = era,
) {
  if (!isCityEra(era) || !CITY_FAMILIES[kind] || kind === 'bridge') return false;
  if (
    ARCHITECTURES[eraEvolution(era).architecture]?.render(
      d,
      parent,
      kind,
      label,
      level,
      era,
      serviceLevel,
    )
  )
    return true;
  const family = CITY_FAMILIES[kind];
  const appearance = cityAppearance(era, kind);
  let asset = appearance.asset;
  if (asset && resolveModel(cityFamily(asset), asset).status !== 'ready') {
    const substitute = `${eraEvolution(era).cityAssets}-${family}`;
    if (resolveModel(cityFamily(substitute), substitute).status === 'ready') asset = substitute;
    else if (
      !['airport', 'radio', 'concert', 'television', 'skyline', 'square', 'leisure'].includes(
        family,
      )
    ) {
      parent.userData.substitute = true;
      return false;
    }
  }
  if (family === 'river') addFishingDock(d, parent, serviceLevel, kind === 'riverPort');
  const root = d.group(parent);
  root.name = `${era} ${kind} level ${level}`;
  const landmark = ['airport', 'radio', 'concert', 'television', 'skyline'].includes(family);
  const profile = eraEvolution(era);
  // A delegated shell keeps its original palette, while construction follows
  // the actual era (Motor Age reuses Postwar architectural assets).
  const {
    structureLevel,
    finishLevel,
    modernizing,
    moduleLevel = structureLevel,
  } = buildingStages(kind, lifecycleEra, level, serviceLevel);
  if (landmark) {
    const asset = family === 'airport' ? airportAppearance(era).asset : family;
    futureModel(d, root, asset).userData.buildingPart = 'main';
    if (family === 'airport') {
      const apron = airportLayout.passengerApron;
      d.box(root, apron.width, 0.05, apron.depth, apron.x, 0.115, apron.z, '#9baba2').name =
        'Passenger arrival apron';
      if (structureLevel >= 2) futureModel(d, root, `${asset}-wing`);
      if (structureLevel >= 3) {
        futureModel(d, root, `${asset}-finish`);
        const a = airportAppearance(era);
        const floor = a.clerestory ? 4.25 : a.skylights ? 3.45 : 3.2;
        const lounge = d.group(root);
        lounge.name = 'Airport rooftop observation lounge';
        d.box(lounge, 4.8, 0.18, 3.2, 4.5, floor, -2.8, a.roof);
        if (!a.clerestory && !a.skylights)
          d.box(lounge, 4.45, 0.15, 2.8, 4.5, floor - 0.145, -2.8, a.roof).name =
            'Observation lounge roof plinth';
        const style = ARCHITECTURES[profile.architecture];
        if (style?.lounge) style.lounge(d, lounge, 4.5, floor, -2.8, era, structureLevel);
        else {
          d.box(lounge, 4.4, 1.6, 2.8, 4.5, floor + 0.85, -2.8, '#85b8c8');
          d.box(lounge, 4.9, 0.18, 3.3, 4.5, floor + 1.75, -2.8, a.roof).name =
            'Observation lounge roof';
          for (const x of [2.3, 4.5, 6.7])
            d.box(lounge, 0.1, 1.6, 0.15, x, floor + 0.85, -1.35, a.frame);
        }
      }
      ARCHITECTURES[profile.architecture]?.airport?.(d, root, era, level);
      if (moduleLevel >= 2)
        addAirportFinish(
          d,
          root,
          finishLevel,
          profile.architecture === 'rounded',
          airportAppearance(era),
          moduleLevel,
        );
    } else
      addCityLandmarkDetails(d, root, family, era, finishLevel, structureLevel, modernizing, kind);
    if (family === 'airport') d.sign(root, label, 4.2, 4.5, 2.7, 1.22);
    else d.sign(root, label, 3, 0, 3.2, 2);
    return true;
  }
  if (kind === 'horseField' || kind === 'park') {
    leisureModel(
      d,
      root,
      `${kind === 'horseField' ? 'field' : 'park'}${Math.min(3, serviceLevel)}`,
    );
    cityModel(d, root, `${era}-garden`);
    if (level >= 2) cityModel(d, root, `${era}-finish`).position.x = -2;
    if (level >= 3) cityModel(d, root, `${era}-finish`).position.x = 2;
  } else if (family === 'square') {
    buildTownSquare(d, root, serviceLevel, false, lifecycleEra);
    addSquareModernization(d, root, level, appearance.roof);
    return true;
  } else {
    const shell = cityModel(d, root, asset ?? `${era}-${family}`);
    shell.userData.buildingPart = 'main';
    if (asset !== appearance.asset) root.userData.substitute = true;
    if (structureLevel >= 2) {
      const wing = cityModel(d, root, `${era}-wing`);
      wing.position.x = -(appearance.width ?? 3.65) / 2 + 1.75;
      wing.userData.buildingPart = 'sideWing';
    }
    if (moduleLevel >= 2) addCityFinish(d, root, kind, era, finishLevel, moduleLevel);
    addConnectedCityIdentity(d, root, kind, era);
    if (kind === 'home') addHomeCharacter(d, root, appearance, d.plotVariant ?? 0);
    if (['garage', 'stable', 'busDepot'].includes(kind)) {
      // A shell with a drive-in canopy parks its car beneath it, clear of the columns
      // and the forecourt lamp.
      const [x, z] = (asset === appearance.asset && appearance.parking) || [0, 2.5];
      const spot = d.group(root, x, 0, z);
      const vehicle = parkedVehicle(d, spot, kind, era);
      vehicle.rotation.y = Math.PI / 2;
    }
  }
  d.sign(root, label, 2.9, 0, 2.8, 1.8);
  return true;
}
export function addCityModernization(d, parent, kind, era, level) {
  if (kind !== 'bridge' || !isCityEra(era)) return;
  const bridge = ARCHITECTURES[eraEvolution(era).architecture]?.bridge;
  if (bridge) return bridge(d, parent, era, level);
  const root = cityModel(d, parent, `${era}-bridge`);
  root.name = `${era} bridge approaches ${level}`;
  const profile = eraEvolution(era);
  if (profile.detailAsset) {
    // Facade/rooftop detail packs have no host building on a bridge bank.
    // A grounded directory uses the same reserved verge, clear of the deck.
    const a = cityAppearance(era),
      x = -6.35,
      z = -2.2;
    const kiosk = d.group(parent);
    kiosk.name = 'Bridge information kiosk';
    d.box(kiosk, 0.5, 0.12, 0.4, x, 0.06, z, a.wall).name = 'Bridge kiosk footing';
    d.box(kiosk, 0.1, 1.2, 0.12, x, 0.7, z, a.roof).name = 'Bridge kiosk support';
    d.box(kiosk, 1, 0.7, 0.16, x, 1.42, z, a.roof);
    d.box(kiosk, 0.85, 0.55, 0.025, x, 1.42, z + 0.1, '#85b8c8');
    for (let n = 0; n < 3; n++)
      d.box(kiosk, 0.55 - n * 0.1, 0.04, 0.02, x, 1.6 - n * 0.15, z + 0.12, a.wall);
  }
  if (level >= 2) {
    const garden = cityModel(d, parent, `${era}-finish`);
    garden.position.x = -6;
    garden.scale.set(0.55, 0.8, 0.65);
  }
  if (level >= 3) {
    const garden = cityModel(d, parent, `${era}-finish`);
    garden.position.x = 6;
    garden.scale.set(0.55, 0.8, 0.65);
  }
}
