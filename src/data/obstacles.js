import { mineSignalAppearance, mineRelicAppearance } from './mineThemes';
export const OBSTACLES = [
  {
    id: 'fossil',
    name: 'Buried fossils',
    art: '/art/obstacles/fossil.svg',
    instruction:
      'Match on the dust to uncover the fossil beneath the gems. Clear every patch in its outline and it collects automatically. Two dust layers take two hits; bonuses clear dust too.',
    present: (tile) => tile.fossilGroup != null,
  },
  {
    id: 'root-knot',
    name: 'Root knots',
    art: '/art/obstacles/root-knot.svg',
    instruction:
      'Match directly beside a root knot, or hit it with a bonus, to cut it and release all its connected vines. Knots marked 2 take two hits. Vine-bound gems can match in place, like chained gems.',
    present: (tile) => tile.rootKnot === true,
  },
  {
    id: 'lantern',
    name: 'Lanterns',
    art: '/art/obstacles/lantern.svg',
    instruction:
      'Light every lantern by matching on or beside it. Bonuses can light them too; gems pass freely.',
    present: (tile) => tile.signal === 'lantern',
  },
  {
    id: 'survey',
    name: 'Survey trail',
    art: '/art/obstacles/survey.svg',
    instruction:
      'Light the numbered survey markers in order. Match on or beside the next number; gems keep moving freely.',
    present: (tile) => tile.signal === 'survey',
  },
  {
    id: 'ore-orders',
    name: 'Ore orders',
    art: '/art/obstacles/ore-orders.svg',
    instruction:
      'Fill the pictured ore orders by collecting those gem colors. Matching and bonuses both count.',
    present: (tile) => tile.oreOrderGuide === true,
  },
  {
    id: 'charge-core',
    name: 'Charge core',
    art: '/art/obstacles/core.svg',
    instruction:
      'Match on or beside the core to charge it, one charge per move. When every pip is lit, it releases a free bonus gem. Gems pass freely.',
    present: (tile) => tile.signal === 'core',
  },
  {
    id: 'ice',
    name: 'Ice',
    art: '/art/ice/frost.svg',
    instruction: 'Match gems on the frosted tile to remove the ice beneath them.',
    present: (tile) =>
      tile.type !== 'blocker' && !tile.sealColor && tile.fossilGroup == null && tile.health === 1,
  },
  {
    id: 'stone',
    name: 'Stone',
    art: '/art/blocks/stone.svg',
    instruction:
      'Match directly beside stone, or hit it with a bonus. Diagonal matches do not count. Breaking stone lets the column refill.',
    present: (tile) => tile.type === 'blocker' && !tile.rootKnot && tile.maxHealth < 2,
  },
  {
    id: 'double-ice',
    name: 'Double ice',
    art: '/art/ice/frost.svg',
    instruction: 'Match on this tile twice. The first hit cracks the ice; the second clears it.',
    present: (tile) =>
      tile.type !== 'blocker' && !tile.sealColor && tile.fossilGroup == null && tile.health > 1,
  },
  {
    id: 'reinforced',
    name: 'Reinforced stone',
    art: '/art/blocks/reinforced.svg',
    instruction:
      'Gold-banded stone needs two hits from adjacent matches or bonuses. A fusion can deal both hits at once.',
    present: (tile) => tile.type === 'blocker' && !tile.rootKnot && tile.maxHealth >= 2,
  },
  {
    id: 'frozen',
    name: 'Frozen gem',
    art: '/art/ice/frost.svg',
    instruction:
      'This gem cannot move yet. Clear a neighboring gem to thaw it, then match on its ice.',
    present: (tile) => tile.state === 'FROZEN',
  },
  {
    id: 'chain',
    name: 'Chained gem',
    art: '/art/obstacles/chain.svg',
    instruction:
      'Match two gems with the chained gem to release it, or hit it with a bonus. It stays in place while other gems fall past. Then clear any ice underneath.',
    present: (tile) => tile.chainHealth > 0 && tile.rootGroup == null,
  },
  ...[
    ['ruby', 'Ruby seal', 'R'],
    ['sapphire', 'Sapphire seal', 'S'],
    ['emerald', 'Emerald seal', 'E'],
  ].map(([color, name, mark]) => ({
    id: `seal-${color}`,
    name,
    art: `/art/obstacles/seal-${color}.svg`,
    instruction: `Match ${color} gems on the ${mark} seal, or hit it with any bonus. Other colors can move through but will not open it.`,
    present: (tile) => tile.health > 0 && tile.sealColor === color,
  })),
  {
    id: 'relic',
    name: 'Lost relic',
    art: '/art/relic.svg',
    instruction:
      'Clear gems below the golden relic so it falls through a marked exit at the bottom. Relics cannot be swapped or destroyed. Collect them all to finish.',
    present: (tile) => tile.exit,
  },
];
export const obstaclesInLevel = (tiles, theme) =>
  OBSTACLES.filter((obstacle) => tiles.some((tile) => tile && obstacle.present(tile))).map(
    (obstacle) => {
      const skin =
        obstacle.id === 'relic'
          ? mineRelicAppearance(theme)
          : mineSignalAppearance(theme, obstacle.id === 'charge-core' ? 'core' : obstacle.id);
      return skin ? { ...obstacle, ...skin } : obstacle;
    },
  );
