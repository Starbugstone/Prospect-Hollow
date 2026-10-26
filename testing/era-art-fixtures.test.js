import { expect, it } from 'vitest';
import { reviewStageCount, reviewTownFor } from '../scripts/era-art-fixtures';
import { BUILDING_BY_ID } from '../src/data/town';
import { ERA_BY_ID } from '../src/data/eras';
import { modelLevel, PROGRESSION_VERSION } from '../src/data/buildingProgression';

it('reviews native saved stages using current progression without bypassing the model-level contract', () => {
  const town = reviewTownFor(ERA_BY_ID.frontier, 3);
  expect(town.progressionVersion).toBe(PROGRESSION_VERSION);
  expect(town.buildings.bank).toBe(3);
  expect(modelLevel('bank', town.buildings.bank)).toBe(5);
  expect(town.buildingEraLevels.bank).toBe(0);
  expect(town.projects).toEqual({});
  expect(town.buildings.airport).toBe(0);
});

it('distinguishes a native new building from an established building modernizing through paid finishes', () => {
  const town = reviewTownFor(ERA_BY_ID.contemporary, 2);
  expect(town.buildings.library).toBe(2);
  expect(town.buildingEraLevels.library).toBe(2);
  expect(town.buildings.home).toBe(BUILDING_BY_ID.home.upgrades.length);
  expect(town.buildingEras.home).toBe('contemporary');
  expect(town.buildingEraLevels.home).toBe(2);
});

it('keeps a retained finish in a partial era and exposes all native Moon stages', () => {
  const era = ERA_BY_ID['twin-hollows'];
  const town = reviewTownFor(era, 1);
  expect(town.buildingEras.home).toBe('moonward');
  expect(town.buildingEraLevels.home).toBe(3);
  expect(reviewStageCount(BUILDING_BY_ID.home, era)).toBe(1);
  expect(town.buildings.settlerDomes).toBe(1);
  expect(reviewStageCount(BUILDING_BY_ID.settlerDomes, era)).toBe(3);
});
