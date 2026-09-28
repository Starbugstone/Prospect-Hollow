import { t } from '../i18n';

// Guest VIP: its own register, separate from random VIPs. The latest signed-in viewer of
// the owner's shared town, named after one of their towns (sanitised by the server), is
// guaranteed to walk in on the owner's next connection, then behaves like any VIP.
// `seen` records that they walked in, so they arrive once per visit.
const GUEST_NAME = /^[\p{L}\p{M}\p{N}]+(?: [\p{L}\p{M}\p{N}]+)*$/u;

export function normalizeGuestVip(saved) {
  const { name, at, seen } = saved ?? {};
  return typeof name === 'string' &&
    name.length >= 3 &&
    name.length <= 24 &&
    GUEST_NAME.test(name) &&
    Number.isSafeInteger(at) &&
    at > 0
    ? { name, at, seen: seen === true }
    : null;
}

// Only a guest newer than the one this save already welcomed.
export function newerGuest(current, remote) {
  const next = normalizeGuestVip(remote);
  return next && next.at > (current?.at ?? 0) ? { ...next, seen: false } : null;
}

// `guest` dresses them in their era's guest suit instead of an ordinary VIP palette.
export const guestVipIdentity = (guest, gender) => ({
  name: t('From {town}', { town: guest.name }),
  gender,
  guest: true,
});
