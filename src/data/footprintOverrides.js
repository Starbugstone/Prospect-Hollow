// Open infrastructure is validated against its own deck/landing route, not the
// residential facade setback. No blanket height threshold invents a doorway.
export const FOOTPRINT_EXCEPTIONS = Object.freeze({
  bridge: ['bridge-deck'],
  fisherman: ['dock'],
  riverPort: ['river-port'],
  square: ['plaza'],
});
export const FOOTPRINT_ANCHORS = Object.freeze({
  home: {
    door: [
      [0, 2.1],
      [0, 2.6],
    ],
    service: [[-2.4, 2.1]],
  },
  saloon: {
    door: [
      [0, 2.1],
      [0, 2.6],
    ],
    service: [[2.6, 2.4]],
  },
  museum: {
    door: [
      [0, 2.1],
      [0, 2.6],
    ],
  },
  hotel: {
    door: [
      [0, 2.1],
      [0, 2.6],
    ],
  },
  transitHub: {
    door: [
      [0, 2.1],
      [0, 2.6],
    ],
  },
  square: {
    door: [
      [2.7, 2.6],
      [0, 2.6],
    ],
  },
  airport: {
    door: [
      [4.5, 2.9],
      [8, 0],
    ],
    service: [[6, 3.4]],
  },
  stable: {
    door: [
      [0, 2.05],
      [0, 2.6],
      [2.6, 2.4],
    ],
    service: [[2.8, 0]],
  },
  farm: {
    door: [
      [0, 2.05],
      [0, 2.6],
      [2.6, 2.4],
    ],
    service: [[-2.4, 2.1]],
  },
});
