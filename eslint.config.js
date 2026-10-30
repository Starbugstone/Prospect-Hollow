import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

// Everything drawn over a settlement map (AGENTS.md, settlement maps): the maps, every
// component TownView mounts inside `.town-map-frame` and every component those draw.
// The Build, Story and More tabs open in TownDialog, outside the frame.
// testing/map-overlays.test.js fails when a component drawn over a map is missing here.
export const MAP_OVERLAY_FILES = [
  'src/components/GameIcon.vue',
  'src/components/GameViewStatus.vue',
  'src/components/SaveStatusPill.vue',
  'src/components/town/TownActionIcon.vue',
  'src/components/town/TownCommissionGoal.vue',
  'src/components/town/TownCrest.vue',
  'src/components/town/TownDefenseStatus.vue',
  'src/components/town/TownIcon.vue',
  'src/components/town/TownLabelStatus.vue',
  'src/components/town/TownMapLabel.vue',
  'src/components/town/TownLandmarkPreview.vue',
  'src/components/town/TownMoon.vue',
  'src/components/town/TownMoonBuilding.vue',
  'src/components/town/TownMoonConstruction.vue',
  'src/components/town/TownMoonMonument.vue',
  'src/components/town/TownMoonView.vue',
  'src/components/town/TownMoonstoneBalance.vue',
  'src/components/town/TownRaidNotice.vue',
  'src/components/town/TownResourceCollection.vue',
  'src/components/town/TownScene.vue',
  'src/components/town/TownSettlementNotice.vue',
  'src/components/town/TownTabBar.vue',
  'src/components/town/TownVisitorNotice.vue',
];
// Lists, dropdowns and letters, which belong in the Build, Story or More tabs.
export const MAP_OVERLAY_ELEMENTS = ['details', 'summary', 'ul', 'ol', 'select', 'dialog'];

// Correctness rules only; Prettier owns formatting.
export default [
  {
    ignores: [
      'dist/',
      'output/',
      'backend/',
      'capacitor/',
      'public/',
      'src/data/generated/',
      'src/assets/meshes/',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // __CLIENT_BUILD__ is the build Vite stamps on cloud uploads (vite.config.js).
      globals: { ...globals.browser, ...globals.node, __CLIENT_BUILD__: 'readonly' },
    },
    rules: {
      // Callbacks keep their full signatures; `{ omit, ...rest }` drops fields on purpose.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      // An empty catch marks an optional capability (storage, WebGL probes).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Route planners share one generator contract; some finish without yielding.
      'require-yield': 'off',
      // Catch stale template handlers when script functions are renamed.
      'vue/no-undef-properties': 'error',
      // The admin panel names its single-word views after their routes.
      'vue/multi-word-component-names': 'off',
      // Every settlement map shares one camera gesture set (AGENTS.md, settlement maps).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three/addons/controls/*', 'three/examples/jsm/controls/*'],
              message:
                'Settlement maps share one gesture set: use createTownControls from src/game/town/TownControls.js.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/game/town/TownControls.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The maps stay uncluttered (AGENTS.md, settlement maps): lists, dropdowns and
    // letters belong in the Build, Story or More tabs, never floating over a map.
    files: MAP_OVERLAY_FILES,
    rules: {
      'vue/no-restricted-html-elements': [
        'error',
        ...MAP_OVERLAY_ELEMENTS.map((element) => ({
          element,
          message:
            'Map overlays hold only labels and action buttons. Put lists, dropdowns and letters in the Build, Story or More tabs.',
        })),
      ],
    },
  },
];
