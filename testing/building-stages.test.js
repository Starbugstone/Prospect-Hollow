import { afterEach, expect, it } from 'vitest';
import { buildingStages } from '../src/data/buildingStages';
import { BUILDINGS } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { finishEra, modernizesInEra } from '../src/game/town/TownEras';

afterEach(() => {
  delete ERA_BY_ID['stage-successor'];
  delete ERA_BY_ID['stage-incomplete'];
});

it('retains completed construction through every eligible city-era handover', () => {
  for (let index = 1; index < ERAS.length; index++) {
    const era = ERAS[index].id;
    if (!['city', 'motor-age'].includes(eraEvolution(era).style)) continue;
    for (const building of BUILDINGS) {
      const native = ERAS.findIndex((entry) => entry.id === building.introducedEra);
      if (building.settlement || native >= index || !modernizesInEra(era, building.id)) continue;
      const stages = buildingStages(building.kind, finishEra(building.id, era), 1, 3);
      expect(stages, `${era}/${building.id}`).toEqual({
        modernizing: true,
        structureLevel: 3,
        moduleLevel: 3,
        finishLevel: 1,
      });
      expect(buildingStages(building.kind, era, 1, 5).structureLevel).toBe(3);
    }
  }
});

it('keeps native construction, partially completed structures and Moon buildings native', () => {
  for (const building of BUILDINGS)
    for (const level of [1, 2, 3]) {
      expect(buildingStages(building.kind, building.introducedEra, level, 3)).toEqual({
        modernizing: false,
        structureLevel: level,
        moduleLevel: level,
        finishLevel: level,
      });
    }
  expect(buildingStages('spaceElevator', 'twin-hollows', 1, 2).structureLevel).toBe(2);
  expect(buildingStages('ribbonLanding', 'moonward', 1, 3).structureLevel).toBe(1);
});

it('inherits a complete successor architecture and safely falls back for missing definitions', () => {
  for (const era of ['aviation', 'tomorrow', 'riverlight', 'stargazer', 'moonward']) {
    ERA_BY_ID['stage-successor'] = { evolution: { ...eraEvolution(era) } };
    expect(buildingStages('home', 'stage-successor', 1, 3).structureLevel).toBe(3);
  }
  ERA_BY_ID['stage-successor'] = { evolution: { ...eraEvolution('riverlight') } };
  expect(buildingStages('glassworks', 'stage-successor', 1, 3)).toEqual({
    modernizing: true,
    structureLevel: 3,
    moduleLevel: 3,
    finishLevel: 1,
  });
  ERA_BY_ID['stage-incomplete'] = { evolution: { style: 'city' } };
  for (const era of ['unknown', 'stage-incomplete'])
    expect(buildingStages('home', era, 1, 3)).toEqual({
      modernizing: false,
      structureLevel: 1,
      moduleLevel: 1,
      finishLevel: 1,
    });
  expect(buildingStages('unknown-kind', 'moonward', 1, 3).structureLevel).toBe(1);
});
