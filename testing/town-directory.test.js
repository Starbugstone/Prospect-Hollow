import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  cardHonours,
  nextDraw,
  sameDraw,
  searchable,
  searchTerm,
  wholeDeck,
} from '../src/services/townDirectory';
import { HONOURS } from '../src/data/honours';
import VillageCard from '../src/components/community/VillageCard.vue';

// Shared towns are dealt seven at a time from a deck the server shuffles with a seed, so the
// visit picker never lists the same first towns to every player however many share a town.
describe('shared-town draws', () => {
  const draw = (page, hasNext) => ({ entries: [], seed: '0123456789abcdef', page, hasNext });

  it('starts a new deck, deals the next seven, then reshuffles a spent deck', () => {
    expect(nextDraw(null)).toBe('page=1');
    expect(nextDraw(draw(1, true))).toBe('page=2&seed=0123456789abcdef');
    expect(nextDraw(draw(3, true))).toBe('page=4&seed=0123456789abcdef');
    expect(nextDraw(draw(4, false))).toBe('page=1');
    // A reply without a seed (an older server) can only start again.
    expect(nextDraw({ page: 1, hasNext: true })).toBe('page=1');
  });

  it('returns from a visit to the same towns', () => {
    expect(sameDraw(draw(3, true))).toBe('page=3&seed=0123456789abcdef');
    expect(sameDraw(null)).toBe('page=1');
  });

  it('offers no other towns when the first draw holds every shared town', () => {
    expect(wholeDeck(draw(1, false))).toBe(true);
    expect(wholeDeck(draw(1, true))).toBe(false);
    expect(wholeDeck(draw(2, false))).toBe(false);
    expect(wholeDeck(null)).toBe(false);
  });
});

describe('town search', () => {
  it('searches from two characters, with spacing tidied as town names are', () => {
    expect(searchTerm('  Dust   Gulch ')).toBe('Dust Gulch');
    expect(searchable(' d ')).toBe(false);
    expect(searchable('du')).toBe(true);
    expect(searchable('Éa')).toBe(true);
  });
});

// The server publishes earned IDs and the showcase families; a card shows the best earned
// rank of each showcased family and counts only honours this version knows.
describe('honours on town cards', () => {
  const family = Object.values(HONOURS.familyById).find((entry) => entry.ranks.length > 1);
  const [low, high] = family.ranks;

  it('shows the best earned rank of each showcased family', () => {
    const honours = cardHonours({
      earned: [low.id, high.id, 'visitors-bronze', 'from-a-newer-version'],
      showcase: [family.id, 'unknown-family'],
    });
    expect(honours.count).toBe(3);
    expect(honours.showcase.map((definition) => definition.id)).toEqual([high.id]);
    expect(cardHonours({ earned: [low.id], showcase: [family.id] }).showcase).toEqual([low]);
  });

  it('shows nothing for towns without published honours', () => {
    expect(cardHonours(null)).toBe(null);
    expect(cardHonours({ earned: ['from-a-newer-version'], showcase: [] })).toBe(null);
  });

  it('keeps every honour ID inside the pattern the server accepts on cards', () => {
    for (const id of Object.keys(HONOURS.byId)) expect(id).toMatch(/^[a-z0-9-]{1,64}$/);
  });
});

describe('shared-town cards', () => {
  const card = (entry, props = {}) =>
    renderToString(createSSRApp({ render: () => h(VillageCard, { entry, ...props }) }));
  const town = {
    villageId: 'a'.repeat(32),
    name: 'Dustwater',
    era: 'frontier',
    buildings: 12,
    mineLevel: 45,
    saloonReady: false,
    visitors: 0,
    visited: false,
    favourite: false,
    honours: null,
  };

  it('shows the era, size and mine progress without empty tags', async () => {
    const html = await card(town);
    expect(html).toContain('Dustwater');
    expect(html).toContain('12 buildings');
    expect(html).toContain('Mine level 45');
    expect(html).not.toContain('village-card-tags');
    expect(html).not.toContain('honour-card-row');
    // Same card shape as the player's own towns: the era landscape with its label.
    expect(html).toContain('town-card-art');
    expect(html).toContain('Frontier Settlement');
  });

  it('tells a visitor who is there now and whether the saloon can be collected', async () => {
    const html = await card({ ...town, visitors: 2, saloonReady: true, buildings: 1 });
    expect(html).toContain('2 visitors here now');
    expect(html).toContain('Saloon takings ready');
    expect(html).toContain('1 building');
    expect(await card({ ...town, visitors: 1 })).toContain('1 visitor here now');
  });

  it('remembers visits from earlier sessions and this one', async () => {
    expect(await card({ ...town, visited: true })).toContain('Visited');
    expect(await card(town, { visited: true })).toContain('Visited');
    expect(await card(town)).not.toContain('Visited');
  });

  it('has a separate star button that names the town', async () => {
    const off = await card(town);
    expect(off).toContain('aria-pressed="false"');
    expect(off).toContain('Add Dustwater to favourites');
    const on = await card(town, { favourite: true });
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('Remove Dustwater from favourites');
    // Two sibling buttons, never one button inside another.
    expect(on.match(/<button/g)).toHaveLength(2);
  });

  it('shows showcased honour badges with their metal and the honour count', async () => {
    const html = await card({ ...town, honours: { earned: ['stars-bronze'], showcase: [] } });
    expect(html).toContain('1 honour');
    const shown = await card({
      ...town,
      honours: { earned: ['stars-bronze', 'stars-silver'], showcase: ['stars'] },
    });
    expect(shown).toContain('honour-badge');
    expect(shown).toContain('2 honours');
    // The family's best rank, named with its metal.
    expect(shown).toContain(`Showcase: ${HONOURS.byId['stars-silver'].name} · Silver`);
  });

  it('leaves out a mine level an older share does not carry', async () => {
    expect(await card({ ...town, mineLevel: null })).not.toContain('Mine level');
  });
});
