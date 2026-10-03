import { resolveRoadStyle } from './roadStyles';
import { TOWN_FAUNA } from './townAnimals';
import { ERA_SUPPLY_STEP } from './townNeeds';

/**
 * @typedef {'frontier'|'river-rail'|'industrial'|'motor-age'|'city'} BuildingStyle
 * @typedef {'standard'|'rounded'|'cozy'} CityArchitecture
 * @typedef {'standard'|'rounded'} TransportStyle
 * @typedef {Object} EraEvolution
 * @property {BuildingStyle} style Shared building/modernization renderer family.
 * @property {CityArchitecture} architecture City building forms: Blender period shells
 *   (`standard`), procedural domes/pods (`rounded`) or planted timber/glass
 *   architecture selected by the shared `cozyStyle` profile (`cozy`).
 * @property {'canopy'|'riverlight'|null} cozyStyle Shared cozy architecture palette and forms.
 * @property {TransportStyle} transportStyle Airport, station, port and street vehicles:
 *   period and city models (`standard`) or the sky saucer, solar express, hover ferry
 *   and hover traffic (`rounded`). Independent of `architecture`, so a later era can
 *   change its buildings and keep its vehicles.
 * @property {string} wildlife Shared ambient cast and companion lifestyle profile.
 * @property {string} wardrobe Wardrobe catalog key for this era.
 * @property {string|null} baseCityEra Retained city shell for an intermediate style.
 * @property {boolean} paved
 * @property {boolean} electricity
 * @property {boolean} modernTransport
 * @property {number|null} motorTrafficLevel Minimum stable modernization level.
 * @property {boolean} busService
 * @property {boolean} overheadPower
 * @property {string} roadColor
 * @property {string} roadStyle Surface treatment registered in roadStyles.js.
 * @property {boolean} roadBridge Continuous surfaced bridge deck instead of timber steps.
 * @property {string} incident
 * @property {readonly number[]|null} prices Three modernization prices; never mining rewards.
 * @property {string|null} cityAssets Blender asset family shared by city eras.
 * @property {string|null} detailAsset
 * @property {string|null} airportStyle Airport architecture from airportStyles.json.
 * @property {string} fountain Town square centerpiece design registered in TownFountains.js.
 * @property {boolean} digitalCity
 * @property {boolean} tallCity
 * @property {string|null} cityDescription
 * @property {readonly number[]|null} newBuildingPrices
 * @property {boolean} cityBoat
 * @property {readonly number[]} waterworks Water capacity at each modernization tier.
 * @property {readonly number[]} farmCapacity Additional farm capacity at each tier.
 * @property {string} upgradeTitle
 * @property {readonly string[]} upgradeDescriptions Second and third modernization descriptions.
 * @property {boolean} requiresPower
 */

/** Registered city building forms; renderers and SVG drawings exist for each. */
export const CITY_ARCHITECTURES = Object.freeze(['standard', 'rounded', 'cozy']);
/** Registered vehicle families; each has airport, rail, ferry and traffic models. */
export const TRANSPORT_STYLES = Object.freeze(['standard', 'rounded']);

const STYLES = {
  frontier: {},
  'river-rail': {
    wardrobe: 'rail',
    fountain: 'victorian-iron',
    roadStyle: 'gravel',
    incident: 'cargo-theft',
    upgradeTitle: 'River & Rail level {level}: {name}',
    upgradeDescriptions: [
      'Add a substantial extension and a covered veranda.',
      'Complete the landmark with its working extensions.',
    ],
  },
  industrial: {
    wardrobe: 'workwear',
    fountain: 'civic-monument',
    upgradeTitle: 'Industrial level {level}: {name}',
    upgradeDescriptions: [
      'Add a substantial service wing and sheltered entrance.',
      'Complete the landmark with its final civic and utility structures.',
    ],
    paved: true,
    electricity: true,
    modernTransport: true,
    motorTrafficLevel: 2,
    roadStyle: 'brick',
    incident: 'workshop-fire',
    requiresPower: true,
  },
  'motor-age': {
    roadBridge: true,
    wardrobe: 'motor',
    fountain: 'art-deco',
    baseCityEra: 'post-war',
    upgradeTitle: 'Motor Age level {level}: {name}',
    upgradeDescriptions: [
      'Add a sunny service wing and a broad street canopy.',
      'Complete the landmark with its stepped frontage and planted terrace.',
    ],
    paved: true,
    electricity: true,
    modernTransport: true,
    motorTrafficLevel: 1,
    busService: true,
    roadStyle: 'early-asphalt',
    incident: 'workshop-fire',
  },
  city: {
    roadBridge: true,
    wardrobe: 'casual',
    fountain: 'memorial-obelisk',
    paved: true,
    electricity: true,
    modernTransport: true,
    motorTrafficLevel: 1,
    busService: true,
    roadStyle: 'concrete',
    incident: 'workshop-fire',
    cityBoat: true,
    upgradeTitle: 'City level {level}: {name}',
    upgradeDescriptions: [
      'Add a sheltered side wing and a planted forecourt.',
      'Complete the landmark with its roof garden and civic lighting.',
    ],
  },
};

/** Build and validate a data contract once, outside rendering/update loops.
 * A new era using an existing style supplies its profile in eras.js; consumers
 * use capabilities rather than keeping their own chronological era lists.
 * @param {{id: string, label: string, yearLabel: string, enabled: boolean, evolution: Partial<EraEvolution>}} definition
 * @returns {Readonly<Object & {evolution: Readonly<EraEvolution>}>}
 */
export function defineEra(definition) {
  const style = definition.evolution?.style;
  if (!definition.id || !Object.hasOwn(STYLES, style))
    throw new Error('An era needs an id and a registered building style');
  const evolution = {
    wardrobe: 'frontier',
    architecture: 'standard',
    cozyStyle: null,
    transportStyle: 'standard',
    wildlife: 'standard',
    baseCityEra: null,
    paved: false,
    electricity: false,
    modernTransport: false,
    motorTrafficLevel: null,
    busService: false,
    overheadPower: true,
    roadStyle: 'dirt',
    roadBridge: false,
    incident: 'bandits',
    prices: null,
    cityAssets: null,
    detailAsset: null,
    airportStyle: null,
    fountain: 'frontier-spring',
    digitalCity: false,
    tallCity: false,
    cityDescription: null,
    newBuildingPrices: null,
    cityBoat: false,
    waterworks: null,
    farmCapacity: null,
    upgradeTitle: '',
    upgradeDescriptions: [],
    requiresPower: false,
    ...STYLES[style],
    ...definition.evolution,
  };
  evolution.roadColor ??= resolveRoadStyle(evolution.roadStyle).color;
  for (const field of ['prices', 'newBuildingPrices', 'waterworks', 'farmCapacity']) {
    const values = evolution[field];
    if (
      values != null &&
      (!Array.isArray(values) ||
        values.length !== 3 ||
        !values.every((value) => Number.isFinite(value) && value >= 0))
    )
      throw new Error(`Invalid ${field} for era ${definition.id}`);
  }
  if (
    style !== 'frontier' &&
    (!evolution.upgradeTitle ||
      evolution.upgradeDescriptions.length !== 2 ||
      !evolution.upgradeDescriptions.every((text) => typeof text === 'string' && text.length))
  )
    throw new Error(`Missing modernization copy for era ${definition.id}`);
  if (style !== 'frontier' && !evolution.prices)
    throw new Error(`Missing modernization prices for era ${definition.id}`);
  if (!CITY_ARCHITECTURES.includes(evolution.architecture))
    throw new Error(`Unsupported architecture for era ${definition.id}`);
  if (!Object.hasOwn(TOWN_FAUNA, evolution.wildlife))
    throw new Error(`Unsupported wildlife for era ${definition.id}`);
  if (evolution.architecture === 'cozy' && !['canopy', 'riverlight'].includes(evolution.cozyStyle))
    throw new Error(`Missing cozy style for era ${definition.id}`);
  if (evolution.architecture !== 'standard' && style !== 'city')
    throw new Error(`Only city eras can change their architecture: ${definition.id}`);
  if (!TRANSPORT_STYLES.includes(evolution.transportStyle))
    throw new Error(`Unsupported transport style for era ${definition.id}`);
  if (evolution.transportStyle !== 'standard' && style !== 'city')
    throw new Error(`Only city eras can change their transport style: ${definition.id}`);
  if (style === 'city' && (!evolution.cityAssets || !evolution.newBuildingPrices))
    throw new Error(`Missing city assets or prices for era ${definition.id}`);
  for (const [key, value] of Object.entries(evolution))
    if (Array.isArray(value)) evolution[key] = Object.freeze([...value]);
  return Object.freeze({ ...definition, evolution: Object.freeze(evolution) });
}

/** Resolve only an era prefix; marker assets without an era keep their names. */
// Modernizing the waterworks or the farm must never lower their capacity. An era
// without its own tiers continues from the previous era's best tier.
export function continueSupplyTiers(eras) {
  const best = { waterworks: 0, farmCapacity: 0 };
  return eras.map((era) => {
    const tiers = {};
    for (const field of Object.keys(best)) {
      tiers[field] =
        era.evolution[field] ??
        Object.freeze([1, 2, 3].map((tier) => best[field] + tier * ERA_SUPPLY_STEP));
      best[field] = Math.max(best[field], ...tiers[field]);
    }
    return Object.freeze({ ...era, evolution: Object.freeze({ ...era.evolution, ...tiers }) });
  });
}

export function resolveCityAsset(name, eras) {
  const era = eras.reduce(
    (best, entry) =>
      entry.evolution.cityAssets &&
      name.startsWith(`${entry.id}-`) &&
      (!best || entry.id.length > best.id.length)
        ? entry
        : best,
    null,
  );
  return era ? `${era.evolution.cityAssets}${name.slice(era.id.length)}` : name;
}
