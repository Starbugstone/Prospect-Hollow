// Commissions: New Hollow asks for something, the player chooses what it becomes, and the
// settlers use the result. Each is an ordinary monument site (`townLandmarks.js` owns its
// position, designs, prices and opening) plus this one entry: who writes, what they ask
// and how each permanent outcome changes who visits. A new commission needs its site, its
// designs and art, and an entry here; none of them gates an era or puzzle.
//
// `visits` counts how many of a resident's three daily trips go to the finished place.
export const MOON_COMMISSIONS = Object.freeze([
  Object.freeze({
    site: 'earthlight-conservatory',
    writer: 'The greenhouse keepers',
    request:
      'The Earthlight greenhouse has outgrown its glass. The Willowkin want an orchard, the prospectors want a crystal nursery and everyone wants more pie. There is room for one. What should we build?',
    outcomes: Object.freeze({
      'earthlight-orchard': Object.freeze({
        thanks:
          'The first Earthlight orchard is in leaf. The Willowkin hardly come home now, and the fruit grows sideways toward you.',
        visits: Object.freeze({ settler: 1, willowkin: 3 }),
      }),
      'crystal-nursery': Object.freeze({
        thanks:
          'The nursery is humming. We plant a chip of moonstone in the evening and find a crystal the next morning.',
        visits: Object.freeze({ settler: 2, willowkin: 0 }),
      }),
      'earthlight-bakehouse': Object.freeze({
        thanks:
          'The bakehouse oven is lit. The whole crater smells of pie, and nobody has eaten at home since.',
        visits: Object.freeze({ settler: 3, willowkin: 1 }),
      }),
    }),
  }),
]);
export const moonCommission = (siteId) =>
  MOON_COMMISSIONS.find(({ site }) => site === siteId) ?? null;
