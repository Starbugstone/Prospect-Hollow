import { MathUtils } from 'three';

export const clamp01 = (value) => MathUtils.clamp(value, 0, 1);
export const lerp = MathUtils.lerp;
// A number naming one grid cell, so spatial lookups never build key strings.
export const cellKey = (x, z) => (x + 32768) * 65536 + (z + 32768);
// Eases 0→1 with zero slope at both ends; input outside [0, 1] is clamped.
export const smooth01 = (value) => MathUtils.smoothstep(value, 0, 1);
// The same curve across [edge0, edge1], for terrain blends measured in world units.
export const smoothBetween = (edge0, edge1, value) => MathUtils.smoothstep(value, edge0, edge1);
// A value eased 0→1 as `value` runs from `from` over `length` (seconds of a cycle, say).
export const ramp = (value, from, length) => smooth01((value - from) / length);
// The remainder of n / m in [0, m), negative n included.
export const mod = (n, m) => ((n % m) + m) % m;
// Deterministic value in [0, 1) for scenery and animal variety; never gameplay randomness.
export const hash01 = (n) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
