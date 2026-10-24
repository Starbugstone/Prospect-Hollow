// These buildings finish in three substantial stages. Stage three retains the old
// level-five service capacity, so existing towns lose no benefits. Each one names the
// town progression version that shortened it: supporting buildings in version 1, and
// Frontier's saloon, sheriff, bank, town square and blacksmith in version 2.
const SHORT_SINCE = {
  well: 1,
  well2: 1,
  farm: 1,
  farm2: 1,
  farm3: 1,
  home: 1,
  home2: 1,
  home3: 1,
  home4: 1,
  stable: 1,
  museum: 1,
  armory: 1,
  shop: 1,
  fisherman: 1,
  school: 1,
  doctor: 1,
  saloon: 2,
  sheriff: 2,
  bank: 2,
  square: 2,
  blacksmith: 2,
};
// New towns start at the current version; older saves are migrated when they load.
export const PROGRESSION_VERSION = 2;
// Every level a saved short building could hold before it was shortened.
export const LEGACY_MAX_LEVEL = 5;
export const MAX_SERVICE_LEVEL = 5;
export const hasShortProgression = (id) => Object.hasOwn(SHORT_SINCE, id);
export const shortProgressionSince = (id) => SHORT_SINCE[id] ?? 0;
// A save from an older progression version still holds this building's longer levels.
export const keepsLegacyLevels = (id, version) =>
  hasShortProgression(id) && (Number.isSafeInteger(version) ? version : 0) < SHORT_SINCE[id];
export const buildingServiceLevel = (id, stage) =>
  hasShortProgression(id) && stage >= 3 ? MAX_SERVICE_LEVEL : stage;
// The level a building serves the town at: what income, defenses, the forge and the
// town bell read, whatever number of stages it took to get there.
export const serviceLevel = (town, id) => buildingServiceLevel(id, town.buildings?.[id] ?? 0);
// Their 3D models were drawn for five levels. Buildings shortened from version 2 on keep
// drawing their finished look at stage three; earlier short buildings already stop there.
export const modelLevel = (id, stage) =>
  shortProgressionSince(id) >= 2 ? buildingServiceLevel(id, stage) : stage;
