// Front-view drawings of New Hollow Rising's buildings, as plain shapes in the Moon palette:
// TownMoonBuilding.vue draws them. They follow the 3D forms (buildings/moonRising.js) level
// by level. Colours are MOON_PALETTE keys; the ground is y = 0 and up is negative.
const rect = (x, y, w, h, fill, more = {}) => ({ t: 'rect', x, y, w, h, fill, ...more });
const circle = (cx, cy, r, fill, more = {}) => ({ t: 'circle', cx, cy, r, fill, ...more });
const ellipse = (cx, cy, rx, ry, fill, more = {}) => ({
  t: 'ellipse',
  cx,
  cy,
  rx,
  ry,
  fill,
  ...more,
});
const path = (d, more) => ({ t: 'path', d, ...more });
const line = (d, stroke = 'deep', sw = 3) => path(d, { stroke, sw });
const GLASS = { fo: 0.38, stroke: 'roof', sw: 2.5 };

const hatch = (x, y = -16, r = 8) =>
  circle(x, y, r, 'deep', { stroke: 'light', sw: 2, hatch: true });
const drum = (x, r, h, fill = 'shell') =>
  path(
    `M${x - r} 0v${-h}a${r} ${r * 0.22} 0 0 1 ${r * 2} 0v${h}a${r} ${r * 0.22} 0 0 1 ${-r * 2} 0Z`,
    { fill },
  );
/** A dome of `rise` on a base line at `base`: glass unless given another fill. */
const cap = (x, r, base, rise, fill = 'glass') =>
  path(
    `M${x - r} ${-base}a${r} ${rise} 0 0 1 ${r * 2} 0Z`,
    fill === 'glass' ? { fill, ...GLASS } : { fill },
  );
const band = (x, r, y, stroke = 'light', sw = 4) => line(`M${x - r} ${y}h${r * 2}`, stroke, sw);
const lampPost = (x, h = 40) => [line(`M${x} 4v${-h - 4}`), circle(x, -h, 5, 'light')];
const tree = (x, y, r, blossom = false) => [
  line(`M${x} ${y}v${-r * 1.1}`, 'timber', 4),
  circle(x, y - r * 1.7, r, 'green'),
  ...(blossom ? [circle(x + r * 0.4, y - r * 2, 3, 'flower')] : []),
];
const planter = (x) => [rect(x - 9, -8, 18, 8, 'timber'), circle(x, -14, 9, 'green')];
const bench = (x, w = 30) => rect(x - w / 2, -8, w, 5, 'timber');
const flag = (x, h) => [line(`M${x} 0v${-h}`), path(`M${x} ${-h}l22 7-22 7Z`, { fill: 'flower' })];
const moduleBox = (x, w, h, windowFill = 'glass') => [
  rect(x - w / 2, -h, w, h, 'shell', { rx: 5 }),
  line(`M${x - w / 2} -9h${w}`, 'light', 3),
  rect(x - w * 0.35, -h * 0.82, w * 0.7, 6, windowFill),
];
const rover = (x) => [
  rect(x - 20, -24, 40, 13, 'shell', { rx: 5 }),
  rect(x - 2, -33, 16, 9, 'glass'),
  rect(x - 16, -32, 12, 8, 'timber'),
  circle(x - 13, -7, 6.5, 'deep'),
  circle(x + 13, -7, 6.5, 'deep'),
];
const tramCar = (x) => [
  rect(x - 22, -30, 44, 22, 'shell', { rx: 7 }),
  rect(x - 17, -27, 34, 8, 'glass'),
  line(`M${x - 22} -15h44`, 'light', 2.5),
  rect(x - 16, -8, 32, 5, 'deep'),
];
const dish = (x, y, r) => [
  ellipse(x, y, r, r * 0.42, 'shell', { stroke: 'roof', sw: 2 }),
  line(
    `M${x - r * 0.8} ${y - r * 0.2}L${x} ${y - r * 0.9}L${x + r * 0.8} ${y - r * 0.2}`,
    'deep',
    1.5,
  ),
  circle(x, y - r * 0.9, Math.max(2.5, r * 0.09), 'light'),
];
const at = (level, min, ...shapes) => (level >= min ? shapes.flat() : []);

const RISING = {
  ringTram: (level) => [
    drum(0, 34, 40),
    cap(0, 34, 40, 30),
    rect(-92, -10, 184, 9, 'roof'),
    line('M-92 -1h184', 'light', 2),
    ...[-80, -27, 27, 80].map((x) => line(`M${x} -10v-52`, 'deep', 2.5)),
    path('M-88 -64a88 13 0 0 1 176 0Z', { fill: 'glass', ...GLASS }),
    rect(-94, -66, 188, 5, 'light'),
    ...at(level, 2, moduleBox(88, 30, 34), hatch(88, -14, 6)),
    ...(level >= 2 ? [-48, 0, 48] : [-24, 24]).flatMap(tramCar),
    ...at(level, 2, bench(-78, 22), bench(78, 22)),
    ...at(
      level,
      3,
      line('M-104 0v-112'),
      circle(-104, -120, 11, 'shell', { stroke: 'light', sw: 3 }),
      line('M-104 -120v-6m0 6h5', 'deep', 1.5),
      planter(108),
    ),
  ],
  dewfallCistern: (level) => [
    ...at(
      level,
      3,
      ...[-112, -104, -96, -88].map((x) => rect(x, -46, 4, 42, 'roof')),
      rect(-114, -5, 32, 5, 'deep'),
    ),
    drum(-10, 50, 46),
    band(-10, 50, -18, 'glass'),
    band(-10, 50, -31, 'glass'),
    band(-10, 50, -45),
    ellipse(-10, -50, 22, 6, 'glass'),
    cap(-10, 28, 47, 24),
    hatch(-10),
    rect(-78, -16, 18, 16, 'roof'),
    circle(-69, -20, 4, 'light'),
    ...at(
      level,
      2,
      drum(74, 30, 34),
      band(74, 30, -17, 'glass'),
      band(74, 30, -33),
      cap(74, 29, 35, 11, 'shell'),
      line('M40 -26h6', 'glass', 5),
    ),
    ...at(
      level,
      3,
      drum(32, 9, 16),
      ellipse(32, -18, 8, 3, 'glass', { stroke: 'light', sw: 1.5 }),
      lampPost(-52),
    ),
  ],
  orchardVaults: (level) => {
    const vault = (x) => [
      rect(x - 28, -8, 56, 8, 'shell'),
      ...tree(x - 9, -8, 9, true),
      ...tree(x + 10, -8, 11),
      path(`M${x - 27} -8a27 46 0 0 1 54 0Z`, { fill: 'glass', ...GLASS }),
      path(`M${x - 19} -8a19 34 0 0 1 38 0`, { stroke: 'roof', sw: 1.5 }),
    ];
    return [
      ...vault(-60),
      ...vault(0),
      ...at(level, 2, vault(60)),
      ...moduleBox(0, 30, 26, 'roof'),
      hatch(0, -13, 7),
      rect(-44, -5, 16, 5, 'shell'),
      ...tree(-36, -5, 6, true),
      cap(-36, 8, 5, 22),
      ...at(
        level,
        2,
        rect(28, -10, 16, 10, 'timber'),
        circle(33, -13, 4, 'flower'),
        circle(40, -13, 4, 'flower'),
      ),
      ...at(
        level,
        3,
        drum(96, 18, 10),
        tree(96, -10, 8, true),
        circle(90, -26, 2.5, 'flower'),
        cap(96, 18, 10, 26),
        lampPost(-18, 34),
        lampPost(18, 34),
      ),
    ];
  },
  lanternRow: (level) => {
    const home = (x, r, h) => [
      drum(x, r, h),
      path(`M${x - r} ${-h}a${r} ${r * 0.85} 0 0 1 ${r * 2} 0Z`, {
        fill: 'shell',
        stroke: 'roof',
        sw: 2,
      }),
      band(x, r, -h, 'light', 2.5),
      circle(x - r * 0.5, -h * 0.55, 3.5, 'light'),
      circle(x + r * 0.5, -h * 0.55, 3.5, 'light'),
    ];
    return [
      ...[-84, -28, 28, 84].flatMap((x) => home(x, 23, 34)),
      rect(-106, -34, 212, 30, 'glass', { rx: 15, ...GLASS }),
      rect(-106, -6, 212, 6, 'shell'),
      ...[-84, -28, 28, 84].map((x) => hatch(x, -15, 6)),
      ...at(level, 3, ...[-90, -60, -30, 0, 30, 60, 90].map((x) => circle(x, -38, 3.5, 'light'))),
      ...at(level, 2, home(-98, 17, 18), home(98, 17, 18)),
      ...moduleBox(0, 28, 26, 'light'),
      hatch(0, -13, 7),
      ...at(level, 3, path('M-19 -26L0 -40L19 -26Z', { fill: 'flower' })),
      ...[-66, -40, 40, 66].flatMap((x) => lampPost(x, 30)),
      ...at(level, 2, lampPost(-22, 24), lampPost(22, 24)),
      ...at(level, 3, planter(-54), planter(54)),
    ];
  },
  ringMarket: (level) => {
    const stall = (x) => [
      line(`M${x - 16} 0v-40M${x + 16} 0v-40`, 'deep', 2),
      rect(x - 18, -14, 36, 14, 'timber'),
      ...[0, 1, 2, 3].map((n) =>
        path(`M${x - 22 + n * 11} -34h11l-2 -10h-11Z`, { fill: n % 2 ? 'shell' : 'flower' }),
      ),
      circle(x - 8, -18, 4, 'green'),
      circle(x + 2, -18, 4, 'flower'),
      circle(x + 11, -18, 4, 'green'),
    ];
    return [
      ...at(
        level,
        3,
        line('M0 -84v-30', 'deep', 2),
        circle(0, -116, 5, 'light'),
        path('M0 -108l18 5-18 5Z', { fill: 'flower' }),
      ),
      rect(-52, -12, 104, 12, 'shell'),
      rect(-20, -26, 40, 12, 'timber'),
      circle(-10, -30, 5, 'green'),
      circle(0, -30, 5, 'flower'),
      circle(10, -30, 5, 'green'),
      rect(-42, -24, 14, 12, 'timber'),
      circle(-35, -28, 4, 'flower'),
      rect(28, -24, 14, 12, 'timber'),
      circle(35, -28, 4, 'green'),
      rect(-50, -48, 100, 36, 'glass', GLASS),
      line('M-50 0v-48M-18 0v-48M18 0v-48M50 0v-48', 'deep', 2),
      path('M-64 -48L0 -68L64 -48Z', { fill: 'light' }),
      path('M-30 -60L0 -86L30 -60Z', { fill: 'shell' }),
      hatch(0),
      rect(62, -14, 16, 14, 'timber'),
      rect(65, -24, 11, 10, 'timber'),
      ...at(level, 2, stall(-92), stall(96)),
      ...at(
        level,
        3,
        ...[-58, -29, 29, 58].map((x) => circle(x, -44, 3.5, 'light')),
        bench(-66, 26),
      ),
    ];
  },
  craterSchool: (level) => {
    const classroom = (x, r, h) => [
      drum(x, r, h),
      path(`M${x - r - 2} ${-h}a${r + 2} ${r * 0.36} 0 0 1 ${r * 2 + 4} 0Z`, { fill: 'roof' }),
      band(x, r, -8, 'light', 3),
      ...[-0.72, -0.4, 0.4, 0.72].map((side) =>
        circle(x + side * r, -h * 0.66, r * 0.13, 'glass', { stroke: 'light', sw: 2 }),
      ),
      hatch(x, -14, r * 0.17),
    ];
    return [
      ...at(
        level,
        3,
        drum(-90, 24, 14),
        path('M-114 -14a24 26 0 0 1 48 0Z', { fill: 'roof' }),
        band(-90, 24, -14, 'light', 2.5),
        ...[
          [-102, -24],
          [-92, -32],
          [-80, -22],
          [-86, -27],
        ].map(([x, y]) => circle(x, y, 1.8, 'light')),
        hatch(-90, -8, 5),
      ),
      ...at(level, 2, rect(44, -24, 18, 18, 'glass', GLASS), classroom(86, 30, 32)),
      ...classroom(0, 46, 40),
      line('M62 0v-62h-12v6'),
      path('M45 -44l5 -12l5 12Z', { fill: 'light' }),
      circle(50, -43, 2, 'deep'),
      ...[
        [-70, 2, 'flower'],
        [-70, 7, 'light'],
        [-75, 12, 'glass'],
        [-65, 12, 'flower'],
        [-70, 17, 'light'],
      ].map(([x, y, fill]) => rect(x - 4, y - 2, 8, 4, fill)),
      ...at(level, 2, bench(70, 26)),
      ...at(level, 3, flag(108, 70), lampPost(-40, 34)),
    ];
  },
  // Seen from the Earth side: each tier's glass front and balcony under the one behind.
  earthviewTerraces: (level) => {
    const tier = (w, h) => [
      rect(-w / 2, -h, w, h, 'shell'),
      band(0, w / 2, -h + 2, 'light', 3),
      rect(-w * 0.43, -h + 7, w * 0.86, 10, 'glass'),
      line(`M${-w / 6} ${-h + 5}v14M${w / 6} ${-h + 5}v14`, 'deep', 2),
    ];
    const garden = (w, y) =>
      [-1, 0, 1].map((side) => ellipse((side * w) / 2.6, y - 3, 8, 4.5, 'green'));
    return [
      ...[-58, 58].flatMap((x) => [
        line(`M${x} -100v-14`, 'deep', 2),
        path(`M${x - 16} -110l32 -8v5l-32 8Z`, { fill: 'roof' }),
      ]),
      ...at(
        level,
        3,
        circle(-14, -108, 7, 'green'),
        circle(2, -109, 8, 'green'),
        circle(16, -107, 6, 'green'),
        path('M-34 -100a34 24 0 0 1 68 0Z', { fill: 'glass', ...GLASS }),
      ),
      ...tier(160, 100),
      ...tier(160, 72),
      ...garden(130, -72),
      ...tier(140, 44),
      ...garden(110, -44),
      ...at(level, 2, tier(116, 20), garden(90, -20)),
      ...at(
        level,
        3,
        ...[-76, 76].map((x) => circle(x, -78, 3.5, 'light')),
        ...[-66, 66].map((x) => circle(x, -50, 3.5, 'light')),
      ),
    ];
  },
  expeditionGarage: (level) => [
    ...at(
      level,
      3,
      line('M-8 0v-128'),
      line('M-18 -108h20', 'deep', 2),
      ...dish(-8, -92, 11),
      circle(-8, -130, 4.5, 'light'),
    ),
    ...at(
      level,
      2,
      path('M56 -40a28 12 0 0 1 56 0Z', { fill: 'roof' }),
      rect(56, -40, 56, 40, 'shell'),
      band(84, 28, -40, 'light', 3),
      rect(66, -30, 36, 30, 'deep'),
    ),
    path('M-102 -50a42 16 0 0 1 84 0Z', { fill: 'roof' }),
    rect(-102, -50, 84, 50, 'shell'),
    rect(-102, -46, 84, 5, 'flower'),
    rect(-92, -38, 64, 38, 'deep'),
    line('M-92 -28h64M-92 -19h64M-92 -10h64', 'light', 1.5),
    ...moduleBox(-2, 30, 32),
    hatch(-2, -13, 7),
    ...[22, 42].flatMap((x) => [
      rect(x - 4, -8, 8, 8, 'deep'),
      circle(x, -18, 10, 'shell'),
      band(x, 10, -18, 'light', 2),
    ]),
    ...rover(-60),
    ...at(level, 2, rover(86)),
    ...at(
      level,
      3,
      rect(-28, -10, 12, 10, 'timber'),
      rect(-26, -18, 8, 8, 'timber'),
      lampPost(112, 34),
    ),
  ],
  craterInn: (level) => {
    const pod = (x, y) => [
      circle(x, y, 13, 'shell', { stroke: 'light', sw: 2.5 }),
      circle(x, y - 1, 5, 'light'),
    ];
    return [
      ...at(level, 2, ...[-76, -34, 34, 76].flatMap((x) => pod(x, -40))),
      ...[-98, -56, 56, 98].flatMap((x) => [rect(x - 8, -4, 16, 4, 'deep'), ...pod(x, -16)]),
      ...at(
        level,
        3,
        line('M0 -60v-22', 'shell', 6),
        circle(0, -94, 15, 'glass', GLASS),
        band(0, 15, -94, 'light', 2.5),
      ),
      drum(0, 44, 26),
      cap(0, 44, 26, 38),
      band(0, 44, -26, 'light', 3),
      hatch(0),
      ...at(
        level,
        3,
        lampPost(-30, 34),
        lampPost(30, 34),
        flag(-76, 62),
        bench(64, 26),
        planter(86),
      ),
    ];
  },
  starwatchDish: (level) => [
    drum(0, 26, 40),
    band(0, 26, -8, 'light', 3),
    band(0, 26, -40, 'light', 3),
    line('M-16 -40l-6 -30M16 -40l6 -30', 'roof', 4),
    ...dish(0, -84, 52),
    hatch(0),
    ...at(
      level,
      2,
      drum(74, 22, 14),
      cap(74, 22, 14, 19),
      rect(66, -22, 16, 7, 'glass'),
      hatch(74, -8, 5),
    ),
    ...at(
      level,
      3,
      drum(-76, 5, 30),
      ...dish(-76, -40, 22),
      ...[-104, -64, -28, 28, 104].flatMap((x) => [
        line(`M${x} 6v-8`, 'deep', 2),
        circle(x, -3, 3, 'light'),
      ]),
    ),
  ],
  moonballField: (level) => [
    ...at(
      level,
      3,
      line('M-18 -14v-56M18 -14v-56', 'deep', 2.5),
      rect(-28, -82, 56, 20, 'shell'),
      rect(-22, -78, 14, 12, 'flower'),
      rect(8, -78, 14, 12, 'light'),
    ),
    path('M-100 2L-82 -16H82L100 2Z', { fill: 'green' }),
    path('M-91 -7H91M0 -16V2', { stroke: 'shell', sw: 1.5 }),
    ellipse(0, -7, 14, 5, 'none', { stroke: 'shell', sw: 1.5 }),
    path('M-84 -14Q0 -128 84 -14', { stroke: 'roof', sw: 2.5 }),
    path('M-98 0Q0 -150 98 0', { stroke: 'roof', sw: 3 }),
    path('M-46 -72Q0 -86 46 -72', { stroke: 'roof', sw: 1.5 }),
    ...[-78, 78].flatMap((x) => [
      line(`M${x} -6v-42`, 'deep', 2.5),
      ellipse(x, -56, 5, 9, 'none', { stroke: 'light', sw: 3 }),
    ]),
    circle(14, -44, 6, 'flower'),
    ...moduleBox(0, 44, 26),
    hatch(0, -12, 6.5),
    bench(-62, 30),
    ...at(
      level,
      2,
      rect(40, -8, 54, 8, 'timber'),
      rect(48, -15, 46, 7, 'timber'),
      rect(56, -22, 38, 7, 'timber'),
    ),
    ...at(
      level,
      3,
      ...[-110, 110].flatMap((x) => [line(`M${x} 2v-98`), rect(x - 8, -102, 16, 8, 'light')]),
    ),
  ],
  craterPondGarden: (level) => [
    ellipse(0, -8, 88, 18, 'shell'),
    ellipse(0, -10, 80, 14, 'glass'),
    ...[
      [-54, -8],
      [-32, -12],
      [-8, -8],
      [16, -13],
      [40, -9],
    ].map(([x, y]) => ellipse(x, y, 7, 2.5, 'shell')),
    ...[
      [-58, -16],
      [52, -4],
      [18, -20],
    ].flatMap(([x, y]) =>
      [0, 5, 10].flatMap((dx, n) => [
        line(`M${x + dx} ${y}v${-12 - n * 3}`, 'green', 1.5),
        ellipse(x + dx, y - 14 - n * 3, 1.5, 3, 'timber'),
      ]),
    ),
    ...[
      [30, -16],
      [-24, -18],
      [-44, -3],
    ].flatMap(([x, y]) => [ellipse(x, y, 6, 2.2, 'green'), circle(x + 1, y - 2, 1.8, 'flower')]),
    ...at(
      level,
      2,
      path('M-40 -12Q0 -34 40 -12', { stroke: 'timber', sw: 5 }),
      path('M-28 -24Q0 -38 28 -24', { stroke: 'deep', sw: 1.5 }),
    ),
    ...at(
      level,
      3,
      ...[
        [-6, -6],
        [42, -14],
        [-50, -10],
        [20, -3],
        [-20, -2],
      ].map(([x, y]) => circle(x, y, 3, 'light')),
    ),
    path('M-82 -10a82 26 0 0 1 164 0', { fill: 'glass', fo: 0.3, stroke: 'roof', sw: 2 }),
    path('M-88 -8a88 18 0 0 0 176 0', { stroke: 'light', sw: 2.5 }),
    ...moduleBox(0, 26, 20),
    hatch(0, -10, 6),
    ...at(
      level,
      3,
      ...[-104, 104].flatMap((x) => [line(`M${x} 2v-20`, 'deep', 2), circle(x, -20, 4, 'light')]),
    ),
  ],
};

/** The shapes of a New Hollow Rising building at a level, or null for any other kind. */
export const risingDrawing = (kind, level) =>
  Object.hasOwn(RISING, kind) ? RISING[kind](level) : null;
export const RISING_DRAWINGS = Object.freeze(Object.keys(RISING));
