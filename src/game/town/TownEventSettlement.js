import { BUILDING_BY_ID } from '../../data/town';

// Presentation owns visibility only. Saved receipts and their existing completion
// transactions remain the sole owners of outcomes, rewards and acknowledgements.
// Unknown/incomplete content stays in the valley until it declares a settlement.
export function eventSettlement(definition) {
  return (definition?.settlement ?? BUILDING_BY_ID[definition?.building]?.settlement) === 'moon'
    ? 'moon'
    : 'valley';
}
export function canPresentEvent(definition, settlement, active = true) {
  return !!definition && active && eventSettlement(definition) === settlement;
}
function pendingSettlementPresentation(town, definitions = {}, settlement) {
  return Object.values(definitions).find(
    (definition) =>
      definition?.id &&
      town.presentations?.[definition.id] === 'pending' &&
      canPresentEvent(definition, settlement),
  );
}

// One display contract for saved era transitions, incidents, building/milestone
// receipts and player-requested unveilings. Selecting a stage never consumes one.
export function townEventStage({
  town,
  settlement = 'valley',
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
  const presentation =
    !era && !playingRaid
      ? canPresentEvent(monument, settlement)
        ? monument
        : pendingSettlementPresentation(town, definitions, settlement)
      : null;
  const other = settlement === 'moon' ? 'valley' : 'moon';
  const waiting = [
    transition,
    raid,
    monument,
    pendingSettlementPresentation(town, definitions, other),
    ...attention,
  ].find((event) => canPresentEvent(event, other));
  return {
    era,
    raid: playingRaid,
    presentation,
    waiting: waiting
      ? { key: `${other}-${waiting.id}`, settlement: eventSettlement(waiting) }
      : null,
  };
}
