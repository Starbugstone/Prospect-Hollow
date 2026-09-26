import { geometryFootprints, registerFootprints } from '../BuildingFootprints';
import { Box3 } from 'three';
import { mineAppearance, mineProfile } from '../../../data/mineEvolution';
import { mineGrowth } from '../../../data/mineGrowth';
import { MINE_POSITION, MINE_SHAFT, MINE_SITE, MINE_ACCESS } from '../../../data/mineSite';
import { railEdges } from '../TownLayout';
import { hasElectricity } from '../../../data/industrial';
import { addMineWorksBase } from './MineWorksBase';
import { MINE_FEATURES } from './MineFeatures';
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
export function updateMineGrowth(root, growth) {
  root.traverse((object) => {
    if (object.userData.mineCargo) object.count = growth.gems.length;
  });
  root.userData.growth = growth;
}

export function addMineSite(d, parent, era, growth = mineGrowth(d.mineProgress ?? 0)) {
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
  const stock = d.group(root, -7.8, 0, 3.2);
  stock.name = 'Mine yard stock';
  stock.userData.buildPhase = 4;
  for (let i = 0; i < profile.stockpile; i++) {
    const x = i * 0.45;
    if (profile.works === 'windlass' || profile.works === 'timber-a-frame')
      d.ball(stock, x, 0.22, 0, [0.28, 0.22, 0.3], '#a3957a', 'rock');
    else {
      d.box(stock, 0.4, 0.5, 0.6, x, 0.25, 0, a.frame);
      d.box(stock, 0.32, 0.06, 0.5, x, 0.53, 0, a.roof);
    }
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
  updateMineGrowth(root, growth);
  return root;
}
