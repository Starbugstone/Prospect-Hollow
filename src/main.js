import { createApp, watch } from 'vue';
import { locale, browserLocale } from './i18n';
import { createPinia } from 'pinia';
import { createTestingTools } from './services/testingTools';
import { townStorage } from './services/townStorage';
import CloudRoot from './components/CloudRoot.vue';
import './styles/base.css';
import './styles/theme.css';
import './styles/arcade.css';
import './styles/mine.css';
import './styles/ux.css';

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
  } catch (error) {
    const notice = document.createElement('p');
    notice.textContent = `${error.message} Your existing save has been kept. Close other game tabs and try again.`;
    document.getElementById('app').replaceChildren(notice);
  }
}
start();
