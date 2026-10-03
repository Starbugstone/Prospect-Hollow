// Three familiar companions keep their neighborhood identity as their lifestyle
// evolves. Garden coordinates are local to a built plot; street visits use the
// shared pedestrian graph. The first available garden supports partial towns.
export const COMPANION_NEIGHBORHOODS = [
  {
    id: 'old-town',
    seed: 374,
    gardens: [
      {
        building: 'park',
        points: [
          [-1.4, -4.2],
          [0, -5],
          [1.4, -4.2],
          [0, -5],
          [-1.4, -4.2],
        ],
      },
    ],
    streets: ['park', 'school', 'home2', 'blacksmith', 'home4', 'square'],
  },
  {
    id: 'river-garden',
    seed: 405,
    gardens: [
      {
        building: 'riverPark',
        points: [
          [-6.5, -1],
          [-6.2, 0.2],
          [-6.5, 1.5],
          [-6.8, 0.2],
          [-6.5, -1],
        ],
      },
    ],
    streets: ['riverPark', 'cityHomes', 'skyPods', 'waterPlant', 'apartments', 'maglevStation'],
  },
  {
    id: 'blossom-garden',
    seed: 436,
    gardens: [
      {
        building: 'blossomAtelier',
        points: [
          [8, -2],
          [8.7, -1],
          [8, 1.2],
          [8.7, 0.3],
          [8, -2],
        ],
      },
      {
        building: 'biodome',
        points: [
          [4.2, -1.3],
          [4.7, -0.3],
          [4.2, 1],
          [3.7, -0.3],
          [4.2, -1.3],
        ],
      },
    ],
    streets: [
      'teaHouse',
      'blossomAtelier',
      'orchardCottages',
      'riverlightPavilion',
      'springsRetreat',
    ],
  },
];

export const COMPANION_STREET_FALLBACK = ['home', 'farm', 'shop', 'saloon', 'park'];
