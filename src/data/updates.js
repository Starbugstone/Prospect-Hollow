// Player-facing release notes shown on the home page, newest first. Titles and
// text are English keys for t(); add the French text to src/i18n/fr.json.
const UPDATES = [
  {
    date: '2026-10-10',
    title: 'A friendlier start in the village',
    text: 'Every new town now has a short guided start: Ada points at the next thing to tap, from the first well to your first finished saloon. Frontier buildings all finish at level 3 with their full benefits, so the first era is quicker, and each of its two starter projects gives you a builder hammer. Monument upgrades take a single puzzle, and you can enter the mine by tapping anywhere on its buildings or hill.',
  },
  {
    date: '2026-10-08',
    title: 'The floating seam: 144 new mine puzzles',
    text: 'The campaign now reaches level 546. Lift floatstones to sky hatches, bend beams with lens mirrors, ride portals, break into sealed chambers and turn whole caverns upside down with moon locks and dials. Peridot and starmetal join the gems, and moves stay unlimited.',
  },
  {
    date: '2026-10-08',
    title: 'Twin Hollows: a new frontier on the Moon',
    text: 'Ride the ribbon to New Hollow and build a Moon settlement: settler domes, crater ice, a greenhouse lit by Earth and a Willowkin garden under glass. Back in the valley, a few homecoming landmarks light twin lanterns, Moon guests ride down the elevator, and visitors to your shared town can see your Moon too.',
  },
  {
    date: '2026-10-07',
    title: 'Three new eras: Skysail, Stargazer and Moonward',
    text: 'Raise sailcloth roofs and floating orchards, turn every street toward the stars, then build a space elevator beside the old mine. Cross the railway to the new Skyward quarter, and watch homestead lights appear on the Moon as you send up supplies.',
  },
  {
    date: '2026-10-07',
    title: 'Your data, your choice',
    text: 'Open the Mayor’s Office from Settings to see what we keep about you, download it, change your email or delete your account for good. Turn on private visits to sign guestbooks without your name, and read the new privacy notice from the home page.',
  },
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
