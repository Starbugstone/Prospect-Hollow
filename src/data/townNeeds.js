// What each building gives the town: water, food, homes, visitor places and comfort.
// This one definition drives the village, its upgrade previews and the server's save
// checks (exported to backend/content/save-rules.json), so balance changes happen here.
//
// A source counts the built level of one building (`id`) or of every building of a
// `kind`. `service` reads the supporting buildings' service level instead, where
// stage three keeps the old level-five capacity. The counted level is shifted by
// `offset` and capped by `max`, then multiplied by `per`; `table` lists the value at
// each built level instead. City buildings add their per-level `effects` the same way.
// `eraTiers` adds the main waterworks or farm capacity of its modernized era tier.
export const NEED_SOURCES = [
  { stat: 'water', kind: 'well', per: 6, service: true },
  { stat: 'water', id: 'well', eraTiers: 'waterworks' },
  { stat: 'food', kind: 'farm', per: 4, service: true },
  { stat: 'food', id: 'farm', eraTiers: 'farmCapacity' },
  { stat: 'food', id: 'fisherman', per: 1, service: true, max: 5 },
  { stat: 'food', id: 'market', per: 10 },
  { stat: 'housing', kind: 'home', per: 2, service: true },
  { stat: 'housing', id: 'home5', per: 8 },
  { stat: 'housing', id: 'rowHouses', table: [0, 6, 12, 16] },
  { stat: 'housing', id: 'gardenCourt', per: 6 },
  { stat: 'visitors', id: 'stable', per: 2, service: true },
  { stat: 'visitors', id: 'museum', per: 2, service: true, offset: -1 },
  { stat: 'visitors', id: 'railDepot', per: 2 },
  { stat: 'visitors', id: 'hotel', per: 2 },
  { stat: 'visitors', id: 'busDepot', per: 2 },
  { stat: 'comfort', id: 'square', per: 8, service: true },
  { stat: 'comfort', id: 'museum', per: 2, service: true },
  { stat: 'comfort', id: 'saloon', per: 2, service: true },
  { stat: 'comfort', id: 'school', per: 1, service: true, max: 5 },
  { stat: 'comfort', id: 'horseField', per: 2 },
  { stat: 'comfort', id: 'park', per: 3 },
];

// Happiness is how well water and food cover everyone the town can hold, times how
// much comfort it offers for its size. Short supplies cut happiness directly.
// `comfortPerPerson` comfort points per resident or visitor place give full comfort.
// Visitors only come to a happy town: none at `visitorsFrom`, all from `visitorsFull`.
export const HAPPINESS = {
  needs: 40,
  comfort: 60,
  comfortPerPerson: 0.6,
  visitorsFrom: 30,
  visitorsFull: 90,
};

// An era without its own waterworks or farm tiers keeps improving on the last era
// that has them, by this much per modernization tier.
export const ERA_SUPPLY_STEP = 10;
