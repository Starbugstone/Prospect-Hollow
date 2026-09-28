import { townStorage } from './townStorage';

// The home page lives at the site root and the game at /play, so a reload keeps
// the player where they were and the home page stays one tap away.
const HOME_PATH = import.meta.env.BASE_URL ?? '/';
export const PLAY_PATH = `${HOME_PATH}play`;

export const isPlayRoute = (url = location) => url.pathname.replace(/\/+$/, '') === PLAY_PATH;

// A cloud town carries ?play=<id> so a reload or copied link reopens that town.
// Only the game address carries it; the home page never opens a town by itself.
function withTown(url, play) {
  const meta = townStorage.active()?.meta;
  if (play && meta?.owner) url.searchParams.set('play', meta.id);
  else url.searchParams.delete('play');
  return url;
}
export function syncTownParam() {
  history.replaceState(history.state, '', withTown(new URL(location.href), isPlayRoute()));
}
export function navigate(play) {
  if (isPlayRoute() === play) return;
  const url = new URL(location.href);
  url.pathname = play ? PLAY_PATH : HOME_PATH;
  url.hash = '';
  history.pushState(null, '', withTown(url, play));
}
// Links made before the game had its own address opened a town with /?play=<id>.
export function upgradeLegacyLink() {
  const url = new URL(location.href);
  if (isPlayRoute(url) || !url.searchParams.has('play')) return;
  url.pathname = PLAY_PATH;
  history.replaceState(history.state, '', url);
}
export const townUrl = (id) => `${location.origin}${PLAY_PATH}?play=${encodeURIComponent(id)}`;
