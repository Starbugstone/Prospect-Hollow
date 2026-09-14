// Append-only chapters 41–54. Existing levels, seeds and rewards stay stable.
// Each authored shelf plan becomes six different routes: introduction, practice,
// delivery, stretch, recovery and finale. Side columns and bottom exits stay open.
const CHAPTER_PLANS = [
  {
    id: 'freight-crossings',
    mechanic: 'ore',
    name: 'Freight crossings',
    description: 'Open staggered shelves and choose a route for the freight.',
    style: 'rail',
    stones: [
      [2, 2],
      [3, 2],
      [4, 4],
      [2, 6],
    ],
    motif: 'pocket',
  },
  {
    id: 'foundry-arches',
    mechanic: 'lantern',
    name: 'Foundry arches',
    description: 'Work around the arches before opening the central forge.',
    style: 'copper',
    stones: [
      [2, 3],
      [3, 3],
      [4, 3],
      [2, 5],
      [4, 5],
    ],
    motif: 'arch',
  },
  {
    id: 'reservoir-links',
    mechanic: 'ore',
    name: 'Reservoir links',
    description: 'Clear the channels between the reservoir chambers.',
    style: 'water',
    stones: [
      [2, 2],
      [4, 2],
      [2, 4],
      [4, 6],
    ],
    motif: 'twins',
  },
  {
    id: 'courtyard-passages',
    mechanic: 'survey',
    name: 'Courtyard passages',
    description: 'Connect sheltered courtyards through their open sides.',
    style: 'garden',
    stones: [
      [2, 3],
      [4, 3],
      [3, 5],
      [2, 6],
    ],
    motif: 'pool',
  },
  {
    id: 'switchyard-seams',
    mechanic: 'lantern',
    mixedOrders: true,
    name: 'Switchyard seams',
    description: 'Choose which junction to open before sending relics home.',
    style: 'rail',
    stones: [
      [2, 2],
      [3, 4],
      [4, 4],
      [4, 6],
    ],
    motif: 'steps',
  },
  {
    id: 'terminal-galleries',
    mechanic: 'ore',
    name: 'Terminal galleries',
    description: 'Open broad approaches beneath the terminal.',
    style: 'water',
    stones: [
      [2, 2],
      [4, 2],
      [3, 4],
      [2, 6],
      [4, 6],
    ],
    motif: 'ribbon',
  },
  {
    id: 'airfield-vaults',
    mechanic: 'survey',
    name: 'Airfield vaults',
    description: 'Keep the delivery lanes clear beside the airfield vaults.',
    style: 'copper',
    stones: [
      [2, 3],
      [3, 3],
      [4, 5],
      [3, 6],
    ],
    motif: 'arch',
  },
  {
    id: 'radio-relays',
    mechanic: 'lantern',
    name: 'Radio relays',
    description: 'Follow colored seals through the relay galleries.',
    style: 'signal',
    stones: [
      [3, 2],
      [2, 4],
      [4, 4],
      [3, 6],
    ],
    motif: 'twins',
  },
  {
    id: 'studio-crossroads',
    mechanic: 'survey',
    mixedOrders: true,
    name: 'Studio crossroads',
    description: 'Find a clear approach to each linked studio chamber.',
    style: 'signal',
    stones: [
      [2, 2],
      [4, 3],
      [2, 5],
      [4, 6],
    ],
    motif: 'steps',
  },
  {
    id: 'skyline-foundations',
    mechanic: 'lantern',
    name: 'Skyline foundations',
    description: 'Open the foundations from both sides of the central seam.',
    style: 'copper',
    stones: [
      [3, 2],
      [2, 3],
      [4, 3],
      [3, 5],
      [4, 6],
    ],
    motif: 'pocket',
  },
  {
    id: 'promenade-routes',
    mechanic: 'survey',
    name: 'Promenade routes',
    description: 'Follow the river lanes and bring the discoveries home.',
    style: 'water',
    stones: [
      [2, 2],
      [2, 3],
      [4, 5],
      [4, 6],
    ],
    motif: 'ribbon',
  },
  {
    id: 'network-vaults',
    mechanic: 'lantern',
    mixedOrders: true,
    name: 'Network vaults',
    description: 'Reconnect colored junctions without closing the delivery routes.',
    style: 'signal',
    stones: [
      [2, 2],
      [4, 2],
      [3, 3],
      [2, 5],
      [4, 6],
    ],
    motif: 'pool',
  },
  {
    id: 'heritage-loop',
    mechanic: 'lantern',
    alternatingSurvey: true,
    name: 'Heritage loop',
    description: 'Revisit familiar obstacles in a new connected layout.',
    style: 'garden',
    stones: [
      [2, 2],
      [4, 3],
      [2, 4],
      [4, 5],
      [3, 6],
    ],
    motif: 'arch',
  },
  {
    id: 'hollow-homecoming',
    mechanic: 'survey',
    mixedOrders: true,
    name: 'Hollow homecoming',
    description: 'Bring the final discoveries back to the town you built.',
    style: 'garden',
    stones: [
      [3, 2],
      [2, 3],
      [4, 4],
      [2, 5],
      [3, 6],
    ],
    motif: 'twins',
  },
];
export const LATE_CHAPTERS = CHAPTER_PLANS.map(({ id, name, description, style }) => ({
  id,
  name,
  description,
  theme: id,
  style,
  cols: 7,
  rows: 9,
  gemTypeCount: 5,
}));
const STOPS = [
  'Approach',
  'Junctions',
  'Deliveries',
  'Linked chambers',
  'Quiet passage',
  'Homecoming',
];
const TIPS = [
  'Open a side approach before working into the central shelves.',
  'Choose a colored junction, then reconnect the neighboring chamber.',
  'Clear below both relics and guide them to the marked exits.',
  'Open the reinforced shelf to link both halves of the chamber.',
  'An open passage. Enjoy the room for combinations and flowing cascades.',
  'Bring both relics home, then clear the remaining seals and ice.',
];
export const LATE_LEVEL_NAMES = LATE_CHAPTERS.flatMap(({ name }) =>
  STOPS.map((stop) => `${name}: ${stop}`),
);
export const LATE_LEVELS = CHAPTER_PLANS.flatMap((plan, chapter) =>
  STOPS.map((_, phase) => {
    const cells = Array(63).fill('.');
    const put = (x, y, symbol) => {
      cells[y * 7 + x] = symbol;
    };
    const shelves = phase === 4 ? plan.stones.slice(0, 2) : plan.stones;
    shelves.forEach(([x, y], index) => put(x, y, phase === 3 && index < 2 ? 'X' : '#'));
    const left = 2,
      right = 4;
    // Chains and seals use the open flank columns; no unreachable corner targets.
    if (phase !== 4) {
      put(1, 4, 'c');
      put(5, 5, 'c');
    }
    if ([1, 3, 5].includes(phase)) {
      put(1, 6, 'r');
      put(5, 3, chapter % 2 ? 'g' : 'b');
    }
    if ([2, 5].includes(phase)) {
      put(left, 1, 'R');
      put(right, 1, 'R');
      put(left, 8, 'E');
      put(right, 8, 'E');
    }
    const survey =
      plan.mechanic === 'survey' || (plan.alternatingSurvey === true && phase % 2 === 1);
    const lantern = plan.mechanic === 'lantern' && !survey;
    const signals = survey
      ? [50, 51, 52, 53].slice(0, phase === 0 || phase === 4 ? 3 : 4)
      : lantern
        ? [22, 26, 36, 40]
            .filter((index) => cells[index] === '.')
            .slice(0, phase === 0 || phase === 4 ? 2 : 4)
        : [];
    const hasOrders = plan.mechanic === 'ore' || (plan.mixedOrders && [1, 3, 5].includes(phase));
    const colors =
      chapter % 3 === 0 ? ['ruby'] : chapter % 3 === 1 ? ['emerald'] : ['sapphire', 'emerald'];
    const orders = hasOrders
      ? colors.map((color) => [color, phase === 0 || phase === 4 ? 12 : 18])
      : [];
    const instruction = survey
      ? 'Light the numbered survey markers in order. Match on or beside the next number; gems keep moving freely.'
      : lantern
        ? 'Light every lantern by matching on or beside it. Bonuses can light them too; gems pass freely.'
        : 'Fill the pictured ore orders by collecting those gem colors. Matching and bonuses both count.';
    return {
      openExitRows: 2,
      signals,
      survey,
      orders,
      map: Array.from({ length: 9 }, (_, row) => cells.slice(row * 7, row * 7 + 7).join('')).join(
        '/',
      ),
      ice: [64, 68, 70, 74, 52, 76][phase] + (chapter % 3) * 2,
      motif: plan.motif,
      tip: `${instruction} ${TIPS[phase]}`,
    };
  }),
);
