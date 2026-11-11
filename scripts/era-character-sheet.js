import * as THREE from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalModel } from '../src/game/town/TownAnimalModels';
import { setTownAtmosphere } from '../src/game/town/TownAtmosphere';
import { ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { townFauna } from '../src/data/townAnimals';
import { villagerBody } from '../src/data/villagers';

// Development-only review: each era's production villagers and animals in a line.
// `?eras=frontier,aviation` picks the eras; `?cast=animals` shows the animals instead.
const query = new URLSearchParams(location.search);
const eras = (query.get('eras') ?? 'frontier,aviation,skysail,stargazer').split(',');
const cast = query.get('cast') ?? 'people';
const SKINS = ['#d5ad88', '#8d6045', '#edc7a4', '#b07c59', '#c99d74', '#9e7559'];
const views = [];

function createView(label, era) {
  const card = document.createElement('article');
  card.innerHTML = `<canvas aria-label="${label}"></canvas><h2>${label}</h2>`;
  document.querySelector('main').append(card);
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    scene: new THREE.Scene(),
    world: new THREE.Group(),
    actors: [],
    motions: [],
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
    new THREE.PlaneGeometry(60, 30),
    new THREE.MeshStandardMaterial({ color: '#ded6b4', roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.065;
  d.scene.add(floor);
  const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 100);
  camera.position.set(2.2, 1.9, 10);
  const renderer = new THREE.WebGLRenderer({
    canvas: card.querySelector('canvas'),
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(2);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const view = { d, card, camera, renderer };
  views.push(view);
  return view;
}

// Seeds chosen so each line shows both genders and all three ages.
function lineUp(count = 12) {
  const wanted = ['adult', 'adult', 'child', 'adult', 'elder', 'adult'];
  const seeds = [];
  for (let seed = 1; seeds.length < count && seed < 4000; seed++) {
    const slot = seeds.length;
    const female = seed % 2 === 1;
    if (female !== (slot % 2 === 1)) continue;
    if (villagerBody(seed, true).age !== wanted[slot % wanted.length]) continue;
    seeds.push(seed);
  }
  return seeds;
}

const summary = {};
for (const era of eras) {
  const label = `${ERA_BY_ID[era].yearLabel} · ${ERA_BY_ID[era].label}`;
  const { d } = createView(label, era);
  if (cast === 'people') {
    summary[era] = lineUp().map((seed, i) => {
      const actor = d.person({
        color: '#738a83',
        skin: SKINS[i % SKINS.length],
        hat: '#b38d59',
        seed,
        era,
        manual: true,
        styled: true,
        route: [
          [0, 0],
          [0, 3],
        ],
      });
      actor.root.position.x = (i - 5.5) * 0.74;
      actor.root.rotation.y = i % 2 ? -0.28 : 0.24;
      d.contactShadow(actor.root, 0.27, 0.18);
      let meshes = 0,
        triangles = 0;
      actor.root.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      });
      return { seed, ...villagerBody(seed, true), meshes, triangles };
    });
  } else {
    const fauna = townFauna(eraEvolution(era));
    const species = [
      'dog',
      'cat',
      'hen',
      'fox',
      'raccoon',
      ...fauna.birds.map((b) => b.species),
      ...fauna.garden,
      ...(fauna.companions ? [fauna.companions.species] : []),
    ];
    // `?species=dog,cat` narrows the line; each species shows `?each=` individuals.
    const only = query.get('species')?.split(',');
    const shown = only ? species.filter((name) => only.includes(name)) : species;
    const each = Number(query.get('each') ?? 4);
    summary[era] = shown;
    let x = 0;
    for (const name of shown)
      for (let n = 0; n < each; n++) {
        const model = animalModel(d, name, n);
        model.root.position.x = x;
        model.root.rotation.y = -0.55;
        x += name.startsWith('willowkin') ? 1.3 : 1.05;
      }
  }
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
      span = Math.max(size.y * 0.72, (size.x / ratio) * 0.54);
    renderer.setSize(width, height, false);
    camera.left = -span * ratio;
    camera.right = span * ratio;
    camera.top = span;
    camera.bottom = -span;
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();
    renderer.render(d.scene, camera);
  }
}
window.addEventListener('resize', render);
render();
window.eraCharacterSheet = { ready: true, summary };
