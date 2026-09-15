import { POWERS } from './campaign';
import { chestCoinReward } from './economy';

export const BONUS_CAPACITIES = [3, 5, 8, 20];
export const CONTINUOUS_COIN_CAP = 25;
export const HAMMER_CAPACITY = 5;
export const OVERFLOW_COINS = 10;
export const bonusCapacity = (town) =>
  (BONUS_CAPACITIES[Math.min(3, town.buildings.armory)] ?? 3) + (town.buildings.garage ?? 0) * 2;
export const CHEST_DROPS = [
  ...POWERS.map((power) => ({
    ...power,
    kind: 'power',
    quantity: 1,
    weight: power.dropWeight * 0.7,
  })),
  { id: 'coins', label: 'Coins', kind: 'coins', quantity: chestCoinReward(1), weight: 20 },
  {
    id: 'builder-hammer',
    label: 'Builder hammer',
    kind: 'builder-hammer',
    quantity: 1,
    weight: 10,
  },
];
// Resolve from the catalog, never from a saved or client-supplied quantity.
export function chestReward(id, levelId = 1, economyVersion) {
  const drop = CHEST_DROPS.find((entry) => entry.id === id);
  return drop
    ? {
        id: drop.id,
        label: drop.label,
        kind: drop.kind,
        quantity: drop.kind === 'coins' ? chestCoinReward(levelId, economyVersion) : drop.quantity,
      }
    : null;
}
// Shuffle the visual reel without changing the catalog used by weighted awards.
export const availableChestDrops = (state) =>
  CHEST_DROPS.filter((drop) =>
    drop.kind === 'coins'
      ? true
      : drop.kind === 'builder-hammer'
        ? state.builderHammers < HAMMER_CAPACITY
        : state.powers.some(
            (power) => power.id === drop.id && power.quantity < bonusCapacity(state.town),
          ),
  );
export const rewardUse = (item) =>
  item.kind === 'coins' || item.kind === 'builder-hammer' ? 'Village' : 'Mine';

export function shuffleChestDrops(random = Math.random, eligible = CHEST_DROPS) {
  const drops = [...eligible];
  for (let index = drops.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [drops[index], drops[other]] = [drops[other], drops[index]];
  }
  return drops;
}
export function chestRewardFits(state, drop) {
  if (!state || drop.kind === 'coins') return true;
  const reserved = (state.pendingChests ?? []).filter(
    (chest) => chest.items[0]?.id === drop.id,
  ).length;
  return drop.kind === 'builder-hammer'
    ? state.builderHammers + reserved < HAMMER_CAPACITY
    : (state.powers.find((power) => power.id === drop.id)?.quantity ?? 0) + reserved <
        bonusCapacity(state.town);
}
export function rollChestReward(random = Math.random, state) {
  // Automatic prizes remain useful, including when two chests await opening.
  const available = CHEST_DROPS.filter((drop) => chestRewardFits(state, drop));
  let roll = random() * available.reduce((sum, drop) => sum + drop.weight, 0);
  const drop = available.find((item) => (roll -= item.weight) < 0) ?? available.at(-1);
  return { id: drop.id, label: drop.label, kind: drop.kind, quantity: drop.quantity };
}
export const rewardArt = (item) =>
  item.kind === 'power' || !item.kind
    ? `/art/powers/${item.id}.svg`
    : `/art/rewards/${item.id}.svg`;

// Used by chest settlement and inventory grants so no route can exceed storage.
export function grantReward(state, reward) {
  if (!Number.isSafeInteger(reward.quantity) || reward.quantity <= 0) return null;
  let overflow = 0;
  let accepted = reward.quantity;
  if (reward.kind === 'power') {
    const slot = state.powers.find((power) => power.id === reward.id);
    if (!slot) return null;
    accepted = Math.min(reward.quantity, Math.max(0, bonusCapacity(state.town) - slot.quantity));
    slot.quantity += accepted;
    overflow = reward.quantity - accepted;
  } else if (reward.kind === 'builder-hammer') {
    accepted = Math.min(reward.quantity, Math.max(0, HAMMER_CAPACITY - state.builderHammers));
    state.builderHammers += accepted;
    overflow = reward.quantity - accepted;
  } else if (reward.kind === 'coins') {
    state.town.coins = Math.min(Number.MAX_SAFE_INTEGER, state.town.coins + reward.quantity);
  } else return null;
  if (overflow) {
    state.town.coins = Math.min(
      Number.MAX_SAFE_INTEGER,
      state.town.coins + overflow * OVERFLOW_COINS,
    );
    if (!accepted)
      return {
        id: 'coins',
        kind: 'coins',
        label: 'Coins',
        quantity: overflow * OVERFLOW_COINS,
        convertedFrom: reward.label,
      };
  }
  return { ...reward, quantity: accepted, overflowCoins: overflow * OVERFLOW_COINS };
}

// Settled chest receipts include both coin prizes and converted overflow bonuses.
export const chestCoinsEarned = (chests) =>
  chests.reduce(
    (total, chest) =>
      total +
      chest.items.reduce(
        (coins, item) =>
          coins + (item.kind === 'coins' ? item.quantity : 0) + (item.overflowCoins ?? 0),
        0,
      ),
    0,
  );
