import { SPACE_HELMET } from './townAnimals';

// Hidden finds: easter eggs that move each time a puzzle is completed and pay saloon
// takings when tapped. Every find follows one contract, on the client and the server:
//
// - It is out from its `debut` era on, and is placed from the public town alone
//   (`completedRuns`), so the owner and every visitor see it in the same place.
// - The owner finds it once per completed puzzle for `rewardHours.owner` hours of saloon
//   takings. A signed-in visitor finds it for `rewardHours.visitor` hours of their own
//   town's takings, within the server's limits, and redeems the server's signed receipt.
// - A find `X` saves the town fields `XRun` (the completed puzzle count the owner found
//   it at) and `XVisitAt` (the latest visiting find redeemed), journals `X-find` and
//   `X-visitor`, is found through `POST villages/{id}/X`, rests until `XReadyAt` on a
//   shared town and arrives on the owner poll as `XFinds`. The space helmet's saves,
//   journals and API predate the contract and already have this shape.
//
// Each find is separate: finding one never uses up another. The server reads these
// definitions from the exported save rules (`economy.hiddenFinds`). A new find adds a
// definition here, its presentation, and its name in `PublicTown::FIND_NAMES`.
export const HIDDEN_FINDS = {
  helmet: { debut: SPACE_HELMET.debut, rewardHours: SPACE_HELMET.rewardHours },
  // The wandering pair: an upright raccoon and its Willowkin, strolling the valley or New
  // Hollow on the Moon (src/game/town/TownWanderers.js). Same rewards as the helmet.
  wanderers: { debut: 'hollow-rising', rewardHours: SPACE_HELMET.rewardHours },
};
export const HIDDEN_FIND_IDS = Object.keys(HIDDEN_FINDS);

/** The saved town fields of a find. */
export const hiddenFindFields = (id) => ({ run: `${id}Run`, visitAt: `${id}VisitAt` });
/** The journal actions of a find: the owner's own find and a visiting find redeemed. */
export const hiddenFindCommands = (id) => ({ find: `${id}-find`, visitor: `${id}-visitor` });
/** A new town's find state: nothing found yet. */
export const createHiddenFindState = () =>
  Object.fromEntries(
    HIDDEN_FIND_IDS.flatMap((id) => Object.values(hiddenFindFields(id)).map((key) => [key, 0])),
  );

// What the game says about each find: English keys for t(), with French in
// src/i18n/fr.json (testing/hidden-finds.test.js checks every one).
export const HIDDEN_FIND_WORDS = {
  helmet: {
    // The owner's own town.
    collected: 'Found the astronaut: {coins} coins!',
    collectedUnknown: 'Found the astronaut: coins for your town!',
    already: 'You already found the astronaut. It moves to another animal after your next puzzle.',
    empty: 'You found the astronaut! Its reward is an hour of your saloon takings.',
    zoom: 'Zoom in closer to the animals to find the astronaut.',
    redeemed: 'You found an astronaut while visiting another town: {coins} coins.',
    // While visiting another town.
    visitInvite:
      'Find the animal in a space helmet: your own town earns half an hour of saloon takings.',
    visitFound: 'You found the astronaut! {town} receives half an hour of its saloon takings.',
    visitOwn: 'This is your own town: find its astronaut from your game for your reward.',
    visitTaken: "A visitor found this town's astronaut recently. Come back in {hours} h.",
    visitSignedOut: 'You found the astronaut! Sign in with a town of your own to earn its reward.',
    visitResting: 'You found an astronaut recently. Your next reward is ready in {hours} h.',
  },
  wanderers: {
    collected: 'Found the wandering pair: {coins} coins!',
    collectedUnknown: 'Found the wandering pair: coins for your town!',
    already:
      'You already found the wandering pair. They stroll somewhere new, here or on the Moon, after your next puzzle.',
    empty: 'You found the wandering pair! Their reward is an hour of your saloon takings.',
    zoom: 'Zoom in closer to see who is out walking.',
    redeemed: 'You found a wandering pair while visiting another town: {coins} coins.',
    visitInvite:
      'Find the raccoon out walking with its Willowkin, here or on the Moon: your own town earns half an hour of saloon takings.',
    visitFound: 'You found the wandering pair! {town} receives half an hour of its saloon takings.',
    visitOwn: 'This is your own town: find its wandering pair from your game for your reward.',
    visitTaken: "A visitor found this town's wandering pair recently. Come back in {hours} h.",
    visitSignedOut:
      'You found the wandering pair! Sign in with a town of your own to earn their reward.',
    visitResting: 'You found a wandering pair recently. Your next reward is ready in {hours} h.',
  },
};
