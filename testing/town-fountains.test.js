import { describe, expect, it, vi } from 'vitest';
import { Box3, Group, MeshBasicMaterial } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { FOUNTAINS, addTownFountain } from '../src/game/town/TownFountains';
import { renderEraLandmark } from '../src/game/town/buildings/BuildingRenderer';
import { FOUNTAIN_DESIGNS, fountainDesign, resolveFountain } from '../src/data/fountains';
import { defineEra } from '../src/data/eraDefinitions';
import { ERAS } from '../src/data/eras';
import { createTown } from '../src/data/town';
import { townNavigation } from '../src/game/town/TownNavigation';
import TownSquare from '../src/components/town/TownSquare.vue';

function diorama() {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.sign = () => {};
  return d;
}
// The same route the village uses: era landmarks first, then the shared square.
function square(d, era, stage) {
  const root = new Group();
  if (!renderEraLandmark(d, root, 'square', 'Square', 3, era, stage))
    buildTownSquare(d, root, stage, era === 'frontier', era);
  return root.getObjectByName('Town fountain');
}

describe('Era town square fountains', () => {
  it.each(ERAS.map((era) => era.id))('keeps the %s square open around its fountain', (era) => {
    const d = diorama(),
      root = new Group(),
      town = createTown();
    d.town = town;
    d.sign = vi.fn();
    town.era = era;
    town.buildings.square = 5;
    town.buildingEras.square = era;
    town.buildingEraLevels.square = 3;
    d.buildPlot('square', root, town, { square: 'Town square' });
    expect(root.getObjectByName('Town fountain')?.userData.design).toBe(fountainDesign(era));
    expect(d.sign).not.toHaveBeenCalled();
    const navigation = townNavigation(root);
    for (const x of [-1.8, 0, 1.8]) expect(navigation.clear([x, 0.07, 3.2], 0.3)).toBe(true);
    root.traverse((part) => {
      if (!part.isMesh) return;
      const bounds = new Box3().setFromObject(part);
      const blocksFront =
        bounds.min.z > 2.6 && bounds.max.y > 2 && bounds.min.x < -1 && bounds.max.x > 1;
      expect(blocksFront).toBe(false);
    });
    d.clearGroup(root);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  });

  it('gives every era its own registered centerpiece', () => {
    expect(Object.keys(FOUNTAINS).sort()).toEqual([...FOUNTAIN_DESIGNS].sort());
    const designs = ERAS.map((era) => fountainDesign(era.id));
    expect(new Set(designs).size).toBe(ERAS.length);
    expect(designs).toEqual([
      'frontier-spring',
      'victorian-iron',
      'civic-monument',
      'memorial-obelisk',
      'art-deco',
      'mid-century',
      'postmodern',
      'splash-plaza',
    ]);
  });

  it('falls back safely for unknown eras, unregistered designs and new style eras', () => {
    expect(fountainDesign('unknown-era')).toBe('frontier-spring');
    expect(resolveFountain('missing-design')).toBe('frontier-spring');
    expect(resolveFountain(undefined)).toBe('frontier-spring');
    const future = defineEra({
      id: 'future-city',
      label: 'Future',
      yearLabel: '2040',
      enabled: false,
      evolution: {
        style: 'city',
        prices: [1, 2, 3],
        cityAssets: 'contemporary',
        newBuildingPrices: [1, 2, 3],
      },
    });
    expect(future.evolution.fountain).toBe('memorial-obelisk');
    const d = diorama();
    const fountain = addTownFountain(d, new Group(), 5, 'unknown-era');
    expect(fountain.userData.design).toBe('frontier-spring');
  });

  it.each(ERAS.map((era) => era.id))(
    'keeps the %s fountain compact, walkable and cheap to draw at every stage',
    (era) => {
      const d = diorama();
      const counts = [];
      for (let stage = 1; stage <= 5; stage++) {
        const fountain = square(d, era, stage);
        expect(fountain.userData.design).toBe(fountainDesign(era));
        expect(fountain.userData.walkObstacles).toEqual([
          { x: 0, z: 0, radius: 1.08, height: 2.2 },
        ]);
        const bounds = new Box3().setFromObject(fountain);
        for (const v of [bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z])
          expect(Math.abs(v)).toBeLessThan(1.15);
        expect(bounds.max.y).toBeLessThan(3.2);
        const meshes = [];
        fountain.traverse((o) => o.isMesh && meshes.push(o));
        counts.push(meshes.length);
        expect(meshes.length).toBeLessThan(160);
        // Falling water shares one translucent material; everything else is opaque.
        const translucent = new Set(
          meshes.filter((m) => m.material.transparent).map((m) => m.material),
        );
        expect(translucent.size).toBe(1);
        expect(new Set(meshes.map((m) => m.material)).size).toBeLessThanOrEqual(10);
      }
      const early = era === 'motor-age' ? counts[2] : counts[0];
      expect(counts[4]).toBeGreaterThanOrEqual(early);
      if (era !== 'motor-age') expect(counts[2]).toBeGreaterThan(counts[1]);
    },
  );

  it('draws the matching fountain in the SVG fallback', async () => {
    for (const era of ERAS) {
      const html = await renderToString(
        createSSRApp({ render: () => h('svg', [h(TownSquare, { stage: 5, era: era.id })]) }),
      );
      expect(html).toContain(`data-design="${fountainDesign(era.id)}"`);
    }
  });
});
