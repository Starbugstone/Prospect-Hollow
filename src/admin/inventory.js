// Support's correction of a town's coins, stored bonuses and builder hammers after a bug.
// The server sends the current values and limits; powers are keyed by ID.
import { HAMMER_CAPACITY } from '../data/rewards';
import { powerLabel } from './labels';
import { isOnline, whole } from './format';

export function inventoryFields(inventory) {
  const { limits } = inventory;
  return [
    { key: 'coins', label: 'Coins', current: inventory.coins, max: limits.coins },
    ...Object.entries(inventory.powers).map(([id, quantity]) => ({
      key: `powers.${id}`,
      power: id,
      label: powerLabel(id),
      current: quantity,
      max: limits.powers,
    })),
    {
      key: 'builderHammers',
      label: 'Builder hammers',
      current: inventory.builderHammers,
      max: limits.builderHammers,
      // Play stops awarding hammers at the cap; support may grant past it.
      note: `play earns up to ${HAMMER_CAPACITY}`,
    },
  ];
}
export const validValue = (field, value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= field.max;
export const changedFields = (fields, values) =>
  fields.filter(
    (field) => validValue(field, values[field.key]) && values[field.key] !== field.current,
  );
// The PATCH body: only the values that changed.
export function correctionBody(fields, values, revision) {
  const body = { revision };
  for (const field of changedFields(fields, values)) {
    if (field.power) (body.powers ??= {})[field.power] = values[field.key];
    else body[field.key] = values[field.key];
  }
  return body;
}
export const correctionSummary = (fields, values) =>
  changedFields(fields, values)
    .map((field) => `${field.label} ${whole(field.current)} → ${whole(values[field.key])}`)
    .join(', ');
// The owner's game may sync while support edits. The page polls the town meanwhile: a newer
// revision makes the edit stale, and an online owner gets a warning first.
export const STATUS_POLL_MS = 15000;
export const editingRisk = (revision, status, now = Date.now() / 1000) => ({
  online: isOnline(status.ownerSeenAt, now),
  stale: status.revision !== revision,
});
