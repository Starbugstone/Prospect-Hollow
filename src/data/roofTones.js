import { CITY_FAMILIES } from './city';
import { BUILDINGS } from './town';

// One town, several roofs. Each era keeps its own palette, but a building's purpose picks
// its roof tone from it: homes keep the era's roof, civic buildings wear a deeper one,
// shops a warm one and working buildings a plain one. A purpose keeps its tone family in
// every era, so the bank still reads as the bank after each modernization.
//
// A style lists the roof colours its renderer draws (`from`) and the tone of each role.
// Styles are keyed by the era's own capabilities (`roofStyle` below), so an era that
// reuses an architecture inherits its tones; an unknown style keeps the drawn roof.
const ROLES = Object.freeze({
  residence: 'home',
  civic: 'civic',
  culture: 'civic',
  research: 'civic',
  station: 'civic',
  retail: 'trade',
  depot: 'works',
  water: 'works',
  farm: 'works',
  river: 'works',
});
export const ROOF_ROLES = Object.freeze(['home', 'civic', 'trade', 'works']);
export const ROOF_STYLES = Object.freeze({
  frontier: {
    from: ['#937447', '#658580', '#648880'],
    home: '#658580',
    civic: '#5a7686',
    trade: '#a8644a',
    works: '#937447',
  },
  'river-rail': {
    from: ['#526e79', '#526e75'],
    home: '#526e79',
    civic: '#3f5868',
    trade: '#8f5547',
    works: '#6f7468',
  },
  industrial: {
    from: ['#53726d'],
    home: '#53726d',
    civic: '#3f5d6b',
    trade: '#96574a',
    works: '#676c63',
  },
  'post-war': {
    from: ['#638b88'],
    home: '#638b88',
    civic: '#4f7286',
    trade: '#b0735c',
    works: '#84907c',
  },
  'motor-age': {
    from: ['#638b88'],
    home: '#638b88',
    civic: '#557a93',
    trade: '#b97a5b',
    works: '#8a9479',
  },
  aviation: {
    from: ['#648d89'],
    home: '#648d89',
    civic: '#5b86a6',
    trade: '#cf8a72',
    works: '#92a088',
  },
  broadcast: {
    from: ['#526775'],
    home: '#526775',
    civic: '#3d5676',
    trade: '#a65f72',
    works: '#6f7779',
  },
  contemporary: {
    from: ['#638b88'],
    home: '#638b88',
    civic: '#4a7a92',
    trade: '#bd8458',
    works: '#7d9186',
  },
  rounded: {
    from: ['#6d9f98'],
    home: '#6d9f98',
    civic: '#5f8fb3',
    trade: '#d6a468',
    works: '#8fb07a',
  },
  canopy: {
    from: ['#9db398'],
    home: '#9db398',
    civic: '#6f9488',
    trade: '#e2ab93',
    works: '#c5a46e',
  },
  riverlight: {
    from: ['#b5a8c5'],
    home: '#b5a8c5',
    civic: '#8597b8',
    trade: '#dfb0a1',
    works: '#c8a772',
  },
  observatory: {
    from: ['#3f4f84'],
    home: '#3f4f84',
    civic: '#2c3a66',
    trade: '#7c68b4',
    works: '#5c6992',
  },
  homestead: {
    from: ['#3d4c6d'],
    home: '#3d4c6d',
    civic: '#56709c',
    trade: '#a9523f',
    works: '#5d6577',
  },
  twin: {
    from: ['#4d6283'],
    home: '#4d6283',
    civic: '#3a4d72',
    trade: '#3f8f8a',
    works: '#6a7590',
  },
});
// Architectures that already fly several roof colours of their own.
export const OWN_ROOF_COLOURS = Object.freeze(['sail']);
/** The style an era's roofs are drawn in, from its capabilities rather than its name. */
export function roofStyle(profile) {
  if (!profile) return null;
  // `architecture` is 'standard' for the period shells, which draw the era's own assets.
  const architecture = profile.architecture === 'standard' ? null : profile.architecture;
  const key =
    profile.cozyStyle ??
    architecture ??
    (profile.style === 'city' ? profile.cityAssets : profile.style);
  return typeof key === 'string' && Object.hasOwn(ROOF_STYLES, key) ? key : null;
}
/** The roof role of a building kind, or null for kinds with no roofed shell of their own. */
export const roofRole = (kind) =>
  Object.hasOwn(CITY_FAMILIES, kind) && Object.hasOwn(ROLES, CITY_FAMILIES[kind])
    ? ROLES[CITY_FAMILIES[kind]]
    : null;

// Plots sharing a kind (Home, Home II, Home III) are told apart by a shade of their tone.
const SHADES = [0, 0.07, -0.06, 0.035, -0.03];
const siblings = new Map();
for (const { id, kind } of BUILDINGS) {
  if (!siblings.has(kind)) siblings.set(kind, []);
  siblings.get(kind).push(id);
}
/** Which of its kind a plot is: 0 for Home, 1 for Home II and so on. */
export const plotVariant = (id, kind) => Math.max(0, siblings.get(kind)?.indexOf(id) ?? 0);
export const plotShade = (id, kind) =>
  SHADES[Math.max(0, siblings.get(kind)?.indexOf(id) ?? 0) % SHADES.length];

const channel = (value) => Math.max(0, Math.min(255, Math.round(value)));
/** `color` lightened (positive) or darkened (negative) by a share of the way to white/black. */
export function shade(color, amount) {
  if (!amount) return color;
  const n = parseInt(color.slice(1), 16);
  const mix = (c) => channel(amount > 0 ? c + (255 - c) * amount : c * (1 + amount));
  const rgb = [mix(n >> 16), mix((n >> 8) & 255), mix(n & 255)];
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
/**
 * How to repaint one plot's roof: the drawn colours to replace and the tone that replaces
 * them. Null leaves the roof as drawn (an unknown style or a kind without a role).
 */
export function roofTone(profile, id, kind) {
  const style = roofStyle(profile),
    role = roofRole(kind);
  if (!style || !role) return null;
  const tones = ROOF_STYLES[style];
  return { from: tones.from, to: shade(tones[role], plotShade(id, kind)), role, style };
}
/**
 * The roof colour a drawing should use: the tone of the plot's purpose, or `drawn` when the
 * era or the kind has none. The 2D map and building cards read it, so they agree with the
 * 3D town. `id` may be omitted (a card with no plot); the kind's first plot is used.
 */
export const roofPaint = (profile, id, kind, drawn) =>
  roofTone(profile, id ?? kind, kind)?.to ?? drawn;
