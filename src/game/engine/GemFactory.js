// The original six gems, still the default palette when a level gives none.
export const BASE_GEM_TYPES = Object.freeze([
  'ruby',
  'sapphire',
  'emerald',
  'topaz',
  'amethyst',
  'moonstone',
]);
// Every gem the board recognizes. Later gems only appear in the color sets of later
// chapters; a board never holds more than its chapter's five colors.
export const GEM_TYPES = Object.freeze([...BASE_GEM_TYPES, 'peridot', 'starmetal']);
let gemIdCounter = 0;

export const createGem = (type, { highlight = false } = {}) => ({
  id: `gem-${(gemIdCounter++).toString(36)}`,
  type,
  highlight,
});

export const randomGemType = (types = BASE_GEM_TYPES) =>
  types[Math.floor(Math.random() * types.length)];
