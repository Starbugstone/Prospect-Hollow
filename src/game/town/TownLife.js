import { walkPose, planOrbit } from './TownNavigation';
import { Vector3 } from 'three';
import { atPlot, plotStreet, routeBetween } from './TownLayout';
import { population } from './TownRules';

// Small daily routines make completed buildings feel inhabited. All motion uses
// the diorama clock, so hidden views, pauses and reduced motion freeze it together.
export function addTownLife(d, town) {
  if (town.buildings.farm) {
    for (let n = 0; n < 3; n++) {
      const [x, z] = atPlot('farm', -1.1 + n * 0.7, 3.35);
      const bird = d.group(d.world, x, 0.07, z);
      bird.name = 'Farmyard hen';
      bird.userData.animated = true;
      d.ball(bird, 0, 0.2, 0, [0.15, 0.18, 0.23], n % 2 ? '#c89560' : '#efe2c3');
      const head = d.group(bird, 0, 0.34, 0.14);
      d.ball(head, 0, 0, 0, 0.1, '#efe2c3');
      d.ball(head, 0, 0.1, 0, [0.04, 0.065, 0.07], '#b86c50');
      d.ball(head, 0, -0.02, 0.11, [0.045, 0.03, 0.08], '#d5a15b');
      const feet = [];
      for (const side of [-1, 1]) {
        d.ball(head, side * 0.079, 0.02, 0.04, 0.018, '#403f32');
        const leg = d.group(bird, side * 0.065, 0.16, 0);
        d.rod(leg, [0, 0, 0], [0, -0.16, 0.025], 0.018, '#bd9256');
        feet.push(leg);
      }
      const path = planOrbit(d, x, z, 0.35, 0.25, 0.25);
      d.motions.push((time) => {
        const clock = time + n * 3;
        const phase = clock % 12;
        const walking = phase < 5;
        const angle = (Math.floor(clock / 12) * 5 + Math.min(phase, 5)) * 0.65 + n;
        bird.position.set(
          x + Math.sin(angle) * 0.35,
          0.07 + (walking ? Math.abs(Math.sin(time * 8 + n)) * 0.025 : 0),
          z + Math.cos(angle) * 0.25,
        );
        bird.rotation.y = angle + Math.PI / 2;
        if (path) {
          const pose = walkPose(path, (angle / (Math.PI * 2)) % 1);
          bird.position.x = pose.x;
          bird.position.z = pose.z;
          bird.rotation.y = pose.heading;
        }
        feet.forEach(
          (leg, i) => (leg.rotation.x = walking ? Math.sin(time * 8 + n + i * Math.PI) * 0.45 : 0),
        );
        head.rotation.x = walking ? 0 : Math.max(0, Math.sin(time * 4 + n)) * 0.9;
      });
    }
  }

  if (population(town)) {
    const [x, z] = atPlot('home', 0, 3.5);
    const dog = d.group(d.world, x, 0.07, z);
    dog.name = 'Village dog';
    dog.userData.animated = true;
    d.ball(dog, 0, 0.3, 0, [0.17, 0.2, 0.34], '#c69b6b');
    const head = d.group(dog, 0, 0.46, 0.25);
    d.ball(head, 0, 0, 0, [0.15, 0.16, 0.18], '#d0ab7b');
    d.ball(head, 0, -0.035, 0.16, [0.11, 0.08, 0.12], '#e4c99e');
    d.ball(head, 0, -0.02, 0.26, 0.036, '#484637');
    for (const side of [-1, 1]) {
      d.ball(head, side * 0.1, 0.04, 0.1, 0.02, '#383b31');
      d.ball(head, side * 0.145, -0.03, -0.03, [0.055, 0.15, 0.08], '#96724f');
    }
    const legs = [];
    for (const dx of [-0.1, 0.1])
      for (const dz of [-0.2, 0.2]) {
        const leg = d.group(dog, dx, 0.25, dz);
        d.rod(leg, [0, 0, 0], [0, -0.22, 0], 0.04, '#c69b6b');
        legs.push(leg);
      }
    const tail = d.group(dog, 0, 0.36, -0.3);
    d.rod(tail, [0, 0, 0], [0, 0.2, -0.22], 0.045, '#c69b6b');
    const path = planOrbit(d, x, z, 1.25, 0.4, 0.4);
    d.motions.push((time) => {
      const phase = time % 24;
      const walking = phase < 15;
      const angle = (Math.min(phase, 15) / 15) * Math.PI * 2;
      dog.position.set(x + Math.sin(angle) * 1.25, 0.07, z + Math.cos(angle) * 0.4);
      dog.rotation.y = Math.atan2(Math.cos(angle) * 1.25, -Math.sin(angle) * 0.4);
      if (path) {
        const pose = walkPose(path, angle / (Math.PI * 2));
        dog.position.set(pose.x, pose.y, pose.z);
        dog.rotation.y = pose.heading;
      }
      legs.forEach((leg, n) => {
        leg.rotation.x = walking
          ? Math.sin(time * 9 + (n === 0 || n === 3 ? 0 : Math.PI)) * 0.4
          : 0;
      });
      tail.rotation.z = Math.sin(time * 8) * 0.45;
      head.rotation.y = walking ? 0 : Math.sin(time * 1.3) * 0.3;
    });
  }

  if (town.buildings.home && town.buildings.well && population(town)) {
    const route = routeBetween(town, plotStreet('home'), plotStreet('well'));
    if (route.length > 1) {
      const neighbor = d.person({
        color: '#8e8da7',
        skin: '#c99d78',
        hat: '#d6bb83',
        route,
        seed: 5,
        linear: true,
      });
      neighbor.root.name = 'Neighbor fetching water';
      neighbor.duration *= 0.8;
      const bucket = d.group(neighbor.arms[0].lower, 0, -0.3, 0);
      d.mesh(bucket, 'cylinder', [0.12, 0.17, 0.12], [0, -0.02, 0], '#8a9c98');
      d.rod(bucket, [-0.1, 0.05, 0], [0, 0.15, 0], 0.012, '#6c7467');
      d.rod(bucket, [0, 0.15, 0], [0.1, 0.05, 0], 0.012, '#6c7467');
    }
  }

  if (town.buildings.square && population(town) >= 6) {
    for (let n = 0; n < 2; n++) {
      const point = atPlot('square', 2 + n * 0.8, 1.9);
      const neighbor = d.person({
        color: n ? '#b57f6f' : '#729595',
        skin: n ? '#9e7559' : '#d3ae84',
        hat: '#c3a274',
        route: [point, [point[0], point[1] + 0.1]],
        seed: 10 + n * 4,
        work: 'greet',
      });
      neighbor.root.name = 'Neighbors chatting';
      d.motions.push((time) => {
        neighbor.root.rotation.y = n ? -Math.PI / 2 : Math.PI / 2;
        neighbor.head.rotation.x = Math.sin(time * 1.5 + n) * 0.08;
      });
    }
  }

  for (const id of ['home', 'saloon', 'blacksmith']) {
    const plot = d.plotCache?.get(id)?.group;
    const anchor = plot?.getObjectByName('chimney');
    if (!anchor) continue;
    const origin = anchor.getWorldPosition(new Vector3());
    const smoke = d.group(d.world, origin.x, origin.y, origin.z);
    smoke.name = 'Warm chimney smoke';
    smoke.userData.animated = true;
    const puffs = Array.from({ length: 3 }, () => {
      const puff = d.ball(smoke, 0, 0, 0, 1, '#d8d4ba');
      puff.material = puff.material.clone();
      puff.material.transparent = true;
      puff.material.depthWrite = false;
      puff.material.userData.transient = true;
      return puff;
    });
    d.motions.push((time) =>
      puffs.forEach((puff, n) => {
        const phase = (time / 5 + n / 3) % 1;
        puff.position.set(phase * 0.55, phase * 1.7, Math.sin(phase * 3 + n) * 0.08);
        puff.scale.setScalar(0.12 + phase * 0.3);
        puff.material.opacity = Math.sin(phase * Math.PI) * 0.35;
      }),
    );
  }
}
