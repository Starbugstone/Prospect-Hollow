import { afterEach, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalModel, animateAnimal } from '../src/game/town/TownAnimalModels';
import { residentOutfit, townWardrobe } from '../src/data/townWardrobes';
import { TOWN_ANIMALS, townFauna } from '../src/data/townAnimals';
import { eraEvolution, ERA_BY_ID } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';

const views = [];
function fixture(era) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    actors: [],
    contactShadowMaterial: new MeshBasicMaterial(),
    town: { era },
  });
  d.scene.add(d.world);
  views.push(d);
  return d;
}
afterEach(() => {
  delete ERA_BY_ID['garden-successor'];
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});

it.each(['canopy', 'riverlight'])(
  'gives ordinary %s neighbors stable visor-free outfits and varied hair',
  (era) => {
    const d = fixture(era),
      profile = eraEvolution(era);
    expect(townWardrobe(profile).hat).toBe('none');
    expect(townWardrobe(profile).petCostume).toBeUndefined();
    const colors = new Set(),
      accessories = new Set();
    for (let seed = 0; seed < 12; seed++) {
      const actor = d.person({
        color: '#aaaabb',
        skin: '#cfa67c',
        hat: '#bbbbbb',
        seed,
        route: [
          [0, 0],
          [0, 3],
        ],
        era,
        manual: true,
      });
      expect(actor.clothing.headwear.children).toHaveLength(0);
      expect(actor.root.userData.residentOutfit).toEqual(residentOutfit(profile, seed));
      colors.add(actor.root.userData.residentOutfit.hair);
      actor.appearance.residentDetails.traverse((o) => o.name && accessories.add(o.name));
    }
    expect(colors.size).toBeGreaterThan(2);
    expect(accessories.has('Gardener apron')).toBe(true);
    expect(accessories.has('Neighbor linen scarf')).toBe(true);
    expect(residentOutfit(eraEvolution('tomorrow'), 1)).toBeNull();
  },
);

it.each(['canopy', 'riverlight'])(
  'inherits the %s cast and clothing with safe unsupported fallbacks',
  (era) => {
    const base = eraEvolution(era);
    ERA_BY_ID['garden-successor'] = defineEra({ id: 'garden-successor', evolution: { ...base } });
    expect(residentOutfit(eraEvolution('garden-successor'), 3)).toEqual(residentOutfit(base, 3));
    expect(townFauna(eraEvolution('garden-successor'))).toEqual(townFauna(base));
    expect(townFauna({ wildlife: 'unknown' })).toEqual(townFauna({}));
    expect(townFauna({}).garden).toEqual([]);
    expect(townFauna({ wildlife: 'constructor' })).toEqual(townFauna({}));
    expect(townFauna({}).companions).toBeNull();
  },
);

it.each(['otter', 'deer', 'hedgehog', 'willowkin', 'bluebird'])(
  'keeps %s inside its navigation envelope and shares geometry while animating',
  (species) => {
    const d = fixture('canopy'),
      model = animalModel(d, species);
    const definition = TOWN_ANIMALS[species];
    const bounds = new Box3().setFromObject(model.root);
    expect(
      Math.max(
        Math.abs(bounds.min.x),
        Math.abs(bounds.max.x),
        Math.abs(bounds.min.z),
        Math.abs(bounds.max.z),
      ),
    ).toBeLessThanOrEqual(definition.radius);
    expect(bounds.max.y).toBeLessThanOrEqual(definition.height ?? 0.7);
    let triangles = 0;
    model.root.traverse((o) => {
      if (o.isMesh)
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    expect(triangles).toBeLessThan(2500);
    const geometries = { ...d.geometries },
      materials = d.materials.size;
    for (let time = 0; time < 200; time++) animateAnimal(model, time / 10, 'walking', true);
    expect(d.geometries).toEqual(geometries);
    expect(d.materials.size).toBe(materials);
    const second = animalModel(d, species);
    expect(second.root.userData.species).toBe(species);
    expect(d.geometries).toEqual(geometries);
    expect(d.materials.size).toBe(materials);
  },
);
