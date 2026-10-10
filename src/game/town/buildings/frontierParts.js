import { renderBuilding } from './BuildingRenderer';

// Frontier-era building parts shared by several buildings and the construction lots.
export const TRIM = '#e8d3a7';

export function addCactus(d, parent, x, z) {
  d.rod(parent, [x, 0, z], [x, 1.25, z], 0.11, '#7c9470');
  d.rod(parent, [x, 0.6, z], [x - 0.35, 0.6, z], 0.085, '#7c9470');
  d.rod(parent, [x - 0.35, 0.6, z], [x - 0.35, 0.95, z], 0.085, '#7c9470');
  d.rod(parent, [x, 0.8, z], [x + 0.27, 0.8, z], 0.075, '#7c9470');
  d.rod(parent, [x + 0.27, 0.8, z], [x + 0.27, 1.1, z], 0.075, '#7c9470');
}
// The fenced lot of an unbuilt or rising building: `wins` counts finished puzzles
// toward it (-1 shows only its marker sign).
export function addConstructionPlot(d, parent, id, wins, label) {
  const w = id === 'well' ? 2.1 : 3.05,
    depth = id === 'well' ? 2.1 : 2.7;
  for (const x of [-w / 2, w / 2])
    for (const z of [-depth / 2, depth / 2]) d.box(parent, 0.12, 0.6, 0.12, x, 0.3, z, '#a58a57');
  for (const z of [-depth / 2, depth / 2])
    d.rod(parent, [-w / 2, 0.44, z], [w / 2, 0.44, z], 0.05, '#e5cf9b');
  for (const x of [-w / 2, w / 2])
    d.rod(parent, [x, 0.44, -depth / 2], [x, 0.44, depth / 2], 0.05, '#e5cf9b');
  if (wins < 0) {
    d.box(parent, 0.08, 0.5, 0.08, -w / 2 + 0.25, 0.2, depth / 2 - 0.25, '#99805a');
    d.sign(parent, label, 1.05, -w / 2 + 0.25, 0.52, depth / 2 - 0.25);
    return;
  }
  for (let n = 0; n < 5; n++)
    d.box(parent, 0.18, 0.11, 1.2, w / 2 + 0.22, 0.1 + n * 0.09, 0.1, '#bd9a67');
  if (wins === 0) return;
  if (id === 'well') {
    addWell(d, parent, wins === 1 ? 'foundation' : 'frame');
    return;
  }
  d.box(parent, 2.85, 0.2, 2.5, 0, 0.13, 0, '#a99579');
  if (wins === 1) {
    for (const x of [-1.3, 1.3]) d.box(parent, 0.12, 0.75, 2.3, x, 0.6, 0, '#b9a183');
    for (const z of [-1.13, 1.13]) d.box(parent, 2.6, 0.45, 0.12, 0, 0.46, z, '#b9a183');
    return;
  }
  renderBuilding({ town: d, parent, kind: id, level: 0, label, construction: true });
  for (const x of [-1.7, 1.7]) {
    for (const z of [-1.4, 1.4]) d.rod(parent, [x, 0, z], [x, 2.1, z], 0.045, '#b09771');
    d.box(parent, 0.55, 0.08, 3.0, x, 1.32, 0, '#b9a072');
    d.rod(parent, [x, 0.1, -1.4], [x, 2, 1.4], 0.035, '#b09771');
  }
}
export function addHomeWing(d, parent, wins) {
  const wing = d.group(parent, -1.85, 0, 0.15);
  if (wins === 0) {
    for (let n = 0; n < 5; n++) d.box(wing, 0.8, 0.09, 0.17, 0, 0.08 + n * 0.09, 0.3, '#bd9a67');
    return;
  }
  d.box(wing, 1.35, 0.18, 1.9, 0, 0.12, 0, '#a99579');
  if (wins === 1) return;
  for (const x of [-0.6, 0.6])
    for (const z of [-0.87, 0.87]) d.box(wing, 0.08, 1.25, 0.08, x, 0.81, z, '#b39469');
  for (let row = 0; row < (wins === 2 ? 3 : 7); row++) {
    const y = 0.32 + row * 0.16;
    for (const x of [-0.6, 0.6]) d.box(wing, 0.08, 0.145, 1.75, x, y, 0, '#d4ad89');
    for (const z of [-0.87, 0.87]) d.box(wing, 1.2, 0.145, 0.08, 0, y, z, '#d4ad89');
  }
  if (wins < 3) return;
  for (const z of [-0.9, 0, 0.9]) d.rod(wing, [-0.7, 1.3, z], [0.7, 1.55, z], 0.045, '#9d7b50');
  if (wins < 4) return;
  const roof = d.box(wing, 1.5, 0.14, 2.0, 0, 1.43, 0, '#73928a');
  roof.rotation.z = 0.18;
  addWindow(d, wing, 0, 0.95, 0.9);
}
export function addWindow(d, parent, x, y, z) {
  d.box(parent, 0.54, 0.65, 0.06, x, y, z, '#514d37');
  d.box(parent, 0.44, 0.55, 0.06, x, y, z + 0.04, '#e1bd75');
  for (const dx of [-0.27, 0, 0.27]) d.box(parent, 0.035, 0.68, 0.055, x + dx, y, z + 0.08, TRIM);
  for (const dy of [-0.32, 0, 0.32]) d.box(parent, 0.56, 0.035, 0.055, x, y + dy, z + 0.08, TRIM);
  d.box(parent, 0.67, 0.15, 0.25, x, y - 0.43, z + 0.08, '#9b7852');
  for (let n = 0; n < 3; n++)
    d.ball(parent, x - 0.21 + n * 0.21, y - 0.34, z + 0.15, [0.14, 0.1, 0.12], '#7f9c65');
  d.ball(parent, x - 0.15, y - 0.25, z + 0.15, 0.065, '#e3a086');
}
export function addWell(d, parent, phase = 'done') {
  for (let layer = 0; layer < (phase === 'foundation' ? 1 : 3); layer++)
    for (let n = 0; n < 12; n++) {
      const angle = ((n + layer * 0.5) * Math.PI) / 6;
      const stone = d.box(
        parent,
        0.34,
        0.18,
        0.28,
        Math.cos(angle) * 0.59,
        0.17 + layer * 0.19,
        Math.sin(angle) * 0.59,
        n % 3 ? '#c8b597' : '#ad9b7e',
        true,
      );
      stone.name = 'Well wall';
      stone.rotation.y = -angle;
    }
  if (phase === 'foundation') return;
  d.mesh(
    parent,
    'cylinder',
    [0.48, 0.025, 0.48],
    [0, 0.2, 0],
    phase === 'done' ? '#6bacae' : '#77684d',
  );
  for (const x of [-0.86, 0.86])
    d.box(parent, 0.14, 2.0, 0.14, x, 1.05, 0, '#ac8551').name = 'Well frame';
  d.rod(parent, [-0.95, 1.7, 0], [0.95, 1.7, 0], 0.07, '#86613d').name = 'Well frame';
  for (const side of [-1, 1]) {
    const roof = d.box(
      parent,
      1.25,
      0.12,
      1.75,
      side * 0.5,
      2.25,
      0,
      phase === 'done' ? '#5f8a89' : '#b69a6c',
    );
    roof.name = 'Well roof';
    roof.rotation.z = -side * 0.4;
  }
  if (phase !== 'done') return;
  d.rod(parent, [0, 1.75, 0], [0, 0.73, 0], 0.012, '#d6c298');
  d.mesh(parent, 'cone', [0.13, 0.22, 0.13], [0, 0.75, 0], '#aa7748');
}
