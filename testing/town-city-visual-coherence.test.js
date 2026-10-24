import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { Box3, Group, Raycaster, Triangle, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { addCityModernization, renderCityBuilding } from '../src/game/town/buildings/city';
import { addCityFinish } from '../src/game/town/buildings/CityBuildingDetails';
import TownCityBuilding from '../src/components/town/TownCityBuilding.vue';
import TownRoundedBuilding from '../src/components/town/TownRoundedBuilding.vue';
import { BUILDINGS } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { CITY_FAMILIES } from '../src/data/city';
import { buildingStages } from '../src/data/buildingStages';

const primitives = [];
beforeAll(() => loadFamilies(['post-war', 'aviation', 'broadcast', 'contemporary', 'future']));
afterEach(() => primitives.splice(0).forEach((d) => d.disposePrimitives()));
function draw(kind, era, level, serviceLevel = 3) {
  const d = new TownPrimitives(),
    root = new Group();
  d.sign = () => {};
  primitives.push(d);
  expect(renderCityBuilding(d, root, kind, kind, level, era, serviceLevel)).toBe(true);
  return { d, root };
}
const bounds = (object) => new Box3().setFromObject(object);
// Material batching can join two side columns and a high canopy in one mesh.
// Their enclosing box includes the empty doorway, so test the actual triangles.
function intersectsGeometry(object, box) {
  if (!bounds(object).intersectsBox(box)) return false;
  const positions = object.geometry.attributes.position;
  const indices = object.geometry.index;
  const triangle = new Triangle();
  for (let n = 0; n < (indices?.count ?? positions.count); n += 3) {
    for (const [offset, point] of [triangle.a, triangle.b, triangle.c].entries())
      point
        .fromBufferAttribute(positions, indices ? indices.getX(n + offset) : n + offset)
        .applyMatrix4(object.matrixWorld);
    if (box.intersectsTriangle(triangle)) return true;
  }
  return false;
}
function named(root, prefix) {
  const result = [];
  root.traverse((object) => {
    if (object.name.startsWith(prefix)) result.push(object);
  });
  return result;
}

it.each(['broadcast', 'contemporary'])(
  'seats %s roof billboards on a continuous roof-mounted assembly',
  (era) => {
    const { root } = draw('shop', era, 1);
    const board = bounds(named(root, 'Retail roof billboard')[0]);
    const curb = bounds(named(root, 'Roof billboard curb')[0]);
    root.updateMatrixWorld(true);
    const roof = new Raycaster(new Vector3(0, board.min.y - 0.01, -0.5), new Vector3(0, -1, 0))
      .intersectObject(root, true)
      .find(({ object }) => !/^(Roof billboard|Retail sign)/.test(object.name));
    expect(roof).toBeDefined();
    expect(curb.min.y).toBeLessThanOrEqual(roof.point.y + 0.001);
    expect(curb.min.y).toBeGreaterThanOrEqual(roof.point.y - 0.001);
    const legs = named(root, 'Roof billboard stanchion');
    expect(legs).toHaveLength(2);
    for (const leg of legs) {
      const box = bounds(leg);
      expect(box.min.y).toBeLessThanOrEqual(curb.max.y + 0.001);
      expect(box.max.y).toBeGreaterThanOrEqual(board.min.y);
    }
    expect(named(root, 'Retail sign graphic')).toHaveLength(3);
  },
);

it('connects every acoustic roof fin to the auditorium with a continuous clerestory', () => {
  const { root } = draw('concertHall', 'broadcast', 1);
  const supports = named(root, 'Acoustic roof clerestory');
  expect(supports).toHaveLength(5);
  root.updateMatrixWorld(true);
  for (const support of supports) {
    const box = bounds(support),
      center = box.getCenter(new Vector3());
    const roof = new Raycaster(
      new Vector3(center.x, 10, -0.4),
      new Vector3(0, -1, 0),
    ).intersectObject(root, true)[0];
    const surface = new Raycaster(new Vector3(center.x, 3.05, -0.4), new Vector3(0, -1, 0))
      .intersectObject(root, true)
      .find(({ object }) => object !== support);
    expect(box.min.y).toBeLessThanOrEqual(surface.point.y);
    const positions = support.geometry.attributes.position;
    const contact = (positions.getY(4) + positions.getY(5)) / 2;
    expect(roof.point.y - contact).toBeGreaterThan(0.17);
    expect(roof.point.y - contact).toBeLessThan(0.21);
  }
});

it.each(['broadcast', 'contemporary'])(
  '%s acoustic clerestories survive town material batching',
  (era) => {
    const { d, root } = draw('concertHall', era, 3);
    const trianglesByMaterial = () => {
      const counts = new Map();
      root.traverse((object) => {
        if (!object.isMesh) return;
        const key = object.material.uuid;
        counts.set(
          key,
          (counts.get(key) ?? 0) +
            (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3,
        );
      });
      return counts;
    };
    const before = trianglesByMaterial();
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    try {
      d.batch(root);
      expect(trianglesByMaterial()).toEqual(before);
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  },
);

it('puts connected-landmark solar strips above their wing roof', () => {
  const { root } = draw('concertHall', 'contemporary', 2);
  const roof = bounds(named(root, 'Purpose equipment cowl')[0]);
  const panels = named(root, 'Landmark wing roof solar strip');
  expect(panels).toHaveLength(3);
  for (const panel of panels) {
    expect(bounds(panel).min.y).toBeGreaterThanOrEqual(roof.max.y - 0.00001);
    expect(bounds(panel).min.y - roof.max.y).toBeLessThan(0.02);
  }
});

it('keeps every modernizing enclosed city kind visually distinct at all three paid finish tiers', () => {
  for (const era of ['aviation', 'broadcast', 'contemporary', 'tomorrow']) {
    const eraIndex = ERAS.findIndex((entry) => entry.id === era);
    const kinds = new Set(
      BUILDINGS.filter(
        (building) => ERAS.findIndex((entry) => entry.id === building.introducedEra) < eraIndex,
      ).map((building) => building.kind),
    );
    for (const kind of kinds) {
      const family = CITY_FAMILIES[kind];
      // Open-site landscaping and the retained bridge are reported separately.
      if (!family || ['park', 'field', 'square', 'leisure'].includes(family) || kind === 'bridge')
        continue;
      expect(buildingStages(kind, era, 1).modernizing).toBe(true);
      const signatures = [1, 2, 3].map((level) => {
        const { root } = draw(kind, era, level);
        root.updateMatrixWorld(true);
        const geometry = [];
        root.traverse((part) => {
          if (part.isMesh)
            geometry.push([
              Array.from(part.geometry.attributes.position.array),
              part.matrixWorld.elements,
            ]);
        });
        const modules = [];
        root.traverse((part) => {
          if (part.userData.purposeModule) modules.push(part);
        });
        expect(modules, `${era} ${kind} one module`).toHaveLength(1);
        const volume = (semantic) => {
          let value = 0;
          modules[0].traverse((part) => {
            if (!part.isMesh) return;
            for (let node = part; node && node !== modules[0]; node = node.parent) {
              if (!node.userData.modulePart) continue;
              if (node.userData.modulePart === semantic) {
                const size = bounds(part).getSize(new Vector3());
                value += size.x * size.y * size.z;
              }
              break;
            }
          });
          return value;
        };
        expect(
          volume('frontage'),
          `${era} ${kind} substantial functional frontage`,
        ).toBeGreaterThan(0.02);
        expect(volume('operation'), `${era} ${kind} actual operating machinery`).toBeGreaterThan(
          0.02,
        );
        return {
          signature: JSON.stringify(geometry),
          frontage: volume('frontage'),
          operation: volume('operation'),
        };
      });
      expect(signatures[1].signature, `${era} ${kind} L1→L2`).not.toBe(signatures[0].signature);
      expect(
        signatures[1].frontage - signatures[0].frontage,
        `${era} ${kind} real added usable frontage`,
      ).toBeGreaterThan(0.02);
      expect(signatures[2].signature, `${era} ${kind} L2→L3`).not.toBe(signatures[1].signature);
      expect(
        signatures[2].operation - signatures[1].operation,
        `${era} ${kind} visible working completion`,
      ).toBeGreaterThan(0.025);
    }
  }
});

it('makes occupied balcony and service clock completions visible outside the roof cowl', () => {
  const home = draw('home', 'aviation', 3).root;
  const deck = bounds(home.getObjectByName('Occupied balcony deck'));
  const bench = bounds(home.getObjectByName('Terrace bench'));
  expect(bench.min.y).toBeCloseTo(deck.max.y);
  expect(home.getObjectByName('Terrace bench back')).toBeDefined();
  expect(home.getObjectByName('Terrace working table')).toBeDefined();
  expect(bounds(home.getObjectByName('Balcony parapet')).max.z).toBeGreaterThan(bench.max.z);
  const garage = draw('garage', 'aviation', 3).root;
  const roof = bounds(garage.getObjectByName('Purpose equipment cowl'));
  const clock = bounds(garage.getObjectByName('Working service clock'));
  expect(clock.min.y).toBeCloseTo(roof.max.y);
  expect(clock.max.y - roof.max.y).toBeGreaterThan(0.9);
  expect(garage.getObjectByName('Flush control room glazing')).toBeDefined();
  expect(named(garage, 'Control room mullion')).toHaveLength(2);
});

it('seats retained landmark rooms on the wing while native second tiers keep the original wing', () => {
  const native = draw('concertHall', 'broadcast', 2).root;
  expect(native.getObjectByName('Landmark wing roof')).toBeDefined();
  const first = draw('concertHall', 'broadcast', 1).root;
  expect(first.getObjectByName('Landmark wing roof')).toBeUndefined();
  const retained = draw('concertHall', 'contemporary', 2).root;
  const room = bounds(named(retained, 'Attached upper service room')[0]);
  const roof = bounds(named(retained, 'Landmark wing roof')[0]);
  const footing = bounds(named(retained, 'Service room footing')[0]);
  expect(footing.min.y).toBeLessThanOrEqual(roof.max.y);
  expect(room.min.y).toBeCloseTo(footing.max.y);
  expect(room.min.x).toBeGreaterThan(roof.min.x);
  expect(room.max.x).toBeLessThan(roof.max.x);
});

it.each(['home', 'well', 'farm', 'school'])(
  'refits the retained %s solar strips onto its upper service roof',
  (kind) => {
    const native = draw(kind, 'contemporary', 1).root;
    const original = named(native, 'Retained service roof solar strips');
    for (const level of [2, 3]) {
      const root = draw(kind, 'contemporary', level).root;
      const strips = named(root, 'Retained service roof solar strips');
      const roof = bounds(named(root, 'Purpose equipment cowl')[0]);
      expect(strips).toHaveLength(original.length);
      expect(strips.length).toBeGreaterThan(0);
      for (const panel of strips) {
        const box = bounds(panel);
        expect(box.min.y).toBeGreaterThan(roof.max.y);
        expect(box.min.y - roof.max.y).toBeLessThan(0.02);
        expect(box.min.x).toBeGreaterThanOrEqual(roof.min.x - 0.00001);
        expect(box.max.x).toBeLessThanOrEqual(roof.max.x + 0.00001);
        const center = box.getCenter(new Vector3());
        const exposed = new Raycaster(
          new Vector3(center.x, box.max.y + 5, center.z),
          new Vector3(0, -1, 0),
        ).intersectObject(root, true)[0];
        expect(exposed.object, `${kind} roof fittings must not bury working solar strips`).toBe(
          panel,
        );
      }
    }
  },
);

it('grounds the bridge directory on the reserved verge without orphan facade parts', () => {
  const d = new TownPrimitives(),
    root = new Group();
  primitives.push(d);
  addCityModernization(d, root, 'bridge', 'contemporary', 1);
  expect(named(root, 'Blender digital-detail')).toHaveLength(0);
  const kiosk = root.getObjectByName('Bridge information kiosk');
  const box = bounds(kiosk),
    footing = bounds(kiosk.getObjectByName('Bridge kiosk footing'));
  const post = bounds(kiosk.getObjectByName('Bridge kiosk support'));
  expect(footing.min.y).toBeCloseTo(0);
  expect(post.min.y).toBeLessThan(footing.max.y);
  expect(box.max.z).toBeLessThan(-1.9);
  expect(box.min.x).toBeGreaterThan(-7.6);
  expect(box.max.x).toBeLessThan(-5.5);
});

it('retains established city wings while native construction starts at its own first tier', () => {
  const established = draw('school', 'aviation', 1).root;
  expect(established.getObjectByName('Blender aviation-wing')).toBeDefined();
  const native = draw('library', 'contemporary', 1).root;
  expect(native.getObjectByName('Blender contemporary-wing')).toBeUndefined();
  const second = draw('school', 'aviation', 2).root;
  const third = draw('school', 'aviation', 3).root;
  expect(bounds(named(third, 'Attached upper service room')[0])).toEqual(
    bounds(named(second, 'Attached upper service room')[0]),
  );
});

it.each(['aviation', 'broadcast', 'contemporary', 'tomorrow'])(
  '%s airport has distinct paid finishes on supported existing terminal surfaces',
  (era) => {
    const signatures = new Set();
    for (const level of [1, 2, 3]) {
      const { root } = draw('airport', era, level);
      root.updateMatrixWorld(true);
      const geometry = [];
      root.traverse((object) => {
        if (object.isMesh)
          geometry.push([
            Array.from(object.geometry.attributes.position.array),
            object.matrixWorld.elements,
          ]);
      });
      signatures.add(JSON.stringify(geometry));
      const supports = named(root, 'Observation crown support');
      if (era === 'aviation' && level === 1) {
        expect(supports).toHaveLength(0);
        continue;
      }
      expect(supports).toHaveLength(2);
      const roof = bounds(root.getObjectByName('Observation completion roof'));
      for (const support of supports) {
        const box = bounds(support),
          center = box.getCenter(new Vector3());
        const host = new Raycaster(
          new Vector3(center.x, box.min.y + 0.08, center.z),
          new Vector3(0, -1, 0),
        )
          .intersectObject(root, true)
          .find(({ object }) => object !== support);
        expect(host).toBeDefined();
        expect(box.min.y).toBeLessThanOrEqual(host.point.y + 0.001);
        expect(box.max.y).toBeGreaterThanOrEqual(roof.min.y - 0.001);
        expect(box.min.x).toBeGreaterThanOrEqual(2.4);
        expect(box.max.x).toBeLessThanOrEqual(6.6);
        expect(box.max.z).toBeLessThan(0);
      }
    }
    expect(signatures.size).toBe(3);
  },
);

it.each(['school', 'bank', 'shop', 'armory', 'library', 'crystalLab'])(
  '%s completion keeps the straight central approach clear',
  (kind) => {
    const { root } = draw(kind, 'contemporary', 3);
    const approach = new Box3(new Vector3(-0.39, 0.05, 1.5), new Vector3(0.39, 1.7, 3.2));
    const additions = [];
    root.traverse((object) => {
      if (
        object.name.startsWith('City ') ||
        ['Public computer lounge', 'Technology control frontage'].includes(object.name)
      )
        additions.push(object);
    });
    for (const addition of additions)
      addition.traverse((object) => {
        if (object.isMesh)
          expect(intersectsGeometry(object, approach), `${kind}: ${object.name}`).toBe(false);
      });
  },
);

it.each(
  ['well', 'shop', 'school', 'library', 'skyline', 'skyPods'].flatMap((kind) =>
    [2, 3].map((level) => ({ kind, level })),
  ),
)(
  '$kind L$level rounded completion clears the approach and seats canopy posts inside the roof',
  ({ kind, level }) => {
    const { root } = draw(kind, 'tomorrow', level);
    const approach = new Box3(new Vector3(-0.39, 0.05, 1.5), new Vector3(0.39, 1.7, 3.2));
    const completion = named(root, 'Rounded ')[0];
    expect(completion).toBeDefined();
    const parts = [];
    completion.traverse((object) => {
      if (object.isMesh) {
        const box = bounds(object);
        expect(box.intersectsBox(approach), kind).toBe(false);
        parts.push({ object, box });
      }
    });
    const canopy = parts.find(
      ({ box }) => box.max.y - box.min.y < 0.4 && box.max.x - box.min.x > 1,
    );
    if (!canopy) return;
    expect(canopy.box.min.y).toBeGreaterThan(1.8);
    root.updateMatrixWorld(true);
    for (const post of parts.filter(
      ({ box }) => box.max.y - box.min.y > 1.8 && box.max.x - box.min.x < 0.2,
    )) {
      const center = post.box.getCenter(new Vector3());
      const hit = new Raycaster(
        new Vector3(center.x, 5, center.z),
        new Vector3(0, -1, 0),
      ).intersectObject(canopy.object)[0];
      expect(hit, kind).toBeDefined();
      expect(post.box.min.y).toBeCloseTo(0);
      expect(post.box.max.y).toBeGreaterThan(hit.point.y - 0.36);
    }
  },
);

it('has finite attached fallback completion geometry for an unsupported kind', () => {
  const d = new TownPrimitives(),
    root = new Group();
  primitives.push(d);
  addCityFinish(d, root, 'unsupported', 'contemporary');
  expect(bounds(root).min.toArray().every(Number.isFinite)).toBe(true);
  expect(root.children[0].userData.upgradeFeature).toBe('service');
});

it('draws purpose completions and retained wings in both SVG architecture families', async () => {
  const city = await renderToString(
    createSSRApp({
      render: () =>
        h(TownCityBuilding, { kind: 'school', era: 'aviation', level: 3, serviceLevel: 3 }),
    }),
  );
  expect(city).toContain('data-upgrade-feature="classroom"');
  const rounded = await renderToString(
    createSSRApp({
      render: () =>
        h(TownRoundedBuilding, { kind: 'skyPods', era: 'tomorrow', level: 3, serviceLevel: 3 }),
    }),
  );
  expect(rounded).toContain('data-upgrade-feature="terrace"');
  const airport = await renderToString(
    createSSRApp({
      render: () =>
        h(TownCityBuilding, { kind: 'airport', era: 'contemporary', level: 2, serviceLevel: 3 }),
    }),
  );
  expect(airport).toContain('data-airport-observation-finish="true"');
});
