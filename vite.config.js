import { configDefaults, defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'town-landing-preloads',
      transformIndexHtml: {
        order: 'post',
        handler(html, context) {
          if (!context.bundle || !context.path.endsWith('/index.html')) return html;
          return {
            html,
            tags: Object.values(context.bundle)
              .filter(
                (asset) =>
                  asset.type === 'chunk' &&
                  /(?:TownView\.vue|TownDiorama\.js)$/.test(asset.facadeModuleId ?? ''),
              )
              .map((asset) => ({
                tag: 'link',
                attrs: { rel: 'modulepreload', href: `/${asset.fileName}` },
                injectTo: 'head',
              })),
          };
        },
      },
    },
    {
      // The admin panel is its own page; serve it at /admin in development too.
      name: 'admin-page',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (/^\/admin\/?(?:[?#]|$)/.test(request.url)) request.url = '/admin.html';
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      phaser3spectorjs: path.resolve(__dirname, 'testing/mocks/phaser3spectorjs.js'),
    },
  },
  build: {
    manifest: true,
    // Phaser ships as one prebuilt library, larger than any game chunk should be.
    // scripts/check-bundle-budget.mjs holds every chunk to its own budget instead.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
      output: {
        // Libraries get their own chunks, which stay cached across game releases.
        // Phaser and Three load with the mine and the town; the rest at startup.
        // Rollup's CommonJS helpers join the startup chunk, so that sharing them
        // never makes startup import Phaser.
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return 'phaser';
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/') || id.startsWith('\0commonjsHelpers')) return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'node',
    setupFiles: ['testing/setup-locale.js', 'testing/setup-meshes.js'],
    include: ['testing/**/*.test.js'],
    // Whole-campaign level simulations are slow and only change with the levels: run them
    // locally with `npm run test:levels` (vitest.levels.config.js), not on every push.
    exclude: [...configDefaults.exclude, 'testing/levels/**'],
  },
});
