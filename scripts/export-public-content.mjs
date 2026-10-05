import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const result = await build({
  stdin: {
    contents:
      "export { BUILDINGS } from './src/data/town.js'; export { ERAS } from './src/data/eras.js'; export { LEVEL_COUNT } from './src/data/campaign.js'; export { COUNTERS, HONOURS, HONOURS_VERSION, SHOWCASE_SLOTS } from './src/data/honours.js'; export { PLAYER_DISTINCTIONS } from './src/data/playerDistinctions.js';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const {
  BUILDINGS,
  ERAS,
  LEVEL_COUNT,
  COUNTERS,
  HONOURS,
  HONOURS_VERSION,
  SHOWCASE_SLOTS,
  PLAYER_DISTINCTIONS,
} = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);

// The measure kinds backend/src/Honours.php evaluates. A new kind must be implemented
// there first: the server would otherwise never verify, and so never publish, its ranks.
const SERVER_MEASURES = ['stars', 'score', 'era', 'count', 'distinct', 'powers', 'social'];
for (const definition of HONOURS.definitions) {
  if (!SERVER_MEASURES.includes(definition.measure.kind))
    throw new Error(`${definition.id} measures ${definition.measure.kind}, unknown to the server.`);
}

const schema = {
  buildings: BUILDINGS.map((b) => b.id),
  eras: ERAS.map((e) => e.id),
  buildingLevels: Object.fromEntries(BUILDINGS.map((b) => [b.id, b.upgrades.length])),
  levels: LEVEL_COUNT,
  // The Town Honours catalog for the server's verification, merge and public projection,
  // in registry order (docs/backend/visitors.md). Star score targets, era order and level
  // elements come from save-rules.json.
  honours: {
    version: HONOURS_VERSION,
    showcaseSlots: SHOWCASE_SLOTS,
    counters: COUNTERS,
    definitions: Object.fromEntries(
      HONOURS.definitions.map((definition) => [
        definition.id,
        {
          family: definition.family,
          rank: definition.rank,
          metal: definition.metal,
          tab: definition.tab,
          goal: definition.goal,
          measure: definition.measure,
        },
      ]),
    ),
    // Player distinctions a showcase may hold, one per town (backend/src/PlayerDistinctions.php).
    playerDistinctions: Object.fromEntries(
      PLAYER_DISTINCTIONS.map((definition) => [definition.id, { kind: definition.kind }]),
    ),
  },
};
writeFileSync('backend/content/public-schema.json', JSON.stringify(schema));
