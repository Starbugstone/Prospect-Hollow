import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalModel, animateAnimal } from '../src/game/town/TownAnimalModels';

const views = [];
function fixture() {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial({ transparent: true, opacity: 0.2 }),
    town: { era: 'riverlight' },
  });
  d.scene.add(d.world);
  views.push(d);
  return d;
}
function model(d, species) {
  return animalModel(d, species);
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
afterEach(() => {
  for (const d of views.splice(0)) {
    Object.values(d.geometries).forEach((geometry) => geometry.dispose());
    d.materials.forEach((material) => material.dispose());
    d.contactShadowMaterial.dispose();
  }
});

describe('Willowkin evolution models', () => {
  it('keeps the sapling and a taller civic resident as separate compatible rigs', () => {
    const d = fixture(),
      sapling = model(d, 'willowkin'),
      resident = model(d, 'willowkinResident');
    expect(envelope(resident.root).height).toBeGreaterThan(envelope(sapling.root).height);
    expect(envelope(resident.root).radius).toBeLessThan(envelope(sapling.root).radius);
    expect(sapling.root.getObjectByName('Willowkin resident linen scarf')).toBeUndefined();
    expect(resident.root.getObjectByName('Willowkin resident linen scarf')).toBeTruthy();
    expect(resident.root.getObjectByName('Willowkin resident civic satchel')).toBeTruthy();
    expect(resident.root.getObjectByName('Willowkin resident willow crown')).toBeTruthy();
    expect(resident.legs).toHaveLength(2);
    expect(resident.arms).toHaveLength(2);
    expect(resident.wings).toHaveLength(0);
    expect(resident.tail).toBeInstanceOf(Group);
  });

  it('keeps every resident pose within the pedestrian envelope without rebuilding meshes', () => {
    const d = fixture(),
      resident = model(d, 'willowkinResident'),
      geometries = { ...d.geometries },
      materials = d.materials.size;
    for (const [state, moving] of [
      ['walking', true],
      ['tending', false],
      ['grooming', false],
      ['foraging', false],
      ['sniffing', false],
      ['startled', true],
    ]) {
      for (let frame = 0; frame <= 120; frame++) {
        animateAnimal(resident, frame * 0.137, state, moving);
        const bounds = envelope(resident.root);
        expect(bounds.radius, state).toBeLessThanOrEqual(0.65);
        expect(bounds.height, state).toBeLessThanOrEqual(2.05);
      }
    }
    model(d, 'willowkinResident');
    expect(d.geometries).toEqual(geometries);
    expect(d.materials.size).toBe(materials);
  }, 20000);

  it('uses a bounded static mesh budget and opaque unlit clothing', () => {
    const d = fixture(),
      resident = model(d, 'willowkinResident');
    let triangles = 0;
    const materials = new Set();
    resident.root.traverse((part) => {
      expect(part.isLight).not.toBe(true);
      if (!part.isMesh || part.geometry === d.geometries.shadow) return;
      const geometry = part.geometry;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      materials.add(part.material);
      expect(part.material.transparent).toBe(false);
      expect(part.material.emissive?.getHex() ?? 0).toBe(0);
    });
    expect(triangles).toBeLessThan(2500);
    expect(materials.size).toBeLessThanOrEqual(9);
  });
});
