// Production-safe phase timings for diagnosing town hitches on physical phones.
// Entries are bounded; read them with `prospectDebug.townTimings()`.
const LIMIT = 300;
const entries = [];
const longTasks = [];
let observer = null,
  longTaskCount = 0;
const now = () => globalThis.performance?.now() ?? Date.now();

function push(list, entry) {
  list.push(entry);
  if (list.length > LIMIT) list.splice(0, list.length - LIMIT);
}
export function recordTownTiming(name, start, detail) {
  const end = now();
  push(entries, { name, start, ms: end - start, ...(detail ? { detail } : {}) });
  if (import.meta.env?.DEV) globalThis.performance?.measure?.(`town:${name}`, { start, end });
  return end - start;
}
export function timeTown(name, fn, detail) {
  const start = now();
  try {
    return fn();
  } finally {
    recordTownTiming(name, start, detail);
  }
}
// Measure scheduled work: total busy time plus its longest uninterruptible step.
export function* timedSteps(name, iterator) {
  let first = null,
    total = 0,
    longest = 0,
    steps = 0;
  try {
    while (true) {
      const start = now();
      first ??= start;
      const next = iterator.next();
      const ms = now() - start;
      total += ms;
      longest = Math.max(longest, ms);
      steps++;
      if (next.done) return next.value;
      yield next.value;
    }
  } finally {
    iterator.return?.();
    if (first !== null)
      push(entries, { name, start: first, ms: total, detail: { steps, longest } });
  }
}
export function watchLongTasks() {
  if (observer || !globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask'))
    return;
  observer = new PerformanceObserver((list) => {
    for (const task of list.getEntries()) {
      longTaskCount++;
      push(longTasks, { start: task.startTime, ms: task.duration });
    }
  });
  observer.observe({ type: 'longtask', buffered: true });
}
export function townTimings({ clear = false } = {}) {
  const summary = {};
  for (const { name, ms } of entries) {
    const item = (summary[name] ??= { count: 0, max: 0, total: 0 });
    item.count++;
    item.max = Math.max(item.max, ms);
    item.total += ms;
  }
  const report = {
    summary,
    entries: entries.map((entry) => ({ ...entry })),
    // Associate each long task with the town phases that overlapped it.
    longTasks: longTasks.map((task) => ({
      ...task,
      during: entries
        .filter(({ start, ms }) => start < task.start + task.ms && start + ms > task.start)
        .map(({ name }) => name),
    })),
  };
  if (clear) {
    entries.length = 0;
    longTasks.length = 0;
  }
  return report;
}

// Per-frame phase sampling for `prospectDebug.townFrameStats()`. Hooks cost one
// boolean check unless a collection window is open.
const frame = { active: false, phases: new Map(), values: new Map(), context: null };
export const frameStart = () => (frame.active ? now() : null);
export function frameEnd(name, started) {
  if (started === null || !frame.active) return;
  const list = frame.phases.get(name) ?? [];
  list.push(now() - started);
  frame.phases.set(name, list);
}
export function frameValue(name, value) {
  if (!frame.active || !Number.isFinite(value)) return;
  const list = frame.values.get(name) ?? [];
  list.push(value);
  frame.values.set(name, list);
}
// The live town reports its render settings; the last registered owner wins.
export function setFrameContext(owner, read) {
  frame.context = { owner, read };
}
export function clearFrameContext(owner) {
  if (frame.context?.owner === owner) frame.context = null;
}
const round = (value) => Math.round(value * 100) / 100;
function describe(list) {
  const ordered = [...list].sort((a, b) => a - b);
  const total = ordered.reduce((sum, value) => sum + value, 0);
  return {
    count: ordered.length,
    mean: round(total / (ordered.length || 1)),
    p95: round(ordered[Math.floor((ordered.length - 1) * 0.95)] ?? 0),
    max: round(ordered.at(-1) ?? 0),
    total: round(total),
  };
}
export function townFrameStats(seconds = 5) {
  if (frame.active) return Promise.reject(new Error('Town frame stats are already collecting.'));
  frame.active = true;
  frame.phases.clear();
  frame.values.clear();
  const stamps = [],
    started = now(),
    longTasksBefore = longTaskCount;
  const raf = globalThis.requestAnimationFrame ?? ((fn) => setTimeout(() => fn(now()), 16));
  const cancel = globalThis.cancelAnimationFrame ?? clearTimeout;
  let handle = raf(function sample(time) {
    stamps.push(time);
    handle = raf(sample);
  });
  return new Promise((resolve) =>
    setTimeout(() => {
      cancel(handle);
      frame.active = false;
      const intervals = stamps.slice(1).map((time, i) => time - stamps[i]);
      const elapsed = (now() - started) / 1000;
      resolve({
        seconds: round(elapsed),
        frames: {
          ...describe(intervals),
          over33ms: intervals.filter((ms) => ms > 33.4).length,
          over50ms: intervals.filter((ms) => ms > 50).length,
        },
        // Milliseconds per call; `perSecond` is busy time per second of the window.
        phases: Object.fromEntries(
          [...frame.phases].map(([name, list]) => {
            const stats = describe(list);
            return [name, { ...stats, perSecond: round(stats.total / elapsed) }];
          }),
        ),
        values: Object.fromEntries(
          [...frame.values].map(([name, list]) => {
            const { mean, max } = describe(list);
            return [name, { mean, max, last: list.at(-1) }];
          }),
        ),
        longTasks: longTaskCount - longTasksBefore,
        context: frame.context?.read() ?? null,
      });
    }, seconds * 1000),
  );
}
