import {
  PERSONAL_AREAS,
  LANDMARK_PROGRESSION,
  landmarkLevel,
  purchaseLandmark,
} from './townLandmarks';
import { CREST_PATTERNS, CREST_SHAPES } from './townCrests';
export { PERSONAL_AREAS, areaStage, areaUnlocked } from './townLandmarks';
export { CREST_PATTERNS, CREST_SHAPES } from './townCrests';

export const DEFAULT_EMBLEM_COLOUR = '#393c43';
export const CREST_COLOURS = [
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
export const createPersonalisation = () => ({
  version: 3,
  crest: null,
  areas: {},
  areaLevels: {},
  // Paid levels still being built: { [site]: { level, wins } }.
  construction: {},
  plaques: {},
});
const validColour = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function normalizePersonalisation(saved, emblemIds) {
  saved = object(saved);
  const result = createPersonalisation();
  if (
    CREST_SHAPES.includes(saved.crest?.shape) &&
    CREST_PATTERNS.includes(saved.crest?.pattern) &&
    emblemIds.includes(saved.crest?.emblem) &&
    validColour(saved.crest?.primary) &&
    validColour(saved.crest?.secondary)
  ) {
    result.crest = {
      shape: saved.crest.shape,
      pattern: saved.crest.pattern,
      emblem: saved.crest.emblem,
      primary: saved.crest.primary.toLowerCase(),
      secondary: saved.crest.secondary.toLowerCase(),
      emblemColour: validColour(saved.crest.emblemColour)
        ? saved.crest.emblemColour.toLowerCase()
        : DEFAULT_EMBLEM_COLOUR,
    };
  }
  // Removed building palettes/frontages and off-mine plaques are deliberately dropped.
  const plaque = saved.plaques?.mine;
  if (typeof plaque === 'string' && /^[a-z0-9-]{1,80}$/.test(plaque)) result.plaques.mine = plaque;
  for (const area of PERSONAL_AREAS) {
    const slots = area.positions.map((_, slot) =>
      area.choices.includes(saved.areas?.[area.id]?.[slot]) ? saved.areas[area.id][slot] : null,
    );
    if (slots.some(Boolean)) {
      result.areas[area.id] = slots;
      const level = saved.areaLevels?.[area.id];
      result.areaLevels[area.id] = area.timeless
        ? 1
        : Number.isInteger(level) && level > 0 && level <= LANDMARK_PROGRESSION.legacyLimit
          ? level
          : 1;
      // Only the latest paid level can be under construction. Anything else is
      // treated as finished, so a damaged entry never hides a monument. Progress past a
      // shortened build stays ready to unveil, so the player still sees its unveiling.
      const work = saved.construction?.[area.id];
      const shown = result.areaLevels[area.id];
      if (
        work?.level === shown &&
        shown <= (area.timeless ? 1 : LANDMARK_PROGRESSION.levels.length) &&
        Number.isInteger(work.wins) &&
        work.wins >= 0
      )
        result.construction[area.id] = {
          level: shown,
          wins: Math.min(work.wins, landmarkLevel(shown).puzzles),
        };
    }
  }
  return result;
}

// A single mutation boundary for menus, building cards and tests. Callers commit
// the returned town through normal save handling; invalid commands do nothing.
export function personaliseTown(town, command, emblemIds, earned = []) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) return null;
  const p = normalizePersonalisation(town.personalisation, emblemIds);
  const { kind, id, value } = command;
  if (kind === 'crest') {
    if (
      value !== null &&
      (!value ||
        !CREST_SHAPES.includes(value.shape) ||
        !CREST_PATTERNS.includes(value.pattern) ||
        !emblemIds.includes(value.emblem) ||
        !validColour(value.primary) ||
        !validColour(value.secondary) ||
        (value.emblemColour !== undefined && !validColour(value.emblemColour)))
    )
      return null;
    p.crest = value;
  } else if (kind === 'area') return purchaseLandmark({ ...town, personalisation: p }, command);
  else if (kind === 'plaque' && id === 'mine' && (value === null || earned.includes(value))) {
    if (value === null) delete p.plaques[id];
    else p.plaques[id] = value;
  } else return null;
  return { ...town, personalisation: normalizePersonalisation(p, emblemIds) };
}
