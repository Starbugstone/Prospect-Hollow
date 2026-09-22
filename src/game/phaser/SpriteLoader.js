import { GEM_TYPES } from '../engine/GemFactory';
import { GEM_FINISHES } from '../../data/gemAppearance';

export const BONUS_TYPES = ['bomb', 'rainbow', 'cross'];
const BONUS_FRAME_SIZE = 192;
const BONUS_FRAME_COUNT = 8;

// Vector art is rasterized once at load time; animation uses a single GPU atlas.
export function preloadSpriteAssets(scene) {
  GEM_TYPES.forEach((type) =>
    scene.load.svg(`gem-${type}`, `/art/${type}.svg`, { width: 160, height: 160 }),
  );
  for (const finish of GEM_FINISHES.filter((f) => f !== 'classic'))
    for (const type of GEM_TYPES)
      scene.load.svg(`gem-${finish}-${type}`, `/art/gems/${finish}/${type}.svg`, {
        width: 160,
        height: 160,
      });
  scene.load.svg('gem-relic', '/art/relic.svg', { width: 160, height: 160 });
  for (const type of [
    'chain',
    'seal',
    'exit',
    'seal-ruby',
    'seal-sapphire',
    'seal-emerald',
    'lantern',
    'survey',
  ])
    scene.load.svg(`tile-${type}`, `/art/obstacles/${type}.svg`, { width: 160, height: 160 });
  scene.load.svg('bonus-atlas', '/art/bonuses/atlas.svg', {
    width: BONUS_FRAME_SIZE * BONUS_FRAME_COUNT,
    height: BONUS_FRAME_SIZE * BONUS_TYPES.length,
  });
  for (const type of ['tnt', 'color-wand', 'clear-row', 'shuffle', 'tile-breaker'])
    scene.load.svg(`power-${type}`, `/art/powers/${type}.svg`, { width: 192, height: 192 });
  for (const type of ['stone', 'reinforced', 'cracked'])
    scene.load.svg(`block-${type}`, `/art/blocks/${type}.svg`, { width: 160, height: 160 });
  for (const type of ['frost', 'cracked'])
    scene.load.svg(`ice-${type}`, `/art/ice/${type}.svg`, { width: 160, height: 160 });
}

export function loadSpriteAtlas(scene) {
  const textures = Object.fromEntries(GEM_TYPES.map((type) => [type, { key: `gem-${type}` }]));
  textures.relic = { key: 'gem-relic' };
  const atlas = scene.textures.get('bonus-atlas');
  BONUS_TYPES.forEach((type, row) => {
    const frames = Array.from({ length: BONUS_FRAME_COUNT }, (_, frame) => {
      const name = `${type}-${frame}`;
      if (!atlas.has(name))
        atlas.add(
          name,
          0,
          frame * BONUS_FRAME_SIZE,
          row * BONUS_FRAME_SIZE,
          BONUS_FRAME_SIZE,
          BONUS_FRAME_SIZE,
        );
      return { key: 'bonus-atlas', frame: name };
    });
    const animation = `bonus-${type}`;
    if (!scene.anims.exists(animation))
      scene.anims.create({
        key: animation,
        frames,
        frameRate: type === 'rainbow' ? 12 : 10,
        repeat: -1,
      });
    textures[type] = { key: 'bonus-atlas', frame: `${type}-0`, animation };
  });
  return { textures };
}

export const GEM_COLORS = {
  ruby: 0xff5187,
  sapphire: 0x6098ff,
  emerald: 0x38efb1,
  topaz: 0xffcc58,
  amethyst: 0xc883ff,
  moonstone: 0x79f1f6,
  bomb: 0xffa14f,
  cross: 0x7debff,
  rainbow: 0xdcc0ff,
  relic: 0xffdf7a,
};
