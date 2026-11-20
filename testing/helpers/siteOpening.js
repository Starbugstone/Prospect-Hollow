import { AREA_BY_ID, PERSONAL_AREAS } from '../../src/data/townLandmarks';

// A copy of `town` that meets what a site waits for beyond its era (`opens`): the building
// level it names, or a paid first stage at the first site it waits for (itself opened the
// same way). Tests that open every site share this, so a new kind of opening is handled
// once. Levels are only ever raised, as the game raises them.
export function openSite(town, area) {
  const opens = area?.opens;
  if (!opens) return town;
  if (typeof opens.building === 'string')
    return {
      ...town,
      buildings: {
        ...town.buildings,
        [opens.building]: Math.max(town.buildings?.[opens.building] ?? 0, opens.level),
      },
    };
  if (!Array.isArray(opens.sites)) throw new Error(`${area.id} waits for an unknown opening.`);
  const opener = AREA_BY_ID[opens.sites[0]];
  const opened = openSite(town, opener);
  const p = opened.personalisation ?? {};
  const choice = p.areas?.[opener.id]?.[0] ?? opener.choices[0];
  return {
    ...opened,
    personalisation: {
      ...p,
      areas: { ...p.areas, [opener.id]: [choice] },
      areaLevels: {
        ...p.areaLevels,
        [opener.id]: Math.max(p.areaLevels?.[opener.id] ?? 0, opens.level),
      },
    },
  };
}
/** `town` with every listed site's opening met (the era is the caller's). */
export const openEverySite = (town, areas = PERSONAL_AREAS) => areas.reduce(openSite, town);
