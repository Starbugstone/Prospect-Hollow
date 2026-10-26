import { BufferGeometry, CylinderGeometry, Float32BufferAttribute } from 'three';
import { TOWER_SHADE_FOLD, towerGallery } from '../../../../data/towerRefinements';
import { futureShape } from '../futureShapes';

function surface(d, key, points, faces) {
  if (!d.geometries[key]) {
    // Separate front/back vertices light thin metalwork correctly on both sides.
    const vertices = faces.flatMap((face) =>
      [...face, ...[...face].reverse()].map((n) => points[n]),
    );
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices.flat(), 3));
    // Keep separate face vertices and the indexed contract used by d.batch().
    geometry.setIndex(vertices.map((_, i) => i));
    geometry.setAttribute(
      'uv',
      new Float32BufferAttribute(
        vertices.flatMap(([x, , z]) => [x, z]),
        2,
      ),
    );
    geometry.computeVertexNormals();
    d.geometries[key] = geometry;
  }
  return key;
}

/** Attached upper galleries, built once from cached parts and batched normally. */
export function addTowerGallery(d, parent, s, { x = 0, z = 0, r, h }) {
  const gallery = towerGallery(s, { r, h });
  if (!gallery) return null;
  const p = s.palette,
    root = d.group(parent, x, gallery.floor, z),
    structure = d.group(root);
  root.name = `Upper gallery ${s.kind}`;
  root.userData.towerGallery = { kind: s.kind, finish: gallery.finish, style: s.style };
  structure.name = 'Retained upper gallery floor and brackets';
  structure.userData.galleryPart = 'structure';
  d.mesh(
    structure,
    futureShape(d, 'octagon'),
    [gallery.radius, r * 0.07, gallery.radius],
    [0, 0, 0],
    p[gallery.roles.edge],
  );
  const bracketShape = surface(
    d,
    'tower-gallery-bracket',
    [
      [0, -0.24, -0.18],
      [0, 0, -0.18],
      [0, 0, 0.16],
    ],
    [[0, 1, 2]],
  );
  const shadeShape = surface(
    d,
    'tower-gallery-shade',
    [
      [-0.5, 0, 0],
      [0, TOWER_SHADE_FOLD, 0],
      [0.5, 0, 0],
      [-0.5, 0, 1],
      [0, TOWER_SHADE_FOLD, 1],
      [0.5, 0, 1],
    ],
    [
      [0, 4, 1],
      [0, 3, 4],
      [1, 5, 2],
      [1, 4, 5],
    ],
  );
  const edgeShape = surface(
    d,
    'tower-gallery-shade-edge',
    [
      [-0.5, 0.007, 0.96],
      [0, TOWER_SHADE_FOLD + 0.007, 0.96],
      [0.5, 0.007, 0.96],
      [-0.5, 0.007, 1.01],
      [0, TOWER_SHADE_FOLD + 0.007, 1.01],
      [0.5, 0.007, 1.01],
    ],
    [
      [0, 4, 1],
      [0, 3, 4],
      [1, 5, 2],
      [1, 4, 5],
    ],
  );
  for (let n = 0; n < 4; n++) {
    const angle = (n * Math.PI) / 2;
    const bracket = d.mesh(
      structure,
      bracketShape,
      [r, r, r],
      [Math.sin(angle) * r, 0, Math.cos(angle) * r],
      p[gallery.roles.edge],
    );
    bracket.rotation.y = angle;
    bracket.name = 'Wall-seated gallery bracket';
    const hinge = d.group(
      root,
      Math.sin(angle) * r * 0.92,
      gallery.height,
      Math.cos(angle) * r * 0.92,
    );
    hinge.rotation.y = angle;
    hinge.name = 'Attached gallery shade hinge';
    const blade = d.mesh(
      hinge,
      shadeShape,
      [gallery.bladeWidth, r, gallery.bladeDepth],
      [0, 0, 0],
      p[gallery.roles.shade],
    );
    blade.rotation.x = -gallery.pitch;
    blade.name = 'Gallery folding shade';
    const edge = d.mesh(
      hinge,
      edgeShape,
      [gallery.bladeWidth, r, gallery.bladeDepth],
      [0, 0, 0],
      p[gallery.roles.edge],
    );
    edge.rotation.x = -gallery.pitch;
  }
  d.geometries['tower-gallery-glazing'] ??= new CylinderGeometry(1, 1, 1, 8, 1, true);
  const glazing = d.mesh(
    root,
    'tower-gallery-glazing',
    [gallery.windowRadius, gallery.windowHeight, gallery.windowRadius],
    [0, gallery.windowHeight / 2 + r * 0.025, 0],
    p.glass,
  );
  glazing.name = 'Upper gallery glazing';
  return root;
}
