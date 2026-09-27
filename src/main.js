import { createApp, watch } from 'vue';
import { locale, browserLocale } from './i18n';
import { createPinia } from 'pinia';
import { createTestingTools } from './services/testingTools';
import App from './App.vue';
import { useCampaignStore } from './stores/campaignStore';
import './styles/base.css';
import './styles/theme.css';
import './styles/arcade.css';
import './styles/mine.css';
import './styles/ux.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
if (useCampaignStore(pinia).hasVisitedVillage) {
  import('./components/town/TownView.vue');
  import('./game/town/TownDiorama');
}

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
app.mount('#app');
