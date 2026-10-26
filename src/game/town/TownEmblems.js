import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { CREST_BY_ID, crestOutline, crestPattern } from '../../data/townCrests';
import { DEFAULT_EMBLEM_COLOUR } from '../../data/townPersonalisation';

// Personalised emblem textures belong to their model and retire with it.
export function canvasMaterial(canvas) {
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

function crestCloth(d, root, crest) {
  const face = new Mesh(new PlaneGeometry(2.3, 2.8, 8, 10), d.material(crest.primary));
  face.geometry.userData.owned = true;
  face.position.set(1.3, 3.9, 0.04);
  // Keep the owned cloth mesh out of static merging even while held still, so its
  // geometry and personalised texture retire together when the flag is replaced.
  face.userData.animated = true;
  face.layers.set(2);
  root.add(face);
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
  ctx.stroke(new Path2D(CREST_BY_ID[crest.emblem].path));
  face.material = canvasMaterial(canvas);
  return face;
}

// One flag model and crest renderer for every settlement. The caller owns placement
// and scale. A preserved flag inside a Moon monument stays still, without wind.
export function buildTownFlag(d, parent, crest, { still = false } = {}) {
  if (!crest || !CREST_BY_ID[crest.emblem]) return null;
  const root = d.group(parent);
  root.name = 'Town flag';
  d.rod(root, [0, 0, 0], [0, 5.7, 0], 0.075, '#655343');
  d.rod(root, [0, 5.4, 0], [2.6, 5.4, 0], 0.055, '#655343');
  d.ball(root, 0, 5.8, 0, 0.17, '#e8bf79');
  const cloth = crestCloth(d, root, crest);
  const positions = cloth.geometry.attributes.position;
  // Only cloth vertices change; the pole, texture and static batches stay intact.
  root.userData.sceneryUpdate = (clock) => {
    const time = still || d.reducedMotion ? 0 : clock;
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
