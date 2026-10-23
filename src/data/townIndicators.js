// Building actions shown over the 3D town: their icon, size and class. Ready, coin
// and TNT actions are enlarged so they read at the same scale as the WebGL overlays.
import { BUILDING_BY_ID } from './town';
import { t } from '../i18n';

export const TOWN_ACTIONS = Object.freeze({
  ready: { icon: '/art/rewards/builder-hammer.svg', scale: 1.4, class: 'town-completion-icon' },
  coins: { icon: '/art/rewards/coins.svg', scale: 1.4 },
  tnt: { icon: '/art/powers/tnt.svg', scale: 1.4 },
  bell: { icon: '/art/rewards/town-bell.svg', scale: 1, class: 'raid-bell-ready' },
  era: { icon: '/art/rewards/era-compass.svg', scale: 1, class: 'town-era-icon' },
});

export function buildingActionLabel(town, id, indicator) {
  const labels = {
    ready: () => t('Finish {building}', { building: t(BUILDING_BY_ID[id].shortName) }),
    coins: () => t('Collect {coins} coins', { coins: town.income.stored }),
    tnt: () => t('Collect 1 TNT'),
    bell: () => t('Ring town bell · halve the loss'),
    era: () => t('Advance to the next era'),
  };
  return labels[indicator]?.();
}
