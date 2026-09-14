import { routePose } from './TownRoutes';
import { isCityEra } from '../../data/city';
import { cityModel } from './buildings/city';
import { motorVehicle } from './buildings/motorAge';
import { routeBetween, plotStreet } from './TownLayout';

export function addMotorActivity(d, town) {
  if (
    !['motor-age', 'aviation', 'broadcast', 'contemporary'].includes(town.era) ||
    !town.buildings.garage ||
    !town.buildings.busDepot
  )
    return;
  const route = routeBetween(town, plotStreet('garage'), plotStreet('busDepot'));
  if (route.length < 2) return;
  const lengths = route
    .slice(1)
    .map((point, i) => Math.hypot(point[0] - route[i][0], point[1] - route[i][1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const bus = isCityEra(town.buildingEras.busDepot)
    ? cityModel(d, d.world, `${town.buildingEras.busDepot}-bus`)
    : motorVehicle(d, d.world, true);
  bus.name = 'Valley bus on its village route';
  bus.userData.animated = true;
  d.motions.push((time) => {
    const phase = (time % 44) / 44;
    const returning = phase >= 0.5;
    const distance =
      (returning ? 1 - Math.min(1, (phase - 0.5) / 0.4) : Math.min(1, phase / 0.4)) * total;
    const pose = routePose(route, distance);
    bus.position.set(pose.x, 0.07, pose.z);
    const ease = (t) => t * t * (3 - 2 * t);
    const turn =
      phase >= 0.9
        ? 1 - ease((phase - 0.9) / 0.1)
        : phase >= 0.4 && phase < 0.5
          ? ease((phase - 0.4) / 0.1)
          : Number(returning);
    bus.rotation.y = pose.heading + turn * Math.PI;
  });
}
