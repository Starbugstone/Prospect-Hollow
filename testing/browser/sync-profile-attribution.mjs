// Attribute every main-thread long task in a sync-profile capture, including
// non-sync causes. CPU samples are estimates; unsampled/native time stays explicit.
import fs from 'node:fs';
const [stem] = process.argv.slice(2);
const cpu = JSON.parse(fs.readFileSync(`${stem}.cpuprofile`));
const events = JSON.parse(fs.readFileSync(`${stem}.trace.json`)).traceEvents;
const main = events.find((e) => e.name === 'thread_name' && e.args.name === 'CrRendererMain');
const tasks = events.filter(
  (e) =>
    e.pid === main.pid &&
    e.tid === main.tid &&
    e.ph === 'X' &&
    e.name === 'RunTask' &&
    e.dur > 1000 &&
    e.ts >= cpu.startTime &&
    e.ts + e.dur <= cpu.endTime,
);
tasks.sort((a, b) => a.ts - b.ts);
const nodes = new Map(cpu.nodes.map((n) => [n.id, n])),
  parent = new Map();
cpu.nodes.forEach((n) => (n.children ?? []).forEach((c) => parent.set(c, n.id)));
const groups = [
  ['Snapshot IndexedDB cloning', /services\/recovery(?:Store|Database)/],
  ['Sync JSON, transfer and bookkeeping', /services\/(?:syncService|cloudProfile|backgroundJson)/],
  ['Sync atomic storage commit', /mutateAsync services\/townStorage/],
  ['Local save/load and integrity', /services\/(?:townStorage|saveIntegrity|jsonCopy)/],
  ['Modernization supply calculation', /TownModernization/],
  ['Town offers and needs', /TownRules|TownNeeds|TownEras/],
  [
    'Plot swaps, layout and navigation',
    /TownPlots|TownNavigation|TownItineraries|TownLocomotion|BuildingFootprints|TriangleIndex/,
  ],
  [
    'Animals and deferred presentation',
    /TownAnimals|TownAnimalSpace|TownBirdFlight|PresentationWork/,
  ],
  [
    'Mesh/footprint/module loading',
    /(?:loadFamilies|loadFootprints|assets\/meshes|MeshCatalog|FootprintRegistry)/,
  ],
  ['Label projection', /(?:projectLabels|updateLabels|TownLabels)/],
  ['Audio', /howler|Audio|decodeAudio/],
  [
    'Shader/material/texture and rendering',
    /WebGL|Shader|Texture|renderBufferDirect|drawElements|TownFrameCache|TownDiorama|TownActors|TownPeople/,
  ],
  ['Garbage collection', /garbage collector|MinorGC|MajorGC/],
  ['Vue/reactivity/UI', /components\/|runtime-core|reactivity|runtime-dom/],
];
let stamp = cpu.startTime;
const samples = cpu.samples.map((id, i) => {
  stamp += cpu.timeDeltas[i];
  const stack = [];
  for (let c = id; c != null; c = parent.get(c)) {
    const f = nodes.get(c).callFrame;
    stack.push(`${f.functionName} ${f.url.split('/src/')[1] ?? f.url}`);
  }
  const joined = stack.join('\n');
  const group =
    groups.find(([, match]) => match.test(joined))?.[0] ?? 'Other browser/native/unsampled';
  return {
    stamp,
    dt: (cpu.timeDeltas[i + 1] ?? 0) / 1000,
    group,
    stack: stack
      .filter((s) => /\/src\/|services\/|game\/|components\/|stores\//.test(s))
      .slice(0, 7),
  };
});
const totals = new Map();
let cursor = 0;
const details = tasks.map((t) => {
  const times = new Map(),
    app = new Map();
  while (cursor < samples.length && samples[cursor].stamp < t.ts) cursor++;
  for (
    let index = cursor;
    index < samples.length && samples[index].stamp <= t.ts + t.dur;
    index++
  ) {
    const sample = samples[index];
    times.set(sample.group, (times.get(sample.group) ?? 0) + sample.dt);
    for (const k of new Set(sample.stack)) app.set(k, (app.get(k) ?? 0) + sample.dt);
  }
  const ranking = [...times].sort((a, b) => b[1] - a[1]);
  const cause = ranking[0]?.[0] ?? 'Other browser/native/unsampled';
  const ms = t.dur / 1000,
    tbt = Math.max(0, ms - 50);
  const total = totals.get(cause) ?? { tasks: 0, max: 0, tbt: 0, sampled: 0 };
  if (ms > 50) total.tasks++;
  total.max = Math.max(total.max, ms);
  total.tbt += tbt;
  total.sampled += ranking[0]?.[1] ?? 0;
  totals.set(cause, total);
  return {
    start: t.ts,
    ms,
    tbt,
    cause,
    samples: ranking,
    app: [...app].sort((a, b) => b[1] - a[1]).slice(0, 6),
    trace:
      ms > 50
        ? [
            ...new Set(
              events
                .filter(
                  (e) =>
                    e.pid === main.pid &&
                    e.tid === main.tid &&
                    e.ts >= t.ts &&
                    e.ts < t.ts + t.dur &&
                    e.name !== 'RunTask',
                )
                .map((e) => e.name),
            ),
          ].slice(0, 30)
        : [],
  };
});
const result = {
  stem,
  ranking: [...totals].sort((a, b) => b[1].tbt - a[1].tbt),
  tasks: details.filter((task) => task.ms > 50),
};
fs.writeFileSync(`${stem}.attribution.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ stem, ranking: result.ranking }, null, 2));
