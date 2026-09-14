// These are guides to existing construction, never additional era gates or purchases.
export const TOWN_PROJECTS = [
  ['frontier', 'first-neighbors', 'Make room for the first neighbors', ['well', 'farm', 'home']],
  ['frontier', 'trail-welcome', 'Welcome life along the trail', ['stable', 'shop', 'school']],
  ['river-rail', 'river-trade', 'Welcome the river trade', ['bridge', 'riverPort', 'warehouse']],
  ['river-rail', 'rail-arrival', 'Bring the railway home', ['railDepot', 'post', 'hotel']],
  ['river-rail', 'market-street', 'Open the market street', ['market', 'shop', 'square']],
  [
    'industrial',
    'first-industry',
    'Connect the industrial quarter',
    ['powerHouse', 'mill', 'railDepot'],
  ],
  [
    'industrial',
    'safe-streets',
    'Care for the growing neighborhood',
    ['fireStation', 'doctor', 'rowHouses'],
  ],
  [
    'industrial',
    'workshop-trade',
    'Keep the workshops moving',
    ['blacksmith', 'warehouse', 'market'],
  ],
  ['post-war', 'civic-heart', 'Rebuild the civic heart', ['cityHall', 'school', 'square']],
  [
    'post-war',
    'courtyard-life',
    'Welcome families home',
    ['apartments', 'supermarket', 'waterPlant'],
  ],
  ['post-war', 'river-return', 'Reconnect the riverfront', ['bridge', 'riverPort', 'hotel']],
  ['motor-age', 'open-roads', 'Welcome the open road', ['garage', 'busDepot', 'diner']],
  ['motor-age', 'garden-streets', 'Grow the garden streets', ['gardenCourt', 'park', 'rowHouses']],
  ['motor-age', 'valley-links', 'Connect the valley', ['bridge', 'railDepot', 'post']],
  ['aviation', 'airport-opening', 'Open Prospect Airport', ['airport', 'radioTower']],
  ['aviation', 'traveler-welcome', 'Welcome travelers to town', ['hotel', 'busDepot', 'diner']],
  [
    'aviation',
    'neighborhood-renewal',
    'Renew the familiar neighborhood',
    ['apartments', 'school', 'park'],
  ],
  [
    'broadcast',
    'city-premiere',
    'Put Prospect on the map',
    ['television', 'concertHall', 'skyline'],
  ],
  ['broadcast', 'culture-street', 'Celebrate the cultural quarter', ['museum', 'square', 'park']],
  [
    'broadcast',
    'city-connections',
    'Keep the city connected',
    ['airport', 'radioTower', 'busDepot'],
  ],
  [
    'contemporary',
    'connected-river',
    'Connect the river district',
    ['transitHub', 'crystalLab', 'riverPark'],
  ],
  [
    'contemporary',
    'modern-homes',
    'Build a skyline for everyone',
    ['cityHomes', 'apartments', 'waterPlant'],
  ],
  ['contemporary', 'shared-history', 'Bring our history online', ['library', 'museum', 'cityHall']],
].map(([era, id, title, buildings]) => ({ era, id, title, buildings }));

export const PROJECT_MILESTONES = ['Open the doors', 'Make room to grow', 'Complete the project'];
