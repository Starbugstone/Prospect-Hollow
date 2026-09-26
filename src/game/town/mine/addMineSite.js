import { geometryFootprints, registerFootprints } from '../BuildingFootprints';
import { Box3, Color, InstancedMesh, Matrix4 } from 'three';
import { mineAppearance, mineProfile } from '../../../data/mineEvolution';
import { mineGrowth } from '../../../data/mineGrowth';
import {
  MINE_POSITION,
  MINE_SHAFT,
  mineYardEnvelope,
  MINE_SITE,
  MINE_ACCESS,
} from '../../../data/mineSite';
import { railEdges } from '../TownLayout';
import { hasElectricity } from '../../../data/industrial';
import { addMineWorksBase } from './MineWorksBase';
import { MINE_FEATURES, mineSurfaceHeight } from './MineFeatures';
import { addMineHaul } from './MineRollingStock';

export function addMinePortal(d, root, profile, appearance) {
  const entry = d.group(
    root,
    0,
    MINE_SHAFT.portalFloor - 0.08,
    MINE_SHAFT.portalZ - MINE_POSITION[1],
  );
  entry.name = `Mine portal ${profile.portal}`;
  entry.userData.buildPhase = 1;
  const timber = profile.portal === 'timber',
    wall = timber ? '#aa8053' : appearance.wall;
  for (const x of [-1.25, 1.25]) d.box(entry, 0.3, 2.35, 0.48, x, 1.18, 0, wall);
  d.box(entry, timber ? 2.85 : 3.15, 0.3, 0.6, 0, 2.36, 0, wall);
  if (!timber) {
    d.box(entry, 0.34, 0.45, 0.08, 0, 2.32, 0.35, '#d3c7a4');
    if (profile.heritage.includes('keystone-1884')) {
      const plaque = d.box(entry, 0.42, 0.23, 0.06, 0, 2.37, 0.42, '#bdac82');
      plaque.name = '1884 keystone';
      d.sign?.(entry, '1884', 0.42, 0, 2.37, 0.45);
    }
    for (const x of [-1.25, 1.25]) d.box(entry, 0.14, 0.28, 0.1, x, 1.7, 0.3, '#f5d38c');
  }
  if (
    ['stepped-cream', 'ribbon-control', 'glazed-tower', 'solar-industrial'].includes(profile.portal)
  ) {
    d.box(entry, 3.7, 0.16, 1.1, 0, 2.55, 0.25, appearance.roof);
    d.box(
      entry,
      profile.portal === 'glazed-tower' ? 1.6 : 2.5,
      0.5,
      0.5,
      0,
      2.92,
      0,
      appearance.wall,
    );
    if (profile.portal !== 'stepped-cream') d.box(entry, 2.1, 0.3, 0.06, 0, 2.95, 0.28, '#517a86');
  }
  return entry;
}
export function updateMineGrowth(d, root, growth) {
  const veins = root.userData.veins;
  if (!veins) return;
  const matrix = new Matrix4(),
    color = new Color();
  for (const vein of growth.veins) {
    const column = vein.segmentIndex % 9,
      x = -4.5 + column * 0.52 + vein.seamIndex * 0.12,
      z = -21.3 - vein.seamIndex * 0.52;
    matrix.makeScale(0.12, 0.075, 0.26);
    matrix.setPosition(x, mineSurfaceHeight(x, z) + 0.1, z - MINE_POSITION[1]);
    veins.setMatrixAt(vein.segmentIndex, matrix);
    veins.setColorAt(vein.segmentIndex, color.set(vein.colour));
  }
  if (veins.count !== growth.veins.length && d.frameCache) d.frameCache.valid = false;
  veins.count = growth.veins.length;
  veins.instanceMatrix.needsUpdate = true;
  if (veins.instanceColor) veins.instanceColor.needsUpdate = true;
  root.userData.growth = growth;
}
export function addMineSite(d, parent, era, growth = mineGrowth(d.mineStage ?? 0)) {
  const profile = mineProfile(era),
    a = mineAppearance(era),
    root = addMineWorksBase(d, parent, era),
    motions = [root.userData.hoistUpdate];
  root.userData.profile = profile;
  addMinePortal(d, root, profile, a);
  const conditions = {
    railway: !!railEdges(d.town ?? { era, buildings: {} }).length,
    electricity: hasElectricity(d.town ?? { buildings: {}, buildingEras: {} }),
  };
  // A stub is admitted only when its complete envelope clears the main approach.
  conditions.railway &&= MINE_SITE.stub.every(
    ([, z]) => z - 0.45 > MINE_ACCESS.railZ + MINE_ACCESS.railApproachHalfWidth,
  );
  for (const definition of profile.site) {
    const entry = typeof definition === 'string' ? { feature: definition } : definition;
    const key = entry.requires && !conditions[entry.requires] ? entry.substitute : entry.feature;
    const build = MINE_FEATURES[key];
    if (!build) continue;
    const feature = d.group(root);
    feature.name = `Mine feature ${key}`;
    feature.userData.buildPhase = key === 'upper-terrace' ? 0 : 3;
    build(d, feature, a, motions, profile);
  }
  const veins = new InstancedMesh(d.geometries.rock, d.material('#ffffff'), 54);
  veins.name = 'Mine hillside chapter veins';
  veins.userData.navigationExclude = true;
  veins.frustumCulled = false;
  root.add(veins);
  root.userData.veins = veins;
  updateMineGrowth(d, root, growth);
  const e = mineYardEnvelope(),
    stock = d.group(root, e.maxX - 0.8, 0, e.maxZ - 0.65 - MINE_POSITION[1]);
  stock.name = `Mine stockpile ${growth.stockpile}`;
  stock.userData.buildPhase = 4;
  const count = growth.stockpile + 1;
  for (let i = 0; i < count; i++) {
    const x = -i * 0.45,
      height = 0.3 + i * 0.14;
    if (['frontier', 'river-rail'].includes(profile.key))
      d.ball(
        stock,
        x,
        height / 2,
        0,
        [0.32, height / 2, 0.34],
        profile.key === 'frontier' ? '#a3957a' : '#8e9990',
        'rock',
      );
    else {
      d.box(stock, 0.42, height, 0.65, x, height / 2, 0, a.frame);
      d.box(
        stock,
        0.34,
        0.06,
        0.52,
        x,
        height + 0.02,
        0,
        growth.extraStock ? '#9ab3ad' : '#aa987c',
      );
      if (profile.key === 'contemporary')
        d.box(stock, 0.46, 0.07, 0.7, x, height + 0.09, 0, a.roof);
    }
  }
  if (growth.aditLights)
    for (const x of [-2.8, -0.8])
      d.box(root, 0.1, 0.2, 0.1, x, mineSurfaceHeight(x, -26.5) + 1.5, -6.5, '#f0d998');
  if (growth.lampsAndBins)
    for (const x of [-6.9, -5.9]) {
      d.box(root, 0.5, 0.5, 0.5, x, 0.3, 3.4, a.frame);
      d.rod(root, [x, 0, 2.6], [x, 2.6, 2.6], 0.04, a.frame);
      d.ball(root, x, 2.7, 2.6, 0.13, '#efce86');
    }
  if (growth.plaque) {
    const plaque = d.box(root, 0.65, 0.35, 0.1, -2.1, 0.5, 1.8, '#d8bd76');
    plaque.name = 'Completed campaign plaque';
  }
  const haulRoot = d.group(root, -MINE_POSITION[0], -0.08, -MINE_POSITION[1]);
  haulRoot.userData.animated = true;
  haulRoot.userData.buildPhase = 4;
  motions.push(addMineHaul(d, haulRoot, profile));
  root.userData.mineUpdate = (time) => motions.forEach((motion) => motion(time));
  root.userData.mineUpdate(0);
  root.traverse((object) => {
    if (object.userData.animated) object.traverse((part) => part.layers.set(2));
  });
  // Animated machinery reserves its complete swept envelope once, not per frame.
  const allMotions = motions;
  const dynamic = new Map();
  root.traverse((node) => {
    if (node.userData.animated) {
      let ancestor = node.parent;
      while (ancestor && ancestor !== root) {
        if (ancestor.userData.animated) return;
        ancestor = ancestor.parent;
      }
      dynamic.set(node, null);
    }
  });
  for (let frame = 0; frame <= 32; frame++) {
    allMotions.forEach((motion) => motion(frame / 2));
    root.updateMatrixWorld(true);
    for (const [node, bounds] of dynamic) {
      const box = new Box3().setFromObject(node);
      if (bounds) bounds.union(box);
      else dynamic.set(node, box);
    }
  }
  const solids = geometryFootprints(root);
  root.updateWorldMatrix(true, false);
  for (const bounds of dynamic.values()) {
    bounds.applyMatrix4(root.matrixWorld.clone().invert());
    solids.push({
      shape: 'rect',
      cx: (bounds.min.x + bounds.max.x) / 2,
      cz: (bounds.min.z + bounds.max.z) / 2,
      halfW: (bounds.max.x - bounds.min.x) / 2,
      halfD: (bounds.max.z - bounds.min.z) / 2,
      yMin: bounds.min.y,
      yMax: bounds.max.y,
      rotation: 0,
    });
  }
  root.userData.mineUpdate(0);
  registerFootprints(root, solids, { owner: 'mine-site', activation: 'completed' });
  return root;
}
