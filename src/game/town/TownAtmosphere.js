import { Color, Fog, MeshStandardMaterial } from 'three';

// Keep every current plot clear, then dissolve the prairie before its 130-unit
// boundary. World-space fog stays consistent when the mobile overview zooms out.
const TOWN_HORIZON = Object.freeze({ color: '#e9e8da', near: 72, far: 124 });
export function setTownAtmosphere(scene) {
  scene.background = new Color(TOWN_HORIZON.color);
  scene.fog = new Fog(TOWN_HORIZON.color, TOWN_HORIZON.near, TOWN_HORIZON.far);
}

const prepared = new WeakSet();
export function horizonMaterial(material) {
  if (prepared.has(material)) return material;
  prepared.add(material);
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <fog_vertex>',
      `#ifdef USE_FOG
        vec4 horizonPosition = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          horizonPosition = batchingMatrix * horizonPosition;
        #endif
        #ifdef USE_INSTANCING
          horizonPosition = instanceMatrix * horizonPosition;
        #endif
        horizonPosition = modelMatrix * horizonPosition;
        vFogDepth = max(abs(horizonPosition.x), abs(horizonPosition.z));
      #endif`,
    );
  };
  material.customProgramCacheKey = () => `${key}|town-horizon-v1`;
  material.needsUpdate = true;
  return material;
}
// A matte terrain material owned by its mesh: it fades into the horizon, and
// clearing the mesh's group disposes it.
export function terrainMaterial(params) {
  const material = horizonMaterial(new MeshStandardMaterial({ roughness: 1, ...params }));
  material.userData.transient = true;
  return material;
}
// A see-through smoke puff that fades on its own; its group disposes the material.
export function smokePuff(d, parent, x, y, z, size, color) {
  const puff = d.ball(parent, x, y, z, size, color);
  puff.material = puff.material.clone();
  puff.material.transparent = true;
  puff.material.depthWrite = false;
  puff.material.userData.transient = true;
  return puff;
}
