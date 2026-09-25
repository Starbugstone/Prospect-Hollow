// Shared secondary view for fixed incidents and passive visitor arrivals.
export function eventInsetRect(width, height) {
  const w = Math.floor(Math.min(320, Math.max(156, width * 0.4), width * 0.46, height * 0.45));
  return { x: width - w - 12, y: 16, width: w, height: Math.floor(w / 1.5) };
}
// Main-view DOM labels must not paint over the secondary WebGL viewport.
// Coordinates are CSS pixels from the top-left; the renderer's inset Y is bottom-up.
export function overlapsEventInset(d, x, y, width, height = 44) {
  if (!d.eventInsetVisible) return false;
  const rect = eventInsetRect(d.canvas.clientWidth, d.canvas.clientHeight);
  const top = d.canvas.clientHeight - rect.y - rect.height;
  return (
    x + width / 2 > rect.x - 4 &&
    x - width / 2 < rect.x + rect.width + 4 &&
    y + height / 2 > top - 26 &&
    y - height / 2 < top + rect.height + 4
  );
}
export function hideEventInset(d) {
  if (!d.eventInsetVisible) return;
  d.eventInsetVisible = false;
  d.onEventInset?.(null);
}
export function drawCameraInset(d, shot, rect, label, passive = false, details = {}) {
  const signature = `${rect.width}:${rect.height}:${rect.x}:${label}:${passive}`;
  if (!d.eventInsetVisible || signature !== d.insetSignature || details.nameTag) {
    d.onEventInset?.({ ...rect, label, passive, ...details });
    d.insetSignature = signature;
    d.eventInsetVisible = true;
  }
  const renderer = d.renderer;
  renderer.getViewport(shot.viewport);
  renderer.getScissor(shot.scissor);
  const scissorTest = renderer.getScissorTest();
  const autoClear = renderer.autoClear;
  try {
    renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
    renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
    renderer.setScissorTest(true);
    renderer.autoClear = true;
    renderer.render(d.scene, shot.insetCamera);
  } finally {
    renderer.setViewport(shot.viewport);
    renderer.setScissor(shot.scissor);
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
  }
}
