// Prices default to coins. Unknown currencies fail closed, including incomplete
// future definitions. Monument definitions may declare currency: 'moonstones'.
export const TOWN_CURRENCIES = Object.freeze(['coins', 'moonstones']);
const currencies = new Set(TOWN_CURRENCIES);
export const priceCurrency = (price) => price?.currency ?? 'coins';
export const currencyBalance = (town, currency = 'coins') =>
  currencies.has(currency) ? (town?.[currency] ?? 0) : 0;
export function canAffordPrice(town, price) {
  const currency = priceCurrency(price);
  return (
    currencies.has(currency) &&
    Number.isSafeInteger(price?.price) &&
    price.price >= 0 &&
    currencyBalance(town, currency) >= price.price
  );
}
export function payPrice(town, price) {
  if (!canAffordPrice(town, price)) return null;
  const currency = priceCurrency(price);
  return { ...town, [currency]: currencyBalance(town, currency) - price.price };
}
