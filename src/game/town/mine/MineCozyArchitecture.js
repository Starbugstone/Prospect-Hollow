// Cozy additions reuse the existing primitive catalog and sit on existing mine
// structures. The decline, railway bore, encounter yard and machinery stay clear.
export function addCozyMineRoof(d, parent, a, x, y, z, width, depth, landmark = false) {
  const roof = d.group(parent, x, y, z);
  roof.name = `Mine ${a.cozyStyle} petal roof`;
  const p = a.palette;
  const lantern = a.cozyStyle === 'riverlight';
  d.box(roof, width, 0.1, depth, 0, 0, 0, p.shell);
  for (let n = 0; n < 4; n++) {
    const angle = (n * Math.PI * 2) / 4;
    const leaf = d.ball(
      roof,
      Math.cos(angle) * width * 0.21,
      0.18,
      Math.sin(angle) * depth * 0.16,
      [width * 0.27, 0.2, depth * 0.4],
      lantern && n % 2 ? p.glass : p.roof,
      'rock',
    );
    leaf.rotation.y = -angle * 0.35;
    leaf.rotation.z = -Math.cos(angle) * 0.1;
  }
  d.ball(roof, 0, 0.38, 0, [width * 0.13, 0.045, depth * 0.19], p.shell, 'rock');
  if (lantern && landmark) {
    const crystal = d.ball(roof, 0, 0.65, 0, [0.15, 0.31, 0.15], p.light, 'rock');
    crystal.name = 'Mine crystal roof lantern';
  }
  return roof;
}

export function addCozyMinePortal(d, entry, a) {
  const p = a.palette;
  addCozyMineRoof(d, entry, a, 0, 2.55, 0.12, 3.6, 1.1, true);
  for (const x of [-1.3, 1.3]) {
    d.box(entry, 0.13, 2.2, 0.12, x, 1.1, 0.29, p.timber);
    d.ball(entry, x, 1.78, 0.42, [0.1, 0.14, 0.1], p.light, 'rock');
  }
}

export function addCozySortingHall(d, terrace, a) {
  const p = a.palette;
  d.mesh(terrace, 'cylinder', [1.52, 1.45, 0.63], [0, 1, 0], p.shell);
  d.mesh(terrace, 'cylinder', [1.54, 0.55, 0.65], [0, 1.25, 0], p.glass);
  for (const x of [-1.15, 0, 1.15]) d.box(terrace, 0.09, 1.3, 0.08, x, 0.98, 0.65, p.timber);
  d.box(terrace, 0.55, 1.05, 0.06, 0, 0.79, 0.7, p.deep);
  addCozyMineRoof(d, terrace, a, 0, 1.78, 0, 3.5, 1.55, true);
  // Planters and lamps attach to the facade, above the terrace floor.
  for (const x of [-0.95, 0.95]) {
    d.box(terrace, 0.5, 0.14, 0.19, x, 0.84, 0.73, p.shell);
    d.ball(terrace, x, 0.98, 0.74, [0.23, 0.13, 0.1], p.green, 'rock');
    d.ball(terrace, x + 0.08, 1.08, 0.77, [0.08, 0.08, 0.06], p.flower, 'rock');
    if (a.cozyStyle === 'riverlight')
      d.ball(terrace, x, 1.48, 0.74, [0.09, 0.13, 0.09], p.light, 'rock');
  }
}
