import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const result = await build({
  stdin: {
    contents:
      "export { BUILDINGS } from './src/data/town.js'; export { ERAS } from './src/data/eras.js'; export { LEVEL_COUNT } from './src/data/campaign.js'; export { HONOURS, SCORE_FROM_LEVEL, SHOWCASE_SLOTS, publicHonours } from './src/data/honours.js';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { BUILDINGS, ERAS, LEVEL_COUNT, HONOURS, SCORE_FROM_LEVEL, SHOWCASE_SLOTS, publicHonours } =
  await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  );

// Honours the server proves from the saved records and town before publishing them
// (docs/backend/visitors.md); the score family is proven against its rank multiple.
// Every other catalog honour is published as the owner's claim.
const PROOFS = {
  'first-perfect': 'any-perfect',
  'perfect-prospector': 'all-perfect',
  'town-complete': 'final-era',
};
for (const id of Object.keys(PROOFS))
  if (!HONOURS.byId[id]) throw new Error(`The provable honour ${id} left the registry.`);
const proof = (definition) => {
  // Visitor ranks are proven by the server's own count of different signed-in visitors.
  if (definition.family === 'visitors') {
    const { goal } = definition.params();
    if (!(goal > 0)) throw new Error(`${definition.id} needs a positive visitor goal.`);
    return { proof: 'visitors', goal };
  }
  if (definition.family !== 'score')
    return PROOFS[definition.id] ? { proof: PROOFS[definition.id] } : {};
  const { multiple } = definition.params();
  if (!(multiple > 0)) throw new Error(`${definition.id} needs a positive score multiple.`);
  return { proof: 'score', multiple };
};
const finalEra = HONOURS.byId['town-complete'].requirementVersion.era;
if (!ERAS.some((era) => era.id === finalEra && era.enabled))
  throw new Error('Prospect Hollow Complete needs an enabled final era.');

const schema = {
  buildings: BUILDINGS.map((b) => b.id),
  eras: ERAS.map((e) => e.id),
  buildingLevels: Object.fromEntries(BUILDINGS.map((b) => [b.id, b.upgrades.length])),
  levels: LEVEL_COUNT,
  // The Town Honours catalog for the server's merge and public projection, in registry
  // order. Star score targets come from save-rules.json; `levels` above bounds the levels.
  honours: {
    version: publicHonours({}).version,
    showcaseSlots: SHOWCASE_SLOTS,
    scoreFromLevel: SCORE_FROM_LEVEL,
    finalEra,
    definitions: Object.fromEntries(
      HONOURS.definitions.map((definition) => [
        definition.id,
        {
          family: definition.family,
          rank: definition.rank,
          category: definition.category,
          ...proof(definition),
        },
      ]),
    ),
  },
};
writeFileSync('backend/content/public-schema.json', JSON.stringify(schema));
