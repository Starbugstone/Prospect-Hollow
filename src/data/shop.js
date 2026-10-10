import { buildingServiceLevel } from './buildingProgression';
import { purchasePrice } from './economy';
import { POWERS } from './campaign';
import { bonusCapacity } from './rewards';

// Builder hammers come from mine chests and Frontier's starter projects, never the shop.
export const SHOP_ITEMS = POWERS.map((power) => ({
  id: power.id,
  label: power.label,
  kind: 'power',
  quantity: 1,
  price: purchasePrice(['shuffle', 'clear-row'].includes(power.id) ? 40 : 60),
}));
export const shopSlots = (level) =>
  level > 0 ? Math.min(SHOP_ITEMS.length, buildingServiceLevel('shop', level)) : 0;
export function rollShopStock(level, random = Math.random, existing = []) {
  const stock = existing
    .filter(
      (offer, index) =>
        SHOP_ITEMS.some((item) => item.id === offer?.id) &&
        existing.findIndex((entry) => entry?.id === offer.id) === index,
    )
    .slice(0, shopSlots(level));
  const pool = SHOP_ITEMS.filter((item) => !stock.some((offer) => offer.id === item.id));
  while (stock.length < shopSlots(level) && pool.length) {
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    stock.push({ id: pool.splice(index, 1)[0].id, sold: false });
  }
  return stock;
}
export function shopSpace(state, item) {
  return (
    bonusCapacity(state.town) - (state.powers.find((power) => power.id === item.id)?.quantity ?? 0)
  );
}
