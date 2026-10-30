import { expect, it } from 'vitest';
import { layoutTownLabels } from '../src/game/town/TownLabelLayout';
import {
  townLabelDetail,
  townLabelRank,
  townActionAnchors,
  updateLabels,
  labelLayout,
} from '../src/game/town/TownLabels';

it('keeps selection and work ahead of routine names as a settlement grows', () => {
  const input = Array.from({ length: 40 }, (_, n) => ({
    id: `future-place-${n}`,
    x: 50,
    y: 50,
    visible: true,
    rank: townLabelRank({ selected: n === 39, ready: n === 38 }),
  }));
  const selected = layoutTownLabels(input, 375, 740);
  expect(selected.filter((lot) => lot.visible).map((lot) => lot.id)).toEqual(['future-place-39']);
  const work = layoutTownLabels(input.slice(0, -1), 375, 740);
  expect(work.filter((lot) => lot.visible).map((lot) => lot.id)).toEqual(['future-place-38']);
  expect(selected.every((lot) => lot.x === 50 && lot.y === 50)).toBe(true);
});

it('lets an unfamiliar place use the same default clearance and stable tie breaking', () => {
  const a = { id: 'a', x: 50, y: 50, visible: true };
  const b = { ...a, id: 'b' };
  expect(
    layoutTownLabels([b, a], 375, 740)
      .filter((lot) => lot.visible)
      .map((lot) => lot.id),
  ).toEqual(['a']);
  expect(
    layoutTownLabels([a, b], 375, 740)
      .filter((lot) => lot.visible)
      .map((lot) => lot.id),
  ).toEqual(['a']);
  expect(layoutTownLabels([a], 0, 0)[0].visible).toBe(false);
});

it('reserves action targets even when their name is hidden by distance or a collision', () => {
  const input = [
    {
      id: 'ready',
      x: 40,
      y: 30,
      visible: false,
      action: true,
      collection: { x: 50, y: 50, visible: true },
    },
    { id: 'other', x: 50, y: 50, visible: true },
  ];
  const placed = layoutTownLabels(input, 375, 740);
  expect(placed.every((lot) => !lot.visible)).toBe(true);
  expect(townActionAnchors(placed, { ready: 'ready' }).map((lot) => lot.id)).toEqual(['ready']);
});

const actionAt = (id, x, y) => ({
  id,
  x,
  y,
  visible: false,
  action: true,
  collection: { x, y, visible: true },
});
const targetCentres = (placed, width, height) =>
  placed.map(({ collection }) => ({
    x: (collection.x * width) / 100,
    y: (collection.y * height) / 100,
  }));

it('separates overlapping action targets so each one activates its own place', () => {
  // The saloon coins and forge TNT measured on a 320×568 phone.
  const input = [actionAt('saloon', 36, 48), actionAt('blacksmith', 31, 49)];
  const placed = layoutTownLabels(input, 320, 568);
  const [saloon, blacksmith] = targetCentres(placed, 320, 568);
  // Enlarged icons are 61.6 pixels wide, ready icons 67.2.
  expect(Math.hypot(saloon.x - blacksmith.x, saloon.y - blacksmith.y)).toBeGreaterThanOrEqual(67.2);
  expect(saloon.x).toBeGreaterThan(blacksmith.x);
  // The renderer's input keeps its projected points.
  expect(input[0].collection.x).toBe(36);
});

it.each([
  [320, 568],
  [390, 844],
  [844, 390],
])('keeps a crowd of action targets apart and on a %ix%i map', (width, height) => {
  const crowd = Array.from({ length: 8 }, (_, n) => actionAt(`future-${n}`, 8, 50));
  const centres = targetCentres(layoutTownLabels(crowd, width, height), width, height);
  for (const [n, a] of centres.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(33.99);
    expect(a.x).toBeLessThanOrEqual(width - 33.99);
    for (const b of centres.slice(n + 1))
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(61.6);
  }
});

it('leaves action targets that touch nothing at their projected places', () => {
  const placed = layoutTownLabels([actionAt('a', 20, 20), actionAt('b', 80, 80)], 375, 740);
  expect(placed.map(({ collection }) => [collection.x, collection.y])).toEqual([
    [20, 20],
    [80, 80],
  ]);
});

it('settles coincident action targets the same way whatever their order', () => {
  const a = actionAt('a', 50, 50);
  const b = actionAt('b', 50, 50);
  const byId = (placed) => Object.fromEntries(placed.map((lot) => [lot.id, lot.collection.x]));
  expect(byId(layoutTownLabels([a, b], 375, 740))).toEqual(
    byId(layoutTownLabels([b, a], 375, 740)),
  );
  expect(byId(layoutTownLabels([a, b], 375, 740)).a).toBeLessThan(50);
});

it('ignores action targets that are off screen when separating the rest', () => {
  const hidden = { ...actionAt('hidden', 50, 50) };
  hidden.collection.visible = false;
  const placed = layoutTownLabels([hidden, actionAt('shown', 50, 50)], 375, 740);
  expect(placed.map(({ collection }) => collection.x)).toEqual([50, 50]);
});

it('uses the same distant-detail exceptions on every viewport', () => {
  expect(townLabelDetail({ distant: true })).toBeFalsy();
  for (const state of ['essential', 'selected', 'attention'])
    expect(townLabelDetail({ distant: true, [state]: true })).toBeTruthy();
  expect(townLabelDetail({ distant: false })).toBeTruthy();
});

it.each([24, -56])('keeps a name clear of its own action with an offset of %s', (offsetY) => {
  const [label] = layoutTownLabels(
    [
      {
        id: 'ready',
        x: 50,
        y: 50,
        visible: true,
        action: true,
        offsetY,
        collection: { x: 50, y: 50, visible: true },
      },
    ],
    375,
    740,
  );
  expect(label.visible).toBe(true);
  expect(Math.abs(label.offsetY + 42 * 0.2)).toBeGreaterThanOrEqual((42 + 68) / 2 + 4);
  expect(Math.sign(label.offsetY)).toBe(Math.sign(offsetY));
});

it('updates the DOM dimensions when translated text changes the clearance', () => {
  const current = [{ id: 'home', x: 50, y: 50, width: 100, visible: true }];
  const next = [{ ...current[0], width: 180 }];
  expect(updateLabels(current, next, labelLayout(current))).toBe(labelLayout(next));
});
