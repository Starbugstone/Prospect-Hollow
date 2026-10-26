// Run against Docker Vite with the setup in docs/future-eras.md#moon-input-check.
const assert = require('node:assert/strict');
const {
  chromium,
  SOFTWARE_WEBGL,
  fixturePage,
  openFixture,
  pageErrors,
  testOrigin,
} = require('./helpers.cjs');
const fixture = fixturePage({
  stylesheets: [
    '/src/styles/base.css',
    '/src/styles/theme.css',
    '/src/styles/town.css',
    '/src/styles/ux.css',
  ],
  style: 'body{margin:0}.map,.town-scene{position:relative;width:100vw;height:100vh}',
  body: '<div id="fixture" class="town-view"></div>',
  script: `
import {createApp,h,reactive,nextTick} from '/node_modules/.vite/deps/vue.js';
import {createPinia} from '/node_modules/.vite/deps/pinia.js';
import Valley from '/src/components/town/TownScene.vue';
import Moon from '/src/components/town/TownMoonView.vue';
import {createTown} from '/src/data/town.js';
import {setLocale} from '/src/i18n/index.js';
window.town=reactive(createTown());town.era='twin-hollows';
Object.assign(town.buildings,{spaceElevator:3,saloon:1,settlerDomes:1});
window.state=reactive({selected:false,readOnly:false,indicators:{}});
window.app=createApp({render:()=>h('div',[
  h('div',{class:'map',id:'earth'},[h(Valley,{town,active:false,now:0,needChips:[],readOnly:state.readOnly,selected:state.selected?'saloon':null})]),
  h('div',{class:'map',id:'moon'},[h(Moon,{town,active:false,reducedMotion:true,indicators:state.indicators,readOnly:state.readOnly,selected:state.selected?'settlerDomes':null})]),
])});app.use(createPinia());app.mount('#fixture');
window.maps=()=>app._instance.subTree.children.map(root=>root.children[0].component.setupState);
window.prepare=async(kind,locale)=>{
  setLocale(locale);state.selected=kind==='selected';state.readOnly=kind==='visitor';
  for(const id of ['saloon','settlerDomes']){
    delete town.projects[id];
    if(['work','ready'].includes(kind))town.projects[id]={id,stage:2,wins:kind==='ready'?2:1,required:2};
  }
  state.indicators=kind==='ready'?{settlerDomes:'ready'}:{};
  await nextTick();
  const [earth,moon]=maps();
  earth.anchors=[{id:'saloon',x:50,y:60,width:230,visible:true}];
  moon.cameraDistance=40;moon.labels=[{id:'settlerDomes',x:50,y:60,visible:true}];
  await nextTick();
};
`,
});
const readStyle = (label) =>
  label.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {})));
    const properties = [
      'display',
      'alignItems',
      'justifyContent',
      'gap',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'color',
      'backgroundColor',
      'padding',
      'borderRadius',
      'borderColor',
      'borderWidth',
      'outlineColor',
      'outlineWidth',
      'outlineOffset',
      'boxShadow',
    ];
    const read = (part) => {
      const css = getComputedStyle(part);
      return Object.fromEntries(properties.map((key) => [key, css[key]]));
    };
    const transform = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return {
      scale: [transform.a, transform.d],
      button: read(el),
      name: read(el.querySelector('.plot-name')),
      status: read(el.querySelector('small')),
    };
  });
(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errors = pageErrors(page, { echo: true });
    // Use the same optimized Pinia module as the app; a second URL creates a
    // different injection key even in a fresh browser context.
    const storeSource = await (
      await page.request.get(`${testOrigin()}/src/stores/settingsStore.js`)
    ).text();
    const piniaModule = storeSource.match(/from ["']([^"']*\/pinia\.js[^"']*)["']/)[1];
    await openFixture(
      page,
      'town-label-parity-test',
      fixture.replace('/node_modules/.vite/deps/pinia.js', piniaModule),
    );
    await page.waitForFunction(() => !!window.maps?.()[1].scene);
    await page.evaluate(() => {
      const scene = window.maps()[1].scene;
      scene.setMotion(false);
      scene.onLabels = () => {};
    });
    const earth = page.locator('#earth .town-map-label[data-town-plot="saloon"]');
    const moon = page.locator('#moon .town-map-label[data-moon-lot="settlerDomes"]');
    for (const [width, height] of [
      [1440, 900],
      [900, 360],
      [375, 740],
    ]) {
      await page.setViewportSize({ width, height });
      for (const locale of ['en', 'fr']) {
        for (const state of ['built', 'selected', 'work', 'ready', 'visitor']) {
          await page.evaluate(([state, locale]) => window.prepare(state, locale), [state, locale]);
          await earth.waitFor({ state: 'visible' });
          await moon.waitFor({ state: 'visible' });
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
          assert.deepEqual(
            await readStyle(moon),
            await readStyle(earth),
            `${width} ${locale} ${state}: shared computed label styles`,
          );
        }
        await page.evaluate((locale) => window.prepare('built', locale), locale);
        await earth.hover();
        const earthHover = await readStyle(earth);
        await moon.hover();
        assert.deepEqual(await readStyle(moon), earthHover, 'Hover matches');
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await earth.focus();
        const earthFocus = await readStyle(earth);
        await moon.focus();
        assert.deepEqual(await readStyle(moon), earthFocus, 'Keyboard focus matches');
        await page.evaluate(() => document.activeElement?.blur());
        await earth.hover();
        await page.mouse.down();
        const earthPress = await readStyle(earth);
        await page.mouse.up();
        await moon.hover();
        await page.mouse.down();
        assert.deepEqual(await readStyle(moon), earthPress, 'Press matches');
        await page.mouse.up();
      }
      console.log(
        `${width}x${height}: Earth/Moon built, selected, construction, ready, visitor, hover, focus and press styles match in English and French.`,
      );
    }
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.app.unmount());
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
