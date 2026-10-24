import { BUILDINGS } from './town';
import { ERAS, eraEvolution } from './eras';
import { CITY_ARCHITECTURES } from './eraDefinitions';

// Construction and a new era's finish are separate. A modernization keeps the
// completed structure and its one mature purpose module. New finish tiers
// upgrade that module's glazing/frontage and operational roof fittings within
// its fixed envelope; they never buy the same room again or accumulate rooms
// across eras. Callers pass the building's own finish era,
// including when the current town era only modernizes a subset of its plots.
export function buildingStages(kind, era, level, serviceLevel = 3) {
  const nativeStages = {
    modernizing: false,
    structureLevel: level,
    moduleLevel: level,
    finishLevel: level,
  };
  const building = BUILDINGS.find((entry) => entry.kind === kind);
  const profile = eraEvolution(era);
  if (
    !building ||
    building.settlement ||
    !['city', 'motor-age'].includes(profile?.style) ||
    !CITY_ARCHITECTURES.includes(profile.architecture)
  )
    return nativeStages;

  const index = ERAS.findIndex((entry) => entry.id === era);
  // A complete synthetic successor inherits its architecture. An incomplete
  // definition cannot turn a native building into an already-complete one.
  if (index < 0 && !profile.cityAssets && !profile.baseCityEra) return nativeStages;
  const target =
    index >= 0
      ? index
      : ERAS.findLastIndex((entry) => entry.evolution.architecture === profile.architecture) + 1;
  const native = ERAS.findIndex((entry) => entry.id === building.introducedEra);
  const modernizing = target > native && native >= 0;
  return {
    modernizing,
    structureLevel: modernizing ? Math.max(level, Math.min(3, serviceLevel)) : level,
    moduleLevel: modernizing ? Math.max(level, Math.min(3, serviceLevel)) : level,
    finishLevel: level,
  };
}
