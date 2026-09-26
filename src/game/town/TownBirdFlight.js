const mix = (a, b, t) => a.map((v, n) => v + (b[n] - v) * t);
const length = (a, b) => Math.hypot(...a.map((v, n) => b[n] - v));

// A cubic stays inside its control-point bounds. Subdivide only bounds that
// touch scenery, so thin wires/fences cannot slip between sampled positions.
function clearCurve(space, points, radius, depth = 0) {
  const low = [0, 1, 2].map((n) => Math.min(...points.map((p) => p[n])));
  const high = [0, 1, 2].map((n) => Math.max(...points.map((p) => p[n])));
  if (space.segment(low, high, radius)) return true;
  if (depth === 5) return false;
  const [a, b, c, d] = points;
  const ab = mix(a, b, 0.5),
    bc = mix(b, c, 0.5),
    cd = mix(c, d, 0.5);
  const abc = mix(ab, bc, 0.5),
    bcd = mix(bc, cd, 0.5),
    mid = mix(abc, bcd, 0.5);
  return (
    clearCurve(space, [a, ab, abc, mid], radius, depth + 1) &&
    clearCurve(space, [mid, bcd, cd, d], radius, depth + 1)
  );
}

function approach(point, x, z, span, ceiling) {
  const [px, y, pz] = point;
  const top = Math.max(ceiling, y + 3);
  return [
    point.slice(),
    [px + x * span * 0.35, y + (top - y) * 0.25, pz + z * span * 0.35],
    [px + x * span * 0.65, top, pz + z * span * 0.65],
    [px + x * span, top, pz + z * span],
  ];
}

// Baked with the habitat, never in the animation loop. Each direction keeps
// its widest safe arc; confined perches can use a tighter departure.
export function prepareBirdApproaches(space, point, radius) {
  const curves = [];
  const reach = Math.max(5, Math.min(10, (space.ceiling - point[1]) * 0.75));
  for (let n = 0; n < 8; n++) {
    const angle = (n * Math.PI) / 4;
    for (const span of [reach, reach / 2, 1.25, 0.5]) {
      const curve = approach(point, Math.sin(angle), Math.cos(angle), span, space.ceiling);
      if (!clearCurve(space, curve, radius)) continue;
      curves.push(curve);
      break;
    }
  }
  // An open-sky habitat always permits this last-resort escape from a narrow gap.
  return curves.length ? curves : [approach(point, 0, 0, 0, space.ceiling)];
}

function chooseApproach(site, from, toward, ceiling) {
  const dx = toward[0] - from[0],
    dz = toward[2] - from[2];
  const distance = Math.hypot(dx, dz) || 1;
  if (!site?.approaches || length(site.point, from) > 0.01)
    return approach(from, dx / distance, dz / distance, 3, ceiling);
  let best = site.approaches[0],
    score = -Infinity;
  for (const curve of site.approaches) {
    const x = curve[3][0] - from[0],
      z = curve[3][2] - from[2];
    const span = Math.hypot(x, z);
    const rank = (x * dx + z * dz) / (distance * (span || 1)) + span * 0.15;
    if (rank > score) {
      best = curve;
      score = rank;
    }
  }
  return best;
}

const duration = (curve, speed) =>
  Math.max(
    1.2,
    (length(curve[0], curve[1]) + length(curve[1], curve[2]) + length(curve[2], curve[3])) / speed,
  );

export function createBirdFlight(from, origin, target, ceiling, speed, bend) {
  const rise = chooseApproach(origin, from, target.point, ceiling);
  const land = chooseApproach(target, target.point, from, ceiling).slice().reverse();
  const liftTime = duration(rise, speed),
    landTime = duration(land, speed);
  const travel = Math.max(1.2, length(rise[3], land[0]) / speed);
  // Match the approach tangents and their velocities through the joins. Both
  // cruise controls remain above the scenery; the curve supplies a broad turn.
  const across = [
    rise[3],
    mix(rise[2], rise[3], 1 + travel / liftTime),
    mix(land[1], land[0], 1 + travel / landTime),
    land[0],
  ];
  // The cruise-only bend varies the journey without changing either checked
  // low approach or its tangent.
  return {
    from,
    to: target.point,
    target,
    elapsed: 0,
    rise,
    land,
    across,
    liftTime,
    landTime,
    travel,
    total: liftTime + travel + landTime,
    cruise: Math.max(rise[3][1], land[0][1]),
    bend,
    pose: {},
  };
}

export function birdFlightPose(flight, elapsed, pose = flight.pose) {
  let curve,
    u,
    bend = 0;
  if (elapsed < flight.liftTime) {
    curve = flight.rise;
    const t = Math.max(0, elapsed / flight.liftTime);
    u = t * t * (2 - t);
  } else if (elapsed < flight.liftTime + flight.travel) {
    curve = flight.across;
    u = (elapsed - flight.liftTime) / flight.travel;
    bend = flight.bend;
  } else {
    curve = flight.land;
    const t = Math.min(1, (elapsed - flight.liftTime - flight.travel) / flight.landTime);
    u = 1 - (1 - t) * (1 - t) * (1 + t);
  }
  const v = 1 - u,
    [a, b, c, d] = curve;
  let dx, dy, dz;
  for (let n = 0; n < 3; n++) {
    const value = v * v * v * a[n] + 3 * v * v * u * b[n] + 3 * v * u * u * c[n] + u * u * u * d[n];
    const tangent =
      3 * v * v * (b[n] - a[n]) + 6 * v * u * (c[n] - b[n]) + 3 * u * u * (d[n] - c[n]);
    if (n === 0) {
      pose.x = value;
      dx = tangent;
    } else if (n === 1) {
      pose.y = value;
      dy = tangent;
    } else {
      pose.z = value;
      dz = tangent;
    }
  }
  const x = d[0] - a[0],
    z = d[2] - a[2],
    span = Math.hypot(x, z) || 1;
  const offset = 16 * u * u * v * v * bend;
  const tangent = 32 * u * v * (1 - 2 * u) * bend;
  pose.x += (z / span) * offset;
  pose.z -= (x / span) * offset;
  dx += (z / span) * tangent;
  dz -= (x / span) * tangent;
  pose.heading = Math.atan2(dx, dz);
  pose.pitch = -Math.max(-0.45, Math.min(0.45, Math.atan2(dy, Math.hypot(dx, dz))));
  return pose;
}
