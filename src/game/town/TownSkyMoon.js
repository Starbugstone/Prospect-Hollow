import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from 'three';
import { SKY_MOON_ANGLE, SKY_MOON_DIRECTION, SKY_MOON_ELEVATION } from '../../data/skyCraft';

// The Moon in the valley sky: the round Moon of the map chip (TownMoon.vue) painted on
// a sprite, never a 3D globe, like Earth over the Moon's crater rim. It keeps one
// direction in the sky (SKY_MOON_DIRECTION, SKY_MOON_ELEVATION), drawn beyond the town
// so nearer hills pass in front of it, and birds and saucers, drawn in the animated
// foreground, fly in front of it. Each gold light is a homestead of New Hollow.
const TEXTURE = 256;
// The chip's art spans ±12 units around a disc of radius 11; the glow reaches ±15.
const ART = 15,
  DISC = 11;
const SHADED = 'M3 -10.6A11 11 0 0 1 3 10.6A14 14 0 0 0 3 -10.6Z';
// Drawn this far from the camera: past the town and its nearer hills, inside the far plane.
export const SKY_MOON_DISTANCE = 450;
const DIAMETER = 2 * SKY_MOON_DISTANCE * Math.tan(SKY_MOON_ANGLE / 2);
export const SKY_MOON_HEADING = new Vector3(SKY_MOON_DIRECTION[0], 0, SKY_MOON_DIRECTION[1])
  .normalize()
  .setY(SKY_MOON_ELEVATION)
  .normalize();
const CRATERS = [
  [-4, -3.5, 2.6, '#ddd7c5'],
  [4.5, 3, 1.9, '#d3cdbb'],
  [-2, 5.5, 1.3, '#ddd7c5'],
  [5, -5, 1, '#ddd7c5'],
];

function paintMoon(canvas, lights) {
  const c = canvas.getContext('2d');
  const unit = TEXTURE / (ART * 2);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, TEXTURE, TEXTURE);
  c.setTransform(unit, 0, 0, unit, TEXTURE / 2, TEXTURE / 2);
  // The chip's soft drop-shadow glow, painted around the disc.
  const glow = c.createRadialGradient(0, 0, DISC * 0.9, 0, 0, ART);
  glow.addColorStop(0, '#fff6d8b0');
  glow.addColorStop(1, '#fff6d800');
  c.fillStyle = glow;
  c.fillRect(-ART, -ART, ART * 2, ART * 2);
  const disc = (x, y, r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  disc(0, 0, DISC, '#eeeadc');
  c.globalAlpha = 0.7;
  c.fillStyle = '#d6d0bf';
  c.fill(new Path2D(SHADED));
  c.globalAlpha = 1;
  for (const [x, y, r, color] of CRATERS) disc(x, y, r, color);
  c.strokeStyle = '#c9c2ad';
  c.lineWidth = 0.6;
  c.beginPath();
  c.arc(0, 0, DISC, 0, Math.PI * 2);
  c.stroke();
  for (const light of lights) disc(light.x * 10, light.y * 10, 0.5, '#e8b84a');
}

export class TownSkyMoon {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = TEXTURE;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.sprite = new Sprite(
      new SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.sprite.name = 'Moon over the valley';
    // The painted art is wider than the disc by its glow.
    this.sprite.scale.setScalar((DIAMETER * ART) / DISC);
    this.sprite.visible = false;
    this.lightKey = null;
    scene.add(this.sprite);
  }
  /** Shows the Moon with one light per homestead, or hides it without homesteads. */
  show(lights = []) {
    const key = lights.length ? JSON.stringify(lights) : null;
    if (key === this.lightKey) return false;
    this.lightKey = key;
    this.sprite.visible = !!key;
    if (key) {
      paintMoon(this.canvas, lights);
      this.texture.needsUpdate = true;
    }
    return true;
  }
  /** Places the Moon in its sky direction from this camera, before each drawn frame. */
  follow(camera, out = this.sprite.position) {
    return out.copy(camera.position).addScaledVector(SKY_MOON_HEADING, SKY_MOON_DISTANCE);
  }
  /** The disc on screen, in percent of the canvas, for its tap target. */
  screenPoint(camera, out = {}) {
    const position = this.follow(camera, skyPoint);
    const centre = screenCentre.copy(position).project(camera);
    const edge = screenEdge
      .copy(position)
      .addScaledVector(cameraUp.setFromMatrixColumn(camera.matrixWorld, 1), DIAMETER / 2)
      .project(camera);
    out.x = (centre.x + 1) * 50;
    out.y = (1 - centre.y) * 50;
    // Its radius as a share of the canvas height.
    out.radius = Math.abs(edge.y - centre.y) * 50;
    out.visible =
      this.sprite.visible &&
      centre.z > -1 &&
      centre.z < 1 &&
      out.x > -out.radius &&
      out.x < 100 + out.radius &&
      out.y > -out.radius &&
      out.y < 100 + out.radius;
    return out;
  }
  dispose() {
    this.sprite.removeFromParent();
    this.texture.dispose();
    this.sprite.material.dispose();
  }
}
const skyPoint = new Vector3(),
  screenCentre = new Vector3(),
  screenEdge = new Vector3(),
  cameraUp = new Vector3();
