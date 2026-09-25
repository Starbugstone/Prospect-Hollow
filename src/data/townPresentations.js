import { campaignCompletion } from './campaignCompletion';

// Completion receipts are saved with the completion transaction. Presentation never
// owns construction, rewards or progression; interrupted scenes can be resumed.
export const TOWN_PRESENTATIONS = Object.freeze({
  'three-star-celebration': {
    id: 'three-star-celebration',
    qualifies: (records) => campaignCompletion(records).complete,
    duration: 18,
    title: 'Prospect Hollow · 100% complete',
    chapters: [
      { at: 0, text: 'Every discovery. Every star.' },
      { at: 4, text: 'Tonight, the town square shines for you.' },
      { at: 11, text: 'Three stars on every level!' },
      { at: 16, text: 'A perfect collection. A town full of thanks.' },
    ],
  },
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
// Shared milestone receipts also recognize qualifying saves from before a feature
// existed. Pending/seen receipts prevent repeats, including after reload or replay.
export function queueCampaignPresentations(town, records, definitions = TOWN_PRESENTATIONS) {
  const presentations = { ...town.presentations };
  for (const definition of Object.values(definitions)) {
    if (!definition?.id || typeof definition.qualifies !== 'function') continue;
    if (!definition.qualifies(records)) delete presentations[definition.id];
    else if (!presentations[definition.id]) presentations[definition.id] = 'pending';
  }
  return { ...town, presentations };
}
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
          d?.id &&
          (d.building ? town.buildings[d.building] > 0 : typeof d.qualifies === 'function') &&
          ['pending', 'seen'].includes(saved?.[d.id]),
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
