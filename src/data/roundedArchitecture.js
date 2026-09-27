import { CITY_FAMILIES } from './city';
import { eraEvolution } from './eras';

// Shared by the WebGL renderer and the SVG fallback. A small palette keeps each
// batched plot to a handful of materials, so rounded eras add no draw calls.
export const ROUNDED_PALETTE = Object.freeze({
  shell: '#ece5d3',
  accent: '#6d9f98',
  glass: '#a6d3d4',
  deep: '#4f6f78',
  green: '#8fb07a',
  light: '#f3dc92',
  warm: '#d99a82',
});

// Each city family keeps its purpose but takes a rounded form.
export const ROUNDED_FORMS = Object.freeze({
  residence: 'tower',
  civic: 'rotunda',
  retail: 'vault',
  depot: 'hangar',
  water: 'tanks',
  station: 'tube',
  culture: 'shell',
  research: 'geodesic',
  farm: 'greenhouse',
  river: 'pavilion',
  park: 'garden',
  field: 'garden',
  radio: 'mast',
  concert: 'shell',
  television: 'orb',
  skyline: 'spire',
});

export const isRoundedEra = (era) => eraEvolution(era).architecture === 'rounded';
/** The rounded form for a building kind, or null when another renderer owns it. */
export const roundedForm = (kind) =>
  Object.hasOwn(ROUNDED_FORMS, CITY_FAMILIES[kind]) ? ROUNDED_FORMS[CITY_FAMILIES[kind]] : null;
