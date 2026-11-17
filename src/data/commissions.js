import {
  AREA_BY_ID,
  areaChoice,
  areaMaximum,
  areaShownStage,
  areaStage,
  areaUnlocked,
  monumentWork,
} from './townLandmarks';

// Commissions: a settlement asks for something, the player chooses what it becomes, and
// its residents use the result. Each is an ordinary monument site (`townLandmarks.js` owns
// its position, designs, prices and opening) plus this one entry: who writes, what they
// ask and how each permanent outcome changes who visits. A new commission needs its site,
// its designs and art, and an entry here; none of them gates an era or puzzle.
//
// `visits` depends on the settlement. On the Moon it counts how many of a resident's three
// daily trips go to the finished place. In the valley `resident` and `wild` count the extra
// Willowkin and animals around the finished site, and `villager` the townsfolk who walk
// there from their homes.
//
// `use` is what residents do there, read through `commissionUse` in both settlements:
// `stay` is `enter` (in through its door, out again later), `gather` (stand before it as an
// audience) or `roam` (wander its grounds); `carry` is what they bring home; `young` sends
// the town's children. A commission without `use` has its visitors gather at the front.
export const COMMISSIONS = Object.freeze([
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
        use: Object.freeze({ stay: 'enter', carry: 'fruit' }),
      }),
      'crystal-nursery': Object.freeze({
        thanks:
          'The nursery is humming. We plant a chip of moonstone in the evening and find a crystal the next morning.',
        visits: Object.freeze({ settler: 2, willowkin: 0 }),
        use: Object.freeze({ stay: 'enter', carry: 'crystal' }),
      }),
      'earthlight-bakehouse': Object.freeze({
        thanks:
          'The bakehouse oven is lit. The whole crater smells of pie, and nobody has eaten at home since.',
        visits: Object.freeze({ settler: 3, willowkin: 1 }),
        use: Object.freeze({ stay: 'enter', carry: 'pie' }),
      }),
    }),
  }),
  Object.freeze({
    site: 'homecoming-commons',
    writer: 'The homecoming committee',
    request:
      'Families keep coming home from the Moon with nowhere to gather. The old-timers want a story hall, the musicians want a bandstand and the children want a meadow full of animals. We have one plot left. What should it become?',
    outcomes: Object.freeze({
      'story-hall': Object.freeze({
        thanks:
          'The story hall opened with a tale from 1865. Half the town corrected the other half, and everyone stayed until dark.',
        visits: Object.freeze({ resident: 1, wild: 1, villager: 3 }),
        use: Object.freeze({ stay: 'enter', carry: 'book' }),
      }),
      bandstand: Object.freeze({
        thanks:
          'The bandstand played its first concert last night. The Moon folk say they could hear it from the elevator.',
        visits: Object.freeze({ resident: 2, wild: 0, villager: 4 }),
        use: Object.freeze({ stay: 'gather' }),
      }),
      'wild-meadow': Object.freeze({
        thanks:
          'The meadow is fenced and the animals have already ignored the fence. The children have named every one of them.',
        visits: Object.freeze({ resident: 0, wild: 3, villager: 3 }),
        use: Object.freeze({ stay: 'roam', young: true }),
      }),
    }),
  }),
  // Opens once either commission above is under way (`opens` in townLandmarks.js).
  Object.freeze({
    site: 'willowkin-glade',
    writer: 'The Willowkin neighbours',
    request:
      'We have lived beside you since the first canopy went up, and we have never asked for anything. Now we would like one green place behind Riverlight Court. The elders want a grove of seedlings for the Moon, the young ones want an orchard hung with lanterns and the animals want a tree big enough for everyone. What should it be?',
    outcomes: Object.freeze({
      'seedling-grove': Object.freeze({
        thanks:
          'The first seedlings are in their rows. We sing to them in the mornings, and the strongest go up to New Hollow with the next climber.',
        visits: Object.freeze({ resident: 3, wild: 0, villager: 2 }),
        use: Object.freeze({ stay: 'roam', carry: 'sapling' }),
      }),
      'lantern-orchard': Object.freeze({
        thanks:
          'We lit the lanterns for the first time tonight. The animals came for the windfalls, the town came for the light, and everyone went home with fruit.',
        visits: Object.freeze({ resident: 2, wild: 2, villager: 3 }),
        use: Object.freeze({ stay: 'roam', carry: 'fruit' }),
      }),
      'story-tree': Object.freeze({
        thanks:
          'Someone told the story of the first prospector under the old tree last night. The animals listened from the roots, and the children made everyone hear it twice.',
        visits: Object.freeze({ resident: 0, wild: 3, villager: 4 }),
        use: Object.freeze({ stay: 'gather', young: true }),
      }),
    }),
  }),
  // New Hollow Rising's two commissions, on the outer ring.
  Object.freeze({
    site: 'schoolyard-court',
    writer: 'The teachers of the Crater School',
    request:
      'The first children born under Earthlight have filled every desk, shelf and window of the school. The librarian wants a reading room, the science teacher wants a dome for the stars and the art teacher wants a studio that looks at Earth. There is room on the outer ring for one. What should we build?',
    outcomes: Object.freeze({
      'lamplit-library': Object.freeze({
        thanks:
          'The library opened with one shelf for every child in New Hollow. The smallest readers sit nearest the lamps, and nobody hurries them home.',
        visits: Object.freeze({ settler: 2, willowkin: 1 }),
        use: Object.freeze({ stay: 'enter', carry: 'book', young: true }),
      }),
      'little-planetarium': Object.freeze({
        thanks:
          'The planetarium showed its first sky tonight: the stars as they look from the valley. The children cheered when we turned it round and they found home.',
        visits: Object.freeze({ settler: 3, willowkin: 0 }),
        use: Object.freeze({ stay: 'enter', carry: 'chart', young: true }),
      }),
      'earthview-studio': Object.freeze({
        thanks:
          'The easels outside the studio are never empty. Every painting of Earth comes out blue and white, and every one is different.',
        visits: Object.freeze({ settler: 1, willowkin: 2 }),
        use: Object.freeze({ stay: 'gather', carry: 'painting', young: true }),
      }),
    }),
  }),
  Object.freeze({
    site: 'crew-yard',
    writer: 'The rover crews',
    request:
      'We drive out past the rim every week and come home dusty, cold and full of stories. Most of the crews want a canteen, the mappers want a hall for the maps we keep drawing on napkins and the youngest drivers want a track for racing model rovers. There is one spot left by the outer ring. What should it be?',
    outcomes: Object.freeze({
      'crew-canteen': Object.freeze({
        thanks:
          'The canteen is open and the soup is always on. Crews come in from the plains, warm their hands on a flask and tell the same stories, only louder.',
        visits: Object.freeze({ settler: 3, willowkin: 1 }),
        use: Object.freeze({ stay: 'enter', carry: 'flask' }),
      }),
      'mapmakers-hall': Object.freeze({
        thanks:
          'The great floor map is laid. Every crew that comes home paints in the road it found, and the Moon looks a little less empty every week.',
        visits: Object.freeze({ settler: 2, willowkin: 0 }),
        use: Object.freeze({ stay: 'enter', carry: 'map' }),
      }),
      'rover-track': Object.freeze({
        thanks:
          'The first model rover race went three laps before anyone remembered to wave the flag. Nobody minded, and everyone wants a rematch.',
        visits: Object.freeze({ settler: 2, willowkin: 2 }),
        use: Object.freeze({ stay: 'gather' }),
      }),
    }),
  }),
]);
export const commissionFor = (siteId) => COMMISSIONS.find(({ site }) => site === siteId) ?? null;

export const COMMISSION_STAYS = Object.freeze(['enter', 'gather', 'roam']);
export const COMMISSION_CARRIES = Object.freeze([
  'book',
  'fruit',
  'crystal',
  'pie',
  'sapling',
  'chart',
  'painting',
  'flask',
  'map',
]);
/**
 * How residents use a finished commission, with every field filled: an outcome without
 * `use`, or with a value this build does not know, gathers at the front and carries nothing.
 */
export function commissionUse(outcome) {
  const use = outcome?.use ?? {};
  return {
    stay: COMMISSION_STAYS.includes(use.stay) ? use.stay : 'gather',
    carry: COMMISSION_CARRIES.includes(use.carry) ? use.carry : null,
    young: use.young === true,
  };
}
// A finished commission never draws a crowd: the valley walks at most this many there.
export const MAX_COMMISSION_VILLAGERS = 4;
/** How many valley townsfolk walk to a finished commission: one when the outcome says nothing. */
export const commissionVillagers = (outcome) =>
  Math.max(0, Math.min(MAX_COMMISSION_VILLAGERS, outcome?.visits?.villager ?? 1));

const PRESSING = { ready: 0, request: 1, work: 2, funding: 3 };
/**
 * Every commission the town can act on, most pressing first: `request` (a letter waits for
 * a choice), `work` (puzzles are building it), `ready` (waiting to be unveiled) and
 * `funding` (a finished stage, with another to pay for). A finished commission leaves the
 * list. Everything is derived from the saved site, so nothing new is saved.
 */
export function commissionStatus(town) {
  if (!town) return [];
  return COMMISSIONS.flatMap(({ site }) => {
    const area = AREA_BY_ID[site];
    if (!area || !areaUnlocked(town, area)) return [];
    const choice = areaChoice(town, area);
    if (!choice) return [{ site, area, state: 'request', choice: null, done: 0, total: 0 }];
    const work = monumentWork(town, area);
    if (work) {
      const state = work.ready ? 'ready' : 'work';
      return [{ site, area, state, choice, done: work.wins, total: work.required }];
    }
    const total = areaMaximum(town, area),
      done = areaStage(town, area);
    return done < total ? [{ site, area, state: 'funding', choice, done, total }] : [];
  }).sort((a, b) => PRESSING[a.state] - PRESSING[b.state]);
}
/** A settlement's finished commissions with the outcome the player chose. */
export function finishedCommissions(town, settlement) {
  if (!town) return [];
  return COMMISSIONS.flatMap(({ site, outcomes }) => {
    const area = AREA_BY_ID[site];
    if (!area || area.settlement !== settlement || !areaUnlocked(town, area)) return [];
    const outcome = outcomes[areaChoice(town, area)];
    return outcome && areaShownStage(town, area) >= 1 ? [{ site, area, outcome }] : [];
  });
}
/** A settlement's commission letters: the request once its site opens, thanks once it stands. */
export function commissionLetters(town, settlement) {
  if (!town) return [];
  return COMMISSIONS.flatMap(({ site, writer, request }) => {
    const area = AREA_BY_ID[site];
    if (!area || area.settlement !== settlement || !areaUnlocked(town, area)) return [];
    const standing = finishedCommissions(town, settlement).find((entry) => entry.site === site);
    return [
      { id: `${site}-request`, from: writer, text: request },
      ...(standing ? [{ id: `${site}-thanks`, from: writer, text: standing.outcome.thanks }] : []),
    ];
  });
}
