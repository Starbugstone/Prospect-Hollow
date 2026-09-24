// Playwright callback for a fresh, isolated browser page against local Vite.
// Checks rendered geometry: tips, celebrations and targeting must never move the
// board, cover gems, or change the document's scroll position.
async (page) => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Mine', exact: true }).click();
  await page.waitForFunction(() => {
    const game = document
      .querySelector('#app')
      ?.__vue_app__?.config.globalProperties.$pinia._s.get('game');
    return game?.renderer && !game.animationInProgress;
  });
  const settle = () =>
    page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const game = document
        .querySelector('#app')
        .__vue_app__.config.globalProperties.$pinia._s.get('game');
      await new Promise((resolve) => game.renderer.game.events.once('postrender', resolve));
    });
  const geometry = () =>
    page.evaluate(() => {
      const rect = (selector) => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        board: rect('.board-canvas'),
        tools: rect('.board-tools'),
        scroll: scrollY,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
  const unchanged = async (baseline, description) => {
    await settle();
    const current = await geometry();
    assert(
      JSON.stringify(current) === JSON.stringify(baseline),
      `${description}: layout moved\n${JSON.stringify({ baseline, current })}`,
    );
  };
  const report = [];
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ];
  for (const language of ['en', 'fr']) {
    for (const mode of ['normal', 'continuous']) {
      for (const size of sizes) {
        await page.setViewportSize(size);
        await page.evaluate(
          async ({ language, mode }) => {
            const { setLocale } = await import('/src/i18n/index.js');
            setLocale(language);
            const stores =
              document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s;
            const campaign = stores.get('campaign'),
              game = stores.get('game');
            game.playMode = mode;
            game.arcadeBanner = null;
            game.activeBonusMode = null;
            campaign.seenTips = ['ice', 'bonus', 'fusion', 'powers'];
            campaign.seenObstacles = ['ice'];
            campaign.powers.find((power) => power.id === 'tnt').quantity = 1;
            game.board[0].type = 'bomb';
            game.board[1].type = 'ruby';
            game.refreshBoardVisuals();
          },
          { language, mode },
        );
        await settle();
        const baseline = await geometry();
        assert(baseline.board.y + baseline.board.height <= size.height, 'Board clipped');
        await page.evaluate(() => {
          document
            .querySelector('#app')
            .__vue_app__.config.globalProperties.$pinia._s.get('campaign').seenTips = [];
        });
        await page.locator('.guidance-tip').waitFor({ state: 'visible' });
        await unchanged(baseline, 'Showing a tip');
        if (mode === 'normal' && language === 'fr' && size.width === 390)
          await page.screenshot({ path: 'output/mine-feedback/fr-390-tip.png' });
        await page.locator('.guidance-tip button').click();
        await unchanged(baseline, 'Dismissing a tip');
        for (const kind of ['cascade', 'multi-match', 'fusion']) {
          await page.evaluate((kind) => {
            const stores =
              document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s;
            stores.get('campaign').seenTips = [];
            stores.get('game').arcadeBanner = {
              id: kind,
              kind,
              label:
                kind === 'fusion' ? 'PRISM BOMB!' : kind === 'multi-match' ? 'DOUBLE! ×2' : 'COOL!',
              count: 2,
              coins: 6,
              types: ['bomb', 'rainbow'],
              detail: 'COLOR BOMB NETWORK',
              color: '#dba1ff',
            };
          }, kind);
          await unchanged(baseline, `Showing ${kind}`);
          const banner = await page.locator('.arcade-banner-art').boundingBox();
          const board = baseline.board;
          assert(
            banner &&
              (banner.y + banner.height <= board.y ||
                banner.x + banner.width <= board.x ||
                banner.x >= board.x + board.width),
            `${kind} overlaps the board`,
          );
          assert(
            (await page.locator('.guidance-tip:visible').count()) === 0,
            'A celebration must not cover a visible hint',
          );
          if (mode === 'normal' && kind === 'multi-match') {
            await page
              .locator('.arcade-banner-art')
              .evaluate((element) =>
                Promise.all(
                  element.getAnimations({ subtree: true }).map((animation) => animation.finished),
                ),
              );
            await page.screenshot({ path: `output/mine-feedback/${language}-${size.width}.png` });
          }
          await page.evaluate(
            () =>
              (document
                .querySelector('#app')
                .__vue_app__.config.globalProperties.$pinia._s.get('game').arcadeBanner = null),
          );
          await unchanged(baseline, `Clearing ${kind}`);
          assert(
            (await page.locator('.guidance-tip:visible').count()) === 1,
            'Hint should return after the alert',
          );
        }
        await page.locator('[data-power-id="tnt"]').click();
        await page.locator('.mine-feedback .board-caption').waitFor({ state: 'visible' });
        await unchanged(baseline, 'Targeting a power');
        await page.locator('.mine-feedback .board-caption button').click();
        await unchanged(baseline, 'Cancelling a power');
        report.push({ language, mode, size, board: baseline.board });
      }
    }
  }
  assert(errors.length === 0, errors.join('\n'));
  return { scenarios: report.length, report, errors };
};
