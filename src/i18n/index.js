import { ref, shallowRef, watch } from 'vue';

const french = shallowRef(null);
let frenchLoad = null;
// French text is its own chunk, downloaded only by French players. A failed
// download keeps the game in English and lets a later change retry.
export function loadFrench() {
  frenchLoad ??= import('./fr.json').then(
    (module) => {
      french.value = module.default;
    },
    (error) => {
      frenchLoad = null;
      console.warn('French text unavailable; showing English.', error);
    },
  );
  return frenchLoad;
}

export function browserLocale(
  languages = globalThis.navigator?.languages ?? [globalThis.navigator?.language],
) {
  for (const language of languages ?? []) {
    const base = String(language ?? '')
      .toLowerCase()
      .split('-')[0];
    if (base === 'en' || base === 'fr') return base;
  }
  return 'en';
}
export const locale = ref(browserLocale());
// Waiting here keeps t() synchronous: nothing that imports it runs before the text.
if (locale.value === 'fr') await loadFrench();
watch(
  locale,
  (language) => {
    if (language === 'fr') loadFrench();
  },
  { flush: 'sync' },
);
// A future account preference can use the same boundary without touching views.
export function setLocale(language) {
  locale.value = browserLocale([language]);
}
export function t(message, values = {}) {
  if (typeof message !== 'string') return message;
  const messages = locale.value === 'fr' ? french.value : null;
  const translated = messages && Object.hasOwn(messages, message) ? messages[message] : message;
  return translated.replace(/\{(\w+)\}/g, (token, key) => values[key] ?? token);
}
export const number = (value) => new Intl.NumberFormat(locale.value).format(value);
