import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownEraIncident, INCIDENT_SPEED } from '../src/game/town/TownEraIncident';
import { PLOTS } from '../src/game/town/TownLayout';
import { BRIDGE } from '../src/game/town/TownRiver';
import { createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { raidProtection } from '../src/game/town/TownRules';
import {
  CARGO_CRATES,
  INCIDENT_BEATS,
  civicIncident,
  eraEventKind,
  incidentScript,
  incidentStory,
  phaseAt,
} from '../src/data/townEvents';

function diorama(era = 'river-rail') {
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
  d.town = createTown();
  d.town.era = era;
  Object.assign(d.town.buildings, {
    bridge: 3,
    riverPort: 1,
    railDepot: 1,
    warehouse: 1,
    powerHouse: 1,
    fireStation: 1,
    mill: 1,
  });
  return d;
}
// A receipt exactly as the rules would save it for these defenses.
function cargoReceipt(gangSize, sheriffLevel, bankLevel, target = 'riverPort') {
  const protection = raidProtection(
    { buildings: { sheriff: sheriffLevel, bank: bankLevel } },
    gangSize,
    'cargo-theft',
  );
  const loss = protection === 1 ? 0 : Math.min(30, Math.ceil(5 * gangSize * (1 - protection)));
  return {
    id: 1,
    kind: 'cargo-theft',
    gangSize,
    sheriffLevel,
    bankLevel,
    targets: [target],
    outcome: protection === 1 ? 'protected' : loss ? 'stolen' : 'harmless',
    loss,
  };
}
const beats = (time) => time / INCIDENT_SPEED;
function play(event, era, onFrame, onCue) {
  const d = diorama(era);
  const phases = vi.fn(),
    done = vi.fn();
  const scene = new TownEraIncident(d, event, PLOTS, phases, done, onCue);
  for (let step = 0; step <= INCIDENT_BEATS * 10; step++) {
    const time = step / 10;
    scene.update(beats(time));
    if (!scene.disposed) onFrame?.(scene, time);
  }
  expect(done).toHaveBeenCalledOnce();
  return { phases: phases.mock.calls.map(([phase]) => phase), scene };
}

describe('Cargo theft follows the saved defenses', () => {
  const receipts = [];
  for (const gang of [2, 4, 6, 8, 10])
    for (let sheriff = 0; sheriff <= 5; sheriff++)
      for (let bank = 0; bank <= 5; bank++) receipts.push(cargoReceipt(gang, sheriff, bank));

  it.each(receipts.map((event) => [event.gangSize, event.sheriffLevel, event.bankLevel, event]))(
    'gang %i, police %i, bank %i: the patrol is never too late and losses leave with a thief',
    (gang, sheriff, bank, event) => {
      const script = incidentScript(event);
      expect(script.caught + script.escaped).toBe(script.thieves);
      if (script.responders) {
        // At least one thief is still at the scene to be caught.
        expect(script.caught).toBeGreaterThan(0);
        if (script.escaped) expect(script.scatter).toBeGreaterThan(script.arrive - 3);
        expect(script.phases.map(([, phase]) => phase)).toContain('Hands up!');
      } else {
        expect(script.phases.map(([, phase]) => phase)).not.toContain('Hands up!');
      }
      if (event.outcome === 'protected') {
        expect(script.escaped).toBe(0);
        expect(phaseAt(script, INCIDENT_BEATS)).toBe('The cargo is safe');
      }
      if (event.loss) {
        expect(script.carried).toBeGreaterThan(0);
        expect(script.locked).toBeLessThan(CARGO_CRATES);
      } else expect(script.carried).toBe(0);
    },
  );

  it('catches more thieves with a stronger patrol and loses less cargo with a stronger bank', () => {
    for (const gang of [4, 6, 8, 10]) {
      for (let level = 1; level < 5; level++) {
        expect(incidentScript(cargoReceipt(gang, level + 1, 0)).caught).toBeGreaterThanOrEqual(
          incidentScript(cargoReceipt(gang, level, 0)).caught,
        );
        expect(incidentScript(cargoReceipt(gang, 1, level + 1)).locked).toBeGreaterThanOrEqual(
          incidentScript(cargoReceipt(gang, 1, level)).locked,
        );
      }
    }
  });

  it.each(['riverPort', 'warehouse', 'railDepot'])(
    'at the %s, officers reach the thieves before anyone flees, and escapees run away from them',
    (target) => {
      const event = cargoReceipt(8, 2, 1, target);
      const script = incidentScript(event);
      expect(script.escaped).toBeGreaterThan(0);
      let leadSeenBeforeScatter = false;
      const fleeing = new Map();
      const { phases, scene } = play(event, 'river-rail', (scene, time) => {
        const lead = scene.officers[0];
        if (time < script.scatter && lead.root.visible) leadSeenBeforeScatter = true;
        scene.thieves.slice(0, script.thieves).forEach((thief, n) => {
          if (time < script.scatter) expect(thief.fled, `${n} at ${time}`).toBe(false);
          if (!thief.fled || !thief.root.visible) return;
          // Each step of the escape increases the gap to the arriving patrol.
          const gap = thief.root.position.distanceTo(lead.root.position);
          if (fleeing.has(thief) && time > script.arrive)
            expect(gap, `${n} at ${time}`).toBeGreaterThanOrEqual(fleeing.get(thief) - 0.05);
          fleeing.set(thief, gap);
        });
        if (Math.abs(time - (script.arrive + 1)) < 0.05)
          for (let n = 0; n < script.caught; n++) {
            const thief = scene.thieves[n];
            expect(thief.root.visible).toBe(true);
            // Surrendered with raised hands, facing an officer standing close by.
            expect(Math.abs(thief.arms[0].upper.rotation.z)).toBeGreaterThan(2);
            const nearest = Math.min(
              ...scene.crew.map((officer) => officer.root.position.distanceTo(thief.root.position)),
            );
            expect(nearest).toBeLessThan(2.5);
          }
        if (Math.abs(time - (script.arrive + 1)) < 0.05) {
          const stolen = scene.crates.filter((crate) => !crate.visible).length;
          expect(stolen).toBe(script.carried);
          expect(scene.crates.filter((crate) => crate.bands.visible)).toHaveLength(script.locked);
        }
      });
      expect(leadSeenBeforeScatter).toBe(true);
      expect(fleeing.size).toBe(script.escaped);
      expect(phases).toEqual(script.phases.map(([, phase]) => phase));
      expect(phases.at(-1)).toBe('Some cargo got away');
      expect(scene.root.parent).toBeNull();
    },
  );

  it('marches every prisoner off ahead of the patrol and ends with the cargo safe', () => {
    const event = cargoReceipt(4, 2, 2);
    const script = incidentScript(event);
    expect(script.caught).toBe(script.thieves);
    let marched = false;
    play(event, 'river-rail', (scene, time) => {
      expect(scene.thieves.some((thief) => thief.fled)).toBe(false);
      if (time > script.escort + 3) {
        marched = true;
        for (const thief of scene.thieves.slice(0, script.caught)) {
          expect(thief.root.visible).toBe(true);
          expect(thief.loot.visible).toBe(false);
          const nearest = Math.min(
            ...scene.crew.map((officer) => officer.root.position.distanceTo(thief.root.position)),
          );
          expect(nearest).toBeLessThan(1 + script.caught);
        }
      }
      if (time > script.arrive) expect(scene.crates.every((crate) => crate.visible)).toBe(true);
    });
    expect(marched).toBe(true);
  });

  it('shows an unanswered alarm when there is no patrol, and nobody is caught', () => {
    const event = cargoReceipt(4, 0, 0);
    const script = incidentScript(event);
    const { phases } = play(event, 'river-rail', (scene) => {
      expect(scene.officers.every((officer) => !officer.root.visible)).toBe(true);
    });
    expect(script.caught).toBe(0);
    expect(phases).toContain('No patrol answers the alarm');
    expect(phases.at(-1)).toBe('The thieves get away with cargo');
    expect(incidentStory(event).title).toBe('Trouble at the freight yard');
  });

  it('recasts a late reinforcement before the reveal and keeps the staged facts afterwards', () => {
    const d = diorama();
    const weak = cargoReceipt(4, 0, 0);
    const scene = new TownEraIncident(d, weak, PLOTS, vi.fn(), vi.fn());
    scene.update(beats(5));
    const strong = cargoReceipt(4, 2, 2);
    scene.updateEvent(strong);
    expect(scene.script.responders).toBe(2);
    for (let time = 5; time < incidentScript(strong).arrive + 1; time += 0.1)
      scene.update(beats(time));
    // The late officers start closer, arrive in time and the thieves surrender.
    expect(scene.crew.every((officer) => officer.root.visible)).toBe(true);
    expect(scene.thieves.slice(0, 2).every((thief) => !thief.fled)).toBe(true);
    scene.updateEvent(weak);
    expect(scene.script.responders).toBe(2);
    scene.dispose();
  });
});

describe('Frontier and civic incidents only claim what the town can show', () => {
  it('never shouts "Hands up!" when no sheriff rode out', () => {
    const script = incidentScript({ gangSize: 4, sheriffLevel: 0, outcome: 'stolen', loss: 20 });
    expect(script.phases.map(([, phase]) => phase)).not.toContain('Hands up!');
    expect(phaseAt(script, 18)).toBe('Nobody stops the gang');
    expect(phaseAt(incidentScript({ gangSize: 4, sheriffLevel: 1, loss: 10 }), 18)).toBe(
      'Hands up!',
    );
  });

  it.each(['workshop-fire', 'storm-cleanup'])(
    'a stronger fire station resolves %s sooner and smaller',
    (kind) => {
      const scripts = [0, 1, 2, 3].map((level) =>
        incidentScript({
          kind,
          fireStationLevel: level,
          loss: level === 3 ? 0 : 5,
          outcome: level === 3 ? 'protected' : 'stolen',
        }),
      );
      for (let level = 1; level < 4; level++) {
        expect(scripts[level].resolved).toBeLessThanOrEqual(scripts[level - 1].resolved);
        expect(scripts[level].intensity).toBeLessThanOrEqual(scripts[level - 1].intensity);
      }
      expect(scripts[0].brigade).toBe(false);
      expect(scripts[0].phases.map(([, phase]) => phase).join()).toMatch(/Neighbors/);
    },
  );

  it.each([
    [0, 'stolen', 12, true],
    [1, 'stolen', 5, true],
    [3, 'protected', 0, false],
  ])(
    'fire station level %i leaves soot only when the town paid for cleanup',
    (fireStationLevel, outcome, loss, sooty) => {
      const event = {
        id: 1,
        kind: 'workshop-fire',
        fireStationLevel,
        targets: ['mill'],
        outcome,
        loss,
      };
      const script = incidentScript(event);
      let peak = 0;
      const { scene } = play(event, 'industrial', (scene, time) => {
        const flame = scene.flames.filter((f) => f.visible).length;
        if (time > script.resolved + 0.2) expect(flame).toBe(0);
        if (time <= script.arrive) peak = Math.max(peak, scene.flames[0].scale.y);
        if (Math.abs(time - INCIDENT_BEATS + 0.5) < 0.05)
          expect(scene.scorch.some((patch) => patch.visible)).toBe(sooty);
        if (time > script.arrive + 2 && time < script.leave - 2)
          expect(scene.crew.every((actor) => actor.root.visible)).toBe(true);
      });
      expect(!!scene.vehicle).toBe(fireStationLevel > 0);
      if (!sooty) expect(peak).toBeLessThan(0.5);
      expect(incidentStory(event).text).not.toMatch(
        fireStationLevel ? /bucket/ : /brigade protected/,
      );
    },
  );

  // Timber and road bridges share one deck profile; the van must ride both like traffic.
  it.each(ERAS.map(({ id }) => id).filter((era) => civicIncident(eraEventKind(era))))(
    'pitches the %s response vehicle down and back up the bridge ramp',
    (era) => {
      const event = {
        id: 1,
        kind: eraEventKind(era),
        fireStationLevel: 1,
        // A call beyond the river: the van drives down off the bridge and back up.
        targets: ['mill'],
        outcome: 'stolen',
        loss: 5,
      };
      const front = new Vector3(),
        axle = new Vector3(),
        ramps = new Set();
      play(event, era, (scene) => {
        const van = scene.vehicle?.root;
        if (!van?.visible) return;
        axle.set(1, 0, 0).applyQuaternion(van.quaternion);
        expect(axle.y).toBeCloseTo(0, 8); // Pitch must never become sideways roll.
        const { x, z } = van.position;
        const fromCenter = Math.abs(x - BRIDGE.centerX);
        if (Math.abs(z - BRIDGE.z) > 0.3 || fromCenter < 4.6 || fromCenter > 6.2) return;
        front.set(0, 0, 1).applyQuaternion(van.quaternion);
        const climbing = Math.sign(front.x) === Math.sign(BRIDGE.centerX - x);
        expect(Math.sign(front.y), `${era} at x ${x}`).toBe(climbing ? 1 : -1);
        expect(Math.abs(front.y)).toBeGreaterThan(0.4);
        ramps.add(climbing ? 'up' : 'down');
      });
      expect([...ramps].sort()).toEqual(['down', 'up']);
    },
  );

  it('clears the storm debris while the crew works and leaves the promenade open', () => {
    const event = {
      id: 1,
      kind: 'storm-cleanup',
      fireStationLevel: 1,
      targets: ['warehouse'],
      outcome: 'stolen',
      loss: 6,
    };
    const script = incidentScript(event);
    play(event, 'contemporary', (scene, time) => {
      if (time < script.arrive) expect(scene.debris.visible).toBe(true);
      if (time > script.resolved) {
        expect(scene.debris.visible).toBe(false);
        expect(scene.branches.every((branch) => !branch.visible)).toBe(true);
      }
    });
  });
});

describe('Incident sound follows what is on screen', () => {
  // Record each cue with the beat it was heard on.
  function listen(event, era) {
    const heard = [];
    play(
      event,
      era,
      (scene, time) => heard.forEach((cue) => (cue.beat ??= time)),
      (cue) => heard.push({ ...cue }),
    );
    return heard;
  }
  const fire = (fireStationLevel, loss) => ({
    id: 5,
    kind: 'workshop-fire',
    fireStationLevel,
    targets: ['mill'],
    outcome: loss ? 'stolen' : 'protected',
    loss,
  });

  it.each([0, 1, 3])('crackles until fire station level %i puts the fire out', (level) => {
    const event = fire(level, level === 3 ? 0 : 10);
    const script = incidentScript(event);
    const heard = listen(event, 'industrial');
    const crackle = heard.filter((cue) => cue.kind === 'fire-crackle');
    expect(crackle.map((cue) => !!cue.stop)).toEqual([false, true]);
    expect(crackle[1].beat).toBeGreaterThanOrEqual(script.resolved);
    expect(heard.every((cue) => cue.raidId === 5)).toBe(true);
    const kinds = new Set(heard.map((cue) => cue.kind));
    // A brigade rings and sprays; neighbors throw buckets while the fire burns.
    expect(kinds.has('fire-bell')).toBe(level > 0);
    expect(kinds.has('fire-hose')).toBe(level > 0);
    expect(kinds.has('bucket-splash')).toBe(level === 0);
    for (const cue of heard.filter((cue) => cue.kind === 'bucket-splash'))
      expect(cue.beat).toBeLessThan(script.resolved);
  });

  it('whistles only when a patrol answers, and plays the break-in once per beat', () => {
    const patrol = listen(cargoReceipt(8, 2, 1, 'warehouse'), 'river-rail');
    expect(patrol.filter((cue) => cue.kind === 'patrol-whistle')).toHaveLength(2);
    const script = incidentScript(cargoReceipt(8, 2, 1, 'warehouse'));
    // The second blast is the patrol reaching the thieves, not a late echo.
    expect(patrol.filter((cue) => cue.kind === 'patrol-whistle')[1].beat).toBeCloseTo(
      script.scatter,
      0,
    );
    const alone = listen(cargoReceipt(4, 0, 0, 'warehouse'), 'river-rail');
    expect(alone.map((cue) => cue.kind)).toEqual(['crate-break', 'crate-break']);
  });

  it('never replays missed one-shots after a skipped clock, but still stops its loops', () => {
    const d = diorama('contemporary');
    const heard = [];
    const event = {
      id: 9,
      kind: 'storm-cleanup',
      fireStationLevel: 1,
      targets: ['warehouse'],
      outcome: 'stolen',
      loss: 5,
    };
    const scene = new TownEraIncident(d, event, PLOTS, vi.fn(), vi.fn(), (cue) => heard.push(cue));
    const script = incidentScript(event);
    scene.update(beats((script.arrive + script.resolved) / 2));
    expect(heard.map((cue) => cue.kind)).toEqual(['chainsaw']);
    scene.update(beats(script.resolved + 1));
    expect(heard.at(-1)).toMatchObject({ kind: 'chainsaw', stop: true });
    scene.dispose();
  });
});
