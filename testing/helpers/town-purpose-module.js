export function purposeModules(root) {
  const result = [];
  root.traverse((part) => {
    if (part.userData.purposeModule) result.push(part);
  });
  return result;
}

export function moduleParts(module, semantic) {
  const result = [];
  module.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let part = mesh; part && part !== module; part = part.parent)
      if (part.userData.modulePart) {
        if (part.userData.modulePart === semantic) result.push(mesh);
        break;
      }
  });
  return result;
}

/** Stable geometry and placement, independent of wrapper names or traversal order. */
export function meshSignature(meshes, materials = true) {
  return JSON.stringify(
    meshes
      .map((mesh) => [
        mesh.geometry.uuid,
        ...mesh.matrixWorld.elements.map((value) => Number(value.toFixed(5))),
        ...(materials ? [mesh.material.color.getHexString()] : []),
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}

export function structureMeshes(root) {
  const result = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let part = mesh; part; part = part.parent)
      if (['frontage', 'operation'].includes(part.userData.modulePart)) return;
    result.push(mesh);
  });
  return result;
}
