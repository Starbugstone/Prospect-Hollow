import { walkPath } from './TownNavigation';

// A prepared out-and-back walk shared by outdoor activities. Locomotion owns
// travel; the village clock only times pauses after the actor actually arrives.
export function setWorkRoutine(actor, path, { work = 20, rest = 8, atWork = false } = {}) {
  if (!path?.total) return;
  actor.workRoutine ??= { phase: atWork ? 'work' : 'approach', since: null, visit: 0 };
  Object.assign(actor.workRoutine, { work, rest });
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
    if (phase === 'work') routine.visit++;
  };
  routine.since ??= time;
  if (routine.phase === 'approach' && distance >= actor.walkPath.total - 1e-6) arrive('work');
  else if (routine.phase === 'return' && distance <= 1e-6) arrive('rest');
  else if (routine.phase === 'work' && time - routine.since >= routine.work) arrive('return');
  else if (routine.phase === 'rest' && time - routine.since >= routine.rest) arrive('approach');
  actor.workActive = routine.phase === 'work';
  actor.routeResting = actor.workActive || routine.phase === 'rest';
  actor.direction = routine.phase === 'return' ? -1 : 1;
  actor.routeLimit = actor.direction < 0 ? 0 : actor.walkPath.total;
}
export function addWorkBreak(d, actor, from, options) {
  const station = actor.curve.getPointAt(0.1).toArray();
  const points = [[from[0], station[1], from[1]], station];
  let path = d.navigation ? d.navigation.plan(points) : walkPath(points);
  // A larger era model can project both anchors onto the same corner. Find a
  // short usable street leg once during preparation, never in the frame loop.
  if (d.navigation && path.total < 1)
    for (const offset of [3, -3, 6, -6]) {
      const candidate = d.navigation.plan([[from[0], station[1], from[1] + offset], station]);
      if (candidate.total >= 1) {
        path = candidate;
        break;
      }
    }
  setWorkRoutine(actor, path, { ...options, atWork: true });
}
