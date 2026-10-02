import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';
import {
  decodeMeshChunk,
  encodeMeshChunk,
  loadMeshChunk,
} from '../src/game/town/assets/meshChunks';
import leisure from '../src/assets/leisure-meshes.json';

const toBuffer = (bytes) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

it('stores catalog geometry exactly as the GPU receives it, with names, joints and colors', () => {
  const models = Object.fromEntries(Object.entries(leisure.models).slice(0, 3));
  const footprints = { field1: [{ joint: 'body', rect: [0, 0, 1, 1], yMin: 0, yMax: 1 }] };
  const decoded = decodeMeshChunk(toBuffer(encodeMeshChunk({ models, footprints })));
  expect(decoded.footprints).toEqual(footprints);
  for (const [name, parts] of Object.entries(models))
    parts.forEach((part, index) => {
      const copy = decoded.models[name][index];
      expect({ ...copy, positions: 0, normals: 0, indices: 0 }).toEqual({
        ...part,
        positions: 0,
        normals: 0,
        indices: 0,
      });
      expect(copy.positions).toEqual(Float32Array.from(part.positions));
      expect(copy.normals).toEqual(Float32Array.from(part.normals));
      expect([...copy.indices]).toEqual(part.indices);
    });
});

it('widens indices only when a part needs more than 65,536 vertices', () => {
  const part = (indices) => ({
    name: 'p',
    joint: 'body',
    pivot: [0, 0, 0],
    color: '#fff',
    positions: [0, 0, 0],
    normals: [0, 1, 0],
    indices,
  });
  const small = decodeMeshChunk(
    toBuffer(encodeMeshChunk({ models: { a: [part([0, 1, 65535])] } })),
  );
  const wide = decodeMeshChunk(toBuffer(encodeMeshChunk({ models: { a: [part([0, 70000, 2])] } })));
  expect(small.models.a[0].indices).toBeInstanceOf(Uint16Array);
  expect(wide.models.a[0].indices).toBeInstanceOf(Uint32Array);
  expect([...wide.models.a[0].indices]).toEqual([0, 70000, 2]);
  expect(() => decodeMeshChunk(new ArrayBuffer(16))).toThrow('Not a mesh chunk.');
});

it('generates binary chunks for the lazy loaders', async () => {
  const loaders = await readFile(
    new URL('../src/assets/meshes/loaders.js', import.meta.url),
    'utf8',
  );
  expect(loaders).toContain(
    "loadMeshChunk(new URL('./leisure-0.binz', import.meta.url), new URL('./leisure-0.bin', import.meta.url))",
  );
  expect(loaders).not.toContain('.json');
});

afterEach(() => vi.unstubAllGlobals());

it('inflates packed chunks, accepts host-decoded ones and falls back without DecompressionStream', async () => {
  const bytes = encodeMeshChunk({
    models: {
      a: [
        {
          name: 'p',
          joint: 'body',
          pivot: [0, 0, 0],
          color: '#fff',
          positions: [1, 2, 3],
          normals: [0, 1, 0],
          indices: [0],
        },
      ],
    },
  });
  const served = new Map([
    ['https://x/packed.binz', gzipSync(bytes)],
    ['https://x/decoded.binz', bytes],
    ['https://x/plain.bin', bytes],
  ]);
  const requests = [];
  vi.stubGlobal('fetch', async (url) => {
    requests.push(String(url));
    return new Response(served.get(String(url)));
  });
  const positions = async (packed) => [
    ...(await loadMeshChunk(new URL(packed), new URL('https://x/plain.bin'))).default.models.a[0]
      .positions,
  ];
  expect(await positions('https://x/packed.binz')).toEqual([1, 2, 3]);
  expect(await positions('https://x/decoded.binz')).toEqual([1, 2, 3]);
  vi.stubGlobal('DecompressionStream', undefined);
  expect(await positions('https://x/packed.binz')).toEqual([1, 2, 3]);
  expect(requests).toEqual([
    'https://x/packed.binz',
    'https://x/decoded.binz',
    'https://x/plain.bin',
  ]);
});
