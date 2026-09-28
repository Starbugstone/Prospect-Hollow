import { t } from '../i18n';

// Share-link visits recorded by the server: the last time a visitor collected the
// saloon and the latest signed-in guest. Times are milliseconds. The save keeps what
// it has already applied, so each visit reaches the owner's game exactly once.
const GUEST_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’-]{2,23}$/u;
const time = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);

export const createVisitors = () => ({ saloonAt: 0, guest: null });

export function normalizeVisitors(saved) {
  const guest = saved?.guest;
  return {
    saloonAt: time(saved?.saloonAt),
    guest:
      typeof guest?.name === 'string' && GUEST_NAME.test(guest.name) && time(guest.at)
        ? { name: guest.name, at: guest.at }
        : null,
  };
}

// Only visits newer than the ones this save already applied.
export function newVisits(applied, remote) {
  const next = normalizeVisitors(remote);
  return {
    saloonAt: next.saloonAt > (applied?.saloonAt ?? 0) ? next.saloonAt : 0,
    guest: next.guest && next.guest.at > (applied?.guest?.at ?? 0) ? next.guest : null,
  };
}

// The latest signed-in guest arrives as a VIP named after their own town.
export const guestVip = (guest, gender) => ({
  name: t('Mayor of {town}', { town: guest.name }),
  gender,
});
