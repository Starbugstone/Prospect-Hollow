import { eraEvolution } from './eras';
export const MINE_FEATURE_KEYS = [
  'cribbing',
  'sluice',
  'tipple',
  'rail-hopper',
  'surface-cart-load',
  'crusher',
  'conveyor',
  'fan-house',
  'truck-bay',
  'upper-terrace',
  'ropeway',
  'radio-mast',
  'benches',
  'sorting-plant',
  'wind-turbine',
  'heritage-wheel',
  'solar-canopy',
];
export const MINE_PROFILES = {
  frontier: {
    portal: 'timber',
    works: 'windlass',
    machine: 'sluice',
    cart: 'hand-tub',
    site: ['cribbing', 'sluice'],
    motion: ['windlass'],
    heritage: [],
    stockpile: 1,
  },
  'river-rail': {
    inherits: 'frontier',
    portal: 'stone-arch-1884',
    works: 'timber-a-frame',
    machine: 'tipple',
    cart: 'iron-car',
    site: [
      'tipple',
      { feature: 'rail-hopper', requires: 'railway', substitute: 'surface-cart-load' },
    ],
    motion: ['winding-wheel', 'tipple'],
    heritage: ['keystone-1884'],
    stockpile: 2,
  },
  industrial: {
    inherits: 'river-rail',
    portal: 'brick-lamps',
    works: 'steel-headgear',
    machine: 'crusher',
    cart: 'side-tip',
    site: ['crusher', 'conveyor'],
    motion: ['conveyor'],
    stockpile: 3,
  },
  'post-war': {
    inherits: 'industrial',
    portal: 'masonry',
    works: 'enclosed-hoist',
    machine: 'fan-house',
    cart: 'paired-tubs',
    site: ['fan-house', 'upper-terrace'],
    motion: ['fan'],
  },
  'motor-age': {
    inherits: 'post-war',
    portal: 'stepped-cream',
    works: 'loading-canopy',
    machine: 'truck-bay',
    cart: 'compact-haul',
    site: ['truck-bay', 'tipple'],
    motion: ['truck', 'tipple'],
    stockpile: 4,
  },
  aviation: {
    inherits: 'motor-age',
    portal: 'ribbon-control',
    works: 'hillside-control',
    machine: 'ropeway',
    cart: 'standard-tub',
    site: ['upper-terrace', 'conveyor', 'ropeway', 'radio-mast'],
    motion: ['buckets', 'beacon'],
  },
  broadcast: {
    inherits: 'aviation',
    portal: 'glazed-tower',
    works: 'processing-tower',
    machine: 'benches',
    cart: 'tipping-tubs',
    site: ['upper-terrace', 'benches', 'fan-house', 'heritage-wheel'],
    motion: ['fan', 'tipple'],
    heritage: ['keystone-1884', 'winding-wheel'],
  },
  contemporary: {
    inherits: 'broadcast',
    portal: 'solar-industrial',
    works: 'enclosed-sorting',
    machine: 'sorting-plant',
    cart: 'electric-haul',
    site: ['upper-terrace', 'sorting-plant', 'solar-canopy', 'wind-turbine', 'heritage-wheel'],
    motion: ['turbine', 'ore-flow'],
  },
};
const portals = new Set(Object.values(MINE_PROFILES).map((p) => p.portal));
const works = new Set(Object.values(MINE_PROFILES).map((p) => p.works));
const carts = new Set(Object.values(MINE_PROFILES).map((p) => p.cart));
const motions = new Set(Object.values(MINE_PROFILES).flatMap((p) => p.motion));
export function mineProfile(era, definitions = MINE_PROFILES) {
  const evolution = eraEvolution(era),
    key = definitions[era] ? era : (evolution.cityAssets ?? evolution.style);
  const visited = new Set();
  function resolve(id) {
    if (visited.has(id) || !definitions[id]) return { ...MINE_PROFILES.frontier };
    visited.add(id);
    const own = definitions[id],
      parent = id === 'frontier' ? MINE_PROFILES.frontier : resolve(own.inherits ?? 'frontier');
    const result = { ...parent, ...own, key: id };
    for (const [slot, supported] of [
      ['portal', portals],
      ['works', works],
      ['cart', carts],
      ['machine', new Set(MINE_FEATURE_KEYS)],
    ])
      if (!supported.has(result[slot])) result[slot] = parent[slot];
    const validFeature = (entry) =>
      MINE_FEATURE_KEYS.includes(typeof entry === 'string' ? entry : entry.feature);
    const site = Array.isArray(result.site)
      ? result.site.filter((entry) => !entry.optional || validFeature(entry))
      : [];
    const additions =
      site.length &&
      site.every(
        (entry) =>
          validFeature(entry) &&
          (!entry.requires || entry.optional || MINE_FEATURE_KEYS.includes(entry.substitute)),
      )
        ? site
        : [];
    // Site features are permanent additions. Repeating one in a descendant is
    // a reference to the same structure, not a second copy or a replacement.
    result.site = [
      ...new Map(
        [...parent.site, ...additions].map((entry) => [
          typeof entry === 'string' ? entry : entry.feature,
          entry,
        ]),
      ).values(),
    ];
    result.heritage = [...new Set([...parent.heritage, ...(own.heritage ?? [])])];
    if (!result.motion?.length || result.motion.some((m) => !motions.has(m)))
      result.motion = parent.motion;
    result.motion = [...new Set([...parent.motion, ...result.motion])];
    return result;
  }
  return resolve(key);
}
export function validateMineProfiles(definitions = MINE_PROFILES) {
  const errors = [];
  for (const [id, profile] of Object.entries(definitions)) {
    const seen = new Set();
    let at = id;
    while (definitions[at]?.inherits) {
      if (seen.has(at)) {
        errors.push(`${id}: inheritance cycle`);
        break;
      }
      seen.add(at);
      at = definitions[at].inherits;
    }
    for (const item of profile.site ?? []) {
      const feature = typeof item === 'string' ? item : item.feature;
      if (!MINE_FEATURE_KEYS.includes(feature)) errors.push(`${id}: unknown ${feature}`);
      if (item.requires && !item.optional && !MINE_FEATURE_KEYS.includes(item.substitute))
        errors.push(`${id}: missing substitute for ${feature}`);
    }
  }
  return errors;
}
