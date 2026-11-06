// Residents visibly use a finished commission, in the real game at phone size. Each valley
// outcome is loaded as a player's save would be; its townsfolk must walk certified paths
// to the site and do what the outcome promises. The Moon's outcomes run on MoonScene as in
// moon-commission.cjs. Needs `npm run demo:eras` first, then the Docker Vite/Playwright
// setup of moon-input.cjs. PH_SCREENSHOT_DIR saves a frame sequence of each outcome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  chromium,
  SOFTWARE_WEBGL,
  fixturePage,
  openFixture,
  pageErrors,
  testOrigin,
} = require('./helpers.cjs');

const shots = process.env.PH_SCREENSHOT_DIR;
const FRAMES = Number(process.env.PH_FRAMES || 0);
const STEP = Number(process.env.PH_FRAME_STEP || 0.25);
const VIEWPORT = { width: 390, height: 844 };
if (shots) fs.mkdirSync(shots, { recursive: true });
const frame = (page, name) =>
  page.screenshot({ path: path.join(shots, `${name}.png`), timeout: 60000 });

// Loads the demo town with the commons finished to `stage` in `choice`, bought, built and
// unveiled through the same rules a player's purchases follow.
async function openValley(browser, choice, stage) {
  const page = await browser.newPage({ viewport: VIEWPORT, locale: 'en-US' });
  page.setDefaultTimeout(180000);
  const errors = pageErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem('crystal-cascade-town-menu-introduced', 'true'),
  );
  await page.goto(`${testOrigin()}/play`);
  await page.waitForFunction(
    () => document.querySelector('.town-scene')?.__vueParentComponent.setupState.scene,
  );
  const profile = await page.evaluate(
    async ({ choice, stage }) => {
      const { createSaveFile } = await import('/src/services/saveTransfer.js');
      const rules = await import('/src/data/townLandmarks.js');
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const campaign = pinia._s.get('campaign');
      const profile = await (await fetch('/output/era-demo/twin-hollows-complete.json')).json();
      campaign.importSave(
        createSaveFile({
          ...campaign.profile(),
          ...profile,
          town: { ...profile.town, coins: 1e8 },
        }),
      );
      // Bought from the site's card, built by finished puzzles and unveiled, stage by stage.
      // The finished work is loaded as a save, as town-commission-signal.cjs does.
      const area = rules.AREA_BY_ID['homecoming-commons'];
      for (let level = 1; level <= stage; level++) {
        const offer = rules.landmarkOffer(campaign.town, area, choice);
        const command = { kind: 'area', id: area.id, slot: 0, value: choice };
        Object.assign(command, {
          expectedChoice: offer.expectedChoice,
          expectedLevel: offer.expectedLevel,
        });
        if (!campaign.personalise([command])) throw new Error(`could not buy ${choice} ${level}`);
        const built = JSON.parse(JSON.stringify(campaign.profile()));
        const work = built.town.personalisation.construction[area.id];
        work.wins = rules.landmarkLevel(work.level).puzzles;
        campaign.importSave(createSaveFile(built));
        if (!campaign.unveilMonument(area.id, level)) throw new Error(`could not unveil ${level}`);
      }
      const setup = document.querySelector('.town-scene').__vueParentComponent.setupState;
      // The valley redraws once its mesh catalogs load: wait for this town's life, not the
      // first town's.
      const drawn = () =>
        setup.scene.town?.era === campaign.town.era &&
        JSON.stringify(setup.scene.town.personalisation) ===
          JSON.stringify(campaign.town.personalisation);
      await setup.update();
      while (!drawn() || !setup.scene.lifeReady || setup.scene.cameraFrame)
        await new Promise((resolve) => setTimeout(resolve, 100));
      setup.scene.setMotion(false);
      window.scene = setup.scene;
      return campaign.profile();
    },
    { choice, stage },
  );
  // The finished town as a save, for the frame budget (PH_FRAME_TOWN_SAVE).
  if (shots) fs.writeFileSync(path.join(shots, `${choice}-save.json`), JSON.stringify(profile));
  return { page, errors };
}

// The residents' walks in the real town: every leg across the field is clear of every
// footprint, and each walk ends inside the site's court.
const checkValley = (page) =>
  page.evaluate(() => {
    const { scene } = window;
    const residents = scene.commissionResidents ?? [];
    const [sx, sz] = [66, -102];
    return residents.map(({ day }) => {
      const out = day.segments[0].route.points;
      let blocked = 0;
      for (let n = 1; n < out.length; n++) {
        const a = [out[n - 1][0], 0.07, out[n - 1][2]],
          b = [out[n][0], 0.07, out[n][2]];
        // The court itself is the site's own ground; its art is checked in unit tests.
        if (Math.hypot(b[0] - sx, b[2] - sz) < 8.4) break;
        if (!scene.navigation.segment(a, b, 0.25)) blocked++;
      }
      const end = out.at(-1);
      return {
        blocked,
        points: out.length,
        ends: Math.hypot(end[0] - sx, end[2] - sz),
        segments: day.segments.map((s) =>
          s.inside ? `in:${s.inside}` : s.stand ? 'stand' : 'walk',
        ),
        carry: day.segments.find((s) => s.carry)?.carry ?? null,
      };
    });
  });

// The time a resident is `into` seconds past the start of its stay at the site.
const stayTime = (page, into, kind) =>
  page.evaluate(
    ({ into, kind }) => {
      const resident = window.scene.commissionResidents[0];
      const index = resident.day.segments.findIndex((s, n) =>
        kind === 'stand' ? s.stand : kind === 'inside' ? s.inside && n === 1 : n === 1,
      );
      const segment = resident.day.segments[index];
      // Village time only runs forward: a whole number of the resident's days later.
      const time = segment.start + into - resident.offset;
      const days = Math.ceil((window.scene.elapsed + 1 - time) / resident.day.duration);
      return time + Math.max(0, days) * resident.day.duration;
    },
    { into, kind },
  );
async function show(page, time, view) {
  return page.evaluate(
    ({ time, view }) => {
      const { scene } = window;
      scene.elapsed = time;
      // Filming jumps the village clock without the frame loop's locomotion, which other
      // village life relies on; its failures are printed as notes. The commission
      // residents' own motions must run cleanly.
      const notes = [];
      const own = new Set(scene.commissionResidents.map(({ motion }) => motion));
      scene.actors.forEach((actor) => scene.animatePerson(actor, time));
      for (const motion of scene.motions)
        if (own.has(motion)) motion(time);
        else
          try {
            motion(time);
          } catch (error) {
            notes.push(error.message);
          }
      const [x, z] = [66, -102];
      scene.controls.target.set(x + view.dx, view.ty, z + view.dz);
      scene.camera.position.set(x + view.cx, view.cy, z + view.cz);
      scene.controls.update();
      scene.overview = false;
      scene.render();
      return {
        calls: scene.renderer.info.render.calls,
        visible: scene.commissionResidents.filter(({ actor }) => actor.root.visible).length,
        notes: [...new Set(notes)],
      };
    },
    { time, view },
  );
}
const notes = new Set();
const CLOSE = { dx: 0, ty: 1, dz: 4, cx: 6, cy: 11, cz: 21 };

async function runValley(browser, choice, kind, lead) {
  const { page, errors } = await openValley(browser, choice, 5);
  const walks = await checkValley(page);
  console.log(choice, JSON.stringify(walks));
  assert.ok(walks.length >= 3, `${choice}: residents come`);
  for (const walk of walks) {
    assert.equal(walk.blocked, 0, `${choice}: a field leg crosses a footprint`);
    assert.ok(walk.ends < 7, `${choice}: the walk ends in the court`);
  }
  if (shots) {
    const start = await stayTime(page, -lead, kind);
    for (let n = 0; n < Math.max(1, FRAMES); n++) {
      const data = await show(page, start + n * STEP, CLOSE);
      if (!n) console.log(choice, 'draw calls', data.calls, 'visible', data.visible);
      if (data.notes.length) notes.add(data.notes.join('; '));
      await frame(page, `${choice}-${String(n).padStart(3, '0')}`);
    }
  }
  assert.deepEqual(errors, [], `${choice}: page errors`);
  await page.close();
}

const moonFixture = fixturePage({
  style: 'body{margin:0;background:#10162b}canvas{display:block;width:100vw;height:100vh}',
  body: '<canvas></canvas>',
  script: `
import {MoonScene} from '/src/game/town/moon/MoonScene.js';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
import {AREA_BY_ID} from '/src/data/townLandmarks.js';
window.area=AREA_BY_ID['earthlight-conservatory'];
window.town={era:'twin-hollows',personalisation:{areas:{},areaLevels:{},construction:{}},buildings:{airport:3,spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map((id)=>[id,3]))},projects:{},coins:0};
window.moon=new MoonScene(document.querySelector('canvas'));
moon.update(town); moon.renderer.setAnimationLoop(null);moon.render();window.ready=true;
`,
});
async function runMoon(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = pageErrors(page);
  await openFixture(page, 'commission-residents-moon', moonFixture);
  await page.waitForFunction(() => window.ready);
  for (const choice of await page.evaluate(() => window.area.choices)) {
    // A settler carrying its outcome's item home, a few seconds out of the door.
    const found = await page.evaluate((choice) => {
      const { moon, town, area } = window;
      town.personalisation = {
        ...town.personalisation,
        areas: { [area.id]: [choice] },
        areaLevels: { [area.id]: 5 },
      };
      moon.update({ ...town });
      const settler = moon.settlers.find(({ item }) => item);
      if (!settler) return null;
      const back = settler.plan.segments.find((s) => s.carry);
      return { time: back.start + 2 - settler.plan.offset, carry: back.carry };
    }, choice);
    assert.ok(found, `${choice}: a settler brings something home`);
    if (shots)
      for (let n = 0; n < Math.max(1, FRAMES); n++) {
        const data = await page.evaluate(
          (time) => {
            const { moon, area } = window;
            const [x, z] = area.positions[0];
            moon.move(time);
            moon.camera.position.set(x + 6, 7, z + 13);
            moon.controls.target.set(x, 1.2, z + 3);
            moon.controls.update();
            moon.render();
            return {
              calls: moon.renderer.info.render.calls,
              carrying: moon.settlers.filter(({ item }) => item?.visible).length,
            };
          },
          found.time - 3 + n * 0.25,
        );
        if (!n)
          console.log(choice, found.carry, 'draw calls', data.calls, 'carrying', data.carrying);
        await frame(page, `${choice}-${String(n).padStart(3, '0')}`);
      }
  }
  assert.deepEqual(errors, [], 'Moon: page errors');
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: SOFTWARE_WEBGL });
  try {
    // [outcome, the moment to film around, seconds of lead-in]
    await runValley(browser, 'story-hall', 'walk', 9);
    await runValley(browser, 'bandstand', 'stand', 2);
    await runValley(browser, 'wild-meadow', 'walk', -4);
    await runMoon(browser);
    if (notes.size) console.log('other village life while filming:', [...notes]);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
