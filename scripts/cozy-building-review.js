import * as THREE from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderCozyBuilding } from '../src/game/town/buildings/cozy';
import { setTownAtmosphere } from '../src/game/town/TownAtmosphere';

const landmarks = [
  ['teaHouse', 'Riverside Tea House'],
  ['blossomAtelier', 'Seed & Blossom Atelier'],
  ['orchardCottages', 'Orchard Cottages'],
  ['glassworks', 'Crystal Glassworks'],
  ['springsRetreat', 'Warm Springs Retreat'],
  ['riverlightPavilion', 'Riverlight Pavilion'],
];
const views = landmarks.map(([kind, label]) => {
  const card = document.createElement('article');
  card.innerHTML = `<canvas aria-label="${label}"></canvas><h2>${label}</h2><span class="budget"></span>`;
  document.querySelector('main').append(card);
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    scene: new THREE.Scene(),
    world: new THREE.Group(),
    town: { era: 'canopy' },
  });
  d.sign = () => {};
  d.scene.add(d.world);
  setTownAtmosphere(d.scene);
  const camera = new THREE.OrthographicCamera(-9, 9, 8, -8, 0.1, 100);
  camera.position.set(14, 12, 19);
  const renderer = new THREE.WebGLRenderer({
    canvas: card.querySelector('canvas'),
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  d.scene.add(new THREE.HemisphereLight('#e1eff7', '#ba9460', 2.1));
  const sun = new THREE.DirectionalLight('#ffe3ad', 3.5);
  sun.position.set(-24, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -14,
    right: 14,
    top: 14,
    bottom: -14,
    near: 1,
    far: 100,
  });
  sun.shadow.bias = -0.0005;
  d.scene.add(sun);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: '#ded6b4', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.03;
  floor.receiveShadow = true;
  d.scene.add(floor);
  return { kind, label, card, d, renderer, camera };
});

function redraw(era = 'canopy', level = 3) {
  const results = [];
  for (const view of views) {
    const { d, renderer, camera, card, kind, label } = view;
    d.world.clear();
    d.town.era = era;
    const group = new THREE.Group();
    d.world.add(group);
    renderCozyBuilding(d, group, kind, label, Number(level), era, 3);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group),
      center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    let triangles = 0;
    const materials = new Set();
    group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      materials.add(mesh.material);
    });
    const width = card.clientWidth,
      height = card.clientHeight,
      ratio = width / height,
      span = Math.max(size.x, size.z) * 0.68 + size.y * 0.17;
    renderer.setSize(width, height, false);
    camera.left = -span;
    camera.right = span;
    camera.top = span / ratio;
    camera.bottom = -span / ratio;
    camera.lookAt(center.x, Math.max(0.8, center.y * 0.78), center.z);
    camera.updateProjectionMatrix();
    renderer.render(d.scene, camera);
    card.querySelector('.budget').textContent =
      `${triangles.toLocaleString()} triangles · ${materials.size} materials`;
    results.push({ kind, triangles, materials: materials.size, size: size.toArray() });
  }
  document.querySelector('#era-label').textContent =
    era === 'canopy' ? 'Canopy Age' : 'Riverlight Age';
  document
    .querySelectorAll('[data-era]')
    .forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.era === era)));
  window.cozyReview = { era, level: Number(level), results };
  return results;
}
document
  .querySelectorAll('[data-era]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      redraw(button.dataset.era, document.querySelector('#stage').value),
    ),
  );
document
  .querySelector('#stage')
  .addEventListener('change', (event) => redraw(window.cozyReview.era, event.target.value));
window.addEventListener('resize', () => redraw(window.cozyReview.era, window.cozyReview.level));
window.reviewCozyBuildings = redraw;
redraw();
