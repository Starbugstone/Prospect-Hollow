export const RETENTION_ELIGIBILITY = [];
export const POLICY_VERSION = 1;
const KEY = 'prospect.boardRetention';
export function describeEnvironment() {
  return {
    userAgent: globalThis.navigator?.userAgent,
    deviceMemory: globalThis.navigator?.deviceMemory,
  };
}
export function retentionMode(
  env = describeEnvironment(),
  rules = RETENTION_ELIGIBILITY,
  storage = globalThis.localStorage,
) {
  if (!rules.some((rule) => rule.matches(env))) return 'evict';
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (saved?.version === POLICY_VERSION && saved.mode === 'evict') return 'evict';
  } catch {
    /* Unavailable storage does not grant eligibility. */
  }
  return 'retain';
}
export function demote(
  reason,
  { teardownInProgress = false, controlled = false, storage = globalThis.localStorage } = {},
) {
  if (teardownInProgress || controlled) return;
  try {
    storage?.setItem(
      KEY,
      JSON.stringify({ version: POLICY_VERSION, mode: 'evict', reason, at: Date.now() }),
    );
  } catch {
    /* Storage is optional. */
  }
}
export function resetRetentionPolicy() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* Storage is optional. */
  }
}
