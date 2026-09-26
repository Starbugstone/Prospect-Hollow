// Resolver state belongs to the texture manager, never to a global board session.
export function spriteRef(logicalId, textures) {
  const atlas = /^(bomb|rainbow|cross)-\d+$/.test(logicalId)
    ? 'board-bonus'
    : /^gem-(cut|geode)-/.test(logicalId)
      ? `gems-${logicalId.split('-')[1]}`
      : /^gem-/.test(logicalId) && logicalId !== 'gem-relic'
        ? 'gems-classic'
        : 'board-core';
  if (textures?.exists?.(atlas) && textures.get(atlas).has(logicalId))
    return { key: atlas, frame: logicalId };
  if (/^(bomb|rainbow|cross)-\d+$/.test(logicalId)) return { key: 'bonus-atlas', frame: logicalId };
  return { key: logicalId, frame: undefined };
}
