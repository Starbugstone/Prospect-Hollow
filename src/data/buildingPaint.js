import { eraEvolution } from './eras';
import { cityAppearance } from './cityAppearance';
import { cozyAppearance } from './cozyArchitecture';
import { ROUNDED_PALETTE } from './roundedArchitecture';

// Semantic palette adapter for older procedural art. New art should name its
// paintable parts, or use an era palette, rather than add per-building controls.
const SOURCES = {
  walls: [
    '#d6a08a',
    '#b17b5b',
    '#c09a70',
    '#d7b46c',
    '#93aaa7',
    '#c59376',
    '#a96f52',
    '#b49466',
    '#ceb274',
    '#7e9b9b',
    '#c9b18a',
    '#8c9e91',
    '#b2af94',
    '#bd977b',
    '#8ca39a',
    '#a8785b',
    '#c8b383',
    '#a3b4a4',
    '#a5624f',
    '#9d9484',
    '#ad725c',
    '#bba17a',
    '#c3ae8e',
    '#aa9374',
    '#a97b5e',
    '#ad795c',
    '#b06e58',
    '#aa795c',
    '#bc9875',
  ],
  roof: [
    '#658580',
    '#937447',
    '#526e79',
    '#526e75',
    '#648880',
    '#738f87',
    '#8b9d91',
    '#658779',
    '#b97e5e',
    '#ecdfb9',
    '#f1dfb3',
    '#6d8280',
    '#647c7c',
  ],
  secondary: [
    '#ad8e79',
    '#bb9c78',
    '#a18e6c',
    '#899c98',
    '#aaa28b',
    '#ac937b',
    '#b6a78b',
    '#8c9990',
    '#aeab90',
    '#976f57',
    '#849b91',
    '#beaa85',
    '#9daa9b',
    '#8b9b96',
    '#698e8c',
    '#b7ae98',
    '#c2b28b',
  ],
  trim: [
    '#e8d3a7',
    '#e0cfac',
    '#d2c3a3',
    '#d3c9a7',
    '#c9ba99',
    '#d6c9ad',
    '#ece0b7',
    '#657d79',
    '#81918b',
    '#68776d',
    '#526e70',
  ],
  accent: [
    '#65533b',
    '#657783',
    '#514d37',
    '#987443',
    '#8d6844',
    '#aa8454',
    '#9b7852',
    '#b88952',
    '#aa9877',
  ],
};
// Industrial meshes and their SVG previews use their own masonry palette.
// Keep these mappings together so the preview and the town paint the same surfaces.
const INDUSTRIAL_SOURCES = {
  walls: ['#aa795f', '#b59478', '#b57560', '#b6a38b', '#bd9678', '#b6b39a', '#b37e65', '#bcaa91'],
  roof: ['#53726d', '#56786e', '#527b70', '#66877b'],
  secondary: ['#c29a7a', '#8e7766', '#aa735c', '#956b55', '#bb997c', '#917d69'],
  trim: ['#dfcba4', '#dcc0a0', '#ede0bc', '#dbc5a0', '#d0a084'],
  accent: ['#506e67'],
};
const INDUSTRIAL = Object.fromEntries(
  Object.entries(INDUSTRIAL_SOURCES).flatMap(([role, values]) => values.map((v) => [v, role])),
);
const LEGACY = Object.fromEntries(
  Object.entries(SOURCES).flatMap(([role, values]) => values.map((v) => [v, role])),
);
const NAMES = [
  ['roof', /roof|canopy|awning|gable|shingle/i],
  ['trim', /trim|frame|cornice|railing|balustrade|mullion/i],
  ['accent', /door|shutter|accent/i],
  ['secondary', /brick|wing|cladding|timber/i],
  ['walls', /wall|facade|façade|shell|plaster/i],
];
const PROTECTED =
  /glass|windowpane|foliage|leaf|leaves|grass|water|soil|ground|paving|road|light|bulb|sign|wheel|vehicle/i;
export function buildingPaintRole(colour, name = '', era = 'frontier') {
  if (PROTECTED.test(name)) return null;
  const named = NAMES.find(([, pattern]) => pattern.test(name));
  if (named) return named[0];
  if (era === 'industrial' && INDUSTRIAL[colour.toLowerCase()])
    return INDUSTRIAL[colour.toLowerCase()];
  const profile = eraEvolution(era);
  const p =
    profile.architecture === 'cozy'
      ? cozyAppearance(era).palette
      : profile.architecture === 'rounded'
        ? ROUNDED_PALETTE
        : cityAppearance(era);
  const roles = {
    walls: p.wall ?? p.shell,
    roof: p.roof ?? p.accent,
    secondary: p.brick ?? p.timber ?? p.warm,
    trim: p.deep,
    accent: p.flower,
  };
  if (profile.style === 'city') {
    const role = Object.entries(roles).find(([, source]) => source === colour);
    if (role) return role[0];
  }
  return LEGACY[colour.toLowerCase()] ?? null;
}
