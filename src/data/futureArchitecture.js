import { CITY_FAMILIES } from './city';
import { COZY_LANDMARKS } from './cozyArchitecture';
import { eraEvolution } from './eras';

// The three eras after Riverlight share one set of building archetypes; each
// architecture supplies its own walls, roofs and finishing flourish. Palettes use
// the cozy colour roles, so paint, watermill, mine and SVG consumers read the same
// keys. Eight opaque colours keep every batched plot to eight materials or fewer.
export const FUTURE_PALETTES = Object.freeze({
  // Skysail: sailcloth, saffron and teal pennants over pale decking.
  sail: Object.freeze({
    shell: '#f3ecdc',
    roof: '#fbf6ea',
    glass: '#86c9c6',
    deep: '#3f6b7a',
    green: '#86ae7c',
    timber: '#c9a26b',
    flower: '#e8a64a',
    light: '#f4d98c',
  }),
  // Stargazer: night-blue ceramic, copper trim and starlight windows.
  observatory: Object.freeze({
    shell: '#d9dfef',
    roof: '#3f4f84',
    glass: '#8fd0cb',
    deep: '#283458',
    green: '#7fa38f',
    timber: '#c07a4e',
    flower: '#9c86d0',
    light: '#f5d77e',
  }),
  // Moonward: moon-white ceramic, gold foil, solar shingles and a barn-red porch.
  homestead: Object.freeze({
    shell: '#efebe2',
    roof: '#3d4c6d',
    glass: '#bfd6df',
    deep: '#5d6577',
    green: '#90aa7f',
    timber: '#b88757',
    flower: '#b85a44',
    light: '#e8b84a',
  }),
  // Twin Hollows homecoming: the homestead lines in softer silver-blue, with teal
  // and gold twin lanterns for the valley and the Moon.
  twin: Object.freeze({
    shell: '#f1eee6',
    roof: '#4d6283',
    glass: '#bcdde4',
    deep: '#55607a',
    green: '#8db383',
    timber: '#b88757',
    flower: '#3f8f8a',
    light: '#f0c45a',
  }),
});
// New Hollow on the Moon: moon-white ceramic, steel dome ribs, crater-ice glass,
// gold foil and the valley's barn red. Used by the Moon map and its drawings.
export const MOON_PALETTE = Object.freeze({
  shell: '#ece9e1',
  roof: '#7f8fa6',
  glass: '#a9dbe0',
  deep: '#4c5566',
  green: '#8fb58a',
  timber: '#b08a5a',
  flower: '#b85a44',
  light: '#e8b84a',
});
export const FUTURE_ARCHITECTURES = Object.freeze(Object.keys(FUTURE_PALETTES));

// Each city family keeps its purpose and takes the same archetype in every
// future architecture; the architecture decides how that archetype looks.
const FORMS = Object.freeze({
  residence: 'homes',
  civic: 'hall',
  retail: 'shop',
  depot: 'workshop',
  water: 'water',
  station: 'station',
  culture: 'culture',
  research: 'research',
  farm: 'farm',
  river: 'landing',
  park: 'garden',
  field: 'garden',
  radio: 'mast',
  concert: 'concert',
  television: 'studio',
  skyline: 'tower',
  square: 'square',
});

// Landmarks introduced by these eras draw their own bespoke forms.
export const FUTURE_LANDMARKS = Object.freeze({
  // Established garden landmarks retain their identity and parcel scale when
  // modernized. Successor kits supply the new architecture for these forms too.
  ...COZY_LANDMARKS,
  skyHarbour: Object.freeze({ form: 'skyHarbour', scale: 1.35 }),
  cloudOrchard: Object.freeze({ form: 'cloudOrchard', scale: 1.4 }),
  windsongLofts: Object.freeze({ form: 'windsongLofts', scale: 1.3 }),
  greatTelescope: Object.freeze({ form: 'greatTelescope', scale: 1.45 }),
  dewlightGardens: Object.freeze({ form: 'dewlightGardens', scale: 1.4 }),
  starlightTerraces: Object.freeze({ form: 'starlightTerraces', scale: 1.3 }),
  spaceElevator: Object.freeze({ form: 'spaceElevator', scale: 1 }),
  moonpost: Object.freeze({ form: 'moonpost', scale: 1.35 }),
  missionHomesteads: Object.freeze({ form: 'missionHomesteads', scale: 1.3 }),
  homecomingHall: Object.freeze({ form: 'homecomingHall', scale: 1.35 }),
});

// Mine portal crowns of the future eras. Each replaces the cozy petal canopy, so
// the mine changes with every era and stays within its static triangle budget.
export const FUTURE_MINE_PORTALS = Object.freeze([
  'sail-arch',
  'dome-arch',
  'homestead-arch',
  'twin-arch',
]);

export const isFutureEra = (era) => FUTURE_ARCHITECTURES.includes(eraEvolution(era).architecture);

/** An unsupported architecture safely falls back to the Skysail palette. */
export function futureAppearance(era) {
  const architecture = eraEvolution(era).architecture;
  const style = FUTURE_ARCHITECTURES.includes(architecture) ? architecture : 'sail';
  return { style, palette: FUTURE_PALETTES[style] };
}

/** Null leaves airport and bridge infrastructure to their shared renderer. */
export const futureForm = (kind) =>
  FUTURE_LANDMARKS[kind]?.form ??
  (Object.hasOwn(FORMS, CITY_FAMILIES[kind]) ? FORMS[CITY_FAMILIES[kind]] : null);
