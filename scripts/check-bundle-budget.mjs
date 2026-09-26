import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const failures = [];
for (const file of await readdir('dist/assets')) {
  const bytes = (await stat(path.join('dist/assets', file))).size;
  if (file.endsWith('.js') && bytes > 2_000_000)
    failures.push(`${file}: ${bytes} bytes exceeds 2 MB`);
}
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
console.log('Bundle budgets passed: JavaScript chunks ≤ 2 MB; no static mesh catalogs.');
