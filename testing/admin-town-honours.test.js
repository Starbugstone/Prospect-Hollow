import { beforeEach, describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TownHonours from '../src/admin/components/TownHonours.vue';
import { createHonours, HONOURS } from '../src/data/honours';
import { setLocale } from '../src/i18n';

const render = (profile, counts = {}) =>
  renderToString(createSSRApp(TownHonours, { profile, ...counts }));
const earned = { at: null, version: 1, seen: false, announced: false };
beforeEach(() => setLocale('en'));

describe('admin town achievements', () => {
  it('renders older saves with three empty slots and the current achievement catalog', async () => {
    const html = await render({});
    expect(html.match(/Empty slot/g)).toHaveLength(3);
    expect(html).toContain('No earned ranks or showcase choices have been saved yet');
    expect(html.match(/<summary>/g)).toHaveLength(HONOURS.families.length);
    expect(html).toContain('Not earned');
    expect(html).not.toContain('NaN');
  });

  it('keeps showcase order, shows the highest earned metal and does not alter the save', async () => {
    const honours = createHonours();
    honours.earned = {
      'visitors-bronze': { ...earned },
      'gem-ruby-bronze': { ...earned },
      'gem-ruby-silver': { ...earned },
      'stars-bronze': { ...earned },
    };
    honours.showcase = ['visitors', 'gem-ruby', 'stars'];
    honours.counts.gems.ruby = 12000;
    const profile = { honours, records: {}, town: { era: 'frontier' } };
    const before = structuredClone(profile);
    const html = await render(profile, { uniqueVisitors: 3, townsVisited: 2 });
    const showcase = html.match(/<ol[\s\S]*?<\/ol>/)[0];
    expect(showcase).toContain('First Guest · Bronze');
    expect(showcase).toContain('Ruby Laureate · Silver');
    expect(showcase.indexOf('First Guest')).toBeLessThan(showcase.indexOf('Ruby Laureate'));
    expect(showcase.indexOf('Ruby Laureate')).toBeLessThan(showcase.indexOf('Rising Star'));
    expect(html).toContain('3 / 5 different players visited');
    expect(html).toContain('12,000 / 25,000 rubies collected');
    expect(profile).toEqual(before);
  });

  it('does not award a rank just because current visits have reached its goal', async () => {
    const honours = createHonours();
    const html = await render({ honours }, { uniqueVisitors: 20 });
    expect(html.match(/Empty slot/g)).toHaveLength(3);
    expect(html).toContain('Friends · 0 of 2 families earned');
    expect(honours.earned).toEqual({});
  });

  it('handles saved social counts, completed families and unknown showcase entries', async () => {
    const honours = createHonours();
    for (const rank of HONOURS.familyById.visitors.ranks) honours.earned[rank.id] = { ...earned };
    honours.counts.visitors = 25;
    honours.showcase = ['unknown-future-family', 'visitors'];
    const html = await render({ honours });
    expect(html).toContain('Celebrated Town · Gold');
    expect(html).toContain('All current ranks earned');
    expect(html).not.toContain('unknown-future-family');
    expect(html.match(/Empty slot/g)).toHaveLength(2);
  });
});
