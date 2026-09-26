import { eraEvolution } from '../../data/eras';
import { isCityEra } from '../../data/city';
import { cityModel } from './buildings/city';
import { RIVER, riverCenterX } from './TownRiver';
import { PLOTS, RAIL_EDGE, railEdges, routeBetween, plotStreet } from './TownLayout';
import { modernTransport } from './TownEvolution';
import { addWorkBreak } from './TownWorkRoutine';

const RAIL_HEIGHT = 0.18;
export const railHeight = (x) => {
  const p = Math.max(0, Math.min(1, (16 - Math.abs(x - riverCenterX(RAIL_EDGE.from[1]))) / 11));
  return RAIL_HEIGHT + 2.5 * p * p * (3 - 2 * p);
};
// Sample both bogies so a complete carriage follows the rail grade as one body.
export function railCarriagePose(x, wheelbase = 2.4) {
  const rear = railHeight(x - wheelbase / 2),
    front = railHeight(x + wheelbase / 2);
  return { y: (rear + front) / 2, pitch: Math.atan2(front - rear, wheelbase) };
}
// One eastbound journey, a station dwell, then a full departure beyond the far map edge.
export function trainJourney(time) {
  const speed = 4,
    stop = -16,
    start = RAIL_EDGE.from[0] - 7,
    end = RAIL_EDGE.to[0] + 7;
  const arrival = (stop - start) / speed,
    dwell = 9,
    finish = (end - start) / speed + dwell;
  const phase = (time + 25) % (finish + 25);
  const moving = phase < arrival || phase >= arrival + dwell;
  const x =
    phase < arrival
      ? start + phase * speed
      : phase < arrival + dwell
        ? stop
        : stop + (phase - arrival - dwell) * speed;
  return {
    x,
    visible: phase < finish,
    moving,
    distance: x - start,
    arrived: phase >= arrival && phase < arrival + dwell,
    sinceArrival: phase - arrival,
    visit: Math.floor((time + 25) / (finish + 25)),
  };
}

export function boatJourney(time) {
  const phase = (time + 18) % 95;
  const z = phase < 23 ? -65 + phase * (61 / 23) : phase < 32 ? -4 : -4 + (phase - 32) * 3;
  return {
    z,
    visible: phase < 55,
    arrived: phase >= 23 && phase < 32,
    sinceArrival: phase - 23,
    visit: Math.floor((time + 18) / 95),
  };
}

export function addEraActivity(d, town) {
  if (town.buildings.fisherman) {
    const [x, z] = PLOTS.fisherman;
    const fisher = d.person({
      color: '#839a82',
      skin: '#cba17a',
      hat: '#bba174',
      seed: 21,
      route: [
        [x + 2, z + 0.2],
        [x + 2, z + 0.4],
      ],
      work: 'fishing',
    });
    fisher.root.name = 'Neighbor fishing';
    addWorkBreak(d, fisher, 'fisherman', { work: 26, rest: 5, axis: [0, 1] });
    d.rod(fisher.arms[1].lower, [0, -0.19, 0], [0, -0.19, 1.5], 0.015, '#987c54').name =
      'Hand-held fishing rod';
  }
  if (town.era === 'frontier') return;
  if (town.buildings.bridge && town.buildings.home5) {
    const route = routeBetween(town, plotStreet('home5'), plotStreet('saloon'));
    if (route.length > 1)
      d.person({
        color: '#8b849a',
        skin: '#d5ab80',
        hat: '#baab8a',
        seed: 25,
        route,
        linear: true,
      });
  }
  if (town.buildings.riverPort) {
    const boat = d.group(d.world, riverCenterX(-8), RIVER.waterHeight + 0.12, -8);
    const modern = modernTransport(town, 'riverPort');
    boat.name = modern ? 'Modern river launch' : 'Paddle-wheel steamboat';
    boat.userData.animated = true;
    d.ball(boat, 0, 0, 0, [1.1, 0.35, 2.6], '#725d45');
    d.box(boat, 2.1, 0.15, 4.5, 0, 0.25, 0, '#dfcca2');
    d.box(boat, 1.4, 0.8, 2.4, 0, 0.73, 0, '#e3d3af');
    d.box(boat, 1.85, 0.14, 3, 0, 1.2, 0, '#8c9f91');
    if (modern) {
      d.box(boat, 1.65, 0.55, 1.1, 0, 1.48, 0.35, '#d9ddce');
      d.box(boat, 1.5, 0.32, 0.06, 0, 1.52, 0.93, '#729d9d');
      for (const side of [-1, 1])
        for (const z of [-0.6, 0.1, 0.8])
          d.ball(boat, side * 0.72, 0.85, z, [0.035, 0.18, 0.18], '#8bb8bd');
      d.rod(boat, [0, 1.8, 0], [0, 2.3, 0], 0.035, '#617c76');
    } else d.mesh(boat, 'cylinder', [0.18, 1.1, 0.18], [0.3, 1.65, -0.6], '#696d62');
    const wheel = d.group(boat, 0, 0.2, -2.2);
    for (let n = 0; n < (modern ? 0 : 8); n++) {
      const paddle = d.group(wheel);
      paddle.rotation.x = (n * Math.PI) / 4;
      d.box(paddle, 1.5, 0.15, 0.3, 0, 0.55, 0, '#9b6e51');
    }
    const portEra = town.buildingEras.riverPort;
    if (eraEvolution(portEra).cityBoat) {
      for (const child of [...boat.children]) boat.remove(child);
      cityModel(d, boat, `${portEra}-boat`);
      boat.name = eraEvolution(portEra).digitalCity
        ? 'Solar river ferry'
        : 'Rebuilding river launch';
    }
    d.motions.push((time) => {
      const journey = boatJourney(time),
        { z } = journey;
      boat.visible = journey.visible;
      d.visitorTransports?.set('riverPort', { ...journey, root: boat });
      boat.position.set(riverCenterX(z), RIVER.waterHeight + 0.12, z);
      boat.rotation.y = Math.atan2(riverCenterX(z + 0.2) - riverCenterX(z), 0.2);
      wheel.rotation.x = time * 1.6;
    });
  }
  if (railEdges(town).length) {
    const train = d.group(d.world, -17, 0.3, -23);
    const modern = modernTransport(town, 'railDepot');
    train.name = modern ? 'Modern station railcar' : 'Station train';
    train.userData.animated = true;
    const wheels = [];
    const carriages = [];
    const carriage = (x, wheelbase) => {
      const pivot = d.group(train, x, 0, 0);
      pivot.name = 'Rail carriage suspension';
      pivot.userData.wheelbase = wheelbase;
      carriages.push({ pivot, x, wheelbase });
      return pivot;
    };
    if (isCityEra(town.buildingEras.railDepot)) {
      train.name = eraEvolution(town.buildingEras.railDepot).digitalCity
        ? 'Electric city train'
        : 'Motor passenger railcar';
      for (const x of [0, -4, -8]) {
        // Keep the model's authored yaw below the pitch pivot: rotating its
        // local Z after a 90-degree yaw rolls the carriage instead of pitching it.
        const model = cityModel(d, carriage(x, 2.4), `${town.buildingEras.railDepot}-railcar`);
        model.rotation.y = Math.PI / 2;
      }
    } else {
      const engine = carriage(0, 1.2);
      d.box(engine, 2, 0.6, 0.9, 0, 0.55, 0, '#5d7470');
      d.box(engine, 0.65, 1.1, 1, -0.7, 0.9, 0, '#b29b6c');
      if (modern) {
        d.box(engine, 2.1, 0.9, 1.05, 0, 1, 0, '#d6c9a1');
        d.box(engine, 0.06, 0.45, 0.82, 1.08, 1.13, 0, '#8db5b6');
        d.box(engine, 2.3, 0.12, 1.12, 0, 1.5, 0, '#607f78');
      } else d.mesh(engine, 'cylinder', [0.15, 0.7, 0.15], [0.6, 1.2, 0], '#565f56');
      for (const x of [-2.2, -4]) d.box(carriage(x, 1), 1.5, 0.9, 1, 0, 0.85, 0, '#a1825c');
      for (const { pivot, wheelbase } of carriages) {
        if (modern)
          for (const x of pivot === engine ? [-0.6, 0.1, 0.7] : [-0.4, 0.2])
            for (const side of [-1, 1])
              d.box(pivot, 0.4, 0.35, 0.05, x, 1.08, side * 0.54, '#9ec0bd');
        for (const x of [-wheelbase / 2, wheelbase / 2])
          for (const z of [-0.55, 0.55]) {
            const wheel = d.mesh(pivot, 'cylinder', [0.25, 0.09, 0.25], [x, 0.25, z], '#50584f');
            wheel.rotation.x = Math.PI / 2;
            wheels.push(wheel);
          }
      }
    }
    d.motions.push((time) => {
      const journey = d.railwayOpening?.journey ?? trainJourney(time + (d.trainTimeOffset ?? 0));
      train.visible = journey.visible;
      d.visitorTransports?.set('railDepot', {
        ...journey,
        root: train,
        arrived: !d.railwayOpening && journey.arrived,
      });
      train.position.set(journey.x, 0.035, RAIL_EDGE.from[1]);
      for (const { pivot, x, wheelbase } of carriages) {
        const pose = railCarriagePose(journey.x + x, wheelbase);
        pivot.position.y = pose.y;
        pivot.rotation.z = pose.pitch;
      }
      wheels.forEach((wheel) => {
        wheel.rotation.y = -journey.distance / 0.25;
      });
    });
  }
}

export function addRailroad(d, town, { batch = true } = {}) {
  if (!railEdges(town).length) return null;
  const rails = d.group(d.world);
  rails.userData.static = true;
  rails.name = 'Station connecting railroad';
  for (let x = RAIL_EDGE.from[0]; x < RAIL_EDGE.to[0]; x++) {
    const z = RAIL_EDGE.from[1];
    for (const dz of [-0.52, 0.52])
      d.rod(
        rails,
        [x, railHeight(x), z + dz],
        [x + 1, railHeight(x + 1), z + dz],
        0.035,
        '#6e7770',
      );
    d.box(rails, 0.17, 0.1, 1.45, x, railHeight(x) - 0.09, z, '#8b7756');
    const fill = railHeight(x) - 0.14;
    if (Math.abs(x - riverCenterX(z)) > RIVER.bankWidth + 1.2)
      d.box(rails, 1.02, fill, 1.7, x + 0.5, fill / 2, z, '#a99d80');
  }
  const center = riverCenterX(RAIL_EDGE.from[1]),
    span = RIVER.bankWidth + 1.2,
    z = RAIL_EDGE.from[1];
  const bridge = d.group(rails);
  bridge.name = 'Railway river bridge';
  d.box(bridge, span * 2, 0.15, 1.8, center, railHeight(center) - 0.2, z, '#766e5d');
  for (const side of [-1, 1]) {
    const edge = z + side * 0.87;
    const deck = railHeight(center);
    d.rod(
      bridge,
      [center - span, deck + 0.1, edge],
      [center + span, deck + 0.1, edge],
      0.075,
      '#515f5a',
    );
    d.rod(
      bridge,
      [center - span, deck + 1.5, edge],
      [center + span, deck + 1.5, edge],
      0.07,
      '#65766d',
    );
    for (let n = 0; n <= 6; n++) {
      const x = center - span + (n * span) / 3;
      d.rod(bridge, [x, deck + 0.1, edge], [x, deck + 1.5, edge], 0.055, '#65766d');
      if (n < 6)
        d.rod(
          bridge,
          [x, deck + (n % 2 ? 1.5 : 0.1), edge],
          [x + span / 3, deck + (n % 2 ? 0.1 : 1.5), edge],
          0.05,
          '#65766d',
        );
    }
  }
  for (const x of [center - span + 0.35, center + span - 0.35])
    d.box(bridge, 0.65, 3.7, 2, x, 0.65, z, '#a39d88');
  if (batch) d.batch(rails);
  return rails;
}
