import { PERSONAL_AREAS, areaCapacity, purchaseLandmark } from './townLandmarks';
export { PERSONAL_AREAS, areaStage, areaUnlocked } from './townLandmarks';

// This catalog is also exported to PHP. IDs are saved; labels may change.
export const PAINT_GROUPS = [
  { id: 'walls', label: 'Main surfaces' },
  { id: 'roof', label: 'Roofs and canopies' },
  { id: 'secondary', label: 'Secondary surfaces' },
  { id: 'trim', label: 'Frames and trim' },
  { id: 'accent', label: 'Doors and accents' },
];
export const DEFAULT_EMBLEM_COLOUR = '#393c43';
export const PAINT_COLOURS = [
  '#f4ead5',
  '#ddd1b5',
  '#bca889',
  '#91785e',
  '#655343',
  '#393c43',
  '#f0c8bd',
  '#d99a82',
  '#bd705f',
  '#9f4f48',
  '#793c43',
  '#522f3e',
  '#f5ddb0',
  '#e8bf79',
  '#cc954f',
  '#b77839',
  '#935b35',
  '#70442e',
  '#eee6af',
  '#d4ca7a',
  '#b3b362',
  '#8d994f',
  '#6c7a43',
  '#495c38',
  '#d9e6c5',
  '#b3c99b',
  '#8caf80',
  '#658c68',
  '#47705a',
  '#2c5145',
  '#cee7df',
  '#a0ccc4',
  '#76b0a6',
  '#52948e',
  '#367673',
  '#285657',
  '#d6e5ee',
  '#aac9de',
  '#80aacb',
  '#5d89b4',
  '#41658f',
  '#304767',
  '#e0dcf0',
  '#bfb6db',
  '#9b91c4',
  '#7b6caa',
  '#5f4f89',
  '#45365f',
  '#eddaeb',
  '#d6b1ce',
  '#ba86ae',
  '#9b628f',
  '#784669',
  '#58364e',
  '#ffffff',
  '#dedfe1',
  '#bec3c8',
  '#959da7',
  '#697480',
  '#424c59',
];
export const CREST_SHAPES = ['shield', 'swallowtail', 'pennant', 'square'];
export const CREST_PATTERNS = ['plain', 'split', 'diagonal', 'quartered', 'stripes', 'cross'];

export const BUILDING_CHOICES = {
  home: ['original', 'garden', 'veranda', 'artisan'],
  home2: ['original', 'garden', 'veranda', 'artisan'],
  home3: ['original', 'garden', 'veranda', 'artisan'],
  home4: ['original', 'garden', 'veranda', 'artisan'],
  home5: ['original', 'garden', 'veranda', 'artisan'],
  saloon: ['original', 'garden', 'veranda', 'market'],
  museum: ['original', 'crystal', 'sculpture', 'garden'],
  shop: ['original', 'market', 'garden', 'artisan'],
  farm: ['original', 'garden', 'orchard', 'artisan'],
  farm2: ['original', 'garden', 'orchard', 'artisan'],
  farm3: ['original', 'garden', 'orchard', 'artisan'],
  school: ['original', 'garden', 'sculpture', 'veranda'],
  hotel: ['original', 'garden', 'veranda', 'sculpture'],
};
export const CHOICE_LABELS = {
  original: 'Original design',
  garden: 'Flower garden',
  veranda: 'Welcoming veranda',
  artisan: 'Artisan courtyard',
  market: 'Market frontage',
  crystal: 'Crystal courtyard',
  sculpture: 'Sculpture courtyard',
  orchard: 'Orchard garden',
  pavilion: 'Garden pavilion',
  glasshouse: 'Glasshouse',
  workshop: 'Craft workshop',
  observatory: 'Little observatory',
  gallery: 'Open-air gallery',
  teahouse: 'Tea cottage',
};
export const createPersonalisation = () => ({
  version: 2,
  crest: null,
  paint: { all: {} },
  choices: {},
  areas: {},
  areaLevels: {},
  plaques: {},
});
export const validPaint = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const colours = (saved, groups) =>
  Object.fromEntries(
    groups
      .filter(({ id }) => validPaint(saved?.[id]))
      .map(({ id }) => [id, saved[id].toLowerCase()]),
  );
export const choiceLocked = (town, id) => !!town.buildings?.[id] || !!town.projects?.[id];

export function normalizePersonalisation(saved, town, emblemIds) {
  saved = object(saved);
  const result = createPersonalisation();
  if (
    CREST_SHAPES.includes(saved.crest?.shape) &&
    CREST_PATTERNS.includes(saved.crest?.pattern) &&
    emblemIds.includes(saved.crest?.emblem) &&
    validPaint(saved.crest?.primary) &&
    validPaint(saved.crest?.secondary)
  ) {
    result.crest = {
      shape: saved.crest.shape,
      pattern: saved.crest.pattern,
      emblem: saved.crest.emblem,
      primary: saved.crest.primary.toLowerCase(),
      secondary: saved.crest.secondary.toLowerCase(),
      emblemColour: validPaint(saved.crest.emblemColour)
        ? saved.crest.emblemColour.toLowerCase()
        : DEFAULT_EMBLEM_COLOUR,
    };
  }
  const buildingIds = [
    ...Object.keys(town.buildings ?? {}),
    ...PERSONAL_AREAS.filter((a) => !a.timeless).map((a) => a.id),
  ];
  // Old per-building paint becomes one palette: prefer the home, then the first
  // saved colour for each role. An explicit shared palette (even empty) wins.
  result.paint.all = Object.hasOwn(object(saved.paint), 'all')
    ? colours(saved.paint.all, PAINT_GROUPS)
    : ['home', ...buildingIds].reduce(
        (palette, id) => ({ ...colours(saved.paint?.[id], PAINT_GROUPS), ...palette }),
        {},
      );
  for (const id of buildingIds) {
    const choices = BUILDING_CHOICES[id];
    if (choices?.includes(saved.choices?.[id]) && saved.choices[id] !== 'original')
      result.choices[id] = saved.choices[id];
    const plaque = saved.plaques?.[id];
    if (typeof plaque === 'string' && /^[a-z0-9-]{1,80}$/.test(plaque)) result.plaques[id] = plaque;
  }
  for (const area of PERSONAL_AREAS) {
    const slots = area.positions.map((_, slot) =>
      area.choices.includes(saved.areas?.[area.id]?.[slot]) ? saved.areas[area.id][slot] : null,
    );
    if (slots.some(Boolean)) {
      result.areas[area.id] = slots;
      const level = saved.areaLevels?.[area.id];
      result.areaLevels[area.id] = area.timeless
        ? 1
        : Number.isInteger(level) && level > 0 && level <= areaCapacity(area)
          ? level
          : 1;
    }
  }
  return result;
}

// A single mutation boundary for menus, building cards and tests. Callers commit
// the returned town through normal save handling; invalid commands do nothing.
export function personaliseTown(town, command, emblemIds, earned = []) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) return null;
  const p = normalizePersonalisation(town.personalisation, town, emblemIds);
  const { kind, id, value, group } = command;
  if (kind === 'crest') {
    if (
      value !== null &&
      (!value ||
        !CREST_SHAPES.includes(value.shape) ||
        !CREST_PATTERNS.includes(value.pattern) ||
        !emblemIds.includes(value.emblem) ||
        !validPaint(value.primary) ||
        !validPaint(value.secondary) ||
        (value.emblemColour !== undefined && !validPaint(value.emblemColour)))
    )
      return null;
    p.crest = value;
  } else if (kind === 'paint' && PAINT_GROUPS.some((g) => g.id === group)) {
    if (value === null) delete p.paint.all[group];
    else if (validPaint(value)) p.paint.all[group] = value;
    else return null;
  } else if (
    kind === 'choice' &&
    Object.hasOwn(BUILDING_CHOICES, id) &&
    BUILDING_CHOICES[id].includes(value) &&
    !choiceLocked(town, id)
  )
    p.choices[id] = value;
  else if (kind === 'area') return purchaseLandmark({ ...town, personalisation: p }, command);
  else if (
    kind === 'plaque' &&
    (Object.hasOwn(town.buildings, id) || PERSONAL_AREAS.some((a) => !a.timeless && a.id === id)) &&
    (value === null || earned.includes(value))
  ) {
    if (value === null) delete p.plaques[id];
    else p.plaques[id] = value;
  } else return null;
  return { ...town, personalisation: normalizePersonalisation(p, town, emblemIds) };
}
