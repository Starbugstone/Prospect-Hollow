import { describe, expect, it, vi } from 'vitest';
import { DirectionalLight, Scene, Vector3 } from 'three';
import { GARDEN_CLEARING, GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { AIRPORT, PLOTS } from '../src/game/town/TownLayout';
import { updateTownShadowCoverage } from '../src/game/town/TownShadows';

function view() {
  const sun = new DirectionalLight('#ffe3ad', 3.5);
  sun.shadow.mapSize.set(1024, 1024);
  const scene = new Scene();
  scene.matrixWorldAutoUpdate = false;
  scene.add(sun);
  return { sun, scene, renderer: { shadowMap: { autoUpdate: false } } };
}
const gardenPlots = Object.keys(GARDEN_PARCELS).map((id) => ({ id }));

describe('Reserved garden district shadow coverage', () => {
  it('keeps the original light and shadow frustum until a garden parcel is visible', () => {
    const d = view();
    updateTownShadowCoverage(d, [{ id: 'skyPods' }]);
    expect(d.sun.position.toArray()).toEqual([-24, 38, 18]);
    expect(d.sun.target.position.toArray()).toEqual([0, 0, 0]);
    expect(d.sun.shadow.camera).toMatchObject({
      left: -31,
      right: 31,
      top: 35,
      bottom: -35,
      near: 1,
      far: 95,
    });
  });

  it('includes all reserved parcel corners, the airport and old town with positive depth', () => {
    const d = view();
    updateTownShadowCoverage(d, gardenPlots);
    d.sun.shadow.updateMatrices(d.sun);
    for (const [id, [x, z]] of Object.entries(PLOTS)) {
      const parcel = GARDEN_PARCELS[id];
      const halfWidth = parcel?.halfWidth ?? (id === 'airport' ? AIRPORT.halfWidth : 3.8);
      const halfDepth =
        parcel?.halfDepth ?? (id === 'airport' ? AIRPORT.halfDepth : id === 'mine' ? 15 : 3.8);
      for (const dx of [-halfWidth, halfWidth])
        for (const dz of [-halfDepth, halfDepth])
          for (const y of [-3, 20]) {
            const projected = new Vector3(x + dx, y, z + dz).project(d.sun.shadow.camera);
            for (const axis of ['x', 'y', 'z'])
              expect(Math.abs(projected[axis]), `${id} ${axis}`).toBeLessThan(1);
          }
    }
    for (const x of [GARDEN_CLEARING.minX, GARDEN_CLEARING.maxX])
      for (const z of [GARDEN_CLEARING.minZ, GARDEN_CLEARING.maxZ]) {
        const projected = new Vector3(x, 0, z).project(d.sun.shadow.camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
      }
    expect(d.sun.shadow.camera.near).toBeGreaterThanOrEqual(1);
    expect(d.sun.shadow.camera.far).toBeLessThan(200);
  });

  it('preserves sun direction, exposure inputs, texture sizes and cached shadow updates', () => {
    const d = view();
    updateTownShadowCoverage(d, gardenPlots);
    expect(
      d.sun.position
        .clone()
        .sub(d.sun.target.position)
        .normalize()
        .distanceTo(new Vector3(-24, 38, 18).normalize()),
    ).toBeLessThan(1e-12);
    expect(d.sun.intensity).toBe(3.5);
    expect(d.sun.color.getHexString()).toBe('ffe3ad');
    expect(d.sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(d.renderer.shadowMap.autoUpdate).toBe(false);
    d.renderer.shadowMap.needsUpdate = false;
    const update = vi.spyOn(d.sun.shadow.camera, 'updateProjectionMatrix');
    expect(updateTownShadowCoverage(d, [...gardenPlots].reverse())).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(d.renderer.shadowMap.needsUpdate).toBe(false);
    updateTownShadowCoverage(d, [{ id: 'home' }]);
    expect(d.sun.position.toArray()).toEqual([-24, 38, 18]);
    expect(d.sun.target.position.toArray()).toEqual([0, 0, 0]);
    expect(d.sun.shadow.camera.right).toBe(31);
    expect(d.sun.shadow.camera.far).toBe(95);
    expect(d.renderer.shadowMap.needsUpdate).toBe(true);
  });

  it('widens the frustum for the Skyward quarter and elevator only once they are visible', () => {
    const garden = view(),
      skyward = view();
    updateTownShadowCoverage(garden, [{ id: 'teaHouse' }]);
    updateTownShadowCoverage(skyward, [{ id: 'teaHouse' }, { id: 'skyHarbour' }]);
    const width = ({ sun }) => sun.shadow.camera.right - sun.shadow.camera.left;
    expect(width(garden)).toBeLessThan(width(skyward));
    expect(updateTownShadowCoverage(garden, [{ id: 'teaHouse' }, { id: 'spaceElevator' }])).toBe(
      true,
    );
    for (const id of ['skyHarbour', 'spaceElevator']) {
      const d = view();
      updateTownShadowCoverage(d, [{ id }]);
      d.sun.shadow.updateMatrices(d.sun);
      const { position, halfWidth, halfDepth } = GARDEN_PARCELS[id];
      for (const dx of [-halfWidth, halfWidth])
        for (const dz of [-halfDepth, halfDepth]) {
          const projected = new Vector3(position[0] + dx, 0, position[1] + dz).project(
            d.sun.shadow.camera,
          );
          expect(Math.abs(projected.x), id).toBeLessThan(1);
          expect(Math.abs(projected.y), id).toBeLessThan(1);
        }
    }
  });
});
