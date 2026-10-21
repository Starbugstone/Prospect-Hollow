import { addWindow } from './frontierParts';

function addTimberLeanToRoof(d, parent) {
  const roof = d.group(parent);
  roof.name = 'Frontier timber lean-to roof';
  for (let n = 0; n < 9; n++) {
    const shingle = d.box(roof, 1.8, 0.105, 0.24, 2, 2.2, -0.96 + n * 0.24, '#937447');
    shingle.rotation.z = -0.16;
  }
  for (const z of [-1.1, 1.1]) d.rod(roof, [1.1, 2.345, z], [2.9, 2.055, z], 0.045, '#aa8454');
}

// Native timber wings stand on the ground beside the first shell. The masonry
// upper rooms belong to River & Rail, above that era's second-stage west wing.
function addFrontierCivicWing(d, parent, kind) {
  const wing = d.group(parent, 2, 0, 0);
  wing.name = `Frontier ${kind} final wing`;
  const wall = { school: '#c8b383', doctor: '#a3b4a4', blacksmith: '#a8785b' }[kind];
  d.box(wing, 1.55, 0.18, 2.1, 0, 0.13, 0, '#a99579');
  if (kind === 'blacksmith') {
    // Keep the anvil and working bench visible through the open smithy front.
    d.box(wing, 1.35, 1.85, 0.1, 0, 1.18, -0.85, wall);
    d.box(wing, 0.1, 1.05, 1.7, 0.65, 0.78, 0, wall);
    for (const x of [-0.4, 0, 0.4])
      d.rod(wing, [x, 1.35, -0.77], [x, 1.85, -0.77], 0.025, '#6d7771');
  } else {
    d.box(wing, 1.35, 1.9, 1.7, 0, 1.1, 0, wall);
    for (let row = 0; row < 10; row++) {
      const y = 0.3 + row * 0.19;
      d.box(wing, 1.37, 0.025, 0.035, 0, y, 0.87, '#bba17a');
      d.box(wing, 0.035, 0.025, 1.72, 0.69, y, 0, '#bba17a');
    }
    addWindow(d, wing, 0, 1.3, 0.9);
  }
  // Doctor and smith already have this canopy at stage two.
  if (kind === 'school') addTimberLeanToRoof(d, parent);
}

export function addCivicDetails(d, parent, kind, level) {
  if (level >= 2) {
    const extension = d.group(parent);
    extension.name = `${kind} stage 2 extension`;
    if (kind === 'school') {
      for (const x of [-0.42, 0.42]) d.box(extension, 0.12, 1.2, 0.12, x, 3.45, 0, '#c6b98e');
      d.box(extension, 1.2, 0.18, 1, 0, 4.1, 0, '#6d8982');
      d.mesh(extension, 'cone', [0.28, 0.4, 0.28], [0, 3.5, 0], '#b89c60');
    } else {
      for (const z of [-0.8, 0.8]) d.box(extension, 0.12, 2.1, 0.12, 2.5, 1.1, z, '#c6b98e');
      addTimberLeanToRoof(d, extension);
    }
  }
  if (level >= 3) addFrontierCivicWing(d, parent, kind);

  if (kind === 'blacksmith') {
    d.group(parent, -1, 3.6, -0.8).name = 'chimney';
    d.box(parent, 0.8, 3.5, 0.7, -1, 1.8, -0.8, '#8c6956');
    d.box(parent, 0.9, 0.85, 0.65, 1.7, 0.5, 0.6, '#5b625d');
    d.box(parent, 1.15, 0.2, 0.5, 1.7, 1, 0.6, '#737c76');
    d.box(parent, 0.5, 0.4, 0.12, -1, 0.55, 1.3, '#cd995a');
    if (level >= 2)
      for (let i = 0; i < level; i++)
        d.rod(
          parent,
          [-1.1 + i * 0.25, 0.6, 1.65],
          [-1.1 + i * 0.25, 1.15, 1.65],
          0.025,
          '#6d7771',
        );

    if (level >= 4)
      d.mesh(parent, 'cylinder', [0.55, 0.08, 0.55], [-2, 0.6, 0], '#9e845c').rotation.x =
        Math.PI / 2;
  }
  if (kind === 'school') {
    if (level === 1) {
      d.box(parent, 0.65, 0.55, 0.65, 0, 3.15, 0, '#c6b98e');
      d.mesh(parent, 'cone', [0.24, 0.26, 0.24], [0, 3.2, 0.4], '#b89c60');
    }
    if (level >= 2) {
      const board = d.group(parent);
      board.name = 'School chalkboard frame';
      d.box(board, 0.9, 0.7, 0.1, 1.8, 0.8, 1.6, '#50655a');
      for (const x of [1.44, 2.16]) {
        d.box(board, 0.09, 1.1, 0.09, x, 0.55, 1.51, '#856b4a');
        d.box(board, 0.21, 0.1, 0.24, x, 0.05, 1.51, '#a99579');
      }
    }
  }
  if (kind === 'doctor') {
    d.box(parent, 0.55, 0.55, 0.12, 0, 2.45, 1.42, '#e3dbc0');
    d.box(parent, 0.32, 0.09, 0.05, 0, 2.45, 1.5, '#537f74');
    d.box(parent, 0.09, 0.32, 0.05, 0, 2.45, 1.5, '#537f74');
    if (level >= 2) d.box(parent, 0.6, 0.65, 0.45, 1.9, 0.4, 0, '#889e87');
    if (level >= 3) d.box(parent, 2.8, 0.13, 1, 0, 1.9, 1.75, '#71978c');
  }
  if ((kind === 'school' || kind === 'doctor') && level >= 4) {
    d.box(parent, 1.4, 0.14, 0.9, -2, 0.1, -0.5, '#9b835e');
    for (let i = 0; i < level; i++)
      d.ball(parent, -2.5 + i * 0.25, 0.3, -0.5, [0.15, 0.18, 0.2], '#8a9b66');
  }
  if (level >= 5) d.box(parent, 2.8, 0.16, 0.2, 0, 0.22, 1.8, '#baaa87');
}
