import { paintBuilding } from './TownPaint';
import { buildLandmark } from './TownLandmarks';
import { Box3, CanvasTexture, DoubleSide, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { CREST_BY_ID, crestOutline, crestPattern } from '../../data/townCrests';
import { PERSONAL_AREAS, areaStage } from '../../data/townPersonalisation';
import { HONOURS } from '../../data/honours';
import { distinctionBadge } from '../../data/playerDistinctions';
import { groundHeight } from './TownLandscape';
import { mineHillsideHeight } from './TownMineHillside';
import { PLOTS } from './TownLayout';
import { walkObstacle } from './TownNavigation';

function flowerpot(d, parent, x, z, size = 1) {
  const root = d.group(parent, x, 0, z);
  root.scale.setScalar(size);
  d.mesh(root, 'cylinder', [0.24, 0.35, 0.24], [0, 0.18, 0], '#c58f73');
  d.ball(root, 0, 0.51, 0, [0.34, 0.26, 0.34], '#658c68');
  for (const [dx, dz] of [
    [-0.15, 0],
    [0.15, 0],
    [0, 0.16],
  ])
    d.ball(root, dx, 0.68, dz, 0.1, '#eddaeb');
}

// Frontage treatments use the building's measured shell, including later eras.
// They grow with upgrades, remain inside the existing plot and keep the doorway clear.
export function addBuildingChoice(d, parent, choice, level = 1) {
  if (!choice || choice === 'original') return;
  parent.userData.personalisedGeometry = true;
  parent.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(parent).applyMatrix4(parent.matrixWorld.clone().invert());
  const root = d.group(parent, 0, 0, bounds.isEmpty() ? 0 : Math.max(0, bounds.max.z - 1));
  root.name = `Town design: ${choice}`;
  const tier = Math.min(3, Math.max(1, level));
  for (const side of [-1, 1]) {
    const x = side * 2.15,
      z = 1.65;
    if (choice === 'garden' || choice === 'orchard') {
      flowerpot(d, root, x, z);
      if (tier >= 2) flowerpot(d, root, x, z - 0.8, 0.85);
      if (choice === 'orchard') {
        d.rod(root, [x, 0.2, z], [x, 1.8, z], 0.07, '#91785e');
        d.ball(root, x, 1.9, z, [0.55, 0.75, 0.55], '#8caf80');
        if (tier >= 3)
          for (const dx of [-0.25, 0.25]) d.ball(root, x + dx, 1.7, z + 0.45, 0.11, '#bd705f');
      }
    } else if (choice === 'crystal' || choice === 'sculpture') {
      d.box(root, 0.65, 0.4, 0.65, x, 0.2, z, '#ddd1b5');
      if (choice === 'crystal')
        d.ball(
          root,
          x,
          0.7,
          z,
          [0.27, 0.45 + tier * 0.12, 0.27],
          side < 0 ? '#9b91c4' : '#76b0a6',
          'rock',
        );
      else {
        d.mesh(root, 'cone', [0.3, 0.65 + tier * 0.15, 0.3], [x, 0.9, z], '#cc954f');
        d.ball(root, x, 1.4, z, 0.2, '#ddd1b5');
      }
    } else if (choice === 'artisan') {
      d.box(root, 0.7, 0.13, 0.75, x, 0.85, z, '#91785e');
      for (const dx of [-0.26, 0.26]) d.box(root, 0.07, 0.8, 0.6, x + dx, 0.4, z, '#655343');
      for (let n = 0; n < tier; n++)
        d.mesh(
          root,
          'cylinder',
          [0.11, 0.2 + n * 0.06, 0.11],
          [x - 0.23 + n * 0.23, 1.02, z],
          '#76b0a6',
        );
    } else {
      d.box(root, 0.08, 2.5, 0.08, x, 1.25, z, '#ddd1b5');
      d.box(root, 0.9, 0.12, 1.4, x, 2.55, z - 0.15, choice === 'market' ? '#bd705f' : '#658c68');
      if (tier >= 2) flowerpot(d, root, x, z + 0.3, 0.7);
      if (tier >= 3) d.box(root, 0.7, 0.12, 0.4, x, 0.5, z - 0.6, '#91785e');
    }
  }
}

export function plaqueDefinition(town, id) {
  const chosen = town.personalisation?.plaques?.[id];
  if (Object.hasOwn(town.displayHonours?.earned ?? {}, chosen) && HONOURS.byId[chosen])
    return HONOURS.byId[chosen];
  if (Object.hasOwn(town.displayDistinctions ?? {}, chosen))
    return distinctionBadge(chosen, town.displayDistinctions[chosen]);
  return null;
}
export function addBuildingPlaque(d, parent, town, id) {
  const definition = plaqueDefinition(town, id);
  if (!definition) return;
  parent.userData.personalisedGeometry = true;
  parent.updateMatrixWorld(true);
  // Stay beside the entrance at human height; building models share local +Z frontage.
  const bounds = new Box3().setFromObject(parent).applyMatrix4(parent.matrixWorld.clone().invert());
  const root = d.group(parent, -1.05, 1.5, Math.max(1.4, bounds.max.z) + 0.08);
  root.name = `Distinction plaque: ${definition.id}`;
  root.userData.distinction = definition.id;
  const metal =
    { bronze: '#bd8b58', silver: '#c8d1dc', gold: '#edc66e', diamond: '#b4e0e3' }[
      definition.metal
    ] ?? '#bfb6db';
  d.box(root, 0.72, 0.82, 0.09, 0, 0, 0, '#655343', true);
  const plate = d.box(root, 0.55, 0.62, 0.08, 0, 0, 0.07, metal, true);
  plate.name = definition.name;
  // Each family has a distinct engraving, rather than the same completion tick.
  const emblem = definition.family?.startsWith('gem-')
    ? 'crystal'
    : ({
        explorer: 'compass',
        eras: 'compass',
        stars: 'star',
        guests: 'heart',
        travels: 'sailboat',
        quartermaster: 'hammer',
      }[definition.family] ?? 'star');
  addEmblemPanel(
    d,
    root,
    { shape: 'shield', pattern: 'plain', primary: metal, secondary: '#393c43', emblem },
    0.5,
    0.6,
    [0, 0, 0.12],
    definition.art,
  );
}

function addEmblemPanel(d, root, crest, width, height, position, art) {
  const face = d.box(root, width, height, 0.035, ...position, crest.primary);
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
  ctx.strokeStyle = '#393c43';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.stroke(new Path2D(CREST_BY_ID[crest.emblem]?.path ?? CREST_BY_ID.crystal.path));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    side: DoubleSide,
    roughness: 1,
  });
  material.userData.transient = true;
  face.material = material;
  if (art) {
    const clear = () => {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath();
      ctx.arc(50, 53, 32, 0, Math.PI * 2);
      ctx.fill();
    };
    if (art.letter) {
      clear();
      ctx.fillStyle = '#393c43';
      ctx.font = 'bold 48px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(art.letter, 50, 67);
      texture.needsUpdate = true;
    } else if (art.image) {
      const picture = new Image();
      let disposed = false;
      material.addEventListener('dispose', () => {
        disposed = true;
        picture.onload = null;
      });
      picture.onload = () => {
        if (disposed) return;
        clear();
        ctx.drawImage(picture, 23, 26, 54, 54);
        texture.needsUpdate = true;
        d.render?.();
      };
      picture.src = art.image;
    }
  }
  return face;
}

export function buildPersonalAreas(d, town) {
  if (
    !PERSONAL_AREAS.some(
      (area) =>
        areaStage(town, area) &&
        town.personalisation?.areas?.[area.id]?.some((choice) => area.choices.includes(choice)),
    )
  )
    return null;
  const root = d.group(d.world);
  root.name = 'Personal town gardens';
  root.userData.static = true;
  for (const area of PERSONAL_AREAS) {
    const stage = areaStage(town, area);
    if (!stage) continue;
    area.positions.forEach(([x, z], slot) => {
      const choice = town.personalisation?.areas?.[area.id]?.[slot];
      if (!area.choices.includes(choice)) return;
      const g = d.group(root, x, groundHeight(x, z), z);
      g.name = `${area.id} ${slot}: ${choice} stage ${stage}`;
      walkObstacle(g, 0, 0, area.radius, 14);
      buildLandmark(d, g, choice, stage, area.timeless);
      if (!area.timeless) {
        paintBuilding(d, g, town.personalisation?.paint?.[area.id], town.era);
        addBuildingPlaque(d, g, town, area.id);
      }
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
  addEmblemPanel(d, g, crest, 2.3, 2.8, [1.3, 3.9, 0.04]);
  return root;
}
