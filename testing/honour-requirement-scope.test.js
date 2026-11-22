import { expect, it } from 'vitest';
import { honourFamilies } from '../src/data/honours';
import { AREA_BY_ID } from '../src/data/townLandmarks';
import fr from '../src/i18n/fr.json';

// Two shipped families count a fixed list (AGENTS.md: shipped requirements never grow).
// Their requirement text says which, in English and French, so a later level or site
// that earns nothing is not a surprise.
const family = (id) => honourFamilies().find((entry) => entry.id === id);

it('names the levels Seam Explorer counts', () => {
  const { measure, requirement } = family('seam-explorer');
  const range = `1–${measure.keys.length}`;
  expect(measure.keys.at(-1)).toBe(`level-${measure.keys.length}`);
  expect(requirement).toContain(range);
  expect(fr[requirement]).toContain(range);
});

it('names every site Landmark Patron counts', () => {
  // The site list is the family's scope, shown once beside the per-rank requirement.
  const { measure, scope } = family('landmark-patron');
  for (const area of measure.areas) {
    const { label } = AREA_BY_ID[area];
    expect(scope, area).toContain(label);
    expect(fr[scope], area).toContain(fr[label]);
  }
});
