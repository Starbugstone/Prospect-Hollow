import { GEM_TYPES } from '../engine/GemFactory';
import frames from '../../assets/board/frames.json';
import coreUrl from '../../assets/board/board-core.png';
import bonusUrl from '../../assets/board/board-bonus.png';
import classicUrl from '../../assets/board/gems-classic.png';
import cutUrl from '../../assets/board/gems-cut.png';
import geodeUrl from '../../assets/board/gems-geode.png';
import { spriteRef } from './spriteRefs';
import { performanceMark } from '../PresentationWork';
import { gemFinish, GEM_FINISHES } from '../../data/gemAppearance';

export const BONUS_TYPES = ['bomb', 'rainbow', 'cross'];
const BONUS_FRAME_SIZE = 192;
const BONUS_FRAME_COUNT = 8;

// Vector art is rasterized at build time; failed atlases recover through the source SVGs.
const urls = {
  'board-core': coreUrl,
  'board-bonus': bonusUrl,
  'gems-classic': classicUrl,
  'gems-cut': cutUrl,
  'gems-geode': geodeUrl,
};
export function preloadSpriteAssets(scene, { levelId = 1 } = {}) {
  const keys = new Set(['board-core', 'board-bonus', 'gems-classic', `gems-${gemFinish(levelId)}`]);
  let fallback = false;
  const failed = (file) => {
    if (!keys.has(file.key) || fallback) return;
    fallback = true;
    preloadSvgAssets(scene);
  };
  scene.load.on('loaderror', failed);
  scene.load.once('complete', () => {
    scene.load.off('loaderror', failed);
    performanceMark('board-textures-ready');
  });
  for (const key of keys)
    if (!scene.textures.exists(key)) scene.load.atlas(key, urls[key], frames[key]);
}
export function preloadSvgAssets(scene) {
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
  const textures = Object.fromEntries(
    GEM_TYPES.map((type) => [type, spriteRef(`gem-${type}`, scene.textures)]),
  );
  textures.relic = spriteRef('gem-relic', scene.textures);
  const atlas = scene.textures.get(
    scene.textures.exists('board-bonus') ? 'board-bonus' : 'bonus-atlas',
  );
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
      return spriteRef(name, scene.textures);
    });
    const animation = `bonus-${type}`;
    if (!scene.anims.exists(animation))
      scene.anims.create({
        key: animation,
        frames,
        frameRate: type === 'rainbow' ? 12 : 10,
        repeat: -1,
      });
    textures[type] = { ...spriteRef(`${type}-0`, scene.textures), animation };
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
