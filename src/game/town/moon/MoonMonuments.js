import { Vector3 } from 'three';
import { MOON_LOTS } from '../../../data/moonSettlement';
import {
  areasForSettlement,
  areaChoice,
  areaShownStage,
  areaUnlocked,
  monumentWork,
  siteYaw,
} from '../../../data/townLandmarks';
import { buildLandmark } from '../TownLandmarks';
import { buildMonumentWorks } from '../TownMonumentWorks';
import { TownPresentation } from '../TownPresentation';

export const MOON_MONUMENT_AREAS = areasForSettlement('moon');
export const moonMonumentSignature = (town) =>
  JSON.stringify(
    MOON_MONUMENT_AREAS.map((area) => [
      areaUnlocked(town, area),
      areaChoice(town, area),
      areaShownStage(town, area),
      monumentWork(town, area),
    ]),
  );
export const moonMonumentLabels = (town) =>
  MOON_MONUMENT_AREAS.filter((area) => areaUnlocked(town, area)).map((area) => ({
    id: area.id,
    position: area.positions[0],
  }));

// A small presentation adapter supplies suited visitors to the shared unveiling.
// Purchases, saved work, scaffolds, ribbon, shots and cleanup remain shared.
function lunarVisitor(d, { parent, color }) {
  const root = d.group(parent),
    body = d.group(root, 0, 0.54, 0);
  d.box(body, 0.48, 0.58, 0.3, 0, 0.18, 0, '#e5e8e7');
  d.box(body, 0.3, 0.4, 0.16, 0, 0.2, -0.23, color);
  d.ball(body, 0, 0.75, 0, 0.27, '#e5e8e7');
  d.ball(body, 0, 0.76, 0.2, [0.22, 0.14, 0.12], '#eacb80');
  for (const x of [-0.14, 0.14]) d.box(root, 0.17, 0.45, 0.22, x, 0.25, 0, '#657481');
  const arms = [-1, 1].map((side) => {
    const upper = d.group(body, side * 0.32, 0.4, 0);
    d.box(upper, 0.16, 0.36, 0.18, 0, -0.18, 0, '#e5e8e7');
    const lower = d.group(upper, 0, -0.36, 0);
    d.box(lower, 0.15, 0.3, 0.17, 0, -0.15, 0, '#e5e8e7');
    return { upper, lower };
  });
  return { root, body, arms };
}

// Isolated works hook, ready to share the Moon construction marker layer.
export function buildMoonMonuments(d, parent, town) {
  const root = d.group(parent);
  root.name = 'New Hollow monument sites';
  const motions = [];
  for (const area of MOON_MONUMENT_AREAS) {
    if (!areaUnlocked(town, area)) continue;
    const [x, z] = area.positions[0];
    const site = d.group(root, x, 0, z);
    site.rotation.y = siteYaw(area);
    site.userData.monumentSite = area.id;
    const choice = areaChoice(town, area),
      work = monumentWork(town, area);
    if (work) buildMonumentWorks(d, site, choice, work, area, town.era);
    else if (choice) {
      const model = buildLandmark(d, site, choice, areaShownStage(town, area), area.timeless);
      motions.push(model.userData.sceneryUpdate);
    } else {
      site.name = `${area.id}: open site`;
      d.mesh(site, 'cylinder', [4.9, 0.08, 4.9], [0, 0.04, 0], '#c1c4c5');
      d.mesh(site, 'cylinder', [1.4, 0.35, 1.4], [0, 0.22, 0], '#e5e8e7');
      for (const x of [-3, 3])
        for (const z of [-3, 3]) {
          d.rod(site, [x, 0.1, z], [x, 1.2, z], 0.07, '#657481');
          d.ball(site, x, 1.25, z, 0.18, '#eacb80', 'rock');
        }
    }
  }
  d.batch(root);
  root.userData.update = (time) => motions.forEach((motion) => motion(time));
  return root;
}

// Monument work changes do not rebuild the settlement's unchanged buildings.
export function syncMoonMonuments(scene, town) {
  const signature = moonMonumentSignature(town);
  if (signature === scene.monumentSignature) return;
  scene.monumentSignature = signature;
  scene.d.clearGroup(scene.monuments);
  scene.monuments = buildMoonMonuments(scene.d, scene.scene, town);
  scene.lots = [
    ...Object.entries(MOON_LOTS).map(([id, [x, z]]) => ({ id, position: new Vector3(x, 3.4, z) })),
    ...moonMonumentLabels(town).map(({ id, position: [x, z] }) => ({
      id,
      position: new Vector3(x, 2, z),
    })),
  ];
  scene.requestFrame();
}

export function moonMonumentPresentation(scene, definition) {
  const d = Object.assign(Object.create(scene.d), {
    scene: scene.scene,
    town: scene.town,
    camera: scene.camera,
    controls: scene.controls,
    renderer: scene.renderer,
    elapsed: scene.elapsed,
    motions: [],
    frameCache: {},
    // Ending a Moon presentation restores its camera immediately, even when paused.
    motionEnabled: false,
    fauna: { companions: null },
    surfaceHeight: () => 0,
    keepCameraAboveSurface: (eye) => {
      eye.y = Math.max(1.2, eye.y);
    },
    render: () => {
      scene.viewChanged = true;
      scene.render();
    },
    person: (options) => lunarVisitor(scene.d, options),
  });
  return new TownPresentation(d, definition);
}
