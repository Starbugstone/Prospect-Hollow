import { walkPath, routeStepPose } from './TownNavigation';
import { villagerRandom } from '../../data/villagers';
import { buildingWalk } from './TownPedestrians';

// A prepared out-and-back walk shared by outdoor activities. Locomotion owns
// travel; the village clock only times pauses after the actor actually arrives.
export function setWorkRoutine(actor, path, { work = 20, rest = 8, atWork = false } = {}) {
  if (!path?.total) return;
  actor.workRoutine ??= { phase: atWork ? 'work' : 'approach', since: null, visit: 0 };
  Object.assign(actor.workRoutine, { work, rest });
  actor.workRoutine.paths = [1, 0.75, 0.55].map((fraction) => {
    const start = path.total * (1 - fraction);
    const pose = routeStepPose(path, start, {});
    let distance = 0;
    const points = path.points.filter((point, i) => {
      if (i) distance += Math.hypot(...point.map((v, axis) => v - path.points[i - 1][axis]));
      return distance > start + 1e-6;
    });
    const variant = walkPath([[pose.x, pose.y, pose.z], ...points]);
    variant.clearance = path.clearance;
    variant.building = path.building;
    variant.frontage = path.frontage;
    return variant;
  });
  actor.walkPath = path;
  if (!actor.motion) {
    actor.routeProgress = atWork ? 1 : 0;
    actor.root.position.fromArray(atWork ? path.points.at(-1) : path.points[0]);
  }
}

export function updateWorkRoutine(actor, time) {
  const routine = actor.workRoutine;
  if (!routine) return;
  const distance = actor.motion?.routeDistance ?? actor.routeProgress * actor.walkPath.total;
  const arrive = (phase) => {
    routine.phase = phase;
    routine.since = time;
    if (phase === 'work') {
      routine.visit++;
      const draw = villagerRandom(actor.seed + routine.visit * 701);
      const path = routine.paths[Math.floor(draw * routine.paths.length)];
      actor.walkPath = path;
      actor.routeProgress = 1;
      if (actor.motion) {
        actor.motion.path = path;
        actor.motion.routeDistance = path.total;
      }
    }
    routine.pause =
      (phase === 'work' ? routine.work : routine.rest) *
      (0.65 + villagerRandom(actor.seed + routine.visit * 719 + phase.length) * 0.7);
  };
  routine.since ??= time;
  if (routine.phase === 'approach' && distance >= actor.walkPath.total - 1e-6) arrive('work');
  else if (routine.phase === 'return' && distance <= 1e-6) arrive('rest');
  else if (routine.phase === 'work' && time - routine.since >= (routine.pause ?? routine.work))
    arrive('return');
  else if (routine.phase === 'rest' && time - routine.since >= (routine.pause ?? routine.rest))
    arrive('approach');
  actor.workActive = routine.phase === 'work';
  actor.routeResting = actor.workActive || routine.phase === 'rest';
  actor.direction = routine.phase === 'return' ? -1 : 1;
  actor.routeLimit = actor.direction < 0 ? 0 : actor.walkPath.total;
}
export function addWorkBreak(d, actor, building, options) {
  const station = actor.curve.getPointAt(0.1).toArray();
  const path = buildingWalk(d, building, {
    station,
    radius: actor.radius ?? 0.29,
    axis: options?.axis,
  });
  actor.activityBuilding = building;
  setWorkRoutine(actor, path, { ...options, atWork: true });
}
