import { t } from '../i18n';

// Guest VIP: the latest signed-in viewer of the owner's shared town, named after one of
// their own towns. The server sanitises the name; the save keeps it until a newer guest.
const GUEST_NAME = /^[\p{L}\p{M}\p{N}]+(?: [\p{L}\p{M}\p{N}]+)*$/u;

export function normalizeGuestVip(saved) {
  const { name, at } = saved ?? {};
  return typeof name === 'string' &&
    name.length >= 3 &&
    name.length <= 24 &&
    GUEST_NAME.test(name) &&
    Number.isSafeInteger(at) &&
    at > 0
    ? { name, at }
    : null;
}

// Only a guest newer than the one this save already welcomed.
export function newerGuest(current, remote) {
  const next = normalizeGuestVip(remote);
  return next && next.at > (current?.at ?? 0) ? next : null;
}

export const guestVipIdentity = (guest, gender) => ({
  name: t('Mayor of {town}', { town: guest.name }),
  gender,
});
