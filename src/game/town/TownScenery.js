import { hasElectricity } from '../../data/industrial';
import { roadLevel } from './TownRules';
import { PLOTS, townTracks, railEdges } from './TownLayout';
import { addTownRoads } from './TownActivity';
import { addMineForecourt } from './TownMineForecourt';
import { addElectricLighting } from './buildings/industrial';
import { addPowerGrid, pavedTown } from './TownEvolution';
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
        'roads',
        JSON.stringify([town.era, roadLevel(town), topology]),
        () => addTownRoads(view, town, PLOTS),
      ],
      ['forecourt', pavedTown(town), () => addMineForecourt(view, town)],
      ['lights', hasElectricity(town), () => addElectricLighting(view, town)],
      ['power', JSON.stringify([hasElectricity(town), topology]), () => addPowerGrid(view, town)],
      ['railroad', !!railEdges(town).length, () => addRailroad(view, town)],
    ];
    for (const [id, signature, build] of definitions) {
      let cached = this.entries.get(id);
      if (!cached || cached.signature !== signature) {
        view.clearGroup(cached?.group);
        cached = { signature, group: build() };
        this.entries.set(id, cached);
      }
      if (cached.group) view.world.add(cached.group);
    }
  }
  dispose(view) {
    for (const { group } of this.entries.values()) view.clearGroup(group);
    this.entries.clear();
  }
}
