import { describe, expect, it } from 'vitest';
import {
  moonLabelDensity,
  moonLabelNeedsAttention,
  MOON_LABEL_COVERAGE,
  MOON_PIN_SIZE,
} from '../src/game/town/moon/MoonLabelDensity';
import { layoutMoonLabels } from '../src/game/town/moon/MoonLabelLayout';
import { labelsOverlap, townLabelDetail, townLabelRank } from '../src/game/town/TownLabels';
const lots = Array.from({ length: 13 }, (_, i) => ({ id: `lot${i}`, x: 50, y: 50, visible: true }));
const area = (labels) =>
  labels.reduce((sum, lot) => sum + (lot.visible ? lot.width * lot.height : 0), 0);

describe.each([
  [375, 740],
  [900, 360],
])('compact Moon at %sx%s', (width, height) => {
  it('collapses routine lots to pins while preserving every lot and its anchor', () => {
    const density = moonLabelDensity(lots, width, height);
    expect(density.every((lot) => lot.collapsed && lot.width === MOON_PIN_SIZE)).toBe(true);
    const placed = layoutMoonLabels(density, width, height);
    expect(placed.every((lot) => lot.visible && lot.anchor)).toBe(true);
    expect(placed.map((lot) => lot.id)).toEqual(lots.map((lot) => lot.id));
    expect(area(placed)).toBeLessThanOrEqual(width * height * MOON_LABEL_COVERAGE);
  });
  it('keeps every attention lot labelled, including the worst case of all 13 lots', () => {
    const density = moonLabelDensity(
      lots.map((lot) => ({ ...lot, attention: true, action: true })),
      width,
      height,
    );
    const placed = layoutMoonLabels(density, width, height);
    expect(placed.every((lot) => lot.visible && !lot.collapsed)).toBe(true);
    expect(area(placed)).toBeLessThanOrEqual(width * height * MOON_LABEL_COVERAGE);
  });
  it('keeps the finish icon of a ready lot apart from every label, as on the valley', () => {
    const placed = layoutMoonLabels(
      moonLabelDensity(
        lots.map((lot, i) => ({ ...lot, x: 20 + i * 5, attention: i < 4, action: i === 0 })),
        width,
        height,
      ),
      width,
      height,
    );
    const { collection } = placed[0];
    expect(collection).toBeTruthy();
    const icon = {
      x: (collection.x * width) / 100,
      y: (collection.y * height) / 100,
      width: 68,
      height: 68,
    };
    for (const lot of placed.filter(({ visible }) => visible))
      expect(
        labelsOverlap(
          {
            x: (lot.x * width) / 100,
            y: (lot.y * height) / 100 - lot.height / 2,
            width: lot.width,
            height: lot.height,
          },
          icon,
        ),
      ).toBe(false);
  });
  it('reveals the focused lot and nearby names within the same area budget', () => {
    const density = moonLabelDensity(lots, width, height, { selected: 'lot12' });
    expect(density.filter((lot) => !lot.collapsed).map((lot) => lot.id)).toEqual(['lot12']);
    const zoomed = moonLabelDensity(lots, width, height, { near: true });
    expect(zoomed.some((lot) => !lot.collapsed)).toBe(true);
    expect(area(zoomed)).toBeLessThanOrEqual(width * height * MOON_LABEL_COVERAGE);
  });
});
it.each([
  [375, 740],
  [900, 360],
])('budgets zoomed names as the lot catalog grows at %sx%s', (width, height) => {
  const larger = Array.from({ length: 40 }, (_, i) => ({
    id: `lot${i}`,
    visible: true,
    attention: i === 38,
  }));
  const density = moonLabelDensity(larger, width, height, { near: true, selected: 'lot39' });
  expect(density.find((lot) => lot.id === 'lot38').collapsed).toBe(false);
  expect(density.find((lot) => lot.id === 'lot39').collapsed).toBe(false);
  expect(density.some((lot) => lot.collapsed)).toBe(true);
  expect(area(density)).toBeLessThanOrEqual(width * height * MOON_LABEL_COVERAGE);
});
it('preserves desktop labels exactly', () => {
  expect(moonLabelDensity(lots, 1440, 900)).toBe(lots);
});
it('shares valley priority and distant-detail exceptions', () => {
  expect(townLabelRank({ selected: true })).toBeLessThan(townLabelRank({ ready: true }));
  expect(townLabelRank({ ready: true })).toBeLessThan(townLabelRank({}));
  expect(townLabelDetail({ distant: true })).toBeFalsy();
  expect(townLabelDetail({ distant: true, attention: true })).toBeTruthy();
  expect(townLabelDetail({ distant: true, selected: true })).toBeTruthy();
});

it.each(['open', 'work', 'ready'])('always labels %s lots and monument sites', (status) => {
  expect(moonLabelNeedsAttention({ status })).toBe(true);
});
it('labels collection and ready actions, but collapses finished lots and monuments', () => {
  expect(moonLabelNeedsAttention({ status: 'built', action: 'ready' })).toBe(true);
  expect(moonLabelNeedsAttention({ status: 'built', collectable: true })).toBe(true);
  expect(moonLabelNeedsAttention({ status: 'built' })).toBe(false);
  expect(moonLabelNeedsAttention({ status: 'monument' })).toBe(false);
});
