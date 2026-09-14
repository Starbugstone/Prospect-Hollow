import { isCityEra } from '../../data/city';
import { cityModel } from './buildings/city';
import { RIVER, riverCenterX } from './TownRiver';
import { PLOTS, RAIL_EDGE, railEdges, routeBetween, plotStreet } from './TownLayout';
import { modernTransport } from './TownEvolution';

export const RAIL_HEIGHT = 0.18;
export const railHeight = (x) => {
  const p = Math.max(0, Math.min(1, (16 - Math.abs(x - riverCenterX(RAIL_EDGE.from[1]))) / 11));
  return RAIL_HEIGHT + 2.5 * p * p * (3 - 2 * p);
};
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
  return { x, visible: phase < finish, moving, distance: x - start };
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
      work: 'greet',
    });
    d.rod(fisher.root, [0, 0.8, 0.15], [0.9, 1.5, 1.2], 0.015, '#987c54');
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
    const wheel = d.group(boat, 0, 0.2, 2.2);
    for (let n = 0; n < (modern ? 0 : 8); n++) {
      const paddle = d.group(wheel);
      paddle.rotation.x = (n * Math.PI) / 4;
      d.box(paddle, 1.5, 0.15, 0.3, 0, 0.55, 0, '#9b6e51');
    }
    const portEra = town.buildingEras.riverPort;
    if (isCityEra(portEra) && portEra !== 'broadcast') {
      for (const child of [...boat.children]) boat.remove(child);
      cityModel(d, boat, `${portEra}-boat`);
      boat.name = portEra === 'contemporary' ? 'Solar river ferry' : 'Rebuilding river launch';
    }
    d.motions.push((time) => {
      const phase = (time + 18) % 95;
      boat.visible = phase < 55;
      const z = phase < 23 ? -65 + phase * (61 / 23) : phase < 32 ? -4 : -4 + (phase - 32) * 3;
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
    d.box(train, 2, 0.6, 0.9, 0, 0.55, 0, '#5d7470');
    d.box(train, 0.65, 1.1, 1, -0.7, 0.9, 0, '#b29b6c');
    if (modern) {
      d.box(train, 2.1, 0.9, 1.05, 0, 1, 0, '#d6c9a1');
      d.box(train, 0.06, 0.45, 0.82, 1.08, 1.13, 0, '#8db5b6');
      d.box(train, 2.3, 0.12, 1.12, 0, 1.5, 0, '#607f78');
    } else d.mesh(train, 'cylinder', [0.15, 0.7, 0.15], [0.6, 1.2, 0], '#565f56');
    for (const dx of [-2.2, -4]) d.box(train, 1.5, 0.9, 1, dx, 0.85, 0, '#a1825c');
    if (modern)
      for (const dx of [-4.4, -3.8, -2.6, -2, -0.6, 0.1, 0.7])
        for (const side of [-1, 1]) d.box(train, 0.4, 0.35, 0.05, dx, 1.08, side * 0.54, '#9ec0bd');
    const wheels = [];
    for (const x of [-4.5, -3.5, -2.7, -1.7, -0.6, 0.6])
      for (const z of [-0.55, 0.55]) {
        const wheel = d.mesh(train, 'cylinder', [0.25, 0.09, 0.25], [x, 0.25, z], '#50584f');
        wheel.rotation.x = Math.PI / 2;
        wheels.push(wheel);
      }
    if (isCityEra(town.buildingEras.railDepot)) {
      for (const child of [...train.children]) train.remove(child);
      wheels.length = 0;
      train.name =
        town.buildingEras.railDepot === 'contemporary'
          ? 'Electric city train'
          : 'Motor passenger railcar';
      for (const x of [0, -4, -8]) {
        const carriage = cityModel(d, train, `${town.buildingEras.railDepot}-railcar`);
        carriage.rotation.y = Math.PI / 2;
        carriage.position.x = x;
      }
    }
    const parts = train.children.map((part) => ({ part, y: part.position.y, x: part.position.x }));
    d.motions.push((time) => {
      const journey = trainJourney(time);
      train.visible = journey.visible;
      train.position.set(journey.x, 0.035, RAIL_EDGE.from[1]);
      for (const { part, y, x } of parts) {
        part.position.y = y + railHeight(journey.x + x);
        if (!wheels.includes(part))
          part.rotation.z = Math.atan2(
            railHeight(journey.x + x + 0.5) - railHeight(journey.x + x - 0.5),
            1,
          );
      }
      wheels.forEach((wheel) => {
        wheel.rotation.y = -journey.distance / 0.25;
      });
    });
  }
}

export function addRailroad(d, town) {
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
  d.batch(rails);
  return rails;
}
