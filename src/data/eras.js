import { continueSupplyTiers, defineEra } from './eraDefinitions';
// The two garden eras share city services and lifecycles. New cozy palettes can
// reuse this profile while keeping their prices, content and appearance explicit.
// Their buildings are cozy, but the airport, station, port and traffic keep
// Tomorrow's sky saucer, solar express, hover ferry and hover pods.
const COZY_CITY_EVOLUTION = {
  style: 'city',
  architecture: 'cozy',
  transportStyle: 'rounded',
  wildlife: 'garden',
  cityAssets: 'contemporary',
  detailAsset: 'digital-detail',
  airportStyle: 'connected',
  tallCity: true,
  digitalCity: true,
  overheadPower: false,
  incident: 'storm-cleanup',
};
// Content gates are independent of functional building levels and the alpha level count.
// Reserved eras never create buttons or empty lots.
export const ERAS = continueSupplyTiers(
  [
    {
      id: 'frontier',
      label: 'Frontier Settlement',
      yearLabel: 'c. 1865–1880',
      enabled: true,
      evolution: {
        style: 'frontier',
        wildlife: 'meadow',
        waterworks: [0, 0, 0],
        farmCapacity: [0, 0, 0],
      },
    },
    {
      id: 'river-rail',
      evolution: {
        waterworks: [15, 30, 45],
        farmCapacity: [5, 10, 15],
        style: 'river-rail',
        wildlife: 'riverside',
        prices: [800, 1200, 1400],
      },
      label: 'River & Rail Boom',
      yearLabel: '1884',
      enabled: true,
      story:
        'The river trade is growing, rails are approaching, and Prospect Hollow is becoming a proper town.',
    },
    {
      id: 'industrial',
      evolution: {
        waterworks: [50, 55, 60],
        farmCapacity: [20, 25, 30],
        style: 'industrial',
        wildlife: 'riverside',
        prices: [1400, 1850, 2300],
      },
      label: 'Industrial / Electric Town',
      yearLabel: '1908',
      enabled: true,
      story:
        'Brick workshops, a growing neighborhood, and the promise of electric light. Build the power house to illuminate Prospect Hollow.',
      horizon: 'A new light is coming to Prospect Hollow.',
      finale: 'The river still flows. The rails still carry us. Now we build a brighter town.',
    },
    {
      id: 'post-war',
      evolution: {
        waterworks: [63, 66, 69],
        farmCapacity: [33, 36, 39],
        style: 'city',
        wildlife: 'riverside',
        prices: [2400, 2900, 3400],
        cityAssets: 'post-war',
        roadBridge: false,
        wardrobe: 'tailored',
        newBuildingPrices: [3000, 4000, 5000],
        busService: false,
      },
      label: 'Post-war Rebuilding',
      yearLabel: '1920',
      enabled: true,
      story:
        'After the Great War, new courtyards, a civic hall and dependable utilities bring neighbors together around familiar landmarks.',
      horizon: 'A new generation is coming home to Prospect Hollow.',
      finale: 'The city grows. Its familiar places stay with us.',
    },
    {
      id: 'motor-age',
      evolution: {
        waterworks: [77, 85, 93],
        farmCapacity: [47, 55, 63],
        style: 'motor-age',
        wildlife: 'neighborhood',
        prices: [3500, 4400, 5300],
      },
      label: 'Motor Age',
      yearLabel: '1932',
      enabled: true,
      story:
        'A little bus rolls into Prospect Hollow. Sunny gardens, roadside treats and new neighbors fill the familiar streets.',
      horizon: 'The open road brings new friends to Prospect Hollow.',
      finale: 'A sunny garden. A welcoming stop. Another lovely day in town.',
    },
    {
      id: 'aviation',
      evolution: {
        waterworks: [99, 105, 111],
        farmCapacity: [69, 75, 81],
        style: 'city',
        wildlife: 'songbirds',
        prices: [4800, 5600, 6400],
        cityAssets: 'aviation',
        wardrobe: 'aviation',
        overheadPower: false,
        newBuildingPrices: [8000, 10000, 12000],
        detailAsset: 'aviation-detail',
        airportStyle: 'regional',
        fountain: 'mid-century',
        roadStyle: 'boulevard',
        cityDescription: 'Streamlined façades and radio aerials welcome the aviation age.',
      },
      label: 'Aviation & Radio',
      yearLabel: '1958',
      enabled: true,
      story:
        'An airport on the western plain opens the skies. Radio connects Prospect Hollow to the wider world.',
      horizon: 'A new horizon beyond the railway.',
      finale: 'The runway is ready. The whole world feels closer.',
    },
    {
      id: 'broadcast',
      evolution: {
        waterworks: [117, 123, 129],
        farmCapacity: [87, 93, 99],
        style: 'city',
        wildlife: 'songbirds',
        prices: [6200, 7000, 7800],
        cityAssets: 'broadcast',
        wardrobe: 'broadcast',
        overheadPower: false,
        newBuildingPrices: [8000, 10000, 12000],
        detailAsset: 'broadcast-detail',
        airportStyle: 'metropolitan',
        fountain: 'postmodern',
        roadStyle: 'city-asphalt',
        tallCity: true,
        cityBoat: false,
        cityDescription:
          'Bright signs, television aerials and taller façades bring the city to life.',
      },
      label: 'Music & Television',
      yearLabel: '1986',
      enabled: true,
      story:
        'A concert hall, television studios and a rising skyline bring music and bright screens to the city.',
      horizon: 'The city finds its own rhythm.',
      finale: 'Live music, bright screens and a skyline full of life.',
    },
    {
      id: 'contemporary',
      evolution: {
        waterworks: [137, 145, 153],
        farmCapacity: [107, 115, 123],
        style: 'city',
        wildlife: 'songbirds',
        prices: [7600, 9000, 10400],
        cityAssets: 'contemporary',
        wardrobe: 'contemporary',
        newBuildingPrices: [8000, 10000, 12000],
        detailAsset: 'digital-detail',
        airportStyle: 'connected',
        fountain: 'splash-plaza',
        roadStyle: 'civic',
        tallCity: true,
        digitalCity: true,
        overheadPower: false,
        incident: 'storm-cleanup',
        cityDescription:
          'Glass façades, connected services and computer displays welcome the internet age.',
      },
      label: 'Connected City',
      yearLabel: '2005',
      enabled: true,
      story:
        'Computers, internet cafés and a technology campus connect a modern skyline to the world. The old town remains at its heart.',
      horizon: 'Prospect Hollow is going online.',
      finale: 'From the first well to the river promenade. This is our Prospect Hollow.',
    },
    {
      id: 'tomorrow',
      evolution: {
        waterworks: [161, 169, 177],
        farmCapacity: [126, 129, 132],
        style: 'city',
        wildlife: 'songbirds',
        // Rounded forms are procedural; the Connected City family still supplies
        // shared vehicles, bridge approaches, garden finishes and fallbacks.
        architecture: 'rounded',
        transportStyle: 'rounded',
        prices: [9000, 10600, 12200],
        cityAssets: 'contemporary',
        wardrobe: 'tomorrow',
        newBuildingPrices: [10000, 12500, 15000],
        detailAsset: 'digital-detail',
        airportStyle: 'connected',
        fountain: 'orbital-rings',
        roadStyle: 'glow-lane',
        tallCity: true,
        digitalCity: true,
        overheadPower: false,
        incident: 'storm-cleanup',
        upgradeTitle: 'Tomorrow level {level}: {name}',
        upgradeDescriptions: [
          'Add a glazed capsule wing and a curved garden canopy.',
          'Complete the dome with its ring terrace and soft evening lights.',
        ],
        cityDescription:
          'Rounded domes, glass capsules and garden rings reshape the familiar street.',
      },
      label: 'Tomorrow City',
      yearLabel: '2065',
      enabled: true,
      story:
        'Solar domes, quiet maglev pods and garden rings grow around the old streets. Prospect Hollow imagines its next century.',
      horizon: 'Tomorrow is taking shape in Prospect Hollow.',
      finale: 'Round roofs, green rings and the same warm neighbors. Tomorrow feels like home.',
    },

    {
      id: 'canopy',
      evolution: {
        waterworks: [179, 181, 183],
        farmCapacity: [134, 136, 138],
        ...COZY_CITY_EVOLUTION,
        cozyStyle: 'canopy',
        prices: [10400, 12200, 14000],
        wardrobe: 'canopy',
        newBuildingPrices: [11500, 14000, 16500],
        fountain: 'canopy-bloom',
        roadStyle: 'garden-lane',
        upgradeTitle: 'Canopy level {level}: {name}',
        upgradeDescriptions: [
          'Grow a sheltered garden wing with curved timber supports and planted balconies.',
          'Complete the leaf roofs, flowering terraces and shared neighborhood porch.',
        ],
        cityDescription:
          'Leaf roofs, garden verandas and warm timber bring the biodome gardens into everyday life.',
      },
      label: 'Canopy Age',
      yearLabel: '2100',
      enabled: true,
      story:
        'The gardens once sheltered under glass now grow through every neighborhood. Tea, blossoms and orchard homes make tomorrow feel peaceful.',
      horizon: 'A garden is growing around every familiar doorway.',
      finale: 'Leaf roofs, flowering courtyards and time together. Our future is taking root.',
    },
    {
      id: 'riverlight',
      evolution: {
        waterworks: [185, 187, 189],
        farmCapacity: [144, 150, 156],
        ...COZY_CITY_EVOLUTION,
        cozyStyle: 'riverlight',
        wildlife: 'garden-town',
        prices: [12000, 14000, 16000],
        wardrobe: 'riverlight',
        newBuildingPrices: [13500, 16000, 18500],
        fountain: 'riverlight-crystal',
        roadStyle: 'lantern-lane',
        upgradeTitle: 'Riverlight level {level}: {name}',
        upgradeDescriptions: [
          'Add a scalloped glass sunroom and a sheltered gathering terrace.',
          'Complete the pearl roofs, lavender glass and soft lantern courtyards.',
        ],
        cityDescription:
          'Pearl roofs, lavender glass and amber lanterns bring the mine crystals into welcoming homes.',
      },
      label: 'Riverlight Age',
      yearLabel: '2140',
      enabled: true,
      story:
        'Our craftspeople turn familiar crystals into glass that gathers daylight. Warm springs, quiet workshops and a luminous pavilion welcome every neighbor.',
      horizon: 'The valley is finding its gentle evening glow.',
      finale: 'The crystals beneath our home now light the places we share.',
    },
  ].map(defineEra),
);
export const ERA_BY_ID = Object.fromEntries(ERAS.map((era) => [era.id, era]));
export const FRONTIER_ERA = ERAS[0].id;
export const eraEvolution = (era) =>
  (Object.hasOwn(ERA_BY_ID, era) ? ERA_BY_ID[era] : ERAS[0]).evolution;
export const FORGE_PRODUCTION_RUNS = [6, 5, 4, 3, 2];
export const forgeProductionRuns = (level) => FORGE_PRODUCTION_RUNS[level - 1] ?? 6;
export const createEraState = (plotIds) => ({
  era: FRONTIER_ERA,
  buildingEras: Object.fromEntries(plotIds.map((id) => [id, FRONTIER_ERA])),
  buildingEraLevels: Object.fromEntries(plotIds.map((id) => [id, 0])),
  firstLightsSeen: false,
  forge: { progress: 0, charge: 0 },
});
