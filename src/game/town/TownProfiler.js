// Production-safe phase timings for diagnosing town hitches on physical phones.
// Entries are bounded; read them with `prospectDebug.townTimings()`.
const LIMIT = 300;
const entries = [];
const longTasks = [];
let observer = null;
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
    for (const task of list.getEntries())
      push(longTasks, { start: task.startTime, ms: task.duration });
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
