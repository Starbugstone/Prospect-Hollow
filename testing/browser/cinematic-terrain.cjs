// Real settlement renderers and terrain meshes; Docker commands live in the
// prospect-hollow-cinematics skill's verification reference.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, SOFTWARE_WEBGL, fixturePage, openFixture, pageErrors } = require('./helpers.cjs');

const output = path.resolve(process.env.PH_CINEMATIC_OUTPUT || 'output/cinematic-terrain');
fs.mkdirSync(output, { recursive: true });
const captureSite = process.env.PH_CINEMATIC_CAPTURE_SITE;
if (captureSite)
  assert.ok(
    ['meadow', 'monument', 'earthrise-plaza', 'earthlight-conservatory'].includes(captureSite),
    'Choose a site covered by this fixture',
  );
const fixture = (settlement) =>
  fixturePage({
    style: 'body{margin:0}canvas{display:block;width:100vw;height:100vh}',
    body: '<canvas></canvas>',
    script: `
import {Vector3,Raycaster} from '/node_modules/.vite/deps/three.js';
import {TownDiorama} from '/src/game/town/TownDiorama.js';
import {MoonScene,moonHeight} from '/src/game/town/moon/MoonScene.js';
import {cameraTerrainHeight,keepCameraAboveTerrain} from '/src/game/town/TownLandscape.js';
import {monumentPresentation} from '/src/data/townPresentations.js';
import {PERSONAL_AREAS} from '/src/data/townLandmarks.js';
import {createTown,BUILDINGS} from '/src/data/town.js';
import {loadFamilies,requiredFamilies} from '/src/game/town/assets/MeshCatalog.js';
import {loadFootprints} from '/src/game/town/FootprintCatalog.js';
const settlement=${JSON.stringify(settlement)};
const town=createTown();town.era='twin-hollows';
for(const building of BUILDINGS) town.buildings[building.id]=3;
for(const area of PERSONAL_AREAS){
  town.personalisation.areas[area.id]=[area.choices[0]];
  town.personalisation.areaLevels[area.id]=1;
}
await loadFamilies(requiredFamilies(town));await loadFootprints(town);
const d=settlement==='moon'?new MoonScene(document.querySelector('canvas')):
  new TownDiorama(document.querySelector('canvas'),{
    onSelect(){},onLabels(){},onCameraDistance(){},onFirstFrame(){},
    onUnavailable(error){throw error;}
  });
if(settlement==='moon')d.update(town);
else d.changeTown(town,Object.fromEntries(BUILDINGS.map(b=>[b.id,b.shortName])),30,null,{reducedMotion:true,instant:true});
window.ready=()=>settlement==='moon'||d.lifeReady===true&&!d.plotsPending();
window.scene=d;
window.prepare=(id,start)=>{
  d.setPresentation(null);
  d.eventCamera=null;
  d.motionEnabled=false;
  d.renderer.setAnimationLoop(null);
  d.camera.position.fromArray(start);d.controls.target.set(0,.7,0);
  keepCameraAboveTerrain(d.camera.position,d.controls.target,undefined,d.terrainHeight);
  const area=PERSONAL_AREAS.find(a=>a.id===id);
  d.setPresentation(monumentPresentation(id,area.choices[0],1));
};
window.audit=(injectOcclusion=false)=>{
  const terrain=[];
  const root=settlement==='moon'?d.scene.getObjectByName('Moon crater'):d.landscape;
  // Valley batching reparents the source meshes and moves them to layer 1.
  // Ground, exposed mine face and shoulder all retain their vertex colors.
  root.traverse(object=>{
    if(object.isMesh&&object.geometry.attributes.color&&object.material.isMeshStandardMaterial)
      terrain.push(object);
  });
  // The connected shoulder belongs to the era scenery, outside the landscape root.
  if(settlement==='valley'){
    const shoulder=d.scene.getObjectByName('Mine shoulder and tunnel');
    if(!shoulder?.isMesh)throw new Error('Connected mine shoulder is missing from the terrain audit');
    terrain.push(shoulder);
  }
  if(!terrain.length)throw new Error('No terrain meshes found for '+settlement);
  d.scene.updateMatrixWorld(true);
  const ray=new Raycaster(),base=new Vector3(),delta=new Vector3();
  ray.layers.enableAll();
  ray.set(new Vector3(0,30,0),new Vector3(0,-1,0));ray.far=50;
  if(!ray.intersectObjects(terrain,false).length)throw new Error('Terrain ray self-check missed the ground');
  const render=d.render;d.render=()=>{};
  let frames=0;
  try{
    for(let time=0;time<=16;time+=.25){
      d.presentationFrame(time);
      base.copy(d.controls.target);
      const height=(d.terrainHeight??cameraTerrainHeight)(base.x,base.z);
      base.y=Math.min(base.y,height+.25);
      if(injectOcclusion&&time===0){d.camera.position.set(0,30,0);base.set(0,-1,0);}
      delta.subVectors(base,d.camera.position);
      ray.set(d.camera.position,delta.clone().normalize());ray.far=delta.length()-.05;
      const hits=ray.intersectObjects(terrain,false);
      if(hits.length)throw new Error('Terrain blocks '+settlement+' at '+time+'s: '+hits[0].point.toArray());
      frames++;
    }
  }finally{d.render=render;}
  return {frames,terrainMeshes:terrain.length};
};
window.frame=(time)=>{d.elapsed=time;d.presentationFrame(time);return {
  eye:d.camera.position.toArray(),focus:d.controls.target.toArray(),draws:d.renderer.info.render.calls
};};
window.still=()=>{
  const before=d.camera.position.clone();d.presentationFrame(16,true);
  return before.equals(d.camera.position);
};
window.record=async()=>{
  const stream=document.querySelector('canvas').captureStream(30);
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
  const chunks=[];
  recorder.ondataavailable=event=>event.data.size&&chunks.push(event.data);
  const stopped=new Promise(resolve=>recorder.onstop=resolve);
  const intervals=[],poses=[];
  try{
    recorder.start();
    await new Promise(resolve=>{
      let started,previous;
      const tick=now=>{
        started??=now;
        if(previous!==undefined)intervals.push(now-previous);
        previous=now;
        const time=Math.min(16,(now-started)/1000);
        poses.push({time,...window.frame(time)});
        if(time<16)requestAnimationFrame(tick);else resolve();
      };
      requestAnimationFrame(tick);
    });
    recorder.stop();await stopped;
    const bytes=Array.from(new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer()));
    return {bytes,intervals,poses,mimeType:recorder.mimeType};
  }finally{stream.getTracks().forEach(track=>track.stop());}
};
`,
  });

(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  const report = [];
  try {
    for (const [width, height] of [
      [390, 844],
      [1280, 800],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = pageErrors(page, { echo: true });
      for (const settlement of ['valley', 'moon']) {
        await openFixture(page, `cinematic-terrain-${settlement}`, fixture(settlement));
        await page.waitForFunction(() => window.ready?.(), null, { timeout: 120000 });
        for (const id of settlement === 'moon'
          ? ['earthrise-plaza', 'earthlight-conservatory']
          : ['meadow', 'monument']) {
          for (const [startName, start] of [
            ['overview', [0, 26, 66]],
            ['low', [0, 4, 90]],
          ]) {
            await page.evaluate(({ id, start }) => window.prepare(id, start), { id, start });
            const audit = await page.evaluate(
              (inject) => window.audit(inject),
              process.env.PH_CINEMATIC_INJECT_OCCLUSION === '1',
            );
            for (const time of [0.75, 7, 16]) {
              const pose = await page.evaluate((time) => window.frame(time), time);
              assert.ok(pose.draws > 0, 'The real renderer must draw the shot');
              const name = `${settlement}-${id}-${width}-${startName}-${time}`;
              await page.screenshot({ path: path.join(output, `${name}.png`), timeout: 60000 });
              report.push({ name, ...audit, ...pose });
            }
            assert.equal(
              await page.evaluate(() => window.still()),
              true,
              'Reduced motion preserves the camera',
            );
            if (captureSite === id && width === 390 && startName === 'low') {
              await page.evaluate(({ id, start }) => window.prepare(id, start), { id, start });
              const { bytes, ...metadata } = await page.evaluate(() => window.record());
              fs.writeFileSync(path.join(output, `${id}.webm`), Buffer.from(bytes));
              fs.writeFileSync(
                path.join(output, `${id}-video.json`),
                JSON.stringify(
                  {
                    ...metadata,
                    settlement,
                    id,
                    width,
                    height,
                    start,
                    duration: 16,
                    capture:
                      'Silent canvas recording at real wall-clock speed with software WebGL; no caption overlay',
                  },
                  null,
                  2,
                ),
              );
              console.log(`Recorded ${id}.webm (${bytes.length} bytes)`);
            }
          }
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(
      `PASS: ${report.length} rendered shots; terrain rays, portrait/landscape, low entry and reduced motion`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
