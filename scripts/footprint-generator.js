import { plotSetbacks } from '../src/game/town/BuildingSetbacks';
import { Group, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { plotInEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { geometryFootprints, footprintKey } from '../src/game/town/BuildingFootprints';

export async function generateFootprints() {
  await loadFamilies(ALL_MESH_FAMILIES);
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
  });
  const keys = {},
    shapes = [],
    known = new Map();
  const labels = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName]));
  for (const era of ERAS.filter((e) => e.enabled)) {
    d.town = { ...createTown(), era: era.id };
    for (const b of BUILDINGS)
      if (plotInEra(d.town, b.id)) d.town.buildings[b.id] = b.upgrades.length;
    for (const building of BUILDINGS) {
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
            const solids = JSON.parse(
              JSON.stringify(geometryFootprints(group), (_, value) =>
                typeof value === 'number' ? Math.round(value * 1e5) / 1e5 : value,
              ),
            );
            const limits = plotSetbacks(id, d.town);
            if (limits)
              for (const solid of solids) {
                if (solid.yMin >= 1.7 || solid.yMax <= 0.08) continue;
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
            keys[
              footprintKey({
                id,
                kind: building.kind,
                era: era.id,
                serviceLevel,
                eraLevel,
                path: building.introducedEra === era.id ? 'native' : 'modernized',
                construction,
              })
            ] = known.get(serialized);
            d.clearGroup(group);
          }
        }
      }
    }
  }
  Object.values(d.geometries).forEach((g) => g.dispose());
  d.materials.forEach((m) => m.dispose());
  return { keys, shapes };
}
