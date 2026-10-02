// Resolver state belongs to the texture manager, never to a global board session.
import { DEEP_MINE_SPRITES } from '../../data/mineThemes';
const deepSprites = new Set(DEEP_MINE_SPRITES.map(([id]) => id));
export function spriteRef(logicalId, textures) {
  const atlas = /^(bomb|rainbow|cross)-\d+$/.test(logicalId)
    ? 'board-bonus'
    : /^gem-(cut|geode)-/.test(logicalId)
      ? `gems-${logicalId.split('-')[1]}`
      : /^gem-/.test(logicalId) && logicalId !== 'gem-relic' && !deepSprites.has(logicalId)
        ? 'gems-classic'
        : 'board-core';
  if (textures?.exists?.(atlas) && textures.get(atlas).has(logicalId))
    return { key: atlas, frame: logicalId };
  if (/^(bomb|rainbow|cross)-\d+$/.test(logicalId)) return { key: 'bonus-atlas', frame: logicalId };
  return { key: logicalId, frame: undefined };
}
