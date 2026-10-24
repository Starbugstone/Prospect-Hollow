import { Box3 } from 'three';
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
export const VALLEY_WELL_LOT = Object.freeze({ halfWidth: 1.05, halfDepth: 1.05 });
// The paved middle of a monument site that answers a tap on the ground.
export const SITE_TAP_SHARE = 0.75;

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

const drawn = new Box3();
/** A drawn plot: its lot joined with the model's ground bounds and height. */
export function valleyParcel(id, group) {
  const lot = valleyLot(id);
  if (!group) return lot;
  drawn.setFromObject(group);
  if (drawn.isEmpty()) return lot;
  return {
    ...lot,
    minX: Math.min(lot.minX, drawn.min.x),
    maxX: Math.max(lot.maxX, drawn.max.x),
    minZ: Math.min(lot.minZ, drawn.min.z),
    maxZ: Math.max(lot.maxZ, drawn.max.z),
    bottom: drawn.min.y,
    top: drawn.max.y,
  };
}

/** A monument site's ground circle. */
export function valleySite(area) {
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

/** The parcel's glow volume: its ground rectangle up to its roof. */
export const parcelBounds = (parcel, box = new Box3()) => {
  box.min.set(parcel.minX, parcel.bottom ?? 0, parcel.minZ);
  box.max.set(parcel.maxX, Math.max(parcel.top, (parcel.bottom ?? 0) + 0.6), parcel.maxZ);
  return box;
};

export const parcelContains = (parcel, x, z) =>
  parcel.shape === 'rect'
    ? x >= parcel.minX && x <= parcel.maxX && z >= parcel.minZ && z <= parcel.maxZ
    : Math.hypot(x - parcel.x, z - parcel.z) <= parcel.radius;
