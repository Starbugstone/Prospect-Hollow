import { routeStepPose } from './TownNavigation';
import { buildingWalk } from './TownPedestrians';
import { leisureModel } from './LeisureAssets';
import { available } from './assets/MeshCatalog';
import { PLOTS } from './TownLayout';

// A bounded cast on the existing scene clock. No timers, reward callbacks or
// independent animation loops: pause, hidden views and reduced motion all apply.
export function addLeisureActivity(d, town) {
  if (!available('leisure')) return;
  const horses = Math.min(3, town.buildings.horseField ?? 0);
  const spots = [
    [-1.3, 0.25],
    [0, 0.35],
    [1.3, 0.3],
  ];
  for (let i = 0; i < horses; i++) {
    const horse = leisureModel(d, d.world, 'horse');
    horse.name = 'Field horse';
    horse.userData.animated = true;
    horse.scale.setScalar(0.85);
    const [x, z] = PLOTS.horseField;
    horse.position.set(x + spots[i][0], 0.18, z + spots[i][1]);
    horse.rotation.y = (i - 1) * 0.45;
    const head = horse.getObjectByName('head');
    const tail = horse.getObjectByName('tail');
    d.motions.push((time) => {
      const phase = time * 0.65 + i * 2;
      head.rotation.x = 0.15 + Math.max(0, Math.sin(phase)) * 0.85;
      tail.rotation.z = Math.sin(time * 1.8 + i) * 0.16;
      for (let n = 0; n < 4; n++)
        horse.getObjectByName(`leg${n}`).rotation.x = Math.sin(phase * 0.6 + n * Math.PI) * 0.08;
      horse.rotation.z = Math.sin(phase) * 0.025;
    });
  }
  if (!town.buildings.park) return;
  const visit = d.group(d.world);
  visit.name = 'Park dog walk';
  visit.userData.animated = true;
  const walker = leisureModel(d, visit, 'walker');
  const dog = leisureModel(d, visit, 'dog');
  dog.position.set(-0.4, 0, 0.65);
  d.rod(visit, [-0.38, 0.87, 0.2], [-0.4, 0.5, 0.9], 0.012, '#8f7856');
  const legs = [walker, dog].map((root) =>
    [0, 1, 2, 3].map((i) => root.getObjectByName(`leg${i}`)).filter(Boolean),
  );
  const [x, z] = PLOTS.park;
  // The footprint includes the leashed dog, not just the person at the origin.
  const path = buildingWalk({ ...d, town }, 'park', {
    station: [x, 0.13, z + 2.3],
    radius: 1.2,
    length: 4,
    clearance: d.animalSpace && ((a, b, radius) => d.animalSpace.segment(a, b, radius, 1.65)),
  });
  visit.userData.activityBuilding = 'park';
  visit.userData.walkPath = path;
  const update = (time) => {
    visit.visible = path.total > 0;
    if (!visit.visible) return;
    const pose = routeStepPose(path, time * 0.55, (visit.userData.pose ??= {}));
    visit.position.set(pose.x, pose.y, pose.z);
    visit.rotation.y = pose.heading;
    legs.forEach((group) =>
      group.forEach((leg, i) => {
        leg.rotation.x = Math.sin(time * 5 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.28;
      }),
    );
    dog.getObjectByName('tail').rotation.z = Math.sin(time * 7) * 0.35;
  };
  update(0);
  d.motions.push(update);
}
