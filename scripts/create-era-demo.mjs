// Developer fixtures only. Never imported by the game or served from public/.
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const { BUILDINGS, BANDIT_EVENT, createTown } = await server.ssrLoadModule('/src/data/town.js');
  const { ERAS } = await server.ssrLoadModule('/src/data/eras.js');
  const { CHAPTERS } = await server.ssrLoadModule('/src/data/campaign.js');
  const { advanceEra } = await server.ssrLoadModule('/src/game/town/TownEras.js');
  const { buildWithHammer, upgradeOffer, banditEncounter } = await server.ssrLoadModule(
    '/src/game/town/TownRules.js',
  );
  const { SAVE_KEY } = await server.ssrLoadModule('/src/services/localProfile.js');
  const town = createTown();
  const completed = (CHAPTERS.findIndex((chapter) => chapter.id === 'river-discovery') + 1) * 6;
  Object.assign(town, {
    coins: 30000,
    completedRuns: completed,
    tourSeen: true,
    constructionTipSeen: true,
  });
  for (const building of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
    town.buildings[building.id] = building.upgrades.length;
  town.forge.charge = 1;
  town.events[BANDIT_EVENT] = {
    id: 1,
    atRun: completed,
    gangSize: 10,
    sheriffLevel: 5,
    bankLevel: 5,
    outcome: 'protected',
    loss: 0,
    seen: true,
    targets: ['mine'],
  };
  const records = Object.fromEntries(
    Array.from({ length: completed }, (_, i) => [i + 1, { score: 100, stars: 1 }]),
  );
  const riverRail = advanceEra(town, 'frontier');
  let complete = {
    ...riverRail,
    transition: { ...riverRail.transition, pending: false },
    eraTransitionSeen: { 'river-rail': true },
  };
  function finishEra(state) {
    for (const b of BUILDINGS.filter((b) => b.introducedEra === state.era)) {
      let offer;
      while ((offer = upgradeOffer(state, b.id))) state = buildWithHammer(state, b.id, offer.stage);
    }
    for (const b of BUILDINGS.filter(
      (b) => b.introducedEra !== state.era && state.buildings[b.id],
    )) {
      let offer;
      while ((offer = upgradeOffer(state, b.id))) state = buildWithHammer(state, b.id, offer.stage);
    }
    return state;
  }
  complete = finishEra(complete);
  complete.coins = 250000;
  const industrial = advanceEra(complete, 'river-rail');
  const industrialOpen = {
    ...industrial,
    transition: { ...industrial.transition, pending: false },
    eraTransitionSeen: { 'river-rail': true, industrial: true },
    nextRaidRun: 999,
  };
  const lights = buildWithHammer(industrialOpen, 'powerHouse', 0);
  const industrialComplete = { ...finishEra(industrialOpen), firstLightsSeen: true };
  const later = {};
  let previous = industrialComplete;
  for (const era of ERAS.slice(3)) {
    previous.coins = 10000000;
    const opening = advanceEra(previous, previous.era);
    const open = {
      ...opening,
      transition: { ...opening.transition, pending: false },
      eraTransitionSeen: { ...opening.eraTransitionSeen, [era.id]: true },
    };
    previous = finishEra(open);
    later[era.id] = opening;
    later[`${era.id}-open`] = open;
    later[`${era.id}-complete`] = previous;
  }
  const cargo = banditEncounter({ ...complete, nextRaidRun: complete.completedRuns }, () => 0);
  const fire = banditEncounter(
    { ...lights, firstLightsSeen: true, nextRaidRun: lights.completedRuns },
    () => 0,
  );
  const directory = 'output/era-demo';
  await mkdir(directory, { recursive: true });
  for (const [name, state] of Object.entries({
    'frontier-ready': town,
    'river-rail': riverRail,
    'river-rail-complete': complete,
    industrial: industrial,
    'industrial-lights': lights,
    'industrial-complete': industrialComplete,
    ...later,
    'storm-cleanup': banditEncounter({ ...previous, nextRaidRun: previous.completedRuns }, () => 0),
    'cargo-theft': cargo,
    'workshop-fire': fire,
  })) {
    const profile = JSON.stringify({
      schemaVersion: 2,
      town: state,
      records: ['post-war', 'motor-age', 'aviation', 'broadcast', 'contemporary'].includes(
        state.era,
      )
        ? Object.fromEntries(
            Array.from({ length: 120 }, (_, i) => [i + 1, { score: 100, stars: 1 }]),
          )
        : state.era === 'industrial'
          ? {
              ...records,
              ...Object.fromEntries(
                Array.from({ length: 6 }, (_, i) => [67 + i, { score: 100, stars: 1 }]),
              ),
            }
          : records,
      issuedRun: completed,
      settledRun: completed,
    });
    await writeFile(`${directory}/${name}.json`, `${profile}\n`);
    await writeFile(
      `${directory}/${name}.console.js`,
      `// Replaces progress on this origin. Use a disposable browser profile.\nlocalStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(profile)});\nlocation.reload();\n`,
    );
  }
  console.log(
    `Created all eight-era disposable profiles in ${directory}/. See docs/settlement-eras.md for testing steps.`,
  );
} finally {
  await server.close();
}
