import { WATERMILL_SITE, watermillAppearance } from '../../../data/watermill';

export function renderWatermill(d, parent, era, level, label) {
  const style = watermillAppearance(era);
  const root = d.group(parent);
  root.name = `${era ?? 'frontier'} watermill`;
  const height = level >= 2 ? 2.8 : 2.1;
  const timber = style.masonry ? '#5a6257' : '#755536';
  d.box(root, 3.2, 0.35, 3.15, -0.35, 0.12, 0, '#a79b80');
  d.box(root, 2.65, height, 2.5, -0.35, height / 2 + 0.25, 0, style.wall);
  for (const x of [-1.65, 0.95]) {
    d.box(root, 0.12, height, 0.16, x, height / 2 + 0.25, 1.27, timber);
  }
  for (let y = 0.55; y < height; y += 0.32)
    d.box(root, 2.6, 0.025, 0.035, -0.35, y, 1.27, style.masonry ? '#d1bfa1' : '#906c45');
  for (const side of [-1, 1]) {
    const roof = d.box(root, 1.85, 0.16, 3.1, -0.35 + side * 0.73, height + 0.6, 0, style.roof);
    roof.rotation.z = -side * 0.55;
  }
  d.box(root, 0.7, 1.3, 0.08, -0.35, 0.9, 1.3, '#574735');
  d.window(root, -1.05, 1.4, 1.31);
  if (level >= 2) {
    d.window(root, -0.35, 2.4, 1.31);
    d.box(root, 2.9, 0.14, 0.85, -0.35, 1.95, 1.6, style.roof);
    for (const x of [-1.65, 0.95]) d.rod(root, [x, 0.2, 1.9], [x, 1.95, 1.9], 0.055, timber);
  }
  if (level >= 3) {
    const loading = d.group(root);
    loading.name = 'Watermill grain loading expansion';
    d.box(loading, 1.2, 2.25, 2.3, -2.05, 1.3, 0.5, style.wall);
    d.box(loading, 1.5, 0.15, 2.6, -2.05, 2.48, 0.5, style.roof);
    d.box(loading, 1.1, 1.5, 0.08, -2.05, 1.3, 1.69, timber);
    d.box(loading, 3.2, 0.25, 1.15, -1, 0.3, 2.35, '#a79b80');
    d.box(loading, 3.35, 0.15, 1.2, -1, 2.5, 2.35, style.roof);
    for (const x of [-2.5, 0.5]) d.rod(loading, [x, 0.4, 2.8], [x, 2.5, 2.8], 0.065, timber);
    for (const [x, z] of [
      [-2.1, 2.3],
      [-1.4, 2.5],
      [-0.75, 2.45],
    ])
      d.ball(loading, x, 0.75, z, [0.28, 0.4, 0.28], '#d8bf88');
    d.rod(loading, [-1.9, 2.6, 1.5], [-1.9, 2.6, 2.9], 0.07, timber);
    d.rod(loading, [-1.9, 2.6, 2.85], [-1.9, 1.25, 2.85], 0.025, timber);
  }
  // The millrace is excavated in the shared landscape at river level. Only
  // the axle footing and scattered bank stones belong to the building.
  for (const [x, z, scale] of [
    [3.3, -0.9, 0.23],
    [3.4, 0.9, 0.18],
    [3.65, 0.25, 0.16],
    [1.4, -1.8, 0.2],
  ])
    d.ball(root, x, 0.04, z, [scale * 1.25, scale * 0.6, scale], '#a79b80', 'rock');
  const { wheelX, axleHeight, wheelRadius } = WATERMILL_SITE;
  d.box(root, 0.4, 0.7, 0.6, 3.3, 0.2, 0, '#a79b80');
  d.rod(root, [0.8, axleHeight, 0], [3.3, axleHeight, 0], 0.12, timber);
  const wheel = d.group(root, wheelX, axleHeight, 0);
  wheel.name = 'Watermill wheel';
  const radius = wheelRadius;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    const next = angle + Math.PI / 8;
    const y = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    for (const x of [-0.4, 0.4]) {
      d.rod(wheel, [x, y, z], [x, Math.cos(next) * radius, Math.sin(next) * radius], 0.075, timber);
      if (i % 2 === 0) d.rod(wheel, [x, 0, 0], [x, y, z], 0.05, timber);
    }
    const paddle = d.box(wheel, 0.92, 0.12, 0.36, 0, y, z, style.masonry ? '#8a9586' : '#b79560');
    paddle.rotation.x = angle;
  }
  if (style.electric) {
    d.box(root, 0.5, 0.8, 0.55, 1.15, 0.6, 0.85, '#81988d');
    d.box(root, 0.16, 0.25, 0.1, 1.15, 0.8, 1.16, '#e9ce84');
  }
  if (style.streamlined || style.city) d.box(root, 3.1, 0.2, 0.7, -0.35, 2, 1.5, style.roof);
  if (style.city) {
    d.box(root, 0.9, 1.2, 0.1, 0.45, 1.2, 1.32, '#83aaa9');
    for (const x of [-1.4, 0.7]) {
      d.box(root, 0.5, 0.3, 0.5, x, 0.35, 2.2, '#adab93');
      d.ball(root, x, 0.72, 2.2, [0.4, 0.35, 0.35], '#79946e');
    }
  }
  if (style.aerial) d.rod(root, [-1, height + 1, -0.5], [-1, height + 1.8, -0.5], 0.025, '#687a77');
  if (style.tall) d.box(root, 1, 0.3, 0.8, 0.1, height + 1, -0.5, style.wall);
  if (style.solar) {
    const panel = d.box(root, 1.3, 0.07, 1.9, 0.43, height + 0.76, -0.15, '#3f6475');
    panel.rotation.z = -0.55;
  }
  d.sign(root, label, 1.65, -0.35, 1.82, 1.36);
  return root;
}
