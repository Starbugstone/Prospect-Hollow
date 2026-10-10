import { eraEvolution } from './eras';

// New Hollow, the homesteads on the Moon, grows with the supplies the town sends up
// the space elevator. It is presentation only: no coins, timers or failure.
export const MOON_SETTLEMENT_LIMIT = 24;
// Two homesteads per elevator level, then one for every four modernization levels
// completed in a supply era (an era whose `moonSettlement` capability is on).
export function moonSettlement(town) {
  const elevator = town?.buildings?.spaceElevator ?? 0;
  if (!elevator) return { homesteads: 0, lights: [] };
  const levels = Object.entries(town.buildingEras ?? {}).reduce(
    (sum, [id, era]) =>
      eraEvolution(era).moonSettlement && id !== 'spaceElevator'
        ? sum + (town.buildingEraLevels?.[id] ?? 0)
        : sum,
    0,
  );
  const homesteads = Math.min(MOON_SETTLEMENT_LIMIT, elevator * 2 + Math.floor(levels / 4));
  return { homesteads, lights: MOON_LIGHTS.slice(0, homesteads) };
}

// Settlement positions on a unit Moon disc (x, y in -1..1), spread by the golden
// angle so a growing settlement fills the face evenly. Stable for every save.
const MOON_LIGHTS = Array.from({ length: MOON_SETTLEMENT_LIMIT }, (_, n) => {
  const radius = 0.82 * Math.sqrt((n + 0.5) / MOON_SETTLEMENT_LIMIT),
    angle = n * 2.39996;
  return Object.freeze({
    x: Math.round(Math.cos(angle) * radius * 1000) / 1000,
    y: Math.round(Math.sin(angle) * radius * 1000) / 1000,
    // Lights twinkle out of step with each other.
    delay: (n * 0.37) % 2.4,
  });
});

// Lots on the Moon map, in the Moon scene's own coordinates. The ribbon lands in
// the middle of the crater; the camera looks across it toward the risen Earth.
// Four lots ring the landing inside the ring road (radius MOON_RING_ROAD); six
// more stand beyond it.
export const MOON_LOTS = Object.freeze({
  ribbonLanding: Object.freeze([0, -8]),
  newHollowCommons: Object.freeze([0, 11]),
  settlerDomes: Object.freeze([-12, 2]),
  craterIceWell: Object.freeze([12, 2]),
  craterHomesteads: Object.freeze([-27, -12]),
  earthlightGreenhouse: Object.freeze([27, -12]),
  willowkinDome: Object.freeze([-15, 27]),
  moonstoneWorkshop: Object.freeze([15, 27]),
  earthriseLookout: Object.freeze([-30, 12]),
  roverBarn: Object.freeze([30, 12]),
});
export const MOON_RING_ROAD = 20.5;
// Lots sit inside a crater bowl; footprints stay within this radius of a lot.
export const MOON_LOT_RADIUS = 5;
export const MOON_CRATER_RADIUS = 46;

// Letters home from New Hollow, one for each finished Moon building. They are
// derived from building levels, so nothing new is saved.
const LETTERS = {
  ribbonLanding: 'The first climber landed softly. We waved at the valley the whole way down.',
  settlerDomes: 'Our dome is cozy and round. The children say Earth is the best nightlight.',
  craterIceWell: 'We melted our first bucket of crater ice. It tastes like the old town well.',
  earthlightGreenhouse: 'Your valley seeds have sprouted. The tomatoes grow sideways toward Earth.',
  willowkinDome:
    'A Willowkin sapling unfurled its first leaf on the Moon. The whole crater cheered.',
  newHollowCommons: 'We held our first town meeting. Everyone voted for more pie.',
  craterHomesteads: 'New porches on the crater rim, just like the frontier stories.',
  moonstoneWorkshop: 'We are polishing moonstones for every family back home.',
  roverBarn: 'The rovers are ready for picnics. Bring a blanket when you visit.',
  earthriseLookout: 'From the lookout we can see the valley lights. Goodnight, Prospect Hollow.',
};
export const moonLetters = (town) =>
  Object.entries(LETTERS)
    .filter(([id]) => (town?.buildings?.[id] ?? 0) > 0)
    .map(([id, text]) => ({ id, text }));
// Moonstone keepsakes, one for each finished Moon building level. Purely cosmetic.
export const moonstoneKeepsakes = (town) =>
  Object.keys(MOON_LOTS).reduce((sum, id) => sum + (town?.buildings?.[id] ?? 0), 0);
