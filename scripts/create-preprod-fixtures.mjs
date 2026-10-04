// TEMPORARY preprod test data (issue #60): shared towns with Town Honours for the town
// explorer and visitor views. Remove this script, backend/content/preprod-fixtures.json,
// backend/src/PreprodFixtures.php and backend/bin/preprod-fixtures.php after testing.
// Run in Docker after `node scripts/create-era-demo.mjs` (it writes output/era-demo/).
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 3, 18);
const TOWNS = [
  {
    key: 'amberfall',
    name: 'Amberfall',
    mayor: 'Mira Ashgrove',
    demo: 'riverlight-complete',
    reached: 402,
    perfect: 402,
    score: [200, 3.2],
    visitors: 18,
    honours: 'all',
    showcase: ['perfect-prospector', 'score', 'town-complete'],
  },
  {
    key: 'willowmere',
    name: 'Willowmere',
    mayor: 'Ezra Fennick',
    demo: 'canopy-complete',
    reached: 360,
    perfect: 150,
    score: [90, 2.2],
    visitors: 7,
    honours: [
      'first-perfect',
      'score-ace',
      'first-fusion',
      'fusion-master',
      'laureate-ruby',
      'laureate-sapphire',
      'laureate-emerald',
      'first-guest',
      'welcoming-host',
    ],
    showcase: ['laureate-ruby', 'laureate-emerald', 'fusion-master'],
  },
  {
    key: 'copperfield',
    name: 'Copperfield',
    mayor: 'Juno Hale',
    demo: 'tomorrow-complete',
    reached: 340,
    perfect: 60,
    visitors: 3,
    honours: [
      'first-perfect',
      'forge-delivers',
      'relic-keeper',
      'lamplighter',
      'trail-surveyor',
      'ore-merchant',
      'core-engineer',
      'first-guest',
    ],
    showcase: ['lamplighter', 'relic-keeper', 'core-engineer'],
  },
  {
    key: 'larkspur-bay',
    name: 'Larkspur Bay',
    mayor: 'Tomas Reed',
    demo: 'contemporary-complete',
    reached: 300,
    perfect: 30,
    visitors: 16,
    honours: [
      'first-perfect',
      'forge-delivers',
      'first-guest',
      'welcoming-host',
      'popular-destination',
      'defence-contemporary',
    ],
    showcase: ['visitors', 'first-perfect', 'forge-delivers'],
  },
  {
    key: 'dustwater-junction',
    name: 'Dustwater Junction',
    mayor: 'Ada Mercer',
    demo: 'motor-age-complete',
    reached: 220,
    perfect: 40,
    score: [64, 2.4],
    visitors: 2,
    honours: [
      'first-perfect',
      'score-ace',
      'first-fusion',
      'forge-delivers',
      'forge-veteran',
      'first-guest',
    ],
    showcase: ['score', 'first-fusion', 'forge-veteran'],
  },
  {
    key: 'rivermouth',
    name: 'Rivermouth',
    mayor: 'Hollis Grey',
    demo: 'river-rail-complete',
    reached: 72,
    perfect: 12,
    visitors: 1,
    honours: ['first-perfect', 'defence-frontier', 'defence-river-rail', 'first-guest'],
    showcase: ['defence-frontier', 'defence-river-rail', 'first-perfect'],
  },
  {
    key: 'brightforge',
    name: 'Brightforge',
    mayor: 'Wren Calloway',
    demo: 'industrial-complete',
    reached: 110,
    perfect: 0,
    visitors: 0,
    honours: ['forge-delivers', 'first-fusion'],
    showcase: ['forge-delivers'],
  },
  {
    key: 'skyreach',
    name: 'Skyreach',
    mayor: 'Ivo Lark',
    demo: 'aviation-complete',
    reached: 200,
    perfect: 25,
    visitors: 5,
    honours: [
      'first-perfect',
      'laureate-sapphire',
      'first-guest',
      'welcoming-host',
      'defence-aviation',
    ],
    showcase: ['laureate-sapphire'],
  },
  {
    key: 'harmony-hill',
    name: 'Harmony Hill',
    mayor: 'Nell Ashby',
    demo: 'broadcast-complete',
    reached: 230,
    perfect: 8,
    visitors: 1,
    honours: ['first-perfect', 'forge-delivers', 'first-guest'],
    showcase: [],
  },
  {
    key: 'quiet-hollow',
    name: 'Quiet Hollow',
    mayor: 'Bram Teller',
    demo: 'frontier-ready',
    reached: 30,
    perfect: 0,
    visitors: 0,
    honours: null,
    showcase: [],
  },
];

try {
  const { HONOURS, createHonours } = await server.ssrLoadModule('/src/data/honours.js');
  const { getLevelStarTarget } = await server.ssrLoadModule('/src/data/starRating.js');
  const { LEVEL_COUNT } = await server.ssrLoadModule('/src/data/campaign.js');
  const target = (id) => getLevelStarTarget(id, 20000);
  const towns = TOWNS.map((spec, index) => {
    const demo = JSON.parse(readFileSync(`output/era-demo/${spec.demo}.json`, 'utf8'));
    const records = {};
    for (let id = 1; id <= Math.min(spec.reached, LEVEL_COUNT); id++)
      records[id] =
        id <= spec.perfect
          ? { score: Math.round(target(id) * 1.6), stars: 3 }
          : { score: Math.round(target(id) * 1.1), stars: 2 };
    if (spec.score) {
      const [id, ratio] = spec.score;
      records[id] = { score: Math.ceil(target(id) * ratio), stars: 3 };
    }
    const profile = {
      ...demo,
      records,
      continuousRecords: {},
      powers: [],
      town: { ...demo.town, completedRuns: Math.max(demo.town.completedRuns ?? 0, spec.reached) },
    };
    if (spec.honours) {
      const ids =
        spec.honours === 'all'
          ? HONOURS.definitions
              .map((definition) => definition.id)
              .filter((id) => id !== 'celebrated-town')
          : spec.honours;
      for (const id of ids) if (!HONOURS.byId[id]) throw new Error(`Unknown honour ${id}`);
      const honours = createHonours();
      ids.forEach((id, i) => {
        honours.earned[id] = {
          at: NOW - (index * 3 + i) * DAY,
          version: 1,
          seen: true,
          announced: true,
          ...(HONOURS.byId[id].family === 'score' && spec.score
            ? {
                evidence: {
                  levelId: spec.score[0],
                  score: records[spec.score[0]].score,
                  target: target(spec.score[0]),
                },
              }
            : {}),
        };
      });
      honours.counts = {
        gems: {
          ruby: 9000 + index * 700,
          sapphire: 8800,
          emerald: 8600,
          topaz: 6100,
          amethyst: 5900,
          moonstone: 5700,
        },
        forge: 20 + index * 3,
        mine: { relics: 240, lanterns: 70, surveys: 30, oreOrders: 60, cores: 40, gates: 10 },
        visitors: spec.visitors,
      };
      honours.fusions = ['bomb+bomb', 'bomb+cross', 'cross+cross'];
      honours.showcase = spec.showcase;
      honours.backfilled = 1;
      profile.honours = honours;
    }
    return { key: spec.key, name: spec.name, mayor: spec.mayor, visitors: spec.visitors, profile };
  });
  const fixtures = { version: 1, generatedAt: NOW, towns };
  writeFileSync('backend/content/preprod-fixtures.json', `${JSON.stringify(fixtures)}\n`);
  console.log(`Wrote ${towns.length} preprod fixture towns.`);
} finally {
  await server.close();
}
