import { MOON_DISTRICTS, moonDistrictsShown } from './moonSettlement';

// The Quiet Signal's story, read from what the town has built in the Far Rim: nothing is
// saved for it. Three stages follow the arrival of the stone: Listen, Understand, Answer.
// The stone itself never changes. Who made it, and what it is to the Willowkin, stays open.
const FAR_RIM = MOON_DISTRICTS.farRim;
// The two who noticed it first. They write the stage letters and send the answer.
const SIGNAL_WRITERS = Object.freeze({
  osier: 'Osier · keeper of the orchard vaults',
  maren: 'Maren Voss · instrument maker',
  both: 'Osier and Maren Voss',
});
const level = (town, id) => town?.buildings?.[id] ?? 0;
/** Ordered story stages; each is reached for good, as building levels only rise. */
export const SIGNAL_STAGES = Object.freeze([
  'arrival',
  'listen',
  'understand',
  'answer',
  'answered',
]);
/** The story stage a town has reached, or null before the stone appears. */
export function signalStage(town) {
  if (!moonDistrictsShown(town).includes(FAR_RIM)) return null;
  if (level(town, 'signalTerrace') >= 3) return 'answered';
  if (level(town, 'signalTerrace') >= 1) return 'answer';
  if (level(town, 'listeningHouse') >= 2 && level(town, 'resonanceWorkshop') >= 1)
    return 'understand';
  return level(town, 'listeningHouse') >= 1 ? 'listen' : 'arrival';
}
const reached = (town, stage) =>
  SIGNAL_STAGES.indexOf(signalStage(town)) >= SIGNAL_STAGES.indexOf(stage);
/** Whether the town has sent its answer: the stone's ribbon of light lies across the dust. */
export const signalAnswered = (town) => signalStage(town) === 'answered';

// What the stone's label says when it is tapped: one plain line for each stage.
const STONE_LINES = Object.freeze({
  arrival: 'Still and silent',
  listen: 'A pulse, every ninety-one seconds',
  understand: 'The pattern of the valley’s crystals',
  answer: 'New Hollow is preparing its answer',
  answered: 'It answered',
});
export const QUIET_STONE = Object.freeze({ id: FAR_RIM.stone.id, name: 'The Quiet Stone' });
/** The stone's label for a town: `{ id, name, line }`, or null before it appears. */
export function quietStoneLabel(town) {
  const stage = signalStage(town);
  return stage ? { ...QUIET_STONE, line: STONE_LINES[stage] } : null;
}

// Letters from the Far Rim, in the order the story unfolds. Each appears once its moment is
// reached and stays. A new beat adds one entry.
const SIGNAL_LETTERS = Object.freeze([
  {
    id: 'signal-first-pulse',
    from: SIGNAL_WRITERS.osier,
    when: (town) => reached(town, 'arrival'),
    text: 'I was pruning in the greenhouse when the sun reached the black stone beyond the rim. Every crystal instrument on the bench brightened, dimmed and brightened again, all of them together. I have counted it on four mornings now, and it has not missed once. I have asked Maren to come and see.',
  },
  {
    id: 'signal-too-small',
    from: SIGNAL_WRITERS.maren,
    when: (town) => reached(town, 'arrival'),
    text: 'Osier was right. I set a tuning crystal on the sill and timed it against my own heartbeat. The stone keeps a rhythm, and my instruments are too small to hear the rest of it. We need a house built for listening.',
  },
  {
    id: 'signal-long-pattern',
    from: SIGNAL_WRITERS.maren,
    when: (town) => level(town, 'listeningHouse') >= 2,
    text: 'The dishes follow the stone’s shadow now. The pulse is not one beat. It is a long pattern that repeats, with shorter patterns folded inside it. I have drawn the first hundred turns. Osier studied my drawing for a long while and said the roots in the garden already know it.',
  },
  {
    id: 'signal-valley-seams',
    from: SIGNAL_WRITERS.osier,
    when: (town) => reached(town, 'understand'),
    text: 'Maren laid her drawing of the pattern beside an old survey of the valley mine. The crystal seams under Prospect Hollow branch in the same order, turn for turn. We do not know which came first, or whether one made the other. We checked it three times, and then we sat together without speaking.',
  },
  {
    id: 'signal-why',
    from: SIGNAL_WRITERS.maren,
    when: (town) => reached(town, 'understand') && level(town, 'resonanceWorkshop') >= 2,
    text: 'People ask me whether the stone planted our crystals or only recognises them. I tell them what I know. I can measure the pattern. I cannot measure why. The Willowkin do not ask. They walk out to it in the evening and stand there, the way they stand among old trees.',
  },
  {
    id: 'signal-same-shape',
    from: SIGNAL_WRITERS.maren,
    when: (town) => reached(town, 'answer'),
    text: 'If it speaks in the shape of our crystals, we can answer in the same shape. Osier is growing the tonewood, I am tuning the resonators, and the school is choosing what to say. The children want to send the tune they hum on the way to class. Nobody has thought of anything truer.',
  },
  {
    id: 'signal-every-family',
    from: SIGNAL_WRITERS.osier,
    when: (town) => level(town, 'signalTerrace') >= 2,
    text: 'The resonators stand in a half circle on the terrace, one for every family that carried a crystal up from the valley. I am asked what my kin feel beside the stone. It is like standing beside something very old that is still growing. I cannot say more than that yet.',
  },
  {
    id: 'signal-answered',
    from: SIGNAL_WRITERS.both,
    when: (town) => reached(town, 'answered'),
    text: 'We sent it this evening. We laid our hands on the first resonator together, and the whole town hummed the rest. The stone did not move. Then a thin ribbon of light ran out from its foot across the dust, and where it passed there were stars in the ground: a map, with one path drawn through it. We do not know who made the stone, or where the path leads. We know that someone was listening.',
  },
]);
/** The Far Rim's story letters a town has received, oldest first. */
export const signalLetters = (town) =>
  SIGNAL_LETTERS.filter(({ when }) => when(town)).map(({ id, from, text }) => ({ id, from, text }));

// A fixed scatter: the same stars for every town and on every map.
const starHash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
/**
 * The star map the stone draws once New Hollow has answered: `stars` on the ground inside
 * the ring, `[along, across, size]` in the ribbon's frame (along it from the stone, across
 * it to either side), and the `path` through some of them, as indexes into `stars`. Fixed
 * for every town.
 */
export function starMap(ring) {
  const reach = ring - 2.2;
  const stars = [];
  for (let n = 0; stars.length < 46 && n < 400; n++) {
    const along = 1.6 + starHash(n * 3 + 11) * (reach - 1.6),
      across = (starHash(n * 3 + 12) * 2 - 1) * Math.min(reach, 2.5 + along * 0.85);
    // Clear of the ribbon itself, inside the ring, and not on top of another star.
    if (Math.abs(across) < 0.9 || Math.hypot(along, across) > reach) continue;
    if (stars.some(([a, c]) => Math.hypot(a - along, c - across) < 1.5)) continue;
    stars.push([along, across, 0.1 + starHash(n * 3 + 13) ** 3 * 0.2]);
  }
  // One path, from beside the stone outward: each step goes to the nearest star further on.
  const path = [];
  let at = stars.reduce((best, star, n) => (star[0] < stars[best][0] ? n : best), 0);
  while (at >= 0 && path.length < 7) {
    path.push(at);
    const [along, across] = stars[at];
    let next = -1,
      nearest = Infinity;
    stars.forEach(([a, c], n) => {
      const distance = Math.hypot(a - along, c - across);
      if (a > along + 1 && distance < nearest) [next, nearest] = [n, distance];
    });
    at = next;
  }
  return { stars, path };
}
