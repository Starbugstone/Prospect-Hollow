const clamp = (x) => Math.min(1, Math.max(0, x));
const turn = (a, b, amount) => {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const t = clamp(amount);
  return a + delta * t * t * (3 - 2 * t);
};
// Positions stay on valid edges. Only heading eases across a corner, so actors
// never cut through a building or the river to make a turn look smoother.
// Compile once when a route changes; keep per-frame sampling allocation-light.
export function prepareRoute(points) {
  const lengths = [],
    headings = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0],
      dz = points[i + 1][1] - points[i][1];
    const length = Math.hypot(dx, dz);
    lengths.push(length);
    headings.push(Math.atan2(dx, dz));
    total += length;
  }
  return { points, lengths, headings, total };
}
export function routePose(route, distance) {
  const { points, lengths, headings } = Array.isArray(route) ? prepareRoute(route) : route;
  let remaining = Math.max(0, distance);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const fraction = clamp(remaining / (lengths[i] || 1));
      const a = points[i],
        b = points[i + 1];
      const radius = Math.min(0.6, lengths[i] / 3);
      let heading = headings[i];
      if (radius && i > 0 && remaining < radius)
        heading = turn(headings[i - 1], heading, 0.5 + remaining / (2 * radius));
      else if (radius && i < lengths.length - 1 && remaining > lengths[i] - radius)
        heading = turn(heading, headings[i + 1], 0.5 - (lengths[i] - remaining) / (2 * radius));
      return {
        x: a[0] + (b[0] - a[0]) * fraction,
        z: a[1] + (b[1] - a[1]) * fraction,
        heading,
        moving: remaining <= lengths[i],
      };
    }
    remaining -= lengths[i];
  }
  return { x: points[0]?.[0] ?? 0, z: points[0]?.[1] ?? 0, heading: 0, moving: false };
}
