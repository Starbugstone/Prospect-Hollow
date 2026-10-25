import { Box3, Vector3 } from 'three';
import { MOON_LOTS, MOON_SITE_PAD } from '../../../data/moonSettlement';
import {
  areasForSettlement,
  areaChoice,
  areaShownStage,
  areaUnlocked,
  monumentWork,
  siteYaw,
} from '../../../data/townLandmarks';
import { buildLandmark } from '../TownLandmarks';
import { moonParcelPad } from '../buildings/moon';
import { moonSuitFigure } from './MoonSettlers';
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

// The shared unveiling stages suited settlers from the Moon's one figure builder.
// Purchases, saved work, scaffolds, ribbon, shots and cleanup remain shared.
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
    if (work || choice) moonParcelPad(d, site, MOON_SITE_PAD, { flush: true });
    if (work) buildMonumentWorks(d, site, choice, work, area, town.era);
    else if (choice) {
      const model = buildLandmark(d, site, choice, areaShownStage(town, area), area.timeless);
      motions.push(model.userData.sceneryUpdate);
    } else {
      site.name = `${area.id}: open site`;
      // The same pad as the building lots, so every parcel shares one shape.
      moonParcelPad(d, site, MOON_SITE_PAD);
      d.mesh(site, 'cylinder', [1.4, 0.35, 1.4], [0, 0.4, 0], '#e5e8e7');
      for (let n = 0; n < 4; n++) {
        const a = (n * Math.PI) / 2 + Math.PI / 4,
          x = Math.sin(a) * (MOON_SITE_PAD - 0.8),
          z = Math.cos(a) * (MOON_SITE_PAD - 0.8);
        d.rod(site, [x, 0.26, z], [x, 1.36, z], 0.07, '#657481');
        d.ball(site, x, 1.41, z, 0.18, '#eacb80', 'rock');
      }
    }
  }
  // Tap targets reach each site's roof; batching moves the meshes out of the sites.
  const bounds = new Box3();
  for (const site of root.children)
    if (site.userData.monumentSite) site.userData.height = bounds.setFromObject(site).max.y;
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
    // The shots stay above the Moon's own hills, as the valley's stay above its terrain.
    terrainHeight: scene.terrainHeight,
    render: () => {
      scene.viewChanged = true;
      scene.render();
    },
    person: ({ parent, color }) => moonSuitFigure(scene.d, { parent, pack: color }),
  });
  return new TownPresentation(d, definition);
}
