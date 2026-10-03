import { CanvasTexture, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { horizonMaterial } from './TownAtmosphere';

// Every building sign is painted into a shared texture page. Signs on one page share a
// material, so the static batcher draws all of them together instead of one draw call
// (and one 512 × 128 texture) per sign. A gutter of background color around each slot
// keeps the smaller mipmaps of distant signs from picking up their neighbors' letters.
const WIDTH = 512,
  HEIGHT = 128,
  GUTTER = 16,
  PAGE = 2048,
  COLUMNS = Math.floor(PAGE / (WIDTH + GUTTER * 2)),
  ROWS = Math.floor(PAGE / (HEIGHT + GUTTER * 2)),
  BACKGROUND = '#ecddbb';

export class TownSignAtlas {
  constructor() {
    this.pages = [];
    this.slots = new Map();
  }
  page() {
    const current = this.pages.at(-1);
    if (current && current.used < COLUMNS * ROWS) return current;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PAGE;
    const context = canvas.getContext('2d');
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, PAGE, PAGE);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    // Signs face the camera at a steep angle. Anisotropic filtering keeps their
    // lettering as crisp as the former one-texture-per-sign boards (three clamps
    // this to what the device supports).
    texture.anisotropy = 8;
    const material = horizonMaterial(new MeshStandardMaterial({ map: texture, roughness: 1 }));
    material.userData.signAtlas = true;
    const page = { canvas, context, texture, material, used: 0 };
    this.pages.push(page);
    return page;
  }
  // The text's slot, painted on first use: a plane geometry mapped to it and its page.
  slot(text) {
    let slot = this.slots.get(text);
    if (slot) return slot;
    const page = this.page();
    const index = page.used++;
    const left = (index % COLUMNS) * (WIDTH + GUTTER * 2) + GUTTER,
      top = Math.floor(index / COLUMNS) * (HEIGHT + GUTTER * 2) + GUTTER;
    const { context } = page;
    context.fillStyle = BACKGROUND;
    context.fillRect(left, top, WIDTH, HEIGHT);
    context.fillStyle = '#56472e';
    context.font = 'bold 48px Georgia';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, left + WIDTH / 2, top + 68, 480);
    page.texture.needsUpdate = true;
    const geometry = new PlaneGeometry(1, 1);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (left + uv.getX(i) * WIDTH) / PAGE, 1 - (top + (1 - uv.getY(i)) * HEIGHT) / PAGE);
    slot = { geometry, material: page.material };
    this.slots.set(text, slot);
    return slot;
  }
  dispose() {
    for (const { geometry } of this.slots.values()) geometry.dispose();
    for (const { texture, material } of this.pages) {
      texture.dispose();
      material.dispose();
    }
    this.slots.clear();
    this.pages = [];
  }
}
