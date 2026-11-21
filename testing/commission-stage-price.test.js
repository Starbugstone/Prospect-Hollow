import { afterEach, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TownMonumentSite from '../src/components/town/TownMonumentSite.vue';
import { COMMISSIONS } from '../src/data/commissions';
import { createTown } from '../src/data/town';
import {
  AREA_BY_ID,
  LANDMARK_PROGRESSION,
  PERSONAL_AREAS,
  landmarkPrice,
  sharedStagePrices,
} from '../src/data/townLandmarks';
import { number, setLocale, t } from '../src/i18n';
import { openEverySite } from './helpers/siteOpening';

// A commission letter says what its price buys before the permanent choice: the first of
// its stages, and what all of them cost, from the site's own price schedule.
const LINE =
  'The first stage costs {price} coins: stage 1 of {count}. All {count} stages cost {total} coins.';
const render = (props) =>
  renderToString(createSSRApp({ render: () => h(TownMonumentSite, props) }));
const decode = (html) => html.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
afterEach(() => setLocale('en'));

const openTown = () =>
  openEverySite({ ...createTown(), era: 'quiet-signal', coins: 1e8 }, PERSONAL_AREAS);

it('reads a commission’s stages from its price schedule', () => {
  for (const { site } of COMMISSIONS) {
    const area = AREA_BY_ID[site];
    const count = LANDMARK_PROGRESSION.levels.length;
    const schedule = Array.from({ length: count }, (_, n) =>
      landmarkPrice(area, area.choices[0], n + 1),
    );
    expect(sharedStagePrices(area)).toEqual({
      first: schedule[0],
      count,
      total: schedule.reduce((sum, price) => sum + price, 0),
    });
  }
});

it('names nothing for designs with different schedules', () => {
  // Founders' Meadow prices each design differently.
  const meadow = AREA_BY_ID.meadow;
  const firsts = new Set(meadow.choices.map((choice) => landmarkPrice(meadow, choice, 1)));
  expect(firsts.size).toBeGreaterThan(1);
  expect(sharedStagePrices(meadow)).toBeNull();
});

it.each(
  ['willowkin-glade', 'crew-yard', 'schoolyard-court'].flatMap((site) =>
    ['en', 'fr'].map((lang) => [site, lang]),
  ),
)('tells the %s letter what its first stage buys (%s)', async (site, lang) => {
  setLocale(lang);
  const area = AREA_BY_ID[site];
  const html = decode(await render({ id: site, town: openTown() }));
  const { first, count, total } = sharedStagePrices(area);
  const line = t(LINE, { price: number(first), count, total: number(total) });
  expect(html).toContain(line);
  // Before the designs and their permanent choice.
  expect(html.indexOf(line)).toBeLessThan(html.indexOf('monument-choices'));
  if (lang === 'en')
    expect(line).toBe(
      'The first stage costs 400,000 coins: stage 1 of 5. All 5 stages cost 2,000,000 coins.',
    );
});

it('leaves monuments that are not commissions as they were', async () => {
  const html = await render({ id: 'earthrise-plaza', town: openTown() });
  expect(html).not.toContain('data-commission-stages');
});
