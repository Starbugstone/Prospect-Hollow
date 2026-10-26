import { afterEach, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { ERAS, ERA_BY_ID } from '../src/data/eras';
import { BUILDINGS, EARTH_BUILDINGS, createTown } from '../src/data/town';
import { buildingStages } from '../src/data/buildingStages';
import { modelLevel } from '../src/data/buildingProgression';
import { plotSetbacks } from '../src/game/town/BuildingSetbacks';
import { geometryFootprints } from '../src/game/town/BuildingFootprints';
import * as catalog from '../src/game/town/FootprintCatalog';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { eraIndex, finishEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';
import { TownPrimitives } from '../src/game/town/TownPrimitives';

const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.name]));
const views = [];
const originalEraCount = ERAS.length;

function drawing(era) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = createTown();
  d.town.era = era;
  for (const building of EARTH_BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
    d.town.buildings[building.id] = building.upgrades.length;
    d.town.buildingEras[building.id] = finishEra(building.id, era);
    d.town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
  }
  views.push(d);
  return d;
}
function render(d, id) {
  const group = new Group();
  group.position.set(PLOTS[id][0], 0.08, PLOTS[id][1]);
  group.userData.plot = id;
  d.buildPlot(id, group, d.town, labels);
  return group;
}
afterEach(() => {
  vi.restoreAllMocks();
  ERAS.splice(originalEraCount);
  delete ERA_BY_ID['ungenerated-successor'];
  for (const d of views.splice(0)) d.disposePrimitives();
});

it('ships a generated mature envelope for every eligible service stage and retained finish', () => {
  let covered = 0;
  for (const era of ERAS.filter((definition) => definition.enabled)) {
    const town = createTown();
    town.era = era.id;
    for (const building of EARTH_BUILDINGS) {
      const id = building.id;
      if (!PLOTS[id] || eraIndex(building.introducedEra) > eraIndex(era.id)) continue;
      if (!plotSetbacks(id, town)) continue;
      for (const finish of ERAS.filter((candidate) => candidate.enabled)) {
        if (
          eraIndex(finish.id) > eraIndex(era.id) ||
          eraIndex(finish.id) < eraIndex(building.introducedEra)
        )
          continue;
        town.buildingEras[id] = finish.id;
        for (let service = 1; service <= building.upgrades.length; service++) {
          town.buildings[id] = service;
          if (!buildingStages(building.kind, finish.id, 1, modelLevel(id, service)).modernizing)
            continue;
          expect(
            catalog.matureEnvelopeFor(id, town),
            catalog.plotSetbackEnvelopeKey(id, town),
          ).toHaveLength(4);
          covered++;
        }
      }
    }
  }
  expect(covered).toBeGreaterThan(1000);
});

it.each([
  ['aviation', 'home'],
  ['aviation', 'garage'],
  ['broadcast', 'shop'],
  ['tomorrow', 'home'],
  ['canopy', 'school'],
  ['riverlight', 'orchardCottages'],
  ['moonward', 'bank'],
  ['twin-hollows', 'school'],
])('keeps exact %s/%s solids while eliminating all runtime finish probes', (era, id) => {
  const d = drawing(era);
  const clear = vi.spyOn(d, 'clearGroup');
  const generated = catalog.matureEnvelopeFor(id, d.town);
  expect(generated).toHaveLength(4);
  const fast = render(d, id);
  expect(clear).not.toHaveBeenCalled();
  const solids = geometryFootprints(fast);
  const reader = vi.spyOn(catalog, 'matureEnvelopeFor').mockReturnValue(null);
  d.plotSetbackEnvelopes?.clear();
  const probed = render(d, id);
  expect(clear).toHaveBeenCalledTimes(3);
  expect(probed.userData.matureSetbackEnvelope).toEqual(generated);
  expect(geometryFootprints(probed)).toEqual(solids);
  reader.mockRestore();
  d.clearGroup(fast);
  d.clearGroup(probed);
});

it.each(ERAS.filter((era) => era.enabled).map((era) => era.id))(
  'keeps every %s mature envelope independent of later town eras while modernization is pending',
  (ownEra) => {
    const d = drawing(ownEra);
    vi.spyOn(catalog, 'matureEnvelopeFor').mockReturnValue(null);
    const laterEras = ERAS.filter((era) => era.enabled && eraIndex(era.id) > eraIndex(ownEra));
    for (const building of EARTH_BUILDINGS) {
      const id = building.id;
      d.town.era = ownEra;
      if (
        !PLOTS[id] ||
        !d.town.buildings[id] ||
        !plotSetbacks(id, d.town) ||
        !buildingStages(building.kind, ownEra, 1, modelLevel(id, d.town.buildings[id])).modernizing
      )
        continue;
      // Probe the source instead of comparing two reads of the generated data.
      d.town.buildingEras[id] = ownEra;
      const nativeTown = render(d, id);
      const expected = nativeTown.userData.matureSetbackEnvelope;
      d.clearGroup(nativeTown);
      for (const era of laterEras) {
        d.town.era = era.id;
        const pending = render(d, id);
        expect(pending.userData.matureSetbackEnvelope, `${id}/${ownEra} in ${era.id}`).toEqual(
          expected,
        );
        d.clearGroup(pending);
      }
    }
  },
  60000,
);

it('keeps native construction unchanged and memoizes safe fallback probes for an ungenerated era', () => {
  const native = drawing('frontier');
  const nativeClear = vi.spyOn(native, 'clearGroup');
  const school = render(native, 'school');
  expect(school.userData.matureSetbackEnvelope).toBeUndefined();
  expect(nativeClear).not.toHaveBeenCalled();
  native.clearGroup(school);

  const successor = drawing('riverlight');
  const definition = {
    ...ERAS.find((era) => era.id === 'riverlight'),
    id: 'ungenerated-successor',
  };
  ERAS.push(definition);
  ERA_BY_ID[definition.id] = definition;
  successor.town.era = 'ungenerated-successor';
  successor.town.buildingEras.school = 'ungenerated-successor';
  expect(catalog.matureEnvelopeFor('school', successor.town)).toBeNull();
  const clear = vi.spyOn(successor, 'clearGroup');
  const first = render(successor, 'school');
  expect(clear).toHaveBeenCalledTimes(3);
  expect(first.userData.matureSetbackEnvelope).toHaveLength(4);
  const next = render(successor, 'school');
  expect(clear).toHaveBeenCalledTimes(3);
  expect(geometryFootprints(next)).toEqual(geometryFootprints(first));
  successor.clearGroup(first);
  successor.clearGroup(next);
});
