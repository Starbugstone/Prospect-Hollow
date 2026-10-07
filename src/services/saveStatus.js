import { locale, t } from '../i18n';
import { uploadBlocked } from './syncService';

// One player-facing description of the save state, shared by the village pill,
// the settings drawer and My towns. Messages are English keys for t().
// Keyed by the cloud.status codes from cloudProfile.
const SYNC_STATES = {
  saved: {
    tone: 'saved',
    label: 'Saved',
    detail: 'Saved on this device and in your account.',
  },
  syncing: { tone: 'busy', label: 'Saving…', detail: 'Backing up to your account…' },
  pending: {
    tone: 'pending',
    label: 'Backing up',
    detail: 'Saved on this device. The backup to your account will follow shortly.',
    action: 'retry',
  },
  offline: {
    tone: 'pending',
    label: 'Offline',
    detail: 'Saved on this device. The backup will retry automatically.',
    action: 'retry',
  },
};

/**
 * @param {object} state
 * @param {boolean} [state.sessionExpired] Saved account needs authentication again.
 * @param {boolean} state.signedIn
 * @param {boolean} state.accountTown The open town belongs to the signed-in account.
 * @param {string} state.status cloud.status code from cloudProfile.
 * @param {object} [state.meta] Active town metadata.
 * @returns {{tone: string, label: string, detail: string, action: string|null}}
 */
export function describeSaveState({ signedIn, accountTown, status, meta, sessionExpired = false }) {
  if (!signedIn)
    return {
      tone: 'local',
      label: 'On this device',
      detail: 'Sign in to back up your town and play it on other devices.',
      action: 'sign-in',
    };
  if (!accountTown)
    return {
      tone: 'local',
      label: 'On this device',
      detail: 'This town is only on this device. Add it to your account from My towns.',
      action: 'my-towns',
    };
  if (sessionExpired || status === 'expired')
    return {
      tone: 'alert',
      label: 'Playing offline',
      detail: 'Your session expired. Keep playing offline; sign in again to resume cloud saving.',
      action: 'sign-in',
    };
  if (uploadBlocked(meta))
    return {
      tone: 'alert',
      label: 'Backup paused',
      detail: 'Cloud saving is paused. Your progress is saved on this device.',
      action: 'retry',
    };
  // Support's reset loads without a choice; its notice is the village toast.
  if (meta?.desyncNotice && meta.desyncNotice !== 'support')
    return {
      tone: 'alert',
      label: 'Choose a save',
      detail: 'You played this town on another device. Compare both saves and pick one.',
      action: 'compare',
    };
  if (meta?.conflict)
    return {
      tone: 'alert',
      label: 'Newer save found',
      detail:
        'A newer save from another device will load when you return to the village. Your progress here is kept.',
      action: null,
    };
  if (meta?.missing)
    return {
      tone: 'alert',
      label: 'Not backed up',
      detail: 'This cloud town was deleted or is unavailable. Its copy on this device is kept.',
      action: 'my-towns',
    };
  return {
    action: null,
    ...(SYNC_STATES[status] ?? {
      tone: 'pending',
      label: 'Backup pending',
      detail: 'Saved on this device. The backup will retry automatically.',
      action: 'retry',
    }),
  };
}

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];
/** Localized "2 hours ago", or "just now" under a minute; null for unknown times. */
export function timeAgo(at, now = Date.now(), language = locale.value) {
  if (!Number.isFinite(at) || at <= 0) return null;
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  const [unit, size] = UNITS.find(([, length]) => seconds >= length) ?? [];
  if (!unit) return t('just now');
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(
    -Math.floor(seconds / size),
    unit,
  );
}
