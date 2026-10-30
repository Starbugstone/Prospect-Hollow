// Building actions shown over the 3D town: their icon, size and class. Ready, coin
// and TNT actions are enlarged so they read at the same scale as the WebGL overlays.
import { BUILDING_BY_ID } from './town';
import { AREA_BY_ID, LANDMARK_BY_ID, areaChoice } from './townLandmarks';
import { t } from '../i18n';

export const TOWN_ACTIONS = Object.freeze({
  ready: { icon: '/art/rewards/builder-hammer.svg', scale: 1.4, class: 'town-completion-icon' },
  coins: { icon: '/art/rewards/coins.svg', scale: 1.4 },
  tnt: { icon: '/art/powers/tnt.svg', scale: 1.4 },
  bell: { icon: '/art/rewards/town-bell.svg', scale: 1, class: 'raid-bell-ready' },
  era: { icon: '/art/rewards/era-compass.svg', scale: 1, class: 'town-era-icon' },
  commission: { icon: '/art/rewards/commission-letter.svg', scale: 1.2 },
});

// The accessible name of a place's action icon on every settlement map. A monument
// site (valley or Moon) is ready when its finished level waits to be unveiled.
export function buildingActionLabel(town, id, indicator) {
  const area = AREA_BY_ID[id];
  const labels = {
    ready: () =>
      area
        ? t('Unveil the {monument}', {
            monument: t(LANDMARK_BY_ID[areaChoice(town, area)].label),
          })
        : t('Finish {building}', { building: t(BUILDING_BY_ID[id].shortName) }),
    coins: () => t('Collect {coins} coins', { coins: town.income.stored }),
    tnt: () => t('Collect 1 TNT'),
    bell: () => t('Ring town bell · halve the loss'),
    era: () => t('Advance to the next era'),
    commission: () => t('Read the request for {site}', { site: t(area.label) }),
  };
  return labels[indicator]?.();
}
