// Game names for ids found in saves. Unknown ids (newer saves) show as they are.
import { ERAS, ERA_BY_ID } from '../data/eras';
import { BUILDINGS, BUILDING_BY_ID } from '../data/town';
import { LEVEL_COUNT, POWERS } from '../data/campaign';

export { ERAS, BUILDINGS, LEVEL_COUNT };
export const eraLabel = (id) => (id ? (ERA_BY_ID[id]?.label ?? id) : '—');
export const buildingLabel = (id) => BUILDING_BY_ID[id]?.name ?? id;
export const powerLabel = (id) => POWERS.find((power) => power.id === id)?.label ?? id;
