import { BUILDING_BY_ID } from '../../data/town';
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
export function canPresentEvent(definition, settlement, active = true) {
  return !!definition && active && eventSettlement(definition) === settlement;
}
function pendingPresentation(town, definitions = {}, belongs) {
  return Object.values(definitions).find(
    (definition) =>
      definition?.id && town.presentations?.[definition.id] === 'pending' && belongs(definition),
  );
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
