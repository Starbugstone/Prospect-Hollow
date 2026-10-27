import {
  CircleGeometry,
  Curve,
  LatheGeometry,
  MeshStandardMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { horizonMaterial } from './TownAtmosphere';

const STONE = '#d9ceb4',
  LIGHT = '#eee4cd',
  BRONZE = '#a68151';
const WATER = '#5aabae',
  FLOW = '#9bd9d7',
  FOAM = '#e0f5ed';
const SURFACE = 0.42;

// A single smooth fountain vocabulary, cached and disposed with TownPrimitives.
// The basin profile returns down its inside wall to a recessed floor: it is a
// real open bowl, including the rolled lip, rather than a solid cylinder.
function fountainShapes(d) {
  if (d.geometries['fountain-basin']) return;
  const lathe = (name, profile) => {
    d.geometries[name] = new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      64,
    );
  };
  lathe('fountain-basin', [
    [0, 0],
    [1.38, 0],
    [1.49, 0.08],
    [1.5, 0.18],
    [1.43, 0.22],
    [1.38, 0.3],
    [1.48, 0.43],
    [1.5, 0.5],
    [1.47, 0.56],
    [1.38, 0.56],
    [1.32, 0.49],
    [1.25, 0.25],
    [0, 0.25],
  ]);
  lathe('fountain-foot', [
    [0, 0],
    [1.43, 0],
    [1.5, 0.04],
    [1.5, 0.1],
    [1.43, 0.14],
    [0, 0.14],
  ]);
  lathe('fountain-stem', [
    [0, 0.25],
    [0.3, 0.25],
    [0.32, 0.37],
    [0.2, 0.46],
    [0.14, 0.65],
    [0.18, 0.93],
    [0.28, 1.09],
    [0.31, 1.14],
    [0, 1.14],
  ]);
  lathe('fountain-cup', [
    [0, 1.08],
    [0.21, 1.08],
    [0.29, 1.17],
    [0.45, 1.3],
    [0.51, 1.45],
    [0.5, 1.51],
    [0.44, 1.53],
    [0.39, 1.46],
    [0.32, 1.3],
    [0, 1.28],
  ]);
  lathe('fountain-nozzle', [
    [0, 1.29],
    [0.12, 1.29],
    [0.12, 1.48],
    [0.08, 1.61],
    [0, 1.64],
  ]);
  d.geometries['fountain-surface'] = new CircleGeometry(1, 64).rotateX(-Math.PI / 2);
  d.geometries['fountain-ripple'] = new TorusGeometry(1, 0.025, 5, 32).rotateX(-Math.PI / 2);
  d.geometries['fountain-inlay'] = new TorusGeometry(1.445, 0.022, 6, 64).rotateX(-Math.PI / 2);
  const curve = new Curve();
  curve.getPoint = streamPoint;
  const arcs = Array.from({ length: 6 }, (_, n) =>
    new TubeGeometry(curve, 32, 0.018, 6, false).rotateY((n * Math.PI) / 3),
  );
  d.geometries['fountain-streams'] = mergeGeometries(arcs);
  arcs.forEach((geometry) => geometry.dispose());
}

function streamPoint(t, target = new Vector3()) {
  return target.set(0, 1.48 + 3.4 * t * (1 - t) - 1.06 * t, 0.37 + 0.68 * t);
}

export function buildMonumentFountain(d, parent, move, timeless = false) {
  fountainShapes(d);
  const fountain = d.group(parent, 0, 0.6, timeless ? 5.7 : 4.8);
  fountain.name = 'Monument fountain court';
  fountain.scale.setScalar(timeless ? 1 : 0.6);
  const mesh = (shape, colour, y = 0, size = [1, 1, 1]) =>
    d.mesh(fountain, shape, size, [0, y, 0], colour);
  mesh('fountain-foot', LIGHT);
  mesh('fountain-basin', STONE).name = 'Carved fountain basin';
  mesh('fountain-inlay', BRONZE, 0.39);
  mesh('fountain-surface', WATER, SURFACE, [1.295, 1, 1.295]).name = 'Fountain recessed pool';
  mesh('fountain-stem', STONE);
  mesh('fountain-cup', LIGHT).name = 'Fountain raised cup';
  mesh('fountain-surface', WATER, 1.43, [0.375, 1, 0.375]);
  mesh('fountain-nozzle', BRONZE);
  // One shared translucent surface for all six streams. It remains outside the
  // opaque scenery batch, while droplets and ripples use the actor instances.
  const key = 'monument-flowing-water';
  if (!d.materials.has(key))
    d.materials.set(
      key,
      horizonMaterial(
        new MeshStandardMaterial({
          color: FLOW,
          roughness: 0.18,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
        }),
      ),
    );
  const arcs = mesh('fountain-streams', FLOW);
  arcs.name = 'Continuous curved water streams';
  arcs.material = d.materials.get(key);
  arcs.castShadow = false;
  for (let n = 0; n < 6; n++) {
    const angle = (n * Math.PI) / 3;
    const stream = d.group(fountain);
    stream.rotation.y = angle;
    for (let bead = 0; bead < 2; bead++) {
      const droplet = d.ball(stream, 0, 0, 0, [0.035, 0.06, 0.035], FOAM);
      droplet.name = 'Fountain travelling droplet';
      move.update(droplet, (time) =>
        streamPoint((time * 0.65 + bead * 0.5 + n / 6) % 1, droplet.position),
      );
    }
    const landing = d.group(stream, 0, SURFACE, 1.05);
    d.ball(landing, 0, 0.006, 0, [0.07, 0.014, 0.07], FOAM).name = 'Fountain landing foam';
    for (let ring = 0; ring < 2; ring++) {
      const ripple = d.mesh(landing, 'fountain-ripple', [1, 1, 1], [0, 0.012, 0], FLOW);
      ripple.name = 'Fountain expanding ripple';
      move.update(ripple, (time) => {
        const phase = (time * 0.65 + ring * 0.5 + n / 6) % 1;
        ripple.scale.setScalar(0.06 + 0.17 * phase);
        // The outer ring sinks into the pool as the next ripple opens.
        ripple.position.y = 0.015 - 0.023 * phase;
      });
    }
  }
  return fountain;
}
