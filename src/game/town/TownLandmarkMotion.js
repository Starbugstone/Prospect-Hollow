// Deterministic poses keep a rebuilt monument in step with the town clock. Only
// moving parts leave the static batches; materials and geometry stay shared.
export function landmarkMotion(motions, node, kind, axis, speed, amount = 1, phase = 0) {
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
