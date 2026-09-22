import { describe, expect, it } from 'vitest';
import { Box3, Group } from 'three';
import { HERITAGE_UPGRADES, heritageUpgrade } from '../src/data/heritageUpgrades';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import {
  renderModernization,
  renderEraLandmark,
} from '../src/game/town/buildings/BuildingRenderer';
import { renderMotorLandmark } from '../src/game/town/buildings/motorAge';
import { renderWatermill } from '../src/game/town/buildings/watermill';
import { ERAS } from '../src/data/eras';

function drawing(run) {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.sign = () => {};
  try {
    run(d);
  } finally {
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
}

describe('Purpose-specific heritage upgrades', () => {
  it('preserves the original building identity through River & Rail aliases', () =>
    drawing((d) => {
      for (const [kind, feature] of Object.entries(HERITAGE_UPGRADES)) {
        if (['powerHouse', 'fireStation', 'rowHouses', 'mill'].includes(kind)) continue;
        for (const level of [2, 3]) {
          const root = new Group();
          renderModernization(d, root, kind, 'river-rail', level);
          expect(!!root.getObjectByName(`Heritage ${feature}`), `${kind} ${level}`).toBe(
            level === 3,
          );
        }
      }
      // These share base models, but must retain different working expansions.
      expect(heritageUpgrade('post')).not.toBe(heritageUpgrade('shop'));
      expect(heritageUpgrade('railDepot')).not.toBe(heritageUpgrade('museum'));
      expect(heritageUpgrade('unknown-future-building')).toBeNull();
    }));
  it('carries the same purpose through industrial and inherited Motor Age models', () =>
    drawing((d) => {
      for (const kind of [
        'home',
        'bank',
        'warehouse',
        'school',
        'post',
        'railDepot',
        'blacksmith',
      ]) {
        for (const era of ['industrial', 'motor-age']) {
          const root = new Group();
          expect(renderEraLandmark(d, root, kind, kind, 3, era, 3)).toBe(true);
          expect(
            root.getObjectByName(`Heritage ${heritageUpgrade(kind)}`),
            `${kind} ${era}`,
          ).toBeDefined();
        }
      }
    }));
  it('supports both Motor Age tank sizes from ground to vessel and seats their lids', () =>
    drawing((d) => {
      for (const level of [2, 3]) {
        const root = new Group();
        renderMotorLandmark(d, root, 'well', 'Well', level);
        const tank = root.getObjectByName('Motor Age supported water tank');
        const vessel = new Box3().setFromObject(tank.getObjectByName('Tank vessel'));
        const lid = new Box3().setFromObject(tank.getObjectByName('Tank lid'));
        expect(lid.min.y).toBeCloseTo(vessel.max.y, 5);
        const supports = tank.children.filter((part) => part.name === 'Tank support');
        expect(supports).toHaveLength(4);
        for (const support of supports) {
          const bounds = new Box3().setFromObject(support);
          expect(bounds.min.y).toBeLessThanOrEqual(0.201);
          expect(bounds.max.y).toBeGreaterThanOrEqual(vessel.min.y - 0.001);
        }
      }
    }));
  it('puts the final mill loading expansion in front of the main shell in every era', () =>
    drawing((d) => {
      for (const era of ERAS) {
        const second = new Group(),
          final = new Group();
        renderWatermill(d, second, era.id, 2, 'Mill');
        renderWatermill(d, final, era.id, 3, 'Mill');
        expect(second.getObjectByName('Watermill grain loading expansion')).toBeUndefined();
        const extension = new Box3().setFromObject(
          final.getObjectByName('Watermill grain loading expansion'),
        );
        expect(extension.max.z).toBeGreaterThan(2.8);
        expect(extension.max.y).toBeGreaterThan(2.4);
        expect(extension.max.x).toBeLessThan(1); // Wheel and excavated millrace remain clear.
      }
    }));
});
