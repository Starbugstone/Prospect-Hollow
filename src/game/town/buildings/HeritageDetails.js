import { heritageUpgrade } from '../../../data/heritageUpgrades';
import { addWindow } from './frontierParts';

const UTILITY_STYLES = {
  river: { x: -1.75, floor: 0.58, wall: '#ad725c', roof: '#526e79', trim: '#dfcba4' },
  industrial: { x: -2.1, floor: 1.42, wall: '#b0af98', roof: '#53726d', trim: '#dfcba4' },
};
const UTILITY_FEATURES = {
  pumping: 'pump room',
  hayloft: 'packing room',
  landing: 'catch packing shelter',
  freight: 'freight loading shelter',
};

// Utility services share their staged annex lifecycle, with purpose-specific
// working rooms instead of a universal ornament. Earlier plinths and annexes stay.
export function addUtilityUpgrade(d, parent, kind, industrial = false) {
  if (!['well', 'farm', 'fisherman', 'riverPort'].includes(kind)) return false;
  const purpose = heritageUpgrade(kind);
  const feature = UTILITY_FEATURES[purpose];
  if (!feature) return false;
  const p = UTILITY_STYLES[industrial ? 'industrial' : 'river'];
  const root = d.group(parent, p.x, 0, industrial ? 0 : 0.3);
  root.name = `Heritage ${purpose}`;
  root.userData.upgradeFeature = purpose;
  root.userData.utilityFeature = feature;
  if (purpose === 'pumping' || purpose === 'hayloft') {
    const bottom = p.floor;
    d.box(root, 1.08, 1.05, 1.4, 0, bottom + 0.525, 0, p.wall);
    d.box(root, 1.3, 0.15, 1.65, 0, bottom + 1.1, 0, p.roof);
    addWindow(d, root, 0, bottom + 0.58, 0.74);
    d.box(root, 0.55, 0.7, 0.1, 0, 0.5, 0.79, p.roof);
    if (!industrial) d.box(root, 1.15, 0.18, 1.5, 0, 0.13, 0, p.trim);
    if (purpose === 'pumping') {
      // The pump's outlet visibly joins the retained reservoir frame/house.
      d.rod(root, [0.3, bottom + 0.8, -0.35], [0.9, bottom + 0.8, -0.35], 0.07, p.roof);
      for (const x of [-0.3, 0.3]) {
        d.rod(root, [x, bottom + 1.15, -0.3], [x, bottom + 1.6, -0.3], 0.055, p.roof);
        d.rod(root, [x, bottom + 1.6, -0.3], [x + 0.2, bottom + 1.6, -0.3], 0.055, p.roof);
      }
    } else {
      d.box(root, 0.65, 0.85, 0.08, 0, bottom + 0.48, 0.84, '#856b4a');
      d.rod(root, [0, bottom + 1.22, 0.1], [0, bottom + 1.22, 1], 0.055, p.roof);
      d.rod(root, [0, bottom + 1.22, 0.95], [0, 0.75, 0.95], 0.018, p.roof);
    }
    return root;
  }
  const roofY = industrial ? (purpose === 'freight' ? 2.72 : 2.1) : 2.05;
  d.box(root, 1.5, 0.16, 1.65, 0, roofY, 0, p.roof);
  d.box(root, 1.5, 0.18, 1.65, 0, 0.13, 0, p.trim);
  for (const x of [-0.63, 0.63])
    for (const z of [-0.68, 0.68]) {
      d.box(root, 0.22, 0.15, 0.22, x, 0.1, z, p.trim);
      d.rod(root, [x, 0.15, z], [x, roofY, z], 0.055, p.roof);
    }
  if (purpose === 'landing') {
    const counterY = industrial ? 1.4 : 0.85;
    d.box(root, 1.2, 0.15, 0.65, 0, counterY, 0.3, '#856b4a');
    if (!industrial)
      for (const x of [-0.45, 0.45])
        for (const z of [0.1, 0.5])
          d.rod(root, [x, 0.22, z], [x, counterY - 0.075, z], 0.045, p.roof);
    for (const x of [-0.45, 0.45])
      d.box(root, 0.38, 0.3, 0.45, x, counterY + 0.225, 0.3, '#b79869');
    d.rod(root, [-0.63, 1.6, -0.68], [0.63, 1.6, -0.68], 0.035, p.roof);
    for (const x of [-0.4, 0, 0.4]) d.rod(root, [x, 1.6, -0.68], [x, 1.25, -0.68], 0.018, p.trim);
  } else {
    for (const [x, y, z] of [
      [-0.3, 0.5, 0.2],
      [0.3, 0.5, 0.2],
      [0, 1.05, 0.1],
    ]) {
      const cargoY = y + (industrial ? 1.195 : 0);
      d.box(root, 0.55, 0.55, 0.55, x, cargoY, z, '#856b4a');
      d.box(root, 0.055, 0.59, 0.59, x, cargoY, z, p.trim);
    }
  }
  return root;
}

export function addHeritageUpgrade(d, parent, kind, industrial = false) {
  if (['well', 'fisherman', 'riverPort'].includes(kind))
    return addUtilityUpgrade(d, parent, kind, industrial);
  const feature = heritageUpgrade(kind);
  if (!feature) return;
  const root = d.group(parent);
  root.name = `Heritage ${feature}`;
  root.userData.upgradeFeature = feature;
  const roof = industrial ? '#53726d' : '#526e79';
  const wall = industrial ? '#bd9678' : '#ad725c';
  const trim = '#dfcba4';
  const timber = '#856b4a';
  // The existing second-stage west wing provides a real foundation for
  // upper rooms. Ground-level additions have posts and footings of their own.
  const x = industrial ? -2.45 : -1.95;
  const base = industrial ? 2.67 : 2.5;
  function canopy(width, depth, cx, y, z, color = roof) {
    d.box(root, width, 0.14, depth, cx, y, z, color);
    for (const px of [cx - width / 2 + 0.12, cx + width / 2 - 0.12]) {
      d.box(root, 0.28, 0.18, 0.28, px, 0.1, z + depth / 2 - 0.15, trim);
      d.rod(root, [px, 0.15, z + depth / 2 - 0.15], [px, y, z + depth / 2 - 0.15], 0.06, roof);
    }
  }
  function room(color = wall) {
    d.box(root, 1.1, 1.05, 2, x, base + 0.52, 0, color);
    d.box(root, 1.4, 0.15, 2.3, x, base + 1.1, 0, roof);
    addWindow(d, root, x, base + 0.55, 1.04);
  }
  if (feature === 'veranda') {
    room();
    d.box(root, 1.5, 0.14, 1.2, x, base, 1.55, timber);
    canopy(1.6, 1.35, x, base + 1.12, 1.55);
    for (let dx = -0.65; dx < 0.7; dx += 0.22)
      d.rod(root, [x + dx, base, 2.1], [x + dx, base + 0.55, 2.1], 0.025, trim);
    d.rod(root, [x - 0.7, base + 0.55, 2.1], [x + 0.7, base + 0.55, 2.1], 0.04, trim);
  } else if (['classroom', 'clinic', 'office', 'gallery', 'dispatch'].includes(feature)) {
    room(feature === 'clinic' || feature === 'gallery' ? '#b6b39a' : wall);
    for (const z of [-0.6, 0, 0.6]) {
      d.box(root, 0.06, 0.65, 0.4, x - 0.57, base + 0.55, z, '#9bbbbb');
      d.box(root, 0.09, 0.05, 0.45, x - 0.59, base + 0.22, z, trim);
    }
    if (feature === 'gallery') {
      const light = d.box(root, 0.9, 0.08, 1.65, x, base + 1.25, 0, '#9bbbbb');
      light.rotation.z = 0.2;
      for (const z of [-0.6, 0, 0.6]) d.box(root, 0.95, 0.07, 0.05, x, base + 1.3, z, roof);
    }
    if (feature === 'clinic') {
      d.box(root, 0.12, 0.5, 0.06, x, base + 0.55, 1.12, '#538e78');
      d.box(root, 0.45, 0.12, 0.06, x, base + 0.55, 1.13, '#538e78');
    }
    if (feature === 'office')
      for (const dx of [-0.15, 0, 0.15])
        d.rod(root, [x + dx, base + 0.3, 1.14], [x + dx, base + 0.8, 1.14], 0.025, roof);
    if (feature === 'dispatch') {
      d.rod(root, [x, base + 1.1, -0.6], [x, base + 2, -0.6], 0.045, timber);
      for (const y of [base + 1.6, base + 1.9]) {
        d.rod(root, [x - 0.45, y, -0.6], [x + 0.45, y, -0.6], 0.035, timber);
        for (const dx of [-0.35, 0.35])
          d.ball(root, x + dx, y + 0.08, -0.6, [0.08, 0.1, 0.08], trim);
      }
    }
  } else if (feature === 'portico') {
    for (const px of [-0.95, 0.95]) {
      d.box(root, 0.55, 0.25, 0.65, px, 0.15, 2.35, trim);
      d.rod(root, [px, 0.25, 2.35], [px, 3.1, 2.35], 0.13, trim);
    }
    d.box(root, 2.65, 0.3, 1.1, 0, 3.15, 2.05, trim);
    for (const side of [-1, 1]) {
      const pediment = d.box(root, 1.5, 0.15, 1.15, side * 0.62, 3.53, 2.05, roof);
      pediment.rotation.z = -side * 0.42;
    }
    d.box(root, 2.7, 0.15, 1.5, 0, 0.13, 2.15, trim);
  } else if (feature === 'workshop' || feature === 'generator') {
    d.box(root, 1.15, 0.6, 2.25, x, base + 0.3, 0, wall);
    for (const z of [-0.6, 0.5]) {
      const saw = d.box(root, 1.45, 0.12, 1.3, x, base + 0.8, z, roof);
      saw.rotation.x = -0.35;
      d.box(root, 1.15, 0.45, 0.06, x, base + 0.62, z + 0.59, '#9bbbbb');
    }
    if (feature === 'generator') {
      d.box(root, 1.3, 0.2, 1.3, x, 0.15, 2, trim);
      for (const dx of [-0.35, 0.35]) {
        d.mesh(root, 'cylinder', [0.22, 1.1, 0.22], [x + dx, 0.8, 2], roof);
        for (const y of [1.3, 1.45])
          d.mesh(root, 'cylinder', [0.15, 0.09, 0.15], [x + dx, y, 2], trim);
      }
    }
  } else if (feature === 'hayloft') {
    room(timber);
    d.box(root, 0.65, 0.85, 0.06, x, base + 0.45, 1.12, '#594c37');
    d.rod(root, [x, base + 1, 0.7], [x, base + 1, 1.95], 0.07, timber);
    d.rod(root, [x, base + 1, 1.9], [x, 0.9, 1.9], 0.025, roof);
    d.box(root, 0.7, 0.7, 0.75, x, 0.4, 1.9, '#c7ac68');
  } else if (feature === 'awning') {
    canopy(3.4, 1.7, 0, 2.35, 2.25, '#d6bf8c');
    for (let px = -1.4; px <= 1.4; px += 0.55) {
      d.box(root, 0.27, 0.04, 1.7, px, 2.44, 2.25, '#748e79');
      d.box(root, 0.46, 0.55, 0.6, px, 0.35, 2.65, timber);
      d.ball(root, px, 0.75, 2.65, [0.22, 0.18, 0.2], '#b4b969');
    }
  } else if (feature === 'platform') {
    d.box(root, 3.4, 0.25, 1.5, 0, 0.16, 2.5, trim);
    canopy(3.6, 1.65, 0, 2.8, 2.4);
    for (const px of [-1, 1]) {
      d.box(root, 0.85, 0.1, 0.4, px, 0.68, 2.6, timber);
      for (const dx of [-0.3, 0.3]) d.box(root, 0.07, 0.4, 0.35, px + dx, 0.43, 2.6, roof);
    }
  } else {
    canopy(1.65, 2, x, 2.5, 1.9);
    d.box(root, 1.55, 0.22, 1.9, x, 0.14, 1.9, trim);
    if (feature === 'freight') {
      for (const [dx, y, z] of [
        [-0.35, 0.6, 2.2],
        [0.35, 0.6, 2],
        [0, 1.22, 2.1],
      ]) {
        d.box(root, 0.65, 0.62, 0.6, x + dx, y, z, timber);
        d.rod(
          root,
          [x + dx - 0.27, y - 0.26, z + 0.31],
          [x + dx + 0.27, y + 0.26, z + 0.31],
          0.025,
          trim,
        );
      }
    } else {
      d.box(root, 0.9, 0.4, 1.05, x, 0.8, 2, feature === 'engineBay' ? '#a64e3e' : timber);
      for (const dx of [-0.5, 0.5])
        for (const z of [1.6, 2.4]) d.ball(root, x + dx, 0.55, z, [0.09, 0.25, 0.25], roof);
    }
  }
  return root;
}
