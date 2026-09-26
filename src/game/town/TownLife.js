import { addTownAnimals } from './TownAnimals';
import { Vector3 } from 'three';
import { atPlot, plotStreet, routeBetween } from './TownLayout';
import { population } from './TownRules';

// Small daily routines make completed buildings feel inhabited. All motion uses
// the diorama clock, so hidden views, pauses and reduced motion freeze it together.
export function addTownLife(d, town) {
  addTownAnimals(d, town);

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
      if (!neighbor.root.getObjectByName('Water bucket')) {
        const bucket = d.group(neighbor.arms[0].lower, 0, -0.3, 0);
        bucket.name = 'Water bucket';
        d.mesh(bucket, 'cylinder', [0.12, 0.17, 0.12], [0, -0.02, 0], '#8a9c98');
        d.rod(bucket, [-0.1, 0.05, 0], [0, 0.15, 0], 0.012, '#6c7467');
        d.rod(bucket, [0, 0.15, 0], [0.1, 0.05, 0], 0.012, '#6c7467');
      }
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
