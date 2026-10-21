import { describe, expect, it } from 'vitest';
import { Box3, Group, Raycaster, Triangle, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { addCozyRoof, renderCozyBuilding } from '../src/game/town/buildings/cozy';
import { renderFutureBuilding } from '../src/game/town/buildings/future';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';
import { cozyAppearance } from '../src/data/cozyArchitecture';
import {
  MOON_PALETTE,
  FUTURE_LANDMARKS,
  FUTURE_ARCHITECTURES,
  futureForm,
} from '../src/data/futureArchitecture';
import { ERAS } from '../src/data/eras';
import { BUILDINGS } from '../src/data/town';
import { buildingStages } from '../src/data/buildingStages';
import { heritageUpgrade } from '../src/data/heritageUpgrades';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import TownCozyBuilding from '../src/components/town/TownCozyBuilding.vue';
import TownFutureBuilding from '../src/components/town/TownFutureBuilding.vue';
import TownMoonBuilding from '../src/components/town/TownMoonBuilding.vue';

function townArt() {
  const d = new TownPrimitives();
  d.sign = () => {};
  return d;
}
function model(d, render, kind, level, era) {
  const root = new Group();
  if (era) render(d, root, kind, kind, level, era, 3);
  else render(d, root, kind, level);
  root.updateMatrixWorld(true);
  return root;
}
function meshes(root) {
  const result = [];
  root.traverse((part) => {
    if (part.isMesh) result.push(part);
  });
  return result;
}
function purposeModules(root) {
  const found = [];
  root.traverse((part) => {
    if (part.userData.purposeModule) found.push(part);
  });
  return found;
}
function moduleParts(root, role) {
  return meshes(root).filter((mesh) => {
    for (let node = mesh; node && node !== root; node = node.parent)
      if (node.userData.modulePart) return node.userData.modulePart === role;
    return false;
  });
}
function boxVolume(mesh) {
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new Vector3());
  return size.x * size.y * size.z * Math.abs(mesh.scale.x * mesh.scale.y * mesh.scale.z);
}
function firstSurface(root, origin, direction = [0, 0, -1]) {
  return new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
    root,
    true,
  )[0];
}
function illustration(component, props) {
  return renderToString(createSSRApp({ render: () => h('svg', [h(component, props)]) }));
}
function geometrySignature(root) {
  return JSON.stringify(
    meshes(root)
      .map((mesh) => [
        mesh.geometry.uuid,
        mesh.material.color.getHexString(),
        ...mesh.matrixWorld.elements.map((n) => Number(n.toFixed(4))),
      ])
      .sort(),
  );
}
function campusStructureSignature(root) {
  const groups = [];
  root.traverse((part) => {
    if (['Future building block', 'Future building tower'].includes(part.name)) groups.push(part);
  });
  return groups.map(geometrySignature).sort().join('|');
}
function intersectsGeometry(root, box) {
  const triangle = new Triangle();
  for (const mesh of meshes(root)) {
    const position = mesh.geometry.attributes.position,
      index = mesh.geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      for (const [offset, target] of [
        [0, triangle.a],
        [1, triangle.b],
        [2, triangle.c],
      ])
        target
          .fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset)
          .applyMatrix4(mesh.matrixWorld);
      if (box.intersectsTriangle(triangle)) return true;
    }
  }
  return false;
}
const modernizingFutureKinds = ERAS.flatMap((era, eraIndex) => {
  if (!FUTURE_ARCHITECTURES.includes(era.evolution.architecture)) return [];
  return [
    ...new Set(
      BUILDINGS.filter(
        (b) =>
          !b.settlement &&
          ERAS.findIndex((e) => e.id === b.introducedEra) < eraIndex &&
          (!era.evolution.modernizes || era.evolution.modernizes.includes(b.id)),
      ).map((b) => b.kind),
    ),
  ]
    .filter((kind) => futureForm(kind) && futureForm(kind) !== 'square')
    .map((kind) => [era.id, kind]);
});

describe('future town structure and useful finish tiers', () => {
  it('keeps all three Canopy cottages on the first and second Riverlight finishes', () => {
    const d = townArt();
    for (const [era, level, expected] of [
      ['canopy', 1, 2],
      ['canopy', 3, 3],
      ['riverlight', 1, 3],
      ['riverlight', 2, 3],
    ]) {
      const root = model(d, renderCozyBuilding, 'orchardCottages', level, era);
      const wall = cozyAppearance(era).palette.shell.replace('#', '');
      const cottages = meshes(root).filter(
        (m) =>
          m.geometry === d.geometries.cylinder &&
          m.material.color.getHexString() === wall &&
          m.scale.y > 1 &&
          m.scale.x > 0.6,
      );
      expect(cottages.length, `${era} L${level}`).toBe(expected);
    }
    d.disposePrimitives();
  });

  it('keeps the atelier growing halls and makes the new finish tiers distinct', () => {
    const d = townArt();
    const roots = [1, 2, 3].map((level) =>
      model(d, renderCozyBuilding, 'blossomAtelier', level, 'riverlight'),
    );
    const bounds = roots.map((root) => new Box3().setFromObject(root));
    for (const b of bounds) {
      expect(b.min.x).toBeLessThan(-5);
      expect(b.max.x).toBeGreaterThan(5);
    }
    expect(roots[0].getObjectByName('Cozy purpose finish greenhouse')).toBeTruthy();
    expect(roots[1].getObjectByName('Cozy purpose finish greenhouse')).toBeTruthy();
    expect(meshes(roots[2]).length).toBeGreaterThan(meshes(roots[1]).length);
    d.disposePrimitives();
  });

  it.each(['teaHouse', 'blossomAtelier', 'orchardCottages'])(
    'preserves the actual completed %s hall and greenhouse dimensions at the Riverlight handover',
    (kind) => {
      const d = townArt();
      const bodies = (root, era) => {
        const p = cozyAppearance(era).palette;
        const colors = [p.shell, p.glass].map((color) => color.replace('#', ''));
        return JSON.stringify(
          meshes(root)
            .filter(
              (mesh) =>
                [d.geometries.cylinder, d.geometries.sphere].includes(mesh.geometry) &&
                mesh.scale.y > 0.3 &&
                colors.includes(mesh.material.color.getHexString()),
            )
            .map((mesh) => [
              mesh.geometry.uuid,
              ...mesh.matrixWorld.elements.map((n) => Number(n.toFixed(4))),
            ])
            .sort(),
        );
      };
      const mature = model(d, renderCozyBuilding, kind, 3, 'canopy');
      const firstFinish = model(d, renderCozyBuilding, kind, 1, 'riverlight');
      expect(bodies(firstFinish, 'riverlight')).toBe(bodies(mature, 'canopy'));
      d.disposePrimitives();
    },
  );

  it.each(['canopy', 'riverlight', 'skysail', 'stargazer', 'moonward'])(
    'keeps the mature orchard courtyard arrival clear in %s',
    (era) => {
      const d = townArt();
      const render = ['canopy', 'riverlight'].includes(era)
        ? renderCozyBuilding
        : renderFutureBuilding;
      const root = model(d, render, 'orchardCottages', 3, era);
      const scale = FUTURE_LANDMARKS.orchardCottages.scale;
      const route = new Box3(
        new Vector3(-0.4, 0.1, 0.8).multiplyScalar(scale),
        new Vector3(0.4, 1.7, 2.2).multiplyScalar(scale),
      );
      expect(
        meshes(root).filter((m) => new Box3().setFromObject(m).intersectsBox(route)),
      ).toHaveLength(0);
      d.disposePrimitives();
    },
  );

  it('does not finish a rectangular workshop with a green disc through its walls', () => {
    const d = townArt();
    const root = model(d, renderCozyBuilding, 'warehouse', 3, 'canopy');
    expect(
      meshes(root).filter(
        (m) =>
          m.geometry === d.geometries.cylinder &&
          m.material.color.getHexString() === '80a17c' &&
          m.scale.y < 0.18 &&
          m.scale.x > 1,
      ),
    ).toHaveLength(0);
    d.disposePrimitives();
  });

  it('places the cozy classroom glazing on the visible annex doorway and seats its daylight unit on the roof', () => {
    const d = townArt();
    const root = model(d, renderCozyBuilding, 'school', 3, 'canopy');
    const module = purposeModules(root)[0];
    const frontage = moduleParts(module, 'frontage');
    const pane = frontage.at(-1),
      target = pane.getWorldPosition(new Vector3());
    const ray = new Raycaster(target.clone().add(new Vector3(0, 0, 5)), new Vector3(0, 0, -1));
    expect(frontage, 'street-facing glass rather than hidden rear panel').toContain(
      ray.intersectObject(root, true)[0]?.object,
    );
    expect(target.z).toBeGreaterThan(-0.2);
    const equipment = module.getObjectByName('Roof-seated purpose equipment');
    const foot = new Box3().setFromObject(equipment).min.y;
    const center = equipment.getWorldPosition(new Vector3());
    const roof = new Raycaster(
      center.clone().setY(center.y + 3),
      new Vector3(0, -1, 0),
    ).intersectObjects(moduleParts(module, 'structure'), false)[0];
    expect(roof).toBeTruthy();
    expect(foot).toBeLessThan(roof.point.y + 0.02);
    expect(new Box3().setFromObject(equipment).max.y).toBeGreaterThan(roof.point.y);
    d.disposePrimitives();
  });

  it.each(['school', 'doctor', 'blacksmith'])(
    'grows a purpose-specific %s annex on a later finish',
    (kind) => {
      const d = townArt();
      const before = model(d, renderFutureBuilding, kind, 1, 'stargazer');
      const after = model(d, renderFutureBuilding, kind, 2, 'stargazer');
      const oldBounds = new Box3().setFromObject(before);
      const newBounds = new Box3().setFromObject(after);
      expect(newBounds.max.y).toBeGreaterThanOrEqual(oldBounds.max.y);
      const purpose = [];
      after.traverse((part) => {
        if (part.name.startsWith('Purpose wing')) purpose.push(part);
      });
      expect(purpose).toHaveLength(1);
      expect(purpose[0].userData.upgradeFeature).toBe(
        { school: 'classroom', doctor: 'clinic', blacksmith: 'workshop' }[kind],
      );
      d.disposePrimitives();
    },
  );

  it.each(['skysail', 'stargazer', 'moonward'])(
    'leaves the centered shop arrival route clear in %s',
    (era) => {
      const d = townArt();
      const route = new Box3(new Vector3(-0.4, 0.35, 0.91), new Vector3(0.4, 1.15, 1.25));
      for (const level of [1, 2, 3]) {
        const root = model(d, renderFutureBuilding, 'market', level, era);
        const obstructions = meshes(root).filter((m) =>
          new Box3().setFromObject(m).intersectsBox(route),
        );
        expect(obstructions, `${era} L${level}`).toHaveLength(0);
      }
      d.disposePrimitives();
    },
  );

  it('provides a real suspended deck and upper arrival doors between the lofts', () => {
    const d = townArt();
    const root = model(d, renderFutureBuilding, 'windsongLofts', 2, 'skysail');
    const scale = FUTURE_LANDMARKS.windsongLofts.scale;
    const hit = firstSurface(root, [0, 4 * scale, 0.441 * scale], [0, -1, 0]);
    expect(hit).toBeTruthy();
    expect(hit.point.y / scale).toBeCloseTo(2.165, 2);
    expect(hit.point.y - 0.13 * scale).toBeGreaterThan(1.7);
    const doors = meshes(root).filter((m) => m.name === 'Loft walkway entrance');
    expect(doors).toHaveLength(2);
    for (const door of doors) {
      const bounds = new Box3().setFromObject(door);
      expect(Math.abs(bounds.min.y - hit.point.y)).toBeLessThan(0.025 * scale);
      expect(bounds.max.y / scale).toBeLessThan(3);
    }
    d.disposePrimitives();
  });

  it('runs the fin support crossbar through the elevator crown', () => {
    const d = townArt();
    const root = model(d, renderFutureBuilding, 'spaceElevator', 2, 'moonward');
    const mounts = root.getObjectByName('Elevator solar fin mounts');
    expect(mounts).toBeTruthy();
    const crossbar = meshes(mounts).find(
      (m) => new Box3().setFromObject(m).getSize(new Vector3()).x > 4.7,
    );
    const bounds = new Box3().setFromObject(crossbar);
    expect(bounds.containsPoint(new Vector3(0, 5.55, -1.6))).toBe(true);
    expect(bounds.min.x).toBeLessThan(-2.3);
    expect(bounds.max.x).toBeGreaterThan(2.3);
    d.disposePrimitives();
  });

  it('retains the completed Dewlight collection and processing structure at the Moonward handover', () => {
    const d = townArt();
    const before = model(d, renderFutureBuilding, 'dewlightGardens', 3, 'stargazer');
    const after = [1, 2, 3].map((level) =>
      model(d, renderFutureBuilding, 'dewlightGardens', level, 'moonward'),
    );
    const retained = (root) =>
      JSON.stringify(
        meshes(root.getObjectByName('Dew collection manifold'))
          .map((mesh) => [
            mesh.geometry.uuid,
            ...mesh.matrixWorld.elements.map((n) => Number(n.toFixed(4))),
          ])
          .sort(),
      );
    for (const root of after) expect(retained(root)).toBe(retained(before));
    d.disposePrimitives();
  });

  it('gives every reachable modernizing future kind a useful second tier and distinct completion', () => {
    for (const [era, kind] of modernizingFutureKinds) {
      const d = townArt();
      expect(buildingStages(kind, era, 1).modernizing, `${era} ${kind}`).toBe(true);
      const roots = [1, 2, 3].map((level) => model(d, renderFutureBuilding, kind, level, era));
      const landmark = FUTURE_LANDMARKS[kind],
        garden = futureForm(kind) === 'garden';
      const purpose = heritageUpgrade(kind);
      expect(purpose, `${era} ${kind} purpose`).toBeTruthy();
      const name = `${landmark || garden ? 'Future purpose finish' : 'Purpose wing'} ${purpose}`;
      for (const root of roots) expect(root.getObjectByName(name), `${era} ${kind}`).toBeTruthy();
      const modules = roots.map((root) => {
        const found = purposeModules(root);
        expect(found, `${era} ${kind} one retained module`).toHaveLength(1);
        expect(found[0].userData.purposeModule.level).toBe(3);
        return found[0];
      });
      const structuralSignature = (module) =>
        JSON.stringify(
          moduleParts(module, 'structure')
            .map((mesh) => [
              mesh.geometry.uuid,
              ...mesh.matrixWorld.elements.map((n) => Number(n.toFixed(4))),
            ])
            .sort(),
        );
      expect(structuralSignature(modules[1]), `${era} ${kind} L2 retains full structure`).toBe(
        structuralSignature(modules[0]),
      );
      expect(structuralSignature(modules[2]), `${era} ${kind} L3 retains full structure`).toBe(
        structuralSignature(modules[0]),
      );
      const envelope = new Box3().setFromObject(modules[2]).expandByScalar(0.0001);
      for (const module of modules)
        expect(
          envelope.containsBox(new Box3().setFromObject(module)),
          `${era} ${kind} fixed room envelope`,
        ).toBe(true);
      const oldOperation = moduleParts(modules[1], 'operation').reduce(
        (sum, mesh) => sum + boxVolume(mesh),
        0,
      );
      const completedOperation = moduleParts(modules[2], 'operation').reduce(
        (sum, mesh) => sum + boxVolume(mesh),
        0,
      );
      const frontage = moduleParts(modules[1], 'frontage').reduce(
        (sum, mesh) => sum + boxVolume(mesh),
        0,
      );
      expect(frontage, `${era} ${kind} substantial functional frontage`).toBeGreaterThan(0.02);
      expect(
        completedOperation - oldOperation,
        `${era} ${kind} substantial working upgrade`,
      ).toBeGreaterThan(0.025);
      for (const module of modules)
        expect(
          moduleParts(module, 'frontage').length + moduleParts(module, 'operation').length,
          `${era} ${kind} bounded grade parts`,
        ).toBeLessThanOrEqual(8);
      expect(geometrySignature(roots[1]), `${era} ${kind} L1→L2`).not.toBe(
        geometrySignature(roots[0]),
      );
      expect(geometrySignature(roots[2]), `${era} ${kind} L2→L3`).not.toBe(
        geometrySignature(roots[1]),
      );
      if (landmark || garden) {
        expect(roots[0].getObjectByName(name)).toBeTruthy();
        const counts = roots.map((root) => {
          let count = 0;
          root.traverse((part) => {
            if (['Future building block', 'Future building tower'].includes(part.name)) count++;
          });
          return count;
        });
        expect(counts[1], `${era} ${kind} retained mature buildings`).toBe(counts[0]);
        expect(counts[2], `${era} ${kind} retained mature buildings`).toBe(counts[0]);
        expect(
          campusStructureSignature(roots[1]),
          `${era} ${kind} retained component dimensions`,
        ).toBe(campusStructureSignature(roots[0]));
        expect(
          campusStructureSignature(roots[2]),
          `${era} ${kind} retained component dimensions`,
        ).toBe(campusStructureSignature(roots[0]));
        const finish = roots[2].getObjectByName(name);
        expect(meshes(finish).length, `${era} ${kind} bounded finish`).toBeLessThanOrEqual(12);
        expect(finish.getObjectByName('Purpose finish room')).toBeTruthy();
        expect(finish.getObjectByName('Purpose finish completion')).toBeTruthy();
        const finishMeshes = new Set(meshes(finish));
        const walls = meshes(roots[2]).filter((m) => !finishMeshes.has(m));
        const outward = new Vector3(0, 0, 1).transformDirection(finish.matrixWorld);
        const scale = landmark?.scale ?? 1;
        for (const bracket of meshes(finish).filter(
          (m) => m.name === 'Purpose finish wall bracket',
        )) {
          const attachment = bracket.localToWorld(new Vector3(0, -0.5, 0));
          const ray = new Raycaster(
            attachment.clone().addScaledVector(outward, 2 * scale),
            outward.clone().negate(),
          );
          expect(
            ray.intersectObjects(walls, false)[0]?.distance,
            `${era} ${kind} bracket meets wall`,
          ).toBeLessThan(2 * scale + 0.015);
        }
        const parcel = GARDEN_PARCELS[kind];
        if (parcel) {
          const points = [...parcel.approach, [0, parcel.entranceZ]];
          for (let i = 1; i < points.length; i++) {
            const [a, b] = [points[i - 1], points[i]];
            const route = new Box3(
              new Vector3(Math.min(a[0], b[0]) - 0.55, 0.19, Math.min(a[1], b[1]) - 0.55),
              new Vector3(Math.max(a[0], b[0]) + 0.55, 1.95, Math.max(a[1], b[1]) + 0.55),
            );
            expect(intersectsGeometry(finish, route), `${era} ${kind} arrival corridor`).toBe(
              false,
            );
          }
        }
      }
      d.disposePrimitives();
    }
  }, 30000);

  it('keeps headroom above the full authored orchard entrance approach', () => {
    const d = townArt();
    const root = model(d, renderCozyBuilding, 'orchardCottages', 3, 'riverlight');
    root.position.y = 0.08;
    root.updateMatrixWorld(true);
    const approach = GARDEN_PARCELS.orchardCottages.approach;
    const route = new Box3(
      new Vector3(approach[0][0] - 0.55, 0.19, approach[0][1] - 0.55),
      new Vector3(approach[1][0] + 0.55, 1.95, approach[1][1] + 0.55),
    );
    expect(intersectsGeometry(root.getObjectByName('Cozy purpose finish veranda'), route)).toBe(
      false,
    );
    d.disposePrimitives();
  });

  it('bears the thin Canopy eave on the wall head around its entire circumference', () => {
    const d = townArt(),
      root = new Group();
    d.mesh(root, 'cylinder', [1, 2, 1], [0, 1, 0], cozyAppearance('canopy').palette.shell);
    addCozyRoof(d, root, 0, 2, 0, 1.25, 'canopy');
    root.updateMatrixWorld(true);
    const eave = meshes(root).find((m) => m.geometry === d.geometries['cozy-eave-ring']);
    for (let n = 0; n < 24; n++) {
      const angle = (n / 24) * Math.PI * 2;
      const ray = new Raycaster(
        new Vector3(Math.cos(angle), 3, Math.sin(angle)),
        new Vector3(0, -1, 0),
      );
      const hit = ray.intersectObject(eave)[0];
      expect(hit, `wall bearing angle ${n}`).toBeTruthy();
      expect(hit.point.y).toBeGreaterThanOrEqual(2);
    }
    d.disposePrimitives();
  });

  it('keeps the bank portico above walking headroom and places its board on the front fascia', () => {
    const d = townArt();
    const root = model(d, renderCozyBuilding, 'bank', 3, 'canopy');
    const porch = root.getObjectByName('Bank attached leaf portico');
    const corridor = new Box3(new Vector3(-0.4, 0.15, 0.9), new Vector3(0.4, 1.95, 1.9));
    expect(intersectsGeometry(porch, corridor)).toBe(false);
    const authored = root.children[0].userData.authoredSignMount;
    expect(authored.type).toBe('facade');
    const front = firstSurface(porch, [0, authored.y, 3]);
    expect(front.point.z).toBeLessThan(authored.z);
    expect(authored.z - front.point.z).toBeCloseTo(0.051, 3);
    d.disposePrimitives();
  });

  it('distinguishes every reachable cozy modernization tier while retaining mature wings', () => {
    for (const [era, eraIndex] of ERAS.map((era, index) => [era, index])) {
      if (era.evolution.architecture !== 'cozy') continue;
      const kinds = [
        ...new Set(
          BUILDINGS.filter(
            (b) => !b.settlement && ERAS.findIndex((e) => e.id === b.introducedEra) < eraIndex,
          ).map((b) => b.kind),
        ),
      ];
      for (const kind of kinds) {
        const d = townArt();
        const roots = [1, 2, 3].map((level) => model(d, renderCozyBuilding, kind, level, era.id));
        if (!meshes(roots[0]).length || kind === 'square') {
          d.disposePrimitives();
          continue;
        }
        expect(geometrySignature(roots[1]), `${era.id} ${kind} L1→L2`).not.toBe(
          geometrySignature(roots[0]),
        );
        expect(geometrySignature(roots[2]), `${era.id} ${kind} L2→L3`).not.toBe(
          geometrySignature(roots[1]),
        );
        const modules = roots.map((root) => purposeModules(root));
        for (const found of modules)
          expect(found, `${era.id} ${kind} one mature purpose module`).toHaveLength(1);
        const mature = new Box3().setFromObject(modules[2][0]).expandByScalar(0.0001);
        for (const found of modules)
          expect(
            mature.containsBox(new Box3().setFromObject(found[0])),
            `${era.id} ${kind} fixed module envelope`,
          ).toBe(true);
        const secondOperation = moduleParts(modules[1][0], 'operation').reduce(
          (sum, mesh) => sum + boxVolume(mesh),
          0,
        );
        const thirdOperation = moduleParts(modules[2][0], 'operation').reduce(
          (sum, mesh) => sum + boxVolume(mesh),
          0,
        );
        const frontage = moduleParts(modules[1][0], 'frontage').reduce(
          (sum, mesh) => sum + boxVolume(mesh),
          0,
        );
        expect(frontage, `${era.id} ${kind} substantial functional frontage`).toBeGreaterThan(0.02);
        expect(
          thirdOperation - secondOperation,
          `${era.id} ${kind} actual operational capacity`,
        ).toBeGreaterThan(0.025);
        const wingNames = [];
        roots[0].traverse((part) => {
          if (part.name.startsWith('Cozy retained wing')) wingNames.push(part.name);
        });
        for (const name of wingNames)
          for (const root of roots.slice(1))
            expect(root.getObjectByName(name), `${era.id} ${kind}`).toBeTruthy();
        d.disposePrimitives();
      }
    }
  }, 30000);
});

describe('sealed and accessible Moon buildings', () => {
  it('keeps every greenhouse vault visibly sealed with cached arches bearing on its existing growing bed', () => {
    const d = townArt();
    for (const level of [1, 2, 3]) {
      const root = model(d, renderMoonBuilding, 'earthlightGreenhouse', level);
      const frames = [];
      root.traverse((part) => {
        if (part.name === 'Sealed greenhouse vault frame') frames.push(part);
      });
      expect(frames).toHaveLength(level >= 2 ? 2 : 1);
      const beds = meshes(root).filter(
        (mesh) =>
          mesh.geometry === d.geometries.box && mesh.scale.y === 0.3 && mesh.scale.z === 1.8,
      );
      for (const frame of frames) {
        const parts = meshes(frame),
          arches = parts.filter((mesh) => mesh.name === 'Greenhouse bearing arch');
        expect(parts).toHaveLength(3);
        expect(arches).toHaveLength(2);
        expect(arches[0].geometry).toBe(arches[1].geometry);
        expect(
          parts.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0),
        ).toBeLessThanOrEqual(220);
        for (const arch of arches)
          for (const side of [-1, 1]) {
            const foot = arch.localToWorld(new Vector3(0, 0, side));
            expect(foot.y).toBeCloseTo(0.55, 6);
            expect(
              beds.some((bed) =>
                new Box3().setFromObject(bed).expandByScalar(1e-6).containsPoint(foot),
              ),
            ).toBe(true);
          }
      }
    }
    d.disposePrimitives();
  });

  it('shares one sealed glazing material while revealing greenhouse crops and trees', () => {
    const d = townArt();
    const roots = ['willowkinDome', 'earthlightGreenhouse'].map((kind) =>
      model(d, renderMoonBuilding, kind, 3),
    );
    const glass = roots.flatMap(meshes).filter((m) => m.name === 'Sealed lunar habitat glazing');
    const solidGoldFloors = roots
      .flatMap(meshes)
      .filter(
        (m) =>
          m.geometry === d.geometries.cylinder &&
          m.scale.x > 1 &&
          m.scale.y < 0.1 &&
          m.material.color.getHexString() === MOON_PALETTE.light.replace('#', ''),
      );
    expect(solidGoldFloors).toHaveLength(0);
    expect(glass.length).toBeGreaterThanOrEqual(4);
    expect(new Set(glass.map((m) => m.material)).size).toBe(1);
    for (const shell of glass) {
      expect(shell.geometry).toBe(d.geometries['future-dome']);
      expect(shell.material.transparent).toBe(true);
      expect(shell.material.opacity).toBeLessThan(0.5);
      expect(shell.material.depthWrite).toBe(false);
      expect(shell.renderOrder).toBe(10);
    }
    for (const root of roots) {
      d.batch(root);
      const merged = meshes(root).filter((m) => m.material === glass[0].material);
      expect(merged.length).toBeGreaterThan(0);
      for (const shell of merged) expect(shell.renderOrder).toBe(10);
    }
    d.disposePrimitives();
  });

  it.each([
    ['newHollowCommons', [0, 0.75, 10], [0, 0, -1]],
    ['moonstoneWorkshop', [-0.6, 0.75, 10], [0, 0, -1]],
    ['earthlightGreenhouse', [-10, 0.75, -1.4], [1, 0, 0]],
  ])('places the %s hatch on an exposed arrival face', (kind, origin, direction) => {
    const d = townArt();
    const root = model(d, renderMoonBuilding, kind, 1);
    const hit = firstSurface(root, origin, direction);
    expect(hit).toBeTruthy();
    expect(hit.object.material.color.getHexString()).toBe(MOON_PALETTE.deep.replace('#', ''));
    d.disposePrimitives();
  });

  it('connects the lookout deck to the pad without putting a railing across the stair arrival', () => {
    const d = townArt();
    const root = model(d, renderMoonBuilding, 'earthriseLookout', 3);
    const heights = [2.5, 2.2, 1.9, 1.6, 1.3, 1].map(
      (z) => firstSurface(root, [-0.7, 4, z], [0, -1, 0])?.point.y,
    );
    expect(heights.every(Number.isFinite)).toBe(true);
    for (let n = 1; n < heights.length; n++) expect(heights[n]).toBeGreaterThan(heights[n - 1]);
    const arrival = new Box3(new Vector3(-1.1, 1.75, 0.65), new Vector3(-0.3, 2.1, 0.85));
    expect(
      meshes(root).filter((m) => new Box3().setFromObject(m).intersectsBox(arrival)),
    ).toHaveLength(0);
    d.disposePrimitives();
  });

  it('leaves a centered walk-in opening in the completed homestead fence', () => {
    const d = townArt();
    const root = model(d, renderMoonBuilding, 'craterHomesteads', 3);
    const gate = root.getObjectByName('Homestead open frontage gate');
    const route = new Box3(new Vector3(-0.45, 0.35, 2.5), new Vector3(0.45, 1, 2.7));
    expect(
      meshes(gate).filter((m) => new Box3().setFromObject(m).intersectsBox(route)),
    ).toHaveLength(0);
    d.disposePrimitives();
  });

  it('adds useful attached lunar modules while keeping every completed dome', () => {
    const d = townArt();
    for (const [kind, level, feature] of [
      ['willowkinDome', 2, 'garden'],
      ['earthlightGreenhouse', 3, 'greenhouse'],
      ['settlerDomes', 3, 'veranda'],
      ['roverBarn', 2, 'engineBay'],
    ]) {
      const root = model(d, renderMoonBuilding, kind, level);
      expect(root.getObjectByName(`Lunar purpose module ${feature}`), kind).toBeTruthy();
    }
    d.disposePrimitives();
  });
});

it('keeps retained structures, useful finishes and access in the accessible drawings', async () => {
  const cozy = await illustration(TownCozyBuilding, {
    kind: 'orchardCottages',
    era: 'riverlight',
    level: 1,
    serviceLevel: 3,
  });
  expect(cozy).toContain('data-structure-level="3"');
  expect(cozy.match(/a36 9 0 0 1 72 0/g)).toHaveLength(3);
  const future = await illustration(TownFutureBuilding, {
    kind: 'doctor',
    era: 'stargazer',
    level: 2,
    serviceLevel: 3,
  });
  expect(future).toContain('data-purpose-wing="clinic"');
  expect(
    await illustration(TownCozyBuilding, {
      kind: 'school',
      era: 'canopy',
      level: 3,
      serviceLevel: 3,
    }),
  ).toContain('data-roof-equipment="supported"');
  for (const [era, kind] of modernizingFutureKinds.filter(([, kind]) => FUTURE_LANDMARKS[kind])) {
    const second = await illustration(TownFutureBuilding, { kind, era, level: 2, serviceLevel: 3 });
    const third = await illustration(TownFutureBuilding, { kind, era, level: 3, serviceLevel: 3 });
    expect(second, `${era} ${kind}`).toContain(`data-purpose-finish="${heritageUpgrade(kind)}"`);
    expect(third, `${era} ${kind}`).toContain('data-purpose-completion="supported"');
  }
  expect(await illustration(TownMoonBuilding, { kind: 'earthriseLookout', level: 3 })).toContain(
    'data-stair-access="connected"',
  );
  expect(await illustration(TownMoonBuilding, { kind: 'craterHomesteads', level: 3 })).toContain(
    'data-gate-opening="central"',
  );
  expect(
    await illustration(TownMoonBuilding, { kind: 'earthlightGreenhouse', level: 3 }),
  ).toContain('data-visible-crops="sealed-glazing"');
  for (const level of [1, 2, 3]) {
    const greenhouse = await illustration(TownMoonBuilding, {
      kind: 'earthlightGreenhouse',
      level,
    });
    expect(greenhouse.match(/data-vault-frame="sealed"/g)).toHaveLength(level >= 2 ? 2 : 1);
    expect(greenhouse).toContain('data-vault-arches="2"');
  }
});
