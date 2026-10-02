// Tile badges show a handful of short labels (layer counts, ❄, arrows, ✓). Render
// each distinct label and style once into a shared texture, instead of creating a
// Text object, with its own canvas and texture upload, every time a tile changes.
const styleKey = (style) =>
  Object.keys(style)
    .sort()
    .map((key) => `${key}=${JSON.stringify(style[key])}`)
    .join(';');

export function glyphImage(scene, x, y, text, style) {
  const key = `glyph:${text}:${styleKey(style)}`;
  if (!scene.textures.exists(key)) {
    const label = scene.make.text({ text, style, add: false });
    const texture = scene.textures.createCanvas(
      key,
      Math.ceil(label.width),
      Math.ceil(label.height),
    );
    texture.draw(0, 0, label.canvas);
    label.destroy();
  }
  return scene.add.image(x, y, key);
}
