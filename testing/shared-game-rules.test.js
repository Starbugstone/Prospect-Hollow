import { describe, expect, it } from 'vitest';
import { buildSaveRules } from '../scripts/save-rules.js';
import {
  SAVE_SCHEMA_VERSION,
  SUPPORTED_SAVE_SCHEMAS,
  isWholeNumber,
  wholeNumberOrZero,
} from '../src/data/saveFormat';
import { freshProfile } from '../src/stores/campaignStore';

describe('save formats', () => {
  it('writes the newest supported format and exports the same list to the server', () => {
    expect(SUPPORTED_SAVE_SCHEMAS).toEqual([2, 3, 4]);
    expect(SUPPORTED_SAVE_SCHEMAS.at(-1)).toBe(SAVE_SCHEMA_VERSION);
    expect(freshProfile().schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    const rules = buildSaveRules();
    expect(rules.supportedSchemaVersions).toEqual(SUPPORTED_SAVE_SCHEMAS);
    expect(rules.profileSchemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('accepts only whole numbers JSON keeps exactly', () => {
    for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) {
      expect(isWholeNumber(value)).toBe(true);
      expect(wholeNumberOrZero(value)).toBe(value);
    }
    for (const value of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
      expect(isWholeNumber(value)).toBe(false);
      expect(wholeNumberOrZero(value)).toBe(0);
    }
  });
});
