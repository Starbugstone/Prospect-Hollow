import { createApp, defineAsyncComponent, watch } from 'vue';
import { locale, browserLocale, t } from './i18n';
import { createPinia } from 'pinia';
import { createLocalIntegrityPlugin } from './services/localIntegrity';
import { createTestingTools, debugToolsAllowed } from './services/testingTools';
import { townStorage } from './services/townStorage';
import CloudRoot from './components/CloudRoot.vue';
import { useCampaignStore } from './stores/campaignStore';
import { isPlayRoute, isPrivacyRoute, isVisitRoute, upgradeLegacyLink } from './services/appRoute';
import './styles/base.css';
import './styles/theme.css';
import './styles/arcade.css';
import './styles/mine.css';
import './styles/ux.css';

upgradeLegacyLink();
// A share link mounts only the read-only visit page: no game, town or sync starts.
const visiting = isVisitRoute();
// The privacy notice is a document: it opens even where the game cannot save.
const privacy = isPrivacyRoute();
const app = createApp(
  privacy
    ? defineAsyncComponent(() => import('./components/privacy/PrivacyPage.vue'))
    : visiting
      ? defineAsyncComponent(() => import('./components/community/VisitRoot.vue'))
      : CloudRoot,
);
const pinia = createPinia();
pinia.use(createLocalIntegrityPlugin());

app.use(pinia);

if (debugToolsAllowed()) window.prospectDebug = createTestingTools(pinia);
const languageChanged = () => {
  locale.value = browserLocale();
};
const stopLanguageWatch = watch(
  locale,
  (language) => {
    document.documentElement.lang = language;
  },
  { immediate: true },
);
window.addEventListener('languagechange', languageChanged);
app.onUnmount(() => {
  window.removeEventListener('languagechange', languageChanged);
  stopLanguageWatch();
  delete window.prospectDebug;
});
async function start() {
  if (privacy) {
    app.mount('#app');
    return;
  }
  try {
    if (navigator.locks) {
      await navigator.locks.request('prospect-storage-migration-v2', () =>
        townStorage.initialize(),
      );
    } else {
      // Do not migrate or write saves without browser-enforced ownership.
      throw new Error('Safe saving requires a browser with Web Locks support.');
    }
    app.mount('#app');
    if (!visiting && (isPlayRoute() || useCampaignStore(pinia).hasVisitedVillage)) {
      import('./components/town/TownView.vue');
      import('./game/town/TownDiorama');
    }
  } catch (error) {
    showStartupError(error);
  }
}
// Uses the launch screen styles bundled with CloudRoot; Vue never mounted here.
function showStartupError(error) {
  const insecure = !navigator.locks && location.protocol === 'http:';
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const gem = element('img', 'town-tab-gem');
  gem.src = '/art/amethyst.svg';
  gem.alt = '';
  const action = element(
    'button',
    'town-tab-primary',
    t(insecure ? 'Open the secure site' : 'Try again'),
  );
  action.addEventListener('click', () =>
    insecure ? location.replace(location.href.replace(/^http:/, 'https:')) : location.reload(),
  );
  const actions = element('div', 'town-tab-actions');
  actions.append(action);
  const card = element('section', 'town-tab-notice');
  card.setAttribute('role', 'alert');
  card.append(
    gem,
    element('p', 'town-tab-brand', 'PROSPECT HOLLOW'),
    element(
      'h1',
      '',
      t(navigator.locks ? 'Unable to open this town' : 'This page cannot save safely'),
    ),
    element(
      'p',
      '',
      navigator.locks
        ? `${t(error.message)} ${t('Your existing save has been kept. Close other game tabs and try again.')}`
        : t(
            'Saving needs a secure (https) connection and an up-to-date browser. Your village on this device is safe.',
          ),
    ),
    actions,
  );
  const screen = element('main', 'town-launch-screen');
  screen.append(card);
  document.getElementById('app').replaceChildren(screen);
}
// Browsers only offer Web Locks, and so safe saving, on secure pages.
if (import.meta.env.PROD && !window.isSecureContext && location.protocol === 'http:')
  location.replace(location.href.replace(/^http:/, 'https:'));
else start();
