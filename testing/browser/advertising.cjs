// Run against a development server with VITE_ADS_ENABLED=true VITE_AD_PROVIDER=mock.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const stableShuffleDuringMove = async (page, shuffle) => {
  await page.waitForFunction(() => {
    const game = window.testStores.get('game');
    return game.renderer && !game.animationInProgress && !game.inputPaused;
  });
  const result = await shuffle.evaluate(async (button) => {
    const game = window.testStores.get('game');
    const board = document.querySelector('.board-canvas');
    const section = button.closest('.powerup-section');
    const bounds = (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    // Allow the renderer's ResizeObserver to settle after changing the viewport.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const before = { board: bounds(board), section: bounds(section) };
    const frames = [];
    let finished = false;
    const sample = () => {
      frames.push({
        board: bounds(board),
        section: bounds(section),
        connected: button.isConnected,
        animating: game.animationInProgress,
        disabled: button.disabled,
      });
      if (!finished) requestAnimationFrame(sample);
    };
    game.computeHintMove();
    const [a, b] = game.hintMove.indices;
    requestAnimationFrame(sample);
    const moved = await game.resolveSwap(a, b);
    await new Promise(requestAnimationFrame);
    finished = true;
    return { before, frames, moved, disabledAfter: button.disabled };
  });
  assert.equal(result.moved, true, 'the regression must exercise a real matching move');
  assert.ok(
    result.frames.some((frame) => frame.animating),
    'must observe the animation',
  );
  for (const frame of result.frames) {
    assert.equal(frame.connected, true, 'ad shuffle disappeared during a move');
    for (const element of ['board', 'section']) {
      for (const dimension of ['x', 'y', 'width', 'height']) {
        assert.ok(
          Math.abs(frame[element][dimension] - result.before[element][dimension]) < 0.5,
          `${element} ${dimension} changed during a move`,
        );
      }
    }
    if (frame.animating) assert.equal(frame.disabled, true, 'shuffle must wait for the cascade');
  }
  assert.equal(result.disabledAfter, false, 'shuffle must be usable again after the move');
};
const rewardedFlow = async (page) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { value: ['en-US'], configurable: true });
    window.dispatchEvent(new Event('languagechange'));
  });
  if (!(await page.getByRole('button', { name: 'Accept all', exact: true }).count())) {
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click();
    await page.getByRole('button', { name: 'Privacy choices', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Mine', exact: true }).click();
  const shuffle = page.getByRole('button', { name: 'Watch ad · Shuffle', exact: true });
  await shuffle.waitFor();
  await page.evaluate(() => {
    const provides = document.querySelector('#app').__vue_app__._context.provides;
    window.testStores = Object.getOwnPropertySymbols(provides)
      .map((k) => provides[k])
      .find((v) => v?._s?.get)._s;
  });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 650 },
  ]) {
    await page.setViewportSize(viewport);
    await stableShuffleDuringMove(page, shuffle);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    window.adBoardBefore = JSON.stringify(window.testStores.get('game').board);
  });
  await shuffle.click();
  await page.getByRole('dialog', { name: 'Advertising preview' }).waitFor();
  const paused = await page.evaluate(() => ({
    paused: testStores.get('game').inputPaused,
    clock: testStores.get('game').elapsedMs,
    volumes: [testStores.get('settings').musicVolume, testStores.get('settings').sfxVolume],
  }));
  if (!paused.paused) throw new Error('ad did not pause input');
  await page.screenshot({ path: 'output/playwright/mock-ad-desktop.png' });
  await page.getByRole('button', { name: 'Close without reward', exact: true }).click();
  await shuffle.waitFor();
  const afterDismiss = await page.evaluate(() => ({
    same: adBoardBefore === JSON.stringify(testStores.get('game').board),
    paused: testStores.get('game').inputPaused,
  }));
  if (!afterDismiss.same || afterDismiss.paused)
    throw new Error('dismissal changed board or did not resume');
  await shuffle.click();
  await page.getByRole('button', { name: 'Complete test ad', exact: true }).click();
  await page.waitForFunction(
    () => !testStores.get('game').animationInProgress && !testStores.get('game').inputPaused,
  );
  if (await shuffle.count()) throw new Error('shuffle offered twice');
  const completed = await page.evaluate(() => {
    const game = testStores.get('game'),
      campaign = testStores.get('campaign');
    testStores.get('settings').setReducedMotion(true);
    game.remainingLayers = 0;
    game.completeLevel();
    return {
      run: game.runId,
      receipt: campaign.advertising.lastShuffleRun,
      quantity: campaign.powers.find((p) => p.id === 'shuffle').quantity,
    };
  });
  if (completed.run !== completed.receipt || completed.quantity !== 0)
    throw new Error('invalid shuffle receipt/inventory');
  await page.getByRole('button', { name: 'Skip to results' }).click();
  const bonus = page.getByRole('button', { name: 'Watch ad · Bonus chest', exact: true });
  await bonus.waitFor();
  await bonus.click();
  await page.getByText('Test other outcomes', { exact: true }).click();
  await page.getByRole('button', { name: 'No ad available', exact: true }).click();
  await bonus.waitFor();
  await bonus.click();
  await page.getByRole('button', { name: 'Complete test ad', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to results' }).click();
  if (await bonus.count()) throw new Error('bonus chest offered twice');
  const result = await page.evaluate(() => ({
    advertising: testStores.get('campaign').advertising,
    pending: testStores.get('campaign').pendingChests,
    external: performance
      .getEntriesByType('resource')
      .map((x) => x.name)
      .filter((u) => !u.startsWith(location.origin)),
  }));
  if (
    result.pending.length ||
    result.advertising.lastChestRun !== completed.run ||
    result.external.length
  )
    throw new Error(JSON.stringify(result));
  await page.screenshot({ path: 'output/playwright/ad-results-desktop.png' });
  return { paused, afterDismiss, completed, result };
};
const chapterFlow = async (page) => {
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).last().waitFor();
  await page.evaluate(() => {
    const provides = document.querySelector('#app').__vue_app__._context.provides;
    window.testStores = Object.getOwnPropertySymbols(provides)
      .map((k) => provides[k])
      .find((v) => v?._s?.get)._s;
    const game = testStores.get('game'),
      campaign = testStores.get('campaign');
    game.exitLevel();
    for (let id = 1; id < 6; id++) campaign.records[id] = { score: 0, stars: 1 };
    campaign.seenObstacles = [
      'ice',
      'crate',
      'rock',
      'chain',
      'reinforced',
      'seal',
      'stone',
      'fog',
      'gem-lock',
      'color-lock',
    ];
    campaign.save();
    game.startLevel(6);
    game.remainingLayers = 0;
    game.completeLevel();
  });
  await page.getByRole('button', { name: 'Skip to results' }).click();
  await page.getByRole('button', { name: 'Continue mining', exact: true }).click();
  await page.getByRole('dialog', { name: 'Advertising preview' }).waitFor();
  const pending = await page.evaluate(() => ({
    id: testStores.get('game').currentLevelId,
    cleared: testStores.get('game').levelCleared,
    receipt: testStores.get('campaign').advertising.pendingChapterAd,
  }));
  if (pending.id !== 6 || !pending.cleared || pending.receipt !== null)
    throw new Error(JSON.stringify(pending));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/mock-ad-mobile.png' });
  await page.getByText('Test other outcomes', { exact: true }).click();
  await page.getByRole('button', { name: 'No ad available', exact: true }).click();
  await page.waitForFunction(() => testStores.get('game').currentLevelId === 7);
  return {
    pending,
    next: await page.evaluate(() => ({
      id: testStores.get('game').currentLevelId,
      run: testStores.get('game').runId,
      receipt: testStores.get('campaign').advertising.pendingChapterAd,
      external: performance
        .getEntriesByType('resource')
        .map((x) => x.name)
        .filter((u) => !u.startsWith(location.origin)),
    })),
  };
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const origin = process.env.PH_TEST_ORIGIN || 'http://127.0.0.1:5174';
  fs.mkdirSync('output/playwright', { recursive: true });
  try {
    const context = await browser.newContext({
      locale: 'en-US',
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [],
      external = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(origin).origin) external.push(request.url());
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Reject all', exact: true }).click();
    assert.deepEqual(external, []);
    await rewardedFlow(page);
    await chapterFlow(page);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    await context.close();
    const mobile = await browser.newContext({
      locale: 'fr-FR',
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const phone = await mobile.newPage();
    await phone.goto(origin);
    await phone.getByRole('button', { name: 'Tout refuser', exact: true }).waitFor();
    assert.equal(
      await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await phone.screenshot({ path: 'output/playwright/privacy-mobile-fr.png' });
    await phone.getByRole('button', { name: 'Gérer mes choix', exact: true }).click();
    await phone.getByRole('checkbox', { name: 'Publicité facultative', exact: true }).uncheck();
    await phone.getByRole('button', { name: 'Enregistrer mes choix', exact: true }).click();
    await phone.reload();
    await phone.getByRole('button', { name: 'Réglages', exact: true }).last().waitFor();
    assert.equal(await phone.getByRole('button', { name: 'Tout refuser', exact: true }).count(), 0);
    await mobile.close();
    console.log(
      'Advertising browser checks passed: stable board and shuffle during desktop/mobile moves, consent, rejection, shuffle, chest, chapter/no-fill, mobile French, no external requests.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
