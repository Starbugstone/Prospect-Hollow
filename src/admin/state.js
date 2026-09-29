import { reactive, watch } from 'vue';
import { parseRoute } from './routes';
import { maskEmail } from './format';

export const route = reactive(parseRoute(location.hash));
addEventListener('hashchange', () => Object.assign(route, parseRoute(location.hash)));
export const go = (path) => {
  location.hash = `#/${path}`;
};

// Masks emails for screen sharing; remembered on this device only.
const HIDE_EMAILS = 'prospect-admin-hide-emails';
const saved = () => {
  try {
    return localStorage.getItem(HIDE_EMAILS) === 'true';
  } catch {
    return false;
  }
};
export const prefs = reactive({ hideEmails: saved() });
watch(
  () => prefs.hideEmails,
  (hide) => {
    try {
      localStorage.setItem(HIDE_EMAILS, String(hide));
    } catch {
      /* The preference then lasts for this page only. */
    }
  },
);
export const shownEmail = (email) => (prefs.hideEmails ? maskEmail(email) : email);

// List filters survive opening a player or town and coming back.
export const playerQuery = reactive({ q: '', sort: 'seen', page: 1 });
export const townQuery = reactive({ q: '', filter: 'live', page: 1 });
