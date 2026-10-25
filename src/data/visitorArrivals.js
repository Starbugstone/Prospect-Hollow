import { HOME_SETTLEMENT, MOON_SETTLEMENT, settlementId } from './settlements';
// A visitor transport publishes its actual stopped vehicle and arrival cycle.
// Valley entrance routes use offsets from the building plot; destinations use the
// existing pedestrian street graph. A source in another settlement names it and walks
// that settlement's paths. Add a source here and register its motion.
export const VISITOR_ARRIVAL_SITES = {
  railDepot: {
    destination: 'school',
    approach: [
      [0, 1.5],
      [0, 3.5],
    ],
    height: 0.25,
  },
  riverPort: {
    destination: 'post',
    approach: [
      [2.3, 1.5],
      [2.3, 3.5],
      [0, 3.5],
    ],
    height: 0.07,
  },
  airport: {
    destination: 'park',
    approach: [
      [4.5, 1.25],
      [4.5, 2],
      [0, 2],
      [0, 3.5],
    ],
    // The lounge extends across the old forecourt; guests use its east exit.
    upgradedApproach: [
      [9, 4.5],
      [10.5, 4.5],
      [10.5, 3.5],
      [9, 3.5],
    ],
    cameraDirection: [0.85, 1.1, 0.85],
    height: 0.35,
  },
  // Guests from the Moon step off a climber at the west cargo dock.
  spaceElevator: {
    destination: 'square',
    approach: [
      [-3.6, 4.4],
      [-3.6, 7.5],
      [0, 7.5],
      [0, 11.5],
    ],
    cameraDirection: [0.7, 1.3, 0.9],
    height: 0.35,
  },
  // New Hollow's transports: guests ride a climber down the ribbon or land on the saucer
  // pad, then step out of the lot's hatch onto the public path (`moonApproaches`).
  ribbonLanding: { settlement: MOON_SETTLEMENT },
  saucerPad: { settlement: MOON_SETTLEMENT },
};
const ARRIVAL_SOURCES = Object.keys(VISITOR_ARRIVAL_SITES);
/** The visitor sources of one settlement, in their stable order. */
export const visitorTransports = (settlement) =>
  ARRIVAL_SOURCES.filter((id) => settlementId(VISITOR_ARRIVAL_SITES[id]) === settlement);
export const VISITOR_TRANSPORTS = visitorTransports(HOME_SETTLEMENT);
export const MOON_VISITOR_TRANSPORTS = visitorTransports(MOON_SETTLEMENT);
// Each source draws its own VIPs. Valley sources keep their seeds; later ones follow on.
export const arrivalSeed = (seed, id) => seed + ARRIVAL_SOURCES.indexOf(id) * 101;
// Valley visitors who walk in from the road become VIPs only without a valley transport.
export const hasVisitorTransport = (town) =>
  VISITOR_TRANSPORTS.some((id) => town.buildings[id] > 0);
