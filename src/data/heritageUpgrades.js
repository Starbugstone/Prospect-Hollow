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

export const HERITAGE_DESCRIPTIONS = {
  veranda: 'Add a veranda.',
  hayloft: 'Add a hayloft.',
  carriage: 'Add a carriage shelter.',
  office: 'Add patrol offices.',
  portico: 'Add a columned portico.',
  awning: 'Add a trading awning.',
  gallery: 'Add a mineral gallery.',
  freight: 'Add a freight loading shelter.',
  workshop: 'Add a workshop.',
  generator: 'Add a generator hall.',
  engineBay: 'Add an engine bay.',
  classroom: 'Add a classroom wing.',
  clinic: 'Add a clinic wing.',
  platform: 'Add a covered platform.',
  dispatch: 'Add dispatch rooms and telegraph fittings.',
};
export const heritageDescription = (kind) =>
  HERITAGE_DESCRIPTIONS[heritageUpgrade(kind)] ??
  'Complete the landmark with its working extensions.';
