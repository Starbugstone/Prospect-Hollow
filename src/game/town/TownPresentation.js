import { beginEventCamera, restoreEventCamera } from './TownEventCamera';
import { keepCameraAboveTerrain } from './TownLandscape';
import { TownRailwayOpening } from './TownRailwayOpening';
import { TownMineEraConstruction } from './TownMineEraConstruction';

const renderers = { 'railway-opening': TownRailwayOpening, 'era-mine': TownMineEraConstruction };
// Shared camera ownership and cleanup. Content adapters own only temporary visuals.
export class TownPresentation {
  constructor(d, definition) {
    this.d = d;
    this.definition = definition;
    if (!d.eventCamera) beginEventCamera(d);
    this.effect = new renderers[definition.id](d, definition);
  }
  static supports(id) {
    return Object.hasOwn(renderers, id);
  }
  frame(time, still = false) {
    const d = this.d;
    const { eye, focus, shadowPhase } = this.effect.frame(time, still);
    if (!still) {
      const t = Math.min(1, time / 1.4);
      d.camera.position.lerpVectors(d.eventCamera.position, eye, t * t * (3 - 2 * t));
      d.controls.target.lerpVectors(d.eventCamera.target, focus, t * t * (3 - 2 * t));
      keepCameraAboveTerrain(d.camera.position, d.controls.target);
      d.camera.lookAt(d.controls.target);
    }
    for (const motion of d.motions) motion(d.elapsed);
    d.actorRenderer.update();
    const phase = shadowPhase ?? (time < 7 ? 0 : 1);
    if (this.phase !== phase) d.renderer.shadowMap.needsUpdate = true;
    this.phase = phase;
    d.frameCache.valid = false;
    d.render();
  }
  dispose(restore = true) {
    this.effect.dispose();
    if (restore) restoreEventCamera(this.d);
    this.d.renderer.shadowMap.needsUpdate = true;
    this.d.frameCache.valid = false;
  }
}
