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
