// Writes the mine elements each level consumes, for the museum's honour icons and
// filters, so the game never generates all level configs to draw them.
// node scripts/export-honour-levels.mjs [--check]
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const result = await build({
  stdin: {
    contents:
      "import { generateLevelConfigs } from './src/game/engine/LevelGenerator.js'; import { levelElements } from './src/data/honours.js'; export default Object.fromEntries(generateLevelConfigs().map((level) => [level.id, levelElements(level)]).filter(([, elements]) => Object.keys(elements).length));",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  write: false,
});
const temporary = `${process.cwd()}/node_modules/.cache-prospect-honour-levels-${process.pid}.mjs`;
const { unlinkSync } = await import('node:fs');
let index;
try {
  writeFileSync(temporary, result.outputFiles[0].text);
  index = (await import(temporary)).default;
} finally {
  unlinkSync(temporary);
}
const target = 'src/data/honourLevels.json';
const text = `${JSON.stringify(index, null, 2)}\n`;
if (process.argv.includes('--check')) {
  let actual = '';
  try {
    actual = readFileSync(target, 'utf8');
  } catch {
    /* missing counts as stale */
  }
  if (actual !== text) {
    console.error(`${target} is stale. Run: node scripts/export-honour-levels.mjs`);
    process.exit(1);
  }
} else writeFileSync(target, text);
