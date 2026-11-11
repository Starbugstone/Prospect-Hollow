import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalModel } from '../src/game/town/TownAnimalModels';
import { willowkinCharacter } from '../src/game/town/GardenAnimalModels';
import { OUTFIT_PARTS, outfitTraits } from '../src/game/town/TownOutfitParts';
import { ERAS, eraEvolution } from '../src/data/eras';
import { periodOutfit, townWardrobe } from '../src/data/townWardrobes';
import { HAIR_STYLES, villagerBody } from '../src/data/villagers';
import { ANIMAL_LOOKS, TOWN_ANIMALS, WILLOWKIN_CROWNS, animalLook } from '../src/data/townAnimals';

const views = [];
function fixture(era = 'frontier') {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial({ transparent: true, opacity: 0.2 }),
    actors: [],
    motions: [],
    town: { era },
  });
  d.scene.add(d.world);
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    Object.values(d.geometries).forEach((geometry) => geometry.dispose());
    d.materials.forEach((material) => material.dispose());
    d.contactShadowMaterial.dispose();
  }
});
const person = (d, options) =>
  d.person({
    color: '#738a83',
    skin: '#d5ad88',
    hat: '#b38d59',
    manual: true,
    styled: true,
    route: [
      [0, 0],
      [0, 3],
    ],
    ...options,
  });
function cost(root) {
  let meshes = 0,
    triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  return { meshes, triangles };
}
function envelope(root) {
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root, true),
    point = new Vector3();
  let radius = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      radius = Math.max(radius, Math.hypot(point.x, point.z));
    }
  });
  return { radius, height: bounds.max.y };
}
const silhouette = (actor) => actor.appearance.silhouette.flatMap((group) => group.children).length;

describe('Villagers of every era', () => {
  it.each(ERAS.map((era) => era.id))('gives %s its own looks for both genders', (era) => {
    const wardrobe = townWardrobe(eraEvolution(era));
    for (const gender of ['male', 'female']) {
      expect(wardrobe.looks?.[gender]?.length).toBeGreaterThanOrEqual(3);
      for (const look of wardrobe.looks[gender])
        for (const part of look) expect(OUTFIT_PARTS).toContain(part);
      const seen = new Set();
      for (let seed = 0; seed < 60; seed++)
        seen.add(periodOutfit(eraEvolution(era), seed, gender).parts.join());
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it('dresses plainly for an unknown wardrobe, gender or part', () => {
    expect(periodOutfit({ wardrobe: 'unknown' }, 4, 'male').shirt).toBe(
      periodOutfit(eraEvolution('frontier'), 4, 'male').shirt,
    );
    expect(periodOutfit(eraEvolution('frontier'), 4, 'robot').parts).toEqual([]);
    expect(outfitTraits(['no-such-part'])).toEqual(outfitTraits([]));
    const d = fixture();
    const plain = person(d, { seed: 2, styled: false });
    expect(silhouette(plain)).toBe(0);
  });

  it('draws residents of every age and keeps workers, visitors and scripted actors adult', () => {
    const ages = new Set(),
      styles = new Set();
    for (let seed = 0; seed < 300; seed++) {
      const body = villagerBody(seed, true);
      expect(body).toEqual(villagerBody(seed, true));
      ages.add(body.age);
      styles.add(body.hairStyle);
      expect(villagerBody(seed).age).toBe('adult');
      expect(body.height).toBeGreaterThan(body.age === 'child' ? 0.6 : 0.88);
      expect(body.height).toBeLessThan(body.age === 'child' ? 0.76 : 1.08);
    }
    expect([...ages].sort()).toEqual(['adult', 'child', 'elder']);
    expect(styles.size).toBe(HAIR_STYLES);
    const d = fixture();
    const scripted = person(d, { seed: 8, styled: false });
    expect(scripted.root.getObjectByName('Villager figure').scale.x).toBe(1);
    const childSeed = Array.from({ length: 300 }, (_, n) => n).find(
      (seed) => villagerBody(seed, true).age === 'child',
    );
    const child = person(d, { seed: childSeed }),
      worker = person(d, { seed: childSeed, work: 'farm' });
    expect(child.root.getObjectByName('Villager figure').scale.x).toBeLessThan(0.76);
    expect(worker.root.getObjectByName('Villager figure').scale.x).toBeGreaterThan(0.9);
    expect(child.stride).toBeLessThan(worker.stride);
  });

  it.each(ERAS.map((era) => era.id))(
    'keeps %s villagers within the per-figure part and triangle budget',
    (era) => {
      const d = fixture(era);
      const geometries = Object.keys(d.geometries).length;
      for (let seed = 0; seed < 40; seed++) {
        const { meshes, triangles } = cost(person(d, { seed, era }).root);
        expect(meshes).toBeLessThanOrEqual(46);
        expect(triangles).toBeLessThan(3300);
      }
      // Looks only reuse the shared primitives, so villagers still draw in shared batches.
      expect(Object.keys(d.geometries).length).toBe(geometries);
    },
  );

  it('wears a different silhouette in different eras and hides it under a VIP outfit', () => {
    const parts = (era) => {
      const names = new Set();
      for (let seed = 0; seed < 40; seed++)
        for (const gender of ['male', 'female'])
          periodOutfit(eraEvolution(era), seed, gender).parts.forEach((part) => names.add(part));
      return names;
    };
    const frontier = parts('frontier'),
      broadcast = parts('broadcast');
    expect([...frontier].some((part) => !broadcast.has(part))).toBe(true);
    expect([...broadcast].some((part) => !frontier.has(part))).toBe(true);
    const d = fixture('frontier');
    const seed = Array.from({ length: 100 }, (_, n) => n).find(
      (n) => periodOutfit(eraEvolution('frontier'), n, 'male').parts.length,
    );
    const actor = person(d, { seed, gender: 'male', visitor: true });
    expect(silhouette(actor)).toBeGreaterThan(0);
    d.setVillagerIdentity(actor, { gender: 'male', name: 'Scott' });
    expect(actor.appearance.silhouette.every((group) => !group.visible)).toBe(true);
    expect(actor.clothing.headwear.visible).toBe(true);
    d.setVillagerIdentity(actor, { gender: 'male', name: null });
    expect(actor.appearance.silhouette.every((group) => group.visible)).toBe(true);
  });
});

describe('Animals of every era', () => {
  const species = Object.keys(ANIMAL_LOOKS);
  it('gives every ordinary species a set of looks', () => {
    for (const [id, animal] of Object.entries(TOWN_ANIMALS)) {
      if (animal.companion || animal.townsfolk) continue;
      expect(ANIMAL_LOOKS[id]?.length, id).toBeGreaterThan(1);
    }
    expect(animalLook('no-such-animal', 3, 2)).toEqual({ size: 1 });
    expect(animalLook('constructor', 3, 2)).toEqual({ size: 1 });
  });

  it('changes the cast with the generations and keeps an animal itself within an era', () => {
    for (const id of species) {
      expect(animalLook(id, 5, 1)).toBe(animalLook(id, 5, 1));
      expect(animalLook(id, 5, 1)).not.toBe(animalLook(id, 5, 2));
    }
    const dog = (era) => animalModel(fixture(era), 'dog', 0).root.userData.look;
    expect(dog('frontier')).toBe(dog('river-rail'));
    expect(dog('frontier')).not.toBe(dog('industrial'));
  });

  it.each(species)('keeps every %s look inside its authored envelope and budget', (id) => {
    const definition = TOWN_ANIMALS[id];
    // A look may recolour, reshape or shrink the authored animal, never outgrow it.
    const authored = envelope(animalModel(fixture('frontier'), id, 0).root);
    ANIMAL_LOOKS[id].forEach((look, variant) => {
      expect(look.size).toBeLessThanOrEqual(1);
      const model = animalModel(fixture('frontier'), id, variant);
      expect(model.root.userData.look).toBe(look);
      const bounds = envelope(model.root);
      expect(bounds.radius).toBeLessThanOrEqual(authored.radius + 1e-6);
      if (definition.height) expect(bounds.height).toBeLessThanOrEqual(definition.height);
      expect(cost(model.root).triangles).toBeLessThan(2500);
    });
  });
});

describe('Willowkin through the eras', () => {
  it('gives each its own crown and grows elders only a century after the first saplings', () => {
    const crowns = new Set();
    for (let seed = 0; seed < 18; seed++) {
      crowns.add(willowkinCharacter(seed, 'riverlight').crown);
      expect(willowkinCharacter(seed, 'riverlight').elder).toBe(false);
      expect(willowkinCharacter(seed, 'canopy').elder).toBe(false);
    }
    expect([...crowns].sort()).toEqual([...WILLOWKIN_CROWNS].sort());
    const elders = Array.from({ length: 18 }, (_, seed) => willowkinCharacter(seed, 'stargazer'));
    expect(elders.some((kin) => kin.elder)).toBe(true);
    expect(elders.some((kin) => !kin.elder)).toBe(true);
    expect(willowkinCharacter(1, 'no-such-era').elder).toBe(false);
    expect(willowkinCharacter(1, 'no-such-era').keepsake).toBeNull();
  });

  it.each(ERAS.filter((era) => era.evolution.wildlife === 'garden-town').map((era) => era.id))(
    'keeps every %s neighbor inside the pedestrian envelope',
    (era) => {
      const { radius, height } = TOWN_ANIMALS.willowkinResident;
      for (let variant = 0; variant < 9; variant++) {
        const model = animalModel(fixture(era), 'willowkinResident', variant);
        const bounds = envelope(model.root);
        expect(bounds.radius).toBeLessThanOrEqual(radius);
        expect(bounds.height).toBeLessThanOrEqual(height);
        expect(cost(model.root).triangles).toBeLessThan(2500);
        expect(model.root.getObjectByName('Willowkin resident linen scarf')).toBeTruthy();
      }
    },
  );

  it('keeps every sapling inside its garden envelope', () => {
    const { radius, height } = TOWN_ANIMALS.willowkin;
    for (let variant = 0; variant < 9; variant++) {
      const bounds = envelope(animalModel(fixture('canopy'), 'willowkin', variant).root);
      expect(bounds.radius).toBeLessThanOrEqual(radius);
      expect(bounds.height).toBeLessThanOrEqual(height);
    }
  });
});
