import { afterEach, describe, expect, it } from 'vitest';
import { describeSaveState, timeAgo } from '../src/services/saveStatus';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';

afterEach(() => setLocale('en'));
const account = (status, meta = {}) =>
  describeSaveState({ signedIn: true, accountTown: true, status, meta });

describe('Player-facing save state', () => {
  it('invites signed-out players to protect a device-only town', () => {
    expect(describeSaveState({ signedIn: false, accountTown: false })).toMatchObject({
      tone: 'local',
      action: 'sign-in',
    });
    expect(
      describeSaveState({ signedIn: true, accountTown: false, status: 'local' }),
    ).toMatchObject({ tone: 'local', action: 'my-towns' });
  });

  it('maps every cloud sync status to a calm label and a retry only when useful', () => {
    expect(account('saved')).toMatchObject({ tone: 'saved', label: 'Saved', action: null });
    expect(account('syncing')).toMatchObject({ tone: 'busy', action: null });
    expect(account('pending')).toMatchObject({
      tone: 'pending',
      action: 'retry',
    });
    expect(account('offline')).toMatchObject({
      tone: 'pending',
      label: 'Offline',
      action: 'retry',
    });
  });

  it('puts save choices ahead of sync progress', () => {
    expect(account('syncing', { desyncNotice: true })).toMatchObject({
      tone: 'alert',
      action: 'compare',
    });
    // A conflict resolves on return to the village; it never offers an action mid-puzzle.
    expect(account('saved', { conflict: { revision: 4 } })).toMatchObject({
      tone: 'alert',
      action: null,
    });
    expect(account('missing', { missing: true })).toMatchObject({
      tone: 'alert',
      action: 'my-towns',
    });
  });

  it('never claims an unknown status is safely backed up', () => {
    expect(account('Something new')).toMatchObject({ tone: 'pending', action: 'retry' });
  });

  it('shows expired sessions and rejected uploads without claiming a successful backup', () => {
    expect(
      describeSaveState({
        signedIn: true,
        accountTown: true,
        status: 'saved',
        sessionExpired: true,
      }),
    ).toMatchObject({ tone: 'alert', action: 'sign-in' });
    expect(account('saved', { sequence: 2, uploadError: { sequence: 2 } })).toMatchObject({
      tone: 'alert',
      label: 'Backup paused',
    });
    expect(account('saved', { sequence: 3, uploadError: { sequence: 2 } })).toMatchObject({
      tone: 'saved',
    });
    expect(
      account('saved', {
        sequence: 3,
        uploadError: { sequence: 2, code: 'save_format_unsupported' },
      }),
    ).toMatchObject({ tone: 'alert' });
  });

  it('translates every label and detail', () => {
    const states = [
      describeSaveState({ signedIn: false }),
      describeSaveState({ signedIn: true, accountTown: false }),
      account('saved'),
      account('syncing'),
      account('expired'),
      account('', { sequence: 2, uploadError: { sequence: 2 } }),
      account('Unknown'),
      account('pending'),
      account('offline'),
      account('', { desyncNotice: true }),
      account('', { conflict: {} }),
      account('', { missing: true }),
    ];
    const missing = states
      .flatMap(({ label, detail }) => [label, detail])
      .filter((message) => !Object.hasOwn(fr, message));
    expect(missing).toEqual([]);
  });
});

describe('Relative save times', () => {
  const now = Date.UTC(2026, 8, 27, 12);
  it('describes recent and older saves in the player language', () => {
    expect(timeAgo(now - 10_000, now, 'en')).toBe('just now');
    expect(timeAgo(now - 2 * 3600_000, now, 'en')).toBe('2 hours ago');
    expect(timeAgo(now - 86400_000, now, 'en')).toBe('yesterday');
    setLocale('fr');
    expect(timeAgo(now - 10_000, now, 'fr')).toBe('à l’instant');
    expect(timeAgo(now - 3 * 60_000, now, 'fr')).toBe('il y a 3 minutes');
  });
  it('returns nothing for unknown times', () => {
    expect(timeAgo(0, now)).toBeNull();
    expect(timeAgo(undefined, now)).toBeNull();
  });
});
