import { townStorage } from './townStorage';
import { HOME_PATH, PRIVACY_PATH, VISIT_PATH } from './publicLinks';
export { HOME_PATH, privacyUrl, visitUrl } from './publicLinks';

const PLAY_PATH = `${HOME_PATH}play`;

const routePath = (url) => url.pathname.replace(/\/+$/, '');
export const isPlayRoute = (url = location) => routePath(url) === PLAY_PATH;
export const isVisitRoute = (url = location) => routePath(url) === VISIT_PATH;
export const isPrivacyRoute = (url = location) => routePath(url) === PRIVACY_PATH;
// The public id stays in the hash so it never reaches server logs or referrers.
export const visitId = (url = location) => new URLSearchParams(url.hash.slice(1)).get('town') ?? '';

// A cloud town carries ?play=<id> so a reload or copied link reopens that town.
// Only the game address carries it; the home page never opens a town by itself.
function withTown(url, play) {
  const meta = townStorage.activeMeta();
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
// Links made before the game had its own address opened a town with /?play=<id>,
// and shared towns once opened over the game with #town=<publicId>.
export function upgradeLegacyLink() {
  const url = new URL(location.href);
  const shared = visitId(url);
  if (shared && !isVisitRoute(url)) {
    url.pathname = VISIT_PATH;
    url.search = '';
    url.hash = new URLSearchParams({ town: shared }).toString();
    history.replaceState(null, '', url);
    return;
  }
  if (isPlayRoute(url) || !url.searchParams.has('play')) return;
  url.pathname = PLAY_PATH;
  history.replaceState(history.state, '', url);
}
export const townUrl = (id) => `${location.origin}${PLAY_PATH}?play=${encodeURIComponent(id)}`;
