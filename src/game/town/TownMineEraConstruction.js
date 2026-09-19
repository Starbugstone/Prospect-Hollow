import { Vector3 } from 'three';
import { addMineWorks } from './TownMineWorks';
import { TownBuildSequence } from './TownBuildSequence';
import { ERA_CONSTRUCTION } from '../../data/mineEvolution';

export class TownMineEraConstruction {
  constructor(d, definition) {
    this.d = d;
    this.root = d.group(d.scene);
    this.root.name = 'Mine era construction';
    this.previous = addMineWorks(d, this.root, definition.from);
    this.next = addMineWorks(d, this.root, definition.to);
    this.sequence = new TownBuildSequence(d, this.root, this.next, {
      era: definition.to,
      start: ERA_CONSTRUCTION.buildStart,
      end: ERA_CONSTRUCTION.buildEnd,
      leave: ERA_CONSTRUCTION.leave,
      focus: [-3.65, -18.55],
      stations: [
        [-5.7, -18],
        [-2.6, -17.7],
        [-5.7, -15.1],
      ],
    });
    this.scaffold = d.group(this.root);
    this.scaffold.name = 'Temporary mine scaffolding';
    for (const x of [-4.8, -2.5]) {
      d.rod(this.scaffold, [x, 0.1, -19.7], [x, 3.3, -19.7], 0.055, '#b99464');
      d.rod(this.scaffold, [x, 0.1, -17.4], [x, 3.3, -17.4], 0.055, '#b99464');
      d.rod(this.scaffold, [x, 0.3, -19.7], [x, 3, -17.4], 0.04, '#b99464');
    }
    d.box(this.scaffold, 2.7, 0.12, 0.5, -3.65, 2.2, -17.4, '#a38252');
    this.frame(0);
  }
  frame(time, still = false) {
    const permanent = this.d.staticScenery.entries.get('mine-works')?.group;
    const batch = this.d.buildingRenderer.batches.get(permanent);
    if (batch) batch.visible = false;
    // The temporary and final models come from the exact same assembly function.
    this.previous.visible = !still && time < ERA_CONSTRUCTION.buildStart;
    this.scaffold.visible = !still && time > 3 && time < ERA_CONSTRUCTION.leave;
    this.sequence.frame(time, still);
    const reveal = Math.max(
      0,
      Math.min(
        1,
        (time - ERA_CONSTRUCTION.buildEnd) /
          (ERA_CONSTRUCTION.duration - ERA_CONSTRUCTION.buildEnd),
      ),
    );
    const focus = new Vector3(-2.8, 2.8, -17.8);
    const eye = new Vector3(8 - reveal * 2, 13 + reveal, -4 - reveal);
    if (this.d.camera.aspect < 0.8) eye.sub(focus).multiplyScalar(1.3).add(focus);
    return { eye, focus, shadowPhase: Math.floor(time) };
  }
  dispose() {
    const permanent = this.d.staticScenery.entries.get('mine-works')?.group;
    const batch = this.d.buildingRenderer.batches.get(permanent);
    if (batch) batch.visible = true;
    this.sequence.dispose();
    this.d.clearGroup(this.root);
  }
}
