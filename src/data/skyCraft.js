import { ROUNDED_PALETTE } from './roundedArchitecture';
import { COZY_PALETTES } from './cozyArchitecture';
import { FUTURE_PALETTES } from './futureArchitecture';
import { eraEvolution } from './eras';
import { moonSettlement } from './moonSettlement';

// The Moon hangs in the valley sky in this horizontal direction (x, z) from the town:
// north-west, above the mine and the space elevator. The sky Moon and the saucers that
// fly to it share this one direction.
export const SKY_MOON_DIRECTION = Object.freeze([-0.55, -1]);

/** The valley sky shows the Moon once New Hollow has homesteads. */
export const skyMoonShown = (town) => moonSettlement(town).homesteads > 0;

// The sky saucer evolves with the era its airport was modernized in. Each era takes its
// colours from its own architecture palette and adds one small trait drawn in a couple of
// meshes (see SAUCER_TRAITS in RoundedTransports.js). Colour roles: hull `shell`, rim band
// `rim`, dome `glass`, legs `deep`, rim lights and glow `light`, and the trait's `trait`.
const R = ROUNDED_PALETTE,
  { canopy: C, riverlight: L } = COZY_PALETTES,
  { sail: S, observatory: O, homestead: H, twin: T } = FUTURE_PALETTES;
const saucer = (shell, rim, glass, deep, light, trait = null, traitColor = light) =>
  Object.freeze({ shell, rim, glass, deep, light, trait, traitColor });

export const SKY_SAUCERS = Object.freeze({
  tomorrow: saucer(R.shell, R.accent, R.glass, R.deep, R.light),
  // A pair of leaves sprouts from the dome.
  canopy: saucer(C.shell, C.roof, C.glass, C.deep, C.light, 'leaves', C.green),
  // Lavender glass rim, a crystal finial and a little garden ring around the dome.
  riverlight: saucer(L.shell, L.roof, L.glass, L.deep, L.light, 'crystal', L.green),
  // Saffron sail fins and a pennant at the stern.
  skysail: saucer(S.shell, S.deep, S.glass, S.deep, S.light, 'sails', S.flower),
  // A night-blue hull with a copper rim, a copper dome band and a star on top.
  stargazer: saucer(O.roof, O.timber, O.glass, O.deep, O.light, 'star', O.timber),
  // Moon-white ceramic with gold trim and a gold landing beacon.
  moonward: saucer(H.shell, H.light, H.glass, H.deep, H.light, 'gold-trim', H.light),
  // Twin lanterns, teal for the valley and gold for the Moon. Twin Hollows does not
  // modernize the airport, so a real Twin Hollows town flies the Moonward saucer.
  'twin-hollows': saucer(T.shell, T.light, T.glass, T.deep, T.light, 'twin-lanterns', T.flower),
});

/** The saucer for an airport era; an era without its own flies the Tomorrow saucer. */
export const skySaucer = (era) =>
  Object.hasOwn(SKY_SAUCERS, era) ? SKY_SAUCERS[era] : SKY_SAUCERS.tomorrow;

/** Whether this airport's saucer flies to the Moon: its airport era supplies the Moon
 * settlement (the era's `moonSettlement` capability) and the sky shows the Moon. */
export const saucerFliesToMoon = (era, town) =>
  !!eraEvolution(era).moonSettlement && skyMoonShown(town);
