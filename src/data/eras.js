// Content gates are independent of functional building levels and the alpha level count.
// Reserved eras never create buttons or empty lots.
export const ERAS = [
  { id: 'frontier', label: 'Frontier Settlement', yearLabel: 'c. 1865–1880', enabled: true },
  {
    id: 'river-rail',
    label: 'River & Rail Boom',
    yearLabel: '1884',
    enabled: true,
    story:
      'The river trade is growing, rails are approaching, and Prospect Hollow is becoming a proper town.',
  },
  {
    id: 'industrial',
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
    label: 'Connected City',
    yearLabel: '2005',
    enabled: true,
    story:
      'Computers, internet cafés and a technology campus connect a modern skyline to the world. The old town remains at its heart.',
    horizon: 'Prospect Hollow is going online.',
    finale: 'From the first well to the river promenade. This is our Prospect Hollow.',
  },
];
export const ERA_BY_ID = Object.fromEntries(ERAS.map((era) => [era.id, era]));
export const FRONTIER_ERA = ERAS[0].id;
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
