import { ERAS, eraEvolution } from '../../../data/eras';
import { resolveCityAsset } from '../../../data/eraDefinitions';
import { airportAppearance } from '../../../data/airport';
import { addFishingDock } from './river';
import { CITY_FAMILIES, isCityEra } from '../../../data/city';
import { blenderModel, leisureModel } from '../LeisureAssets';
import { buildTownSquare } from '../TownSquare';
import assets from '../../../assets/city-meshes.json';
import future from '../../../assets/future-meshes.json';

export const futureModel = (d, parent, name) => blenderModel(d, parent, future, name, 'future');
export const cityModel = (d, parent, name) => {
  const inherited = resolveCityAsset(name, ERAS);
  return blenderModel(d, parent, assets, inherited, 'city');
};

// Meshes are shared architectural pieces exported from Blender, not per-plot copies.
export function renderCityBuilding(d, parent, kind, label, level, era, serviceLevel = 3) {
  if (!isCityEra(era) || !CITY_FAMILIES[kind] || kind === 'bridge') return false;
  const family = CITY_FAMILIES[kind];
  if (family === 'river') addFishingDock(d, parent, serviceLevel, kind === 'riverPort');
  const root = d.group(parent);
  root.name = `${era} ${kind} level ${level}`;
  const landmark = ['airport', 'radio', 'concert', 'television', 'skyline'].includes(family);
  const profile = eraEvolution(era);
  const connected = profile.digitalCity;
  if (
    family !== 'airport' &&
    profile.detailAsset &&
    (landmark || ['field', 'park', 'square', 'river'].includes(family))
  ) {
    const cue = futureModel(d, root, profile.detailAsset);
    cue.scale.setScalar(0.5);
    cue.position.set(0, 0, -3);
  }
  if (landmark) {
    const asset = family === 'airport' ? airportAppearance(era).asset : family;
    futureModel(d, root, asset);
    if (level >= 2) futureModel(d, root, family === 'airport' ? `${asset}-wing` : 'landmark-wing');
    if (level >= 3)
      futureModel(d, root, family === 'airport' ? `${asset}-finish` : 'landmark-finish');
    if (family === 'airport') d.sign(root, label, 4.2, 4.5, 2.7, 1.22);
    else d.sign(root, label, 3, 0, 3.2, 2);
    return true;
  }
  if (connected && ['research', 'culture'].includes(family)) {
    futureModel(d, root, `digital-${family}`);
  } else if (connected && ['apartments', 'cityHomes', 'hotel'].includes(kind)) {
    futureModel(d, root, 'skyline');
  } else if (kind === 'horseField' || kind === 'park') {
    leisureModel(d, root, `${kind === 'horseField' ? 'field' : 'park'}${serviceLevel}`);
    cityModel(d, root, `${era}-garden`);
  } else if (family === 'square') {
    buildTownSquare(d, root, serviceLevel);
    cityModel(d, root, `${era}-garden`);
  } else cityModel(d, root, `${era}-${family}`);
  const garden = ['field', 'park', 'square'].includes(family);
  if (profile.detailAsset && !garden && family !== 'river')
    futureModel(d, root, profile.detailAsset);
  if (level >= 2) cityModel(d, root, `${era}-${garden ? 'finish' : 'wing'}`);
  if (level >= 3) {
    const detail = cityModel(d, root, `${era}-finish`);
    if (garden) {
      detail.rotation.y = Math.PI;
      detail.position.z = -0.3;
    }
  }
  if (['doctor', 'sheriff', 'bank', 'blacksmith'].includes(kind))
    cityModel(d, root, `marker-${kind}`);
  d.sign(root, label, 2.9, 0, 2.8, 1.8);
  return true;
}
export function addCityModernization(d, parent, kind, era, level) {
  if (kind !== 'bridge' || !isCityEra(era)) return;
  const root = cityModel(d, parent, `${era}-bridge`);
  root.name = `${era} bridge approaches ${level}`;
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
