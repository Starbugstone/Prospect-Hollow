import { t } from '../i18n';

// Guest VIP: the obsolete queued guest, kept for saves made before live presence
// (docs/backend/visitors.md) replaced it. No new guest is queued. A saved guest, named
// after one of the viewer's towns, walks in once without VIP coin rewards, unless live
// presence is on; `seen` records that they walked in.
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

// `guest` dresses them in their era's guest suit instead of an ordinary VIP palette.
export const guestVipIdentity = (guest, gender) => ({
  name: t('From {town}', { town: guest.name }),
  gender,
  guest: true,
});
