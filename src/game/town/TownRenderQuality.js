// Tune only the 3D drawing buffer. HTML controls and labels stay at native resolution.
// Sustained slow frames lower fill cost; pauses and isolated stalls do not change quality.
export class TownRenderQuality {
  constructor(maxRatio = 1) {
    this.maxRatio = Math.min(1.5, maxRatio);
    this.ratio = this.maxRatio;
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
    return next;
  }
  resetWindow() {
    this.samples = [];
    this.fastWindows = 0;
  }
}
