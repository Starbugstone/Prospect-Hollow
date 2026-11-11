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
/**
 * A villager's own body, fixed by the seed: age, height, build and hairstyle. Only
 * ordinary residents (`ages`) are drawn as children or elders; workers, visitors and
 * the sheriff are adults of varying height and build.
 */
export const HAIR_STYLES = 4;
export function villagerBody(seed = 0, ages = false) {
  const roll = (salt) => villagerRandom(Math.trunc(seed) * 13 + salt);
  const draw = roll(1201);
  const age = !ages ? 'adult' : draw < 0.18 ? 'child' : draw > 0.8 ? 'elder' : 'adult';
  return {
    age,
    height:
      age === 'child'
        ? 0.64 + roll(1301) * 0.1
        : (age === 'elder' ? 0.9 : 0.94) + roll(1301) * 0.13,
    build: age === 'child' ? 0.92 : 0.9 + roll(1409) * 0.22,
    hairStyle: Math.floor(roll(1511) * HAIR_STYLES),
  };
}
// A visit gets a stable draw, so rebuilding the town or hovering does not reroll
// the guest. Pick from one combined pool first, then use that entry's gender.
const nameEntries = (pools) =>
  ['male', 'female'].flatMap((gender) =>
    (Array.isArray(pools?.[gender]) ? pools[gender] : [])
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name) => ({ name: name.trim(), gender })),
  );
const defaultEntries = nameEntries(names);
export function vipVisitor(seed, visit = 0, pools = names) {
  const entries = pools === names ? defaultEntries : nameEntries(pools);
  if (!entries.length) return null;
  const key = Math.trunc(seed) * 65537 + Math.trunc(visit) * 31337;
  const chosen = entries[Math.floor(villagerRandom(key) * entries.length)];
  // Most visits remain ordinary, independently of the selected name.
  return villagerRandom(key + 7919) < 0.25 ? { ...chosen, vip: true } : null;
}
