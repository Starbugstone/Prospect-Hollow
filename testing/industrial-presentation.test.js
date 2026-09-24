import { describe, expect, it, vi } from 'vitest';
import { Box3, BoxGeometry, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { INDUSTRIAL_VARIANTS } from '../src/data/industrial';
import { createTown } from '../src/data/town';
import {
  renderIndustrialBuilding,
  renderIndustrialLandmark,
  addIndustrialModernization,
} from '../src/game/town/buildings/industrial';
import { TownEraIncident, INCIDENT_DURATION } from '../src/game/town/TownEraIncident';
import { TownActors } from '../src/game/town/TownActors';
import { PLOTS } from '../src/game/town/TownLayout';
import { RIVER, riverDistance, bridgeDeckHeight } from '../src/game/town/TownRiver';

function diorama() {
  const d = Object.create(TownDiorama.prototype);
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  const geometry = new BoxGeometry();
  d.geometries = Object.fromEntries(
    ['box', 'rounded', 'sphere', 'rock', 'cylinder', 'cone', 'shadow'].map((key) => [
      key,
      geometry,
    ]),
  );
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.sign = () => {};
  d.elapsed = 0;
  d.actors = [];
  return d;
}
describe('Substantial Industrial structures and village incidents', () => {
  it.each([...Object.keys(INDUSTRIAL_VARIANTS), 'powerHouse', 'fireStation', 'rowHouses', 'mill'])(
    'adds visible architecture at every %s tier',
    (kind) => {
      const d = diorama();
      const counts = [],
        extents = [];
      for (let level = 1; level <= 3; level++) {
        const root = new Group();
        if (
          !renderIndustrialBuilding(d, root, kind, kind, level) &&
          !renderIndustrialLandmark(d, root, kind, kind, level)
        )
          addIndustrialModernization(d, root, kind, level);
        let count = 0;
        root.traverse((part) => {
          if (part.isMesh) count++;
        });
        counts.push(count);
        extents.push(new Box3().setFromObject(root).getSize(new Vector3()).length());
      }
      expect(counts[0]).toBeGreaterThan(0);
      expect(counts[1]).toBeGreaterThan(counts[0]);
      expect(counts[2]).toBeGreaterThan(counts[1]);
      expect(extents[2]).toBeGreaterThan(extents[0]);
    },
  );
  it.each(['cargo-theft', 'workshop-fire', 'storm-cleanup'])(
    'animates %s along valid roads, pauses with its clock and completes once',
    (kind) => {
      const d = diorama();
      d.town = createTown();
      d.town.era = 'industrial';
      Object.assign(d.town.buildings, {
        bridge: 3,
        powerHouse: 1,
        fireStation: 1,
        mill: 1,
        warehouse: 3,
      });
      const event = {
        id: 1,
        kind,
        targets: [kind === 'workshop-fire' ? 'mill' : 'warehouse'],
        loss: 0,
        outcome: 'protected',
      };
      const done = vi.fn(),
        phases = vi.fn();
      const incident = new TownEraIncident(d, event, PLOTS, phases, done);
      d.raid = incident;
      d.actorRenderer = new TownActors(d.scene);
      d.rebuildActors();
      for (const actor of [...incident.crew, ...incident.thieves])
        expect(d.actorRenderer.roots).toContain(actor.root);
      for (const actor of [...incident.crew, ...incident.thieves])
        actor.root.traverse((object) => {
          if (object.isMesh) expect(object.layers.mask).toBe(2);
        });
      let crossed = false;
      for (let tick = 0; tick < INCIDENT_DURATION * 10; tick++) {
        const now = tick / 10;
        incident.update(now);
        if (tick === 100) {
          d.actorRenderer.update();
          for (const actor of incident.crew) expect(actor.root.visible).toBe(true);
          if (incident.vehicle) {
            for (const actor of incident.crew)
              expect(
                actor.root.position.distanceTo(incident.vehicle.root.position),
              ).toBeGreaterThan(0.8);
            for (let i = 1; i < incident.crew.length; i++)
              expect(
                incident.crew[i].root.position.distanceTo(incident.crew[i - 1].root.position),
              ).toBeGreaterThan(0.8);
          }
          if (incident.debris)
            expect(new Box3().setFromObject(incident.debris).min.y).toBeGreaterThan(0.25);
          expect(
            d.actorRenderer.buckets.reduce((sum, bucket) => sum + bucket.mesh.count, 0),
          ).toBeGreaterThan(60);
        }
        for (const actor of incident.crew) {
          const point = actor.root.position;
          if (riverDistance(point.x, point.z) < RIVER.halfWidth) {
            crossed = true;
            expect(Math.abs(point.z - 7.5)).toBeLessThan(0.7);
            expect(point.y).toBeGreaterThanOrEqual(bridgeDeckHeight(point.x));
          }
        }
        const position = incident.crew[0].root.position.clone();
        incident.update(now);
        expect(incident.crew[0].root.position).toEqual(position);
      }
      const spansRiver =
        incident.path.points.some(([x]) => x < 24) && incident.path.points.some(([x]) => x > 38);
      if (spansRiver) expect(crossed).toBe(true);
      else expect(incident.path.total).toBeLessThan(24);
      d.actorRenderer.dispose();
      incident.update(INCIDENT_DURATION);
      incident.update(INCIDENT_DURATION + 1);
      expect(done).toHaveBeenCalledTimes(1);
      expect(incident.root.parent).toBeNull();
      expect(phases).toHaveBeenCalledTimes(3);
    },
  );
});
