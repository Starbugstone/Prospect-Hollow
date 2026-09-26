import { meshLoaders } from '../../../assets/meshes/loaders';
import { eraEvolution } from '../../../data/eras';
import { CITY_BUILDINGS } from '../../../data/city';

export function createMeshCatalog(loaders = meshLoaders) {
  const ready = new Map(),
    pending = new Map();
  function loadFamily(family) {
    if (ready.has(family)) return Promise.resolve(ready.get(family));
    if (!loaders[family]) return Promise.resolve(null);
    if (!pending.has(family)) {
      pending.set(
        family,
        Promise.all(loaders[family].map((load) => load()))
          .then((modules) => {
            const catalog = {
              models: Object.assign({}, ...modules.map((module) => module.default.models)),
              footprints: Object.assign({}, ...modules.map((module) => module.default.footprints)),
            };
            ready.set(family, catalog);
            return catalog;
          })
          .finally(() => pending.delete(family)),
      );
    }
    return pending.get(family);
  }
  return {
    async loadFamilies(families, token = { isCurrent: () => true }) {
      const results = await Promise.allSettled([...new Set(families)].map(loadFamily));
      for (const result of results)
        if (result.status === 'rejected')
          console.warn('Mesh family unavailable; using procedural geometry.', result.reason);
      return token.isCurrent();
    },
    resolveModel(family, name) {
      const model = ready.get(family)?.models[name];
      return model
        ? { status: 'ready', model, footprints: ready.get(family).footprints[name] }
        : { status: 'unavailable', family, name };
    },
    available: (family) => ready.has(family),
  };
}
export const { loadFamilies, resolveModel, available } = createMeshCatalog();
export const ALL_MESH_FAMILIES = Object.keys(meshLoaders);
export function cityFamily(name) {
  return ALL_MESH_FAMILIES.find((family) => name.startsWith(`${family}-`)) ?? 'city';
}
export function requiredFamilies(town) {
  const result = new Set();
  const eras = new Set([
    town.era,
    ...Object.values(town.buildingEras ?? {}),
    town.transition?.from,
    town.transition?.to,
  ]);
  for (const building of CITY_BUILDINGS)
    if (town.buildings?.[building.id]) eras.add(building.introducedEra);
  for (const era of eras) {
    if (!era) continue;
    const profile = eraEvolution(era);
    if (profile.baseCityEra) eras.add(profile.baseCityEra);
    if (profile.detailAsset) result.add('future');
    if (profile.cityAssets) {
      result.add(ALL_MESH_FAMILIES.includes(profile.cityAssets) ? profile.cityAssets : 'post-war');
      result.add('city');
    }
  }
  if (town.buildings?.park || town.buildings?.horseField) result.add('leisure');
  return [...result];
}
