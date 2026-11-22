import { BUILDINGS, BUILDING_BY_ID } from '../../data/town';
import { AREA_BY_ID } from '../../data/townLandmarks';
import { HOME_SETTLEMENT, settlementId, shownSettlement } from '../../data/settlements';

/** The settlement id of a building or monument site, by its id (undeclared: the valley). */
export const placeSettlement = (id) => settlementId(BUILDING_BY_ID[id] ?? AREA_BY_ID[id]);

// Presentation owns visibility only. Saved receipts and their existing completion
// transactions remain the sole owners of outcomes, rewards and acknowledgements.
// Unknown/incomplete content stays in the valley until it declares a settlement that
// has a map to show it (settlements.js).
export function eventSettlement(definition) {
  return shownSettlement(
    definition?.settlement ?? BUILDING_BY_ID[definition?.building]?.settlement,
  );
}
/**
 * Where an era's new buildings all stand, when that is not the valley: the place its era
 * cinematic hands over to. Null for an era that builds in the valley, or in several places.
 */
export function eraSettlement(era) {
  const places = new Set(
    BUILDINGS.filter((building) => building.introducedEra === era).map((building) =>
      shownSettlement(building.settlement),
    ),
  );
  const [only] = places;
  return places.size === 1 && only !== HOME_SETTLEMENT ? only : null;
}
export function canPresentEvent(definition, settlement, active = true) {
  return !!definition && active && eventSettlement(definition) === settlement;
}
function pendingPresentation(town, definitions = {}, belongs) {
  return Object.values(definitions).find(
    (definition) =>
      definition?.id && town.presentations?.[definition.id] === 'pending' && belongs(definition),
  );
}

// A saved event's acknowledgement that the store could not save (a full local store, a
// read-only save) is held for the session: its screen counts it as seen so the player is
// never trapped in its cinematic or dialog, while the saved receipt stays pending and plays
// again in a later session.
export const acknowledgementKey = {
  era: (transition) => `era:${transition?.id}`,
  presentation: (id) => `presentation:${id}`,
  firstLights: 'first-lights',
};
/** The town as the screen presents its saved events, with `held` acknowledgements seen. */
export function presentedTown(town, held = []) {
  if (!held.length) return town;
  const presentations = Object.fromEntries(
    Object.entries(town.presentations ?? {}).map(([id, state]) => [
      id,
      state === 'pending' && held.includes(acknowledgementKey.presentation(id)) ? 'seen' : state,
    ]),
  );
  const eraHeld =
    town.transition?.pending && held.includes(acknowledgementKey.era(town.transition));
  return {
    ...town,
    presentations,
    transition: eraHeld ? { ...town.transition, pending: false } : town.transition,
    firstLightsSeen: town.firstLightsSeen || held.includes(acknowledgementKey.firstLights),
  };
}

// One display contract for saved era transitions, incidents, building/milestone
// receipts and player-requested unveilings. Selecting a stage never consumes one.
export function townEventStage({
  town,
  settlement = HOME_SETTLEMENT,
  active = true,
  raid,
  monument,
  definitions,
  attention = [],
}) {
  if (!active) return { era: false, raid: null, presentation: null, waiting: null };
  const transition = town.transition?.pending ? town.transition : null;
  const era = canPresentEvent(transition, settlement);
  const playingRaid = !era && canPresentEvent(raid, settlement) ? raid : null;
  const here = (definition) => canPresentEvent(definition, settlement);
  const presentation =
    !era && !playingRaid
      ? here(monument)
        ? monument
        : pendingPresentation(town, definitions, here)
      : null;
  // The first event waiting on another settlement's map, wherever that is.
  const away = (definition) => !!definition && eventSettlement(definition) !== settlement;
  const waiting = [
    transition,
    raid,
    monument,
    pendingPresentation(town, definitions, away),
    ...attention,
  ].find(away);
  const destination = waiting && eventSettlement(waiting);
  return {
    era,
    raid: playingRaid,
    presentation,
    waiting: waiting ? { key: `${destination}-${waiting.id}`, settlement: destination } : null,
  };
}
