import { mineGrowth } from '../../data/mineGrowth';
import { buildMineHillside } from './TownMineHillside';
import { groundHeight } from './TownLandscape';
import { RAIL_EDGE } from './TownLayout';
import { eraEvolution } from '../../data/eras';
import { hasElectricity } from '../../data/industrial';
import { roadLevel } from './TownRules';
import { PLOTS, townTracks, railEdges } from './TownLayout';
import { addTownRoads } from './TownActivity';
import { addMineForecourt } from './TownMineForecourt';
import { addMineWorks } from './TownMineWorks';
import { addElectricLighting } from './buildings/industrial';
import { addEraStreetscape, addPowerGrid, pavedTown } from './TownEvolution';
import { addRailroad } from './TownEraActivity';

// Infrastructure changes with access and services, not with every scaffold or
// building tier. Its roots also serve as stable keys for the static GPU batches.
export class TownScenery {
  constructor() {
    this.entries = new Map();
  }
  detach() {
    for (const { group } of this.entries.values()) group?.removeFromParent();
  }
  update(view, town) {
    const topology = JSON.stringify([
      townTracks(town),
      Object.keys(PLOTS).filter((id) => town.buildings[id] > 0),
    ]);
    const definitions = [
      [
        'mine-hillside',
        !!railEdges(town).length,
        () =>
          buildMineHillside(
            view,
            view.world,
            PLOTS.mine[1],
            RAIL_EDGE.from[1],
            groundHeight,
            !!railEdges(town).length,
          ),
      ],
      [
        'roads',
        JSON.stringify([town.era, roadLevel(town), topology]),
        () => addTownRoads(view, town, PLOTS),
      ],
      ['streetscape', town.era, () => addEraStreetscape(view, town)],
      ['forecourt', pavedTown(town), () => addMineForecourt(view, town)],
      [
        'mine-works',
        JSON.stringify([town.era, !!railEdges(town).length, mineGrowth(view.mineStage ?? 0).band]),
        () => addMineWorks(view, view.world, town.era),
      ],
      ['lights', hasElectricity(town), () => addElectricLighting(view, town)],
      [
        'power',
        JSON.stringify([hasElectricity(town), !eraEvolution(town.era).overheadPower, topology]),
        () => addPowerGrid(view, town),
      ],
      ['railroad', !!railEdges(town).length, () => addRailroad(view, town)],
    ];
    for (const [id, signature, build] of definitions) {
      let cached = this.entries.get(id);
      if (!cached || cached.signature !== signature) {
        if (cached?.group?.userData.mineUpdate)
          view.motions = view.motions.filter((m) => m !== cached.group.userData.mineUpdate);
        view.clearGroup(cached?.group);
        cached = { signature, group: build() };
        this.entries.set(id, cached);
      }
      if (cached.group) {
        view.world.add(cached.group);
        if (
          cached.group.userData.mineUpdate &&
          !view.motions.includes(cached.group.userData.mineUpdate)
        )
          view.motions.push(cached.group.userData.mineUpdate);
      }
    }
  }
  dispose(view) {
    for (const { group } of this.entries.values()) view.clearGroup(group);
    this.entries.clear();
  }
}
