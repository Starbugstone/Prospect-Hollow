import { BufferGeometry, Float32BufferAttribute, Mesh, Shape, ShapeGeometry } from 'three';
import { townTracks } from './TownLayout';
import { roadAppearance } from './TownEvolution';
import { roadDetails, roadDetailCorners, roadHalfWidth } from './RoadDetails';

export function addRoadSurfaces(d, roads, town) {
  const meshes = [];
  const style = roadAppearance(town),
    tracks = townTracks(town);
  roads.userData.roadStyle = style.id;
  for (const [index, track] of tracks.entries()) {
    if (track.crossing) continue; // The bridge owns its raised deck.
    const { from, to } = track;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (!length) continue;
    const steps = style.paved ? 1 : Math.max(2, Math.ceil(length * 2));
    const shape = new Shape();
    for (const side of [-1, 1])
      for (let n = 0; n <= steps; n++) {
        const i = side < 0 ? n : steps - n;
        const half = roadHalfWidth(track, style.paved);
        const edge = side * half * (style.paved ? 1 : 1 + Math.sin(i * 1.7 + index) * 0.11);
        const along = (i / steps - 0.5) * length;
        if (side < 0 && n === 0) shape.moveTo(edge, along);
        else shape.lineTo(edge, along);
      }
    shape.closePath();
    const geometry = new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.userData.owned = true;
    const surface = new Mesh(geometry, d.material(style.color));
    surface.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);
    surface.position.set((from[0] + to[0]) / 2, 0.028 + index * 0.0002, (from[1] + to[1]) / 2);
    surface.receiveShadow = true;
    roads.add(surface);
    meshes.push(surface);
  }
  const batches = new Map();
  for (const { from, to, width, color, kind } of roadDetails(town, tracks)) {
    if (!batches.has(color))
      batches.set(color, { positions: [], normals: [], uvs: [], indices: [] });
    const data = batches.get(color),
      base = data.positions.length / 3;
    const y = kind === 'crossing' ? 0.058 : 0.055;
    for (const [x, z] of roadDetailCorners({ from, to, width })) {
      data.positions.push(x, y, z);
      data.normals.push(0, 1, 0);
    }
    data.uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    data.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  for (const [color, data] of batches) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(data.uvs, 2));
    geometry.setIndex(data.indices);
    geometry.userData.owned = true;
    const mesh = new Mesh(geometry, d.material(color));
    mesh.receiveShadow = true;
    roads.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
