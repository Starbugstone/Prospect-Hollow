// A visitor transport publishes its actual stopped vehicle and arrival cycle.
// Entrance routes use offsets from the building plot; destinations use the
// existing pedestrian street graph. Add a source here and register its motion.
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
};
export const VISITOR_TRANSPORTS = Object.keys(VISITOR_ARRIVAL_SITES);
export const hasVisitorTransport = (town) =>
  VISITOR_TRANSPORTS.some((id) => town.buildings[id] > 0);
