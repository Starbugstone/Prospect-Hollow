// Run against the Docker Vite server, with the same Playwright setup as moon-input.cjs.
const assert = require('node:assert/strict');
const { chromium, SOFTWARE_WEBGL, fixturePage, openFixture, pageErrors } = require('./helpers.cjs');
const fixture = fixturePage({
  stylesheets: ['/src/styles/town.css'],
  style: 'body{margin:24px;background:#fbf8ea}#fixture{max-width:540px;margin:auto}',
  body: '<div id="fixture"></div>',
  script: `
import {createApp,h} from '/node_modules/.vite/deps/vue.js';
import {createPinia} from '/node_modules/.vite/deps/pinia.js';
import Workshop from '/src/components/town/TownMoonstoneWorkshop.vue';
import Moon from '/src/components/town/TownMoonView.vue';
import {useCampaignStore} from '/src/stores/campaignStore.js';
import {MOON_LOTS} from '/src/data/moonSettlement.js';
const campaign=useCampaignStore(createPinia());
Object.assign(campaign.town,{era:'twin-hollows',coins:1000,moonstones:42,moonstonesEarned:57,completedRuns:100,moonstoneProduction:{progress:2,stored:12}});
Object.assign(campaign.town.buildings,{spaceElevator:3,...Object.fromEntries(Object.keys(MOON_LOTS).map(id=>[id,3]))});
campaign.save();
window.campaign=campaign;
window.app=createApp({render(){return h(Workshop,{town:campaign.town,sellMoonstones:campaign.sellMoonstones,cooldownSeconds:30})}});
app.mount('#fixture');
window.showMoon=()=>{app.unmount();document.querySelector('#fixture').style.cssText='position:relative;width:100vw;height:100vh;max-width:none';document.body.style.margin='0';window.app=createApp({render(){return h(Moon,{town:campaign.town,reducedMotion:true,active:false,onCollect:()=>campaign.collectMoonstones()})}});app.mount('#fixture')};
window.getScene=()=>app._instance.subTree.component.setupState.scene;
`,
});
(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
    page.setDefaultTimeout(60000);
    const errors = pageErrors(page, { consoleErrors: false, echo: true });
    await openFixture(page, 'moonstone-resource-test', fixture);
    const balance = () =>
      page.evaluate(() => ({
        coins: window.campaign.town.coins,
        stones: window.campaign.town.moonstones,
        earned: window.campaign.town.moonstonesEarned,
      }));
    assert.equal(
      await page.getByRole('button', { name: 'Collect 12 moonstones', exact: true }).isDisabled(),
      true,
    );
    await page.getByText('Stored 12 / 30', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sell all', exact: true }).click();
    await page.getByText('Sell all 42 moonstones for 10,500 coins?', { exact: true }).waitFor();
    assert.deepEqual(await balance(), { coins: 1000, stones: 42, earned: 57 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: /^Sell 10/ }).click();
    await page.getByText('Sold 10 moonstones for 2,500 coins.', { exact: true }).waitFor();
    assert.deepEqual(await balance(), { coins: 3500, stones: 32, earned: 57 });
    await page.getByRole('button', { name: 'Sell all', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm sale', exact: true }).click();
    assert.deepEqual(await balance(), { coins: 11500, stones: 0, earned: 57 });
    await page.evaluate(() => window.showMoon());
    await page.waitForFunction(() => !!window.getScene());
    await page.evaluate(() => {
      window.getScene().setMotion(false);
      window.getScene().render();
    });
    await page.getByRole('button', { name: /Moonstone workshop.*Collect 12 moonstones/ }).click();
    assert.deepEqual(await balance(), { coins: 11500, stones: 12, earned: 69 });
    assert.deepEqual(await page.evaluate(() => window.campaign.town.moonstoneProduction), {
      progress: 2,
      stored: 0,
    });
    assert.deepEqual(errors, []);
    console.log(
      'Moonstone browser checks passed: confirmation, cancel, quantity sale, all sale, lifetime balance and Moon collection.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
