import { configDefaults, defineConfig } from 'vitest/config';
import base from './vite.config.js';

// Level simulations only: every authored level played on fixed seeds (completion without
// inventory powers, pacing and three-star attainment). Run `npm run test:levels` after
// adding or changing levels, star targets, scoring or bonus rules. CI skips them.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['testing/levels/**/*.test.js'],
    exclude: configDefaults.exclude,
  },
});
