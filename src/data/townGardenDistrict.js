// Reserved eastern garden parcels are deliberately larger than the old-town lots.
// Position, frontage and extents are one contract for art, roads and landscaping.
const parcels = {
  teaHouse: {
    position: [79, -12],
    halfWidth: 4.5,
    halfDepth: 4,
    streetOffset: 7.5,
    entranceZ: 4.5,
    approach: [[0, 3.5]],
  },
  blossomAtelier: {
    position: [94, 8],
    halfWidth: 7,
    halfDepth: 6,
    streetOffset: 8.5,
    entranceZ: 4.6,
    approach: [[0, 4.1]],
  },
  orchardCottages: {
    position: [79, 28],
    halfWidth: 5.4,
    halfDepth: 5,
    streetOffset: 8.5,
    entranceZ: 4,
    approach: [
      [-2.625, 2.1],
      [-2.625, 4],
    ],
  },
  glassworks: {
    position: [94, -12],
    halfWidth: 6,
    halfDepth: 5,
    streetOffset: 7.5,
    entranceZ: 4.1,
    approach: [[0, 3.8]],
  },
  springsRetreat: {
    position: [94, 28],
    halfWidth: 7.5,
    halfDepth: 6,
    streetOffset: 8.5,
    entranceZ: 5.3,
    approach: [
      [4.9, 1],
      [4.9, 5.3],
    ],
  },
  riverlightPavilion: {
    position: [86, 49],
    halfWidth: 8,
    halfDepth: 7,
    streetOffset: 9.5,
    entranceZ: 6.1,
    approach: [[0, 5.25]],
  },
};
export const GARDEN_PARCELS = Object.freeze(
  Object.fromEntries(
    Object.entries(parcels).map(([id, parcel]) => [
      id,
      Object.freeze({
        ...parcel,
        position: Object.freeze(parcel.position),
        // The forecourt and its pedestrian approach share these plot-local
        // points, including bends around permanent trees and spring pools.
        approach: Object.freeze(parcel.approach.map((point) => Object.freeze(point))),
      }),
    ]),
  ),
);
export const GARDEN_LANE_X = 72;
export const GARDEN_CLEARING = Object.freeze({ minX: 70, maxX: 104, minZ: -18, maxZ: 61 });
