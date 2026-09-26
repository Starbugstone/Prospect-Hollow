export const RENDER_TIERS = Object.freeze({
  low: { dpr: 1, shadow: 1024, samples: 0 },
  medium: { dpr: 1.25, shadow: 2048, samples: 2 },
  high: { dpr: 1.5, shadow: 2048, samples: 4 },
});
// Tune only the 3D drawing buffer. HTML controls and labels stay at native resolution.
// Sustained slow frames lower fill cost; pauses and isolated stalls do not change quality.
export class TownRenderQuality {
  constructor(maxRatio = 1, initialTier) {
    try {
      initialTier ??= globalThis.localStorage?.getItem('prospect.renderTier');
    } catch {}
    this.tier = Object.hasOwn(RENDER_TIERS, initialTier ?? '') ? initialTier : 'medium';
    this.cacheSamples = RENDER_TIERS[this.tier].samples;
    this.maxRatio = Math.min(1.5, maxRatio);
    this.ratio = Math.min(this.maxRatio, RENDER_TIERS[this.tier].dpr);
    this.samples = [];
    this.fastWindows = 0;
  }
  sample(milliseconds) {
    if (!(milliseconds > 0 && milliseconds < 1000)) return null;
    this.samples.push(milliseconds);
    if (this.samples.length < 40) return null;
    const ordered = this.samples.sort((a, b) => a - b);
    const slow = ordered[30];
    this.samples = [];
    let next = this.ratio;
    if (slow > 34) {
      next = Math.max(Math.min(0.6, this.maxRatio), this.ratio * 0.8);
      this.fastWindows = 0;
    } else if (slow < 19) {
      if (++this.fastWindows >= 8) {
        next = Math.min(this.maxRatio, this.ratio / 0.8);
        this.fastWindows = 0;
      }
    } else this.fastWindows = 0;
    if (Math.abs(next - this.ratio) < 0.01) return null;
    this.ratio = next;
    this.tier = next <= 1 ? 'low' : next <= 1.25 ? 'medium' : 'high';
    try {
      globalThis.localStorage?.setItem('prospect.renderTier', this.tier);
    } catch {}
    return next;
  }
  get shadowSize() {
    return RENDER_TIERS[this.tier].shadow;
  }
  resetWindow() {
    this.samples = [];
    this.fastWindows = 0;
  }
}
