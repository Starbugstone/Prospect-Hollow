import { planOrbit, walkPose } from './TownNavigation';
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
  let path = d.animalNavigation
    ? d.animalNavigation.plan(
        Array.from({ length: 65 }, (_, i) => {
          const angle = (i / 64) * Math.PI * 2;
          return [x + Math.sin(angle) * 1.55, 0.13, z + 2.7 + Math.cos(angle) * 1.1];
        }),
        1.2,
        1.65,
      )
    : planOrbit(d, x, z + 2.7, 1.55, 1.1, 1.2, 0.13);
  // A fully expanded park and horse field can leave too little room for the
  // person plus leash at the front. Use the open side promenade in that case.
  if (d.animalNavigation && path.total < 2)
    path = d.animalNavigation.plan(
      [
        [x - 4.6, 0.13, z + 3.8],
        [x - 4.6, 0.13, z - 2.5],
        [x - 4.6, 0.13, z + 3.8],
      ],
      1.2,
      1.65,
    );
  visit.userData.walkPath = path;
  const update = (time) => {
    const phase = time % 60;
    // A continuous oval joins the promenade to the street entrance. The
    // walker remains present and turns over several steps at each end.
    visit.visible = !path || path.points.length > 0;
    const angle = (phase / 60) * Math.PI * 2;
    visit.position.set(x + Math.sin(angle) * 1.55, 0.13, z + 2.7 + Math.cos(angle) * 1.1);
    visit.rotation.y = Math.atan2(Math.cos(angle) * 1.55, -Math.sin(angle) * 1.1);
    if (path) {
      const pose = walkPose(path, phase / 60, (visit.userData.pose ??= { x, y: 0.13, z: z + 3.8 }));
      visit.position.set(pose.x, pose.y, pose.z);
      visit.rotation.y = pose.heading;
    }
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
