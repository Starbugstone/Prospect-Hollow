import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Box3, Group, MeshBasicMaterial } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { ERAS } from '../src/data/eras';
import { CITY_FAMILIES } from '../src/data/city';
import buildingStyles from '../src/data/cityBuildingStyles.json';
import { FUTURE_ARCHITECTURES } from '../src/data/futureArchitecture';
import { renderFutureBuilding } from '../src/game/town/buildings/future';
import { renderCozyBuilding } from '../src/game/town/buildings/cozy';
import { PURPOSE_MASSINGS } from '../src/game/town/buildings/future/purposeMassing';

beforeAll(() => loadFamilies(ALL_MESH_FAMILIES));

// One era per future architecture: its successors draw the same kit.
const ERAS_BY_KIT = FUTURE_ARCHITECTURES.map(
  (architecture) => ERAS.find((era) => era.evolution.architecture === architecture).id,
);
const FAMILIES = ['civic', 'retail', 'depot', 'station', 'culture'];
const kindsOf = (family) =>
  Object.keys(buildingStyles).filter((kind) => CITY_FAMILIES[kind] === family);

function render(era, kind, draw = renderFutureBuilding) {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.sign = vi.fn();
  const root = new Group();
  expect(draw(d, root, kind, kind, 1, era, 1)).toBe(true);
  root.updateMatrixWorld(true);
  let triangles = 0,
    blocks = 0;
  root.traverse((part) => {
    if (['Future building block', 'Future building tower'].includes(part.name)) blocks++;
    if (!part.isMesh) return;
    const geometry = part.geometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
  });
  const size = new Box3().setFromObject(root).getSize(new Box3().min.clone());
  return { blocks, shape: [triangles, ...size.toArray().map((n) => n.toFixed(2))].join(' ') };
}

describe('Working buildings of the eras after Riverlight', () => {
  it.each(ERAS_BY_KIT)('gives every %s hall, shop, workshop and station its own shape', (era) => {
    for (const family of FAMILIES) {
      const kinds = kindsOf(family);
      const shapes = new Map(kinds.map((kind) => [kind, render(era, kind).shape]));
      expect(new Set(shapes.values()).size, `${era} ${family}: ${[...shapes]}`).toBe(kinds.length);
    }
  });

  it('lists exactly the identities it draws, so a new one is a deliberate choice', () => {
    const known = FAMILIES.flatMap(kindsOf).map((kind) => buildingStyles[kind].identity);
    for (const identity of PURPOSE_MASSINGS) expect(known).toContain(identity);
    // The railway station and the museum keep their family's plain form.
    expect(known.filter((identity) => !PURPOSE_MASSINGS.includes(identity)).sort()).toEqual([
      'museum',
      'rail',
    ]);
  });

  it('falls back to the plain family form for an identity it does not know', () => {
    const original = buildingStyles.bank.identity;
    const plain = (() => {
      buildingStyles.bank.identity = 'no-such-identity';
      try {
        return render('moonward', 'bank');
      } finally {
        buildingStyles.bank.identity = original;
      }
    })();
    expect(plain.blocks).toBe(1);
    expect(plain.shape).not.toBe(render('moonward', 'bank').shape);
  });
});

describe('Working buildings of the garden eras', () => {
  // Station and culture houses already differ there; the stables, smithy and warehouse are
  // told apart by their own width and height.
  it.each(['canopy', 'riverlight'])(
    'gives every %s hall, shop and workshop its own shape',
    (era) => {
      for (const family of ['civic', 'retail', 'depot']) {
        const kinds = kindsOf(family);
        const shapes = new Map(
          kinds.map((kind) => [kind, render(era, kind, renderCozyBuilding).shape]),
        );
        expect(new Set(shapes.values()).size, `${era} ${family}: ${[...shapes]}`).toBe(
          kinds.length,
        );
      }
    },
  );
});
