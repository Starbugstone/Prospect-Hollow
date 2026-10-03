import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { nextDraw, sameDraw, wholeDeck } from '../src/services/villageDeck';
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

describe('shared-town cards', () => {
  const card = (entry, visited = false) =>
    renderToString(createSSRApp({ render: () => h(VillageCard, { entry, visited }) }));
  const town = {
    villageId: 'a'.repeat(32),
    name: 'Dustwater',
    era: 'frontier',
    buildings: 12,
    mineLevel: 45,
    saloonReady: false,
    visitors: 0,
  };

  it('shows the era, size and mine progress without empty tags', async () => {
    const html = await card(town);
    expect(html).toContain('Dustwater');
    expect(html).toContain('12 buildings');
    expect(html).toContain('Mine level 45');
    expect(html).not.toContain('village-card-tags');
  });

  it('tells a visitor who is there now and whether the saloon can be collected', async () => {
    const html = await card({ ...town, visitors: 2, saloonReady: true, buildings: 1 }, true);
    expect(html).toContain('2 visitors here now');
    expect(html).toContain('Saloon takings ready');
    expect(html).toContain('Visited');
    expect(html).toContain('1 building');
    expect(await card({ ...town, visitors: 1 })).toContain('1 visitor here now');
  });

  it('leaves out a mine level an older share does not carry', async () => {
    expect(await card({ ...town, mineLevel: null })).not.toContain('Mine level');
  });
});
