import { build } from 'esbuild';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

const result = await build({
  stdin: {
    contents:
      "import { createIntegrityFixtures } from './scripts/integrity-fixtures.js'; export default createIntegrityFixtures();",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  loader: { '.png': 'empty' },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.MODE': '"test"' },
  write: false,
});
const temporary = `${process.cwd()}/node_modules/.cache-prospect-integrity-fixtures-${process.pid}.mjs`;
let fixtures;
try {
  writeFileSync(temporary, result.outputFiles[0].text);
  ({ default: fixtures } = await import(temporary));
} finally {
  unlinkSync(temporary);
}
const target = 'backend/tests/fixtures/integrity-flows.json';
const expected = await format(JSON.stringify(fixtures), {
  ...(await resolveConfig(target)),
  parser: 'json',
});
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== expected)
    throw new Error(
      'Frontend/backend integrity fixtures are stale. Regenerate them in Node 24 Docker.',
    );
  console.log(`Integrity fixtures match ${fixtures.fixtures.length} frontend flows.`);
} else {
  mkdirSync('backend/tests/fixtures', { recursive: true });
  writeFileSync(target, expected);
  console.log(`Generated ${fixtures.fixtures.length} frontend integrity flows.`);
}
