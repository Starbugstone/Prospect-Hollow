import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  stdin: {
    contents:
      "export { buildSaveRules, readSaveRuleHistory, rememberLevelTargets } from './scripts/save-rules.js';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  write: false,
});
// A file URL allows external installed packages (Pinia/Vue) to resolve normally.
const source = result.outputFiles[0].text;
const temporary = `${process.cwd()}/node_modules/.cache-prospect-save-rules-${process.pid}.mjs`;
const { unlinkSync } = await import('node:fs');
let helpers;
try {
  writeFileSync(temporary, source);
  helpers = await import(temporary);
} finally {
  unlinkSync(temporary);
}
const target = 'backend/content/save-rules.json';
const historyTarget = 'backend/content/save-rule-history.json';
const readExisting = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
};
const actual = readExisting(target);
const previousRules = actual ? JSON.parse(actual) : null;
const current = helpers.buildSaveRules({ version: 1, levels: {} });
const history = helpers.rememberLevelTargets(helpers.readSaveRuleHistory(), previousRules, current);
const rules = helpers.buildSaveRules(history);
const expected = `${JSON.stringify(rules, null, 2)}\n`;
const expectedHistory = `${JSON.stringify(history, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (actual !== expected || readExisting(historyTarget) !== expectedHistory) {
    throw new Error(
      'Save rules or their known threshold history are stale. Run npm run export:save-rules in the required Node 24 Docker container.',
    );
  }
  console.log(
    `Save rules match ${rules.levelCount} levels, ${rules.eraOrder.length} eras (${rules.contentDigest}).`,
  );
} else {
  writeFileSync(historyTarget, expectedHistory);
  writeFileSync(target, expected);
  console.log(
    `Exported save rules for ${rules.levelCount} levels and ${rules.eraOrder.length} eras (${rules.contentDigest}).`,
  );
}
