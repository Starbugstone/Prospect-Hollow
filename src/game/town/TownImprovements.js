// Improvements are additions to the original buildings, keeping their identity.
export function addScaffolding(d, parent, kind, stage, progress) {
  if (kind === 'horseField' || kind === 'airport') {
    const halfWidth = kind === 'airport' ? 10.5 : 3.3;
    const halfDepth = kind === 'airport' ? 21 : 2.9;
    for (const x of [-halfWidth, halfWidth]) {
      for (const z of [-halfDepth, halfDepth]) d.box(parent, 0.1, 1.3, 0.1, x, 0.65, z, '#b39160');
      d.rod(parent, [x, 1, -halfDepth], [x, 1, halfDepth], 0.035, '#b39160');
    }
    return;
  }
  if (kind === 'square') {
    for (const x of [-2.6, 2.6])
      for (const z of [-2.5, 2.5]) d.box(parent, 0.12, 0.55, 0.12, x, 0.28, z, '#b39160');
    return;
  }
  const narrow = kind === 'well',
    left = kind === 'home' && stage > 1 ? -2.75 : narrow ? -1.25 : -1.75;
  const right = narrow ? 1.25 : 1.75,
    depth = narrow ? 1.15 : 1.5;
  const height = stage >= 2 ? 4.25 : 3.3;
  for (const x of [left, right]) {
    for (const z of [-depth, depth]) {
      d.box(parent, 0.085, height, 0.085, x, height / 2, z, '#9a754c');
      d.box(parent, 0.2, 0.1, 0.2, x, 0.08, z, '#a98f68');
    }
    for (const y of [1.25, 2.6, ...(height > 4 ? [3.8] : [])]) {
      d.box(parent, 0.5, 0.09, depth * 2 + 0.3, x, y, 0, '#c2a16b');
      d.rod(parent, [x, y + 0.45, -depth], [x, y + 0.45, depth], 0.025, '#b18b56');
    }
    d.rod(parent, [x, 0.15, -depth], [x, 2.5, depth], 0.036, '#9e794c');
    d.rod(parent, [x, 0.15, depth], [x, 2.5, -depth], 0.036, '#9e794c');
  }
  // The entrance stays open beneath a high front crossbar.
  d.rod(parent, [left, height - 0.2, depth], [right, height - 0.2, depth], 0.06, '#9e794c');
  for (const x of [right - 0.21, right + 0.21])
    d.rod(parent, [x, 0.06, depth + 0.5], [x, 2.65, depth], 0.035, '#ae8755');
  for (let n = 0; n < 9; n++)
    d.rod(
      parent,
      [right - 0.21, 0.18 + n * 0.28, depth + 0.48 - n * 0.052],
      [right + 0.21, 0.18 + n * 0.28, depth + 0.48 - n * 0.052],
      0.028,
      '#c6a16d',
    );
  for (let n = 0; n < 5 - progress; n++)
    d.box(parent, 0.16, 0.08, 1.1, right + 0.35, 0.1 + n * 0.08, -0.6, '#c9a576');
  d.box(parent, 0.38, 0.3, 0.38, left, 1.47, 0.35, '#81978d', true);
}

function balcony(d, parent, y, width = 3.0) {
  d.box(parent, width, 0.13, 0.8, 0, y, 1.65, '#bba074');
  for (let i = 0; i <= 10; i++)
    d.box(parent, 0.04, 0.5, 0.04, -width / 2 + (i * width) / 10, y + 0.3, 2, '#e1cf9e');
  d.box(parent, width + 0.08, 0.065, 0.075, 0, y + 0.57, 2, '#d8c298');
  for (const x of [-width / 2 + 0.08, width / 2 - 0.08])
    d.box(parent, 0.1, y, 0.1, x, y / 2, 1.95, '#e1cf9e');
}
function upperRoom(d, parent, color) {
  d.box(parent, 2.65, 1.12, 2.35, 0, 3.08, 0, color);
  for (const y of [2.56, 3.62]) d.box(parent, 2.85, 0.12, 2.5, 0, y, 0, '#e0c89c');
  for (const x of [-0.85, 0.85]) d.window(parent, x, 3.12, 1.21);
  for (const side of [-1, 1]) {
    const roof = d.box(parent, 1.65, 0.12, 2.7, side * 0.72, 3.99, 0, '#648880');
    roof.rotation.z = -side * 0.38;
  }
}
function tower(d, parent, x, color, windmill = false) {
  const g = d.group(parent, x, 0, -0.65);
  for (const dx of [-0.38, 0.38])
    for (const z of [-0.38, 0.38]) d.rod(g, [dx * 1.3, 0, z * 1.3], [dx, 3.5, z], 0.055, '#927449');
  for (const y of [1.2, 2.4, 3.4]) {
    d.box(g, 0.95, 0.1, 0.95, 0, y, 0, '#b09a71');
    for (const z of [-0.4, 0.4]) d.rod(g, [-0.4, y - 1.1, z], [0.4, y, z], 0.03, '#997949');
  }
  if (windmill) {
    const rotor = d.group(g, 0, 4, 0.2);
    for (let n = 0; n < 8; n++) {
      const arm = d.group(rotor);
      arm.rotation.z = (n * Math.PI) / 4;
      d.rod(arm, [0, 0, 0], [0, 1, 0], 0.025, '#8a8e7b');
      const blade = d.box(arm, 0.3, 0.55, 0.04, 0.07, 0.83, 0, '#aeb7a5');
      blade.rotation.z = -0.15;
    }
    d.ball(rotor, 0, 0, 0.08, 0.13, '#c6b47f');
    d.batch(rotor);
    // Add the moving rotor after static building meshes have been merged.
    return {
      rotor,
      update: (time) => {
        rotor.rotation.z = time * 0.55;
      },
    };
  }
  d.mesh(g, 'cylinder', [0.65, 1.05, 0.65], [0, 3.8, 0], color);
  for (const y of [3.35, 3.75, 4.22])
    d.mesh(g, 'cylinder', [0.665, 0.055, 0.665], [0, y, 0], '#777b69');
  d.mesh(g, 'cone', [0.73, 0.32, 0.73], [0, 4.48, 0], '#68867d');
  return null;
}
export function addImprovements(d, parent, kind, stage) {
  if (stage < 2 || kind === 'square') return null;
  if (stage >= 4) {
    for (const x of [-1.15, 1.15]) {
      d.box(parent, 0.8, 0.5, 0.65, x, 0.3, 2.5, '#b69c70');
      d.ball(parent, x, 0.7, 2.5, [0.5, 0.35, 0.4], '#81996a');
      for (const dx of [-0.22, 0, 0.22]) d.ball(parent, x + dx, 0.96, 2.5, 0.14, '#edbd89');
      d.rod(parent, [x * 1.35, 0, -1.5], [x * 1.35, 3.5, -1.5], 0.05, '#c3a476');
      d.box(parent, 0.65, 0.9, 0.045, x * 1.35, 2.9, -1.5, '#9fbca3');
    }
  }
  if (stage >= 5) {
    // A broad timber entrance pergola changes the silhouette even from the overview.
    for (const x of [-1.65, 1.65]) {
      d.box(parent, 0.15, 2.3, 0.15, x, 1.15, 2.6, '#e1cf9e');
      d.box(parent, 0.35, 0.25, 0.35, x, 2.35, 2.6, '#c9b27d');
    }
    d.box(parent, 3.65, 0.22, 0.8, 0, 2.5, 2.6, '#71988a');
    for (const x of [-1.2, -0.6, 0, 0.6, 1.2])
      d.box(parent, 0.12, 0.13, 1.1, x, 2.67, 2.6, '#e1cf9e');
  }
  if (kind === 'well') {
    d.rod(parent, [1, 0.15, 0.55], [1, 1.45, 0.55], 0.085, '#608985');
    d.rod(parent, [1, 1.3, 0.55], [1.6, 1.3, 0.55], 0.04, '#608985');
    d.box(parent, 0.8, 0.45, 0.6, 1.35, 0.25, 0.55, '#bfa477');
    if (stage >= 3) tower(d, parent, -1.15, '#b59767');
  } else if (kind === 'home') {
    if (stage >= 3) {
      upperRoom(d, parent, '#cda185');
      balcony(d, parent, 2.6);
    }
  } else if (kind === 'saloon') {
    upperRoom(d, parent, '#c6a56b');
    balcony(d, parent, 2.6);
    if (stage >= 3) {
      d.box(parent, 3.25, 0.7, 0.15, 0, 4.22, 1.35, '#c2a16a');
      d.box(parent, 3.5, 0.12, 0.25, 0, 4.6, 1.35, '#e2c990');
      for (const x of [-1.45, 1.45]) {
        d.mesh(parent, 'cylinder', [0.3, 0.45, 0.3], [x, 0.42, 2.15], '#a88053');
        d.box(parent, 0.72, 0.07, 0.65, x, 0.69, 2.15, '#dbc394');
        d.ball(parent, x, 2.14, 2.04, [0.1, 0.18, 0.1], '#efce81');
      }
    }
  } else if (kind === 'farm') {
    d.mesh(parent, 'cylinder', [0.43, 1.5, 0.43], [1.85, 0.8, -0.7], '#b3b7a0');
    d.mesh(parent, 'cone', [0.49, 0.42, 0.49], [1.85, 1.7, -0.7], '#768d81');
    if (stage >= 3) return tower(d, parent, -1.6, '#b6a279', true);
  } else if (kind === 'sheriff') {
    const annex = d.group(parent, 1.65, 0, -0.15);
    d.box(annex, 0.85, 1.8, 1.9, 0, 1, 0, '#869f9a');
    d.box(annex, 1.05, 0.14, 2.1, 0, 1.97, 0, '#64877e');
    for (const x of [-0.25, 0, 0.25]) d.box(annex, 0.04, 0.55, 0.06, x, 1.3, 0.99, '#555e54');
    d.ball(parent, 0, 3.08, 1.35, [0.22, 0.22, 0.055], '#e5bf73', 'rock');
    if (stage >= 3) {
      const watch = d.group(parent, 0, 2.9, -0.2);
      for (const x of [-0.65, 0.65])
        for (const z of [-0.65, 0.65]) d.box(watch, 0.1, 1.25, 0.1, x, 0.55, z, '#d7c399');
      d.box(watch, 1.65, 0.15, 1.65, 0, 1.27, 0, '#65857d');
      for (const z of [-0.65, 0.65]) d.box(watch, 1.35, 0.35, 0.09, 0, 0.26, z, '#91a396');
    }
  } else if (kind === 'stable') {
    const shed = d.group(parent, 1.8, 0, -0.1);
    for (const z of [-0.85, 0.85]) {
      d.box(shed, 0.09, 1.6, 0.09, 0.65, 0.85, z, '#b19566');
      d.box(shed, 1.2, 0.7, 0.08, 0, 0.6, z, '#b19566');
    }
    d.box(shed, 1.55, 0.1, 2.1, 0, 1.73, 0, '#738b7c');
    if (stage >= 3) {
      const cart = d.group(parent, -1.5, 0, 1.4);
      d.box(cart, 0.9, 0.55, 1.5, 0, 0.58, 0, '#8b9b86');
      for (const x of [-0.55, 0.55])
        for (const z of [-0.5, 0.5])
          d.rod(cart, [x - 0.06, 0.35, z], [x + 0.06, 0.35, z], 0.34, '#756043');
      d.box(cart, 1.05, 0.15, 1.7, 0, 1.1, 0, '#dacba5');
    }
  } else if (kind === 'museum') {
    for (const x of [-1.5, 1.5]) {
      d.box(parent, 0.18, 2.8, 0.18, x, 1.5, 1.8, '#e3d4ad');
      d.ball(parent, x, 3.12, 1.8, [0.18, 0.28, 0.18], '#a994b9', 'rock');
    }
    if (stage >= 3) {
      d.box(parent, 1, 1.3, 1, 0, 3.4, -0.1, '#c4b18b');
      d.mesh(parent, 'cone', [0.84, 0.6, 0.84], [0, 4.32, -0.1], '#718e82');
      d.ball(parent, 0, 3.52, 0.43, [0.3, 0.3, 0.035], '#ebdec0');
      d.rod(parent, [0, 3.52, 0.48], [0, 3.72, 0.48], 0.018, '#827451');
    }
  } else if (kind === 'bank') {
    d.box(parent, 1.1, 2.1, 2.4, 1.75, 1.1, -0.2, '#9caeaa');
    d.box(parent, 1.3, 0.18, 2.6, 1.75, 2.24, -0.2, '#d6ccad');
    if (stage >= 3) {
      upperRoom(d, parent, '#b2af94');
      for (const x of [-0.85, 0.85]) d.box(parent, 0.1, 0.7, 0.08, x, 3.12, 1.28, '#617c77');
    }
  } else if (kind === 'shop') {
    for (const x of [-1.55, 1.55]) d.box(parent, 0.12, 1.9, 0.12, x, 0.95, 2.05, '#e0c89c');
    d.box(parent, 3.5, 0.15, 1.4, 0, 2, 1.75, '#8fb399');
    if (stage >= 3) {
      upperRoom(d, parent, '#bd977b');
      balcony(d, parent, 2.6);
    }
  } else if (kind === 'armory' && stage >= 3) {
    d.box(parent, 2.7, 0.65, 1.7, 0, 3.05, -0.3, '#8b9e8e');
    d.box(parent, 2.95, 0.15, 1.95, 0, 3.46, -0.3, '#607d72');
  }
  return null;
}
