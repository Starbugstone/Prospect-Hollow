import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import { createTown } from '../src/data/town';
import { MoonDistricts } from '../src/game/town/moon/MoonDistricts';

// A town that has sent the Quiet Signal's answer: the ribbon and the star map lie in the dust.
const answered = () => ({
  ...createTown(),
  era: 'quiet-signal',
  buildings: { ...createTown().buildings, spaceElevator: 3, signalTerrace: 3 },
});
const fakeScene = () => ({ scene: new Group(), pickTargets: new Group(), elapsed: 0 });
const instanced = (root) => {
  const meshes = [];
  root.traverse((object) => object.isInstancedMesh && meshes.push(object));
  return meshes;
};
const watchDisposal = (meshes) => {
  const disposed = new Set();
  for (const mesh of meshes) mesh.addEventListener('dispose', () => disposed.add(mesh.name));
  return disposed;
};

describe('Moon districts release the star map', () => {
  it('disposes the star-map instanced meshes when the layer is rebuilt', () => {
    const layer = new MoonDistricts(fakeScene());
    layer.update(answered());
    const meshes = instanced(layer.root);
    expect(meshes.map(({ name }) => name).sort()).toEqual(['Star map', 'Star map path']);
    const disposed = watchDisposal(meshes);
    // A town without the answer rebuilds the layer without the star map.
    layer.update({ ...answered(), buildings: { ...answered().buildings, signalTerrace: 1 } });
    expect([...disposed].sort()).toEqual(['Star map', 'Star map path']);
    expect(instanced(layer.root)).toHaveLength(0);
    layer.dispose();
  });

  it('disposes them when the scene is torn down', () => {
    const layer = new MoonDistricts(fakeScene());
    layer.update(answered());
    const disposed = watchDisposal(instanced(layer.root));
    layer.dispose();
    expect([...disposed].sort()).toEqual(['Star map', 'Star map path']);
  });
});
