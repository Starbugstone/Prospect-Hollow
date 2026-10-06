import { population } from './TownRules';
import { TownItineraries } from './TownItineraries';
import { addWorkBreak } from './TownWorkRoutine';
import { TownVipArrivals } from './TownVipArrivals';
import { addAviationActivity } from './TownAviation';
import { addTownLife } from './TownLife';
import { addLeisureActivity } from './TownLeisure';
import { addEraActivity, trackTransport } from './TownEraActivity';
import { addTownVisitors } from './TownActivity';
import { addMotorActivity } from './TownMotorActivity';
import { motorTraffic } from './TownEvolution';
import { LANE_X, atPlot, SHERIFF_PATROL } from './TownLayout';

// The village's everyday life, prepared in resumable steps after the town is drawn:
// era and motor activity, visitors, leisure, aviation, then the resident walkers.
export function* populateLife(d, town) {
  d.itineraries = new TownItineraries(d);
  d.transports = new Map();
  const household = population(town);
  addEraActivity(d, town);
  yield;
  addMotorActivity(d, town);
  yield;
  addTownVisitors(d, town);
  yield;
  addTownLife(d, town);
  yield;
  addLeisureActivity(d, town);
  yield;
  trackTransport(d, 'airport', town, addAviationActivity(d, town));
  yield;
  d.person({
    color: '#738a83',
    skin: '#d5ad88',
    hat: '#b38d59',
    route: [
      [-LANE_X, -8.5],
      [-LANE_X, -0.5],
      [-LANE_X, 7.5],
      [-LANE_X, 15.5],
    ],
    seed: 1,
  });
  if (household) {
    d.person({
      color: '#aa6959',
      skin: '#d7b291',
      hat: '#846642',
      route: [
        [-7, -0.5],
        [-LANE_X, -0.5],
        [LANE_X, -0.5],
        [7, -0.5],
      ],
      seed: 4,
    });
    d.person({
      color: '#d2a56a',
      skin: '#8d6045',
      hat: '#d7bf8b',
      route: [
        [LANE_X, 15.5],
        [LANE_X, 7.5],
        [LANE_X, -0.5],
        [LANE_X, -8.5],
      ],
      seed: 9,
      dress: true,
    });
  }
  if (household > 2)
    d.person({
      color: '#879460',
      skin: '#b07c59',
      hat: '#ae814d',
      route: [
        [-15, 7.5],
        [-11, 7.5],
        [-11, -0.5],
        [-7, -0.5],
      ],
      seed: 13,
    });
  if (town.buildings.farm) {
    const farmer = d.person({
      color: '#809267',
      skin: '#af7b56',
      hat: '#d7b671',
      route: [atPlot('farm', 1.35, 2.1), atPlot('farm', 1.15, 1.6)],
      seed: 2,
      work: 'farm',
    });
    farmer.root.name = 'Farmer tending crops';
    addWorkBreak(d, farmer, 'farm', { work: 18, rest: 4 });
  }
  if (town.buildings.saloon) {
    const host = d.person({
      color: '#a47d91',
      skin: '#edc7a4',
      hat: '#b89869',
      route: [atPlot('saloon', 0.65, 1.7), atPlot('saloon', 0.95, 1.5)],
      seed: 6,
      work: 'greet',
      dress: true,
    });
    host.root.name = 'Saloon host';
    addWorkBreak(d, host, 'saloon', { work: 14, rest: 4 });
  }
  if (town.buildings.sheriff)
    d.person({
      color: '#315d83',
      skin: '#c99d74',
      hat: '#f0d390',
      route: SHERIFF_PATROL,
      seed: 0,
      sheriff: true,
      loop: true,
    });
  if (town.buildings.stable && !motorTraffic(town)) {
    d.horse(...atPlot('stable', 2.25, 0.9), 0.5);
    d.horse(...atPlot('stable', 2.65, -0.9), -0.9, 0.85);
  }
  d.vipArrivals ??= new TownVipArrivals(d);
  d.vipArrivals.attach(town);
  for (const actor of [...d.actors, ...d.vipArrivals.actors]) yield* d.itineraries.prepare(actor);

  d.actors.forEach((actor) => {
    if (!actor.motion) d.animatePerson(actor, d.elapsed);
  });
  d.motions.forEach((motion) => motion(d.elapsed));
  d.vipArrivals.update();
  for (const actor of d.retainedActors?.values() ?? []) d.clearGroup(actor.root);
  d.retainedActors?.clear();
  d.lifeReady = true;
  d.liveVisitors?.attach();
  d.rebuildActors();
  d.renderer.shadowMap.needsUpdate = true;
  d.render();
}
