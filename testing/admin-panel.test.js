import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi, adminSession, adminUrl, AdminError } from '../src/admin/api';
import {
  actionLabel,
  codeLabel,
  describeAgent,
  isOnline,
  levelBucketSize,
  levelBuckets,
  maskEmail,
  niceMax,
  relativeTime,
} from '../src/admin/format';
import { parseRoute } from '../src/admin/routes';
import { compareRows, editedValues, savedField } from '../src/admin/syncCompare';
import { buildingLabel, eraLabel, LEVEL_COUNT, powerLabel } from '../src/admin/labels';

afterEach(() => vi.unstubAllGlobals());

function respond(status, data) {
  return vi.fn(async () => ({ ok: status < 400, status, json: async () => data }));
}

describe('admin API client', () => {
  it('encodes only filled query parameters', () => {
    expect(adminUrl('players', { q: 'a b@c', sort: 'seen', page: 2, empty: '' })).toBe(
      '/api/admin/players?q=a+b%40c&sort=seen&page=2',
    );
    expect(adminUrl('stats')).toBe('/api/admin/stats');
  });

  it('sends the session CSRF token on changes but never on reads', async () => {
    vi.stubGlobal('fetch', respond(200, { stage: 'totp', csrf: 'token-1' }));
    await adminApi('POST', 'login', { body: { username: 'ada', password: 'secret' } });
    expect(adminSession.stage).toBe('totp');
    const login = fetch.mock.calls[0][1];
    expect(login.credentials).toBe('same-origin');
    expect(JSON.parse(login.body)).toEqual({ username: 'ada', password: 'secret' });

    vi.stubGlobal('fetch', respond(200, { ok: true }));
    await adminApi('GET', 'stats');
    expect(fetch.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' });
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
    await adminApi('POST', 'players/abc/sign-out');
    expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBe('token-1');
  });

  it('returns to sign-in when the session is gone', async () => {
    adminSession.stage = 'full';
    vi.stubGlobal('fetch', respond(401, { error: 'Please sign in.' }));
    const error = await adminApi('GET', 'players').catch((e) => e);
    expect(error).toBeInstanceOf(AdminError);
    expect(error).toMatchObject({ status: 401, message: 'Please sign in.' });
    expect(adminSession.stage).toBe('');
    vi.stubGlobal('fetch', respond(200, {}));
    await adminApi('POST', 'logout');
    expect(fetch.mock.calls[0][1].headers['X-CSRF-Token']).toBe('');
  });

  it('keeps the session on other failures and explains non-JSON errors', async () => {
    adminSession.stage = 'full';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('HTML');
        },
      })),
    );
    await expect(adminApi('GET', 'stats')).rejects.toThrow('The request failed (502).');
    expect(adminSession.stage).toBe('full');
  });
});

describe('admin formatting', () => {
  const now = 1_800_000_000;
  it('describes when a player was last seen', () => {
    expect(relativeTime(null, now)).toBe('never');
    expect(relativeTime(now - 20, now)).toBe('just now');
    expect(relativeTime(now - 125, now)).toBe('2 min ago');
    expect(relativeTime(now - 3 * 3600, now)).toBe('3 h ago');
    expect(relativeTime(now - 86400, now)).toBe('1 day ago');
    expect(relativeTime(now - 10 * 86400, now)).toBe('10 days ago');
    expect(relativeTime(now - 90 * 86400, now)).not.toMatch(/ago/);
    expect(isOnline(now - 299, now)).toBe(true);
    expect(isOnline(now - 301, now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
  });

  it('names browsers and systems from user agents', () => {
    expect(
      describeAgent(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome on Android');
    expect(
      describeAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
    expect(
      describeAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      ),
    ).toBe('Edge on Windows');
    expect(
      describeAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0',
      ),
    ).toBe('Firefox on macOS');
    expect(describeAgent(null)).toBe('Unknown');
    expect(describeAgent('curl/8.0')).toBe('Other browser');
  });

  it('masks emails for screen sharing', () => {
    expect(maskEmail('prospector@example.com')).toBe('p•••@example.com');
    expect(maskEmail('broken')).toBe('•••');
  });

  it('groups towns by completed levels across the whole campaign', () => {
    const buckets = levelBuckets([0, 0, 1, 12, 13, LEVEL_COUNT, LEVEL_COUNT + 5], LEVEL_COUNT, 12);
    expect(buckets[0]).toMatchObject({ label: '0', towns: 2 });
    expect(buckets[1]).toMatchObject({ label: '1–12', towns: 2 });
    expect(buckets[2]).toMatchObject({ label: '13–24', towns: 1 });
    expect(buckets.at(-1).to).toBe(LEVEL_COUNT);
    expect(buckets.at(-1).towns).toBe(2);
    expect(buckets.reduce((sum, bucket) => sum + bucket.towns, 0)).toBe(7);
  });

  it('sizes progress buckets in whole chapters, at most eight', () => {
    expect(levelBucketSize(72)).toBe(12);
    expect(levelBucketSize(372)).toBe(48);
    expect(levelBucketSize(12)).toBe(6);
    const buckets = levelBuckets([], LEVEL_COUNT, levelBucketSize(LEVEL_COUNT));
    expect(buckets.length).toBeLessThanOrEqual(9);
    expect(buckets.every((bucket) => bucket.from === 0 || (bucket.from - 1) % 6 === 0)).toBe(true);
  });

  it('rounds chart scales to 1, 2 or 5 times a power of ten', () => {
    expect([0, 1, 3, 7, 12, 48, 101].map(niceMax)).toEqual([1, 1, 5, 10, 20, 50, 200]);
  });

  it('labels audit actions, including ones added later', () => {
    expect(actionLabel('town_restored')).toBe('Restored town revision');
    expect(actionLabel('town_sync_forced')).toBe('Set town to accept next sync');
    expect(actionLabel('privacy_contact_changed')).toBe('Changed privacy contact');
    expect(actionLabel('future_thing')).toBe('future thing');
  });
});

describe('admin routes and game labels', () => {
  it('parses hash routes and falls back to the overview', () => {
    expect(parseRoute('')).toEqual({ section: 'overview', id: '' });
    expect(parseRoute('#/players')).toEqual({ section: 'players', id: '' });
    expect(parseRoute('#/towns/0a1b-c')).toEqual({ section: 'towns', id: '0a1b-c' });
    expect(parseRoute('#/log')).toEqual({ section: 'log', id: '' });
    expect(parseRoute('#/settings')).toEqual({ section: 'settings', id: '' });
    expect(parseRoute('#/nowhere/5')).toEqual({ section: 'overview', id: '' });
  });

  it('names saved ids and keeps unknown ones from newer saves readable', () => {
    expect(eraLabel('frontier')).toBe('Frontier Settlement');
    expect(eraLabel('far-future')).toBe('far-future');
    expect(eraLabel('')).toBe('—');
    expect(buildingLabel('home2')).toBe('Willow house');
    expect(buildingLabel('moonbase')).toBe('moonbase');
    expect(powerLabel('tnt')).toBe('TNT');
  });
});

describe('sync comparison', () => {
  const cloud = {
    town: { coins: 10, era: 'frontier', buildings: { well: 1 }, projects: [] },
    powers: { tnt: 1 },
    integrity: { epoch: 'cloud' },
  };
  const expected = {
    town: { coins: 12, era: 'frontier', buildings: { well: 1 }, projects: [] },
    powers: { tnt: 2 },
  };
  const upload = {
    town: { coins: 512, era: 'frontier', buildings: { well: 1 }, projects: { well: { stage: 2 } } },
    powers: { tnt: 2 },
    integrity: { epoch: 'upload' },
  };

  it('puts the rejected value first, then what the server would not take', () => {
    const rows = compareRows({ cloud, expected, upload, field: 'town.coins' });
    expect(rows.map((row) => row.label)).toEqual([
      'town.coins',
      'town.projects.well.stage',
      'powers.tnt',
    ]);
    expect(rows[0]).toMatchObject({ rejected: true, cloud: 10, expected: 12, upload: 512 });
    expect(rows[1]).toMatchObject({ rejected: false, mismatch: true, cloud: undefined });
    expect(rows[2]).toMatchObject({ rejected: false, mismatch: false, cloud: 1, upload: 2 });
  });

  it('compares with the cloud save when the server stopped before replaying', () => {
    const rows = compareRows({ cloud, expected: null, upload, field: 'integrity.sequence' });
    expect(rows.every((row) => row.mismatch && !row.rejected)).toBe(true);
    expect(rows.map((row) => row.label)).not.toContain('integrity.epoch');
  });

  it('treats a missing value and an empty map or list as the same', () => {
    const rows = compareRows({
      cloud: { honours: { verified: [] }, town: { coins: 1 } },
      expected: { honours: { verified: [] }, town: { coins: 1 } },
      upload: { town: { coins: 1, projects: {} } },
      field: null,
    });
    expect(rows).toEqual([]);
  });

  it('finds compared landmarks under their saved name', () => {
    expect(savedField('town.landmarks.areas.porch')).toBe('town.personalisation.areas.porch');
    expect(savedField('town.landmarksx')).toBe('town.landmarksx');
    expect(savedField(null)).toBe('');
  });

  it('sends only edited values, typed as JSON or text', () => {
    const rows = compareRows({ cloud, expected, upload, field: 'town.coins' });
    const [coins, stage, tnt] = rows;
    expect(
      editedValues(rows, 'cloud', { [coins.key]: '777', [stage.key]: '', [tnt.key]: '1' }),
    ).toEqual([{ path: ['town', 'coins'], value: 777 }]);
    expect(editedValues(rows, 'upload', { [stage.key]: 'built' })).toEqual([
      { path: ['town', 'projects', 'well', 'stage'], value: 'built' },
    ]);
  });

  it('names rejection reasons, including ones added later', () => {
    expect(codeLabel('save_integrity_mismatch')).toBe(
      'Progress did not match the replayed actions',
    );
    expect(codeLabel('save_future_check')).toBe('save future check');
  });
});
