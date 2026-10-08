// Support's quick fixes to a town's coins, stored bonuses and builder hammers after a bug.
// The server sends the current values and limits; powers are keyed by ID.
import { HAMMER_CAPACITY } from '../data/rewards';
import { powerLabel } from './labels';
import { isOnline } from './format';

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
// What an admin types: digits only, so "1,5" or "2e3" never become another number.
export const typedValue = (text) => (/^\s*\d+\s*$/.test(String(text)) ? Number(text) : NaN);
// The PATCH body for one corrected value, checked against the revision the admin saw.
export const correctionBody = (field, value, revision) =>
  field.power ? { revision, powers: { [field.power]: value } } : { revision, [field.key]: value };

// The owner's game may sync while support edits. The page polls the town meanwhile: a newer
// revision means the values shown are out of date, and an online owner gets a warning first.
export const STATUS_POLL_MS = 15000;
export const editingRisk = (revision, status, now = Date.now() / 1000) => ({
  online: isOnline(status.ownerSeenAt, now),
  stale: status.revision > revision,
});
