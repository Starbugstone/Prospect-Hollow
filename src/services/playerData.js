import { request } from './cloudProfile';
import { recoveryStore } from './recoveryStore';
import { downloadSaveFile } from './saveTransfer';
import { privacyUrl } from './appRoute';
import { t } from '../i18n';

// The contact address an admin set for privacy requests, or null; no account needed.
export const loadPrivacyContact = async () =>
  (await request('privacy', undefined, 'GET', true)).contact ?? null;
// The account overview: counts and the latest connection the server keeps.
export const loadDataSummary = () => request('account/data');
// Mails a link to the new address; the account keeps its email until the link is opened.
export const requestEmailChange = (email) => request('account/email', { email });
// The link proves the new address, so it is confirmed with or without a session here.
export const confirmEmailChange = (token) =>
  request('account/email/confirm', { token }, 'POST', true);

// "Firefox on Windows" for the last connection, so players recognise their own device.
const BROWSERS = [
  ['Edge', /Edg\//],
  ['Opera', /OPR\//],
  ['Samsung Internet', /SamsungBrowser\//],
  ['Firefox', /Firefox\/|FxiOS\//],
  ['Chrome', /Chrome\/|CriOS\//],
  ['Safari', /Safari\//],
];
const SYSTEMS = [
  ['Android', /Android/],
  ['iOS', /iPhone|iPad|iPod/],
  ['Windows', /Windows/],
  ['macOS', /Mac OS X|Macintosh/],
  ['ChromeOS', /CrOS/],
  ['Linux', /Linux/],
];
export function describeBrowser(agent) {
  if (!agent) return '';
  const browser = BROWSERS.find(([, pattern]) => pattern.test(agent))?.[0];
  const system = SYSTEMS.find(([, pattern]) => pattern.test(agent))?.[0];
  if (browser && system) return t('{browser} on {system}', { browser, system });
  return browser ?? system ?? agent.slice(0, 60);
}

// Shows the start and domain only: c•••••@example.com.
export function maskEmail(email) {
  const [name, domain] = String(email ?? '').split('@');
  return domain ? `${name.slice(0, 1)}${'•'.repeat(Math.max(3, name.length - 1))}@${domain}` : '';
}

export const dataFileName = (kind, now = new Date()) =>
  `prospect-hollow-${kind}-${now.toISOString().slice(0, 10)}.json`;

// A readable header for every downloaded data file.
const about = (scope) => ({
  game: 'Prospect Hollow',
  contents: t(scope),
  privacyNotice: privacyUrl(),
});

// Everything the server keeps about the signed-in account.
export async function downloadAccountData(now = new Date()) {
  const data = await request('account/export');
  downloadSaveFile(
    JSON.stringify(
      {
        about: about(
          'Everything Prospect Hollow keeps about your account: your email address, your towns and their earlier saves, your public profile, your last connection, the towns you visited and your distinctions.',
        ),
        ...data,
      },
      null,
      2,
    ),
    dataFileName('account-data', now),
  );
}

const readable = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// The game's browser storage and local backups, which never leave the device.
export async function collectDeviceData({
  storage = globalThis.localStorage,
  recoveries = recoveryStore,
  now = new Date(),
} = {}) {
  const browserStorage = {};
  for (let index = 0; index < (storage?.length ?? 0); index++) {
    const key = storage.key(index);
    browserStorage[key] = readable(storage.getItem(key));
  }
  let localBackups;
  try {
    localBackups = await recoveries.all();
  } catch {
    localBackups = { unavailable: true };
  }
  return {
    about: about(
      'What Prospect Hollow keeps in this browser: your saved towns, settings and local backups. It never leaves this device unless you sign in.',
    ),
    exportedAt: now.toISOString(),
    browserStorage,
    localBackups,
  };
}

export async function downloadDeviceData(options = {}) {
  const data = await collectDeviceData(options);
  downloadSaveFile(
    JSON.stringify(data, null, 2),
    dataFileName('device-data', new Date(data.exportedAt)),
  );
}
