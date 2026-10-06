import * as THREE from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalModel } from '../src/game/town/TownAnimalModels';
import { setTownAtmosphere } from '../src/game/town/TownAtmosphere';
import { eraEvolution } from '../src/data/eras';
import { residentOutfit } from '../src/data/townWardrobes';
import { TOWN_ANIMALS } from '../src/data/townAnimals';

// Development-only review: actual production models, independent of saved towns.
const views = [];
function createView(label, container, era = 'canopy') {
  const card = document.createElement('article');
  card.innerHTML = `<canvas aria-label="${label}"></canvas><h2>${label}</h2>`;
  document.querySelector(container).append(card);
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    scene: new THREE.Scene(),
    world: new THREE.Group(),
    actors: [],
    contactShadowMaterial: new THREE.MeshBasicMaterial({
      color: '#74754d',
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
    town: { era },
  });
  d.scene.add(d.world);
  setTownAtmosphere(d.scene);
  d.scene.add(new THREE.HemisphereLight('#e1eff7', '#ba9460', 2.1));
  const sun = new THREE.DirectionalLight('#ffe3ad', 3.5);
  sun.position.set(-24, 38, 18);
  d.scene.add(sun);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: '#ded6b4', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.065;
  d.scene.add(floor);
  const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 100);
  camera.position.set(3, 2.1, 10);
  const renderer = new THREE.WebGLRenderer({
    canvas: card.querySelector('canvas'),
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const view = { d, card, camera, renderer, label };
  views.push(view);
  return view;
}

for (const [era, label] of [
  ['canopy', 'Canopy neighbors'],
  ['riverlight', 'Riverlight neighbors'],
]) {
  const { d } = createView(label, '.neighbors', era);
  const usedHair = new Set();
  for (let i = 0; i < 4; i++) {
    let seed = 0;
    for (; seed < 500; seed++) {
      const outfit = residentOutfit(eraEvolution(era), seed);
      if (outfit.variant === i % 3 && !usedHair.has(outfit.hair)) {
        usedHair.add(outfit.hair);
        break;
      }
    }
    const actor = d.person({
      color: '#738a83',
      skin: ['#d5ad88', '#8d6045', '#edc7a4', '#b07c59'][i],
      hat: '#b38d59',
      seed,
      gender: i % 2 ? 'female' : 'male',
      era,
      manual: true,
      route: [
        [0, 0],
        [0, 3],
      ],
    });
    actor.root.position.x = (i - 1.5) * 0.86;
    actor.root.rotation.y = i % 2 ? -0.13 : 0.12;
    actor.root.userData.reviewHeadwearPieces = actor.clothing.headwear.children.length;
    d.contactShadow(actor.root, 0.27, 0.18);
  }
}

for (const species of ['bluebird', 'otter', 'deer', 'hedgehog', 'willowkin']) {
  const { d } = createView(TOWN_ANIMALS[species].name, '.wildlife');
  const model = animalModel(d, species);
  model.root.rotation.y = species === 'willowkin' ? -0.08 : -0.25;
}

function render() {
  for (const { d, card, renderer, camera } of views) {
    d.world.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(d.world),
      center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3()),
      width = card.clientWidth,
      height = card.clientHeight,
      ratio = width / height,
      verticalSpan = Math.max(size.y * 0.86, (size.x / ratio) * 0.78, size.z * 0.55);
    renderer.setSize(width, height, false);
    camera.left = -verticalSpan * ratio;
    camera.right = verticalSpan * ratio;
    camera.top = verticalSpan;
    camera.bottom = -verticalSpan;
    camera.lookAt(center.x, Math.max(0.15, center.y - size.y * 0.055), center.z);
    camera.updateProjectionMatrix();
    renderer.render(d.scene, camera);
  }
}
window.addEventListener('resize', render);
window.cozyCharacterReview = {
  ready: true,
  residents: views.slice(0, 2).map(({ d }) =>
    d.world.children.map((resident) => ({
      outfit: resident.userData.residentOutfit,
      gender: resident.userData.villager.gender,
      headwearPieces: resident.userData.reviewHeadwearPieces,
    })),
  ),
  wildlife: Object.keys(TOWN_ANIMALS).filter((species) =>
    views.some(({ d }) => d.world.children.some((model) => model.userData.species === species)),
  ),
};
render();
