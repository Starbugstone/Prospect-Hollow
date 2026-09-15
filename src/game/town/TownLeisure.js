import { leisureModel } from './LeisureAssets';
import { PLOTS } from './TownLayout';

// A bounded cast on the existing scene clock. No timers, reward callbacks or
// independent animation loops: pause, hidden views and reduced motion all apply.
export function addLeisureActivity(d, town) {
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
      horse.getObjectByName(`leg${i % 4}`).rotation.x = Math.max(0, Math.sin(phase * 0.6)) * 0.12;
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
  const update = (time) => {
    const phase = time % 60;
    visit.visible = phase < 32;
    const returning = phase >= 16;
    const progress = returning ? 1 - (phase - 16) / 16 : phase / 16;
    visit.position.set(x - 1.55 + Math.max(0, Math.min(1, progress)) * 3.1, 0.13, z + 1.6);
    visit.rotation.y = returning ? -Math.PI / 2 : Math.PI / 2;
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
