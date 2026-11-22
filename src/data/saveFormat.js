// The save format this game writes, and every older one it still reads and upgrades.
// The server accepts the same list from the exported save rules (save-rules.json).
// 5: a town may stand in an era that a 1.2 client does not know (New Hollow Rising and The
// Quiet Signal). That client would fold the era back to the frontier and save over the town,
// so it must open a schema 5 save read-only instead.
export const SAVE_SCHEMA_VERSION = 5;
const OLDEST_SAVE_SCHEMA_VERSION = 2;
export const SUPPORTED_SAVE_SCHEMAS = Object.freeze(
  Array.from(
    { length: SAVE_SCHEMA_VERSION - OLDEST_SAVE_SCHEMA_VERSION + 1 },
    (_, index) => OLDEST_SAVE_SCHEMA_VERSION + index,
  ),
);

// Saved coins, counts and sequences are whole numbers that JSON keeps exactly.
export const isWholeNumber = (value) => Number.isSafeInteger(value) && value >= 0;
// A saved count, or zero when the value is not a whole number.
export const wholeNumberOrZero = (value) => (isWholeNumber(value) ? value : 0);
