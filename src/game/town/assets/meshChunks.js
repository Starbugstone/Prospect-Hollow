// Binary mesh chunks written by scripts/split-mesh-catalogs.mjs. Geometry is stored
// as little-endian Float32 positions and normals (exactly what the GPU receives) and
// Uint16/Uint32 indices, behind a small JSON header with names, joints and colors.
// Decoding is a few typed-array views instead of parsing millions of JSON numbers.
const MESH_CHUNK_MAGIC = 'PHM1';

export function encodeMeshChunk({ models, footprints }) {
  const arrays = [];
  let offset = 0;
  const add = (values, Type) => {
    const array = Type.from(values);
    arrays.push(array);
    const entry = [offset, array.length];
    offset += Math.ceil(array.byteLength / 4) * 4;
    return entry;
  };
  const header = { models: {}, ...(footprints ? { footprints } : {}) };
  for (const [name, parts] of Object.entries(models))
    header.models[name] = parts.map(({ positions, normals, indices, ...part }) => {
      const wide = indices.some((index) => index > 0xffff);
      return {
        ...part,
        positions: add(positions, Float32Array),
        normals: add(normals, Float32Array),
        indices: [...add(indices, wide ? Uint32Array : Uint16Array), wide ? 32 : 16],
      };
    });
  const json = new TextEncoder().encode(JSON.stringify(header));
  const start = Math.ceil((8 + json.length) / 4) * 4;
  const bytes = new Uint8Array(start + offset);
  bytes.set(new TextEncoder().encode(MESH_CHUNK_MAGIC), 0);
  new DataView(bytes.buffer).setUint32(4, json.length, true);
  bytes.set(json, 8);
  let at = start;
  for (const array of arrays) {
    bytes.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), at);
    at += Math.ceil(array.byteLength / 4) * 4;
  }
  return bytes;
}

export function decodeMeshChunk(buffer) {
  const bytes = new Uint8Array(buffer);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== MESH_CHUNK_MAGIC)
    throw new Error('Not a mesh chunk.');
  const length = new DataView(buffer).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + length)));
  const start = Math.ceil((8 + length) / 4) * 4;
  const view = (Type, [offset, count]) => new Type(buffer, start + offset, count);
  const models = {};
  for (const [name, parts] of Object.entries(header.models))
    models[name] = parts.map((part) => ({
      ...part,
      positions: view(Float32Array, part.positions),
      normals: view(Float32Array, part.normals),
      indices: view(part.indices[2] === 32 ? Uint32Array : Uint16Array, part.indices),
    }));
  return { models, ...(header.footprints ? { footprints: header.footprints } : {}) };
}

async function readBytes(url) {
  if (url.protocol === 'file:') {
    // Node (tests, footprint generation) reads the file; browsers fetch the asset.
    const fs = 'node:fs/promises';
    const data = await (await import(/* @vite-ignore */ fs)).readFile(url);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mesh chunk unavailable: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
const gzipped = (bytes) => bytes[0] === 0x1f && bytes[1] === 0x8b;
async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Chunks ship gzip-packed (`.binz`), so downloads stay small on any host, whether
// or not it compresses binary files. A host that already decoded the gzip is
// detected by the missing gzip header; browsers without DecompressionStream fetch
// the uncompressed copy instead.
/** @public Called by the generated src/assets/meshes/loaders.js. */
export async function loadMeshChunk(packed, plain) {
  let bytes;
  if (typeof DecompressionStream === 'function') {
    bytes = await readBytes(packed);
    if (gzipped(bytes)) bytes = await inflate(bytes);
  } else bytes = await readBytes(plain);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { default: decodeMeshChunk(buffer) };
}
