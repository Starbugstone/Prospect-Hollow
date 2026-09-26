import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const output = new URL('../src/assets/board/', import.meta.url);
await mkdir(output, { recursive: true });
const types = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'moonstone'];
const groups = {
  'board-core': [
    ['gem-relic', 'relic.svg', 160],
    ...[
      'chain',
      'seal',
      'exit',
      'seal-ruby',
      'seal-sapphire',
      'seal-emerald',
      'lantern',
      'survey',
    ].map((t) => [`tile-${t}`, `obstacles/${t}.svg`, 160]),
    ...['tnt', 'color-wand', 'clear-row', 'shuffle', 'tile-breaker'].map((t) => [
      `power-${t}`,
      `powers/${t}.svg`,
      192,
    ]),
    ...['stone', 'reinforced', 'cracked'].map((t) => [`block-${t}`, `blocks/${t}.svg`, 160]),
    ...['frost', 'cracked'].map((t) => [`ice-${t}`, `ice/${t}.svg`, 160]),
  ],
};
for (const finish of ['classic', 'cut', 'geode'])
  groups[`gems-${finish}`] = types.map((t) => [
    `gem-${finish === 'classic' ? '' : finish + '-'}${t}`,
    finish === 'classic' ? `${t}.svg` : `gems/${finish}/${t}.svg`,
    160,
  ]);
const manifest = {};
for (const [key, items] of Object.entries(groups)) {
  const frames = {},
    composite = [],
    stride = 196,
    width = 4 * stride,
    height = Math.ceil(items.length / 4) * stride;
  for (const [i, [name, file, size]] of items.entries()) {
    const left = (i % 4) * stride + 2,
      top = Math.floor(i / 4) * stride + 2;
    composite.push({
      input: await sharp(await readFile(new URL(`../public/art/${file}`, import.meta.url)))
        .resize(size, size)
        .png()
        .toBuffer(),
      left,
      top,
    });
    frames[name] = {
      frame: { x: left, y: top, w: size, h: size },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size, h: size },
      sourceSize: { w: size, h: size },
    };
  }
  const bytes = await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite(composite)
    .png()
    .toBuffer();
  await writeFile(new URL(`${key}.png`, output), bytes);
  manifest[key] = { frames, meta: { size: { w: width, h: height } } };
}
const bonus = await sharp(
  await readFile(new URL('../public/art/bonuses/atlas.svg', import.meta.url)),
)
  .resize(1536, 576)
  .png()
  .toBuffer();
await writeFile(new URL('board-bonus.png', output), bonus);
manifest['board-bonus'] = { frames: {}, meta: { size: { w: 1536, h: 576 } } };
for (const [row, t] of ['bomb', 'rainbow', 'cross'].entries())
  for (let i = 0; i < 8; i++)
    manifest['board-bonus'].frames[`${t}-${i}`] = {
      frame: { x: i * 192, y: row * 192, w: 192, h: 192 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 192, h: 192 },
      sourceSize: { w: 192, h: 192 },
    };
await writeFile(new URL('frames.json', output), JSON.stringify(manifest));
console.log('Generated five board atlases; Vite supplies content-hashed URLs.');
