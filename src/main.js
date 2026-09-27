import { createApp, watch } from 'vue';
import { locale, browserLocale, t } from './i18n';
import { createPinia } from 'pinia';
import { createTestingTools } from './services/testingTools';
import { townStorage } from './services/townStorage';
import CloudRoot from './components/CloudRoot.vue';
import { useCampaignStore } from './stores/campaignStore';
import './styles/base.css';
import './styles/theme.css';
import './styles/arcade.css';
import './styles/mine.css';
import './styles/ux.css';
import { privacy } from './services/privacy';
import { ads } from './services/ads';

const app = createApp(CloudRoot);
const pinia = createPinia();

app.use(pinia);

window.prospectDebug = createTestingTools(pinia);
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
  ads.destroy();
  privacy.dispose();
  window.removeEventListener('languagechange', languageChanged);
  stopLanguageWatch();
  delete window.prospectDebug;
});
async function start() {
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
    // Privacy and ads never delay the game or load advertisers without permission.
    void privacy.initialize({ locale: locale.value });
    void ads.initialize();
    if (useCampaignStore(pinia).hasVisitedVillage) {
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
