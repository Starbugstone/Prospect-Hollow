import { Vector3 } from 'three';
import { MOON_LOTS } from '../../../data/moonSettlement';

// A Moon opening reuses the shared caption/skip/acknowledgement clock. Only its
// camera belongs here; no valley renderer, duplicate scene or gameplay mutation.
export class MoonPresentation {
  constructor(scene, definition) {
    this.scene = scene;
    this.definition = definition;
    this.eye = scene.camera.position.clone();
    this.target = scene.controls.target.clone();
    this.enabled = scene.controls.enabled;
    const [x, z] = MOON_LOTS[definition.building] ?? [0, 0];
    this.focus = new Vector3(x, 2, z);
    this.closeEye = new Vector3(x + 16, 18, z + 25);
    scene.controls.enabled = false;
  }
  frame(time, still = false) {
    const scene = this.scene;
    const t = still ? 1 : Math.max(0, Math.min(1, time / 1.4));
    const eased = t * t * (3 - 2 * t);
    scene.camera.position.lerpVectors(this.eye, this.closeEye, eased);
    scene.controls.target.lerpVectors(this.target, this.focus, eased);
    scene.camera.lookAt(scene.controls.target);
    scene.viewChanged = true;
    scene.render();
  }
  dispose() {
    const scene = this.scene;
    scene.camera.position.copy(this.eye);
    scene.controls.target.copy(this.target);
    scene.controls.enabled = this.enabled;
    scene.controls.update();
    scene.requestFrame();
  }
}
