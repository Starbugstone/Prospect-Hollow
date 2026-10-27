import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Box3, Group } from 'three';
import { createTown } from '../src/data/town';
import { AREA_BY_ID } from '../src/data/townLandmarks';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import * as catalog from '../src/game/town/assets/MeshCatalog';

afterEach(() => vi.restoreAllMocks());

describe('Monument Square Blender sculptures', () => {
  it('downloads the sculpture family only for an owned main monument, including construction', () => {
    const town = createTown();
    expect(catalog.requiredFamilies(town)).not.toContain('monuments');
    town.personalisation.areas.meadow = ['headframe'];
    expect(catalog.requiredFamilies(town)).not.toContain('monuments');
    town.personalisation.areas.monument = ['guardian'];
    expect(catalog.requiredFamilies(town)).toContain('monuments');
  });

  it.each(AREA_BY_ID.monument.choices)(
    'imports %s with reusable geometry and live mechanisms',
    async (choice) => {
      const d = new TownPrimitives();
      try {
        const root = buildLandmark(d, new Group(), choice, 1, true);
        const model = root.getObjectByName(`Blender ${choice}`);
        expect(model).toBeTruthy();
        expect(model.userData.substitute).not.toBe(true);
        const parts = catalog.resolveModel('monuments', choice).model;
        for (const part of parts) {
          expect(part.positions.length).toBe(part.normals.length);
          expect(part.positions.every(Number.isFinite)).toBe(true);
          expect(Math.max(...part.indices)).toBeLessThan(part.positions.length / 3);
          for (let i = 0; i < part.normals.length; i += 3)
            expect(Math.hypot(...part.normals.slice(i, i + 3))).toBeCloseTo(1, 3);
        }
        const before = model.children.map((node) => node.rotation.toArray());
        root.userData.sceneryUpdate(4);
        expect(model.children.map((node) => node.rotation.toArray())).not.toEqual(before);
        for (const time of [0, 4, 20, 100]) {
          root.userData.sceneryUpdate(time);
          const bounds = new Box3().setFromObject(root);
          expect(bounds.min.y).toBeGreaterThanOrEqual(0);
          expect(
            Math.max(
              Math.abs(bounds.min.x),
              Math.abs(bounds.max.x),
              Math.abs(bounds.min.z),
              Math.abs(bounds.max.z),
            ),
          ).toBeLessThan(AREA_BY_ID.monument.radius);
        }
        const copy = buildLandmark(d, new Group(), choice, 1, true, true);
        const still = copy.getObjectByName(`Blender ${choice}`);
        const stillPose = still.children.map((node) => node.rotation.toArray());
        copy.userData.sceneryUpdate(20);
        expect(still.children.map((node) => node.rotation.toArray())).toEqual(stillPose);
        expect(copy.userData.movingParts).toHaveLength(0);
        expect(still.children[0].children[0].geometry).toBe(model.children[0].children[0].geometry);
        const portrait = await readFile(
          new URL(`../public/art/monuments/${choice}.png`, import.meta.url),
        );
        expect([...portrait.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      } finally {
        d.disposePrimitives();
      }
    },
  );

  it('keeps a renderable, animated fallback when sculpture downloads are unavailable', () => {
    vi.spyOn(catalog, 'resolveModel').mockReturnValue({ status: 'unavailable' });
    const d = new TownPrimitives();
    try {
      for (const choice of AREA_BY_ID.monument.choices) {
        const root = buildLandmark(d, new Group(), choice, 1, true);
        expect(root.getObjectByName(`Blender ${choice}`)).toBeUndefined();
        expect(new Box3().setFromObject(root).isEmpty()).toBe(false);
        expect(root.userData.movingParts.length).toBeGreaterThan(0);
      }
    } finally {
      d.disposePrimitives();
    }
  });
});
