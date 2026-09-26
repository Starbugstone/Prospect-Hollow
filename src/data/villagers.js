import names from './villagerNames';

export function villagerIdentity(seed = 0, gender) {
  const index = Math.abs(Math.trunc(seed));
  return {
    gender: gender === 'male' || gender === 'female' ? gender : index % 2 ? 'female' : 'male',
    name: null,
  };
}
export const villagerRandom = (seed) => {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
};
// A visit gets a stable draw, so rebuilding the town or hovering does not reroll
// the guest. Pick from one combined pool first, then use that entry's gender.
export function vipVisitor(seed, visit = 0, pools = names) {
  const entries = ['male', 'female'].flatMap((gender) =>
    (Array.isArray(pools?.[gender]) ? pools[gender] : [])
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name) => ({ name: name.trim(), gender })),
  );
  if (!entries.length) return null;
  const key = Math.trunc(seed) * 65537 + Math.trunc(visit) * 31337;
  const chosen = entries[Math.floor(villagerRandom(key) * entries.length)];
  // Most visits remain ordinary, independently of the selected name.
  return villagerRandom(key + 7919) < 0.25 ? chosen : null;
}
