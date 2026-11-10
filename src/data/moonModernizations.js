// What a Moon building becomes when an era modernizes it: its new name and one line for
// each of the three upgrade levels, matching what the art adds (buildings/moonFinishes.js).
// `outerRovers` is the upgrade level from which that many rovers also drive the outer ring.
// Keyed by era, then building. A Moon building an era modernizes without an entry here
// falls back to the era's own upgrade lines.
export const MOON_MODERNIZATIONS = Object.freeze({
  'hollow-rising': Object.freeze({
    ribbonLanding: {
      name: 'Ribbon terminal',
      steps: [
        'Add a second berth, with a spare climber waiting beside the ribbon.',
        'Cover a tram halt beside the berths, so riders change in the dry.',
        'Raise a glazed control ring round the tower and a second shelter.',
      ],
    },
    craterIceWell: {
      name: 'Deep ice works',
      steps: [
        'Raise a drill derrick over the well to reach the deep ice.',
        'Lay a work deck and a main from the drill to the tank.',
        'Add a vent stack, a meltwater sight tank and lights on the derrick crown.',
      ],
    },
    earthlightGreenhouse: {
      name: 'Double greenhouse',
      steps: [
        'Join a second glass vault across the end of the greenhouse.',
        'Plant fruit trees in the new wing and glaze a lantern along its ridge.',
        'Add an irrigation tank and grow lights for the long lunar night.',
      ],
    },
    newHollowCommons: {
      name: 'New Hollow town hall',
      steps: [
        'Build a columned porch with a pediment and steps either side of the door.',
        'Crown the hall with a cupola and a bell for town meetings.',
        'Add a clock, a gold band under the eaves, lamps and planters.',
      ],
    },
    roverBarn: {
      name: 'Rover depot',
      steps: [
        'Open a second bay for the growing rover fleet.',
        'Add a charging pylon and lamps along the ridge.',
        'Park an expedition rover by a flagged mast. Rovers start driving the outer ring.',
      ],
      outerRovers: { from: 3, count: 2 },
    },
  }),
});

/** A Moon building's modernization in `era`, `{ name, steps }`, or null. */
export const moonModernization = (era, kind) => MOON_MODERNIZATIONS[era]?.[kind] ?? null;

/** Rovers on the outer ring: those of the rover barn's finish once it is upgraded enough. */
export function outerRingRovers(town) {
  const rovers = moonModernization(town?.buildingEras?.roverBarn, 'roverBarn')?.outerRovers;
  return town?.buildings?.roverBarn &&
    rovers &&
    (town.buildingEraLevels?.roverBarn ?? 0) >= rovers.from
    ? rovers.count
    : 0;
}
