// Setup shared by the standalone Playwright checks in this directory. Each check still
// runs on its own against a Vite server (docs/future-eras.md#moon-input-check shows
// the Docker commands); PLAYWRIGHT_MODULE points at the Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Chromium flags for a software WebGL renderer in headless Docker.
const SOFTWARE_WEBGL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

// The server under test: PH_TEST_ORIGIN, or the documented Docker Vite port.
const testOrigin = () => process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:8192';

// Collects uncaught page errors and, unless `consoleErrors` is false, console errors.
// `echo` also prints each one as it happens.
function pageErrors(page, { consoleErrors = true, echo = false } = {}) {
  const errors = [];
  const add = (message) => {
    errors.push(message);
    if (echo) console.error(message);
  };
  page.on('pageerror', (error) => add(error.message));
  if (consoleErrors)
    page.on('console', (message) => {
      if (message.type() === 'error') add(message.text());
    });
  return errors;
}

// A signed-out device save in which every level before `level` is played, so `level`
// is the next one the mine opens.
function playedProfile(level) {
  const records = {};
  for (let id = 1; id < level; id++) records[id] = { score: 0, stars: 1 };
  return { schemaVersion: 2, records, seenTips: ['town'], town: {} };
}

// Runs in the page before the app starts: `context.addInitScript(preparePage, options)`.
// - `webgl: false` makes WebGL unavailable, so the village uses its lightweight fallback.
// - `profile` is the signed-out device save, written on every load.
// - `account` ({ id, email, generation, towns }) signs in once per browser profile;
//   each town ({ id, name, revision, profile }) is stored as an unchanged cloud copy.
//   Without a `generation` the session gets a random one.
// It also adds `window.stores()`, the app's Pinia stores by id, and
// `window.cloudModule()`, the cloud module instance the mounted app uses.
function preparePage({ webgl = true, profile, account } = {}) {
  if (!webgl) {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
    };
  }
  if (profile) localStorage.setItem('crystal-cascade-profile-v3', JSON.stringify(profile));
  if (account && !localStorage.getItem('prospect-account-v2')) {
    localStorage.setItem(
      'prospect-account-v2',
      JSON.stringify({
        account: { id: account.id, email: account.email },
        generation: account.generation ?? crypto.randomUUID(),
      }),
    );
    for (const town of account.towns ?? [])
      localStorage.setItem(
        `prospect-town-v2:${account.id}:${town.id}`,
        JSON.stringify({
          ...town.profile,
          _cloud: {
            version: 2,
            active: {
              id: town.id,
              name: town.name,
              owner: account.id,
              baseRevision: town.revision,
              sequence: 0,
              dirty: false,
              pending: null,
              conflict: null,
            },
          },
        }),
      );
  }
  window.stores = () =>
    document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s;
  window.cloudModule = async () => {
    const active = document.querySelector('#app').__vue_app__._instance.setupState.cloud;
    const urls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => new URL(url).pathname === '/src/services/cloudProfile.js')
      .reverse();
    for (const url of urls) {
      const module = await import(url);
      if (module.cloud === active) return module;
    }
    throw new Error('Cannot locate the mounted cloud module.');
  };
}

// A test page that loads modules straight from the Vite server: stylesheets, page
// CSS, body markup and a module script.
function fixturePage({ stylesheets = [], style = '', body = '', script }) {
  const links = stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join('');
  return `<!doctype html><html><head>${links}<style>${style}</style></head><body>${body}<script type="module">${script}</script></body></html>`;
}

// The Moon map checks mount TownMoonView full screen in `#fixture`.
const moonPage = (script) =>
  fixturePage({
    stylesheets: ['/src/styles/base.css', '/src/styles/town.css'],
    style: 'body{margin:0}#fixture{position:relative;width:100vw;height:100vh}',
    body: '<div id="fixture"></div>',
    script,
  });

// Serves `html` at `/<name>` on the server under test and opens it.
async function openFixture(page, name, html) {
  await page.route(`**/${name}`, (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  await page.goto(`${testOrigin()}/${name}`);
}

module.exports = {
  chromium,
  SOFTWARE_WEBGL,
  testOrigin,
  pageErrors,
  playedProfile,
  preparePage,
  fixturePage,
  moonPage,
  openFixture,
};
