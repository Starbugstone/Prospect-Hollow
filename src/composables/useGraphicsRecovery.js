import { nextTick, ref } from 'vue';

// Every settlement map recovers its renderer the same way, the valley (TownScene) and
// the Moon (TownMoonView) alike. A lost WebGL context rebuilds the scene on a fresh
// canvas (`canvasVersion` keys it), keeping the camera, up to RECOVERY_ATTEMPTS times;
// any other failure, or one more loss, shows the map's fallback.
export const RECOVERY_ATTEMPTS = 2;

/**
 * `scene()` reads the current scene; `release()` disposes it and clears the owner's
 * state for it; `restart()` builds a new one; `fail(error)` shows the fallback.
 */
export function useGraphicsRecovery({ scene, release, restart, fail }) {
  const canvasVersion = ref(0);
  let attempts = 0,
    recovering = false,
    pose = null;
  async function rebuild() {
    canvasVersion.value++;
    await nextTick();
    recovering = false;
    restart();
  }
  return {
    canvasVersion,
    get recovering() {
      return recovering;
    },
    async recover(error, contextLost = false) {
      if (recovering) return;
      if (!contextLost || attempts++ >= RECOVERY_ATTEMPTS) {
        fail(error);
        return;
      }
      recovering = true;
      const current = scene();
      if (current)
        pose = {
          position: current.camera.position.toArray(),
          target: current.controls.target.toArray(),
          overview: current.overview,
        };
      release();
      await rebuild();
    },
    /** The player's retry after the fallback: a fresh canvas and a fresh allowance. */
    retry() {
      attempts = 0;
      return rebuild();
    },
    /** A rebuilt scene takes the camera the lost one had. */
    restorePose(current) {
      if (!pose || !current) return;
      current.camera.position.fromArray(pose.position);
      current.controls.target.fromArray(pose.target);
      current.overview = pose.overview;
      current.controls.update();
      current.render();
      pose = null;
    },
  };
}
