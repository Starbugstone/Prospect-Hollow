import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// Game code and data chunks stay under 500 kB; the prebuilt libraries have their own
// budgets (vite.config.js gives them separate chunks). Lazy data belongs in fetched
// assets, like the mesh and footprint catalogs, rather than in JavaScript.
const LIBRARY_BUDGETS = { phaser: 1_300_000, three: 650_000 };
const GAME_BUDGET = 500_000;
// The mine and the town load these on demand; the first screen never waits for them.
const LAZY_LIBRARIES = ['phaser', 'three'];

const failures = [];
const chunkName = (file) => file.replace(/-[\w-]{8}\.js$/, '');
const directory = process.argv[2] ?? 'dist';
for (const file of await readdir(path.join(directory, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  const bytes = (await stat(path.join(directory, 'assets', file))).size;
  const budget = LIBRARY_BUDGETS[chunkName(file)] ?? GAME_BUDGET;
  if (bytes > budget) failures.push(`${file}: ${bytes} bytes exceeds ${budget}`);
}
const startup = await readFile(path.join(directory, 'index.html'), 'utf8');
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
// What a player's phone downloads before the first screen, gzipped: the page plus every script and
// style it links or preloads. Raise this on purpose, with the new baseline in the performance log.
const FIRST_DOWNLOAD_BUDGET = Number(process.env.PH_FIRST_DOWNLOAD_BYTES ?? 500_000);
const firstFiles = [...startup.matchAll(/(?:href|src)="\/assets\/([^"]+\.(?:js|css))"/g)].map(
  ([, file]) => file,
);
if (!firstFiles.some((file) => file.endsWith('.js')))
  failures.push(`${directory}/index.html links no script: the budget would measure nothing`);
let firstDownload = gzipSync(startup, { level: 9 }).length;
for (const file of firstFiles)
  firstDownload += gzipSync(await readFile(path.join(directory, 'assets', file)), {
    level: 9,
  }).length;
if (firstDownload > FIRST_DOWNLOAD_BUDGET)
  failures.push(`First download is ${firstDownload} bytes gzipped, over ${FIRST_DOWNLOAD_BUDGET}`);
// A French browser also waits for the French text before the first screen
// (`src/i18n/index.js`), so its first download is the page plus that chunk.
const FRENCH_FIRST_DOWNLOAD_BUDGET = Number(process.env.PH_FRENCH_FIRST_DOWNLOAD_BYTES ?? 615_000);
const frenchFiles = (await readdir(path.join(directory, 'assets'))).filter(
  (file) => chunkName(file) === 'fr',
);
if (frenchFiles.length !== 1)
  failures.push(`${directory}/assets holds ${frenchFiles.length} French text chunks, expected 1`);
let frenchDownload = firstDownload;
for (const file of frenchFiles)
  frenchDownload += gzipSync(await readFile(path.join(directory, 'assets', file)), {
    level: 9,
  }).length;
if (frenchDownload > FRENCH_FIRST_DOWNLOAD_BUDGET)
  failures.push(
    `French first download is ${frenchDownload} bytes gzipped, over ${FRENCH_FIRST_DOWNLOAD_BUDGET}`,
  );
if (failures.length) throw new Error(failures.join('\n'));
console.log(
  `Bundle budgets passed: game chunks ≤ 500 kB, libraries within budget and lazy; no static mesh catalogs; first download ${firstDownload} of ${FIRST_DOWNLOAD_BUDGET} bytes gzipped, ${frenchDownload} of ${FRENCH_FIRST_DOWNLOAD_BUDGET} in French.`,
);
