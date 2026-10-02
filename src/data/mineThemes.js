// Theme content shares the same floor, signal and delivery lifecycles. New
// chapters can supply scenery and skins without teaching different controls.
const palette = (dark, haze, rock, edge, timber, accent) => ({
  '--mine-dark': dark,
  '--mine-haze': haze,
  '--mine-rock': rock,
  '--mine-edge': edge,
  '--mine-timber': timber,
  '--mine-accent': accent,
});
const decoration = (d, fill = 'none', opacity = 0.38, width = 4) => ({
  d,
  fill,
  opacity,
  width,
});
const lantern = {
  id: 'lantern',
  name: 'Lanterns',
  goalLabel: 'Lanterns',
  texture: 'tile-lantern',
  art: '/art/obstacles/lantern.svg',
  instruction:
    'Light every lantern by matching on or beside it. Bonuses can light them too; gems pass freely.',
};
const core = {
  id: 'charge-core',
  name: 'Charge core',
  goalLabel: 'Core charges',
  texture: 'tile-core',
  art: '/art/obstacles/core.svg',
  instruction:
    'Match on or beside the core to charge it, one charge per move. When every pip is lit, it releases a free bonus gem. Gems pass freely.',
};
const relic = {
  id: 'relic',
  name: 'Lost relic',
  goalLabel: 'Relics to deliver',
  texture: 'gem-relic',
  exitTexture: 'tile-exit',
  art: '/art/relic.svg',
  instruction:
    'Clear gems below the golden relic so it falls through a marked exit at the bottom. Relics cannot be swapped or destroyed. Collect them all to finish.',
};
const fallback = Object.freeze({ style: {}, decorations: [], signals: { lantern, core }, relic });
const themes = {
  'fossil-beds': {
    style: palette('#251b16', '#57432b', '#594632', '#b49970', '#705438', '#edd09b'),
    decorations: [
      decoration('M55 200h145m-155 35h170M1245 400h165m-145 35h180M40 660h160m1040 170h175'),
      decoration(
        'M154 555c-65 38-124-30-91-85 33-54 113-24 99 22-12 41-65 39-78 12-12-26 20-51 39-33 18 17-4 33-14 22',
      ),
      decoration(
        'M1305 620c-47 28-91-22-67-63 24-40 83-18 73 16-9 30-48 29-57 9-9-19 14-37 29-24 13 12-3 24-10 16',
      ),
      decoration('M54 814q52-55 130-5m-112-10-5-34m29 18 3-34m29 31 10-29m25 33 18-22'),
    ],
  },
  'glowshroom-grotto': {
    style: palette('#112329', '#224e50', '#25433f', '#5c9291', '#466455', '#92eadc'),
    signals: {
      lantern: {
        id: 'mushroom',
        name: 'Glowshrooms',
        goalLabel: 'Glowshrooms',
        texture: 'tile-mushroom',
        art: '/art/obstacles/mushroom.svg',
        instruction:
          'Match on or beside a mushroom to light it. It stays lit, and gems pass freely. Bonuses light mushrooms too.',
      },
    },
    decorations: [
      decoration(
        'M62 728q50-120 113 0Z M111 728v95m1183-204q40-100 90 0Z M1333 624v95',
        'var(--mine-accent)',
        0.22,
      ),
      decoration(
        'M35 915q35-90 80 0Z M74 915v57m1223-117q45-110 100 0Z M1348 855v78',
        'var(--mine-accent)',
        0.24,
      ),
      decoration('M115 685h6m24 20h6m1170-116h6m19 13h6', 'none', 0.65, 7),
    ],
  },
  'root-bound-vault': {
    style: palette('#1d2420', '#344c36', '#40513b', '#80966a', '#605241', '#cae6a1'),
    decorations: [
      decoration(
        'M80 0q95 160 29 345t58 305m-51-258-54-42m75 188 52-37M1357 0q-109 171-35 332t-56 382m65-304 65-39m-64 236-62-50',
        'none',
        0.6,
        12,
      ),
      decoration('M60 916V745l49-39 62 39v171m1100 0V750l49-44 62 44v166'),
      decoration(
        'M93 821q-28-14-27-38 30 6 27 38m1234-134q32-14 29-40-28 6-29 40',
        'var(--mine-accent)',
        0.4,
      ),
    ],
  },
  'underground-reservoir': {
    style: palette('#102735', '#285066', '#2e485a', '#7198af', '#456276', '#b9e4e8'),
    relic: {
      id: 'pearl',
      name: 'Pearl delivery',
      goalLabel: 'Pearls to deliver',
      texture: 'gem-pearl',
      exitTexture: 'tile-pearl-exit',
      art: '/art/obstacles/pearl.svg',
      instruction:
        'Clear gems below each pearl to drop it into its basket. Pearls cannot be swapped or destroyed. The water is scenery; take your time.',
    },
    decorations: [
      decoration(
        'M0 870q120-35 245 0m950 0q125-35 245 0M0 913q110-25 210 0m1010 0q110-25 220 0M30 948h136m1110 0h138',
        'none',
        0.5,
        4,
      ),
      decoration(
        'M92 667q-27-70 0-124m45 155q29-100 4-159M1290 726q-23-65 0-127m34 161q32-91 4-153',
      ),
    ],
  },
  'geothermal-forge': {
    style: palette('#291b21', '#633f32', '#583930', '#bd8b66', '#735448', '#ffc788'),
    signals: {
      core: {
        id: 'brazier',
        name: 'Brazier',
        goalLabel: 'Brazier charges',
        texture: 'tile-brazier',
        art: '/art/obstacles/brazier.svg',
        instruction:
          'Match on or beside a brazier to charge it, one charge per move. Fill every pip for a free bomb. Gems pass freely, and bonuses charge it too.',
      },
    },
    decorations: [
      decoration('M83 900V345q0-38 45-38h45M1355 930V385q0-40-47-40h-44', 'none', 0.6, 12),
      decoration('M83 505h37m-37 100h37m-37 100h37m1197-152h38m-38 100h38', 'none', 0.5, 7),
      decoration('M25 982q55-76 123-18m1168 0q58-62 108 13', 'none', 0.4, 9),
    ],
  },
};

// Every deeper chapter uses the same names and pictures when a familiar goal
// returns in another cavern. Scenery changes; the player's learned rule does not.
const deepSignals = {
  lantern: themes['glowshroom-grotto'].signals.lantern,
  core: themes['geothermal-forge'].signals.core,
};
for (const definition of Object.values(themes))
  definition.signals = { ...deepSignals, ...definition.signals };

export const mineThemeAppearance = (theme) => themes[theme] ?? fallback;
export const mineSignalAppearance = (theme, signal) =>
  themes[theme]?.signals?.[signal] ?? fallback.signals[signal];
export const mineRelicAppearance = (theme) => themes[theme]?.relic ?? relic;

// One sprite catalog drives both build-time rasterization and SVG recovery.
export const DEEP_MINE_SPRITES = [
  ['tile-dust', 'obstacles/dust.svg'],
  ['tile-fossil', 'obstacles/fossil.svg'],
  ['tile-root-knot', 'obstacles/root-knot.svg'],
  ['tile-vine', 'obstacles/vine.svg'],
  ['tile-mushroom', 'obstacles/mushroom.svg'],
  ['tile-brazier', 'obstacles/brazier.svg'],
  ['gem-pearl', 'obstacles/pearl.svg'],
  ['tile-pearl-exit', 'obstacles/pearl-exit.svg'],
];
