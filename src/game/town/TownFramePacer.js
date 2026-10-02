// Paces the village at 60 fps on any display. Frames are due on a fixed 60 Hz
// schedule rather than "16 ms after the last drawn frame", so a 75, 90 or 144 Hz
// screen alternates between one and two refreshes and still averages 60 fps,
// instead of falling to 37-48 fps.
const SLACK = 2;
const SMOOTHING = 4;

export class TownFramePacer {
  constructor(fps = 60) {
    this.interval = 1000 / fps;
    this.reset();
  }
  // After a pause or hidden page: the next frame draws at once and starts a new schedule.
  reset() {
    this.next = 0;
    this.last = 0;
    this.intervals = [];
  }
  due(now) {
    if (!this.next) this.next = now;
    if (now < this.next - SLACK) return false;
    // The next frame is due one interval after this one was scheduled. After a stall
    // it is due one interval from now: no burst of catch-up frames.
    this.next = now - this.next > this.interval ? now + this.interval : this.next + this.interval;
    if (this.last) {
      this.intervals.push(now - this.last);
      if (this.intervals.length > SMOOTHING) this.intervals.shift();
    }
    this.last = now;
    return true;
  }
  // Recent frame time, smoothed over a few frames so that a display's refresh
  // pattern (11 + 22 ms at 90 Hz) reads as the 16.7 ms it averages to. Null until
  // enough frames have been drawn since the last reset.
  get frameTime() {
    if (this.intervals.length < SMOOTHING) return null;
    return this.intervals.reduce((sum, value) => sum + value, 0) / this.intervals.length;
  }
}
