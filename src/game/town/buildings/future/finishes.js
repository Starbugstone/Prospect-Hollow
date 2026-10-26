import { heritageUpgrade } from '../../../../data/heritageUpgrades';

/** Exactly one retained working module belongs to a plot, irrespective of its era. */
export function purposeModule(d, parent, s, component, name) {
  const root = d.group(parent);
  root.name = name ?? `Purpose module ${heritageUpgrade(s.kind) ?? 'service'}`;
  root.userData.purposeModule = {
    feature: heritageUpgrade(s.kind) ?? 'service',
    role: 'purposeModule',
    component,
    level: s.moduleLevel ?? s.structureLevel,
    finishLevel: s.finishLevel,
  };
  root.userData.upgradeFeature = root.userData.purposeModule.feature;
  return root;
}

export function purposeStructure(d, parent) {
  const root = d.group(parent);
  root.name = 'Retained purpose structure';
  root.userData.modulePart = 'structure';
  return root;
}

/** Glazing and useful equipment change inside the already-built room envelope. */
export function addPurposeGrades(
  d,
  parent,
  s,
  {
    x = 0,
    y = 0.95,
    z = 0,
    width = 0.8,
    height = 0.54,
    turn = 0,
    operationX = x,
    operationY = 0.55,
    operationZ = z - 0.04,
    operationWidth = width,
    operationTurn = turn,
    roof = false,
    floor = null,
  } = {},
) {
  const p = s.palette,
    feature = heritageUpgrade(s.kind) ?? 'service';
  const frontage = d.group(parent, x, y, z);
  frontage.rotation.y = turn;
  frontage.name = `Purpose frontage ${feature}`;
  frontage.userData.modulePart = 'frontage';
  const glazed = s.finishLevel >= 2;
  const w = width * (glazed ? 1 : 0.58),
    h = height * (glazed ? 1 : 0.62);
  d.box(frontage, width + 0.09, height + 0.09, 0.075, 0, 0, 0, p.timber);
  d.box(frontage, w, h, 0.085, 0, 0, 0.015, glazed ? p.glass : p.deep);
  if (floor !== null)
    for (const side of [-1, 1])
      d.box(
        frontage,
        0.045,
        y + height / 2 - floor,
        0.08,
        (side * (width + 0.09)) / 2,
        (floor - y + height / 2) / 2,
        0,
        p.timber,
      );

  const operation = d.group(parent, operationX, operationY, operationZ);
  operation.rotation.y = operationTurn;
  operation.name = `Purpose operation ${feature}`;
  operation.userData.modulePart = 'operation';
  const complete = s.finishLevel >= 3;
  const span = operationWidth * (complete ? 0.9 : 0.56),
    rise = complete ? 0.36 : roof ? 0.26 : 0.18;
  // These are wall-mounted working fittings: their back enters the room wall.
  const cabinet = d.box(
    operation,
    span,
    rise,
    0.24,
    0,
    0,
    0,
    roof && s.finishLevel >= 2 ? p.glass : p.timber,
  );
  cabinet.name = roof ? 'Roof-seated purpose equipment' : 'Attached purpose workbench';
  if (complete) {
    if (['classroom', 'computers', 'gallery', 'office', 'dispatch', 'studio'].includes(feature)) {
      if (roof) {
        d.box(operation, span * 0.86, 0.28, 0.2, 0, rise / 2 + 0.13, 0, p.glass);
        d.box(operation, span * 0.98, 0.08, 0.28, 0, rise / 2 + 0.3, 0, p.timber);
        d.box(operation, span * 0.12, 0.3, 0.22, 0, rise / 2 + 0.13, 0, p.shell);
      } else
        for (const [n, color] of [p.deep, p.shell, p.flower].entries())
          d.box(
            operation,
            span * 0.24,
            0.25,
            0.16,
            (n - 1) * span * 0.27,
            rise / 2 + 0.12,
            0.01,
            color,
          );
    } else if (['greenhouse', 'garden', 'hayloft'].includes(feature)) {
      d.box(operation, span * 0.86, 0.24, 0.2, 0, rise / 2 + 0.11, 0, roof ? p.glass : p.green);
    } else if (
      ['veranda', 'terrace', 'portico', 'auditorium', 'bathhouse', 'awning', 'landing'].includes(
        feature,
      )
    ) {
      d.box(
        operation,
        span,
        0.32,
        roof ? 0.22 : 0.08,
        0,
        rise / 2 + 0.12,
        roof ? 0 : -0.08,
        roof ? p.glass : p.shell,
      );
    } else {
      d.box(operation, span * 0.72, 0.28, 0.2, 0, rise / 2 + 0.13, 0, p.shell);
      d.box(
        operation,
        span * 0.42,
        0.17,
        0.035,
        0,
        rise / 2 + 0.13,
        0.11,
        feature === 'clinic' ? p.flower : p.glass,
      );
    }
  }
  return { frontage, operation };
}

/** The complete annex is retained; paid finishes refit its frontage and equipment. */
export function addPurposeWing(d, parent, s, slot) {
  const feature = heritageUpgrade(s.kind);
  if (!feature || s.moduleLevel < 2) return false;
  const { x, z, w = 1.35, dep = 1.25 } = slot;
  const root = purposeModule(d, parent, s, 'serviceAnnex', `Purpose wing ${feature}`);
  const structure = purposeStructure(d, root);
  const top = s.kit.block(d, structure, s, { x, z, w, dep, h: 1.55 });
  s.kit.roof(d, structure, s, { x, z, w, dep, y: top, accent: true });
  addPurposeGrades(d, root, s, { x, y: 0.98, z: z + dep / 2 + 0.035, width: 0.8 });
  return true;
}

/** A bounded wall-supported room refits a mature campus without deleting wings. */
export function addPurposeFinish(d, parent, s, anchor) {
  const feature = heritageUpgrade(s.kind);
  if (!s.modernizing || s.moduleLevel < 2 || !feature || !anchor) return null;
  const { x, z, turn = 0, width = 1.1 } = anchor;
  const root = purposeModule(d, parent, s, 'workingBay', `Future purpose finish ${feature}`);
  root.position.set(x, 0, z);
  root.rotation.y = turn;
  root.userData.finishLevel = s.finishLevel;
  const structure = purposeStructure(d, root);
  // The back enters the existing wall; brackets join its underside to that wall.
  const body = d.box(structure, width, 0.9, 0.65, 0, 0.9, 0.2, s.palette.shell);
  body.name = 'Purpose finish room';
  for (const side of [-1, 1]) {
    const bracket = d.rod(
      structure,
      [side * width * 0.36, 0.75, -0.13],
      [side * width * 0.36, 0.45, 0.48],
      0.045,
      s.palette.timber,
    );
    bracket.name = 'Purpose finish wall bracket';
  }
  s.kit.finishRoof(d, structure, s, { w: width, y: 1.35, z: 0.2 });
  const grade = addPurposeGrades(d, root, s, {
    y: 0.98,
    z: 0.55,
    width: width * 0.75,
    height: 0.48,
    operationY: 0.68,
    operationZ: 0.55,
  });
  grade.operation.name = 'Purpose finish completion';
  return root;
}
