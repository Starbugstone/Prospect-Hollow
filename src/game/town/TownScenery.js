import {
  buildPersonalAreas,
  buildTownBanner,
  buildMinePlaque,
  plaqueDefinition,
} from './TownPersonalisation';
import { areasForSettlement, areaStage, areaUnlocked } from '../../data/townPersonalisation';
import { monumentWork } from '../../data/townLandmarks';
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
import { TownActors } from './TownActors';
import { Group } from 'three';

// Plain geometry roots a layout change can build ahead (see `TownScenery.prepare`).
const PREPARED_ROOTS = new Set(['roads', 'power', 'lights']);

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
  // [id, signature, build] for each infrastructure root of `town`.
  definitions(view, town) {
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
          areasForSettlement().map((area) => [
            areaUnlocked(town, area),
            areaStage(town, area),
            monumentWork(town, area),
          ]),
        ]),
        () => buildPersonalAreas(view, town),
      ],
      // Only the displayed badge matters, not every other honour the town holds.
      ['mine-plaque', JSON.stringify(plaqueDefinition(town)), () => buildMinePlaque(view, town)],
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
    return definitions;
  }
  // Returns the ids whose infrastructure was rebuilt, so callers can refresh navigation.
  // `prepared` holds roots built ahead by `prepare` for this town; matching ones are adopted.
  update(view, town, prepared) {
    const changed = [];
    for (const [id, signature, build] of this.definitions(view, town)) {
      let cached = this.entries.get(id);
      if (!cached || cached.signature !== signature) {
        const previousMotion = motionFor(cached?.group);
        if (previousMotion) view.motions = view.motions.filter((m) => m !== previousMotion);
        view.clearGroup(cached?.group);
        const ready = prepared?.get(id);
        if (ready) prepared.delete(id);
        if (ready && ready.signature !== signature) view.clearGroup(ready.group);
        cached = { signature, group: ready?.signature === signature ? ready.group : build() };
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
    if (changed.length) this.syncMovingParts(view);
    return changed;
  }
  // Builds, off screen and one root per step, the plain geometry roots (roads, wires and
  // lamps) that `town` changes, into `prepared`. A layout-changing completion prepares
  // them while its reveal waits, so the full rebuild adopts them instead of building
  // them all in one frame. Roots with moving parts or other state are built by `update`.
  *prepare(view, town, prepared) {
    const staging = new Group();
    for (const [id, signature, build] of this.definitions(view, town)) {
      if (!PREPARED_ROOTS.has(id) || this.entries.get(id)?.signature === signature) continue;
      const world = view.world,
        current = view.town;
      let group;
      try {
        view.world = staging;
        view.town = town;
        group = build();
      } finally {
        view.world = world;
        view.town = current;
      }
      group?.removeFromParent();
      prepared.set(id, { signature, group });
      yield;
    }
  }
  // Roots may list moving parts (`userData.movingParts`, e.g. monument centerpieces).
  // They share instanced draws, drawn each frame by `drawFrame`, instead of one draw
  // call per part over the cached town.
  syncMovingParts(view) {
    const roots = [...this.entries.values()].flatMap(
      ({ group }) => group?.userData.movingParts ?? [],
    );
    if (!roots.length && !this.movingParts) return;
    this.movingParts ??= new TownActors(view.scene);
    this.movingParts.rebuild(roots);
  }
  dispose(view) {
    for (const { group } of this.entries.values()) {
      const motion = motionFor(group);
      if (motion) view.motions = view.motions.filter((m) => m !== motion);
      view.clearGroup(group);
    }
    this.entries.clear();
    this.movingParts?.dispose();
    this.movingParts = null;
  }
}
