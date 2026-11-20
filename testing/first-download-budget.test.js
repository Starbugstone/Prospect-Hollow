import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../scripts/check-bundle-budget.mjs');
const made = [];
afterAll(() => made.forEach((path) => rmSync(path, { recursive: true, force: true })));

// Random bytes don't compress, so these sizes are close to the gzipped sizes.
function site(files, page) {
  const root = mkdtempSync(join(tmpdir(), 'ph-budget-'));
  made.push(root);
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), page);
  for (const [name, size] of Object.entries(files))
    writeFileSync(join(root, 'assets', name), randomBytes(size));
  return root;
}
const check = (root) =>
  spawnSync(process.execPath, [script, root], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, PH_FIRST_DOWNLOAD_BYTES: '100000' },
  });
const page = (...files) => files.map((file) => `<link href="/assets/${file}">`).join('');

describe('the first-download budget', () => {
  it('accepts a page under its ceiling, ignoring lazy chunks', () => {
    const run = check(
      site({ 'main-aaaaaaaa.js': 80_000, 'lazy-aaaaaaaa.js': 400_000 }, page('main-aaaaaaaa.js')),
    );
    expect(run.status, run.stderr).toBe(0);
  });
  it('rejects a first download over it, counting everything linked', () => {
    const run = check(
      site(
        { 'main-aaaaaaaa.js': 60_000, 'vendor-aaaaaaa.js': 30_000, 'main-aaaaaaaa.css': 30_000 },
        page('main-aaaaaaaa.js', 'vendor-aaaaaaa.js', 'main-aaaaaaaa.css'),
      ),
    );
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('First download');
  });
  it('refuses a page it reads no script from, rather than passing it', () => {
    expect(check(site({ 'main-aaaaaaaa.js': 10 }, '<p>nothing linked</p>')).status).not.toBe(0);
  });
});
