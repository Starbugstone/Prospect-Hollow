// Display helpers for the admin panel. Times from the API are Unix seconds.
export function relativeTime(seconds, now = Date.now() / 1000) {
  if (!seconds) return 'never';
  const elapsed = Math.max(0, now - seconds);
  if (elapsed < 60) return 'just now';
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)} min ago`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)} h ago`;
  const days = Math.floor(elapsed / 86400);
  return days < 45 ? `${days} day${days === 1 ? '' : 's'} ago` : date(seconds);
}
export const date = (seconds) =>
  seconds ? new Date(seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
export const dateTime = (seconds) =>
  seconds
    ? new Date(seconds * 1000).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
const ONLINE_SECONDS = 300;
export const isOnline = (seconds, now = Date.now() / 1000) =>
  Boolean(seconds) && now - seconds < ONLINE_SECONDS;

export function compact(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 10_000) return number.toLocaleString('en-US');
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    number,
  );
}
export const whole = (value) => (Number(value) || 0).toLocaleString('en-US');

// A short "Browser on OS" name; the raw user agent stays available on hover.
export function describeAgent(agent) {
  if (!agent) return 'Unknown';
  const browser =
    [
      [/EdgA?\//, 'Edge'],
      [/SamsungBrowser\//, 'Samsung Internet'],
      [/OPR\//, 'Opera'],
      [/Firefox\/|FxiOS\//, 'Firefox'],
      [/Chrome\/|CriOS\//, 'Chrome'],
      [/Safari\//, 'Safari'],
    ].find(([pattern]) => pattern.test(agent))?.[1] ?? 'Other browser';
  const system =
    [
      [/Android/, 'Android'],
      [/iPhone|iPad|iPod/, 'iOS'],
      [/Windows/, 'Windows'],
      [/Mac OS X|Macintosh/, 'macOS'],
      [/CrOS/, 'ChromeOS'],
      [/Linux/, 'Linux'],
    ].find(([pattern]) => pattern.test(agent))?.[1] ?? '';
  return system ? `${browser} on ${system}` : browser;
}

// For screen sharing: keep the first letter and the domain.
export function maskEmail(email) {
  const at = email.indexOf('@');
  return at > 0 ? `${email[0]}•••${email.slice(at)}` : '•••';
}

// Whole chapters per bucket, so a long campaign still fits in a few columns.
export const levelBucketSize = (total, chapter = 6, buckets = 8) =>
  chapter * Math.max(1, Math.ceil(total / chapter / buckets));
// Towns grouped by completed levels: "0", then equal ranges up to the campaign length.
export function levelBuckets(levels, total, size) {
  const buckets = [{ label: '0', from: 0, to: 0, towns: 0 }];
  for (let from = 1; from <= total; from += size) {
    const to = Math.min(total, from + size - 1);
    buckets.push({ label: `${from}–${to}`, from, to, towns: 0 });
  }
  for (const count of levels) {
    const bucket =
      buckets.find((entry) => count >= entry.from && count <= entry.to) ?? buckets.at(-1);
    bucket.towns++;
  }
  return buckets;
}

// A round axis maximum: 1, 2 or 5 times a power of ten.
export function niceMax(value) {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((step) => step * power).find((candidate) => candidate >= value);
}

const ACTIONS = {
  signed_in: 'Signed in',
  sign_in_failed: 'Failed sign-in',
  code_attempts_exceeded: 'Too many wrong codes',
  password_changed: 'Changed password',
  authenticator_enrolled: 'Set up authenticator',
  admin_created: 'Added admin',
  admin_password_reset: 'Reset admin password',
  admin_authenticator_reset: 'Reset admin authenticator',
  admin_deleted: 'Removed admin',
  player_signed_out: 'Signed player out',
  player_deleted: 'Deleted player account',
  distinction_granted: 'Gave player distinction',
  distinction_removed: 'Removed player distinction',
  town_renamed: 'Renamed town',
  town_unshared: 'Stopped sharing town',
  town_deleted: 'Deleted town',
  town_restored: 'Restored town revision',
};
export const actionLabel = (action) => ACTIONS[action] ?? action.replaceAll('_', ' ');
