import { trafficRoutes, trafficTour } from './TownTrafficRoutes';
import { eraEvolution } from '../../data/eras';
import { prepareRoute, routePose } from './TownRoutes';
import { motorVehicle, animateVehicle } from './TownVehicles';
import { routeBetween, plotStreet } from './TownLayout';
import { bridgeDeckHeight } from './TownRiver';

export function busPose(path, time) {
  const speed = 1.6,
    radius = 0.25,
    turnSeconds = (Math.PI * radius) / speed;
  const travel = path.total / speed;
  const cycle = travel * 2 + turnSeconds * 2;
  const phase = ((time % cycle) + cycle) % cycle;
  const returning = phase >= travel + turnSeconds;
  const turn =
    (phase >= travel && phase < travel + turnSeconds) || phase >= travel * 2 + turnSeconds;
  let pose;
  if (turn) {
    const atStart = phase >= travel * 2 + turnSeconds;
    const angle = ((phase - (atStart ? travel * 2 + turnSeconds : travel)) / turnSeconds) * Math.PI;
    pose = routePose(path, atStart ? 0 : path.total);
    const heading = pose.heading + (atStart ? Math.PI : 0);
    pose.x += radius * (Math.cos(heading) * Math.cos(angle) + Math.sin(heading) * Math.sin(angle));
    pose.z += radius * (-Math.sin(heading) * Math.cos(angle) + Math.cos(heading) * Math.sin(angle));
    pose.heading = heading - angle;
  } else {
    pose = routePose(
      path,
      returning ? path.total - (phase - travel - turnSeconds) * speed : phase * speed,
    );
    if (returning) pose.heading += Math.PI;
    pose.x += Math.cos(pose.heading) * 0.25;
    pose.z -= Math.sin(pose.heading) * 0.25;
  }
  return { ...pose, distance: time * speed };
}
export function addMotorActivity(d, town) {
  if (!eraEvolution(town.era).busService || !town.buildings.garage || !town.buildings.busDepot)
    return;
  const route = routeBetween(town, plotStreet('garage'), plotStreet('busDepot'));
  if (route.length < 2) return;
  const path = prepareRoute(route);
  const bus = motorVehicle(d, d.world, true);
  bus.name = 'Valley bus on its village route';
  bus.userData.animated = true;
  bus.userData.trafficRadius = 1.4;
  (d.trafficActors ??= []).push(bus);
  const travel = trafficTour(
    bus,
    trafficRoutes(
      { town, itineraries: d.itineraries },
      plotStreet('garage'),
      plotStreet('busDepot'),
    ),
    {
      seed: 23,
    },
  );
  d.motions.push((time) => {
    if (travel) {
      animateVehicle(bus, travel(time));
      return;
    }
    const pose = busPose(path, time - (bus.userData.trafficDelay ?? 0));
    const bridge = pose.x >= 24 && pose.x <= 38 && Math.abs(pose.z - 7.5) < 1;
    bus.position.set(pose.x, bridge ? bridgeDeckHeight(pose.x) + 0.17 : 0.07, pose.z);
    bus.rotation.y = pose.heading;
    animateVehicle(bus, pose.distance);
  });
}
