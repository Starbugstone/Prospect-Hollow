import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const result = await build({
  stdin: {
    contents:
      "import { BUILDINGS } from './src/data/town.js'; import { ERAS } from './src/data/eras.js'; export default {buildings:BUILDINGS.map(b=>b.id),eras:ERAS.map(e=>e.id)}",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { default: schema } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
writeFileSync('backend/content/public-schema.json', JSON.stringify(schema));
