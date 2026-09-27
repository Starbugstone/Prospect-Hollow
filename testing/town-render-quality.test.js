import { afterEach, expect, it, vi } from 'vitest';
import { TownRenderQuality } from '../src/game/town/TownRenderQuality';
afterEach(() => vi.unstubAllGlobals());
it.each([1, 1.25, 2])('recovers and persists full quality at device DPR %s', (dpr) => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key),
    setItem: (key, value) => saved.set(key, value),
  });
  const q = new TownRenderQuality(dpr);
  for (let i = 0; i < 120; i++) q.sample(50);
  expect(q.tier).toBe('low');
  for (let i = 0; i < 2000; i++) q.sample(16);
  expect(q.ratio).toBe(q.maxRatio);
  expect(q.tier).toBe('high');
  const restored = new TownRenderQuality(dpr);
  expect(restored.shadowSize).toBe(2048);
  expect(restored.cacheSamples).toBe(4);
});
it('recovers a saved low tier even when its ratio is already at the device maximum', () => {
  const q = new TownRenderQuality(1, 'low');
  for (let i = 0; i < 320; i++) q.sample(16);
  expect(q.ratio).toBe(1);
  expect(q.tier).toBe('high');
});
it('reduces fill cost for sustained slow animation, recovers cautiously, and ignores pauses', () => {
  const q = new TownRenderQuality(2);
  for (let i = 0; i < 39; i++) expect(q.sample(50)).toBeNull();
  expect(q.sample(50)).toBeCloseTo(1);
  for (let i = 0; i < 400; i++) q.sample(50);
  expect(q.ratio).toBe(0.6);
  for (let i = 0; i < 100; i++) q.sample(10000);
  expect(q.ratio).toBe(0.6);
  q.resetWindow();
  for (let i = 0; i < 319; i++) expect(q.sample(16.7)).toBeNull();
  expect(q.sample(16.7)).toBeCloseTo(0.75);
});
it('does not reduce quality for one isolated stall or change native-density controls', () => {
  const q = new TownRenderQuality(1);
  q.sample(100);
  for (let i = 0; i < 39; i++) q.sample(16.7);
  expect(q.ratio).toBe(1);
  expect(q.maxRatio).toBe(1);
});
it.each([200, 350, 750])(
  'adapts to sustained %s ms frames instead of treating them as pauses',
  (ms) => {
    const q = new TownRenderQuality(1);
    for (let i = 0; i < 40; i++) q.sample(ms);
    expect(q.ratio).toBeCloseTo(0.8);
  },
);
it('never increases quality above a low device pixel ratio while reducing load', () => {
  const q = new TownRenderQuality(0.5);
  for (let i = 0; i < 400; i++) q.sample(80);
  expect(q.ratio).toBe(0.5);
});
