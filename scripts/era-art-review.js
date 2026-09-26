import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
await loadFamilies(ALL_MESH_FAMILIES);
// Developer-only review surface, served by Vite; never imported by the game.
import * as THREE from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { PLOTS } from '../src/game/town/TownLayout';
import {
  renderBuilding,
  renderEraLandmark,
  renderModernization,
} from '../src/game/town/buildings/BuildingRenderer';
import { addImprovements } from '../src/game/town/TownImprovements';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { addMineWorks } from '../src/game/town/TownMineWorks';

const width = 440,
  height = 330;
const d = Object.create(TownDiorama.prototype);
d.geometries = createTownGeometries();
d.materials = new Map();
d.contactShadowMaterial = new THREE.MeshBasicMaterial();
d.sign = () => {}; // Building names are printed below the model instead.
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height - 48);
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ede7d7');
scene.add(new THREE.HemisphereLight('#fff7df', '#7f968a', 2));
const sun = new THREE.DirectionalLight('#fff0cb', 2.4);
sun.position.set(-8, 15, 10);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(34, width / (height - 48), 0.1, 400);

function buildingRoot(b, era, level) {
  const root = new THREE.Group();
  // Docks and bridge approaches depend on their real world plot coordinates.
  root.position.set(PLOTS[b.id][0], 0.08, PLOTS[b.id][1]);
  const native = b.introducedEra === era.id;
  const stage = native ? level : b.upgrades.length;
  d.town.buildings[b.id] = native ? level : b.upgrades.length;
  d.town.buildingEras[b.id] = era.id;
  d.town.buildingEraLevels[b.id] = era.id === 'frontier' ? 0 : level;
  const kind = b.kind;
  if (kind === 'bridge') {
    renderBuilding({ town: d, parent: root, kind, level: stage, label: b.name });
    renderModernization(d, root, kind, era.id, level);
  } else if (!renderEraLandmark(d, root, kind, b.name, level, era.id, stage)) {
    if (kind === 'square') buildTownSquare(d, root, stage, era.id === 'frontier');
    else if (kind === 'well') d.well(root);
    else renderBuilding({ town: d, parent: root, kind, level: stage, label: b.name });
    if (!['fisherman', 'blacksmith', 'school', 'doctor'].includes(kind))
      addImprovements(d, root, kind, stage, era.id);
    renderModernization(d, root, kind, era.id, level);
  }
  return root;
}
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ede7d7';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#294b49';
  ctx.font = '18px sans-serif';
  return [c, ctx];
}
function capture(roots, name, era, side = -1) {
  const bounds = new THREE.Box3();
  roots.forEach((root) => bounds.union(new THREE.Box3().setFromObject(root)));
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x * 0.72, size.y, size.z * 0.8, 4.5) * 1.2;
  camera.position
    .copy(center)
    .add(new THREE.Vector3(side, 0.75, 1.4).normalize().multiplyScalar(radius * 2.25));
  camera.lookAt(center);
  const heading = roots.length === 1 ? 76 : 52;
  const [strip, ctx] = canvas(width * roots.length, height + heading);
  ctx.font = '22px Georgia';
  if (roots.length === 1) {
    ctx.fillText(`${name} · ${era.yearLabel}`, 18, 30);
    ctx.font = '17px sans-serif';
    ctx.fillText(era.label, 18, 56);
  } else ctx.fillText(`${name} · ${era.yearLabel} · ${era.label}`, 18, 32);
  const stages = roots.map((root, i) => {
    scene.add(root);
    renderer.render(scene, camera);
    scene.remove(root);
    const [single, label] = canvas(width, height);
    label.drawImage(renderer.domElement, 0, 0);
    label.textAlign = 'center';
    label.font = '15px sans-serif';
    label.fillText(roots.length === 1 ? name : `${name} · Stage ${i + 1}`, width / 2, height - 28);
    label.font = '13px sans-serif';
    label.fillText(`${era.yearLabel} · ${era.label}`, width / 2, height - 9);
    ctx.drawImage(single, i * width, heading);
    d.clearGroup(root);
    return single.toDataURL('image/png');
  });
  return { comparison: strip.toDataURL('image/png'), stages };
}
window.renderEraReview = async (id) => {
  const era = ERAS.find((e) => e.id === id),
    index = ERAS.indexOf(era);
  d.town = createTown();
  d.town.era = era.id;
  const available = BUILDINGS.filter(
    (b) => ERAS.findIndex((e) => e.id === b.introducedEra) <= index,
  );
  for (const b of available) d.town.buildings[b.id] = b.upgrades.length;
  const result = { era: era.id, label: era.label, year: era.yearLabel, buildings: [] };
  const gallery = document.querySelector('#gallery');
  gallery.replaceChildren();
  for (const b of available) {
    const count = era.id === b.introducedEra ? b.upgrades.length : 3;
    const roots = Array.from({ length: count }, (_, i) => buildingRoot(b, era, i + 1));
    result.buildings.push({
      id: b.id,
      name: b.name,
      introducedEra: b.introducedEra,
      ...capture(
        roots,
        b.name,
        era,
        b.kind === 'watermill' || (era.id === 'frontier' && b.kind === 'doctor') ? 1 : -1,
      ),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const mine = new THREE.Group();
  addMineWorks(d, mine, era.id);
  result.buildings.push({
    id: 'mine',
    name: 'Mine surface works',
    ...capture([mine], 'Mine surface works', era),
  });
  for (const b of result.buildings) {
    const article = document.createElement('article'),
      img = document.createElement('img');
    img.src = b.comparison;
    img.alt = `${b.name}: all ${b.stages.length} stages in ${era.label}`;
    article.append(img);
    gallery.append(article);
  }
  window.eraReviewResult = result;
  document.querySelector('#status').textContent =
    `${result.buildings.length} buildings; ${result.buildings.reduce((n, b) => n + b.stages.length, 0)} stage images.`;
  return {
    era: id,
    buildings: result.buildings.length,
    stages: result.buildings.reduce((n, b) => n + b.stages.length, 0),
  };
};
window.downloadEraReview = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(window.eraReviewResult)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${window.eraReviewResult.era}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const select = document.querySelector('#era');
for (const era of ERAS) {
  const option = document.createElement('option');
  option.value = era.id;
  option.textContent = `${era.yearLabel} · ${era.label}`;
  select.append(option);
}
document.querySelector('#render').onclick = () => window.renderEraReview(select.value);
document.querySelector('#export').onclick = window.downloadEraReview;
document.querySelector('#status').textContent = 'Ready to render.';
window.reviewReady = true;
