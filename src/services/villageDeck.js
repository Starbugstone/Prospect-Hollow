import { request } from './cloudProfile';

// Shared towns are dealt like a shuffled deck (see PublicTown::browse). The server picks a
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
