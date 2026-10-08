import { buildLandmark } from './TownLandmarks';
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { CREST_BY_ID, crestOutline, crestPattern } from '../../data/townCrests';
import {
  PERSONAL_AREAS,
  areaStage,
  areaUnlocked,
  DEFAULT_EMBLEM_COLOUR,
} from '../../data/townPersonalisation';
import { siteYaw } from '../../data/townLandmarks';
import { HONOURS } from '../../data/honours';
import { distinctionBadge } from '../../data/playerDistinctions';
import { groundHeight } from './TownLandscape';
import { mineHillsideHeight } from './TownMineHillside';
import { PLOTS } from './TownLayout';
import { walkObstacle } from './TownNavigation';

export function plaqueDefinition(town) {
  const chosen = town.personalisation?.plaques?.mine;
  if (Object.hasOwn(town.displayHonours?.earned ?? {}, chosen) && HONOURS.byId[chosen])
    return HONOURS.byId[chosen];
  if (Object.hasOwn(town.displayDistinctions ?? {}, chosen))
    return distinctionBadge(chosen, town.displayDistinctions[chosen]);
  return null;
}
export function buildMinePlaque(d, town) {
  const definition = plaqueDefinition(town);
  if (!definition) return null;
  // The central rock face above the sunken entrance slopes back slightly.
  // Keep this display independent of building models and their footprint caches.
  const root = d.group(d.world, 0, 2.8, PLOTS.mine[1] - 0.56);
  root.rotation.x = -Math.atan(0.23 / 1.25);
  root.scale.setScalar(1.4);
  root.userData.static = true;
  root.name = `Distinction plaque: ${definition.id}`;
  root.userData.distinction = definition.id;
  root.userData.distinctionName = definition.name;
  const metal =
    { bronze: '#bd8b58', silver: '#c8d1dc', gold: '#edc66e', diamond: '#b4e0e3' }[
      definition.metal
    ] ?? '#bfb6db';
  d.box(root, 0.72, 0.82, 0.09, 0, 0, 0, '#655343', true);
  const plate = d.box(root, 0.55, 0.62, 0.08, 0, 0, 0.07, metal, true);
  plate.name = definition.name;
  addBadgeFace(d, root, definition, 0.52, [0, 0, 0.12]);
  return root;
}

function canvasMaterial(canvas) {
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({
    map,
    transparent: true,
    alphaTest: 0.1,
    side: DoubleSide,
    roughness: 1,
  });
  material.userData.transient = true;
  return material;
}

// The plaque shows the badge exactly as the honours list draws it.
function addBadgeFace(d, root, definition, size, position) {
  const face = d.box(root, size, size, 0.035, ...position, '#fff8e8');
  face.name = `Honour badge: ${definition.id}`;
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const material = canvasMaterial(canvas);
  face.material = material;
  let disposed = false;
  material.addEventListener('dispose', () => {
    disposed = true;
  });
  import('../../components/honours/honourBadgeImage')
    .then(({ honourBadgeImage }) => honourBadgeImage(definition, canvas.width))
    .then((picture) => {
      if (disposed) return;
      canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
      material.map.needsUpdate = true;
      d.render?.();
    })
    .catch(() => {});
}

function addEmblemPanel(d, root, crest, width, height, position, cloth = false) {
  const face = cloth
    ? new Mesh(new PlaneGeometry(width, height, 8, 10), d.material(crest.primary))
    : d.box(root, width, height, 0.035, ...position, crest.primary);
  if (cloth) {
    face.geometry.userData.owned = true;
    face.position.set(...position);
    face.userData.animated = true;
    face.layers.set(2);
    root.add(face);
  }
  face.name = `Crest emblem: ${crest.emblem}`;
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return face;
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.clip(new Path2D(crestOutline(crest.shape)));
  ctx.fillStyle = crest.primary;
  ctx.fillRect(0, 0, 100, 120);
  ctx.fillStyle = crest.secondary;
  ctx.fill(new Path2D(crestPattern(crest.pattern)));
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath();
  ctx.arc(50, 53, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(22, 25);
  ctx.scale(56 / 24, 56 / 24);
  ctx.strokeStyle = crest.emblemColour || DEFAULT_EMBLEM_COLOUR;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.stroke(new Path2D(CREST_BY_ID[crest.emblem]?.path ?? CREST_BY_ID.crystal.path));
  face.material = canvasMaterial(canvas);
  return face;
}

const STONE = '#ddd1b5';
// An open monument site: a gravel court ringed by kerb stones, survey stakes and an
// empty plinth. It reads as reserved ground; a tap on it opens the choice.
function addMonumentSite(d, g, radius) {
  const court = radius * 0.72;
  d.mesh(g, 'cylinder', [court, 0.06, court], [0, 0.03, 0], '#d8cfae');
  for (let n = 0; n < 16; n++) {
    const a = (n * Math.PI) / 8;
    const kerb = d.box(g, 1.1, 0.22, 0.45, Math.cos(a) * court, 0.11, Math.sin(a) * court, STONE);
    kerb.rotation.y = -a + Math.PI / 2;
  }
  for (let n = 0; n < 4; n++) {
    const a = Math.PI / 4 + (n * Math.PI) / 2,
      x = Math.cos(a) * court * 0.8,
      z = Math.sin(a) * court * 0.8;
    d.rod(g, [x, 0, z], [x, 1.5, z], 0.08, '#8a6a46');
    d.box(g, 0.55, 0.32, 0.04, x + 0.28, 1.32, z, '#d9734f');
  }
  d.mesh(g, 'cylinder', [1.3, 0.35, 1.3], [0, 0.18, 0], STONE);
  d.mesh(g, 'cylinder', [0.95, 0.35, 0.95], [0, 0.52, 0], '#b9ab8c');
  walkObstacle(g, 0, 0, 1.4, 1);
}

// Built monuments and the open sites of every unlocked era. Each site root carries
// `monumentSite`, so a tap on it opens that site's card, and turns the whole site
// (marker or monument) to face its declared direction.
export function buildPersonalAreas(d, town) {
  if (!PERSONAL_AREAS.some((area) => areaUnlocked(town, area))) return null;
  const root = d.group(d.world);
  root.name = 'Monument sites';
  root.userData.movingParts = [];
  const motions = [];
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  root.userData.sceneryUpdate = (time) => {
    for (const update of motions) update(reducedMotion?.matches ? 0 : time);
  };
  root.userData.static = true;
  for (const area of PERSONAL_AREAS) {
    if (!areaUnlocked(town, area)) continue;
    const stage = areaStage(town, area);
    area.positions.forEach(([x, z], slot) => {
      const choice = town.personalisation?.areas?.[area.id]?.[slot];
      const g = d.group(root, x, groundHeight(x, z), z);
      g.rotation.y = siteYaw(area);
      g.userData.monumentSite = area.id;
      if (!stage || !area.choices.includes(choice)) {
        g.name = `${area.id} ${slot}: open site`;
        addMonumentSite(d, g, area.radius);
        return;
      }
      g.name = `${area.id} ${slot}: ${choice} stage ${stage}`;
      walkObstacle(g, 0, 0, area.radius, 14);
      const monument = buildLandmark(d, g, choice, stage, area.timeless);
      motions.push(monument.userData.sceneryUpdate);
      root.userData.movingParts.push(...monument.userData.movingParts);
    });
  }
  return root;
}
export function buildTownBanner(d, town) {
  const crest = town.personalisation?.crest;
  if (!crest || !CREST_BY_ID[crest.emblem]) return null;
  const root = d.group(d.world);
  root.name = 'Mine hill town banner';
  root.userData.static = true;
  const x = -3.5,
    z = PLOTS.mine[1] - 5;
  const y = mineHillsideHeight(x, z, PLOTS.mine[1], groundHeight(x, z));
  const g = d.group(root, x, y, z);
  d.rod(g, [0, 0, 0], [0, 5.7, 0], 0.075, '#655343');
  d.rod(g, [0, 5.4, 0], [2.6, 5.4, 0], 0.055, '#655343');
  d.ball(g, 0, 5.8, 0, 0.17, '#e8bf79');
  const cloth = addEmblemPanel(d, g, crest, 2.3, 2.8, [1.3, 3.9, 0.04], true);
  const positions = cloth.geometry.attributes.position;
  // A few vertices in the existing animation loop: no textures, materials or
  // static town batches are rebuilt. The top edge stays tied to the crossbar.
  root.userData.sceneryUpdate = (time) => {
    for (let i = 0; i < positions.count; i++) {
      const drop = (1.4 - positions.getY(i)) / 2.8;
      const ripple = positions.getX(i) * 2.4 + drop * 3 - time * 1.8;
      positions.setZ(i, drop * (0.1 * Math.sin(ripple) + 0.045 * Math.sin(time * 0.9)));
    }
    positions.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
  };
  root.userData.sceneryUpdate(0);
  return root;
}
