// Player-facing release notes shown on the home page, newest first. Titles and
// text are English keys for t(); add the French text to src/i18n/fr.json.
const UPDATES = [
  {
    date: '2026-09-28',
    title: 'Your own home page',
    text: 'The game now opens at its own address, so this page stays one tap away with the latest news. Sign in with your email here to back up your town and keep up to three towns.',
  },
  {
    date: '2026-09-28',
    title: 'Live score in the mine',
    text: 'Follow your score, stars and chests while you play. Every run now earns simple completion, score and speed chests.',
  },
  {
    date: '2026-09-28',
    title: 'A smoother village',
    text: 'The village no longer freezes after a trip to the mine and gets more of the screen on phones.',
  },
  {
    date: '2026-09-27',
    title: 'Safer saves across devices',
    text: 'When you play one town on two devices, both saves are kept so you can choose which one to continue.',
  },
];

export const latestUpdates = (count = 3) => UPDATES.slice(0, count);
