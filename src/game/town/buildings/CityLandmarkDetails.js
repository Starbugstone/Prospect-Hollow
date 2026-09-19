import { cityAppearance } from '../../../data/cityAppearance';

const SITES = {
  radio: { width: 3.4, depth: 2.6, z: 1.2 },
  concert: { width: 5.6, depth: 4.2, z: -0.4 },
  television: { width: 4.7, depth: 4.1, z: 0 },
  skyline: { width: 4.3, depth: 3.3, z: 0 },
};

// Architecture is fitted to each landmark's own footprint, with period materials.
export function addCityLandmarkDetails(d, parent, family, era, level) {
  const site = SITES[family];
  if (!site) return;
  const a = cityAppearance(era);
  const root = d.group(parent);
  root.name = `${family} period architecture`;
  if (a.modern) {
    // A glazed public foyer renews the retained mast, auditorium or tower.
    d.box(root, site.width, 0.2, site.depth + 0.4, 0, 0.12, site.z, a.wall);
    d.box(root, site.width - 0.3, 1.65, 0.75, 0, 0.99, site.z + site.depth / 2, '#85b8c8');
    d.box(root, site.width + 0.2, 0.18, 1.05, 0, 1.93, site.z + site.depth / 2, a.roof);
    for (const x of [-site.width * 0.4, 0, site.width * 0.4])
      d.box(root, 0.1, 1.8, 0.85, x, 1.02, site.z + site.depth / 2, a.wall);
  }
  if (level >= 2) {
    const x = -site.width / 2 - 0.45;
    d.box(root, 1.1, 1.8, 2.3, x, 1, site.z, a.wall);
    d.box(root, 0.9, 1.15, 0.06, x, 1.2, site.z + 1.18, '#85b8c8');
    d.box(root, 1.3, 0.16, 2.55, x, 1.98, site.z, a.roof);
    if (a.solar)
      for (const z of [-0.65, 0, 0.65])
        d.box(root, 1.05, 0.04, 0.45, x, 2.09, site.z + z, '#526f79');
  }
  if (level >= 3)
    for (const side of [-1, 1]) {
      const x = side * (site.width / 2 + 0.35),
        z = site.z + site.depth / 2 + 0.65;
      d.rod(root, [x, 0.1, z], [x, 2.7, z], 0.055, a.roof);
      if (a.globeLights) d.ball(root, x, 2.75, z, [0.16, 0.19, 0.16], '#e5bc77');
      else d.box(root, 0.6, 0.1, 0.3, x, 2.75, z, '#e5bc77');
    }
  if (a.solar) {
    // A freestanding information terminal sits alongside the public entrance.
    d.box(root, 0.6, 1.2, 0.35, site.width / 2 + 0.2, 0.75, site.z + 1.2, a.roof);
    d.box(root, 0.46, 0.6, 0.05, site.width / 2 + 0.2, 0.94, site.z + 1.4, '#85b8c8');
  }
}
