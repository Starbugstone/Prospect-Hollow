import { SAVE_KEY } from './localProfile';
import { townStorage } from './townStorage';
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
    {
      format: SAVE_KEY,
      version: 1,
      exportedAt: new Date().toISOString(),
      town: townStorage.state()?.active
        ? { id: townStorage.state().active.id, name: townStorage.state().active.name }
        : undefined,
      profile,
    },
    null,
    2,
  );
}

/**
 * Name a downloaded backup after its town, so players can tell their towns' files apart.
 * @param {string} [townName] Falls back to a generic name when the town has none.
 * @param {Date} [now]
 * @returns {string} For example "prospect-hollow-Silver-Creek-2026-09-29T10-00-00-000Z.json".
 */
export function saveFileName(townName, now = new Date()) {
  const town = String(townName ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f.]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `prospect-hollow-${town ? `${town}-` : ''}${now.toISOString().replace(/[:.]/g, '-')}.json`;
}

/**
 * Start a browser download of a JSON save without navigating away from the game.
 * @param {string} text Serialized save, for example from createSaveFile.
 * @param {string} filename
 */
export function downloadSaveFile(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  if (file.town !== undefined) {
    if (
      !isObject(file.town) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(file.town.id) ||
      typeof file.town.name !== 'string' ||
      file.town.name.length > 100
    )
      throw invalidSave();
    Object.defineProperty(profile, '_backupTown', { value: file.town });
  }
  return profile;
}
