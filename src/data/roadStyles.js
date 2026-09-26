// Surface treatments are visual only: the street graph and traffic rules stay shared.
export const ROAD_STYLES = Object.freeze(
  Object.fromEntries(
    Object.entries({
      dirt: { color: '#c3a477', pattern: 'ruts', detail: '#b29368' },
      gravel: {
        color: '#b3a18a',
        pattern: 'gravel',
        detail: '#c6b9a1',
        edge: '#938c79',
      },
      brick: {
        color: '#998671',
        pattern: 'brick',
        detail: '#b09b80',
        edge: '#c1b59a',
      },
      concrete: {
        color: '#b0aea0',
        pattern: 'slabs',
        detail: '#92968b',
        edge: '#d1c8b1',
      },
      'early-asphalt': {
        color: '#858b86',
        edge: '#c6beaa',
        line: 'dash',
        paint: '#dfd5af',
      },
      boulevard: {
        color: '#818e8c',
        edge: '#d0c8b6',
        line: 'dash',
        paint: '#ece5cf',
        edgeLine: true,
        crossing: 'zebra',
      },
      'city-asphalt': {
        color: '#747f86',
        edge: '#b4b8b1',
        line: 'double',
        paint: '#ddbd72',
        edgeLine: true,
        crossing: 'zebra',
      },
      civic: {
        color: '#929e98',
        edge: '#d6ceba',
        line: 'dash',
        paint: '#ede8d5',
        crossing: 'pavers',
        crossingColor: '#b8977d',
      },
    }).map(([id, profile]) => [id, Object.freeze({ id, ...profile })]),
  ),
);

export const resolveRoadStyle = (id) => ROAD_STYLES[Object.hasOwn(ROAD_STYLES, id) ? id : 'dirt'];
