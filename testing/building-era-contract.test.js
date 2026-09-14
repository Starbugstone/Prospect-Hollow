import { expect, it } from 'vitest';
import { BoxGeometry, Group, MeshBasicMaterial, Scene } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { buildingServiceLevel } from '../src/data/buildingProgression';
import { advanceEra, eraIndex, eraBuildingLevel, isEraComplete } from '../src/game/town/TownEras';
import { buildWithHammer, plotUnlocked, upgradeOffer } from '../src/game/town/TownRules';
import { visiblePlots } from '../src/game/town/TownLayout';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { addImprovements } from '../src/game/town/TownImprovements';
import { TownDiorama } from '../src/game/town/TownDiorama';
import {
  renderBuilding,
  renderEraLandmark,
  renderModernization,
} from '../src/game/town/buildings/BuildingRenderer';

it('every plot begins in its own era, advances through every later playable era, and visibly changes', () => {
  let town = createTown();
  town.coins = 10000000;
  town.tourSeen = true;
  const signatures = new Map();
  const d = Object.create(TownDiorama.prototype);
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  const geometry = new BoxGeometry();
  d.geometries = Object.fromEntries(
    ['box', 'rounded', 'sphere', 'rock', 'cylinder', 'cone', 'shadow'].map((key) => [
      key,
      geometry,
    ]),
  );
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.sign = () => {};
  for (const era of ERAS.filter((e) => e.enabled)) {
    expect(town.era).toBe(era.id);
    const available = BUILDINGS.filter((b) => eraIndex(b.introducedEra) <= eraIndex(era.id));
    const future = BUILDINGS.filter((b) => eraIndex(b.introducedEra) > eraIndex(era.id));
    for (const b of future) {
      expect(plotUnlocked(town, b.id), b.id).toBe(false);
      expect(upgradeOffer(town, b.id)?.available ?? false, b.id).toBe(false);
      expect(visiblePlots(town).some((p) => p.id === b.id)).toBe(false);
      expect(buildWithHammer(town, b.id, 0), b.id).toBeNull();
    }
    // Fund/build prerequisites in catalog order, then modernize familiar plots.
    for (let pass = 0; pass < 10 && !isEraComplete(town); pass++) {
      for (const b of available) {
        let offer;
        while ((offer = upgradeOffer(town, b.id))?.available) {
          if (b.introducedEra !== era.id) expect(offer.targetEra, b.id).toBe(era.id);
          const next = buildWithHammer(town, b.id, offer.stage);
          expect(next, b.id).not.toBeNull();
          town = next;
        }
      }
    }
    expect(isEraComplete(town), era.id).toBe(true);
    for (const b of available) {
      expect(town.buildingEras[b.id], b.id).toBe(era.id);
      expect(eraBuildingLevel(town, b.id), b.id).toBe(
        era.id === 'frontier' ? b.upgrades.length : 3,
      );
      d.town = town;
      const root = new Group(),
        kind = b.kind;
      const stage = buildingServiceLevel(b.id, town.buildings[b.id]);
      if (kind === 'bridge') {
        renderBuilding({ town: d, parent: root, kind, level: stage, label: b.name });
        renderModernization(d, root, kind, era.id, 3);
      } else if (!renderEraLandmark(d, root, kind, b.name, 3, era.id, stage)) {
        if (kind === 'square') buildTownSquare(d, root, stage);
        else if (kind === 'well') d.well(root);
        else renderBuilding({ town: d, parent: root, kind, level: stage, label: b.name });
        if (!['fisherman', 'blacksmith', 'school', 'doctor'].includes(kind))
          addImprovements(d, root, kind, stage);
        renderModernization(d, root, kind, era.id, 3);
      }
      const parts = [];
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (o.isMesh)
          parts.push([
            o.geometry.attributes.position.count,
            o.geometry.index?.count,
            o.material.color.getHex(),
            o.matrixWorld.toArray(),
          ]);
      });
      expect(parts.length, b.id).toBeGreaterThan(0);
      const signature = JSON.stringify(parts);
      if (signatures.has(b.id))
        expect(signature, `${b.id}: ${era.id}`).not.toBe(signatures.get(b.id));
      signatures.set(b.id, signature);
    }
    const next = ERAS[eraIndex(era.id) + 1];
    if (next?.enabled) {
      const previousFacades = { ...town.buildingEras };
      town = advanceEra(town, era.id);
      expect(town.buildingEras).toEqual(previousFacades);
      town.transition.pending = false;
    }
  }
  expect(signatures.size).toBe(BUILDINGS.length);
  for (const g of new Set(Object.values(d.geometries))) g.dispose();
  d.materials.forEach((m) => m.dispose());
  d.contactShadowMaterial.dispose();
});
