import { defineConfig } from 'vitest/config';
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
          if (!context.bundle) return html;
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
  ],
  resolve: {
    alias: {
      '@': '/src',
      phaser3spectorjs: path.resolve(__dirname, 'testing/mocks/phaser3spectorjs.js'),
    },
  },
  build: { manifest: true },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'node',
    setupFiles: ['testing/setup-meshes.js'],
    include: ['testing/**/*.test.js'],
  },
});
