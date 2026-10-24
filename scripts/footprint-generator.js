import { plotSetbacks } from '../src/game/town/BuildingSetbacks';
import { Group, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { BUILDINGS, EARTH_BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { plotInEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { geometryFootprints, footprintKey } from '../src/game/town/BuildingFootprints';
import { plotSetbackEnvelopeKey } from '../src/game/town/FootprintCatalog';
import { addMinePortal } from '../src/game/town/mine/MinePortal';
import { MINE_SIGN_BOARDS, mineSignKey } from '../src/game/town/mine/MineSignCatalog';

export async function generateFootprints({ eras = null } = {}) {
  const definitions = ERAS.filter((era) => era.enabled);
  if (eras && eras.some((id) => !definitions.some((era) => era.id === id)))
    throw new Error('Select a supported era for footprint generation');
  await loadFamilies(ALL_MESH_FAMILIES);
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
  });
  // Generation verifies the physical source, even when an eager special-scene
  // catalog already exists. Never regenerate a record by copying its old mount.
  d.sign = function (...args) {
    (this.plotSignRoot ?? args[0]).userData.generatedSignMount = null;
    return TownDiorama.prototype.sign.apply(this, args);
  };
  const keys = {},
    shapes = [],
    setbacks = {},
    signs = {},
    mineSigns = {},
    known = new Map();
  const labels = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName]));
  labels.mine = 'Mine';
  // Small scene records are refreshed for every era even in a scoped plot run.
  // Both assemblies are the production renderers; no yard/animation pass is
  // necessary for a board resolved before those parts exist.
  for (const era of definitions) {
    d.town = { ...createTown(), era: era.id };
    const entrance = new Group();
    entrance.position.set(PLOTS.mine[0], 0.08, PLOTS.mine[1]);
    try {
      d.buildPlot('mine', entrance, d.town, labels);
      if (entrance.userData.resolvedSignMount)
        mineSigns[mineSignKey(MINE_SIGN_BOARDS.entrance, era.id)] =
          entrance.userData.resolvedSignMount;
    } finally {
      d.clearGroup(entrance);
    }
    const root = new Group();
    root.position.set(PLOTS.mine[0], 0.08, PLOTS.mine[1]);
    try {
      const portal = addMinePortal(d, root, era.id);
      if (portal.userData.resolvedSignMount)
        mineSigns[mineSignKey(MINE_SIGN_BOARDS.portal, era.id)] = portal.userData.resolvedSignMount;
    } finally {
      d.clearGroup(root);
    }
  }
  for (const era of definitions.filter((era) => !eras || eras.includes(era.id))) {
    d.town = { ...createTown(), era: era.id };
    for (const b of BUILDINGS)
      if (plotInEra(d.town, b.id)) d.town.buildings[b.id] = b.upgrades.length;
    // Moon settlement buildings have no valley lot or footprint.
    for (const building of EARTH_BUILDINGS) {
      if (building.id === 'mine' || !plotInEra(d.town, building.id)) continue;
      for (let serviceLevel = 0; serviceLevel <= building.upgrades.length; serviceLevel++) {
        for (const eraLevel of era.id === 'frontier' ? [0] : [1, 2, 3]) {
          const id = building.id;
          d.town.buildings[id] = serviceLevel;
          d.town.buildingEras[id] = era.id;
          d.town.buildingEraLevels[id] = eraLevel;
          for (const construction of [
            'none',
            'construction-0',
            'construction-1',
            'construction-2',
          ]) {
            if (construction !== 'none')
              d.town.projects[id] = {
                stage: serviceLevel + 1,
                wins: (Number(construction.at(-1)) / 3) * 2,
                required: 2,
              };
            else delete d.town.projects[id];
            const group = new Group();
            group.position.set(PLOTS[id][0], 0.08, PLOTS[id][1]);
            d.buildPlot(id, group, d.town, labels, 0);
            if (group.userData.matureSetbackEnvelope) {
              setbacks[era.id] ??= {};
              setbacks[era.id][plotSetbackEnvelopeKey(id, d.town)] =
                group.userData.matureSetbackEnvelope;
            }
            const solids = JSON.parse(
              JSON.stringify(geometryFootprints(group), (_, value) =>
                typeof value === 'number' ? Math.round(value * 1e5) / 1e5 : value,
              ),
            );
            const limits = plotSetbacks(id, d.town);
            if (limits)
              for (const solid of solids) {
                if ((!GARDEN_PARCELS[id] && solid.yMin >= 1.7) || solid.yMax <= 0.08) continue;
                if (
                  solid.cx - solid.halfW < limits.minX - 0.0001 ||
                  solid.cx + solid.halfW > limits.maxX + 0.0001 ||
                  solid.cz - solid.halfD < limits.minZ - 0.0001 ||
                  solid.cz + solid.halfD > limits.maxZ + 0.0001
                )
                  throw new Error(
                    `Setback violation: ${id} ${era.id} ${serviceLevel}/${eraLevel} ${construction}`,
                  );
              }
            const serialized = JSON.stringify(solids);
            if (!known.has(serialized)) {
              known.set(serialized, shapes.length);
              shapes.push(solids);
            }
            const key = footprintKey({
              id,
              kind: building.kind,
              era: era.id,
              serviceLevel,
              eraLevel,
              path: building.introducedEra === era.id ? 'native' : 'modernized',
              construction,
            });
            keys[key] = known.get(serialized);
            // The live resolver records the completed primary nameboard during
            // this same build, including its construction context. No extra
            // model pass or rounded geometry is needed to publish its mount.
            if (group.userData.resolvedSignMount) {
              signs[era.id] ??= {};
              signs[era.id][key] = group.userData.resolvedSignMount;
            }
            d.clearGroup(group);
          }
        }
      }
    }
  }
  Object.values(d.geometries).forEach((g) => g.dispose());
  d.materials.forEach((m) => m.dispose());
  return { keys, shapes, setbacks, signs, mineSigns };
}
