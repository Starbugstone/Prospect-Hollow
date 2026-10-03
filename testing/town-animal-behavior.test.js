import { describe, expect, it, vi } from 'vitest';
import { createAnimalBehavior, updateAnimalBehavior } from '../src/game/town/TownAnimalBehavior';

const rules = [
  ['dog', 'cat', 3.4, 2.2],
  ['fox', 'deer', 4.2, 2.6],
  ['cat', 'pigeon', 3, 1.6],
  ['cat', 'bluebird', 3, 1.6],
];
function actor(species, seed = 1, x = 0, y = 0, z = 0) {
  return {
    species,
    seed,
    radius: 0.55,
    height: 0.7,
    speed: 0.75,
    root: { position: { x, y, z }, visible: true, scale: { x: 1 } },
    habitat: { kind: 'ground', point: [x, y, z] },
    state: 'walking',
    rest: 0,
    path: {
      points: [
        [x, y, z],
        [x + 5, y, z],
      ],
      total: 5,
    },
    progress: seed,
  };
}
function fixture(animals = [actor('dog'), actor('cat', 2, 2)], time = 0) {
  const forbiddenPlan = () => {
    throw new Error('Animal decisions must reuse prepared movement paths');
  };
  const navigation = { segment: vi.fn(() => true), plan: vi.fn(forbiddenPlan) },
    space = { segment: vi.fn(() => true), plan: vi.fn(forbiddenPlan) };
  return { animals, navigation, space, ai: createAnimalBehavior(animals, navigation, space, time) };
}
function refs(animals) {
  return animals.map((a) => ({
    position: { ...a.root.position },
    path: a.path,
    progress: a.progress,
  }));
}

describe('Bounded animal encounters', () => {
  it('precomputes only permitted directed predator/prey pairs without an update scan', () => {
    const animals = [
      'dog',
      'cat',
      'fox',
      'deer',
      'pigeon',
      'bluebird',
      'raccoon',
      'hen',
      'willowkinResident',
    ].map((species, i) => actor(species, i));
    const { ai } = fixture(animals),
      pairs = ai.pairs;
    expect(pairs.map((p) => `${p.predator.species}:${p.prey.species}`).sort()).toEqual([
      'cat:bluebird',
      'cat:pigeon',
      'dog:cat',
      'fox:deer',
    ]);
    expect(pairs.every((p) => animals.includes(p.predator) && animals.includes(p.prey))).toBe(true);
    animals.push(actor('cat', 20));
    updateAnimalBehavior(ai, 0.5);
    expect(ai.pairs).toBe(pairs);
    expect(ai.pairs).toHaveLength(4);
  });

  it.each(rules)(
    'starts a brief unobstructed %s → %s encounter',
    (predator, prey, range, duration) => {
      const { ai, animals, navigation, space } = fixture([
        actor(predator),
        actor(prey, 2, range - 0.1),
      ]);
      updateAnimalBehavior(ai, 0.499);
      expect(ai.active).toBeNull();
      expect(navigation.segment).not.toHaveBeenCalled();
      updateAnimalBehavior(ai, 0.5);
      expect(ai.active.predator).toBe(animals[0]);
      expect(ai.active.prey).toBe(animals[1]);
      expect(animals[0].encounter).toBe(ai.active);
      expect(animals[1].encounter).toBe(ai.active);
      expect(ai.active.started).toBe(0.5);
      expect(ai.active.endsAt).toBeCloseTo(0.5 + duration);
      expect(ai.starts).toBe(1);
      expect(navigation.segment).toHaveBeenCalledExactlyOnceWith(
        [0, 0, 0],
        [range - 0.1, 0, 0],
        0.55,
      );
      expect(space.segment).toHaveBeenCalledExactlyOnceWith(
        [0, 0, 0],
        [range - 0.1, 0, 0],
        0.55,
        0.7,
      );
      expect(navigation.plan).not.toHaveBeenCalled();
      expect(space.plan).not.toHaveBeenCalled();
    },
  );

  it.each(rules)(
    'ignores %s → %s beyond its range without collision queries',
    (predator, prey, range) => {
      const { ai, navigation, space } = fixture([actor(predator), actor(prey, 2, range + 0.01)]);
      updateAnimalBehavior(ai, 0.5);
      expect(ai.active).toBeNull();
      expect(navigation.segment).not.toHaveBeenCalled();
      expect(space.segment).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'hidden predator',
      (a) => {
        a[0].root.visible = false;
      },
    ],
    [
      'hidden prey',
      (a) => {
        a[1].root.visible = false;
      },
    ],
    [
      'fading predator',
      (a) => {
        a[0].root.scale.x = 0.95;
      },
    ],
    [
      'fading prey',
      (a) => {
        a[1].root.scale.x = 0.95;
      },
    ],
    [
      'alert predator',
      (a) => {
        a[0].state = 'alert';
      },
    ],
    [
      'alert prey',
      (a) => {
        a[1].state = 'alert';
      },
    ],
    [
      'different elevation',
      (a) => {
        a[1].root.position.y = 0.8;
      },
    ],
  ])('does not start an encounter with %s', (_, change) => {
    const { ai, animals, navigation, space } = fixture();
    change(animals);
    updateAnimalBehavior(ai, 0.5);
    expect(ai.active).toBeNull();
    expect(navigation.segment).not.toHaveBeenCalled();
    expect(space.segment).not.toHaveBeenCalled();
  });

  it.each(['pigeon', 'bluebird'])('only startles a grounded %s', (species) => {
    for (const change of [
      (bird) => {
        bird.flight = { started: 0 };
      },
      (bird) => {
        bird.habitat.kind = 'perch';
      },
      (bird) => {
        bird.habitat = null;
      },
    ]) {
      const { ai, animals, navigation } = fixture([actor('cat'), actor(species, 2, 2)]);
      change(animals[1]);
      updateAnimalBehavior(ai, 0.5);
      expect(ai.active).toBeNull();
      expect(navigation.segment).not.toHaveBeenCalled();
    }
  });

  it.each(['navigation', 'space'])('requires a clear %s segment before starting', (blocked) => {
    const f = fixture();
    f[blocked].segment.mockReturnValue(false);
    updateAnimalBehavior(f.ai, 0.5);
    expect(f.ai.active).toBeNull();
    expect(f.ai.starts).toBe(0);
    expect(f.navigation.segment).toHaveBeenCalledTimes(1);
    expect(f.space.segment).toHaveBeenCalledTimes(blocked === 'navigation' ? 0 : 1);
    expect(f.navigation.plan).not.toHaveBeenCalled();
    expect(f.space.plan).not.toHaveBeenCalled();
  });

  it('keeps one encounter globally and rests both animals on cooldown after it ends', () => {
    const { ai, animals, navigation, space } = fixture([
      actor('dog'),
      actor('cat', 2, 2),
      actor('fox', 3),
      actor('deer', 4, 2),
    ]);
    updateAnimalBehavior(ai, 0.5);
    const first = ai.active,
      endsAt = first.endsAt;
    for (let frame = 1; frame <= 7; frame++) updateAnimalBehavior(ai, 0.5 + frame / 4);
    expect(ai.active).toBe(first);
    expect(ai.starts).toBe(1);
    expect(animals.filter((a) => a.encounter)).toHaveLength(2);
    expect(navigation.segment).toHaveBeenCalledTimes(1);
    expect(space.segment).toHaveBeenCalledTimes(1);
    updateAnimalBehavior(ai, endsAt);
    expect(ai.active).toBeNull();
    for (const a of [first.predator, first.prey]) {
      expect(a.encounter).toBeNull();
      expect(a.rest).toBeGreaterThanOrEqual(0.8);
      expect(a.chaseCooldown).toBeGreaterThanOrEqual(endsAt + 20);
    }
    updateAnimalBehavior(ai, endsAt + 0.01);
    expect(ai.active.predator.species).toBe('fox');
    expect(ai.starts).toBe(2);
    expect(animals.filter((a) => a.encounter)).toHaveLength(2);
  });

  it('honors cooldown for either participant and can resume once both recover', () => {
    const { ai, animals } = fixture();
    updateAnimalBehavior(ai, 0.5);
    const end = ai.active.endsAt;
    updateAnimalBehavior(ai, end);
    const ready = Math.max(...animals.map((a) => a.chaseCooldown));
    animals[0].chaseCooldown = 0;
    updateAnimalBehavior(ai, end + 10);
    expect(ai.active).toBeNull();
    animals[0].chaseCooldown = ready;
    animals[1].chaseCooldown = 0;
    updateAnimalBehavior(ai, end + 11);
    expect(ai.active).toBeNull();
    updateAnimalBehavior(ai, ready + 0.25);
    expect(ai.active).not.toBeNull();
    expect(ai.starts).toBe(2);
  });

  it('uses the last grounded bird position without moving roots or replacing paths', () => {
    const { ai, animals } = fixture([actor('cat'), actor('bluebird', 2, 2, 0.2, 0.5)]),
      before = refs(animals);
    updateAnimalBehavior(ai, 0.5);
    const pair = ai.active;
    expect(pair.goal).toEqual({ x: 2, y: 0.2, z: 0.5 });
    expect(refs(animals)).toEqual(before);
    animals[1].flight = { started: 0.5 };
    Object.assign(animals[1].root.position, { x: 10, y: 3, z: 5 });
    updateAnimalBehavior(ai, 0.75);
    expect(ai.active).toBe(pair);
    expect(pair.goal).toEqual({ x: 2, y: 0.2, z: 0.5 });
    updateAnimalBehavior(ai, pair.endsAt);
    expect(animals[0].root.position).toEqual(before[0].position);
    expect(animals[1].root.position).toEqual({ x: 10, y: 3, z: 5 });
    animals.forEach((a, i) => {
      expect(a.path).toBe(before[i].path);
      expect(a.progress).toBe(before[i].progress);
    });
  });

  it.each(['predator', 'prey'])('ends safely when the %s disappears or is hidden', (role) => {
    for (const remove of [
      (a) => {
        a.root.visible = false;
      },
      (a) => {
        a.root = null;
      },
    ]) {
      const { ai } = fixture();
      updateAnimalBehavior(ai, 0.5);
      const pair = ai.active;
      remove(pair[role]);
      expect(() => updateAnimalBehavior(ai, 0.75)).not.toThrow();
      expect(ai.active).toBeNull();
      expect(pair.predator.encounter).toBeNull();
      expect(pair.prey.encounter).toBeNull();
    }
  });

  it('ends a ground encounter when its actors separate instead of teleporting them', () => {
    const { ai, animals } = fixture();
    updateAnimalBehavior(ai, 0.5);
    animals[1].root.position.x = 9;
    updateAnimalBehavior(ai, 0.75);
    expect(ai.active).toBeNull();
    expect(animals[1].root.position.x).toBe(9);
    expect(animals[0].encounter).toBeNull();
    expect(animals[1].encounter).toBeNull();
  });

  it('pauses decision ticks and encounter deadlines on a frozen village clock', () => {
    const { ai, navigation } = fixture(undefined, 50);
    for (let frame = 0; frame < 120; frame++) updateAnimalBehavior(ai, 50);
    expect(ai.checks).toBe(0);
    expect(ai.nextCheck).toBe(50.5);
    updateAnimalBehavior(ai, 50.5);
    const pair = ai.active,
      deadline = pair.endsAt;
    for (let frame = 0; frame < 120; frame++) updateAnimalBehavior(ai, 50.5);
    updateAnimalBehavior(ai, 49);
    expect(ai.active).toBe(pair);
    expect(pair.endsAt).toBe(deadline);
    expect(ai.checks).toBe(1);
    expect(navigation.segment).toHaveBeenCalledTimes(1);
    updateAnimalBehavior(ai, deadline);
    expect(ai.active).toBeNull();
  });

  it('polls one precomputed pair per decision tick without catching up after a slow frame', () => {
    const { ai, navigation, space } = fixture([
      actor('dog'),
      actor('cat', 2, 2),
      actor('cat', 3, 2),
      actor('fox', 4),
      actor('deer', 5, 2),
    ]);
    space.segment.mockReturnValue(false);
    updateAnimalBehavior(ai, 1000);
    expect(ai.checks).toBe(1);
    expect(ai.nextCheck).toBe(1000.25);
    expect(navigation.segment).toHaveBeenCalledTimes(1);
    expect(space.segment).toHaveBeenCalledTimes(1);
    for (let frame = 0; frame < 120; frame++) updateAnimalBehavior(ai, 1000 + frame / 1000);
    expect(ai.checks).toBe(1);
    updateAnimalBehavior(ai, 1000.25);
    expect(ai.checks).toBe(2);
    // The second pair shares the dog: failed route preparation puts it on a
    // brief cooldown, so checking that pair needs no more geometry work.
    expect(navigation.segment).toHaveBeenCalledTimes(1);
    expect(space.segment).toHaveBeenCalledTimes(1);
    updateAnimalBehavior(ai, 1000.5);
    expect(ai.checks).toBe(3);
    expect(navigation.segment).toHaveBeenCalledTimes(2);
    expect(space.segment).toHaveBeenCalledTimes(2);
    expect(navigation.plan).not.toHaveBeenCalled();
    expect(space.plan).not.toHaveBeenCalled();
  });

  it('does no collision work for an empty or incompatible cast', () => {
    for (const animals of [[], [actor('deer'), actor('hen'), actor('willowkinResident')]]) {
      const { ai, navigation, space } = fixture(animals);
      expect(ai.pairs).toHaveLength(0);
      expect(() => updateAnimalBehavior(ai, 1000)).not.toThrow();
      expect(ai.checks).toBe(0);
      expect(navigation.segment).not.toHaveBeenCalled();
      expect(space.segment).not.toHaveBeenCalled();
    }
    expect(() => updateAnimalBehavior(null, 1)).not.toThrow();
  });
});
