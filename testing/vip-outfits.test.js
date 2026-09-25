import { expect, it } from 'vitest';
import { ERAS, eraEvolution } from '../src/data/eras';
import { vipOutfit, townWardrobe } from '../src/data/townWardrobes';
it('provides three reproducible, coordinated VIP outfits in every era', () => {
  const periods = new Set();
  for (const era of ERAS) {
    const profile = eraEvolution(era.id),
      wardrobe = townWardrobe(profile),
      seen = new Set();
    for (let seed = 0; seed < 100; seed++) {
      const outfit = vipOutfit(profile, seed);
      seen.add(outfit.variant);
      expect(outfit).toEqual(vipOutfit(profile, seed));
      expect(wardrobe.palettes[outfit.variant]).toEqual([
        outfit.shirt,
        outfit.trousers,
        outfit.hat,
        outfit.boots,
        outfit.accent,
      ]);
      if (wardrobe.hat === 'none') expect(outfit.hatVisible).toBe(false);
    }
    expect(seen.size).toBe(3);
    periods.add(JSON.stringify(wardrobe));
  }
  expect(periods.size).toBe(ERAS.length);
  expect(vipOutfit({ wardrobe: 'unknown' }, 11)).toEqual(vipOutfit({ wardrobe: 'frontier' }, 11));
});
