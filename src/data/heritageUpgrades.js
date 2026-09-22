// Purpose, rather than a universal rooftop ornament, determines the final
// expansion. Both the 3D town and its SVG fallback use this contract.
export const HERITAGE_UPGRADES = {
  home: 'veranda',
  rowHouses: 'veranda',
  saloon: 'veranda',
  hotel: 'veranda',
  farm: 'hayloft',
  stable: 'carriage',
  sheriff: 'office',
  bank: 'portico',
  shop: 'awning',
  market: 'awning',
  museum: 'gallery',
  armory: 'freight',
  warehouse: 'freight',
  blacksmith: 'workshop',
  mill: 'workshop',
  powerHouse: 'generator',
  fireStation: 'engineBay',
  school: 'classroom',
  doctor: 'clinic',
  railDepot: 'platform',
  post: 'dispatch',
};

export function heritageUpgrade(kind) {
  return HERITAGE_UPGRADES[kind] ?? null;
}
