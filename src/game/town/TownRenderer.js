// Renderer plumbing shared by every settlement map: the valley's TownDiorama and the
// Moon's MoonScene.

/**
 * A lost WebGL context stops the map's loop and hands recovery to its owner
 * (useGraphicsRecovery), which disposes the scene and rebuilds it on a fresh canvas.
 * No buffers or cached attachments cross graphics contexts. `d` provides `renderer`,
 * an optional `frameCache` and `onUnavailable(error, contextLost)`.
 */
export function loseContext(d, event) {
  event.preventDefault();
  d.contextUnavailable = true;
  if (d.frameCache) d.frameCache.valid = false;
  d.renderer.setAnimationLoop(null);
  d.onUnavailable?.(new Error('Town graphics context lost'), true);
}

/** Listens for `d.canvas` losing its context; returns the listener's remover. */
export function watchContextLoss(d) {
  const lost = (event) => d.handleContextLoss(event);
  d.canvas.addEventListener('webglcontextlost', lost);
  return () => d.canvas.removeEventListener('webglcontextlost', lost);
}
