import { constructionReady, constructionRuns } from './TownRules';
import { eraBuildingLevel } from './TownEras';
import { t } from '../../i18n';

// A shared label contract for both settlement maps and their SVG fallback.
// Marker selection itself remains in buildingIndicators, including its priority.
export function buildingStatusLabel(town, id, indicator, available = false) {
  const project = town.projects?.[id];
  if (constructionReady(project)) return t('Tap to finish');
  if (project)
    return `${Math.min(project.wins, constructionRuns(project))}/${constructionRuns(project)}`;
  if (indicator === 'coins') return t('Collect {coins} coins', { coins: town.income.stored });
  if (indicator === 'tnt') return t('Collect 1 TNT');
  if (available) return t(town.buildings[id] ? 'Upgrade' : 'Build');
  if (town.buildings[id]) return t('Lv. {level}', { level: eraBuildingLevel(town, id) });
  return t('Coming soon');
}
