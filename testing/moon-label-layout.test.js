import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { labelsOverlap, townActionAnchors } from '../src/game/town/TownLabels';
import { layoutTownLabels, townLabelWidth } from '../src/game/town/TownLabelLayout';
import {
  MOON_MAP_SCALE,
  layoutMoonLabels,
  moonMapBox,
  moonMapHolds,
  moonMapLabel,
  moonMapPoint,
} from '../src/game/town/moon/MoonLabelLayout';
import { moonLabelAnchors, moonLabelObstacles } from '../src/game/town/moon/MoonMonuments';
import {
  MOON_FLOOR_RADIUS,
  MOON_LOTS,
  moonDistrictsShown,
  moonLotsShown,
} from '../src/data/moonSettlement';
import { createTown } from '../src/data/town';
import { areaUnlocked, areasForSettlement } from '../src/data/townLandmarks';

const label = (id, x, y, visible = true) => ({ id, x, y, visible });

it('keeps the selected name at its building and hides a colliding routine name, as on Earth', () => {
  const input = [
    { ...label('routine', 50, 50), rank: 5 },
    { ...label('selected', 50, 50), rank: 1 },
  ];
  const placed = layoutMoonLabels(input, 1440, 900);
  expect(placed.filter((lot) => lot.visible).map((lot) => lot.id)).toEqual(['selected']);
  expect(placed[1]).toMatchObject({ x: 50, y: 50 });
});

it('separates Moon action targets below the header, through the shared layout', () => {
  const placed = layoutMoonLabels(
    [
      { ...label('workshop', 50, 40), action: true },
      { ...label('garden', 51, 40), action: true },
    ],
    320,
    568,
  );
  const [a, b] = placed.map(({ collection }) => ({
    x: (collection.x * 320) / 100,
    y: (collection.y * 568) / 100,
  }));
  expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThanOrEqual(67.2);
  expect(Math.min(a.y, b.y)).toBeGreaterThanOrEqual(164 + 34);
});

it('keeps a ready action available when its text label cannot fit', () => {
  const placed = layoutMoonLabels(
    [{ ...label('ready', 50, 50), action: true, width: 1000, height: 1000 }],
    375,
    740,
  );
  expect(placed[0].visible).toBe(false);
  expect(townActionAnchors(placed, { ready: 'ready' })).toHaveLength(1);
  expect(placed[0].collection.visible).toBe(true);
  expect(townActionAnchors(placed, {})).toEqual([]);
  expect(townActionAnchors(placed, { ready: 'unsupported' })).toEqual([]);
});

it.each([
  [1440, 900],
  [900, 360],
  [375, 740],
])(
  'uses valley collision decisions and preserves every projected anchor at %sx%s',
  (width, height) => {
    const input = [label('a', 50, 50), label('b', 50, 50), label('c', 30, 60)];
    const moon = layoutMoonLabels(input, width, height);
    const valley = layoutTownLabels(input, width, height);
    expect(moon.map((lot) => lot.visible)).toEqual(valley.map((lot) => lot.visible));
    expect(moon.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
      input.map(({ id, x, y }) => ({ id, x, y })),
    );
    expect(input.every((lot) => lot.visible)).toBe(true);
    const edge = layoutMoonLabels(
      [label('edge', 1, 5), label('hidden', 50, 50, false)],
      width,
      height,
    );
    expect(edge.every((lot) => !lot.visible)).toBe(true);
  },
);

it.each([
  [1440, 900],
  [900, 360],
  [375, 740],
])('keeps a ready hammer below the header and clear of labels at %sx%s', (width, height) => {
  const placed = layoutMoonLabels(
    [{ ...label('ready', 50, 30), action: true }, label('other', 52, 35)],
    width,
    height,
  );
  const top = width < 600 ? 164 : height < 450 ? 110 : 112;
  const icon = {
    x: (placed[0].collection.x * width) / 100,
    y: (placed[0].collection.y * height) / 100,
    width: 68,
    height: 68,
  };
  expect(icon.y - 34).toBeGreaterThanOrEqual(top);
  for (const lot of placed.filter((lot) => lot.visible)) {
    expect(
      labelsOverlap(
        {
          x: (lot.x * width) / 100,
          y: (lot.y * height) / 100 + 42 * 0.2 + lot.offsetY,
          width: lot.width ?? 160,
          height: 42,
        },
        icon,
      ),
    ).toBe(false);
  }
});

it.each([
  [1440, 900],
  [900, 360],
  [375, 740],
])('projects SVG anchors through actual letterboxing at %sx%s', (width, height) => {
  const box = moonMapBox();
  const scale = Math.min(width / box.width, height / box.height);
  const anchor = moonMapLabel({ id: 'site', x: 26, y: 16 }, { width, height });
  expect((anchor.x * width) / 100).toBeCloseTo(width / 2 + (26 - (box.x + box.width / 2)) * scale);
  expect((anchor.y * height) / 100).toBeCloseTo(
    height / 2 + (10 - (box.y + box.height / 2)) * scale,
  );
});

// The SVG map's box holds everything it draws for the town: the crater floor, every lot and
// site shown and each opened district. The old box ended at the first ring's floor and cut
// off the outer ring's lots.
const mapTown = (era, levels = {}) => ({
  ...createTown(),
  era,
  buildings: { ...createTown().buildings, earthlightGreenhouse: 3, ...levels },
});
const mapPlaces = (town) => [
  ...moonLotsShown(town).map((id) => {
    const [x, y] = moonMapPoint(...MOON_LOTS[id]);
    return { id, x, y };
  }),
  ...areasForSettlement('moon')
    .filter((area) => areaUnlocked(town, area))
    .map((area) => {
      const [x, y] = moonMapPoint(...area.positions[0]);
      return { id: area.id, x, y };
    }),
];
describe.each(['twin-hollows', 'hollow-rising', 'quiet-signal'])('the SVG map in %s', (era) => {
  const town = mapTown(era);
  const places = mapPlaces(town);
  const box = moonMapBox(moonDistrictsShown(town), places);

  it('holds every lot and site the town sees, whole', () => {
    expect(places.length).toBeGreaterThan(10);
    for (const place of places) expect(moonMapHolds(box, place), place.id).toBe(true);
    // The crater floor and every road are inside it too.
    const [sx, sy] = MOON_MAP_SCALE;
    expect(box.x).toBeLessThanOrEqual(-MOON_FLOOR_RADIUS * sx);
    expect(box.x + box.width).toBeGreaterThanOrEqual(MOON_FLOOR_RADIUS * sx);
    expect(box.y).toBeLessThanOrEqual(6 - MOON_FLOOR_RADIUS * sy);
    expect(box.y + box.height).toBeGreaterThanOrEqual(6 + MOON_FLOOR_RADIUS * sy);
    for (const district of moonDistrictsShown(town)) {
      const [x, y] = moonMapPoint(...district.centre);
      expect(y - district.stone.size[1]).toBeGreaterThan(box.y);
      expect(x + district.floor * sx).toBeLessThanOrEqual(box.x + box.width);
    }
  });

  it.each([
    [375, 740],
    [900, 360],
    [1440, 900],
  ])('places every name inside the view at %sx%s', (width, height) => {
    for (const place of places) {
      const anchor = moonMapLabel(place, { width, height }, box);
      for (const value of [anchor.x, anchor.y]) {
        expect(value, place.id).toBeGreaterThan(0);
        expect(value, place.id).toBeLessThan(100);
      }
    }
  });
});

it('fails a lot that falls outside the map, as the old box did for the outer ring', () => {
  const old = { x: -60, y: -50, width: 120, height: 100 };
  const town = mapTown('hollow-rising');
  const cut = mapPlaces(town).filter((place) => !moonMapHolds(old, place));
  expect(cut.map(({ id }) => id)).toEqual(
    expect.arrayContaining(['dewfallCistern', 'orchardVaults', 'ringMarket', 'craterSchool']),
  );
  // A future lot beyond everything drawn today is outside a box that was not given it,
  // and inside one that was.
  const far = { id: 'futureLot', x: 0, y: 150 };
  expect(moonMapHolds(moonMapBox([], mapPlaces(town)), far)).toBe(false);
  expect(moonMapHolds(moonMapBox([], [...mapPlaces(town), far]), far)).toBe(true);
});

// No name covers the Quiet Stone. A name that would steps sideways, just clear of it.
describe('names keep clear of the Quiet Stone', () => {
  const stone = { id: 'quietStone', x: 50, y: 40, width: 4, height: 20 };

  it('steps a covering name to the nearer side and leaves others alone', () => {
    const [width, height] = [1440, 900];
    const placed = layoutMoonLabels(
      [
        { ...label('left', 48, 42), width: 150 },
        { ...label('right', 51, 300 / 9), width: 150 },
        { ...label('far', 20, 42), width: 150 },
        { ...label('quietStone', 50, 28), width: 150 },
      ],
      width,
      height,
      { avoid: [stone] },
    );
    const rect = (lot) => ({
      x: (lot.x * width) / 100,
      y: (lot.y * height) / 100 + 42 * 0.2,
      width: 150,
      height: 42,
    });
    const box = {
      x: (stone.x * width) / 100,
      y: (stone.y * height) / 100,
      width: (stone.width * width) / 100,
      height: (stone.height * height) / 100,
    };
    const [left, right, far, own] = placed;
    expect(left.x).toBeLessThan(48);
    expect(right.x).toBeGreaterThan(51);
    for (const lot of [left, right]) {
      expect(lot.visible).toBe(true);
      expect(labelsOverlap(rect(lot), box, 0)).toBe(false);
      // Just clear: no further than its own width from where it was.
      expect(Math.abs(lot.nudge)).toBeLessThan(150);
    }
    expect(far).toMatchObject({ x: 20, y: 42 });
    expect(far.nudge).toBeUndefined();
    // The stone's own name stays over it.
    expect(own).toMatchObject({ x: 50, y: 28, visible: true });
    // Without the stone, nothing moves.
    expect(layoutMoonLabels([label('left', 48, 42)], width, height)[0].x).toBe(48);
  });

  it.each([
    [1440, 900],
    [375, 740],
  ])('at the start of the era, from the first view of the Moon at %sx%s', (width, height) => {
    const town = mapTown('quiet-signal');
    const camera = new PerspectiveCamera(48, 1, 0.1, 600);
    const scene = Object.assign(Object.create(MoonScene.prototype), {
      camera,
      canvas: { clientWidth: width, clientHeight: height },
      controls: { target: new Vector3(0, 0, 4), update() {} },
      renderer: { setSize() {} },
      requestFrame() {},
      lots: moonLabelAnchors(town),
      labelObstacles: moonLabelObstacles(town),
    });
    let projected, avoid;
    scene.onLabels = (labels, _distance, obstacles) => ([projected, avoid] = [labels, obstacles]);
    scene.resize();
    scene.frameTown();
    camera.lookAt(scene.controls.target);
    camera.updateMatrixWorld(true);
    scene.projectLabels();
    expect(avoid).toHaveLength(1);
    expect(avoid[0].id).toBe('quietStone');
    const px = (box) => ({
      x: (box.x * width) / 100,
      y: (box.y * height) / 100,
      width: (box.width * width) / 100,
      height: (box.height * height) / 100,
    });
    // What the era opens with: its three first lots and its monument site ask for
    // attention, so their names show, at the width the map gives them.
    const open = {
      listeningHouse: 'Listening house',
      stillwaterBasin: 'Stillwater',
      tonewoodConservatory: 'Conservatory',
      'voyagers-court': 'Voyagers’ Court',
    };
    const names = projected
      .filter(({ id }) => open[id])
      .map((lot) => ({ ...lot, width: townLabelWidth(open[lot.id], '+'), rank: 3 }));
    expect(names).toHaveLength(4);
    const rect = (lot) => ({
      x: (lot.x * width) / 100,
      y: (lot.y * height) / 100 + 42 * 0.2 + (lot.offsetY ?? 0),
      width: lot.width,
      height: 42,
    });
    // Today's layout, without the stone, lets a name cover it on the desktop view.
    const covering = (placed) =>
      placed.filter((lot) => lot.visible && labelsOverlap(rect(lot), px(avoid[0]), 0));
    if (width > height)
      expect(covering(layoutMoonLabels(names, width, height)).length).toBeGreaterThan(0);
    expect(covering(layoutMoonLabels(names, width, height, { avoid }))).toEqual([]);
  });
});

it('fits the portrait overview while preserving orbit angle and relative zoom across resize', () => {
  const camera = new PerspectiveCamera(48, 1.6, 0.1, 600);
  camera.position.set(12, 30, 66);
  const target = new Vector3(0, 0, 4);
  const before = camera.position.clone().sub(target);
  const scene = Object.assign(Object.create(MoonScene.prototype), {
    camera,
    canvas: { clientWidth: 375, clientHeight: 740 },
    controls: { target, update() {} },
    renderer: { setSize() {} },
    requestFrame() {},
  });
  scene.resize();
  expect(camera.position.clone().sub(target).length()).toBeGreaterThan(before.length());
  expect(
    camera.position.clone().sub(target).normalize().distanceTo(before.clone().normalize()),
  ).toBeLessThan(1e-8);
  scene.canvas.clientWidth = 1440;
  scene.canvas.clientHeight = 900;
  scene.resize();
  expect(camera.position.distanceTo(before.add(target))).toBeLessThan(1e-8);
});

it('publishes relative zoom even when projected anchors do not move', () => {
  const updates = [];
  const camera = new PerspectiveCamera(48, 1.6, 0.1, 600);
  const scene = Object.assign(Object.create(MoonScene.prototype), {
    camera,
    canvas: { clientWidth: 375, clientHeight: 740 },
    controls: { target: new Vector3() },
    overviewScale: 2,
    lots: [{ id: 'lot', position: new Vector3(0, 0, -20) }],
    onLabels: (labels, distance) => updates.push({ labels, distance }),
  });
  scene.projectLabels();
  camera.position.z = 10;
  camera.updateMatrixWorld();
  scene.projectLabels();
  expect(updates).toHaveLength(2);
  expect(updates[1].distance).toBe(5);
  expect(updates[0].labels[0].x).toBe(updates[1].labels[0].x);
  expect(updates[0].labels[0].y).toBe(updates[1].labels[0].y);
});
