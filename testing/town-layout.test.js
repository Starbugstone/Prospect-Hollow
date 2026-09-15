import { describe, expect, it } from 'vitest';
import {
  PerspectiveCamera,
  Vector3,
  Group,
  Box3,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
} from 'three';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { PLOTS, TOWN_TRACKS, segmentDistance } from '../src/game/town/TownLayout';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { groundHeight } from '../src/game/town/TownLandscape';

describe('Open village lots and usable paths', () => {
  it('keeps a compact central fountain and clear surrounding square at every upgrade level', () => {
    const d = Object.create(TownDiorama.prototype);
    const box = new BoxGeometry(1, 1, 1),
      sphere = new SphereGeometry(1),
      cylinder = new CylinderGeometry(1, 1, 1);
    d.geometries = { box, sphere, cylinder, cone: cylinder };
    d.materials = new Map();
    for (let stage = 1; stage <= 5; stage++) {
      const group = new Group();
      buildTownSquare(d, group, stage);
      const bounds = new Box3().setFromObject(group);
      expect(bounds.max.y).toBeLessThan(3.5);
      const fountain = group.getObjectByName('Town fountain');
      expect(fountain).toBeDefined();
      const fountainBounds = new Box3().setFromObject(fountain);
      expect(fountainBounds.max.x - fountainBounds.min.x).toBeLessThan(2.3);
      expect(fountain.position.x).toBe(0);
      expect(fountain.position.z).toBe(0);
      expect(bounds.max.x - bounds.min.x).toBeLessThan(6);
      expect(PLOTS.square[1]).toBeGreaterThan(PLOTS.mine[1]);
      expect(PLOTS.square[1]).toBeLessThan(PLOTS.well[1]);
    }
    box.dispose();
    sphere.dispose();
    cylinder.dispose();
    d.materials.forEach((material) => material.dispose());
  });
  it('leaves yards between every lot and keeps streets out of building centers', () => {
    const lots = Object.entries(PLOTS);
    for (let i = 0; i < lots.length; i++) {
      const [id, [x, z]] = lots[i];
      for (const [other, [ox, oz]] of lots.slice(i + 1))
        expect(
          Math.max(Math.abs(x - ox), Math.abs(z - oz)),
          `${id} / ${other}`,
        ).toBeGreaterThanOrEqual(6);
      for (const track of TOWN_TRACKS)
        expect(
          segmentDistance(x, z, track.from, track.to) - track.width / 2,
          id,
        ).toBeGreaterThanOrEqual(1.5);
      for (const dx of id === 'bridge' ? [] : [-3, 3])
        for (const dz of [-3, 3]) expect(groundHeight(x + dx, z + dz), id).toBe(0);
    }
  });
  it.each([
    [1440, 1028],
    [390, 400],
    [390, 844],
  ])('frames every lot at %s × %s without exceeding zoom limits', (width, height) => {
    const d = Object.create(TownDiorama.prototype);
    d.camera = new PerspectiveCamera(
      width / height < 0.7 ? 62 : width / height < 1.1 ? 48 : 40,
      width / height,
      0.1,
      400,
    );
    d.anchors = Object.keys(PLOTS).map((id) => ({ id }));
    d.controls = {
      minDistance: 13,
      maxDistance: 270,
      target: new Vector3(),
      update() {
        d.camera.lookAt(this.target);
        d.camera.updateMatrixWorld();
      },
    };
    d.frameTown();
    for (const [id, [x, z]] of Object.entries(PLOTS)) {
      for (const y of [0, 5]) {
        const screen = new Vector3(x, y, z).project(d.camera);
        expect(Math.abs(screen.x), `${id} horizontally`).toBeLessThan(0.92);
        expect(Math.abs(screen.y), `${id} vertically`).toBeLessThan(0.92);
      }
    }
    expect(d.camera.position.distanceTo(d.controls.target)).toBeLessThanOrEqual(270.000001);
  });
});
