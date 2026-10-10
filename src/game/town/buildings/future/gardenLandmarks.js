// The eastern district keeps its large, recognizable campuses after Riverlight.
// Every successor uses these layouts with its own kit, so an era change cannot
// replace a mature landmark with an ordinary old-town shop or cottage.
export function gardenLandmarkForms(house, tower) {
  function garden(d, g, s, x, z, r = 0.45) {
    const p = s.palette;
    d.mesh(g, 'cylinder', [r, 0.25, r], [x, 0.125, z], p.timber);
    d.ball(g, x, 0.42, z, [r * 0.85, 0.35, r * 0.85], p.green, 'rock');
    d.ball(g, x, 0.7, z, 0.14, p.flower, 'rock');
  }
  function finish(d, g, s, crown, sides, z) {
    if (s.level >= 2) for (const x of sides) garden(d, g, s, x, z);
    if (s.level >= 3)
      s.kit.crown(d, g, s, {
        x: crown.x,
        z: crown.z,
        y: crown.top,
        baseY: crown.eave,
        r: crown.radius,
      });
    return { landmark: true };
  }
  return {
    teahouse(d, g, s) {
      const p = s.palette;
      d.mesh(g, 'cylinder', [2.65, 0.25, 2.2], [0, 0.125, -0.3], p.shell);
      const crown = house(d, g, s, { w: 4.8, dep: 3.6, h: 2.5, z: -0.4 });
      // Outdoor tea tables remain part of the riverside terrace.
      for (const x of [-1.7, 1.7]) {
        d.rod(g, [x, 0.2, 1.75], [x, 0.85, 1.75], 0.07, p.deep);
        d.mesh(g, 'cylinder', [0.4, 0.1, 0.4], [x, 0.85, 1.75], p.timber);
      }
      return finish(d, g, s, crown, [-2.5, 2.5], 1.6);
    },
    atelier(d, g, s) {
      const crown = house(d, g, s, { w: 2.5, dep: 3.4, h: 3, z: -0.7 });
      // Two growing halls survive the modernization from the mature atelier.
      for (const x of [-2.25, 2.25])
        house(d, g, s, { x, z: -0.7, w: 2, dep: 3.4, h: 2.3, accent: true, door: false });
      for (const x of [-2.8, 2.8]) {
        d.mesh(g, 'cylinder', [0.35, 0.7, 0.35], [x, 0.35, 1.45], s.palette.glass);
        garden(d, g, s, x, 2.1, 0.35);
      }
      return finish(d, g, s, crown, [-1.5, 1.5], 1.9);
    },
    orchard(d, g, s) {
      const crown = house(d, g, s, { z: -1.85, w: 2.1, dep: 2.4, h: 3 });
      for (const x of [-2.1, 2.1])
        house(d, g, s, { x, z: -0.3, w: 1.9, dep: 2.6, h: 2.5, accent: true });
      // The shared orchard courtyard and all three homes stay present at tier 1.
      d.rod(g, [0, 0, 1.1], [0, 1.3, 1.1], 0.12, s.palette.timber);
      d.ball(g, 0, 1.7, 1.1, [0.8, 0.7, 0.8], s.palette.green, 'rock');
      return finish(d, g, s, crown, [-0.7, 0.7], 1.7);
    },
    glassworks(d, g, s) {
      const crown = house(d, g, s, { x: -0.8, z: -0.4, w: 3.5, dep: 3.5, h: 2.8 });
      house(d, g, s, { x: 2, z: -0.7, w: 1.9, dep: 2.8, h: 2.2, accent: true, door: false });
      tower(d, g, s, { x: -1.8, z: -1.5, r: 0.4, h: 4.6, door: false });
      for (const x of [-2.2, 2.2]) {
        d.mesh(g, 'cylinder', [0.45, 0.35, 0.45], [x, 0.175, 1.7], s.palette.timber);
        d.ball(g, x, 0.8, 1.7, [0.35, 0.65, 0.35], s.palette.glass, 'rock');
      }
      return finish(d, g, s, crown, [-2.8, 2.8], 0.9);
    },
    springs(d, g, s) {
      const p = s.palette;
      // Preserve the terraced pools and the east-side bathhouse entrance.
      for (const [x, z, r, y] of [
        [-0.45, 0.6, 2, 0.9],
        [-0.35, -1.3, 1.4, 2.05],
        [-0.35, 2.15, 1.25, 0.15],
      ]) {
        d.mesh(g, 'cylinder', [r + 0.14, y + 0.3, r * 0.75 + 0.14], [x, (y + 0.3) / 2, z], p.shell);
        d.mesh(g, 'cylinder', [r, 0.06, r * 0.75], [x, y + 0.32, z], p.glass);
      }
      d.box(g, 0.6, 1.2, 0.13, -0.35, 1.82, -0.13, p.glass);
      const crown = house(d, g, s, { x: 2.25, z: -0.5, w: 1.8, dep: 2.5, h: 3 });
      house(d, g, s, { x: -2.6, z: -1.5, w: 1.3, dep: 1.5, h: 2, door: false, accent: true });
      return finish(d, g, s, crown, [-2.6, 2.5], 1.7);
    },
    pavilion(d, g, s) {
      const p = s.palette;
      d.mesh(g, 'cylinder', [3.25, 0.3, 3.2], [0, 0.15, -0.35], p.shell);
      // A broad public hall with an open colonnade beneath the era's canopy.
      s.kit.block(d, g, s, { w: 3.8, dep: 3.2, h: 2.8, z: -0.7 });
      s.kit.door(d, g, s, 0, 0.92);
      const top = s.kit.roof(d, g, s, { w: 6.2, dep: 6, y: 2.8, z: -0.35 });
      const crown = { x: 0, z: -0.35, top, eave: 2.8, radius: 1.5 };
      for (const x of [-2.8, 2.8])
        for (const z of [-2.5, 1.8]) d.rod(g, [x, 0.3, z], [x, 2.8, z], 0.1, p.deep);
      for (const x of [-2.1, 2.1]) d.box(g, 1.3, 0.18, 0.38, x, 0.48, 1.8, p.timber);
      return finish(d, g, s, crown, [-2.9, 2.9], 1.5);
    },
  };
}
