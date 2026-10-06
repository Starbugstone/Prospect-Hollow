// The privacy notice: what the game keeps, why, for how long and who can see it. The
// /privacy page and the Mayor's Office both read these definitions, so a retention
// change is made once. Every text is an English key for t(); add the French text to
// src/i18n/fr.json (testing/player-data.test.js checks it).

// Shown as "Last updated" on the notice. Raise it whenever the notice changes.
export const PRIVACY_UPDATED = '2026-10-07';

// How long each kind of data is kept, matching backend/bin/cleanup.php and the API.
export const RETENTION = {
  signInLink: '15 minutes',
  emailChangeLink: '1 hour',
  session: '30 days',
  activeDays: '90 days',
  deletedTown: '30 days',
  earlierSaves: 'the 5 previous saves of each town',
  adminLog: '3 months',
  hostRecords: 'at most 30 days',
};

// An optional contact address for privacy requests, set at build time.
export const privacyContact = (env = import.meta.env) => env.VITE_PRIVACY_CONTACT || '';

export const PRIVACY_SUMMARY = [
  'You can play without an account. Your game then stays on your device.',
  'With an account we keep your email address, your towns and when you last played.',
  'No ads, no analytics, no tracking cookies, and nothing is sold or shared for marketing.',
  'Download or delete everything at any time from the Mayor’s Office.',
];

// Each row: the data, why it is kept, the legal basis and how long it stays.
export const PRIVACY_DATA = [
  {
    data: 'Your email address',
    why: 'To send sign-in links and the few emails about your account, such as a deletion or email change.',
    basis: 'Providing the account you asked for',
    kept: 'Until you delete your account',
  },
  {
    data: 'Your towns, earlier saves and honours',
    why: 'To keep your progress safe and let you play on several devices.',
    basis: 'Providing the account you asked for',
    kept: 'Until you delete the town or your account; {earlierSaves}; a deleted town is removed after {deletedTown}',
  },
  {
    data: 'Public name, shared towns and guestbook visits',
    why: 'To show other mayors who visited, only when you choose to share or set a name.',
    basis: 'Providing the account you asked for',
    kept: 'Until you change them or delete your account; your visits then stay in other towns without your name',
  },
  {
    data: 'Last connection: time, IP address, browser and device type',
    why: 'To protect accounts and spot abuse. Only the latest connection is kept.',
    basis: 'Legitimate interest: security',
    kept: 'Replaced at each visit; active days for {activeDays}',
  },
  {
    data: 'Sign-in sessions',
    why: 'To keep you signed in on your devices.',
    basis: 'Providing the account you asked for',
    kept: '{session}, or until you sign out',
  },
  {
    data: 'Pending sign-in and email change links',
    why: 'To check that you own the address.',
    basis: 'Providing the account you asked for',
    kept: '{signInLink} for sign-in links, {emailChangeLink} for email changes',
  },
  {
    data: 'Request counters and web server records',
    why: 'To limit abuse and keep the game running. Counters are scrambled and cannot be read back.',
    basis: 'Legitimate interest: security',
    kept: 'Counters for at most an hour; host records and backups {hostRecords}',
  },
];

export const PRIVACY_SECTIONS = [
  {
    id: 'device',
    title: 'Playing without an account',
    paragraphs: [
      'Your village, progress and settings are saved in your browser on this device. They never reach our server unless you sign in.',
      'Visiting a shared town adds an unnamed entry to its guestbook, tied to a random number your browser keeps. Collecting a saloon for another mayor stores only the time.',
    ],
  },
  {
    id: 'storage',
    title: 'Cookies and storage on your device',
    paragraphs: [
      'When you sign in, one cookie keeps you signed in. It is needed for the account to work, so no consent banner is required.',
      'The game keeps its saves, backups and settings in your browser storage. You can download or erase them from the Mayor’s Office or by clearing this site’s data.',
    ],
  },
  {
    id: 'public',
    title: 'What other players see',
    paragraphs: [
      'Only what you choose to share: towns you make public, your public name and the home town you visit as. Turn on private visits to sign guestbooks without your name or town.',
      'Other players never see your email address.',
    ],
  },
  {
    id: 'access',
    title: 'Who can access your data',
    paragraphs: [
      'Our host, o2switch in France, stores your account data and sends the game’s emails. It processes them only on our behalf.',
      'The game’s administrators can see accounts to fix problems and stop cheating. Their actions are logged for {adminLog}, with account IDs but never email addresses.',
    ],
  },
  {
    id: 'rights',
    title: 'Your rights',
    paragraphs: [
      'You can see, download, correct and delete your data yourself in the Mayor’s Office: Download my data, Change email and Delete my account.',
      'Deleting your account removes your email, towns, saves, sessions and activity at once. Visits you paid to other towns stay as unnamed visits so those mayors keep their counts. Backups are overwritten within {hostRecords}.',
      'You can also object to the security records or ask any question. If you are not satisfied with our answer, you can complain to the CNIL, the French data protection authority (cnil.fr).',
    ],
  },
  {
    id: 'age',
    title: 'Children',
    paragraphs: [
      'If you are under 15, ask a parent or guardian before creating an account. You can always play without one.',
    ],
  },
];

// Replaces {name} retention placeholders in a notice text, after translation.
export function retentionValues(t) {
  return Object.fromEntries(Object.entries(RETENTION).map(([key, value]) => [key, t(value)]));
}

// Every English key of the notice, for the translation check.
export function privacyMessages() {
  return [
    ...Object.values(RETENTION),
    ...PRIVACY_SUMMARY,
    ...PRIVACY_DATA.flatMap((row) => Object.values(row)),
    ...PRIVACY_SECTIONS.flatMap((section) => [section.title, ...section.paragraphs]),
  ];
}
