import { Box3, BufferGeometry, Float32BufferAttribute, Mesh, Raycaster, Vector3 } from 'three';
import { cityAppearance } from '../../../data/cityAppearance';
import { heritageUpgrade } from '../../../data/heritageUpgrades';

// Repairs shared authored pieces at their real surfaces. Geometry remains inside
// the existing building envelope and uses its existing material palette.
function roofHeight(root, x, z, ceiling = 20) {
  root.updateWorldMatrix(true, true);
  const ray = new Raycaster(
    root.localToWorld(new Vector3(x, ceiling, z)),
    new Vector3(0, -1, 0).transformDirection(root.matrixWorld),
  );
  const hit = ray.intersectObject(root, true)[0];
  return hit ? root.worldToLocal(hit.point.clone()).y : null;
}

export function supportCityModel(d, root, appearance = null) {
  // Binary catalogs merge parts by material, so a mesh named for a canopy may
  // contain the roof too. Probe the actual surface instead of its merged bounds.
  if (appearance?.detail === 'billboard' && appearance.modern) {
    const part = {
      center: new Vector3(0, appearance.height + 1, -0.5),
      size: new Vector3(2, 0.9, 0.16),
    };
    part.box = new Box3().setFromCenterAndSize(part.center, part.size);
    const roofTop = roofHeight(root, 0, -0.5, part.box.min.y - 0.01);
    if (roofTop == null) return root;
    const metal = appearance.roof;
    const bottom = roofTop + 0.12;
    const top = part.box.min.y + 0.04;
    d.box(
      root,
      part.size.x * 0.8,
      0.13,
      0.26,
      part.center.x,
      roofTop + 0.065,
      part.center.z,
      metal,
    ).name = 'Roof billboard curb';
    for (const x of [part.center.x - part.size.x * 0.32, part.center.x + part.size.x * 0.32])
      d.box(
        root,
        0.14,
        Math.max(0.08, top - bottom),
        0.14,
        x,
        (bottom + top) / 2,
        part.center.z,
        metal,
      ).name = 'Roof billboard stanchion';
    d.box(
      root,
      1.55,
      0.62,
      0.025,
      part.center.x,
      part.center.y,
      part.box.max.z + 0.015,
      metal,
    ).name = 'Retail sign face';
    for (let n = 0; n < 3; n++)
      d.box(
        root,
        1.1 - n * 0.18,
        0.045,
        0.02,
        part.center.x,
        part.center.y + 0.2 - n * 0.2,
        part.box.max.z + 0.04,
        '#ddd1ae',
      ).name = 'Retail sign graphic';
  }
  if (!root.getObjectByName('Auditorium')) return root;
  // The concert kit has five independent fins, merged into one material mesh.
  // Each strip's top follows its real sloping underside and its bottom seats on
  // the auditorium, so no support cubes protrude through the acoustic roof.
  for (let n = 0; n < 5; n++) {
    const x = -2.25 + n * 1.12,
      left = x - 0.44,
      right = x + 0.44;
    const base = roofHeight(root, x, -0.4, 3.05);
    const a = roofHeight(root, left, -0.4),
      b = roofHeight(root, right, -0.4);
    if (base == null || a == null || b == null) continue;
    const key = `concert-clerestory-${n}`;
    if (!d.geometries[key]) {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
          [
            left,
            base - 0.02,
            -2.1,
            right,
            base - 0.02,
            -2.1,
            right,
            base - 0.02,
            1.3,
            left,
            base - 0.02,
            1.3,
            left,
            a - 0.19,
            -2.1,
            right,
            b - 0.19,
            -2.1,
            right,
            b - 0.19,
            1.3,
            left,
            a - 0.19,
            1.3,
          ],
          3,
        ),
      );
      geometry.setIndex([
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3,
        0, 4, 3, 4, 7,
      ]);
      // All TownPrimitives geometry shares this attribute contract when merged
      // by material. The clerestory has no texture, but still needs UV slots.
      geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(16), 2));
      geometry.computeVertexNormals();
      d.geometries[key] = geometry;
    }
    d.mesh(root, key, [1, 1, 1], [0, 0, 0], '#85b8c8').name = 'Acoustic roof clerestory';
  }
  return root;
}

export function purposeModule(d, parent, feature, moduleLevel, finishLevel, component) {
  const root = d.group(parent);
  root.userData.purposeModule = {
    feature: feature ?? 'service',
    role: 'purposeModule',
    level: moduleLevel,
    finishLevel,
    component,
  };
  root.userData.upgradeFeature = feature ?? 'service';
  return root;
}
export function modulePart(d, parent, part) {
  const root = d.group(parent);
  root.name = `Purpose ${part}`;
  root.userData.modulePart = part;
  return root;
}

// Operating hardware occupies the mature module's reserved, supported cowl.
// The purpose chooses machinery; era palettes only restyle it.
export function addModuleOperation(
  d,
  parent,
  feature,
  x,
  y,
  z,
  width,
  depth,
  roof,
  wall,
  grade = 3,
) {
  const root = modulePart(d, parent, 'operation');
  root.name = `${feature ?? 'service'} operating equipment`;
  const improved = grade >= 3;
  if (improved) {
    if (feature === 'pumping') {
      d.box(root, width * 0.95, 0.1, depth * 0.8, x, y + 0.05, z, roof);
      for (const side of [-1, 1])
        d.mesh(
          root,
          'cylinder',
          [width * 0.19, 0.65, width * 0.19],
          [x + side * width * 0.23, y + 0.375, z],
          wall,
        ).name = 'Working filtration vessel';
      d.box(root, width * 0.65, 0.1, 0.1, x, y + 0.6, z + depth * 0.22, roof);
    } else if (feature === 'generator') {
      d.box(root, width * 0.9, 0.48, depth * 0.75, x, y + 0.24, z, wall);
      for (const side of [-1, 1])
        d.mesh(
          root,
          'cylinder',
          [0.07, 0.7, 0.07],
          [x + side * width * 0.23, y + 0.4, z - depth * 0.18],
          roof,
        ).name = 'Generator exhaust';
      d.box(root, width * 0.65, 0.22, 0.05, x, y + 0.27, z + depth * 0.39, '#85b8c8');
    } else if (['awning', 'freight', 'carriage'].includes(feature)) {
      d.box(root, width * 0.9, 0.3, depth * 0.8, x, y + 0.15, z, roof);
      for (const side of [-1, 1]) {
        const roller = d.mesh(
          root,
          'cylinder',
          [0.14, width * 0.72, 0.14],
          [x, y + 0.32, z + side * depth * 0.24],
          wall,
        );
        roller.rotation.z = Math.PI / 2;
        roller.name = 'Working canopy roller';
      }
    } else if (['dispatch', 'studio', 'auditorium', 'computers', 'research'].includes(feature)) {
      d.box(root, width * 0.9, 0.4, depth * 0.7, x, y + 0.2, z, wall);
      d.box(root, width * 0.65, 0.25, 0.05, x, y + 0.23, z + depth * 0.37, '#85b8c8');
      d.rod(root, [x, y + 0.4, z], [x, y + 0.95, z], 0.035, roof);
      d.box(root, width * 0.85, 0.06, 0.08, x, y + 0.85, z, roof).name =
        'Working communications aerial';
    } else {
      d.box(root, width * 0.9, 0.45, depth * 0.75, x, y + 0.225, z, '#85b8c8').name =
        'Daylight and ventilation monitor';
      d.box(root, width, 0.1, depth * 0.9, x, y + 0.5, z, roof);
      for (const side of [-1, 1])
        d.box(root, 0.06, 0.45, 0.07, x + side * width * 0.3, y + 0.225, z + depth * 0.39, wall);
    }
    return root;
  }
  const w = width * (improved ? 0.8 : 0.6),
    h = improved ? 0.3 : 0.2,
    dep = depth * (improved ? 0.7 : 0.5);
  if (['pumping', 'generator'].includes(feature)) {
    d.box(root, w, h, dep, x, y + h / 2, z, roof);
    for (const dx of [-0.22, 0.22])
      d.box(
        root,
        width * 0.25,
        h * 0.75,
        0.08,
        x + dx * width,
        y + h / 2,
        z + dep / 2 + 0.03,
        '#85b8c8',
      );
  } else if (['awning', 'freight', 'carriage'].includes(feature)) {
    d.box(root, w, h, dep, x, y + h / 2, z, roof);
    for (const dz of [-0.18, 0.18])
      d.box(root, width * 0.72, 0.11, depth * 0.18, x, y + 0.18, z + dz * depth, wall);
  } else {
    d.box(root, w, h, dep, x, y + h / 2, z, roof);
    for (const dy of [0.35, 0.75])
      d.box(root, width * 0.65, 0.05, 0.07, x, y + h * dy, z + dep / 2 + 0.02, '#85b8c8');
  }
  return root;
}

function addTowerClock(d, parent, x, y, z, roof, wall, grade) {
  const root = modulePart(d, parent, 'operation');
  root.name = 'Working service clock';
  const radius = grade >= 3 ? 0.34 : 0.22,
    rise = grade >= 3 ? 0.62 : 0.4;
  d.box(root, 0.8, 0.1, 0.55, x, y + 0.05, z, roof);
  d.box(root, 0.12, rise, 0.12, x, y + rise / 2, z, wall);
  const rim = d.mesh(root, 'cylinder', [radius, 0.1, radius], [x, y + rise, z], roof);
  rim.rotation.x = Math.PI / 2;
  const face = d.mesh(
    root,
    'cylinder',
    [radius * 0.84, 0.035, radius * 0.84],
    [x, y + rise, z + 0.065],
    '#e5bc77',
  );
  face.rotation.x = Math.PI / 2;
  d.box(root, 0.035, radius * 0.7, 0.025, x, y + rise + radius * 0.2, z + 0.092, roof);
  d.box(root, radius * 0.65, 0.035, 0.025, x + radius * 0.2, y + rise, z + 0.092, roof);
}

function addOccupiedBalcony(d, structure, parent, x, base, roof, wall, grade) {
  const deckTop = base + 0.08;
  d.box(structure, 1.35, 0.12, 0.85, x, base + 0.02, 1.35, roof).name = 'Occupied balcony deck';
  for (const side of [-1, 1]) {
    d.box(structure, 0.08, 0.55, 0.85, x + side * 0.635, deckTop + 0.275, 1.35, '#9cbbb5');
    d.rod(
      structure,
      [x + side * 0.5, base - 0.45, 0.9],
      [x + side * 0.5, base - 0.04, 1.65],
      0.045,
      wall,
    ).name = 'Balcony wall bracket';
  }
  d.box(structure, 1.27, 0.55, 0.08, x, deckTop + 0.275, 1.735, '#9cbbb5').name = 'Balcony parapet';
  const operation = modulePart(d, parent, 'operation');
  operation.name = 'Occupied terrace seating';
  const improved = grade >= 3;
  d.box(
    operation,
    improved ? 0.9 : 0.65,
    improved ? 0.36 : 0.3,
    0.34,
    x - 0.12,
    deckTop + (improved ? 0.18 : 0.15),
    1.19,
    wall,
  ).name = 'Terrace bench';
  if (improved) {
    d.box(operation, 0.9, 0.4, 0.1, x - 0.12, deckTop + 0.56, 1.04, roof).name =
      'Terrace bench back';
    d.box(operation, 0.1, 0.48, 0.1, x + 0.46, deckTop + 0.24, 1.5, wall);
    d.box(operation, 0.3, 0.08, 0.35, x + 0.46, deckTop + 0.52, 1.5, roof).name =
      'Terrace working table';
  }
}

// Extract only the authored entrance canopy, even when the catalog merged its
// material with a roof or wall. Its one slab and columns become the arcade;
// adding a second slab above them would be an incoherent paid upgrade.
function takeRetailCanopy(
  d,
  parent,
  target,
  appearance,
  spec = { x: 0, y: 2, z: 2, width: appearance.width + 0.5, depth: 1.2 },
) {
  const meshes = [];
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  parent.traverse((part) => {
    if (part.isMesh) meshes.push(part);
  });
  let found = false;
  for (const part of meshes) {
    const transform = inverse.clone().multiply(part.matrixWorld);
    const source = part.geometry,
      positions = source.attributes.position,
      keep = [],
      take = [];
    const indices = source.index?.array ?? Array.from({ length: positions.count }, (_, n) => n);
    const point = new Vector3();
    for (let n = 0; n < indices.length; n += 3) {
      const triangle = [indices[n], indices[n + 1], indices[n + 2]];
      const belongs = triangle.every((index) => {
        point.fromBufferAttribute(positions, index).applyMatrix4(transform);
        const slab =
          Math.abs(point.y - spec.y) <= 0.1 && Math.abs(point.z - spec.z) <= spec.depth / 2 + 0.01;
        const column =
          point.y >= 0.14 &&
          point.y <= spec.y + 0.01 &&
          Math.abs(point.z - spec.z - 0.35) < 0.08 &&
          Math.abs(Math.abs(point.x - spec.x) - (spec.width / 2 - 0.15)) < 0.09;
        return slab || column;
      });
      (belongs ? take : keep).push(...triangle);
    }
    if (!take.length) continue;
    const subset = (list, key, world) => {
      if (d.geometries[key]) return d.geometries[key];
      const geometry = new BufferGeometry();
      for (const [name, attribute] of Object.entries(source.attributes)) {
        const values = [];
        for (const index of list)
          for (let k = 0; k < attribute.itemSize; k++)
            values.push(attribute.array[index * attribute.itemSize + k]);
        geometry.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize));
      }
      geometry.setIndex(Array.from({ length: list.length }, (_, n) => n));
      if (world) {
        geometry.applyMatrix4(transform);
        const p = geometry.attributes.position;
        for (let n = 0; n < p.count; n++)
          if (spec.y === 2 && p.getY(n) >= 1.9 && p.getZ(n) < 2.6)
            p.setZ(n, p.getZ(n) - (0.15 * (2.6 - p.getZ(n))) / 1.2);
        geometry.computeVertexNormals();
      }
      d.geometries[key] = geometry;
      return geometry;
    };
    const key = `purpose-arcade:${appearance.asset}:${source.uuid}`;
    const canopy = new Mesh(subset(take, `${key}:canopy`, true), part.material);
    canopy.name = 'Retained single arcade canopy';
    canopy.castShadow = canopy.receiveShadow = true;
    target.add(canopy);
    if (keep.length) part.geometry = subset(keep, `${key}:hall`, false);
    else part.removeFromParent();
    found = true;
  }
  return found;
}

export function addCityFinish(d, parent, kind, era, level = 3, moduleLevel = level, layout = {}) {
  const a = { ...cityAppearance(era, kind), ...layout.appearance },
    feature = heritageUpgrade(kind);
  const arcade = ['awning', 'freight', 'carriage', 'portico'].includes(feature);
  const tower = ['engineBay', 'platform'].includes(feature);
  const root = purposeModule(
    d,
    parent,
    feature,
    moduleLevel,
    level,
    tower ? 'serviceTower' : arcade ? 'arcade' : 'upperStorey',
  );
  root.name = `City ${feature ?? 'service'} completion ${level}`;
  const structure = modulePart(d, root, 'structure');
  // The wing is part of this one mature service module, never an accumulated
  // second module. Reparenting preserves all authored geometry and fittings.
  const wing = parent.children.find((child) => child.userData.buildingPart === 'sideWing');
  if (wing) structure.add(wing);
  const width = a.width ?? 3.65,
    x = -width / 2 - 0.6;
  const base = layout.base ?? 2.145;
  const occupied = ['veranda', 'terrace'].includes(feature) && !arcade && !tower;
  let machinery;
  if (arcade) {
    const retail = feature === 'awning';
    const span = retail ? width + 0.5 : Math.min(width + 0.1, 4.6),
      z = 1.9;
    const y = feature === 'portico' ? 3.4 : retail ? 2 : 2.8;
    const retained = retail && takeRetailCanopy(d, parent, structure, a);
    if (feature === 'carriage' && a.parking) {
      const retired = d.group(root);
      takeRetailCanopy(d, parent, retired, a, {
        x: a.parking[0],
        y: 2.4,
        z: 2.2,
        width: 2.2,
        depth: 1.2,
      });
      retired.removeFromParent();
    }
    if (!retained) {
      d.box(structure, span, 0.15, 1.15, 0, y, z, a.roof).name = 'Completed service canopy';
      for (const px of [-span / 2 + 0.12, span / 2 - 0.12]) {
        if (feature === 'carriage') {
          // The carriage forecourt is occupied by the retained parked vehicle.
          // Wall brackets carry its shelter without a column through the car.
          d.rod(structure, [px, y - 0.4, 1.35], [px, y - 0.075, z + 0.35], 0.05, a.wall).name =
            'Carriage shelter wall bracket';
        } else
          d.box(structure, 0.09, y, 0.09, px, y / 2, z + 0.43, a.wall).name =
            'Service canopy column';
      }
    }
    {
      const frontage = modulePart(d, root, 'frontage');
      for (const side of [-1, 1])
        d.box(
          frontage,
          0.1,
          level >= 2 ? y - 0.22 : y * 0.55,
          0.9,
          side * (span / 2 - 0.15),
          y / 2,
          retail ? 1.95 : 1.8,
          level >= 2 ? '#9cbbb5' : a.roof,
        ).name = 'Glazed working arcade bay';
    }
    machinery = { x: span * 0.22, y: y + (retail ? 0.09 : 0.075), z: 1.75, width: 0.9, depth: 0.8 };
  } else if (tower) {
    d.box(structure, 1.1, 2.3, 1.2, x, 1.22, 1.55, a.wall).name = 'Retained service control tower';
    d.box(structure, 1.3, 0.16, 1.4, x, 2.45, 1.55, a.roof).name = 'Service tower roof';
    {
      const frontage = modulePart(d, root, 'frontage');
      d.box(
        frontage,
        level >= 2 ? 0.85 : 0.75,
        level >= 2 ? 1.25 : 0.95,
        0.1,
        x,
        1.35,
        2.19,
        level >= 2 ? '#9cbbb5' : a.roof,
      ).name = 'Working service control frontage';
      d.box(
        frontage,
        0.1,
        level >= 2 ? 0.8 : 0.55,
        0.8,
        x - 0.57,
        1.6,
        1.55,
        level >= 2 ? '#9cbbb5' : a.roof,
      );
    }
    machinery = { x, y: 2.53, z: 1.55, width: 1.1, depth: 1.2, height: 0.75 };
  } else {
    // The established second-stage wing is the foundation, including when an
    // earlier era's completed structure is retained during modernization.
    d.box(structure, 1.1, 0.24, 2, x, base - 0.12, 0.1, a.wall).name = 'Service room footing';
    const height = 0.85;
    d.box(structure, 1.04, height, 1.8, x, base + height / 2, 0.1, a.wall).name =
      'Attached upper service room';
    d.box(structure, 1.35, 0.15, 2.15, x, base + height + 0.075, 0.1, a.roof).name =
      'Service room roof';
    if (a.solar) {
      // Refit the wing's existing photovoltaic strips onto the new room roof.
      // Move instances, preserving their count and geometry, instead of burying
      // an operational roof fitting inside the paid extension.
      parent.updateWorldMatrix(true, true);
      const inverse = parent.matrixWorld.clone().invert();
      parent.traverse((part) => {
        if (!part.isMesh || !/^Solar canopy strip/.test(part.name)) return;
        const box = new Box3().setFromObject(part).applyMatrix4(inverse);
        const delta = base + height + 0.68 - box.min.y;
        const from = part.parent.worldToLocal(parent.localToWorld(new Vector3()));
        const to = part.parent.worldToLocal(parent.localToWorld(new Vector3(0, delta, 0)));
        part.position.add(to.sub(from));
        part.name = 'Retained service roof solar strips';
      });
    }
    {
      const frontage = modulePart(d, root, 'frontage');
      d.box(
        frontage,
        level >= 2 ? 0.88 : 0.75,
        level >= 2 ? 0.65 : 0.45,
        0.1,
        x,
        base + 0.45,
        1.04,
        level >= 2 ? '#9cbbb5' : a.roof,
      ).name = 'Service room glazing';
      d.box(
        frontage,
        0.08,
        level >= 2 ? 0.55 : 0.4,
        level >= 2 ? 1.2 : 0.95,
        x - 0.54,
        base + 0.45,
        0.1,
        level >= 2 ? '#9cbbb5' : a.roof,
      );
    }
    machinery = { x, y: base + height + 0.15, z: 0.1, width: 1.2, depth: 2 };
  }
  // This supported, open-front cowl is present with the mature structure at
  // every finish. Later equipment fits inside it, keeping the envelope fixed.
  const m = machinery,
    hoodHeight = m.height ?? 0.4;
  for (const side of [-1, 1])
    d.box(
      structure,
      0.08,
      hoodHeight,
      m.depth,
      m.x + side * (m.width / 2 - 0.04),
      m.y + hoodHeight / 2,
      m.z,
      a.wall,
    );
  d.box(
    structure,
    m.width + 0.15,
    0.12,
    m.depth + 0.15,
    m.x,
    m.y + hoodHeight + 0.06,
    m.z,
    a.roof,
  ).name = 'Purpose equipment cowl';
  if (tower) {
    // A flush, framed control band replaces the dark notch and loose stacked
    // slabs. Its full wall/frame is retained while the usable glazing expands.
    d.box(structure, 1.1, hoodHeight, 0.07, m.x, m.y + hoodHeight / 2, m.z + m.depth / 2, a.wall);
    d.box(structure, 1.15, 0.1, 0.14, m.x, m.y + 0.05, m.z + m.depth / 2 + 0.025, a.roof).name =
      'Control room sill';
    for (const side of [-1, 1])
      d.box(
        structure,
        0.055,
        hoodHeight - 0.12,
        0.08,
        m.x + side * 0.48,
        m.y + hoodHeight / 2,
        m.z + m.depth / 2 + 0.04,
        a.wall,
      ).name = 'Control room mullion';
    const frontage = modulePart(d, root, 'frontage');
    d.box(
      frontage,
      level >= 2 ? 0.96 : 0.75,
      level >= 2 ? 0.6 : 0.38,
      0.06,
      m.x,
      m.y + hoodHeight / 2,
      m.z + m.depth / 2 + 0.05,
      '#9cbbb5',
    ).name = 'Flush control room glazing';
    addTowerClock(d, root, m.x, m.y + hoodHeight + 0.12, m.z, a.roof, a.wall, level);
  } else if (occupied) addOccupiedBalcony(d, structure, root, x, base, a.roof, a.wall, level);
  else {
    // Solar strips retain the complete cowl roof. Its small front cantilever
    // carries the visible machinery clear of those three working panels.
    const solarFront = a.solar && !arcade && level >= 3;
    const operation = addModuleOperation(
      d,
      root,
      feature,
      m.x,
      level >= 3 ? m.y + hoodHeight + 0.12 : m.y,
      solarFront ? m.z + m.depth / 2 + 0.25 : m.z,
      m.width,
      solarFront ? 0.6 : m.depth,
      a.roof,
      a.wall,
      level,
    );
    if (solarFront)
      d.box(
        operation,
        m.width + 0.15,
        0.12,
        0.8,
        m.x,
        m.y + hoodHeight + 0.06,
        m.z + m.depth / 2 + 0.2,
        a.roof,
      ).name = 'Solar-clear equipment bearing';
  }
  return root;
}

export function addConnectedCityIdentity(d, parent, kind, era) {
  const a = cityAppearance(era, kind);
  const feature = heritageUpgrade(kind);
  if (!a.solar || !['computers', 'research'].includes(feature)) return;
  const root = d.group(parent);
  const server = feature === 'research';
  root.name = server ? 'Technology control frontage' : 'Public computer lounge';
  d.box(root, 2.7, 0.12, 0.55, 0, 2.15, 1.58, a.roof);
  // Paired display windows leave the central doorway and approach corridor open.
  for (const x of [-0.88, 0.88]) {
    d.box(root, 0.95, 1.15, 0.08, x, 1.5, 1.34, '#9cbbb5');
    d.box(root, 0.58, server ? 0.9 : 0.4, 0.08, x, 1.5, 1.41, a.roof);
    if (server) for (const y of [1.2, 1.5, 1.8]) d.box(root, 0.38, 0.04, 0.025, x, y, 1.46, a.wall);
    else {
      d.box(root, 0.48, 0.3, 0.025, x, 1.5, 1.46, '#85b8c8');
      d.box(root, 0.7, 0.09, 0.3, x, 1.2, 1.45, a.wall);
    }
  }
}

export function addAirportFinish(
  d,
  parent,
  level,
  rounded = false,
  appearance = {},
  moduleLevel = level,
) {
  const lounge = parent.getObjectByName('Airport rooftop observation lounge');
  const base = roofHeight(parent, 4.5, -2.8);
  if (base == null) return;
  const root = purposeModule(
    d,
    parent,
    heritageUpgrade('airport'),
    moduleLevel,
    level,
    'controlRoom',
  );
  root.name = `Airport observation completion ${level}`;
  const structure = modulePart(d, root, 'structure');
  if (lounge) structure.add(lounge);
  const roof = appearance.roof ?? '#638b88',
    wall = appearance.frame ?? '#e1cfab';
  const x = 4.5,
    z = -2.8;
  if (rounded && lounge)
    d.box(structure, 1.8, 0.5, 1.4, x, base - 0.2, z, roof).name =
      'Observation crown bearing plinth';
  for (const side of [-1, 1])
    d.box(structure, 0.1, 0.5, 1.2, x + side * 0.75, base + 0.25, z, wall).name =
      'Observation crown support';
  d.box(structure, 1.8, 0.12, 1.4, x, base + 0.56, z, roof).name = 'Observation completion roof';
  {
    const frontage = modulePart(d, root, 'frontage');
    d.box(
      frontage,
      level >= 2 ? 1.4 : 1.1,
      level >= 2 ? 0.4 : 0.28,
      0.1,
      x,
      base + 0.25,
      z + 0.62,
      level >= 2 ? '#85b8c8' : roof,
    ).name = 'Observation control glazing';
  }
  addModuleOperation(
    d,
    root,
    'dispatch',
    x,
    level >= 3 ? base + 0.62 : base,
    z,
    1.4,
    1,
    roof,
    wall,
    level,
  );
  return root;
}
