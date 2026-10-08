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
    'Light every lantern by matching on it. Bonuses that hit it light it too; gems pass freely.',
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
    'Clear gems below the golden relic so it falls through a marked exit at the bottom. Swap a bonus gem with a relic to fire it in the relic’s place. Relics cannot be destroyed. Collect them all to finish.',
};
const fallback = Object.freeze({ style: {}, decorations: [], signals: { lantern, core }, relic });
const moonGem = {
  id: 'moon-gem',
  name: 'Moon gems',
  goalLabel: 'Moon gems to deliver',
  texture: 'gem-moon-gem',
  exitTexture: 'tile-exit',
  art: '/art/obstacles/moon-gem.svg',
  instruction:
    'Moon gems fall like relics. Clear below them so they drop into a portal, come out at its pair and fall on into the basket. Swap a bonus gem with a moon gem to fire it in its place.',
};
// Pearls are the reservoir's relics; later chapters reuse them.
const pearl = {
  id: 'pearl',
  name: 'Pearl delivery',
  goalLabel: 'Pearls to deliver',
  texture: 'gem-pearl',
  exitTexture: 'tile-pearl-exit',
  art: '/art/obstacles/pearl.svg',
  instruction:
    'Clear below the pearls. They roll inward along the marked slopes to one basket. Make bonus gems in the wide upper chamber and blast the gate at the narrow bottom to open the exit. Swap a bonus gem with a pearl to fire it in the pearl’s place.',
};
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
      spore: {
        id: 'spore',
        name: 'Spore relays',
        goalLabel: 'Spore relays',
        texture: 'tile-mushroom',
        art: '/art/obstacles/mushroom.svg',
        instruction:
          'Match on or beside a mushroom to fire its spore burst along the arrows. The burst clears that row or column, cracks blast gates and triggers mushrooms it hits. Each mushroom fires once.',
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
    relic: pearl,
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
  'riverglass-seams': {
    style: palette('#14262e', '#2b5560', '#2f4a52', '#8cc7c9', '#4d6b6b', '#c6fff2'),
    decorations: [
      decoration(
        'M60 300l40-70 30 80-45 25ZM1300 520l35-60 25 70-40 20Z',
        'var(--mine-accent)',
        0.2,
      ),
      decoration('M40 760q120-40 210 10M1210 770q110-45 220 5', 'none', 0.45, 6),
      decoration(
        'M120 640l18-30 14 34-20 10ZM1340 330l14-26 12 30-17 8Z',
        'var(--mine-accent)',
        0.3,
      ),
    ],
  },
  'floatstone-shafts': {
    style: palette('#1a2233', '#3d4f74', '#36455f', '#9fb8e0', '#5a6680', '#e0f4ff'),
    decorations: [
      decoration('M90 940V120m1260 820V160', 'none', 0.35, 10),
      decoration(
        'M60 520l30-30 30 30-30 30ZM1320 420l26-26 26 26-26 26Z',
        'var(--mine-accent)',
        0.3,
      ),
      decoration('M150 300h6m40 60h6m1150-120h6m-40 70h6M120 700h6m1210 40h6', 'none', 0.7, 8),
    ],
  },
  'glowing-fossils': {
    style: palette('#1a2420', '#3f5741', '#4b4a36', '#a6b07c', '#625a3d', '#b8ffd8'),
    decorations: [
      decoration(
        'M140 560c-52 30-99-24-73-68 26-43 90-19 79 18-10 33-52 31-62 10-10-21 16-41 31-26',
      ),
      decoration('M62 728q50-120 113 0Z M1294 619q40-100 90 0Z', 'var(--mine-accent)', 0.2),
      decoration('M100 690h6m30 20h6m1180-120h6m22 14h6', 'none', 0.65, 7),
    ],
  },
  'rising-and-falling': {
    relic: pearl,
    style: palette('#16212e', '#33506a', '#334659', '#93b4cf', '#5b6b7a', '#ffe9b0'),
    decorations: [
      decoration('M80 860V180m-24 24 24-24 24 24M1360 180v680m-24-24 24 24 24-24', 'none', 0.4, 8),
      decoration('M150 420a14 14 0 1 0 1 0M1290 600a12 12 0 1 0 1 0', 'var(--mine-accent)', 0.35),
    ],
  },
  'rigging-vault': {
    relic: pearl,
    style: palette('#1c2320', '#3a4b3a', '#45503d', '#9aa77a', '#6b5a40', '#e4f2b8'),
    decorations: [
      decoration('M40 120q90 160 40 320t60 380M1400 120q-90 170-30 330t-70 360', 'none', 0.55, 9),
      decoration('M70 360l30 20m-30 120 30-14m1270 60 30 18m-30 140 30-16', 'none', 0.5, 6),
    ],
  },
  'brazier-chimney': {
    relic: pearl,
    style: palette('#2a1c1c', '#5e3a30', '#57382f', '#c08d6a', '#755048', '#ffcf8f'),
    decorations: [
      decoration('M90 960V140h50v820M1300 960V140h50v820', 'none', 0.45, 8),
      decoration(
        'M115 300q-14-30 0-60 14 30 0 60M1325 420q-14-30 0-60 14 30 0 60',
        'var(--mine-accent)',
        0.35,
      ),
      decoration('M60 990q60-70 120-10m1140 0q60-60 110 10', 'none', 0.4, 9),
    ],
  },
  'starlit-survey': {
    style: palette('#121a2c', '#283a63', '#2a3550', '#8ea0d0', '#4b5677', '#fff1b8'),
    decorations: [
      decoration('M120 220l60 40 50-30 70 60M1240 300l50 50 60-20 40 70', 'none', 0.35, 3),
      decoration(
        'M120 220h4m56 40h4m46-30h4m66 60h4M1240 300h4m46 50h4m56-20h4m36 70h4',
        'none',
        0.9,
        9,
      ),
    ],
  },
  'lens-gallery': {
    style: palette('#161b2b', '#323d5e', '#333a55', '#a6b4d8', '#58607d', '#e6eeff'),
    // Charge cores here give crosses for mirror shots, so they keep their own picture.
    signals: { core },
    decorations: [
      decoration('M60 200l120 120M1380 260l-120 120', 'none', 0.35, 6),
      decoration('M90 640a40 40 0 1 0 1 0M1330 560a34 34 0 1 0 1 0', 'none', 0.4, 5),
    ],
  },
  'spore-observatory': {
    style: palette('#13202a', '#2c4a52', '#2c3f45', '#87b9b5', '#4a6062', '#ffe39a'),
    signals: { core },
    decorations: [
      decoration('M40 940q100-260 260-300M1400 940q-100-260-260-300', 'none', 0.35, 6),
      decoration('M62 728q50-120 113 0Z M1294 619q40-100 90 0Z', 'var(--mine-accent)', 0.18),
    ],
  },
  'phase-vault': {
    style: palette('#191630', '#3a3266', '#352f55', '#a99ce0', '#5b5182', '#f3eaff'),
    decorations: [
      decoration('M120 260a40 40 0 1 0 1 0M1320 380a40 40 0 1 1-1 0', 'none', 0.45, 6),
      decoration(
        'M100 620a24 24 0 1 0 0 48 16 24 0 1 1 0-48ZM1340 700a24 24 0 1 1 0 48 16 24 0 1 0 0-48Z',
        'var(--mine-accent)',
        0.35,
      ),
    ],
  },
  'comet-frost': {
    style: palette('#142030', '#2f4d6a', '#304659', '#a6cbe6', '#556b80', '#e8fbff'),
    decorations: [
      decoration('M60 180q220 40 360 180M1380 520q-200-20-320-150', 'none', 0.35, 7),
      decoration('M420 360a14 14 0 1 0 1 0M1060 370a12 12 0 1 0 1 0', 'var(--mine-accent)', 0.6),
    ],
  },
  'lens-vault': {
    style: palette('#17172b', '#34345e', '#353550', '#b1b0d8', '#5c5a7c', '#fff2c4'),
    signals: { core },
    decorations: [
      decoration('M70 960V200q0-60 60-60M1370 960V200q0-60-60-60', 'none', 0.45, 9),
      decoration('M154 555c-65 38-124-30-91-85 33-54 113-24 99 22-12 41-65 39-78 12', 'none', 0.35),
    ],
  },
  'portal-sidings': {
    style: palette('#1a1a2c', '#3b345c', '#373450', '#b6a8de', '#5e5677', '#fff0c2'),
    relic: moonGem,
    decorations: [
      decoration('M40 900h360m640 0h360M60 940h320m700 0h300', 'none', 0.45, 6),
      decoration('M120 300a50 50 0 1 0 1 0M1300 420a46 46 0 1 0 1 0', 'none', 0.4, 6),
    ],
  },
  'moon-gem-freight': {
    style: palette('#1c1b26', '#3f3a52', '#3a364a', '#bcb3d4', '#625b70', '#ffe4a6'),
    relic: moonGem,
    decorations: [
      decoration('M40 900h360m640 0h360M100 880v40m80-40v40m1060-40v40m80-40v40', 'none', 0.45, 6),
      decoration('M90 520h80v60H90ZM1270 600h80v60h-80Z', 'none', 0.35, 5),
    ],
  },
  breakthrough: {
    style: palette('#241c18', '#4f3d31', '#4a3a2f', '#c6a47a', '#6d5640', '#ffe7a8'),
    decorations: [
      decoration('M60 560h300M1080 560h300', 'none', 0.5, 10),
      decoration('M200 560l-20 60 30 40-20 60M1240 560l20 60-30 40 20 60', 'none', 0.45, 5),
    ],
  },
  'elevator-foundations': {
    style: palette('#20201f', '#46463f', '#45443b', '#c2bc9f', '#6a6654', '#fff3c8'),
    decorations: [
      decoration('M100 960V120m40 840V120M1300 960V120m40 840V120', 'none', 0.4, 6),
      decoration('M100 300h40M100 500h40M100 700h40M1300 400h40M1300 600h40', 'none', 0.5, 5),
    ],
  },
  'portal-pearls': {
    style: palette('#13222e', '#2c4c63', '#2c4456', '#8fb6cc', '#4b6375', '#d9f2ff'),
    relic: pearl,
    decorations: [
      decoration('M0 870q120-35 245 0m950 0q125-35 245 0', 'none', 0.5, 4),
      decoration('M120 300a50 50 0 1 0 1 0M1300 420a46 46 0 1 0 1 0', 'none', 0.4, 6),
    ],
  },
  'ribbon-foundry': {
    style: palette('#1f1a24', '#463b52', '#41384b', '#c7b6dc', '#675a73', '#ffe9c4'),
    signals: { core },
    relic: moonGem,
    decorations: [
      decoration('M720 0v120M700 0v120M740 0v120', 'none', 0.35, 4),
      decoration('M80 960V200q0-50 50-50M1360 960V200q0-50-50-50', 'none', 0.4, 9),
    ],
  },
  'upside-hollow': {
    style: palette('#1d1f29', '#45495c', '#40434f', '#c9cbd6', '#666978', '#f4f1ff'),
    relic: pearl,
    decorations: [
      decoration('M120 220a60 60 0 1 0 1 0M1290 760a50 50 0 1 0 1 0', 'none', 0.35, 6),
      decoration('M60 120q100 60 220 20M1160 860q100 50 240 10', 'none', 0.4, 5),
    ],
  },
  'twin-gravity': {
    style: palette('#1b1d2a', '#424863', '#3d4255', '#c3c8de', '#62677c', '#f0ecff'),
    relic: pearl,
    decorations: [
      decoration('M0 520h300M1140 520h300', 'none', 0.5, 6),
      decoration(
        'M150 480v-120m-20 20 20-20 20 20M150 560v120m-20-20 20 20 20-20',
        'none',
        0.45,
        5,
      ),
    ],
  },
  'moondust-beds': {
    style: palette('#212226', '#4b4d55', '#47484e', '#d3d3d8', '#6c6d74', '#fffbea'),
    decorations: [
      decoration('M140 560c-52 30-99-24-73-68 26-43 90-19 79 18', 'none', 0.35),
      decoration('M60 300a40 40 0 1 0 1 0M1320 640a34 34 0 1 0 1 0', 'none', 0.3, 5),
    ],
  },
  'moon-lock': {
    style: palette('#1c1d2c', '#41426a', '#3c3d58', '#c6c3e8', '#605f80', '#fff1c8'),
    relic: pearl,
    decorations: [
      decoration('M100 200a60 60 0 1 0 1 0M1300 780a60 60 0 1 0 1 0', 'none', 0.4, 6),
      decoration('M130 200h40M1330 780h40', 'none', 0.5, 8),
    ],
  },
  'willowkin-float-grove': {
    style: palette('#17221e', '#33503f', '#36493c', '#a9c89a', '#5c6d4c', '#f4ffd6'),
    decorations: [
      decoration('M120 960V600q0-80 60-140M1320 960V620q0-80-60-140', 'none', 0.5, 12),
      decoration(
        'M180 460q-60-60 0-120 60 60 0 120M1260 480q-60-60 0-120 60 60 0 120',
        'var(--mine-accent)',
        0.3,
      ),
    ],
  },
  'starfall-cavern': {
    style: palette('#13142a', '#2f3266', '#2d2f52', '#aeb2e8', '#4f5280', '#fff4cf'),
    relic: pearl,
    decorations: [
      decoration('M60 100l260 260M1380 160l-240 240', 'none', 0.4, 4),
      decoration('M320 360h4M1140 400h4M200 700h4M1260 760h4', 'none', 0.9, 10),
    ],
  },
};

// Every deeper chapter uses the same names and pictures when a familiar goal
// returns in another cavern. Scenery changes; the player's learned rule does not.
const deepSignals = {
  spore: themes['glowshroom-grotto'].signals.spore,
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
  ['tile-fossil-casing', 'obstacles/fossil-casing.svg'],
  ['tile-blast-gate', 'obstacles/blast-gate.svg'],
  ['tile-blast-mark', 'obstacles/blast-mark.svg'],
  ['gem-floatstone', 'obstacles/floatstone.svg'],
  ['tile-hatch', 'obstacles/hatch.svg'],
  ['tile-starglass', 'obstacles/starglass.svg'],
  ['tile-lens-mirror', 'obstacles/lens-mirror.svg'],
  ['tile-lens-prism', 'obstacles/lens-prism.svg'],
  ['tile-phase-seal', 'obstacles/phase-seal.svg'],
  ['tile-portal-in', 'obstacles/portal-in.svg'],
  ['tile-portal-out', 'obstacles/portal-out.svg'],
  ['gem-moon-gem', 'obstacles/moon-gem.svg'],
  ['tile-cracked-wall', 'obstacles/cracked-wall.svg'],
  ['tile-sealed-rock', 'obstacles/sealed-rock.svg'],
  ['tile-moon-lock', 'obstacles/moon-lock.svg'],
  ['tile-moon-dial', 'obstacles/moon-dial.svg'],
];
