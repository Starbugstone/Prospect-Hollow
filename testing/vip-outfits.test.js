import { expect, it } from 'vitest';
import { ERAS, eraEvolution } from '../src/data/eras';
import { vipOutfit, townWardrobe, guestOutfit, guestSuit } from '../src/data/townWardrobes';
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
it('dresses share-link guests in their own suit each era, never an ordinary VIP palette', () => {
  const suits = new Set();
  for (const era of ERAS) {
    const profile = eraEvolution(era.id),
      wardrobe = townWardrobe(profile),
      outfit = guestOutfit(profile);
    expect(wardrobe.guest).toHaveLength(5);
    expect([outfit.shirt, outfit.trousers, outfit.hat, outfit.boots, outfit.accent]).toEqual(
      wardrobe.guest,
    );
    for (const palette of wardrobe.palettes) expect(palette).not.toContain(outfit.shirt);
    expect(outfit).toMatchObject({ variant: 'guest', accessory: 'scarf' });
    if (wardrobe.hat === 'none') expect(outfit.hatVisible).toBe(false);
    suits.add(outfit.shirt);
  }
  // Periods sharing one wardrobe share its suit; every distinct wardrobe has its own.
  expect(suits.size).toBe(new Set(ERAS.map((era) => townWardrobe(eraEvolution(era.id)))).size);
  expect(guestOutfit({ wardrobe: 'unknown' })).toEqual(guestOutfit({ wardrobe: 'frontier' }));
  // A future period without a guest suit falls back to the default one.
  expect(guestSuit({ palettes: [] })).toEqual(guestSuit(townWardrobe({ wardrobe: 'frontier' })));
});
