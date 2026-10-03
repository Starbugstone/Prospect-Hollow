import { CITY_FAMILIES } from './city';
import { eraEvolution } from './eras';

// Shared by the permanent town, mine site and accessible SVG map. Eight opaque
// materials keep each static plot batch small; lanterns do not add real lights.
export const COZY_PALETTES = Object.freeze({
  canopy: Object.freeze({
    shell: '#efe5ce',
    roof: '#9db398',
    glass: '#a9ccc4',
    deep: '#577c72',
    green: '#80a17c',
    timber: '#c5a46e',
    flower: '#e8b29b',
    light: '#f0d28d',
  }),
  riverlight: Object.freeze({
    shell: '#f0e5cf',
    roof: '#b5a8c5',
    glass: '#afcfca',
    deep: '#64857d',
    green: '#8aa681',
    timber: '#c8a772',
    flower: '#dfb0a1',
    light: '#f1ce85',
  }),
});

const FORMS = Object.freeze({
  residence: 'homes',
  civic: 'hall',
  retail: 'arcade',
  depot: 'workshop',
  water: 'watergarden',
  station: 'concourse',
  culture: 'gallery',
  research: 'atrium',
  farm: 'greenhouse',
  river: 'landing',
  park: 'garden',
  field: 'garden',
  radio: 'mast',
  concert: 'auditorium',
  television: 'studio',
  skyline: 'skyterraces',
  square: 'square',
});

export const COZY_LANDMARKS = Object.freeze({
  teaHouse: Object.freeze({ form: 'teahouse', scale: 1.2 }),
  blossomAtelier: Object.freeze({ form: 'atelier', scale: 1.45 }),
  orchardCottages: Object.freeze({ form: 'orchard', scale: 1.25 }),
  glassworks: Object.freeze({ form: 'glassworks', scale: 1.35 }),
  springsRetreat: Object.freeze({ form: 'springs', scale: 1.45 }),
  riverlightPavilion: Object.freeze({ form: 'pavilion', scale: 1.6 }),
});

export const isCozyEra = (era) => eraEvolution(era).architecture === 'cozy';

/** An incomplete successor safely inherits the garden palette. */
export function cozyAppearance(era) {
  const key = eraEvolution(era).cozyStyle;
  const style = Object.hasOwn(COZY_PALETTES, key) ? key : 'canopy';
  return { style, palette: COZY_PALETTES[style] };
}

/** Null leaves airport and bridge infrastructure to their shared renderer. */
export const cozyForm = (kind) =>
  COZY_LANDMARKS[kind]?.form ??
  (Object.hasOwn(FORMS, CITY_FAMILIES[kind]) ? FORMS[CITY_FAMILIES[kind]] : null);
