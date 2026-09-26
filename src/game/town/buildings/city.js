import { cityAppearance } from '../../../data/cityAppearance';
import { motorVehicle } from '../TownVehicles';
import { addSquareModernization } from '../TownSquare';
import { ERAS, eraEvolution } from '../../../data/eras';
import { resolveCityAsset } from '../../../data/eraDefinitions';
import { airportAppearance } from '../../../data/airport';
import airportLayout from '../../../data/airportLayout.json';
import { addCityLandmarkDetails } from './CityLandmarkDetails';
import { addFishingDock } from './river';
import { CITY_FAMILIES, isCityEra } from '../../../data/city';
import { blenderModel, leisureModel } from '../LeisureAssets';
import { buildTownSquare } from '../TownSquare';
import { cityFamily, resolveModel } from '../assets/MeshCatalog';

export const futureModel = (d, parent, name) => blenderModel(d, parent, null, name, 'future');
export const cityModel = (d, parent, name) => {
  const inherited = resolveCityAsset(name, ERAS);
  return blenderModel(d, parent, null, inherited, cityFamily(inherited));
};

// Meshes are shared architectural pieces exported from Blender, not per-plot copies.
export function renderCityBuilding(d, parent, kind, label, level, era, serviceLevel = 3) {
  if (!isCityEra(era) || !CITY_FAMILIES[kind] || kind === 'bridge') return false;
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
  if (landmark) {
    const asset = family === 'airport' ? airportAppearance(era).asset : family;
    futureModel(d, root, asset);
    if (family === 'airport') {
      const apron = airportLayout.passengerApron;
      d.box(root, apron.width, 0.05, apron.depth, apron.x, 0.115, apron.z, '#9baba2').name =
        'Passenger arrival apron';
      if (level >= 2) futureModel(d, root, `${asset}-wing`);
      if (level >= 3) {
        futureModel(d, root, `${asset}-finish`);
        const a = airportAppearance(era);
        const floor = a.clerestory ? 4.25 : a.skylights ? 3.45 : 3.2;
        const lounge = d.group(root);
        lounge.name = 'Airport rooftop observation lounge';
        d.box(lounge, 4.8, 0.18, 3.2, 4.5, floor, -2.8, a.roof);
        d.box(lounge, 4.4, 1.6, 2.8, 4.5, floor + 0.85, -2.8, '#85b8c8');
        d.box(lounge, 4.9, 0.18, 3.3, 4.5, floor + 1.75, -2.8, a.roof);
        for (const x of [2.3, 4.5, 6.7])
          d.box(lounge, 0.1, 1.6, 0.15, x, floor + 0.85, -1.35, a.frame);
      }
    } else addCityLandmarkDetails(d, root, family, era, level);
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
    buildTownSquare(d, root, serviceLevel, false);
    addSquareModernization(d, root, level, appearance.roof);
  } else {
    cityModel(d, root, asset ?? `${era}-${family}`);
    if (asset !== appearance.asset) root.userData.substitute = true;
    if (level >= 2) {
      const wing = cityModel(d, root, `${era}-wing`);
      wing.position.x = -(appearance.width ?? 3.65) / 2 + 1.75;
    }
    if (level >= 3)
      cityModel(d, root, appearance.asset ? `${appearance.asset}-finish` : `${era}-finish`);
    if (['garage', 'stable', 'busDepot'].includes(kind)) {
      const vehicle = motorVehicle(d, d.group(root, 0, 0, 2.5), kind === 'busDepot', era);
      vehicle.rotation.y = Math.PI / 2;
    }
  }
  d.sign(root, label, 2.9, 0, 2.8, 1.8);
  return true;
}
export function addCityModernization(d, parent, kind, era, level) {
  if (kind !== 'bridge' || !isCityEra(era)) return;
  const root = cityModel(d, parent, `${era}-bridge`);
  root.name = `${era} bridge approaches ${level}`;
  // Canopies must clear the rising deck. Stretch their upper supports while
  // keeping planters and post feet at ground level; reuse the adapted geometry.
  const joints = [];
  root.traverse((part) => {
    if (part.userData.exportFootprints) joints.push(part);
  });
  let covered = joints.some((joint) =>
    joint.userData.exportFootprints.some(
      ({ min, max }) => min[1] > 1.7 && min[2] < 0.6 && max[2] > -0.6 && max[0] - min[0] > 0.8,
    ),
  );
  if (!covered)
    root.traverse((part) => {
      const p = part.geometry?.attributes.position;
      for (let i = 0; p && i < p.count && !covered; i++)
        if (p.getY(i) > 1.7 && Math.abs(p.getZ(i)) < 0.65 && Math.abs(p.getX(i)) > 4)
          covered = true;
    });
  if (covered) {
    const raise = (y) => (y > 1.7 ? y + 1.6 : y);
    root.traverse((part) => {
      if (!part.isMesh) return;
      const key = `bridge-headroom:${part.geometry.uuid}`;
      if (!d.geometries[key]) {
        const geometry = part.geometry.clone(),
          positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) positions.setY(i, raise(positions.getY(i)));
        geometry.computeVertexNormals();
        d.geometries[key] = geometry;
      }
      part.geometry = d.geometries[key];
    });
    for (const joint of joints)
      for (const bounds of joint.userData.exportFootprints) {
        bounds.min[1] = raise(bounds.min[1]);
        bounds.max[1] = raise(bounds.max[1]);
      }
  }
  const profile = eraEvolution(era);
  if (profile.detailAsset) {
    const cue = futureModel(d, parent, profile.detailAsset);
    cue.scale.setScalar(0.4);
    cue.position.set(-6.5, 0, -2.5);
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
