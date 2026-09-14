import { defineEra } from './eraDefinitions';
// Content gates are independent of functional building levels and the alpha level count.
// Reserved eras never create buttons or empty lots.
export const ERAS = [
  {
    id: 'frontier',
    label: 'Frontier Settlement',
    yearLabel: 'c. 1865–1880',
    enabled: true,
    evolution: { style: 'frontier' },
  },
  {
    id: 'river-rail',
    evolution: {
      style: 'river-rail',
      prices: [800, 1200, 1400],
      waterworks: [0, 20, 40],
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
      style: 'industrial',
      waterUpgradeBenefit:
        'Adds water for twenty people when finished. Existing water stays available during work.',
      prices: [1400, 1850, 2300],
      waterworks: [40, 40, 60],
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
      style: 'city',
      prices: [2400, 2900, 3400],
      cityAssets: 'post-war',
      newBuildingPrices: [3000, 4000, 5000],
      waterworks: [60, 60, 60],
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
      style: 'motor-age',
      prices: [3500, 4400, 5300],
      waterworks: [60, 60, 80],
      farmCapacity: [0, 0, 20],
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
      style: 'city',
      prices: [4800, 5600, 6400],
      cityAssets: 'post-war',
      newBuildingPrices: [8000, 10000, 12000],
      detailAsset: 'aviation-detail',
      roadColor: '#818e8c',
      waterworks: [80, 80, 80],
      farmCapacity: [20, 20, 20],
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
      style: 'city',
      prices: [6200, 7000, 7800],
      cityAssets: 'contemporary',
      newBuildingPrices: [8000, 10000, 12000],
      detailAsset: 'broadcast-detail',
      roadColor: '#7d8991',
      waterworks: [80, 80, 80],
      farmCapacity: [20, 20, 20],
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
      style: 'city',
      prices: [7600, 9000, 10400],
      cityAssets: 'contemporary',
      newBuildingPrices: [8000, 10000, 12000],
      detailAsset: 'digital-detail',
      roadColor: '#a5afa5',
      waterworks: [80, 80, 80],
      farmCapacity: [20, 20, 20],
      tallCity: true,
      digitalCity: true,
      motorMine: true,
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
].map(defineEra);
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
  eraTransitionSeen: {},
  firstLightsSeen: false,
  infrastructure: { bridge: 0, rail: 0, riverPort: 0 },
  forge: { progress: 0, charge: 0 },
});
