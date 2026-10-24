import { Box3, Vector3 } from 'three';
import { GARDEN_PARCELS } from '../../data/townGardenDistrict';
import { areasForSettlement } from '../../data/townLandmarks';
import { AIRPORT, PLOTS } from './TownLayout';

// The valley's parcel contract, the counterpart of the Moon's moonParcels(): every
// plot is a rectangle on the ground and every monument site a circle. The upgrade
// glow, the tap fallback and the selection outline all read it, so they always agree.
//
// A plot's lot is its fenced construction lot, the airport field or its garden parcel.
// Once drawn, the plot joins its lot with the model's ground bounds, since buildings
// of later eras can outgrow the frontier lot.
export const VALLEY_LOT = Object.freeze({ halfWidth: 1.525, halfDepth: 1.35 });
const groundPoint = new Vector3();
export const VALLEY_WELL_LOT = Object.freeze({ halfWidth: 1.05, halfDepth: 1.05 });
// The paved middle of a monument site that answers a tap on the ground.
const SITE_TAP_SHARE = 0.75;

function lotExtent(id) {
  if (id === 'airport') return AIRPORT;
  if (GARDEN_PARCELS[id]) return GARDEN_PARCELS[id];
  return id === 'well' ? VALLEY_WELL_LOT : VALLEY_LOT;
}

/** A plot's lot before anything is drawn on it. */
export function valleyLot(id) {
  const [x, z] = PLOTS[id];
  const { halfWidth, halfDepth } = lotExtent(id);
  return {
    id,
    kind: 'plot',
    shape: 'rect',
    x,
    z,
    minX: x - halfWidth,
    maxX: x + halfWidth,
    minZ: z - halfDepth,
    maxZ: z + halfDepth,
    top: 0,
  };
}

// Parts that start higher than this above the plot overhang its ground (an elevator's
// orbital ring, a tower's crown): they do not widen the parcel.
export const PARCEL_BASE_HEIGHT = 2;
const part = new Box3(),
  base = new Box3();
/** A drawn plot: its lot joined with the ground the model stands on, and its height. */
export function valleyParcel(id, group) {
  const lot = valleyLot(id);
  if (!group) return lot;
  group.updateWorldMatrix(true, true);
  const ground = group.getWorldPosition(groundPoint).y + PARCEL_BASE_HEIGHT;
  base.makeEmpty();
  let bottom = Infinity,
    top = -Infinity;
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    part.setFromObject(mesh);
    if (part.isEmpty()) return;
    bottom = Math.min(bottom, part.min.y);
    top = Math.max(top, part.max.y);
    if (part.min.y <= ground) base.union(part);
  });
  if (base.isEmpty()) return lot;
  return {
    ...lot,
    minX: Math.min(lot.minX, base.min.x),
    maxX: Math.max(lot.maxX, base.max.x),
    minZ: Math.min(lot.minZ, base.min.z),
    maxZ: Math.max(lot.maxZ, base.max.z),
    // What stands on the ground: the glow hugs it, not a large garden parcel or field.
    base: { minX: base.min.x, maxX: base.max.x, minZ: base.min.z, maxZ: base.max.z },
    bottom,
    top,
  };
}

/** A monument site's ground circle. */
function valleySite(area) {
  const [x, z] = area.positions[0];
  return {
    id: area.id,
    kind: 'site',
    shape: 'circle',
    x,
    z,
    radius: area.radius * SITE_TAP_SHARE,
  };
}
export const valleySites = () => areasForSettlement().map(valleySite);

/** The glow's volume: around the base of what is built (the lot when empty), to its roof. */
export const parcelBounds = (parcel, box = new Box3()) => {
  const { minX, maxX, minZ, maxZ } = parcel.base ?? parcel;
  box.min.set(minX, parcel.bottom ?? 0, minZ);
  box.max.set(maxX, Math.max(parcel.top, (parcel.bottom ?? 0) + 0.6), maxZ);
  return box;
};

export const parcelContains = (parcel, x, z) =>
  parcel.shape === 'rect'
    ? x >= parcel.minX && x <= parcel.maxX && z >= parcel.minZ && z <= parcel.maxZ
    : Math.hypot(x - parcel.x, z - parcel.z) <= parcel.radius;
