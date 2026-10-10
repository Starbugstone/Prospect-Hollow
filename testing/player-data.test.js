import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import fr from '../src/i18n/fr.json';
import { setLocale } from '../src/i18n';
import {
  PRIVACY_DATA,
  PRIVACY_SECTIONS,
  PRIVACY_SUMMARY,
  RETENTION,
  privacyMessages,
} from '../src/data/privacy';
import { isPrivacyRoute, privacyUrl } from '../src/services/appRoute';

const { request, download } = vi.hoisted(() => ({ request: vi.fn(), download: vi.fn() }));
vi.mock('../src/services/cloudProfile', () => ({
  request,
  cloud: { account: { id: 'a', email: 'mayor@example.test' } },
}));
vi.mock('../src/services/saveTransfer', () => ({ downloadSaveFile: download }));
const {
  collectDeviceData,
  confirmEmailChange,
  dataFileName,
  describeBrowser,
  downloadAccountData,
  loadDataSummary,
  loadPrivacyContact,
  maskEmail,
  requestEmailChange,
} = await import('../src/services/playerData');
const { provideAccountContext } = await import('../src/components/account/accountContext');
const OfficeData = (await import('../src/components/account/OfficeData.vue')).default;
const AccountDeletion = (await import('../src/components/account/AccountDeletion.vue')).default;
const PrivacyPage = (await import('../src/components/privacy/PrivacyPage.vue')).default;

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://hollow.test/play'));
});
afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
  request.mockReset();
  download.mockReset();
});

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// Player-facing strings of the privacy screens: t('…') literals, tab and fact labels, and
// panel messages, which are all translated when shown.
function messagesIn(path) {
  const source = read(path);
  return [
    ...source.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g),
    ...source.matchAll(/\blabel: '((?:[^'\\]|\\.)*)'/g),
    ...source.matchAll(/message\.value = '((?:[^'\\]|\\.)*)'/g),
    ...source.matchAll(/^\s+'((?:[^'\\]|\\.){20,})',?$/gm),
  ]
    .map((match) => match[1].replace(/\\'/g, "'"))
    .filter(Boolean);
}
const SCREENS = [
  'src/components/account/MayorOffice.vue',
  'src/components/account/OfficeData.vue',
  'src/components/account/EmailChange.vue',
  'src/components/account/AccountDeletion.vue',
  'src/components/account/AccountPanel.vue',
  'src/components/account/AccountSignIn.vue',
  'src/components/account/PublicProfile.vue',
  'src/components/account/TownSlots.vue',
  'src/components/account/TownManage.vue',
  'src/components/account/TownDeleteDialog.vue',
  'src/components/privacy/PrivacyPage.vue',
  'src/components/SettingsDrawer.vue',
  'src/components/LandingView.vue',
  'src/services/playerData.js',
];

describe('Privacy notice', () => {
  it('translates the notice, the Mayor’s Office and every data screen into French', () => {
    const messages = [...privacyMessages(), ...SCREENS.flatMap(messagesIn)];
    expect(messages.length).toBeGreaterThan(100);
    expect([...new Set(messages)].filter((message) => !Object.hasOwn(fr, message))).toEqual([]);
  });

  it('promises only the retention the server enforces', () => {
    const cleanup = read('backend/bin/cleanup.php');
    const auth = read('backend/src/Auth.php');
    const saves = read('backend/src/SaveService.php');
    const data = read('backend/src/PlayerData.php');
    expect(RETENTION.signInLink).toBe('15 minutes');
    expect(auth).toContain("'expires_at' => time() + 900");
    expect(RETENTION.session).toBe('30 days');
    expect(auth).toMatch(/time\(\) \+ 2592000/);
    expect(RETENTION.emailChangeLink).toBe('1 hour');
    expect(data).toContain('EMAIL_CHANGE_SECONDS = 3600');
    expect(RETENTION.activeDays).toBe('90 days');
    expect(cleanup).toContain('intdiv(time(), 86400) - 90');
    expect(RETENTION.deletedTown).toBe('30 days');
    expect(cleanup).toContain('time() - 30 * 86400');
    expect(RETENTION.earlierSaves).toBe('the 5 previous saves of each town');
    expect(RETENTION.helmetFinds).toBe('30 days');
    expect(read('backend/src/PublicTown.php')).toContain('HELMET_KEEP = 30 * 86400');
    expect(cleanup).toContain('App\\PublicTown::HELMET_KEEP');
    expect(saves).toContain("(int) $row['revision'] - 4");
  });

  it('fills every retention placeholder and keeps rows complete', () => {
    const placeholders = privacyMessages()
      .join(' ')
      .match(/\{(\w+)\}/g)
      .map((token) => token.slice(1, -1));
    expect(placeholders.filter((key) => !Object.hasOwn(RETENTION, key))).toEqual([]);
    for (const row of PRIVACY_DATA)
      expect(Object.keys(row)).toEqual(['data', 'why', 'basis', 'kept']);
    expect(new Set(PRIVACY_SECTIONS.map((section) => section.id)).size).toBe(
      PRIVACY_SECTIONS.length,
    );
  });

  it('renders as its own page, in French when the browser prefers it', async () => {
    setLocale('fr');
    const html = await renderToString(createSSRApp(PrivacyPage));
    expect(html).toContain(fr[PRIVACY_SUMMARY[0]]);
    expect(html).toContain(fr['Your rights']);
    expect(html).toContain(fr['90 days']);
    expect(html).not.toMatch(/\{\w+\}/);
  });

  it('reads the contact an admin set, without an account', async () => {
    request.mockResolvedValueOnce({ contact: 'privacy@example.test' });
    await expect(loadPrivacyContact()).resolves.toBe('privacy@example.test');
    expect(request).toHaveBeenCalledWith('privacy', undefined, 'GET', true);
    request.mockResolvedValueOnce({ contact: null });
    await expect(loadPrivacyContact()).resolves.toBe(null);
  });

  it('lives at /privacy on the public site, also from the app', () => {
    expect(isPrivacyRoute(new URL('https://hollow.test/privacy'))).toBe(true);
    expect(isPrivacyRoute(new URL('https://hollow.test/privacy/'))).toBe(true);
    expect(isPrivacyRoute(new URL('https://hollow.test/play'))).toBe(false);
    expect(privacyUrl({ VITE_PUBLIC_ORIGIN: 'https://hollow.test/' })).toBe(
      'https://hollow.test/privacy',
    );
    expect(privacyUrl({ VITE_API_BASE: 'https://api.hollow.test/api/v1' })).toBe(
      'https://api.hollow.test/privacy',
    );
  });
});

describe('Player data services', () => {
  it('reads the overview and asks for an email change with the signed-in session', async () => {
    request.mockResolvedValue({});
    await loadDataSummary();
    await requestEmailChange('new@example.test');
    expect(request.mock.calls).toEqual([
      ['account/data'],
      ['account/email', { email: 'new@example.test' }],
    ]);
  });

  it('confirms an email change from the link alone, signed in or not', async () => {
    request.mockResolvedValue({ email: 'new@example.test' });
    await expect(confirmEmailChange('f'.repeat(64))).resolves.toEqual({
      email: 'new@example.test',
    });
    expect(request).toHaveBeenCalledWith(
      'account/email/confirm',
      { token: 'f'.repeat(64) },
      'POST',
      true,
    );
  });

  it('downloads the account export as a dated, readable file', async () => {
    request.mockResolvedValue({ account: { email: 'mayor@example.test' } });
    await downloadAccountData(new Date('2026-10-07T12:00:00Z'));
    expect(request).toHaveBeenCalledWith('account/export');
    const [text, name] = download.mock.calls[0];
    expect(name).toBe('prospect-hollow-account-data-2026-10-07.json');
    const file = JSON.parse(text);
    expect(file.about.privacyNotice).toMatch(/\/privacy$/);
    expect(file.account.email).toBe('mayor@example.test');
  });

  it('collects this browser’s storage and local backups', async () => {
    const values = new Map([
      ['crystal-cascade-profile-v3', '{"town":{"coins":5}}'],
      ['crystal-cascade-village-labels', 'true'],
      ['plain', 'not json'],
    ]);
    const storage = {
      length: values.size,
      key: (index) => [...values.keys()][index],
      getItem: (key) => values.get(key),
    };
    const now = new Date('2026-10-07T00:00:00Z');
    const device = await collectDeviceData({
      storage,
      recoveries: { all: async () => ({ copies: [{ id: 'c1' }], uploads: [] }) },
      now,
    });
    expect(device.browserStorage).toEqual({
      'crystal-cascade-profile-v3': { town: { coins: 5 } },
      'crystal-cascade-village-labels': true,
      plain: 'not json',
    });
    expect(device.localBackups).toEqual({ copies: [{ id: 'c1' }], uploads: [] });
    expect(device.exportedAt).toBe(now.toISOString());
    const unavailable = await collectDeviceData({
      storage,
      recoveries: {
        all: async () => {
          throw new Error('blocked');
        },
      },
    });
    expect(unavailable.localBackups).toEqual({ unavailable: true });
    expect(dataFileName('device-data', now)).toBe('prospect-hollow-device-data-2026-10-07.json');
  });

  it('names the browser and hides most of the email address', () => {
    expect(
      describeBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
      ),
    ).toBe('Firefox on Windows');
    expect(
      describeBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
    expect(
      describeBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      ),
    ).toBe('Edge on Windows');
    // The same table as the admin panel: Edge on Android names itself EdgA.
    expect(
      describeBrowser(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 EdgA/129.0',
      ),
    ).toBe('Edge on Android');
    expect(describeBrowser(null)).toBe('');
    expect(describeBrowser('curl/8.0')).toBe('curl/8.0');
    setLocale('fr');
    expect(describeBrowser('Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0')).toBe(
      'Firefox sur Linux',
    );
    expect(maskEmail('clementine@example.test')).toBe('c•••••••••@example.test');
    expect(maskEmail('al@example.test')).toBe('a•••@example.test');
    expect(maskEmail('')).toBe('');
  });
});

describe('Mayor’s Office screens', () => {
  const summary = {
    email: 'mayor@example.test',
    createdAt: Date.UTC(2026, 2, 1),
    publicName: 'Clementine',
    anonymousVisits: true,
    lastSeenAt: Date.UTC(2026, 9, 7, 14, 2),
    lastIp: '203.0.113.7',
    lastBrowser: 'Mozilla/5.0 (Windows NT 10.0) Firefox/131.0',
    platform: 'web',
    lastSignInAt: Date.UTC(2026, 9, 1),
    emailSignIns: 4,
    activeDays: 41,
    sessions: 2,
    towns: 2,
    deletedTowns: 1,
    savedVersions: 37,
    honours: 14,
    distinctions: 1,
    visits: 12,
    townsVisited: 9,
    favourites: 3,
    pendingEmail: null,
  };
  const render = (component, props) =>
    renderToString(
      createSSRApp({
        setup() {
          provideAccountContext({ changed: () => {} });
          return () => h(component, props);
        },
      }),
    );

  it('shows the player every value the server keeps', async () => {
    const html = await render(OfficeData, { summary });
    for (const value of [
      'mayor@example.test',
      'Clementine',
      '203.0.113.7',
      'Firefox on Windows',
      'Saved versions: 37',
      'Deleted towns: 1, removed after 30 days',
      'Town Honours: 14 · player distinctions: 1',
      'Visits: 12',
      'Kept 90 days',
    ])
      expect(html).toContain(value);
  });

  it('lists what deleting the account loses before asking for the phrase', async () => {
    const html = await render(AccountDeletion, { summary });
    expect(html).toContain('Your cloud towns (3) and their saved versions (37)');
    expect(html).toContain('Your Town Honours (14) and player distinctions (1)');
    expect(html).toContain('Type DELETE MY ACCOUNT to confirm');
    expect(html).toMatch(/<button[^>]*class="account-destructive"[^>]*disabled/);
  });
});
