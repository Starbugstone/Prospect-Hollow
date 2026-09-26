import { bridgeDeckHeight, riverCenterX } from '../TownRiver';
export function renderBridge(d, parent, level) {
  if (!level) {
    for (const x of [-6, 6]) d.box(parent, 0.22, 1, 0.22, x, 0.5, 0, '#b1976c');
    return;
  }
  const center = riverCenterX(7.5);
  for (let i = 0; i < 56; i++) {
    const x = -7 + i * 0.25,
      height = bridgeDeckHeight(center + x);
    d.box(parent, 0.26, 0.18, 2.3, x, height - 0.08, 0, '#a48e69');
    for (const z of [-1.12, 1.12]) {
      d.rod(
        parent,
        [x, height + 0.75, z],
        [x + 0.25, bridgeDeckHeight(center + x + 0.25) + 0.75, z],
        0.055,
        '#646e66',
      );
      if (i % 4 === 0) d.rod(parent, [x, height, z], [x, height + 0.75, z], 0.045, '#677269');
    }
  }
  if (level >= 2)
    for (const x of [-4.4, 4.4]) {
      d.box(parent, 0.75, 2.5, 2.3, x, 0.65, 0, '#b7ae98');
      d.box(parent, 0.9, 0.2, 2.5, x, 2, 0, '#d9ccad');
    }
  if (level >= 3)
    for (const x of [-3.5, 3.5])
      for (const z of [-1.1, 1.1]) {
        d.rod(parent, [x, 2.65, z], [x, 4.15, z], 0.055, '#526e70');
        d.box(parent, 0.25, 0.4, 0.25, x, 4.35, z, '#f5dc9c');
        d.mesh(parent, 'cone', [0.22, 0.25, 0.22], [x, 4.65, z], '#526e70');
      }
  // Abutments stand outside the navigation channel; no central pier blocks the boat.
  for (const x of [-4.4, 4.4])
    for (const z of [-1.12, 1.12]) d.box(parent, 0.5, 2.5, 0.5, x, 0.65, z, '#8c9183');
}
export function addStationDetails(d, parent) {
  d.box(parent, 6, 0.22, 1.8, 0, 0.17, -2.4, '#b5a27e');
  d.box(parent, 5.8, 0.15, 1.6, 0, 2.3, -2.3, '#728a82');
  for (const x of [-2.6, 2.6]) d.rod(parent, [x, 0.2, -2.4], [x, 2.3, -2.4], 0.065, '#a58d61');
  d.ball(parent, 0, 2.5, 1.5, [0.22, 0.22, 0.06], '#efe1b6');
}
