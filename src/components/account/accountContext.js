import { inject, provide, ref } from 'vue';
import { cloud } from '../../services/cloudProfile';
import { profileSummary } from '../../services/townSummary';
import { ERAS, ERA_BY_ID } from '../../data/eras';
import { t, number } from '../../i18n';

const KEY = Symbol('account-panel');

// The account panel views share one busy flag and one message line, so a slow
// request in one view cannot start a second account operation in another.
export function provideAccountContext(events) {
  const busy = ref(false),
    message = ref('');
  async function act(operation) {
    if (busy.value) return;
    busy.value = true;
    message.value = '';
    cloud.error = '';
    try {
      await operation();
    } catch (error) {
      message.value = error.message;
    } finally {
      busy.value = false;
      cloud.storageVersion++;
    }
  }
  const context = { busy, message, act, ...events };
  provide(KEY, context);
  return context;
}
export const useAccountContext = () => inject(KEY);

export const countBuildings = (profile) => profileSummary(profile)?.buildings ?? 0;
export const eraName = (era) => (era ? t(ERA_BY_ID[era]?.label ?? era) : '');
export const eraLabel = (profile) => eraName(profile?.town?.era);
export const townSummary = (profile) =>
  profile?.town
    ? [
        eraLabel(profile),
        t('{count} buildings', { count: countBuildings(profile) }),
        t('{coins} coins', { coins: number(profile.town.coins ?? 0) }),
      ].join(' · ')
    : '';
// Card artwork follows era order, so a new era gets its own shade without a table.
export function eraHue(era) {
  const index = ERAS.findIndex((entry) => entry.id === era);
  return index < 0 ? null : 38 + (index / Math.max(1, ERAS.length - 1)) * 170;
}
