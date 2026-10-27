// Deterministic poses keep a rebuilt monument in step with the town clock. Only
// moving parts leave the static batches; materials and geometry stay shared.
function landmarkMotion(motions, node, kind, axis, speed, amount = 1, phase = 0) {
  node.userData.animated = true;
  node.name ||= `Monument ${kind}`;
  const property = kind === 'lift' ? node.position : kind === 'pulse' ? node.scale : node.rotation;
  const base = property[axis];
  motions.push((time) => {
    property[axis] =
      base +
      (kind === 'turn'
        ? time * speed
        : (Math.sin(time * speed + phase) - Math.sin(phase)) * amount);
  });
  return node;
}

// Curved water paths and surface ripples share the same clock, construction hold,
// reduced-motion pose and animated-instance lifecycle as the monument mechanisms.
export function createLandmarkMotion(motions, active) {
  const move = (node, kind, axis, speed, amount, phase) =>
    active ? landmarkMotion(motions, node, kind, axis, speed, amount, phase) : node;
  move.update = (node, update) => {
    update(0);
    if (active) {
      node.userData.animated = true;
      motions.push(update);
    }
    return node;
  };
  return move;
}
