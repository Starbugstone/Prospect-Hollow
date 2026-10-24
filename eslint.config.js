import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

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
      globals: { ...globals.browser, ...globals.node },
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
    // The 3D maps stay uncluttered (AGENTS.md, settlement maps): lists, dropdowns and
    // letters belong in the Build, Story or More tabs, never floating over a map.
    files: ['src/components/town/TownScene.vue', 'src/components/town/TownMoonView.vue'],
    rules: {
      'vue/no-restricted-html-elements': [
        'error',
        ...['details', 'summary', 'ul', 'ol', 'select', 'dialog'].map((element) => ({
          element,
          message:
            'Map overlays hold only labels and action buttons. Put lists, dropdowns and letters in the Build, Story or More tabs.',
        })),
      ],
    },
  },
];
