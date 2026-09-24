import { vipVisitor } from '../src/data/villagers';
// Local art review only; uses the same actors and construction sequence as town.
import * as THREE from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownBuildSequence } from '../src/game/town/TownBuildSequence';
import { createTown } from '../src/data/town';
const d = Object.create(TownDiorama.prototype);
Object.assign(d, {
  scene: new THREE.Scene(),
  world: new THREE.Group(),
  geometries: createTownGeometries(),
  materials: new Map(),
  contactShadowMaterial: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.12 }),
  actors: [],
  motions: [],
  town: createTown(),
});
d.scene.add(d.world);
d.scene.background = new THREE.Color('#ede7d7');
const hemi = new THREE.HemisphereLight('#fff7df', '#7f968a', 2.1),
  sun = new THREE.DirectionalLight('#fff0cb', 2.3);
sun.position.set(-4, 7, 5);
hemi.layers.enable(2);
sun.layers.enable(2);
d.scene.add(hemi, sun);
const camera = new THREE.PerspectiveCamera(34, innerWidth / (innerHeight * 0.75), 0.1, 200);
camera.layers.enable(2);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas'),
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(innerWidth, innerHeight * 0.75);
let sequence;
window.actorReview = (era = 'industrial', time = 8, close = false) => {
  sequence?.dispose();
  d.clearGroup(d.world);
  d.world = new THREE.Group();
  d.scene.add(d.world);
  d.actors = [];
  d.town.era = era;
  for (let i = 0; i < 4; i++) {
    const actor = d.person({
      color: i % 2 ? '#a47d91' : '#738a83',
      skin: '#d5ad88',
      hat: '#b38d59',
      gender: i % 2 ? 'female' : 'male',
      visitor: i >= 2,
      seed:
        i >= 2
          ? Array.from({ length: 200 }, (_, n) => n).find(
              (n) => vipVisitor(n, 0)?.gender === (i % 2 ? 'female' : 'male'),
            )
          : 0,
      route: [
        [0, 0],
        [0, 10],
      ],
      era,
    });
    d.animatePerson(actor, i >= 2 ? 1 - actor.seed : 1);
    actor.root.position.set((i - 2) * 1.7, 0.08, 0);
    actor.root.rotation.y = -0.2;
  }
  const building = d.group(d.world);
  sequence = new TownBuildSequence(d, d.world, building, {
    era,
    start: 6,
    end: 16,
    leave: 18,
    stations: [[3.5, 0]],
    focus: [3.5, 2],
  });
  sequence.frame(time);
  if (close) {
    camera.position.set(5.4, 1.7, 2.3);
    camera.lookAt(3.5, 0.9, 0);
  } else {
    camera.position.set(3.5, 3.2, 13);
    camera.lookAt(0, 0.8, 0);
  }
  renderer.render(d.scene, camera);
  return {
    gender: d.actors.map((a) => a.root.userData.villager.gender),
    names: d.actors.map((a) => a.root.userData.villager.name),
  };
};
window.actorReview();

// Three outfit examples per gender, using the exact production clothing draw.
window.vipEraReview = async (era = 'frontier', named = false) => {
  const { eraEvolution, ERA_BY_ID } = await import('../src/data/eras');
  const { vipOutfit } = await import('../src/data/townWardrobes');
  sequence?.dispose();
  sequence = null;
  d.clearGroup(d.world);
  d.world = new THREE.Group();
  d.scene.add(d.world);
  d.actors = [];
  d.town.era = era;
  document.querySelectorAll('.review-vip-tag').forEach((el) => el.remove());
  const actors = [];
  for (let i = 0; i < 6; i++) {
    const gender = i < 3 ? 'male' : 'female',
      variant = i % 3;
    const seed = Array.from({ length: 200 }, (_, n) => n).find(
      (n) => vipOutfit(eraEvolution(era), n).variant === variant,
    );
    const actor = d.person({
      manual: true,
      visitor: true,
      gender,
      seed,
      era,
      color: '#657b78',
      skin: '#d5ad88',
      hat: '#b9a778',
      route: [
        [0, 0],
        [0, 10],
      ],
    });
    d.setVillagerIdentity(actor, { gender, name: gender === 'female' ? 'Evi' : 'Scott' }, seed);
    actor.root.position.set((i - 2.5) * 1.1, 0.08, 0);
    actor.root.rotation.y = -0.22;
    actors.push(actor);
  }
  camera.position.set(0, 1.7, 6);
  camera.lookAt(0, 0.75, 0);
  camera.updateMatrixWorld();
  renderer.render(d.scene, camera);
  document.querySelector('h1').textContent =
    `${ERA_BY_ID[era].yearLabel} · ${ERA_BY_ID[era].label}`;
  document.querySelector('p').textContent =
    'Male VIP outfits 1–3 · Female VIP outfits 1–3 · Production 3D meshes';
  if (named)
    for (const actor of actors) {
      const p = actor.root.position
        .clone()
        .add(new THREE.Vector3(0, 1.5, 0))
        .project(camera);
      const rect = renderer.domElement.getBoundingClientRect(),
        label = document.createElement('span');
      label.className = 'review-vip-tag';
      label.textContent = actor.root.userData.villager.name;
      Object.assign(label.style, {
        position: 'absolute',
        left: `${rect.left + ((p.x + 1) * rect.width) / 2}px`,
        top: `${rect.top + ((1 - p.y) * rect.height) / 2}px`,
        transform: 'translate(-50%,-100%)',
        background: '#554633',
        color: '#fff0d2',
        border: '1px solid #e5c47b',
        padding: '4px 8px',
        borderRadius: '4px',
      });
      document.body.append(label);
    }
  return actors.map((a) => ({
    ...a.root.userData.villager,
    outfit: a.root.userData.outfit.variant,
  }));
};

// Matched normal/VIP comparisons: same gender, period, lighting and camera.
window.vipComparison = async (era = 'frontier', gender = 'female', variant = 0, named = false) => {
  const { eraEvolution, ERA_BY_ID } = await import('../src/data/eras');
  const { vipOutfit } = await import('../src/data/townWardrobes');
  sequence?.dispose();
  sequence = null;
  d.clearGroup(d.world);
  d.world = new THREE.Group();
  d.scene.add(d.world);
  d.actors = [];
  d.town.era = era;
  document.querySelectorAll('.review-vip-tag').forEach((el) => el.remove());
  const seed = Array.from({ length: 200 }, (_, n) => n).find(
    (n) => vipOutfit(eraEvolution(era), n).variant === variant,
  );
  const actors = [false, true].map((visitor, i) => {
    const actor = d.person({
      manual: true,
      visitor,
      gender,
      seed,
      era,
      color: gender === 'female' ? '#a47d91' : '#738a83',
      skin: '#d5ad88',
      hat: '#b9a778',
      route: [
        [0, 0],
        [0, 10],
      ],
    });
    if (visitor)
      d.setVillagerIdentity(actor, { gender, name: gender === 'female' ? 'Evi' : 'Scott' }, seed);
    actor.root.position.set(i ? 0.8 : -0.8, 0.08, 0);
    actor.root.rotation.y = -0.22;
    return actor;
  });
  camera.position.set(0, 1.45, 3.65);
  camera.lookAt(0, 0.75, 0);
  camera.updateMatrixWorld();
  renderer.render(d.scene, camera);
  document.querySelector('h1').textContent =
    `${ERA_BY_ID[era].yearLabel} · ${ERA_BY_ID[era].label}`;
  document.querySelector('p').textContent =
    `${gender === 'female' ? 'Female' : 'Male'} · Normal villager (left) / VIP outfit ${variant + 1} (right)`;
  if (named) {
    const actor = actors[1],
      p = actor.root.position
        .clone()
        .add(new THREE.Vector3(0, 1.5, 0))
        .project(camera);
    const rect = renderer.domElement.getBoundingClientRect(),
      label = document.createElement('span');
    label.className = 'review-vip-tag';
    label.textContent = actor.root.userData.villager.name;
    Object.assign(label.style, {
      position: 'absolute',
      left: `${rect.left + ((p.x + 1) * rect.width) / 2}px`,
      top: `${rect.top + ((1 - p.y) * rect.height) / 2}px`,
      transform: 'translate(-50%,-100%)',
      background: '#554633',
      color: '#fff0d2',
      border: '1px solid #e5c47b',
      padding: '4px 8px',
      borderRadius: '4px',
    });
    document.body.append(label);
  }
  return actors.map((a) => ({
    ...a.root.userData.villager,
    outfit: a.root.userData.outfit?.variant ?? null,
  }));
};
