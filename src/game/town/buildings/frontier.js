const colors = { trim: '#e8d3a7' };
const DETAILS = {
  museum(d, parent, stage) {
    for (const x of [-1.1, 1.1]) {
      d.box(parent, 0.18, 1.8, 0.18, x, 1.05, 1.8, colors.trim);
      d.box(parent, 0.65, 0.55, 0.55, x, 0.4, 2.05, '#aa9877');
      d.ball(parent, x, 0.96, 2.05, [0.24, 0.4, 0.24], x < 0 ? '#9b80af' : '#79ab98', 'rock');
    }
    d.box(parent, 3.2, 0.16, 0.95, 0, 1.95, 1.8, '#8b9d91');
  },
  bank(d, parent, stage) {
    for (const x of [-1.1, 1.1]) d.box(parent, 0.2, 2, 0.25, x, 1.18, 1.5, '#ece0b7');
    d.box(parent, 0.72, 1.28, 0.14, 0, 0.89, 1.33, '#657783');
    d.ball(parent, 0, 1, 1.45, [0.23, 0.23, 0.06], '#e3c476');
    for (let n = 0; n < stage; n++)
      d.box(parent, 0.25, 0.16, 0.25, -0.4 + n * 0.4, 3.08, 1.25, '#edcc74');
  },
  shop(d, parent, stage) {
    for (let n = 0; n < 6; n++)
      d.box(parent, 0.48, 0.1, 1.1, -1.2 + n * 0.48, 1.8, 1.8, n % 2 ? '#f1dfb3' : '#658779');
    for (let n = 0; n < stage + 1; n++) {
      d.box(parent, 0.45, 0.45, 0.5, -1.1 + n * 0.65, 0.4, 2, '#a67c52');
      d.ball(
        parent,
        -1.1 + n * 0.65,
        0.77,
        2,
        [0.17, 0.23, 0.17],
        ['#bf7f92', '#85bca0', '#e3bc65', '#9e8ac0'][n % 4],
        'rock',
      );
    }
  },
  armory(d, parent, stage) {
    for (let n = 0; n < stage; n++) {
      d.box(parent, 0.44, 0.6, 0.6, -1 + n * 0.68, 0.5, 1.9, '#b79869', true);
      d.box(parent, 0.06, 0.64, 0.64, -1 + n * 0.68, 0.5, 1.9, '#7c8172');
    }
    if (stage >= 2) d.box(parent, 0.55, 1.1, 1.5, 1.5, 0.74, 0, '#8c9e91');
    if (stage >= 3) d.box(parent, 0.55, 1.7, 1.5, -1.5, 1.02, 0, '#8c9e91');
  },
  saloon(d, parent, stage) {
    const chimneyY = stage >= 2 ? 4.45 : 3;
    d.box(parent, 0.3, 0.8, 0.35, 0.65, chimneyY, -0.6, '#a76c53');
    d.group(parent, 0.65, chimneyY + 0.4, -0.6).name = 'chimney';
    d.box(parent, 3.1, 0.15, 0.9, 0, 0.14, 1.75, '#bca06d');
    for (const x of [-1.4, 1.4]) d.box(parent, 0.1, 1.5, 0.1, x, 0.92, 2.13, colors.trim);
    for (let n = 0; n < 8; n++) {
      const awning = d.box(
        parent,
        0.39,
        0.08,
        0.99,
        -1.36 + n * 0.39,
        1.74,
        1.72,
        n % 2 ? '#b97e5e' : '#ecdfb9',
      );
      awning.rotation.x = 0.2;
    }
  },
  farm(d, parent, stage) {
    const field = d.group(parent, 1.4, 0, 1.5);
    d.box(field, 2.4, 0.06, 1.6, 0, 0.02, 0, '#8d8050');
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 6; col++) {
        const x = -1 + col * 0.4,
          z = -0.6 + row * 0.4;
        d.rod(field, [x, 0.07, z], [x, 0.4, z], 0.025, '#798d43');
        d.ball(field, x + 0.06, 0.23, z, [0.13, 0.035, 0.06], '#92a557');
        d.ball(field, x - 0.06, 0.32, z, [0.13, 0.035, 0.06], '#afba67');
      }
  },
  home(d, parent, stage) {
    d.box(parent, 0.3, 0.8, 0.35, -0.65, stage >= 3 ? 4.3 : 2.9, -0.6, '#a76c53');
    d.group(parent, -0.65, stage >= 3 ? 4.7 : 3.3, -0.6).name = 'chimney';
    if (stage > 1) d.homeWing(parent, 4);
  },
};
export function renderFrontierBuilding(
  d,
  parent,
  id,
  stage,
  label,
  framing = false,
  details = true,
) {
  const fronts = {
    home: '#c59376',
    farm: '#a96f52',
    stable: '#b49466',
    saloon: '#ceb274',
    sheriff: '#7e9b9b',
    museum: '#c9b18a',
    armory: '#8c9e91',
    bank: '#b2af94',
    shop: '#bd977b',
    fisherman: '#8ca39a',
    blacksmith: '#a8785b',
    school: '#c8b383',
    doctor: '#a3b4a4',
  };
  const w = 2.65,
    depth = 2.4,
    h = 1.85,
    timber = framing ? '#bd9b6c' : fronts[id];
  d.box(parent, w + 0.3, 0.18, depth + 0.3, 0, 0.13, 0, '#a88c60');
  d.box(parent, w, 0.08, depth, 0, 0.26, 0, '#816b49');
  for (const x of [-w / 2, w / 2])
    for (const z of [-depth / 2, depth / 2])
      d.box(parent, 0.12, h, 0.12, x, h / 2 + 0.25, z, framing ? '#a98a5e' : colors.trim);
  for (let row = 0; row < 9; row++) {
    const y = 0.38 + row * 0.19;
    for (const x of [-w / 2, w / 2]) {
      if (!framing || row < 3) d.box(parent, 0.1, 0.175, depth, x, y, 0, timber);
    }
    for (const z of [-depth / 2, depth / 2]) {
      if (framing && row > 3) continue;
      for (const x of [-0.91, 0, 0.91]) {
        if (z > 0 && x === 0 && row < 6) continue;
        d.box(parent, 0.86, 0.175, 0.1, x, y, z, row % 3 === 0 ? '#bba17a' : timber);
      }
    }
  }
  for (const x of [-w / 2, w / 2])
    d.rod(parent, [x, h + 0.25, -depth / 2], [x, h + 0.25, depth / 2], 0.07, '#987443');
  d.rod(parent, [0, 2.95, -1.4], [0, 2.95, 1.4], 0.09, '#8d6844');
  for (const z of [-1.25, 0, 1.25]) {
    d.rod(parent, [-1.5, 2.05, z], [0, 2.95, z], 0.07, '#aa8454');
    d.rod(parent, [0, 2.95, z], [1.5, 2.05, z], 0.07, '#aa8454');
  }
  for (const side of [-1, 1])
    for (let n = 0; n < 9; n++) {
      if (framing && (n + (side === 1 ? 2 : 0)) % 3 !== 0) continue;
      const slab = d.box(
        parent,
        1.85,
        0.105,
        0.33,
        side * 0.77,
        2.5,
        -1.34 + n * 0.335,
        id === 'home' || id === 'sheriff' ? '#658580' : '#937447',
      );
      slab.rotation.z = -side * 0.54;
    }
  if (framing) return;
  for (let row = 0; row < 5; row++) {
    for (const z of [-depth / 2, depth / 2])
      d.box(parent, w * (1 - row / 5.1), 0.16, 0.1, 0, 2.1 + row * 0.165, z, timber);
  }
  d.box(parent, 0.64, 1.28, 0.09, 0, 0.89, 1.225, '#65533b', true);
  d.ball(parent, 0.2, 0.83, 1.29, 0.035, '#e3c687');
  for (const x of [-0.91, 0.91]) d.window(parent, x, 1.25, 1.27);
  const sidewindow = d.group(parent, 1.38, 0, 0);
  sidewindow.rotation.y = Math.PI / 2;
  d.window(sidewindow, 0, 1.25, 0);
  if (['saloon', 'sheriff', 'museum', 'armory', 'bank', 'shop'].includes(id)) {
    d.box(parent, w + 0.1, 0.88, 0.15, 0, 2.45, 1.28, timber);
    d.box(parent, w + 0.3, 0.12, 0.2, 0, 2.91, 1.3, colors.trim);
    d.sign(parent, label, 2.05, 0, 2.45, 1.39);
  } else d.sign(parent, label, 1.4, 0, 1.98, 1.3);
  if (details) DETAILS[id]?.(d, parent, stage);
  for (const x of [-1.3, 1.3]) d.ball(parent, x, 0.17, 1.45, [0.32, 0.18, 0.27], '#8b9e62');
}
