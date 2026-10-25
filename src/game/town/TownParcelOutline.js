import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry, Shape, ShapeGeometry } from 'three';

// The selection outline every map draws around its chosen parcel, in the parcel's
// own shape: a frame for a valley plot (`rect`), a ring for a round monument site
// (`circle`) and a polygon for a Moon pad (`sides`, a corner on local +z). The
// geometry lies flat around the parcel's centre; callers place and turn it.
// One warm amber for every map's selection outline: it reads on the valley's pale
// ground and on grey regolith alike.
export const PARCEL_OUTLINE_COLOR = '#e09a2c';
// The valley's frame: clear of the parcel and wide enough to read on pale ground.
export const PARCEL_OUTLINE = Object.freeze({ gap: 0.12, width: 0.14 });
export function parcelOutlineGeometry(parcel, { gap, width } = PARCEL_OUTLINE) {
  if (parcel.shape === 'rect') {
    const frame = (grow) => {
      const left = parcel.minX - parcel.x - grow,
        right = parcel.maxX - parcel.x + grow,
        near = parcel.z - parcel.minZ + grow,
        far = parcel.z - parcel.maxZ - grow;
      return [
        [left, near],
        [right, near],
        [right, far],
        [left, far],
      ];
    };
    const outer = new Shape(frame(gap + width).map(([x, y]) => ({ x, y })));
    outer.holes.push(
      new Shape(
        frame(gap)
          .map(([x, y]) => ({ x, y }))
          .reverse(),
      ),
    );
    return new ShapeGeometry(outer).rotateX(-Math.PI / 2);
  }
  const radius = parcel.radius + gap;
  // A polygon starts on a corner at local +z, as CylinderGeometry does.
  return new RingGeometry(
    radius,
    radius + width,
    parcel.sides ?? 64,
    1,
    parcel.sides ? -Math.PI / 2 : 0,
  ).rotateX(-Math.PI / 2);
}

/** The selection outline mesh every map draws, with one material: callers place it. */
export function parcelOutlineMesh(parcel, outline = PARCEL_OUTLINE) {
  const mesh = new Mesh(
    parcelOutlineGeometry(parcel, outline),
    new MeshBasicMaterial({
      color: PARCEL_OUTLINE_COLOR,
      side: DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  mesh.name = 'Selected parcel outline';
  return mesh;
}
