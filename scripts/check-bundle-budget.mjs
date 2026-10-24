import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

// Game code and data chunks stay under 500 kB; the prebuilt libraries have their own
// budgets (vite.config.js gives them separate chunks). Lazy data belongs in fetched
// assets, like the mesh and footprint catalogs, rather than in JavaScript.
const LIBRARY_BUDGETS = { phaser: 1_300_000, three: 650_000 };
const GAME_BUDGET = 500_000;
// The mine and the town load these on demand; the first screen never waits for them.
const LAZY_LIBRARIES = ['phaser', 'three'];

const failures = [];
const chunkName = (file) => file.replace(/-[\w-]{8}\.js$/, '');
for (const file of await readdir('dist/assets')) {
  if (!file.endsWith('.js')) continue;
  const bytes = (await stat(path.join('dist/assets', file))).size;
  const budget = LIBRARY_BUDGETS[chunkName(file)] ?? GAME_BUDGET;
  if (bytes > budget) failures.push(`${file}: ${bytes} bytes exceeds ${budget}`);
}
const startup = await readFile('dist/index.html', 'utf8');
for (const [, file] of startup.matchAll(/(?:href|src)="\/assets\/([^"]+\.js)"/g))
  if (LAZY_LIBRARIES.includes(chunkName(file)))
    failures.push(`index.html loads ${file} at startup`);
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(js|vue)$/.test(file)) {
      const source = await readFile(file, 'utf8');
      if (
        /\b(?:import|export)\s+[^;]*?\bfrom\s*['"][^'"]*meshes[^'"]*\.json['"]/.test(source) ||
        /\bimport\s*['"][^'"]*meshes[^'"]*\.json['"]/.test(source)
      )
        failures.push(`${file}: static mesh catalog import`);
    }
  }
}
await inspect('src');
if (failures.length) throw new Error(failures.join('\n'));
console.log(
  'Bundle budgets passed: game chunks ≤ 500 kB, libraries within budget and lazy; no static mesh catalogs.',
);
