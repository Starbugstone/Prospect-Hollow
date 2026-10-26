import { buildLandmark } from './TownLandmarks';
import { buildTownFlag, canvasMaterial } from './TownEmblems';
import { areasForSettlement, areaStage, areaUnlocked } from '../../data/townPersonalisation';
import { monumentWork, siteYaw } from '../../data/townLandmarks';
import { buildMonumentWorks } from './TownMonumentWorks';
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
  if (!areasForSettlement().some((area) => areaUnlocked(town, area))) return null;
  const root = d.group(d.world);
  root.name = 'Monument sites';
  root.userData.movingParts = [];
  const motions = [];
  // Monument motion is decorative: the app's reduced-motion setting holds it still.
  root.userData.sceneryUpdate = (time) => {
    for (const update of motions) update(d.reducedMotion ? 0 : time);
  };
  root.userData.static = true;
  for (const area of areasForSettlement()) {
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
      walkObstacle(g, 0, 0, area.radius, 14);
      const work = monumentWork(town, area);
      if (work) {
        g.name = `${area.id} ${slot}: ${choice} stage ${work.level} under construction`;
        buildMonumentWorks(d, g, choice, work, area, town.era);
        return;
      }
      g.name = `${area.id} ${slot}: ${choice} stage ${stage}`;
      const monument = buildLandmark(d, g, choice, stage, area.timeless);
      motions.push(monument.userData.sceneryUpdate);
      root.userData.movingParts.push(...monument.userData.movingParts);
    });
  }
  return root;
}
export function buildTownBanner(d, town) {
  const root = buildTownFlag(d, d.world, town.personalisation?.crest);
  if (!root) return null;
  root.name = 'Mine hill town banner';
  root.userData.static = true;
  const x = -3.5,
    z = PLOTS.mine[1] - 5;
  const y = mineHillsideHeight(x, z, PLOTS.mine[1], groundHeight(x, z));
  root.position.set(x, y, z);
  return root;
}
