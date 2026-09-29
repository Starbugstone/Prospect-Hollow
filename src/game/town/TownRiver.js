import { horizonMaterial } from './TownAtmosphere';
import * as THREE from 'three';
import { MILLRACE, millraceWaterEdge } from './TownMillrace';

export const RIVER = Object.freeze({ halfWidth: 3.2, bankWidth: 4.6, waterHeight: -0.45 });
export const riverCenterX = (z) => 30.5 + Math.sin(z * 0.055) + Math.sin(z * 0.14) * 0.45;
const bridgeCenter = riverCenterX(7.5) - 2.2;
// Set the crossing back from the east-bank street. Geometry, road links and
// actor elevation share these limits so the junction stays level and open.
export const BRIDGE = Object.freeze({
  centerX: bridgeCenter,
  z: 7.5,
  halfLength: 7,
  halfWidth: 1.15,
  westJunction: bridgeCenter - 7,
  eastJunction: 38,
});
export const bridgeDeckHeight = (x) => {
  const p = Math.max(0, Math.min(1, (BRIDGE.halfLength - Math.abs(x - BRIDGE.centerX)) / 3.2));
  // The plot is 8 cm above ground; bury the ramp tips into the road surface.
  // Keep the original crest elevation and navigation clearance over the river.
  return -0.1 + 2.78 * p * p * (3 - 2 * p);
};
export const streetHeight = (x, z) => {
  if (Math.abs(x - BRIDGE.centerX) >= BRIDGE.halfLength || Math.abs(z - BRIDGE.z) >= 1.5)
    return 0.07;
  const blend = Math.min(1, (1.5 - Math.abs(z - BRIDGE.z)) * 2);
  return 0.07 + (bridgeDeckHeight(x) + 0.1) * blend * blend * (3 - 2 * blend);
};
export const riverDistance = (x, z) => Math.abs(x - riverCenterX(z));
export const wetBank = (x, z, margin = 0) => riverDistance(x, z) < RIVER.bankWidth + margin;
export const riverPath = (from = -130, to = 130, step = 1) =>
  Array.from({ length: Math.ceil((to - from) / step) + 1 }, (_, i) => {
    const z = Math.min(to, from + i * step);
    return [riverCenterX(z), z];
  });

// One narrow mesh on the moving layer. Terrain and buildings stay in the frame cache.
export function buildRiver(town, parent) {
  const samples = [
    ...new Set([
      ...riverPath().map(([, z]) => z),
      ...riverPath(MILLRACE.minZ - 1, MILLRACE.maxZ + 1, 0.2).map(
        ([, z]) => Math.round(z * 1000) / 1000,
      ),
    ]),
  ].sort((a, b) => a - b);
  const path = samples.map((z) => [riverCenterX(z), z]);
  const positions = [],
    uvs = [],
    indices = [];
  for (const [i, [x, z]] of path.entries()) {
    // Extend the same water surface beneath the excavated bank. Dry terrain
    // hides it around the channel, with no overlapping sheets at either mouth.
    const left = millraceWaterEdge(z, x - RIVER.halfWidth);
    positions.push(left, RIVER.waterHeight, z, x + RIVER.halfWidth, RIVER.waterHeight, z);
    uvs.push((left - x + RIVER.halfWidth) / (RIVER.halfWidth * 2), z, 1, z);
    if (i) {
      const n = i * 2;
      indices.push(n - 2, n, n - 1, n - 1, n, n + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.owned = true;
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `varying vec2 riverUv;
      #include <fog_pars_vertex>
      void main() {
        riverUv = uv;
        vec3 transformed = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; varying vec2 riverUv;
      #include <fog_pars_fragment>
      void main() {
        float across = clamp(riverUv.x, 0., 1.);
        float ripple = smoothstep(.94, 1., sin(riverUv.y * 3. + sin(across * 20.) - time * .45));
        vec3 color = mix(vec3(.17, .38, .39), vec3(.30, .53, .50), sin(across * 3.14159));
        gl_FragColor = vec4(color + ripple * .035, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  horizonMaterial(material);
  material.userData.transient = true;
  const water = new THREE.Mesh(geometry, material);
  water.name = 'Prospect river';
  water.layers.set(2);
  parent.add(water);
  town.waterMaterial = material;
}
