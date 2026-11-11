import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOON_ROAD_LIFT, MOON_ROAD_WIDTH, moonDistrictsShown } from '../../../data/moonSettlement';
import { signalAnswered, starMap } from '../../../data/quietSignal';

// What a district adds to the Moon beyond its level ground and its lots: its ring road and
// the road from the crater, its fixed landmark, and what the landmark does once the town's
// story is told. Lots, paths and settlers come from the shared lot table as everywhere else.
const PICK_LAYER = 3;
const TAU = Math.PI * 2;
const ROAD_COLOR = '#cdcac1';
const LIGHT = '#fff3d2';
// Seconds the ribbon of light takes to cross the dust the first time.
const RIBBON_REVEAL = 7;

/** A district's ring road and its road from the crater, as one mesh in the roads' colour. */
export function districtRoads({ centre, ring, road }) {
  const half = MOON_ROAD_WIDTH / 2;
  const loop = new THREE.RingGeometry(ring - half, ring + half, 72);
  loop.translate(centre[0], -centre[1], 0);
  const [[ax, az], [bx, bz]] = road;
  const length = Math.hypot(bx - ax, bz - az);
  const lane = new THREE.PlaneGeometry(length, MOON_ROAD_WIDTH);
  // In the ring's plane: x along the road, y across it (the scene's -z once laid flat).
  lane.rotateZ(-Math.atan2(bz - az, bx - ax));
  lane.translate((ax + bx) / 2, -(az + bz) / 2, 0);
  const parts = [loop.toNonIndexed(), lane.toNonIndexed()];
  const mesh = new THREE.Mesh(
    mergeGeometries(parts),
    new THREE.MeshStandardMaterial({ color: ROAD_COLOR, roughness: 1 }),
  );
  for (const part of [loop, lane, ...parts]) part.dispose();
  mesh.name = 'District roads';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = MOON_ROAD_LIFT;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The Quiet Stone: one black slab, unlit and unfogged, so it is the same black from every
 * distance and under every light. Nothing is ever added to it.
 */
export function quietStone({ centre, stone }) {
  const [width, height, depth] = stone.size;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ color: '#000000', fog: false }),
  );
  slab.name = 'The Quiet Stone';
  slab.position.set(centre[0], height / 2, centre[1]);
  slab.rotation.y = stone.turn;
  slab.castShadow = true;
  return slab;
}

// The ribbon of light and its star map, laid flat on the district's floor. Unlit, so it
// glows the same in sun and shadow; it writes no depth and never hides a path or a pad.
function signalLight({ centre, ring, stone }) {
  const root = new THREE.Group();
  root.name = 'Ribbon of light and star map';
  root.position.set(centre[0], MOON_ROAD_LIFT + 0.03, centre[1]);
  // Local +z runs from the stone toward New Hollow, as the stone's broad side faces.
  root.rotation.y = stone.turn;
  const material = (opacity) =>
    new THREE.MeshBasicMaterial({
      color: LIGHT,
      transparent: true,
      opacity,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  const flat = (geometry) => geometry.rotateX(-Math.PI / 2);
  const length = ring - MOON_ROAD_WIDTH / 2 - stone.size[2] / 2;
  const strip = (width, opacity, name) => {
    // Its near end at the stone's foot, so scaling z draws it outward.
    const geometry = flat(new THREE.PlaneGeometry(width, 1)).translate(0, 0, 0.5);
    const mesh = new THREE.Mesh(geometry, material(opacity));
    mesh.name = name;
    mesh.position.z = stone.size[2] / 2;
    mesh.userData.length = length;
    root.add(mesh);
    return mesh;
  };
  const ribbon = strip(0.16, 1, 'Ribbon of light'),
    glow = strip(0.9, 0.2, 'Ribbon glow');
  const { stars, path } = starMap(ring);
  const dots = new THREE.InstancedMesh(
    flat(new THREE.CircleGeometry(1, 10)),
    material(0.95),
    stars.length,
  );
  dots.name = 'Star map';
  const links = new THREE.InstancedMesh(
    flat(new THREE.PlaneGeometry(1, 1)),
    material(0.45),
    Math.max(1, path.length - 1),
  );
  links.name = 'Star map path';
  // The last star on the path is ringed: wherever the path leads.
  const [endAlong, endAcross] = stars[path.at(-1)];
  const halo = new THREE.Mesh(flat(new THREE.RingGeometry(0.5, 0.58, 28)), material(0.8));
  halo.name = 'Star map destination';
  halo.position.set(endAcross, 0, endAlong + stone.size[2] / 2);
  root.add(dots, links, halo);
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    turn = new THREE.Quaternion(),
    scale = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  /** Draw the light `reach` of the way out (0 to 1), `glint` shimmering the stars. */
  const draw = (reach, time) => {
    const drawn = Math.max(0.0001, reach * length);
    ribbon.scale.z = glow.scale.z = drawn;
    ribbon.visible = glow.visible = reach > 0;
    stars.forEach(([along, across, size], n) => {
      // A star appears as the ribbon passes it, and then breathes very slowly.
      const lit = THREE.MathUtils.clamp((drawn - along) / 1.2, 0, 1),
        breath = 1 + 0.12 * Math.sin(time * 0.5 + n * 1.7);
      scale.setScalar(size * lit * breath);
      matrix.compose(position.set(across, 0, along + stone.size[2] / 2), turn.identity(), scale);
      dots.setMatrixAt(n, matrix);
    });
    dots.instanceMatrix.needsUpdate = true;
    for (let n = 0; n < path.length - 1; n++) {
      const [a0, c0] = stars[path[n]],
        [a1, c1] = stars[path[n + 1]];
      const lit = drawn >= a1 ? 1 : 0;
      const span = Math.hypot(a1 - a0, c1 - c0);
      turn.setFromAxisAngle(up, Math.atan2(c1 - c0, a1 - a0));
      scale.set(0.035 * lit, 1, span * lit);
      matrix.compose(
        position.set((c0 + c1) / 2, 0, (a0 + a1) / 2 + stone.size[2] / 2),
        turn,
        scale,
      );
      links.setMatrixAt(n, matrix);
    }
    links.instanceMatrix.needsUpdate = true;
    halo.visible = drawn >= endAlong;
  };
  return { root, draw };
}

/** The districts a Moon scene shows, kept in step with the town. */
export class MoonDistricts {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'Moon districts';
    scene.scene.add(this.root);
    this.targets = [];
    this.key = '';
    this.lights = [];
  }
  /** Whether `id` is a district's fixed landmark rather than a lot or a site. */
  landmark(id) {
    return this.targets.some((target) => target.userData.lot === id);
  }
  update(town) {
    const districts = moonDistrictsShown(town);
    const answered = signalAnswered(town);
    const key = `${districts.map(({ id }) => id)}|${answered}`;
    if (key === this.key) return;
    // The ribbon crosses the dust once, when the answer is sent while the Moon is open.
    const sent = answered && this.key !== '' && this.key.endsWith('|false');
    this.key = key;
    this.clear();
    for (const district of districts) {
      this.root.add(districtRoads(district));
      if (!district.stone) continue;
      this.root.add(quietStone(district));
      this.addTarget(district);
      if (answered) {
        const light = signalLight(district);
        light.start = sent && !this.scene.reducedMotion ? this.scene.elapsed : -Infinity;
        this.lights.push(light);
        this.root.add(light.root);
      }
    }
    this.step(this.scene.elapsed ?? 0, this.scene.reducedMotion);
  }
  // An invisible box round the stone: a tap on it answers with its label.
  addTarget({ centre, stone }) {
    const [width, height, depth] = stone.size;
    this.targetMaterial ??= new THREE.MeshBasicMaterial({ visible: false });
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(width + 1, height, depth + 1),
      this.targetMaterial,
    );
    target.position.set(centre[0], height / 2, centre[1]);
    target.rotation.y = stone.turn;
    target.layers.set(PICK_LAYER);
    target.userData.lot = stone.id;
    target.userData.landmark = true;
    target.name = `Tap target ${stone.id}`;
    this.scene.pickTargets.add(target);
    this.targets.push(target);
  }
  step(time, still = false) {
    for (const light of this.lights) {
      const reach = still ? 1 : Math.min(1, (time - light.start) / RIBBON_REVEAL);
      light.draw(reach, still ? 0 : time % (TAU * 2));
    }
  }
  clear() {
    for (const target of this.targets) {
      target.removeFromParent();
      target.geometry.dispose();
    }
    this.targets = [];
    this.lights = [];
    this.root.traverse((mesh) => {
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
    this.root.clear();
  }
  dispose() {
    this.clear();
    this.targetMaterial?.dispose();
    this.root.removeFromParent();
  }
}
