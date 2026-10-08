// Lazily loaded town data ships as plain asset files rather than JavaScript chunks.
// Node (tests, footprint generation) reads the file; browsers fetch the asset.
export async function readAsset(url) {
  if (url.protocol === 'file:') {
    const fs = 'node:fs/promises';
    const data = await (await import(/* @vite-ignore */ fs)).readFile(url);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Asset unavailable: ${response.status} ${url.pathname}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** @public Called by the generated src/data/generated/footprintLoaders.js. */
export const readJsonAsset = async (url) =>
  JSON.parse(new TextDecoder().decode(await readAsset(url)));
