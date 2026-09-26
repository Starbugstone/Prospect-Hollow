import { Vector3 } from 'three';
import { addMineWorks } from './TownMineWorks';
import { TownBuildSequence } from './TownBuildSequence';
import { ERA_CONSTRUCTION } from '../../data/mineEvolution';
import { TownNavigation } from './TownNavigation';
import { mineExcavationHeight } from './TownMineShaft';

export class TownMineEraConstruction {
  constructor(d, definition) {
    this.d = d;
    this.root = d.group(d.scene);
    this.root.name = 'Mine era construction';
    this.previous = addMineWorks(d, this.root, definition.from);
    this.next = addMineWorks(d, this.root, definition.to);
    const navigation =
      d.navigation &&
      new TownNavigation([
        ...d.navigation.obstacles.filter((o) => o.owner !== 'mine-site'),
        ...(this.next.userData.footprints ?? []),
      ]);
    this.sequence = new TownBuildSequence(d, this.root, this.next, {
      era: definition.to,
      start: ERA_CONSTRUCTION.buildStart,
      end: ERA_CONSTRUCTION.buildEnd,
      leave: ERA_CONSTRUCTION.leave,
      focus: [-3.65, -18.55],
      navigation,
      stations: [
        [-3, -16.35],
        [-1.9, -17.7],
        [-1.9, -19.15],
      ],
    });
    this.scaffold = d.group(this.root);
    this.scaffold.name = 'Temporary mine scaffolding';
    // Bridge the excavation with a temporary working deck. Workers stand at
    // yard height while the sloped mine entrance remains open below them.
    for (const {
      station: [x, z],
      path,
    } of this.sequence.crew) {
      const y = path?.points.at(-1)?.[1] ?? 0.08;
      const platform = d.group(this.scaffold, x, y, z);
      platform.name = 'Builder working platform';
      for (const dx of [-0.32, 0, 0.32]) d.box(platform, 0.3, 0.08, 1.25, dx, -0.04, 0, '#b99464');
      for (const dx of [-0.42, 0.42])
        for (const dz of [-0.5, 0.5]) {
          const foot = Math.min(0, mineExcavationHeight(x + dx, z + dz)) - 0.1;
          d.rod(platform, [dx, foot - y, dz], [dx, -0.08, dz], 0.055, '#977448');
        }
    }
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
    if (permanent) {
      permanent.visible = false;
      permanent.userData.activation = 'removed';
    }
    this.previous.userData.activation = 'removed';
    this.next.userData.activation = 'temporary-reveal';
    if (!this.ownerInstalled) {
      this.d.navigation?.replaceOwner(
        'mine-site',
        this.next.userData.footprints ?? [],
        'temporary-reveal',
      );
      this.ownerInstalled = true;
    }
    // The temporary and final models come from the exact same assembly function.
    this.previous.visible = !still && time < ERA_CONSTRUCTION.buildStart;
    this.scaffold.visible = !still && time > 3 && time < ERA_CONSTRUCTION.leave;
    this.sequence.frame(time, still);
    this.next.userData.mineUpdate?.(still ? 0 : time);
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
    return {
      eye,
      focus,
      shadowPhase:
        time >= ERA_CONSTRUCTION.buildStart && time <= ERA_CONSTRUCTION.buildEnd
          ? time
          : Math.floor(time),
    };
  }
  dispose() {
    const permanent = this.d.staticScenery.entries.get('mine-works')?.group;
    const batch = this.d.buildingRenderer.batches.get(permanent);
    if (batch) batch.visible = true;
    if (permanent) {
      permanent.visible = true;
      permanent.userData.activation = 'completed';
      this.d.navigation?.replaceOwner(
        'mine-site',
        permanent.userData.footprints ?? [],
        'completed',
      );
    }
    this.sequence.dispose();
    this.d.clearGroup(this.root);
  }
}
