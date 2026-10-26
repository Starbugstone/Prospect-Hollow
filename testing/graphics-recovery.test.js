import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { RECOVERY_ATTEMPTS, useGraphicsRecovery } from '../src/composables/useGraphicsRecovery';

// Every settlement map (the valley's TownScene, the Moon's TownMoonView) recovers its
// renderer through this one policy: a lost context rebuilds the scene on a fresh canvas
// with the same camera, a limited number of times; anything else shows the fallback.
function harness() {
  const made = [];
  const make = () => ({
    camera: { position: new Vector3(0, 26, 66) },
    controls: { target: new Vector3(0, 0, 4), update: vi.fn() },
    overview: true,
    render: vi.fn(),
    dispose: vi.fn(),
  });
  let scene = make();
  made.push(scene);
  const fail = vi.fn();
  const recovery = useGraphicsRecovery({
    scene: () => scene,
    release: () => {
      scene.dispose();
      scene = null;
    },
    restart: () => {
      scene = make();
      made.push(scene);
      recovery.restorePose(scene);
    },
    fail,
  });
  return { recovery, made, fail, current: () => scene };
}

it('rebuilds a lost scene on a fresh canvas with the same camera', async () => {
  const { recovery, made, fail, current } = harness();
  made[0].camera.position.set(10, 12, 30);
  made[0].controls.target.set(5, 0, -3);
  made[0].overview = false;
  await recovery.recover(new Error('lost'), true);
  expect(made[0].dispose).toHaveBeenCalledOnce();
  expect(recovery.canvasVersion.value).toBe(1);
  expect(current()).toBe(made[1]);
  expect(current().camera.position.toArray()).toEqual([10, 12, 30]);
  expect(current().controls.target.toArray()).toEqual([5, 0, -3]);
  expect(current().overview).toBe(false);
  expect(current().render).toHaveBeenCalledOnce();
  expect(fail).not.toHaveBeenCalled();
});

it(`falls back after ${RECOVERY_ATTEMPTS} rebuilds, and at once for other failures`, async () => {
  const { recovery, made, fail } = harness();
  for (let n = 0; n < RECOVERY_ATTEMPTS; n++) await recovery.recover(new Error('lost'), true);
  expect(made).toHaveLength(RECOVERY_ATTEMPTS + 1);
  const error = new Error('lost again');
  await recovery.recover(error, true);
  expect(fail).toHaveBeenCalledWith(error);
  expect(made).toHaveLength(RECOVERY_ATTEMPTS + 1);
  // The player's retry starts afresh.
  await recovery.retry();
  await recovery.recover(new Error('lost'), true);
  expect(made).toHaveLength(RECOVERY_ATTEMPTS + 3);
  const other = harness();
  const broken = new Error('no WebGL');
  await other.recovery.recover(broken);
  expect(other.fail).toHaveBeenCalledWith(broken);
  expect(other.made).toHaveLength(1);
});

it('ignores a second loss while a rebuild is under way', async () => {
  const { recovery, made } = harness();
  const first = recovery.recover(new Error('lost'), true);
  expect(recovery.recovering).toBe(true);
  await recovery.recover(new Error('lost'), true);
  await first;
  expect(made).toHaveLength(2);
  expect(recovery.recovering).toBe(false);
});
