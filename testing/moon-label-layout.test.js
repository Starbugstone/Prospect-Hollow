import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { labelsOverlap, townActionAnchors } from '../src/game/town/TownLabels';
import {
  layoutMoonLabels,
  moonMapLabel,
  MOON_ACTION_OFFSET,
} from '../src/game/town/moon/MoonLabelLayout';

const label = (id, x, y, visible = true) => ({ id, x, y, visible });

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

describe('Moon labels stay attached to their own projected building', () => {
  it('leaves noncolliding labels exactly at their anchors instead of snapping to a grid', () => {
    const input = [label('a', 31.2, 45.7), label('b', 73.4, 60.3)];
    const placed = layoutMoonLabels(input, 1440, 900);
    placed.forEach((p, i) => {
      expect(p.x).toBeCloseTo(input[i].x);
      expect(p.y).toBeCloseTo(input[i].y);
      expect(p.leader).toBeNull();
    });
    expect(input[0]).toEqual(label('a', 31.2, 45.7));
  });

  it('moves a collision the shortest available distance and joins its nearest edge to its own anchor', () => {
    const [first, second] = layoutMoonLabels([label('a', 50, 50), label('b', 50, 50)], 1440, 900);
    expect(first.leader).toBeNull();
    expect(second.x).toBe(50);
    expect(Math.abs(second.y - 50) * 9).toBeCloseTo(58);
    expect(second.anchor).toEqual({ x: 50, y: 50 });
    expect(second.leader.x2).toBe(720);
    expect(second.leader.y2).toBe(450);
    expect(second.leader.y1).toBeCloseTo(456);
  });

  it.each([
    [1440, 900],
    [900, 360],
    [375, 740],
  ])(
    'keeps labels inside the controls at %sx%s and links every external displacement',
    (width, height) => {
      const labels = layoutMoonLabels(
        [label('edge', 1, 5), label('far', 99, 95), label('hidden', 50, 50, false)],
        width,
        height,
      );
      for (const p of labels.filter((p) => p.visible)) {
        expect((p.x * width) / 100 - p.width / 2).toBeGreaterThanOrEqual(6);
        expect((p.x * width) / 100 + p.width / 2).toBeLessThanOrEqual(width - 6);
        expect((p.y * height) / 100 - p.height).toBeGreaterThanOrEqual(
          width < 600 ? 164 : height < 450 ? 110 : 112,
        );
        expect(p.leader).not.toBeNull();
        expect(p.leader.x2).toBeCloseTo((p.anchor.x * width) / 100);
        expect(p.leader.y2).toBeCloseTo((p.anchor.y * height) / 100);
      }
      expect(labels[2]).toEqual(label('hidden', 50, 50, false));
    },
  );
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

it('places appended sites by their anchor order, retaining the caller order in its result', () => {
  const front = label('front', 50, 60),
    back = label('back', 50, 58);
  const later = layoutMoonLabels([front, back], 375, 740);
  const earlier = layoutMoonLabels([back, front], 375, 740);
  expect(later.map((l) => l.id)).toEqual(['front', 'back']);
  expect(later[0]).toEqual(earlier[1]);
  expect(later[1]).toEqual(earlier[0]);
});

it('clears neighbouring finish targets while retaining the icon at its own building', () => {
  const placed = layoutMoonLabels(
    [{ ...label('ready', 50, 60), action: true }, label('neighbour', 50, 50)],
    375,
    740,
  );
  const neighbour = placed[1];
  const icon = { x: 375 / 2, y: 740 * 0.6 - MOON_ACTION_OFFSET, width: 68, height: 68 };
  expect(
    labelsOverlap(
      {
        x: (neighbour.x * 375) / 100,
        y: (neighbour.y * 740) / 100 - neighbour.height / 2,
        width: neighbour.width,
        height: neighbour.height,
      },
      icon,
    ),
  ).toBe(false);
  expect(placed[0].anchor).toEqual({ x: 50, y: 60 });
});

it('does not leave a late label farther away when exchanging two clear slots would reduce displacement', () => {
  const labels = layoutMoonLabels(
    [label('a', 50, 50), label('b', 50, 51), label('c', 50, 52)],
    375,
    740,
  );
  const distance = (a, b) => ((b.x - a.anchor.x) * 3.75) ** 2 + ((b.y - a.anchor.y) * 7.4) ** 2;
  for (const [i, a] of labels.entries())
    for (const b of labels.slice(i + 1))
      expect(distance(a, a) + distance(b, b)).toBeLessThanOrEqual(
        distance(a, b) + distance(b, a) + 0.01,
      );
});

it.each([
  [1440, 900],
  [900, 360],
  [375, 740],
])('keeps a ready hammer below the header and clear of labels at %sx%s', (width, height) => {
  const [ready, other] = layoutMoonLabels(
    [{ ...label('ready', 50, 30), action: true }, label('other', 52, 35)],
    width,
    height,
  );
  const top = width < 600 ? 164 : height < 450 ? 110 : 112;
  const icon = {
    x: (ready.collection.x * width) / 100,
    y: (ready.collection.y * height) / 100,
    width: 68,
    height: 68,
  };
  expect(icon.y - 34).toBeGreaterThanOrEqual(top);
  for (const l of [ready, other])
    expect(
      labelsOverlap(
        {
          x: (l.x * width) / 100,
          y: (l.y * height) / 100 - l.height / 2,
          width: l.width,
          height: l.height,
        },
        icon,
      ),
    ).toBe(false);
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
