import { createApp, watch } from 'vue';
import { locale, browserLocale } from './i18n';
import { createPinia } from 'pinia';
import { createTestingTools } from './services/testingTools';
import App from './App.vue';
import CloudRoot from './components/CloudRoot.vue';
import { cloudEnabled } from './services/cloudMode';
import './styles/base.css';
import './styles/theme.css';
import './styles/arcade.css';
import './styles/mine.css';

const app = createApp(cloudEnabled ? CloudRoot : App);
const pinia = createPinia();

app.use(pinia);
window.prospectDebug = createTestingTools(pinia);
const languageChanged = () => {
  if (!cloudEnabled) locale.value = browserLocale();
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
app.mount('#app');
