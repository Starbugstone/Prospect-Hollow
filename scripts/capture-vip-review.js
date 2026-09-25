// Playwright CLI callback: start Vite, open a fresh browser session, then run
// playwright-cli run-code "$(cat scripts/capture-vip-review.js)"
// Uses isolated browser save data and production selection/models. Each scene
// contains one VIP. Packaging validates every required file before making a ZIP.
async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const eras = [
    'frontier',
    'river-rail',
    'industrial',
    'post-war',
    'motor-age',
    'aviation',
    'broadcast',
    'contemporary',
  ];

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/scripts/town-actor-review.html');
  await page.waitForFunction(() => !!window.vipComparison);
  for (const era of eras) {
    await page.setViewportSize({ width: 1440, height: 800 });
    for (const named of [false, true]) {
      await page.evaluate(({ era, named }) => window.vipEraReview(era, named), { era, named });
      await page.screenshot({
        path: `output/vip-review/${era}-outfits${named ? '-named' : ''}.png`,
      });
    }
    for (const gender of ['male', 'female'])
      for (let variant = 0; variant < 3; variant++)
        for (const named of [false, true]) {
          await page.evaluate(
            ({ era, gender, variant, named }) => window.vipComparison(era, gender, variant, named),
            { era, gender, variant, named },
          );
          await page.screenshot({
            path: `output/vip-review/${era}-${gender}-v${variant}-comparison${named ? '-named' : ''}.png`,
          });
        }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Village', exact: true }).click();
  const results = [];
  for (let index = 0; index < eras.length; index++) {
    const era = eras[index],
      source = [
        'stable',
        'railDepot',
        'riverPort',
        'railDepot',
        'riverPort',
        'airport',
        'airport',
        'airport',
      ][index];
    await page.evaluate((era) => window.prospectDebug.prepareEra(era), era);
    await page.waitForFunction((era) => {
      const d = document.querySelector('.town-scene')?.__vueParentComponent?.setupState?.scene;
      return d?.town.era === era;
    }, era);
    for (const gender of ['male', 'female'])
      for (let variant = 0; variant < 3; variant++) {
        const prefix = `${era}-${gender}-v${variant}`;
        const scenario = await page.evaluate(
          async ({ era, source, index, gender, variant }) => {
            const d = document.querySelector('.town-scene').__vueParentComponent.setupState.scene;
            d.renderer.setAnimationLoop(null);
            d.paused = false;
            d.motionEnabled = true;
            d.vipArrivals.reset();
            const { vipVisitor } = await import('/src/data/villagers.js');
            const { vipOutfit } = await import('/src/data/townWardrobes.js');
            const { eraEvolution } = await import('/src/data/eras.js');
            const profile = eraEvolution(era);
            const { VISITOR_TRANSPORTS } = await import('/src/data/visitorArrivals.js');
            const { trainJourney, boatJourney } = await import('/src/game/town/TownEraActivity.js');
            const { airplaneArrival } = await import('/src/game/town/TownAviation.js');
            let actor, start;
            const name = gender === 'male' ? 'Scott' : 'Evi';
            if (source === 'stable') {
              actor = d.actors.find((a) => a.visitor);
              const visit = Array.from({ length: 5000 }, (_, i) => i).find(
                (i) =>
                  vipVisitor(actor.seed, i)?.name === name &&
                  vipOutfit(profile, actor.seed + i * 997).variant === variant,
              );
              start = visit * (actor.duration + 7) - actor.seed;
            } else {
              const journey = {
                railDepot: trainJourney,
                riverPort: boatJourney,
                airport: airplaneArrival,
              }[source];
              start = Array.from({ length: 1600 }, (_, i) => i / 4).find(
                (t) => journey(t).arrived && journey(t).sinceArrival < 0.3,
              );
              const visit = journey(start).visit;
              d.vipArrivals.seed = Array.from({ length: 5000 }, (_, i) => i).find(
                (i) =>
                  vipVisitor(i + VISITOR_TRANSPORTS.indexOf(source) * 101, visit)?.name === name &&
                  vipOutfit(profile, i + visit * 997).variant === variant,
              );
              d.elapsed = start;
              d.motions.forEach((m) => m(start));
              for (const [id, transport] of d.visitorTransports)
                d.vipArrivals.seen.set(id, transport.visit);
              d.vipArrivals.seen.delete(source);
              d.vipArrivals.update();
              actor = d.vipArrivals.active.actor;
            }
            actor.lastPosition = null;
            actor.distance = 0;
            window.vipVisual = { d, actor, start, source };
            window.vipCaptureFrame = (age, mode) => {
              d.elapsed = start + age;
              d.actors.forEach((a) => d.animatePerson(a, d.elapsed));
              d.motions.forEach((m) => m(d.elapsed));
              d.vipArrivals.update();
              for (const a of d.actors) if (a.visitor && a !== actor) a.root.visible = false;
              d.namedVillager = null;
              const focus = actor.root.position.clone();
              if (source === 'airport' && mode === 'arrival')
                focus.lerp(d.visitorTransports.get(source).root.position, 0.35);
              focus.y += 0.8;
              d.controls.target.copy(focus);
              const dir =
                  source === 'airport'
                    ? mode === 'arrival'
                      ? [0.85, 1.1, 0.85]
                      : [0.85, 1.1, -0.3]
                    : [0.35, 0.6, 0.8],
                distance = mode === 'arrival' ? (source === 'airport' ? 28 : 24) : 11.5;
              const length = Math.hypot(...dir);
              d.camera.position.set(
                focus.x + (dir[0] / length) * distance,
                focus.y + (dir[1] / length) * distance,
                focus.z + (dir[2] / length) * distance,
              );
              d.overview = false;
              d.controls.update();
              d.render();
              const rect = d.canvas.getBoundingClientRect(),
                p = actor.root.position.clone();
              p.y += 1;
              p.project(d.camera);
              return {
                x: rect.left + ((p.x + 1) * rect.width) / 2,
                y: rect.top + ((1 - p.y) * rect.height) / 2,
              };
            };
            window.vipCaptureFrame(2, 'arrival');
            return {
              era,
              gender,
              variant,
              source,
              guest: actor.root.userData.villager,
              duration: actor.duration,
              outfit: actor.root.userData.outfit.variant,
            };
          },
          { era, source, index, gender, variant },
        );
        if (scenario.outfit !== variant || scenario.guest.gender !== gender)
          throw new Error(JSON.stringify(scenario));
        results.push(scenario);
        const stage = page.locator('.town-scene');
        await page.mouse.move(5, 5);
        await stage.screenshot({ path: `output/vip-review/${prefix}-arrival-named.png` });
        if (source !== 'stable') await page.evaluate(() => window.vipCaptureFrame(0.8, 'arrival'));
        if (source !== 'stable')
          await page
            .locator('.town-event-inset')
            .screenshot({ path: `output/vip-review/${prefix}-inset-named.png` });
        const hidden = await page.addStyleTag({
          content: '.vip-inset-name,.villager-name {visibility:hidden !important}',
        });
        if (source !== 'stable')
          await page
            .locator('.town-event-inset')
            .screenshot({ path: `output/vip-review/${prefix}-inset.png` });
        await page.evaluate(() => window.vipCaptureFrame(2, 'arrival'));
        await stage.screenshot({ path: `output/vip-review/${prefix}-arrival.png` });
        await hidden.evaluate((el) => el.remove());
        if (source === 'stable') {
          const point = await page.evaluate(() => window.vipCaptureFrame(2, 'arrival'));
          await page.mouse.move(point.x, point.y);
          await page.locator('.villager-name').waitFor();
          await stage.screenshot({ path: `output/vip-review/${prefix}-arrival-named.png` });
        }
        for (const [mode, age] of [
          ['wandering', scenario.duration * 0.28],
          ['leaving', scenario.duration - 4],
        ]) {
          const point = await page.evaluate(({ age, mode }) => window.vipCaptureFrame(age, mode), {
            age,
            mode,
          });
          await page.mouse.move(5, 5);
          await stage.screenshot({ path: `output/vip-review/${prefix}-${mode}.png` });
          await page.mouse.move(point.x, point.y);
          await page.locator('.villager-name').waitFor();
          await stage.screenshot({ path: `output/vip-review/${prefix}-${mode}-named.png` });
        }
      }
  }
  return { results, errors };
};
