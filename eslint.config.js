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
    },
  },
];
