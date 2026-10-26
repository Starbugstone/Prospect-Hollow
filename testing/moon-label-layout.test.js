import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { labelsOverlap, townActionAnchors } from '../src/game/town/TownLabels';
import { layoutTownLabels } from '../src/game/town/TownLabelLayout';
import { layoutMoonLabels, moonMapLabel } from '../src/game/town/moon/MoonLabelLayout';

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
  const scale = Math.min(width / 120, height / 100);
  const anchor = moonMapLabel({ id: 'site', x: 26, y: 16 }, { width, height });
  expect((anchor.x * width) / 100).toBeCloseTo(width / 2 + 26 * scale);
  expect((anchor.y * height) / 100).toBeCloseTo(height / 2 + 10 * scale);
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
