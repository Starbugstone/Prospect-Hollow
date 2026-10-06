// Everyone who walks the village: residents, arriving VIPs and live visitors, then
// (unless excluded) the animals. One definition, so a new kind of walker joins
// locomotion, site clearing and picking in one place. Visiting in place avoids
// building an array on every frame.
export function forEachWalker(d, visit, { animals = true } = {}) {
  for (const actor of d.actors ?? []) visit(actor);
  for (const actor of d.vipArrivals?.actors ?? []) visit(actor);
  for (const actor of d.liveVisitors?.actors ?? []) visit(actor);
  if (animals) for (const animal of d.animals ?? []) visit(animal);
}

export function walkers(d, options) {
  const list = [];
  forEachWalker(d, (walker) => list.push(walker), options);
  return list;
}
