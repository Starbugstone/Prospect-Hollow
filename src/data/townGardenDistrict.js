// Reserved large parcels are deliberately larger than the old-town lots: the
// eastern garden district, the Skyward quarter beyond the railway (reached by the
// same garden lane) and the space elevator site beside the mine. Position,
// frontage and extents are one contract for art, roads and landscaping.
function skyward(x, z, halfWidth = 6) {
  return {
    position: [x, z],
    halfWidth,
    halfDepth: 6,
    streetOffset: 8.5,
    entranceZ: 5,
    approach: [[0, 4.5]],
  };
}
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
  // The homecoming hall shares the atelier's street row in the garden district.
  homecomingHall: {
    position: [79, 8],
    halfWidth: 5,
    halfDepth: 5,
    streetOffset: 8.5,
    entranceZ: 5,
    approach: [[0, 4.5]],
  },
  // Skyward quarter: the garden lane crosses the railway to two rows of lots.
  moonpost: skyward(48, -40, 5.5),
  skyHarbour: skyward(63, -40),
  cloudOrchard: skyward(79.5, -40, 5.5),
  windsongLofts: skyward(93, -40, 5.5),
  missionHomesteads: skyward(48, -60, 5.5),
  greatTelescope: skyward(63, -60),
  dewlightGardens: skyward(79.5, -60, 5.5),
  starlightTerraces: skyward(93, -60, 5.5),
  // The elevator stands west of the mine hill. Its own road leaves the radio
  // street between the radio tower and the park and crosses the railway; x = -28.2
  // keeps both buildings' setbacks exactly where they were in earlier eras.
  spaceElevator: {
    position: [-32, -38],
    halfWidth: 7.5,
    halfDepth: 7.5,
    streetOffset: 11.5,
    entranceZ: 8,
    approach: [[0, 7.5]],
    access: [
      [-28.2, -8.5],
      [-28.2, -26.5],
    ],
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
        // A parcel off the garden lane names the road points that lead from an
        // existing street to its own frontage street.
        ...(parcel.access
          ? { access: Object.freeze(parcel.access.map((point) => Object.freeze(point))) }
          : {}),
      }),
    ]),
  ),
);
export const GARDEN_LANE_X = 72;
export const GARDEN_CLEARING = Object.freeze({ minX: 70, maxX: 104, minZ: -18, maxZ: 61 });
// Level foundations for the parcels outside the garden clearing.
export const PARCEL_CLEARINGS = Object.freeze([
  GARDEN_CLEARING,
  Object.freeze({ minX: 41, maxX: 104, minZ: -68, maxZ: -29 }),
  Object.freeze({ minX: -41, maxX: -23, minZ: -47, maxZ: -27 }),
]);
// Lane parcels join the garden spine; access parcels have their own road.
export const isLaneParcel = (id) => !!GARDEN_PARCELS[id] && !GARDEN_PARCELS[id].access;
