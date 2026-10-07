import { buildPersonalAreas, buildTownBanner, buildMinePlaque } from './TownPersonalisation';
import { PERSONAL_AREAS, areaStage, areaUnlocked } from '../../data/townPersonalisation';
import { buildMineHillside } from './TownMineHillside';
import { groundHeight, landscapeColor } from './TownLandscape';
import { RAIL_EDGE } from './TownLayout';
import { eraEvolution } from '../../data/eras';
import { electricLamps, hasElectricity } from '../../data/industrial';
import { roadLevel } from './TownRules';
import { PLOTS, townTracks, railEdges } from './TownLayout';
import { addTownRoads } from './TownActivity';
import { addMineForecourt } from './TownMineForecourt';
import { addMineSite } from './mine/addMineSite';
import { addElectricLighting } from './buildings/industrial';
import { addEraStreetscape, addPowerGrid, pavedTown } from './TownEvolution';
import { addRailroad } from './TownEraActivity';

// Elevated decorations never change walkable space or animal habitats.
export const sceneryAffectsNavigation = (id) => id !== 'town-banner' && id !== 'mine-plaque';

const motionFor = (group) => group?.userData.sceneryUpdate ?? group?.userData.mineUpdate;

// Infrastructure changes with access and services, not with every scaffold or
// building tier. Its roots also serve as stable keys for the static GPU batches.
export class TownScenery {
  constructor() {
    this.entries = new Map();
  }
  detach() {
    for (const { group } of this.entries.values()) group?.removeFromParent();
  }
  // Returns the ids whose infrastructure was rebuilt, so callers can refresh navigation.
  update(view, town) {
    const tracks = JSON.stringify(townTracks(town));
    const built = Object.keys(PLOTS).filter((id) => town.buildings[id] > 0);
    const level = roadLevel(town);
    // Only frontage paving (road level 2+) and overhead service wires follow the
    // completed plots. Earlier roads keep their batch when a new building opens.
    const overhead = hasElectricity(town) && !!eraEvolution(town.era).overheadPower;
    const definitions = [
      [
        'town-banner',
        JSON.stringify(town.personalisation?.crest),
        () => buildTownBanner(view, town),
      ],
      [
        'personal-areas',
        JSON.stringify([
          town.personalisation?.areas,
          PERSONAL_AREAS.map((area) => [areaUnlocked(town, area), areaStage(town, area)]),
        ]),
        () => buildPersonalAreas(view, town),
      ],
      [
        'mine-plaque',
        JSON.stringify([
          town.personalisation?.plaques?.mine,
          town.displayHonours,
          town.displayDistinctions,
        ]),
        () => buildMinePlaque(view, town),
      ],
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
            landscapeColor,
            !!railEdges(town).length,
          ),
      ],
      [
        'roads',
        JSON.stringify([town.era, level, tracks, level >= 2 ? built : null]),
        () => addTownRoads(view, town, PLOTS),
      ],
      ['streetscape', town.era, () => addEraStreetscape(view, town)],
      ['forecourt', pavedTown(town), () => addMineForecourt(view, town)],
      [
        'mine-works',
        JSON.stringify([town.era, !!railEdges(town).length]),
        () => addMineSite(view, view.world, town.era),
      ],
      ['lights', JSON.stringify(electricLamps(town)), () => addElectricLighting(view, town)],
      [
        'power',
        JSON.stringify([
          hasElectricity(town),
          !eraEvolution(town.era).overheadPower,
          overhead ? [tracks, built] : null,
        ]),
        () => addPowerGrid(view, town),
      ],
      ['railroad', !!railEdges(town).length, () => addRailroad(view, town)],
    ];
    const changed = [];
    for (const [id, signature, build] of definitions) {
      let cached = this.entries.get(id);
      if (!cached || cached.signature !== signature) {
        const previousMotion = motionFor(cached?.group);
        if (previousMotion) view.motions = view.motions.filter((m) => m !== previousMotion);
        view.clearGroup(cached?.group);
        cached = { signature, group: build() };
        if (cached.group) cached.group.userData.navigationOwner = `scenery:${id}`;
        this.entries.set(id, cached);
        changed.push(id);
      }
      if (cached.group) {
        view.world.add(cached.group);
        const motion = motionFor(cached.group);
        if (motion && !view.motions.includes(motion)) view.motions.push(motion);
      }
    }
    return changed;
  }
  dispose(view) {
    for (const { group } of this.entries.values()) {
      const motion = motionFor(group);
      if (motion) view.motions = view.motions.filter((m) => m !== motion);
      view.clearGroup(group);
    }
    this.entries.clear();
  }
}
