// Real Three.js import and animation review under the valley's renderer and lights.
// Run against Docker Vite, using the Playwright Docker command in future-eras.md.
const fs = require('node:fs');
const path = require('node:path');
const { chromium, SOFTWARE_WEBGL, fixturePage, openFixture, pageErrors } = require('./helpers.cjs');

const directory = path.resolve('output/monuments');
fs.mkdirSync(directory, { recursive: true });
const html = fixturePage({
  style: 'body{margin:0;background:#e2dfc8}canvas{width:100vw;height:100vh;display:block}',
  body: '<canvas></canvas>',
  script: `
import * as THREE from '/node_modules/.vite/deps/three.js';
import { TownPrimitives } from '/src/game/town/TownPrimitives.js';
import { buildLandmark } from '/src/game/town/TownLandmarks.js';
import { loadFamilies } from '/src/game/town/assets/MeshCatalog.js';
import { createTownRenderer } from '/src/game/town/TownRenderer.js';
import { setTownAtmosphere } from '/src/game/town/TownAtmosphere.js';
import { TownStatics } from '/src/game/town/TownStatics.js';
import { TownActors } from '/src/game/town/TownActors.js';
await loadFamilies(['monuments']);
const d = new TownPrimitives();
const scene = new THREE.Scene();
setTownAtmosphere(scene);
scene.fog = null;
scene.add(new THREE.HemisphereLight('#e1eff7','#ba9460',2.1));
const sun = new THREE.DirectionalLight('#ffe3ad',3.5);
sun.position.set(15,25,20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-14,right:14,top:18,bottom:-14,near:1,far:80});
sun.shadow.normalBias=.025;
scene.add(sun);
const fill = new THREE.DirectionalLight('#cde5e7',.65);
fill.position.set(-10,8,-6);
scene.add(fill);
const { renderer } = createTownRenderer(document.querySelector('canvas'),{exposure:1.25});
renderer.setSize(innerWidth,innerHeight);
const camera = new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,200);
d.mesh(scene,'cylinder',[40,.1,40],[0,-.1,0],'#c6cbac');
const statics = new TownStatics(scene);
const actors = new TownActors(scene);
let root;
window.showMonument = (choice,angle=0,time=0) => {
  d.clearGroup(root);
  root=buildLandmark(d,scene,choice,1,true);
  if (!root.getObjectByName('Blender '+choice)) throw new Error('Missing sculpture '+choice);
  root.userData.sceneryUpdate(time);
  statics.sync([root]);
  actors.rebuild(root.userData.movingParts);
  // Use the same static batches and animated instances as the normal town.
  camera.layers.enable(2);
  for(const light of [sun,fill,...scene.children.filter(o=>o.isHemisphereLight)]) light.layers.enable(2);
  camera.position.set(Math.sin(angle+.38)*24,18,Math.cos(angle+.38)*24);
  camera.lookAt(0,5.2,0);
  renderer.render(scene,camera);
  const bounds=new THREE.Box3().setFromObject(root);
  return {choice,triangles:renderer.info.render.triangles,draws:renderer.info.render.calls,
    movingDraws:actors.buckets.length,staticDraws:statics.meshes.length,
    bounds:[bounds.min.toArray(),bounds.max.toArray()],substitute:!!root.userData.substitute};
};
window.ready=true;
`,
});

const cards = fixturePage({
  stylesheets: ['/src/styles/base.css', '/src/styles/town.css'],
  style: 'body{margin:0;padding:20px}#fixture{max-width:760px;margin:auto}',
  body: '<div id="fixture"></div>',
  script: `
import { createApp,h } from '/node_modules/.vite/deps/vue.js';
import Site from '/src/components/town/TownMonumentSite.vue';
import { createTown } from '/src/data/town.js';
const town=createTown();town.era='industrial';town.coins=20000;
createApp({render:()=>h(Site,{town,id:'monument'})}).mount('#fixture');
`,
});

const townMap = fixturePage({
  style: 'body{margin:0}canvas{width:100vw;height:100vh;display:block}',
  body: '<canvas></canvas>',
  script: `
import { TownDiorama } from '/src/game/town/TownDiorama.js';
import { createTown,BUILDINGS } from '/src/data/town.js';
import { loadFamilies,requiredFamilies } from '/src/game/town/assets/MeshCatalog.js';
import { loadFootprints } from '/src/game/town/FootprintCatalog.js';
const town=createTown();town.era='industrial';
town.personalisation.areas.monument=['guardian'];town.personalisation.areaLevels.monument=1;
await loadFamilies(requiredFamilies(town));await loadFootprints(town);
const d=new TownDiorama(document.querySelector('canvas'),{
  onSelect(){},onLabels(){},onCameraDistance(){},onFirstFrame(){},
  onUnavailable(error){throw error;}
});
d.changeTown(town,Object.fromEntries(BUILDINGS.map(b=>[b.id,b.shortName])),30,null,{reducedMotion:true,instant:true});
d.setMotion(true);d.setPaused(false);
window.mapReady=()=>d.lifeReady===true&&!d.plotsPending();
window.frameMonument=()=>{
  if(!d.staticScenery.entries.get('personal-areas').group.getObjectByName('Blender guardian'))
    throw new Error('Town did not import the selected sculpture');
  d.focusPlace('monument');d.render();
};
`,
});

(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  try {
    const page = await browser.newPage({
      viewport: { width: 900, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = pageErrors(page, { echo: true });
    await openFixture(page, 'monument-sculptures', html);
    await page.waitForFunction(() => window.ready, null, { timeout: 90000 });
    const report = [];
    for (const choice of [
      'guardian',
      'founders-arch',
      'crystal-spire',
      'world-tree',
      'celestial-sphere',
    ]) {
      for (const [view, angle, time] of [
        ['front', 0, 0],
        ['back', Math.PI, 4],
      ]) {
        report.push(
          await page.evaluate(
            ({ choice, angle, time }) => window.showMonument(choice, angle, time),
            { choice, angle, time },
          ),
        );
        await page.screenshot({ path: path.join(directory, choice + '-' + view + '.png') });
      }
    }
    await openFixture(page, 'monument-town-map', townMap);
    await page.waitForFunction(() => window.mapReady?.(), null, { timeout: 90000 });
    await page.evaluate(() => window.frameMonument());
    await page.screenshot({ path: path.join(directory, 'guardian-town.png') });
    await openFixture(page, 'monument-choice-cards', cards);
    await page.locator('svg image').first().waitFor();
    if ((await page.locator('svg image').count()) !== 5)
      throw new Error('Missing choice portraits');
    await page.evaluate(async () => {
      await Promise.all(
        [...document.querySelectorAll('svg image')].map(async (element) => {
          const image = new Image();
          image.src = element.href.baseVal;
          await image.decode();
        }),
      );
    });
    const owl = page.getByRole('radio', { name: /Guardian of the Hollow/ });
    await owl.click();
    if ((await owl.getAttribute('aria-checked')) !== 'true')
      throw new Error('Choice selection failed');
    await page.screenshot({ path: path.join(directory, 'choices-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 412, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error('Choice cards overflow on mobile');
    await page.screenshot({ path: path.join(directory, 'choices-mobile.png'), fullPage: true });
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(
      path.join(directory, 'runtime.json'),
      JSON.stringify(
        {
          viewport: [900, 900],
          renderer: 'Chromium SwiftShader / valley lighting',
          report,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
