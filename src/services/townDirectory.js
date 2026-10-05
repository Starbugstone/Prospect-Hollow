import { request } from './cloudProfile';
import { HONOURS } from '../data/honours';
import {
  distinctionBadge,
  isPlayerDistinction,
  publishedDistinction,
} from '../data/playerDistinctions';

// Shared towns are dealt like a shuffled deck (see TownDirectory::browse). The server picks a
// seed, each page is the next draw of up to seven towns, and a spent deck is reshuffled with
// a new seed, so a player meets every shared town before any of them comes round again.
export const nextDraw = (current) =>
  current?.hasNext && current.seed ? `page=${current.page + 1}&seed=${current.seed}` : 'page=1';
// Coming back from a visit deals the same towns again with fresh saloon and visitor news.
export const sameDraw = (current) =>
  current?.seed ? `page=${current.page}&seed=${current.seed}` : 'page=1';
// A first draw that holds the whole deck leaves nothing else to show.
export const wholeDeck = (current) => current?.page === 1 && !current.hasNext;
export const drawVillages = (query) => request(`villages?${query}`);

// Town names allow 3–24 characters; a search needs at least two of them.
export const searchTerm = (text) => text.trim().replace(/\s+/g, ' ');
export const searchable = (text) => [...searchTerm(text)].length >= 2;
export const searchVillages = (text) =>
  request(`villages?${new URLSearchParams({ q: searchTerm(text) })}`);

// Favourites are kept on the account, so they follow the player to every device.
export const favouriteVillages = () => request('villages/favourites');
export const setFavourite = (id, keep) =>
  request(`villages/${encodeURIComponent(id)}/favourite`, {}, keep ? 'PUT' : 'DELETE');

// A card shows the best earned rank of each honour family the owner showcases, the
// owner's player distinction (the directory's `distinction`, or the owner's own
// `received` on their town list), and how many honours the town holds. IDs this
// version does not know are not counted or shown.
export function cardHonours(
  honours,
  received = publishedDistinction(honours?.distinction),
  catalog = HONOURS,
) {
  if (!honours) return null;
  const earned = new Set((honours.earned ?? []).filter((id) => catalog.byId[id]));
  let distinction = false;
  const showcase = (honours.showcase ?? [])
    .map((id) => {
      if (!isPlayerDistinction(id))
        return catalog.familyById[id]?.ranks
          .filter((definition) => earned.has(definition.id))
          .at(-1);
      if (distinction || !Object.hasOwn(received, id)) return null;
      distinction = true;
      return distinctionBadge(id, received[id]);
    })
    .filter(Boolean);
  if (!earned.size && !showcase.length) return null;
  return { count: earned.size, showcase };
}
