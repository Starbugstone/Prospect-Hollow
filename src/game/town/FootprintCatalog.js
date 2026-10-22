import { constructionVisual } from './TownRules';
import { footprintLoaders } from '../../data/generated/footprintLoaders';
import { footprintKey, geometryFootprints } from './BuildingFootprints';
import { BUILDING_BY_ID } from '../../data/town';
import { eraEvolution } from '../../data/eras';
import { available } from './assets/MeshCatalog';
const ready = new Map(),
  pending = new Map();
export async function loadFootprints(town) {
  const eras = new Set([town.era, ...Object.values(town.buildingEras ?? {})]);
  await Promise.allSettled(
    [...eras].map((era) => {
      if (ready.has(era) || !footprintLoaders[era]) return;
      if (!pending.has(era))
        pending.set(
          era,
          footprintLoaders[era]()
            .then((catalog) => {
              ready.set(era, catalog);
            })
            .finally(() => pending.delete(era)),
        );
      return pending.get(era);
    }),
  );
}
export function plotFootprintKey(id, town) {
  const building = BUILDING_BY_ID[id],
    era = town.buildingEras[id] ?? 'frontier';
  return footprintKey({
    id,
    kind: building.kind,
    era,
    serviceLevel: town.buildings[id],
    eraLevel: era === 'frontier' ? 0 : town.buildingEraLevels[id] || 1,
    path: building.introducedEra === era ? 'native' : 'modernized',
    construction: town.projects[id]
      ? `construction-${constructionVisual(town.projects[id])}`
      : 'none',
  });
}
// The same generated family owns both collision solids and the untransformed
// mature envelope used to reserve every paid finish. Labels do not change the
// authored board width or the physical model. Geometry follows the building's
// finish era, including while its town has advanced and it awaits modernization.
export function plotSetbackEnvelopeKey(id, town) {
  return [id, town.buildingEras[id] ?? 'frontier', town.buildings[id] ?? 0].join('|');
}
export function matureEnvelopeFor(id, town) {
  const era = town.buildingEras[id] ?? 'frontier',
    family = eraEvolution(era).cityAssets,
    envelope = ready.get(era)?.setbacks?.[plotSetbackEnvelopeKey(id, town)];
  if (
    (family && !available(family)) ||
    !Array.isArray(envelope) ||
    envelope.length !== 4 ||
    !envelope.every(Number.isFinite) ||
    envelope[0] > envelope[1] ||
    envelope[2] > envelope[3]
  )
    return null;
  return envelope;
}
export function signMountFor(id, town) {
  if (!BUILDING_BY_ID[id]) return null;
  const era = town.buildingEras[id] ?? 'frontier',
    family = eraEvolution(era).cityAssets,
    signs = ready.get(era)?.signs,
    index = signs?.keys?.[plotFootprintKey(id, town)];
  if ((family && !available(family)) || !Number.isInteger(index) || index < 0) return null;
  return signs.mounts?.[index] ?? null;
}
export function footprintsFor(key, root) {
  const era = key.split('|')[2],
    catalog = ready.get(era),
    family = eraEvolution(era).cityAssets;
  const index = catalog?.keys[key];
  let substitute = false;
  root.traverse((node) => {
    if (node.userData.substitute) substitute = true;
  });
  if (index !== undefined && !substitute && (!family || available(family)))
    return {
      solids: catalog.shapes[index].map((i) => {
        const [cx, cz, halfW, halfD, yMin, yMax, points] = catalog.solids[i];
        return {
          shape: 'rect',
          cx,
          cz,
          halfW,
          halfD,
          yMin,
          yMax,
          rotation: 0,
          ...(points ? { points } : {}),
        };
      }),
      provisional: false,
    };
  return { solids: geometryFootprints(root), provisional: true };
}
