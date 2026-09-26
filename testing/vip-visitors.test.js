import { describe, expect, it } from 'vitest';
import names from '../src/data/villagerNames';
import { vipVisitor } from '../src/data/villagers';

describe('honorific VIP visitor names', () => {
  it('keeps the editable lists valid and unique', () => {
    const entries = Object.values(names).flat();
    expect(
      entries.every((name) => typeof name === 'string' && name === name.trim() && name.length > 0),
    ).toBe(true);
    expect(new Set(entries).size).toBe(entries.length);
    expect(entries).not.toContain('test male');
    expect(entries).not.toContain('test female');
  });

  it('draws all configured names equally, with their listed gender and ordinary visits between VIPs', () => {
    const counts = Object.fromEntries(
      Object.values(names)
        .flat()
        .map((name) => [name, 0]),
    );
    if (!Object.keys(counts).length) {
      expect(vipVisitor(7, 10)).toBeNull();
      return;
    }
    let ordinary = 0;
    const draws = 48000;
    for (let visit = 0; visit < draws; visit++) {
      const selected = vipVisitor(7, visit);
      if (!selected) {
        ordinary++;
        continue;
      }
      expect(names[selected.gender]).toContain(selected.name);
      counts[selected.name]++;
    }
    // Deterministic seeds make this reproducible. A gender-first draw would give
    // each man twice the frequency of each woman in the current 2/4 lists.
    const expected = (draws - ordinary) / Object.keys(counts).length;
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThan(expected * 0.85);
      expect(count).toBeLessThan(expected * 1.15);
    }
    expect(ordinary / draws).toBeGreaterThan(0.72);
    expect(ordinary / draws).toBeLessThan(0.78);
  });

  it('repeats the same visit consistently but varies later visits and visitor seeds', () => {
    const sequence = (seed) => Array.from({ length: 200 }, (_, visit) => vipVisitor(seed, visit));
    expect(sequence(12)).toEqual(sequence(12));
    if (Object.values(names).flat().length) {
      expect(sequence(12)).not.toEqual(sequence(13));
      expect(
        new Set(
          sequence(12)
            .filter(Boolean)
            .map((visitor) => visitor.name),
        ).size,
      ).toBeGreaterThanOrEqual(Math.min(2, Object.values(names).flat().length));
    }
  });
});
