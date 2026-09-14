import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Matrix4, Scene, Vector3 } from 'three';
import { TownActors } from '../src/game/town/TownActors';
import { TownDiorama, PLOTS } from '../src/game/town/TownDiorama';
import { SHERIFF_PATROL } from '../src/game/town/TownLayout';
import { TownRaid, RAID_DURATION, mountedRider } from '../src/game/town/TownActivity';
import { addTownLife } from '../src/game/town/TownLife';
import { createTown } from '../src/data/town';
import { routeBetween, plotStreet } from '../src/game/town/TownLayout';
import { riverDistance, RIVER } from '../src/game/town/TownRiver';

// Exercise articulated geometry and its timeline without requiring a GPU.
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
  d.elapsed = 0;
  d.actors = [];
  d.motions = [];
  return d;
}
describe('A visible, articulated frontier encounter', () => {
  it('adds bounded daily life as buildings open and advances it without changing the town', () => {
    const d = diorama(),
      town = createTown();
    addTownLife(d, town);
    expect(d.motions).toHaveLength(0);
    Object.assign(town.buildings, { home: 3, farm: 3, well: 3, square: 1, saloon: 1 });
    const saved = JSON.stringify(town);
    addTownLife(d, town);
    const dog = d.world.getObjectByName('Village dog');
    expect(d.world.children.filter((child) => child.name === 'Farmyard hen')).toHaveLength(3);
    expect(d.actors.filter((actor) => actor.root.name === 'Neighbors chatting')).toHaveLength(2);
    expect(d.motions.length).toBeLessThanOrEqual(10);
    const count = d.world.children.length;
    d.motions.forEach((motion) => motion(1));
    const before = dog.position.clone();
    d.motions.forEach((motion) => motion(7));
    expect(dog.position.distanceTo(before)).toBeGreaterThan(0.1);
    for (let time = 0; time < 100; time++) {
      d.actors.forEach((actor) => d.animatePerson(actor, time));
      d.motions.forEach((motion) => motion(time));
    }
    expect(d.world.children).toHaveLength(count);
    expect(JSON.stringify(town)).toBe(saved);
  });
  it('keeps cross-river residents on the bridge deck without smoothing corners into water', () => {
    const d = diorama(),
      town = createTown();
    town.era = 'river-rail';
    town.buildings.bridge = 1;
    town.buildings.home5 = 1;
    const actor = d.person({
      color: '#809080',
      skin: '#cba17a',
      hat: '#a08b64',
      seed: 0,
      linear: true,
      route: routeBetween(town, plotStreet('home5'), plotStreet('saloon')),
    });
    for (let i = 0; i <= 400; i++) {
      const point = actor.curve.getPointAt(i / 400);
      if (riverDistance(point.x, point.z) < RIVER.halfWidth) {
        expect(point.z).toBeCloseTo(7.5);
        expect(point.y).toBeGreaterThan(0.3);
      }
    }
  });
  it('gives the village sheriff a badge and a visible loop along both main streets', () => {
    const d = diorama();
    const sheriff = d.person({
      color: '#315d83',
      skin: '#c99d74',
      hat: '#f0d390',
      route: SHERIFF_PATROL,
      seed: 0,
      sheriff: true,
      loop: true,
    });
    expect(sheriff.root.name).toBe('Village sheriff');
    expect(d.geometries.badge).toBeDefined();
    const positions = Array.from({ length: 40 }, (_, i) => sheriff.curve.getPointAt(i / 40));
    expect(Math.min(...positions.map((p) => p.x))).toBeLessThan(-3);
    expect(Math.max(...positions.map((p) => p.x))).toBeGreaterThan(3);
    expect(Math.min(...positions.map((p) => p.z))).toBeLessThan(-8);
    expect(Math.max(...positions.map((p) => p.z))).toBeGreaterThan(15);
    d.animatePerson(sheriff, 0);
    const start = sheriff.root.position.clone();
    d.animatePerson(sheriff, 4);
    expect(sheriff.root.visible).toBe(true);
    expect(sheriff.root.position.distanceTo(start)).toBeGreaterThan(1);
  });

  it('draws shared actor parts together, follows moving joints, and hides indoor visitors', () => {
    const scene = new Scene(),
      root = new Group(),
      joint = new Group();
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    const first = new Mesh(geometry, material),
      second = new Mesh(geometry, material);
    scene.add(root);
    root.add(first, joint);
    joint.add(second);
    const renderer = new TownActors(scene);
    renderer.rebuild([root]);
    expect(renderer.buckets).toHaveLength(1);
    expect(renderer.buckets[0].mesh.count).toBe(2);
    root.position.x = 3;
    joint.position.y = 2;
    renderer.update();
    const matrix = new Matrix4();
    renderer.buckets[0].mesh.getMatrixAt(1, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([3, 2, 0]);
    joint.visible = false;
    renderer.update();
    expect(renderer.buckets[0].mesh.count).toBe(1);
    root.visible = false;
    renderer.update();
    expect(renderer.buckets[0].mesh.count).toBe(0);
    renderer.dispose();
    expect(renderer.group.parent).toBeNull();
  });
  it('rides in, signals a robbery, carries loot out, and removes the cast on completion', () => {
    const d = diorama(),
      complete = vi.fn(),
      phase = vi.fn();
    const event = {
      gangSize: 4,
      sheriffLevel: 1,
      targets: ['mine', 'saloon'],
      outcome: 'stolen',
      loss: 10,
    };
    const saved = JSON.stringify(event);
    const raid = new TownRaid(d, event, PLOTS, phase, complete);
    expect(raid.bandits).toHaveLength(4);
    expect(raid.patrol).toHaveLength(1);
    expect(raid.bandits[0].root.position.x).toBeGreaterThan(10);
    raid.update(8.21 / 2);
    expect(phase).toHaveBeenLastCalledWith('Warning shots');
    expect(raid.bandits[0].gun.visible).toBe(true);
    expect(raid.bandits[0].flash.visible).toBe(true);
    raid.update(12.5 / 2);
    expect(raid.bandits[0].loot.visible).toBe(false); // Chased off by the existing sheriff.
    expect(raid.bandits[3].loot.visible).toBe(true);
    const before = raid.bandits[3].root.position.clone();
    raid.update(21 / 2);
    expect(raid.bandits[3].root.position.distanceTo(before)).toBeGreaterThan(1);
    expect(raid.update(RAID_DURATION)).toBe(true);
    expect(complete).toHaveBeenCalledOnce();
    expect(raid.root.parent).toBeNull();
    expect(JSON.stringify(event)).toBe(saved);
  });
  it('pairs every sheriff with visible prisoners, keeps the fountain clear, and spaces the escort', () => {
    const raid = new TownRaid(
      diorama(),
      {
        id: 7,
        gangSize: 10,
        sheriffLevel: 5,
        targets: ['mine', 'bank'],
        outcome: 'protected',
        loss: 0,
      },
      PLOTS,
      vi.fn(),
      vi.fn(),
    );
    raid.update(20 / 2);
    expect(
      raid.bandits.every((a) => a.captured && a.loop.visible && a.rope.visible && !a.gun.visible),
    ).toBe(true);
    for (let sheriff = 0; sheriff < 5; sheriff++)
      expect(raid.bandits.filter((a) => a.captor === sheriff)).toHaveLength(2);
    for (let t = 8; t < RAID_DURATION * 2; t += 0.1) {
      raid.update(t / 2);
      const actors = [...raid.bandits, ...raid.patrol].filter((a) => a.root.visible);
      for (const actor of actors) {
        const p = actor.root.position;
        expect(Math.hypot(p.x - PLOTS.square[0], p.z - PLOTS.square[1])).toBeGreaterThan(2.8);
      }
      for (let i = 0; i < actors.length; i++)
        for (let j = i + 1; j < actors.length; j++)
          expect(
            actors[i].root.position.distanceTo(actors[j].root.position),
            `riders ${i}/${j} at ${t.toFixed(1)}`,
          ).toBeGreaterThan(1.15);
    }
    raid.dispose();
  });
  it('moves continuously through raid phases and eases combat poses', () => {
    const d = diorama();
    const raid = new TownRaid(
      d,
      { id: 1, gangSize: 10, sheriffLevel: 5, outcome: 'protected', loss: 0 },
      PLOTS,
      vi.fn(),
      vi.fn(),
    );
    let previous = new Map();
    for (let time = 0; time < RAID_DURATION; time += 0.02) {
      raid.update(time);
      for (const actor of [...raid.bandits, ...raid.patrol]) {
        if (actor.root.visible && previous.has(actor))
          expect(
            actor.root.position.distanceTo(previous.get(actor)),
            `rider at ${time}`,
          ).toBeLessThan(0.3);
        if (actor.root.visible) previous.set(actor, actor.root.position.clone());
        else previous.delete(actor);
      }
    }
    const actor = mountedRider(d, d.world);
    actor.animate(0, false);
    const arm = actor.rider.arms[1].upper;
    const before = arm.rotation.x;
    actor.animate(0.02, false, true);
    expect(Math.abs(arm.rotation.x - before)).toBeLessThan(0.3);
    actor.animate(0.5, false, true);
    expect(arm.rotation.x).toBeCloseTo(-1.65, 2);
    actor.animate(0.52, false, false, true);
    expect(Math.abs(arm.rotation.z)).toBeLessThan(0.7);
    raid.dispose();
  });
  it('synchronizes each shot and vocal cue once and never emits after disposal', () => {
    const cue = vi.fn();
    const raid = new TownRaid(
      diorama(),
      { id: 7, gangSize: 2, sheriffLevel: 1, targets: ['mine'], outcome: 'protected' },
      PLOTS,
      vi.fn(),
      vi.fn(),
      cue,
    );
    raid.update(8.21 / 2);
    expect(raid.bandits[0].flash.visible).toBe(true);
    expect(cue).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'bandit-shot', raidId: 7 }),
    );
    raid.update(8.22 / 2);
    expect(cue).toHaveBeenCalledOnce();
    raid.update(12.21 / 2);
    expect(cue).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'yeehaw' }));
    raid.update(14.31 / 2);
    expect(raid.patrol[0].flash.visible).toBe(true);
    expect(cue).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'sheriff-shot' }));
    raid.dispose();
    raid.update(15 / 2);
    expect(cue).toHaveBeenCalledTimes(3);
  });
  it('updates protection and adds a patrol without restarting the running raid', () => {
    const d = diorama(),
      complete = vi.fn();
    const raid = new TownRaid(
      d,
      {
        id: 1,
        gangSize: 2,
        sheriffLevel: 0,
        bankLevel: 0,
        targets: ['mine', 'home'],
        outcome: 'stolen',
        loss: 10,
      },
      PLOTS,
      vi.fn(),
      complete,
    );
    raid.update(12.5 / 2);
    expect(raid.bandits.some((actor) => actor.loot.visible)).toBe(true);
    const started = raid.started;
    raid.updateEvent({
      ...raid.event,
      sheriffLevel: 1,
      bankLevel: 1,
      outcome: 'protected',
      loss: 0,
    });
    raid.update(13 / 2);
    expect(raid.started).toBe(started);
    expect(raid.patrol).toHaveLength(1);
    expect(raid.bandits.every((actor) => !actor.loot.visible)).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    raid.update(RAID_DURATION);
    expect(complete).toHaveBeenCalledOnce();
  });
  it('shows a full patrol with no loot for a protected town', () => {
    const d = diorama(),
      phase = vi.fn();
    const raid = new TownRaid(
      d,
      { gangSize: 6, sheriffLevel: 3, targets: ['mine', 'saloon'], outcome: 'protected', loss: 0 },
      PLOTS,
      phase,
      vi.fn(),
    );
    raid.update(14.5 / 2);
    expect(phase).toHaveBeenLastCalledWith('The law holds the line');
    expect(raid.patrol.filter((actor) => actor.root.visible)).toHaveLength(3);
    expect(raid.bandits.every((actor) => !actor.loot.visible)).toBe(true);
    raid.dispose();
    expect(raid.root.parent).toBeNull();
  });
});
