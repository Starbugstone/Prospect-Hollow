// Completion receipts are saved with the building transaction. Presentation never
// owns construction, rewards or progression; interrupted scenes can be resumed.
export const TOWN_PRESENTATIONS = Object.freeze({
  'railway-opening': {
    id: 'railway-opening',
    building: 'railDepot',
    duration: 16,
    title: 'The railway comes to Prospect Hollow',
    chapters: [
      { at: 0, text: 'A station ready for its first passengers.' },
      { at: 2, text: 'Sleepers, steel, and a new road through the valley.' },
      { at: 6, text: 'Stone by stone, a passage through the mountain.' },
      { at: 10, text: 'The first train is on its way.' },
      { at: 14, text: 'Welcome to Prospect Hollow!' },
    ],
  },
});
export function queueBuildingPresentations(previous, next, definitions = TOWN_PRESENTATIONS) {
  const presentations = { ...next.presentations };
  for (const definition of Object.values(definitions)) {
    if (!definition?.id || !definition.building) continue;
    if (!previous.buildings[definition.building] && next.buildings[definition.building] > 0)
      presentations[definition.id] = 'pending';
  }
  return { ...next, presentations };
}
export function normalizePresentations(saved, town, definitions = TOWN_PRESENTATIONS) {
  return Object.fromEntries(
    Object.values(definitions)
      .filter(
        (d) =>
          d?.id && town.buildings[d.building] > 0 && ['pending', 'seen'].includes(saved?.[d.id]),
      )
      .map((d) => [d.id, saved[d.id]]),
  );
}
export function pendingPresentation(town) {
  return Object.values(TOWN_PRESENTATIONS).find((d) => town.presentations?.[d.id] === 'pending');
}
export function acknowledgePresentation(town, id) {
  if (!TOWN_PRESENTATIONS[id] || town.presentations?.[id] !== 'pending') return null;
  return { ...town, presentations: { ...town.presentations, [id]: 'seen' } };
}
