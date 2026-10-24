import { cityAppearance } from '../../../data/cityAppearance';
import { addCityFinish } from './CityBuildingDetails';

const SITES = {
  radio: { width: 3.4, depth: 2.6, z: 1.2 },
  concert: { width: 5.6, depth: 4.2, z: -0.4 },
  television: { width: 4.7, depth: 4.1, z: 0 },
  skyline: { width: 4.3, depth: 3.3, z: 0 },
};

export function addCityLandmarkDetails(
  d,
  parent,
  family,
  era,
  level,
  structureLevel = level,
  modernizing = false,
  kind = family,
) {
  const site = SITES[family];
  if (!site) return;
  const a = cityAppearance(era),
    root = d.group(parent);
  root.name = `${family} period architecture`;
  if (a.modern) {
    d.box(root, site.width, 0.2, site.depth + 0.4, 0, 0.12, site.z, a.wall);
    d.box(root, site.width - 0.3, 1.65, 0.75, 0, 0.99, site.z + site.depth / 2, '#85b8c8');
    d.box(root, site.width + 0.2, 0.18, 1.05, 0, 1.93, site.z + site.depth / 2, a.roof);
    for (const x of [-site.width * 0.4, 0, site.width * 0.4])
      d.box(root, 0.1, 1.8, 0.85, x, 1.02, site.z + site.depth / 2, a.wall);
  }
  let module, structure;
  if (structureLevel >= 2) {
    const x = -site.width / 2 - 0.8;
    const wing = d.group(root);
    wing.userData.buildingPart = 'sideWing';
    d.box(wing, 1.6, 2.6, 3, x, 1.4, site.z, a.wall);
    d.box(wing, 0.9, 1.15, 0.06, x, 1.2, site.z + 1.18, '#85b8c8');
    d.box(wing, 1.8, 0.16, 3.2, x, 2.78, site.z, a.roof).name = 'Landmark wing roof';
    module = addCityFinish(d, root, kind, era, level, structureLevel, {
      base: 2.92,
      appearance: { ...a, width: site.width + 0.4 },
    });
    // The wing already has its authored z; only its attached purpose room moves.
    module.children.forEach((group) =>
      group.children.forEach((part) => {
        if (part !== wing) part.position.z += site.z;
      }),
    );
    structure = module.children.find((part) => part.userData.modulePart === 'structure');
    if (a.solar) {
      const roof = module.getObjectByName('Purpose equipment cowl');
      for (const z of [-0.65, 0, 0.65])
        d.box(module, 1.05, 0.04, 0.45, x, roof.position.y + 0.09, site.z + z, '#526f79').name =
          'Landmark wing roof solar strip';
    }
  }
  if (structureLevel >= 3) {
    const front = site.z + site.depth / 2 + 1,
      target = structure ?? root;
    d.box(target, site.width, 0.2, 1.4, 0, 2.7, front, a.roof);
    for (const x of [-site.width * 0.4, site.width * 0.4])
      d.rod(target, [x, 0.1, front], [x, 2.7, front], 0.1, a.wall);
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
    d.box(root, 0.6, 1.2, 0.35, site.width / 2 + 0.2, 0.75, site.z + 1.2, a.roof);
    d.box(root, 0.46, 0.6, 0.05, site.width / 2 + 0.2, 0.94, site.z + 1.4, '#85b8c8');
  }
}
