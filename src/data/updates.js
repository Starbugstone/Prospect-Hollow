// Player-facing release notes shown on the home page, newest first. Titles and
// text are English keys for t(); add the French text to src/i18n/fr.json.
const UPDATES = [
  {
    date: '2026-10-06',
    title: 'Earn Town Honours',
    text: 'Earn bronze, silver and gold honours for mine puzzles, town milestones and visits between towns, then pick three for your showcase beside your town name. Player distinctions such as Alpha Player mark your time in Prospect Hollow.',
  },
  {
    date: '2026-10-06',
    title: 'Share your town in one tap',
    text: 'Your town cards and guestbook now show whether your town is shared, with a Share my town button wherever visitors come up. Find shared towns by name and keep your favourites with a star.',
  },
  {
    date: '2026-10-06',
    title: 'Easier to play, in town and in the mine',
    text: 'A new tab bar keeps the village, building, the mine and your story one tap away. Drag armory bonuses from the power bar onto the board, and finished obstacles now leave the board completely.',
  },
  {
    date: '2026-10-03',
    title: 'Canopy and Riverlight are here',
    text: 'Two new eras follow Tomorrow City: Canopy Age and Riverlight Age. Build six new landmarks, from a riverside tea house to a glowing pavilion, and meet garden wildlife and Willowkin neighbors.',
  },
  {
    date: '2026-10-03',
    title: 'A livelier, smoother town',
    text: 'Explore your growing town with less stutter as buildings change and clearer lettering on building signs. Villagers, birds and roaming wildlife keep the streets and gardens lively.',
  },
  {
    date: '2026-10-02',
    title: 'Go deeper: 30 new mine puzzles',
    text: 'The campaign now reaches level 402. Charge forge braziers, uncover fossils, chain mushroom bursts, release linked roots and guide pearls through underground funnels. Moves stay unlimited.',
  },
  {
    date: '2026-10-01',
    title: 'A jackpot even with full bonuses',
    text: 'When your powers and builder hammers are full, the jackpot reel now spins between small, regular and big coin purses. Keep collecting coins while you save your bonuses for later.',
  },
  {
    date: '2026-09-29',
    title: 'Welcome visitors to your town',
    text: 'Share your town, welcome live visitors and see who stopped by in the guestbook. Visit another mayor, find your character in their streets and collect saloon takings to help their town.',
  },
  {
    date: '2026-09-28',
    title: 'Explore Tomorrow City’s mine',
    text: 'Explore 48 puzzles across eight Tomorrow City chapters, levels 325–372. Nearby matches charge cores that release a free bonus gem among domes, maglev loops and solar terraces.',
  },
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
