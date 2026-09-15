import { SAVE_KEY } from './localProfile';
import { LEVEL_COUNT } from '../data/campaign';
import { chestReward } from '../data/rewards';

export const MAX_SAVE_FILE_BYTES = 5 * 1024 * 1024;
const invalidSave = () => new Error('Choose a valid Prospect Hollow save JSON file.');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

/**
 * Serialize campaign progress into a versioned JSON backup without writing to storage.
 * @param {object} profile Persisted campaign fields from profileData.
 * @returns {string} Downloadable JSON containing the profile and export metadata.
 */
export function createSaveFile(profile) {
  return JSON.stringify(
    { format: SAVE_KEY, version: 1, exportedAt: new Date().toISOString(), profile },
    null,
    2,
  );
}

/**
 * Validate a JSON backup before normalization or replacement of any saved progress.
 * @param {string} text File contents, optionally starting with a UTF-8 BOM.
 * @returns {object} Validated profile for the campaign loader to normalize.
 * @throws {Error} If the file is oversized, incompatible, or contains malformed progress.
 */
export function parseSaveFile(text) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_SAVE_FILE_BYTES) throw invalidSave();
  let file;
  try {
    file = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw invalidSave();
  }
  if (!isObject(file) || file.format !== SAVE_KEY) throw invalidSave();
  if (file.version !== 1 || file.profile?.schemaVersion !== 2)
    throw new Error('This save format is not supported by this version of the game.');
  const profile = file.profile;
  if (
    !isObject(profile.records) ||
    !Object.values(profile.records).every(
      (record) =>
        isObject(record) &&
        Number.isFinite(record.score) &&
        record.score >= 0 &&
        Number.isInteger(record.stars) &&
        record.stars >= 1 &&
        record.stars <= 3,
    ) ||
    !isObject(profile.continuousRecords) ||
    !Object.values(profile.continuousRecords).every(
      (record) =>
        isObject(record) &&
        nonnegativeInteger(record.coins) &&
        Number.isFinite(record.score) &&
        record.score >= 0,
    ) ||
    !Array.isArray(profile.powers) ||
    !profile.powers.every(
      (power) =>
        isObject(power) && typeof power.id === 'string' && nonnegativeInteger(power.quantity),
    ) ||
    !isObject(profile.town) ||
    !nonnegativeInteger(profile.town.coins) ||
    !isObject(profile.town.buildings) ||
    !Object.values(profile.town.buildings).every(nonnegativeInteger) ||
    !nonnegativeInteger(profile.builderHammers) ||
    !nonnegativeInteger(profile.issuedRun) ||
    !nonnegativeInteger(profile.settledRun) ||
    profile.settledRun > profile.issuedRun ||
    !Array.isArray(profile.pendingChests) ||
    !profile.pendingChests.every(
      (chest) =>
        isObject(chest) &&
        nonnegativeInteger(chest.runId) &&
        chest.runId > 0 &&
        chest.runId === profile.settledRun &&
        ['completion', 'score', 'speed'].includes(chest.source) &&
        Number.isInteger(chest.levelId) &&
        chest.levelId >= 1 &&
        chest.levelId <= LEVEL_COUNT &&
        (chest.economyVersion === undefined || [1, 2].includes(chest.economyVersion)) &&
        Array.isArray(chest.items) &&
        chest.items.length === 1 &&
        isObject(chest.items[0]) &&
        !!chestReward(chest.items[0].id === 'hammer' ? 'tnt' : chest.items[0].id, chest.levelId),
    ) ||
    !Array.isArray(profile.shopStock) ||
    !Array.isArray(profile.seenObstacles)
  )
    throw invalidSave();
  return profile;
}
