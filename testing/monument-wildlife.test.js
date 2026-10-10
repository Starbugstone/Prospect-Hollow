import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { ERAS, eraEvolution } from '../src/data/eras';
import { PERSONAL_AREAS, areaUnlocked } from '../src/data/townLandmarks';
import {
  EXTERIOR_HABITATS,
  MONUMENT_WILDLIFE,
  SPACE_HELMET,
  TOWN_ANIMALS,
  townFauna,
} from '../src/data/townAnimals';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalModel, animateAnimal } from '../src/game/town/TownAnimalModels';
import { animalNavigation, animalSpace } from '../src/game/town/TownAnimalSpace';
import { townNavigation } from '../src/game/town/TownNavigation';
import { buildPersonalAreas } from '../src/game/town/TownPersonalisation';
import { buildLandscape } from '../src/game/town/TownLandscape';
import { wetBank } from '../src/game/town/TownRiver';
import { monumentCast, monumentRoute } from '../src/game/town/TownMonumentLife';
import { spreadHabitats, birdPopulation } from '../src/game/town/TownBirdHabitats';
import { finishWork } from '../src/game/PresentationWork';

const views = [];
function fixture() {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    town: createTown(),
  });
  d.town.era = ERAS.at(-1).id;
  d.scene.add(d.world);
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    if (d.landscape) d.clearGroup(d.landscape);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});

describe('Wildlife across the growing town', () => {
  it('opens wildlife with sites and only admits civic Willowkin from their resident lifestyle', () => {
    for (const era of ERAS) {
      const town = { era: era.id },
        fauna = townFauna(eraEvolution(era.id));
      const cast = monumentCast(town, fauna);
      const wild = cast.filter((a) => a.wild),
        neighbors = cast.filter((a) => !a.wild);
      expect(wild.map((a) => a.area.id)).toEqual(
        PERSONAL_AREAS.filter((a) => areaUnlocked(town, a)).map((a) => a.id),
      );
      expect(neighbors).toHaveLength(fauna.companions?.mode === 'street' ? 2 : 0);
      expect(neighbors.every((a) => TOWN_ANIMALS[a.species].resident)).toBe(true);
      if (neighbors.length) expect(neighbors.map((a) => a.area.id)).toEqual(['meadow', 'monument']);
      expect(new Set(cast.map((a) => `${a.species}:${a.seed}`)).size).toBe(cast.length);
    }
    const latest = monumentCast({ era: ERAS.at(-1).id }, townFauna(eraEvolution(ERAS.at(-1).id)));
    expect(new Set(latest.filter((a) => a.wild).map((a) => a.species))).toEqual(
      new Set([...MONUMENT_WILDLIFE, 'fox', 'raccoon', 'deer', 'hedgehog']),
    );
    expect(monumentCast({ era: 'unknown' }, townFauna(null))).toEqual([]);
    expect(
      monumentCast({ era: ERAS.at(-1).id }, { companions: null, garden: [] }).some((a) => !a.wild),
    ).toBe(false);
  });

  it.each([false, true])(
    'keeps complete ground routes clear of real scenery (built monuments: %s)',
    (built) => {
      const d = fixture();
      if (built) {
        for (const area of PERSONAL_AREAS) {
          d.town.personalisation.areas[area.id] = [area.choices[0]];
          d.town.personalisation.areaLevels[area.id] = 5;
        }
      }
      d.landscape = buildLandscape(d);
      d.scene.add(d.landscape);
      buildPersonalAreas(d, d.town);
      const base = townNavigation(d.world),
        space = animalSpace(d),
        nav = animalNavigation(base, space);
      const cast = monumentCast(d.town, townFauna(eraEvolution(d.town.era)));
      cast.push(
        ...Object.entries(EXTERIOR_HABITATS).map(([species, area]) => ({
          species,
          area,
          seed: 91,
        })),
      );
      for (const { species, area, seed } of cast) {
        const { radius, height = 1 } = TOWN_ANIMALS[species];
        const path = finishWork(monumentRoute(nav, area, radius, height, seed));
        expect(path.total, `${area.id}: ${species}`).toBeGreaterThan(3);
        expect(path.points.at(-1)).toEqual(path.points[0]);
        for (const [x, y, z] of path.points) {
          expect(y, `${area.id}: dry ground`).toBeGreaterThanOrEqual(0.02);
          expect(wetBank(x, z, radius), `${area.id}: bank clearance`).toBe(false);
        }
        for (let i = 1; i < path.points.length; i++) {
          expect(
            space.segment(path.points[i - 1], path.points[i], radius, height),
            `${area.id}: ${species}`,
          ).toBe(true);
          expect(base.segment(path.points[i - 1], path.points[i], radius)).toBe(true);
        }
      }
    },
    60000,
  );

  it.each(MONUMENT_WILDLIFE)(
    'animates %s and its cosmonaut outfit within a bounded body',
    (species) => {
      const d = fixture();
      expect(SPACE_HELMET.wearers).toContain(species);
      for (const costume of [null, 'space-helmet']) {
        const rig = animalModel(d, species, 0, costume);
        expect(!!rig.root.getObjectByName('Space helmet')).toBe(!!costume);
        let count = 0;
        rig.root.traverse((node) => {
          if (node.isMesh) count++;
        });
        expect(count).toBeLessThan(80);
        for (let frame = 0; frame < 60; frame++) {
          animateAnimal(
            rig,
            frame * 0.17,
            frame % 2 ? 'walking' : TOWN_ANIMALS[species].idle,
            frame % 2 === 1,
          );
          rig.root.updateMatrixWorld(true);
          const box = new Box3().setFromObject(rig.root);
          const size = box.getSize(new Vector3());
          expect(size.y).toBeLessThanOrEqual(TOWN_ANIMALS[species].height);
          expect(
            Math.max(
              Math.abs(box.min.x),
              Math.abs(box.max.x),
              Math.abs(box.min.z),
              Math.abs(box.max.z),
            ),
          ).toBeLessThanOrEqual(TOWN_ANIMALS[species].radius);
        }
      }
    },
  );

  it('spreads landing grounds and grows a bounded flock with geographically new districts', () => {
    const habitat = (x, z) => ({ point: [x, 0.07, z] });
    const old = [habitat(0, 0), habitat(2, 1), habitat(-2, 1)];
    const expanded = [
      ...old,
      habitat(-50, 0),
      habitat(50, 0),
      habitat(0, 50),
      habitat(0, -50),
      habitat(70, 50),
    ];
    const selected = spreadHabitats(expanded, 4, 10);
    expect(selected).toContain(old[0]);
    expect(selected).not.toContain(old[1]);
    expect(selected).not.toContain(old[2]);
    const bird = { count: 3, maxCount: 8 };
    expect(birdPopulation(bird, old)).toBe(3);
    expect(birdPopulation(bird, expanded)).toBeGreaterThan(3);
    expect(
      birdPopulation(
        bird,
        Array.from({ length: 100 }, (_, n) => habitat(n * 30, 0)),
      ),
    ).toBe(8);
  });
});
