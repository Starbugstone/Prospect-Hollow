// Ribbon climbers: the valley's space elevator and New Hollow's ribbon landing share one
// trip. A climber docks at the start of each period and dwells there while guests step
// off, then rides the ribbon out and glides back. Every pose is a function of time.
export const CLIMB = Object.freeze({ bottom: 6.6, top: 64, period: 46, dwell: 3.5 });

/** A climber's trip at `time`: docked (`arrived`) through its dwell, and which trip it is. */
export function climberArrival(time, period = CLIMB.period, dwell = CLIMB.dwell) {
  const since = ((time % period) + period) % period;
  return {
    arrived: since < dwell,
    sinceArrival: since,
    visit: Math.floor(time / period),
  };
}

/** How far along its ribbon a climber is at `phase` (0..1) of its trip: 0 docked, 1 away. */
export function climberRise(phase) {
  const rise = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return rise * rise * (3 - 2 * rise);
}
