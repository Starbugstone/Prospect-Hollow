/**
 * @typedef {'frontier'|'river-rail'|'industrial'|'motor-age'|'city'} BuildingStyle
 * @typedef {Object} EraEvolution
 * @property {BuildingStyle} style Shared building/modernization renderer family.
 * @property {boolean} paved
 * @property {boolean} electricity
 * @property {boolean} modernTransport
 * @property {number|null} motorTrafficLevel Minimum stable modernization level.
 * @property {boolean} busService
 * @property {boolean} overheadPower
 * @property {string} roadColor
 * @property {string} incident
 * @property {readonly number[]|null} prices Three modernization prices; never mining rewards.
 * @property {string|null} cityAssets Blender asset family shared by city eras.
 * @property {string|null} detailAsset
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
 * @property {string} waterUpgradeBenefit
 * @property {boolean} motorMine Trim on the accessible mine drawing.
 */

const STYLES = {
  frontier: {},
  'river-rail': {
    roadColor: '#b3a18a',
    incident: 'cargo-theft',
    upgradeTitle: 'River & Rail level {level}: {name}',
    upgradeDescriptions: [
      'Add a substantial extension and a covered veranda.',
      'Complete the landmark with a clock tower and ornamental roof.',
    ],
  },
  industrial: {
    upgradeTitle: 'Industrial level {level}: {name}',
    upgradeDescriptions: [
      'Add a substantial service wing and sheltered entrance.',
      'Complete the landmark with its final civic and utility structures.',
    ],
    paved: true,
    electricity: true,
    modernTransport: true,
    motorTrafficLevel: 2,
    roadColor: '#89928a',
    incident: 'workshop-fire',
    requiresPower: true,
  },
  'motor-age': {
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
    motorMine: true,
    roadColor: '#858b86',
    incident: 'workshop-fire',
  },
  city: {
    paved: true,
    electricity: true,
    modernTransport: true,
    motorTrafficLevel: 1,
    busService: true,
    roadColor: '#89928a',
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
    paved: false,
    electricity: false,
    modernTransport: false,
    motorTrafficLevel: null,
    busService: false,
    overheadPower: true,
    roadColor: '#c3a477',
    incident: 'bandits',
    waterUpgradeBenefit:
      'Adds water for twenty people when finished. All existing water stays available during work.',
    prices: null,
    cityAssets: null,
    detailAsset: null,
    digitalCity: false,
    tallCity: false,
    cityDescription: null,
    newBuildingPrices: null,
    cityBoat: false,
    waterworks: [0, 0, 0],
    farmCapacity: [0, 0, 0],
    upgradeTitle: '',
    upgradeDescriptions: [],
    requiresPower: false,
    motorMine: false,
    ...STYLES[style],
    ...definition.evolution,
  };
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
  if (style === 'city' && (!evolution.cityAssets || !evolution.newBuildingPrices))
    throw new Error(`Missing city assets or prices for era ${definition.id}`);
  for (const [key, value] of Object.entries(evolution))
    if (Array.isArray(value)) evolution[key] = Object.freeze([...value]);
  return Object.freeze({ ...definition, evolution: Object.freeze(evolution) });
}

/** Resolve only an era prefix; marker assets without an era keep their names. */
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
