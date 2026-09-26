import { eraEvolution } from './eras';

// Town square centerpieces, oldest first. The era profile's `fountain` capability picks
// one; the 3D renderer and the SVG fallback both register a drawing for every id.
export const FOUNTAIN_DESIGNS = Object.freeze([
  'frontier-spring',
  'victorian-iron',
  'civic-monument',
  'memorial-obelisk',
  'art-deco',
  'mid-century',
  'postmodern',
  'splash-plaza',
]);
/** Unknown or missing designs fall back to the original frontier spring. */
export const resolveFountain = (id) => (FOUNTAIN_DESIGNS.includes(id) ? id : FOUNTAIN_DESIGNS[0]);
export const fountainDesign = (era) => resolveFountain(eraEvolution(era).fountain);
