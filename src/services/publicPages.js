import { defineAsyncComponent, h } from 'vue';
import GameViewStatus from '../components/GameViewStatus.vue';
import { isPrivacyRoute, isVisitRoute } from './appRoute';

// A page chunk can fail to load, for example a chunk that a release replaced. The reload
// notice ships with startup, so it still shows when the page's own chunk is missing.
const lazyPage = (loader) =>
  defineAsyncComponent({
    loader,
    timeout: 15000,
    errorComponent: { render: () => h(GameViewStatus, { failed: true }) },
  });

/**
 * The page a public address mounts instead of the game: the privacy notice, or the
 * read-only visit a share link opens. Neither opens, migrates or syncs a save.
 * @param {URL|Location} [url]
 * @returns {object|null} The page component, or null for the game's own addresses.
 */
export function publicPage(url = location) {
  if (isPrivacyRoute(url)) return lazyPage(() => import('../components/privacy/PrivacyPage.vue'));
  if (isVisitRoute(url)) return lazyPage(() => import('../components/community/VisitRoot.vue'));
  return null;
}
