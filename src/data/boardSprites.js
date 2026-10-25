import { OBSTACLES } from './obstacles.js';
import { POWERS } from './campaign.js';

// The board's core sprites. One catalog drives both build-time rasterization
// (scripts/generate-board-atlas.mjs) and the SVG fallback (SpriteLoader). Obstacles and
// powers come from their own definitions, so a new one needs no edit here.
const artFile = (art) => art.replace(/^\/art\//, '');
const unique = (entries) => [...new Map(entries)];

// [texture key, file under public/art/], including the relic's own gem. The plain seal,
// the relic exit and the cracked stages of blocks and ice belong to no single obstacle.
export const OBSTACLE_SPRITES = unique([
  ['tile-seal', 'obstacles/seal.svg'],
  ['tile-exit', 'obstacles/exit.svg'],
  ...OBSTACLES.filter(({ texture }) => texture).map(({ texture, art }) => [texture, artFile(art)]),
  ['block-cracked', 'blocks/cracked.svg'],
  ['ice-cracked', 'ice/cracked.svg'],
]);
export const POWER_SPRITES = POWERS.map(({ id }) => [`power-${id}`, `powers/${id}.svg`]);
// Rows of /art/bonuses/atlas.svg, top to bottom: the board bonuses' animation frames.
export const BONUS_ATLAS_ROWS = Object.freeze(['bomb', 'rainbow', 'cross']);
