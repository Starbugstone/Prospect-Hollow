// Quiet outdoor places add happiness and visible life, without upkeep.
export const LEISURE_BUILDINGS = [
  {
    id: 'horseField',
    name: 'Willow horse field',
    shortName: 'Horse field',
    purpose: 'A green home for the town horses',
    color: '#9eae79',
    introducedEra: 'industrial',
    unlock: [{ id: 'stable', level: 1 }],
    benefits: [
      'A fenced meadow welcomes one horse. Adds 2 happiness.',
      'A roofed shelter welcomes a second horse. Adds 4 happiness in total.',
      'Shade, seating and a third horse complete the field. Adds 6 happiness in total.',
    ],
  },
  {
    id: 'park',
    name: 'Prospect public park',
    shortName: 'Park',
    purpose: 'A playground and a stroll with a four-legged friend',
    color: '#92a873',
    introducedEra: 'motor-age',
    unlock: [],
    benefits: [
      'Swings, a bench and occasional dog walks. Adds 3 happiness.',
      'A slide and climbing steps expand the playground. Adds 6 happiness in total.',
      'Flowers, shade and a park lamp welcome everyone. Adds 9 happiness in total.',
    ],
  },
].map(({ benefits, ...building }) => ({
  ...building,
  kind: building.id,
  stages: [
    'Empty plot',
    ...(building.introducedEra === 'industrial'
      ? ['Industrial · Level 1', 'Industrial · Level 2', 'Industrial · Level 3']
      : ['Motor Age · Level 1', 'Motor Age · Level 2', 'Motor Age · Level 3']),
  ],
  upgrades: benefits.map((benefit, index) => ({
    cost: [4320, 6000, 7920][index],
    runs: index ? 2 : 1,
    title: index ? 'Expand {building}' : 'Build {building}',
    benefit,
    story: benefit,
    speaker: 'Ada · the caretaker',
  })),
}));
