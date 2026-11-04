const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, SOFTWARE_WEBGL, preparePage, pageErrors, testOrigin } = require('./helpers.cjs');

// Use the Docker Vite/Playwright setup documented in docs/development-workflow.md.
// Synthetic local save and committed-move stimulus; no real account or economy edits.
const OUTPUT = 'output/playwright/continuous-navigation';
(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_WEBGL });
  try {
    fs.mkdirSync(OUTPUT, { recursive: true });
    const context = await browser.newContext({
      locale: 'en-US',
      viewport: { width: 360, height: 800 },
      reducedMotion: 'reduce',
    });
    context.setDefaultTimeout(60000);
    await context.addInitScript(preparePage);
    const page = await context.newPage();
    const errors = pageErrors(page);
    await page.goto(testOrigin() + '/play');
    await page.waitForFunction(() => !!window.stores()?.get('campaign'));
    await page.evaluate(async () => {
      const campaign = window.stores().get('campaign');
      const { createSaveFile } = await import('/src/services/saveTransfer.js');
      const profile = JSON.parse(JSON.stringify(campaign.profile()));
      profile.records = {
        1: { score: 100, stars: 1 },
        2: { score: 200, stars: 2 },
        3: { score: 300, stars: 3 },
      };
      profile.town.buildings.museum = 1;
      profile.town.buildings.moonstoneWorkshop = 1;
      profile.continuousRecords = { 1: { coins: 25, moonstoneGems: 900, score: 100 } };
      campaign.importSave(createSaveFile(profile));
      campaign.finishTownTour();
    });
    await page.locator('.town-tab-more').click();
    await page
      .getByRole('dialog', { name: 'More', exact: true })
      .getByRole('button', { name: 'Museum Replay levels' })
      .click();
    const museum = page.locator('dialog[open].town-museum');
    await museum.getByRole('button', { name: '∞ Continuous play', exact: true }).click();
    await museum.getByRole('button', { name: /^Unfinished/ }).click();
    assert.equal(await museum.locator('.museum-level').count(), 3);
    assert.equal(
      await museum.getByRole('button', { name: /^Continuous play, level 1:/ }).count(),
      0,
    );
    await page.screenshot({ path: `${OUTPUT}/museum-unfinished.png` });
    await museum.getByRole('button', { name: 'Next unfinished level', exact: true }).click();
    const settled = () =>
      page.waitForFunction(() => {
        const game = window.stores().get('game');
        return game.sessionActive && game.renderer && !game.animationInProgress;
      });
    await settled();
    const guide = page.locator('dialog[open].obstacle-guide');
    if (await guide.count()) await guide.locator('.icon-button').click();
    assert.equal(await page.evaluate(() => window.stores().get('game').currentLevelId), 2);
    const banner = page.locator('.continuous-banner');
    assert.match(await banner.innerText(), /0\/900 workshop gems/);
    await page.evaluate(() => {
      const game = window.stores().get('game');
      // Same post-commit counters that syncContinuous reads after a completed move.
      game.collectedJewels = 291;
      game.score = 777;
      game.syncContinuous();
    });
    await banner.getByText('291/900 workshop gems for this level', { exact: true }).waitFor();
    await banner.getByText('25/25 coins saved for this level', { exact: true }).waitFor();
    const measurements = [];
    for (const language of ['en', 'fr']) {
      await page.evaluate(async (language) => {
        const { loadFrench, setLocale } = await import('/src/i18n/index.js');
        await loadFrench();
        setLocale(language);
      }, language);
      for (const size of [
        { width: 360, height: 800 },
        { width: 320, height: 568 },
        { width: 844, height: 390 },
        { width: 1280, height: 900 },
      ]) {
        await page.setViewportSize(size);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const geometry = await banner.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return {
            width: innerWidth,
            banner: { x: box.x, right: box.right, bottom: box.bottom },
            overflow: element.scrollWidth > element.clientWidth,
            controls: [...element.querySelectorAll('button, [role="status"]')].map((control) => {
              const rect = control.getBoundingClientRect();
              return {
                text: control.textContent.trim(),
                x: rect.x,
                right: rect.right,
                y: rect.y,
                bottom: rect.bottom,
                height: rect.height,
              };
            }),
            boardTop: document.querySelector('.board-canvas').getBoundingClientRect().top,
          };
        });
        assert(!geometry.overflow, `Banner overflows at ${language} ${size.width}`);
        for (const control of geometry.controls) {
          assert(control.height > 0, 'Banner control hidden');
          assert(control.x >= 0 && control.right <= size.width, 'Banner control outside viewport');
          assert(
            control.y >= 0 && control.bottom <= size.height,
            'Banner control clipped vertically',
          );
        }
        if (size.width <= 640)
          assert(geometry.banner.bottom <= geometry.boardTop, 'Banner overlaps board');
        measurements.push({ language, size, geometry });
        await page.screenshot({ path: `${OUTPUT}/banner-${language}-${size.width}.png` });
      }
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(async () => (await import('/src/i18n/index.js')).setLocale('en'));
    const oldRun = await page.evaluate(() => {
      const campaign = window.stores().get('campaign');
      const game = window.stores().get('game');
      window.continuousEvents = [];
      campaign.$onAction(({ name }) => {
        if (['endRun', 'recordContinuous', 'beginRun'].includes(name))
          window.continuousEvents.push({ name, activeRun: campaign.activeRun });
      });
      game.animationInProgress = true;
      return game.runId;
    });
    const next = banner.getByRole('button', { name: 'Next level', exact: true });
    assert(await next.isDisabled(), 'Next must be disabled during a move');
    assert(await banner.getByRole('button', { name: 'Exit mine', exact: true }).isDisabled());
    await page.evaluate(() => (window.stores().get('game').animationInProgress = false));
    await next.click();
    await settled();
    const result = await page.evaluate(() => {
      const campaign = window.stores().get('campaign');
      const game = window.stores().get('game');
      return {
        id: game.currentLevelId,
        run: game.runId,
        record: campaign.continuousRecords[2],
        events: window.continuousEvents,
      };
    });
    assert.equal(result.id, 3);
    assert.equal(result.run, oldRun + 1);
    assert.deepEqual(
      result.events.map(({ name }) => name),
      ['endRun', 'recordContinuous', 'beginRun'],
    );
    assert.equal(result.events[2].activeRun, null);
    assert.equal(result.record.moonstoneGems, 291);
    assert.equal(result.record.score, 777);
    await banner.getByRole('button', { name: 'Exit mine', exact: true }).click();
    await page.reload();
    await page.waitForFunction(() => !!window.stores()?.get('campaign'));
    const saved = await page.evaluate(() => window.stores().get('campaign').continuousRecords[2]);
    assert.deepEqual(saved, result.record, 'Credited counters survive reload after switching');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${OUTPUT}/result.json`,
      JSON.stringify({ result, saved, measurements, errors }, null, 2),
    );
    console.log(
      'PASS: museum unfinished filter → level 2 → live 25/25 and 291/900 → animation guard → one settled next run on level 3 → exit/reload; EN/FR layout at 320/360/844/1280 px.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
