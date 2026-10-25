// The save format this game writes, and every older one it still reads and upgrades.
// The server accepts the same list from the exported save rules (save-rules.json).
export const SAVE_SCHEMA_VERSION = 4;
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
