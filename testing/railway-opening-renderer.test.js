import { expect, it, vi } from 'vitest';
import { MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { BUILDINGS, createTown } from '../src/data/town';
import { TOWN_PRESENTATIONS } from '../src/data/townPresentations';

it('stages the saved railway visually, then cleans up and restores the camera on skip', () => {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    elapsed: 0,
    sign: () => {},
    render: () => {},
    renderer: { shadowMap: {} },
    frameCache: { valid: true },
    camera: new PerspectiveCamera(45, 1.44, 0.1, 500),
    controls: { target: new Vector3(0, 0.7, 0), enabled: true },
    motionEnabled: false,
  });
  d.camera.position.set(20, 30, 50);
  d.actorRenderer = new TownActors(d.scene);
  d.buildingRenderer = new TownStatics(d.scene);
  d.upgradeGlow = new TownUpgradeGlow(d.scene);
  const town = createTown();
  town.era = 'river-rail';
  town.buildings.railDepot = 1;
  town.infrastructure.rail = 1;
  d.update(town, Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName])));
  const saved = JSON.stringify(town),
    pose = d.camera.position.clone();
  const hill = d.staticScenery.entries.get('mine-hillside').group;
  const batch = d.buildingRenderer.batches.get(hill);
  d.setPresentation(TOWN_PRESENTATIONS['railway-opening']);
  const effect = d.presentation.effect;
  const geometry = effect.tunnel.getObjectByName('Mine shoulder and tunnel').geometry;
  const disposed = vi.spyOn(geometry, 'dispose');
  try {
    expect(d.controls.enabled).toBe(false);
    expect(batch.visible).toBe(false);
    expect(hill.userData.activation).toBe('removed');
    expect(effect.solid.userData.activation).toBe('temporary-reveal');
    expect(effect.tunnel.userData.activation).toBe('pending');
    expect(effect.solid.visible).toBe(true);
    expect(effect.tunnel.visible).toBe(false);
    expect(effect.railParts.every(({ part }) => !part.visible)).toBe(true);
    expect(effect.journey.visible).toBe(false);
    // Reduced motion settles the same visuals without moving the village camera.
    d.presentationFrame(16, true);
    expect(d.camera.position.equals(pose)).toBe(true);
    d.presentationFrame(4);
    const count = effect.railParts.filter(({ part }) => part.visible).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(effect.railParts.length);
    d.presentationFrame(8);
    expect(effect.solid.visible).toBe(false);
    expect(effect.tunnel.visible).toBe(true);
    expect(effect.solid.userData.activation).toBe('removed');
    expect(effect.tunnel.userData.activation).toBe('temporary-reveal');
    expect(effect.stones.some(({ part }) => !part.visible)).toBe(true);
    expect(effect.journey.visible).toBe(false);
    d.presentationFrame(10);
    expect(effect.stones.every(({ part }) => part.visible)).toBe(true);
    expect(effect.journey.visible).toBe(true);
    d.presentationFrame(15);
    expect(effect.journey.x).toBeGreaterThan(0);
    d.setPresentation(null);
    expect(batch.visible).toBe(true);
    expect(hill.userData.activation).toBe('completed');
    expect(effect.root.parent).toBeNull();
    expect(disposed).toHaveBeenCalledOnce();
    expect(d.controls.enabled).toBe(true);
    expect(d.camera.position.equals(pose)).toBe(true);
    expect(d.railwayOpening).toBeNull();
    expect(JSON.stringify(town)).toBe(saved);
    d.setPresentation({ id: 'unsupported' });
    expect(d.presentation).toBeNull();
  } finally {
    d.presentation?.dispose(false);
    d.actorRenderer.dispose();
    d.buildingRenderer.dispose();
    d.upgradeGlow.dispose();
    d.staticScenery.dispose(d);
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});
