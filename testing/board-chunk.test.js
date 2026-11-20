import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// The puzzle board draws with Phaser and loads with it (game/phaser/loadBoard.js). Whatever
// the page imports statically downloads before the first screen, so the board's animation
// code must only be reachable through that dynamic import.
const root = path.resolve(import.meta.dirname, '..');
const STATIC =
  /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;
function resolve(from, request) {
  if (!request.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), request);
  for (const file of [base, `${base}.js`, `${base}.vue`, path.join(base, 'index.js')])
    if (existsSync(file) && statSync(file).isFile()) return file;
  return null;
}
function staticGraph(entry) {
  const seen = new Set();
  const queue = [path.join(root, entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !/\.(?:js|vue)$/.test(file)) continue;
    seen.add(file);
    for (const [, from, bare] of readFileSync(file, 'utf8').matchAll(STATIC)) {
      const next = resolve(file, from ?? bare);
      if (next) queue.push(next);
    }
  }
  return [...seen].map((file) => path.relative(root, file));
}
const BOARD_ONLY = /^src\/game\/phaser\/(?!BoardReadiness\.js$|loadBoard\.js$)/;

it('keeps the board renderer out of what the page loads at startup', () => {
  const startup = staticGraph('src/main.js');
  expect(startup).toContain('src/stores/gameStore.js');
  expect(startup.filter((file) => BOARD_ONLY.test(file))).toEqual([]);
});

it('reaches the board renderer through the board chunk', () => {
  const board = staticGraph('src/components/BoardCanvas.vue');
  for (const file of ['BoardAnimator.js', 'BoardInput.js', 'BonusEffects.js'])
    expect(board).toContain(`src/game/phaser/${file}`);
});

it('would notice a store importing the animator again', () => {
  // The walker follows a plain static import: the lazy chunk's own graph proves it.
  expect(staticGraph('src/game/phaser/boardPresenters.js')).toContain(
    'src/game/phaser/BoardAnimator.js',
  );
});
