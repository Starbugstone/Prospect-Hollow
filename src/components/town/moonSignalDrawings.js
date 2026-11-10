import {
  GLASS,
  at,
  band,
  bench,
  cap,
  circle,
  dish,
  drum,
  ellipse,
  finishDrawing,
  hatch,
  lampPost,
  line,
  moduleBox,
  path,
  planter,
  rect,
  risingDrawing,
} from './moonRisingDrawings';

// Front-view drawings of The Quiet Signal's buildings in the Far Rim, as plain shapes in
// the Moon palette, like the outer ring's (moonRisingDrawings.js). Each is seen from the
// Quiet Stone's side, which every Far Rim building faces, and follows its 3D form
// (buildings/moonSignal.js) level by level. The ground is y = 0 and up is negative.

/** A tuning crystal on a tripod with its pulse lamp. */
const instrument = (x, h = 22) => [
  line(`M${x - 6} 0L${x} ${-h}L${x + 6} 0M${x} ${-h}v${h * 0.4}`, 'deep', 1.5),
  path(`M${x} ${-h - 10}l4 5-4 5-4-5Z`, { fill: 'glass' }),
  circle(x, -h - 14, 2, 'light'),
];
/** A wooden resonator: a tonewood stave under a gold cap, with a crystal once crowned. */
const resonator = (x, h, crystal = false) => [
  rect(x - 3.5, -h, 7, h, 'timber'),
  rect(x - 4.5, -h - 2, 9, 2.5, 'light'),
  ...(crystal ? [path(`M${x} ${-h - 11}l3 4.5-3 4.5-3-4.5Z`, { fill: 'glass' })] : []),
];
/** A lens in a gold ring, seen face on. */
const lens = (x, y, r) => [
  circle(x, y, r, 'glass', { stroke: 'light', sw: Math.max(2, r * 0.22) }),
];
/** A young tree leaning toward the stone: its crown hangs forward of its foot. */
const leaning = (x, y, r) => [
  line(`M${x} ${y}l${r * 0.5} ${-r * 1.3}`, 'timber', 3),
  circle(x + r * 0.7, y - r * 1.9, r, 'green'),
];
/** A glass vault of half width `r` and `rise` on a ceramic kerb. */
const vault = (x, r, rise, trees = []) => [
  rect(x - r, -8, r * 2, 8, 'shell'),
  ...trees.flatMap(([dx, size]) => leaning(x + dx, -8, size)),
  path(`M${x - r} -8a${r} ${rise} 0 0 1 ${r * 2} 0Z`, { fill: 'glass', ...GLASS }),
  path(`M${x - r * 0.5} -8a${r * 0.5} ${rise * 0.86} 0 0 1 ${r} 0`, { stroke: 'roof', sw: 1.5 }),
];
/** A gabled home with two lit windows either side of its hatch. */
const home = (x, w, h) => [
  rect(x - w / 2, -h, w, h, 'shell'),
  path(`M${x - w / 2 - 5} ${-h}L${x} ${-h - w * 0.32}L${x + w / 2 + 5} ${-h}Z`, { fill: 'roof' }),
  rect(x - w * 0.36, -h * 0.78, 9, 9, 'light'),
  rect(x + w * 0.36 - 9, -h * 0.78, 9, 9, 'light'),
  hatch(x, -13, 7),
];
// Roots that branch in one shape, again and again, smaller.
function roots(x, y, angle, length, depth) {
  const ex = x + Math.sin(angle) * length,
    ey = y - Math.cos(angle) * length * 0.36;
  const stroke = line(
    `M${x.toFixed(1)} ${y.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`,
    'timber',
    0.8 + depth * 0.6,
  );
  return depth > 1
    ? [
        stroke,
        ...[-0.62, 0.62].flatMap((turn) => roots(ex, ey, angle + turn, length * 0.62, depth - 1)),
      ]
    : [stroke];
}

const SIGNAL = {
  listeningHouse: (level) => [
    ...at(
      level,
      2,
      line('M-58 0v-62', 'shell', 5),
      dish(-58, -74, 28),
      drum(58, 25, 30),
      cap(58, 25, 30, 24, 'shell'),
      path('M52 -52l6 -4 6 4v14h-12Z', { fill: 'deep' }),
      hatch(58, -13, 6),
    ),
    ...at(
      level,
      3,
      line('M58 -44L70 -66', 'light', 5),
      line('M92 0v-34', 'shell', 3),
      dish(92, -42, 16),
    ),
    ...moduleBox(0, 70, 34),
    rect(-37, -38, 74, 4, 'roof'),
    hatch(0, -14, 7),
    line('M20 -38v-6', 'deep', 2.5),
    ...dish(20, -50, 14),
    ...instrument(-62),
    ...instrument(64),
    ...at(level, 1, instrument(-96, 20)),
    ...at(
      level,
      3,
      ...[-50, -34, 34, 50].flatMap((x) => [
        line(`M${x} 2v-26`, 'deep', 1.5),
        circle(x, -26, 2, 'light'),
      ]),
      circle(0, -44, 3.5, 'light'),
      lampPost(-30, 34),
    ),
  ],
  stillwaterBasin: (level) => [
    ...at(
      level,
      2,
      drum(72, 18, 34),
      band(72, 18, -32),
      cap(72, 18, 34, 8, 'roof'),
      line('M52 -8h6', 'glass', 4),
    ),
    ellipse(0, -6, 72, 15, 'shell'),
    ellipse(0, -10, 66, 12, 'glass', { stroke: 'light', sw: 2.5 }),
    // The ring a pulse draws on the water.
    ellipse(0, -9, 26, 4.5, 'none', { stroke: 'shell', sw: 1.5 }),
    line('M-50 -10v-28', 'deep', 2),
    ...[-18, -26, -34].map((y) => line(`M-53 ${y}h6`, 'light', 1.5)),
    ...at(
      level,
      3,
      path('M-66 -11a66 20 0 0 1 132 0', { fill: 'glass', fo: 0.3, stroke: 'roof', sw: 2 }),
    ),
    ...moduleBox(0, 24, 18),
    hatch(0, -9, 6),
    ...at(level, 2, bench(-78, 30)),
    ...at(
      level,
      3,
      ...[-98, 98].flatMap((x) => [line(`M${x} 2v-16`, 'deep', 2), circle(x, -16, 3.5, 'light')]),
      instrument(36, 16),
    ),
  ],
  tonewoodConservatory: (level) => [
    ...at(
      level,
      2,
      vault(0, 58, 56, [
        [-40, 7],
        [0, 7],
        [38, 7],
      ]),
    ),
    ...vault(0, 66, 40, [
      [-50, 9],
      [-22, 11],
      [16, 10],
      [44, 8],
    ]),
    ...at(level, 3, ...[-42, 0, 42].map((x) => circle(x, -47, 2.5, 'light'))),
    ...moduleBox(0, 30, 24),
    hatch(0, -12, 7),
    ...at(
      level,
      2,
      line('M68 0v-28M84 0v-28M68 -28h16', 'deep', 2),
      ...[70, 74, 78, 82].map((x) => line(`M${x} 0L${x + 2} -27`, 'timber', 2.5)),
    ),
    ...at(
      level,
      3,
      resonator(-90, 28),
      resonator(-81, 37),
      resonator(-72, 45),
      resonator(-63, 32),
      instrument(42, 18),
      lampPost(-36, 36),
    ),
  ],
  farRimHomes: (level) => [
    ...at(
      level,
      2,
      rect(-36, -60, 72, 60, 'shell'),
      path('M-42 -60L0 -84L42 -60Z', { fill: 'roof' }),
      ...[-22, -4.5, 13].map((x) => rect(x, -54, 9, 9, 'light')),
    ),
    ...at(level, 3, line('M0 -84v-16', 'deep', 1.5), circle(0, -101, 2.5, 'light')),
    ...home(-48, 58, 34),
    ...home(48, 58, 34),
    ...moduleBox(0, 24, 26, 'light'),
    hatch(0, -12, 6),
    ...at(level, 2, lampPost(-86, 34), lampPost(86, 34)),
    ...at(
      level,
      3,
      ...[-48, 48].flatMap((x) => [
        rect(x - 26, -6, 52, 6, 'shell'),
        path(`M${x - 25} -6a25 15 0 0 1 50 0Z`, { fill: 'glass', ...GLASS }),
      ]),
      planter(-104),
      planter(104),
      bench(-52, 34),
      bench(52, 34),
    ),
  ],
  resonanceWorkshop: (level) => [
    ...at(level, 2, line('M-66 0v-40', 'deep', 3), lens(-66, -54, 16)),
    ...at(level, 3, line('M0 -50v-14', 'deep', 2.5), lens(0, -75, 12)),
    path('M-40 -36a40 12 0 0 1 80 0Z', { fill: 'roof' }),
    ...moduleBox(0, 80, 36),
    hatch(0, -14, 7),
    ...at(level, 2, drum(66, 21, 16), cap(66, 21, 16, 18), hatch(66, -9, 5)),
    rect(46, -10, 32, 10, 'timber'),
    ...lens(62, -19, 8),
    line('M-72 0v-36M-46 0v-36M-72 -36h26', 'deep', 2),
    ...[
      [-66, 19],
      [-59, 15],
      [-52, 11],
    ].map(([x, h]) => rect(x - 1.5, -35, 3, h, 'timber')),
    ...at(level, 2, resonator(-50, 19), resonator(-41, 28)),
    ...at(
      level,
      3,
      resonator(-32, 36, true),
      resonator(-23, 45, true),
      resonator(-14, 32, true),
      circle(26, -52, 3, 'light'),
      lampPost(36, 34),
    ),
  ],
  signalTerrace: (level) => [
    ellipse(0, 0, 100, 13, 'roof'),
    ellipse(0, 0, 32, 4.5, 'shell'),
    ...at(
      level,
      2,
      ...[-84, -70, -34, 34, 70, 84].flatMap((x, n) => resonator(x, 32 + (n % 3) * 7, level >= 3)),
    ),
    drum(0, 20, 9),
    band(0, 20, -9, 'light', 3),
    ...at(
      level,
      2,
      circle(0, -24, 11, 'none', { stroke: 'light', sw: 3 }),
      line('M-6 -9v-5M6 -9v-5', 'deep', 1.5),
    ),
    ...at(
      level,
      3,
      circle(0, -24, 8, 'glass'),
      line('M0 -35v-12', 'deep', 1.5),
      dish(0, -52, 11),
      line('M-32 -9v-52M32 -9v-52', 'deep', 1.5),
      circle(-32, -62, 2, 'light'),
      circle(32, -62, 2, 'light'),
      line('M-32 -56L0 -36L32 -56', 'light', 0.8),
      ...[-48, -24, 24, 48].flatMap((x) => [
        line(`M${x} 6v-10`, 'deep', 1.2),
        circle(x, -5, 2, 'light'),
      ]),
    ),
    bench(-62, 36),
    bench(62, 36),
    rect(-88, -3, 34, 5, 'timber'),
    rect(54, -3, 34, 5, 'timber'),
    ...lampPost(-92, 24),
    ...lampPost(92, 24),
  ],
  patternGarden: (level) => [
    ellipse(0, -5, 62, 13, 'shell'),
    ellipse(0, -9, 57, 11, 'deep'),
    ...[0, 1, 2].flatMap((n) => roots(0, -9, (n * Math.PI * 2) / 3, 22, level + 1)),
    line('M0 -9v-22', 'timber', 3.5),
    circle(0, -38, 11, 'green'),
    circle(-7, -32, 7, 'green'),
    circle(7, -33, 7.5, 'green'),
    circle(4, -42, 2, 'flower'),
    ...at(
      level,
      2,
      path('M-58 -9a58 34 0 0 1 116 0', { fill: 'glass', fo: 0.3, stroke: 'roof', sw: 2 }),
      path('M-62 -8a62 13 0 0 0 124 0', { stroke: 'light', sw: 2.5 }),
    ),
    ...moduleBox(0, 22, 18),
    hatch(0, -9, 6),
    ...at(level, 2, bench(-70, 28)),
    ...at(
      level,
      3,
      path('M52 -6l18 -9 4 3-18 9Z', { fill: 'shell', stroke: 'roof', sw: 1 }),
      line('M56 -1l4 5M60 -1v6M64 -1l-3 5', 'timber', 1.2),
      ...[-96, 96].flatMap((x) => [line(`M${x} 2v-18`, 'deep', 2), circle(x, -18, 3.5, 'light')]),
    ),
  ],
};

/** The shapes of a Far Rim building at a level, or null for any other kind. */
const signalDrawing = (kind, level) => (Object.hasOwn(SIGNAL, kind) ? SIGNAL[kind](level) : null);
export const SIGNAL_DRAWINGS = Object.freeze(Object.keys(SIGNAL));

// What The Quiet Signal's finishes add to earlier Moon buildings (moonSignal.js).
const SIGNAL_FINISHES = {
  'quiet-signal': {
    starwatchDish: (step) => ({
      behind: [
        line('M62 0v-74', 'shell', 5),
        rect(55, -10, 14, 10, 'shell'),
        band(62, 5, -74, 'light', 3),
        ...dish(66, -84, 26),
        ...at(
          step,
          3,
          ...[-28, -12, 4, 20].flatMap((x) => [
            line(`M${x} -2l5 -30`, 'deep', 1.5),
            circle(x + 5, -33, 2, 'light'),
          ]),
        ),
      ],
      front: [
        ...at(
          step,
          2,
          moduleBox(-62, 30, 24),
          hatch(-62, -11, 5),
          line('M-62 -24v-12', 'deep', 1.5),
          circle(-62, -39, 3.5, 'light'),
          line('M-46 -3h100', 'deep', 1.5),
        ),
      ],
    }),
  },
};

/** A Moon building's shapes at a level, from whichever era drew it, or null. */
export const moonDrawing = (kind, level) =>
  risingDrawing(kind, level) ?? signalDrawing(kind, level);
/** A modernized finish's shapes, `{ era, level, behind, front }`, from whichever era adds it. */
export const moonFinishDrawing = (kind, finish) =>
  finishDrawing(kind, finish) ?? finishDrawing(kind, finish, SIGNAL_FINISHES);
