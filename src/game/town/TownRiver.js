import * as THREE from 'three';
import { MILLRACE, millraceWaterEdge } from './TownMillrace';

export const RIVER = Object.freeze({ halfWidth: 3.2, bankWidth: 4.6, waterHeight: -0.45 });
export const riverCenterX = (z) => 30.5 + Math.sin(z * 0.055) + Math.sin(z * 0.14) * 0.45;
export const bridgeDeckHeight = (x, z = 7.5) => {
  const p = Math.max(0, Math.min(1, (7 - Math.abs(x - riverCenterX(z))) / 3.2));
  return 0.18 + 2.5 * p * p * (3 - 2 * p);
};
export const riverDistance = (x, z) => Math.abs(x - riverCenterX(z));
export const wetBank = (x, z, margin = 0) => riverDistance(x, z) < RIVER.bankWidth + margin;
export const riverPath = (from = -130, to = 130, step = 1) =>
  Array.from({ length: Math.ceil((to - from) / step) + 1 }, (_, i) => {
    const z = Math.min(to, from + i * step);
    return [riverCenterX(z), z];
  });
export function riverOutline(project, width = RIVER.halfWidth, from = -25, to = 32) {
  const path = riverPath(from, to);
  return `M${[
    ...path.map(([x, z]) => project([x - width, z])),
    ...path.toReversed().map(([x, z]) => project([x + width, z])),
  ]
    .map((p) => p.join(' '))
    .join(' L')} Z`;
}

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
    uniforms: { time: { value: 0 } },
    vertexShader:
      'varying vec2 riverUv; void main() { riverUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; varying vec2 riverUv;
      void main() {
        float across = clamp(riverUv.x, 0., 1.);
        float ripple = smoothstep(.94, 1., sin(riverUv.y * 3. + sin(across * 20.) - time * .45));
        vec3 color = mix(vec3(.17, .38, .39), vec3(.30, .53, .50), sin(across * 3.14159));
        gl_FragColor = vec4(color + ripple * .035, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.userData.transient = true;
  const water = new THREE.Mesh(geometry, material);
  water.name = 'Prospect river';
  water.layers.set(2);
  parent.add(water);
  town.waterMaterial = material;
}
