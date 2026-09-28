import { addAviationActivity } from './TownAviation';
import { addRiverBoat, addStationTrain, trackTransport } from './TownEraActivity';

// Vehicles owned by a plot. Their look follows that building's own era, so finishing a
// modernization (an incremental plot swap, not a full rebuild) must restyle them.
const TRANSPORTS = {
  airport: addAviationActivity,
  riverPort: addRiverBoat,
  railDepot: addStationTrain,
};

/** Rebuild one plot's vehicle when its building era changed. Other vehicles, their
 * motions and the static batches are untouched. Returns true when it rebuilt. */
export function refreshTransport(d, id, town) {
  const build = TRANSPORTS[id];
  if (!build) return false;
  const current = d.transports?.get(id);
  if (current && current.era === town.buildingEras?.[id]) return false;
  if (!current && !town.buildings?.[id]) return false;
  if (current) {
    d.motions = d.motions.filter((motion) => motion !== current.motion);
    d.visitorTransports?.delete(id);
    d.clearGroup(current.root);
    d.transports.delete(id);
  }
  trackTransport(d, id, town, build(d, town));
  return true;
}
