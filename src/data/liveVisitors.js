import { t } from '../i18n';

// A home town its mayor has since deleted keeps its name, as a former town.
const mayorOf = (visitor) =>
  visitor.townGone
    ? t('Former mayor of {town}', { town: visitor.townName })
    : t('Mayor of {town}', { town: visitor.townName });

// Names are public profile snapshots, never account identifiers or email addresses.
export function visitorName(visitor) {
  const name = visitor.name || (visitor.townName ? mayorOf(visitor) : t('Visitor'));
  return visitor.self ? t('{name} (you)', { name }) : name;
}

export function visitorTitle(visitor) {
  return visitor.name && visitor.townName ? mayorOf(visitor) : '';
}

export function visitorLabel(visitor) {
  return [visitorName(visitor), visitorTitle(visitor)].filter(Boolean).join(' · ');
}

// The guestbook keeps every visit it has loaded, newest first. The live first page and older
// pages overlap once new arrivals shift the pages, so visits merge by stay ID and a later list
// (the live page) updates an earlier copy, such as a departure time.
export function mergeVisits(...lists) {
  const visits = new Map();
  for (const visit of lists.flat()) visits.set(visit.id, visit);
  return [...visits.values()].sort(
    (a, b) => b.arrivedAt - a.arrivedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );
}

// Groups newest-first visits by the local day they arrived: Today, Yesterday, then dates.
export function visitDays(visits, now = Date.now(), language) {
  const dayOf = (at) => new Date(at).toDateString();
  const today = dayOf(now),
    yesterday = dayOf(new Date(now).setDate(new Date(now).getDate() - 1));
  const date = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const days = [];
  for (const visit of visits) {
    const key = dayOf(visit.arrivedAt);
    if (days.at(-1)?.key !== key)
      days.push({
        key,
        label:
          key === today
            ? t('Today')
            : key === yesterday
              ? t('Yesterday')
              : date.format(visit.arrivedAt),
        visits: [],
      });
    days.at(-1).visits.push(visit);
  }
  return days;
}

// Compare confirmed server snapshots by stay ID, not by name or heartbeat time.
// The first snapshot is a baseline, so opening a town never replays old arrivals.
export function visitorChanges(previous, present) {
  if (previous === null) return [];
  const before = new Map(previous.map((visitor) => [visitor.id, visitor]));
  const after = new Map(present.map((visitor) => [visitor.id, visitor]));
  return [
    ...[...before.values()]
      .filter((visitor) => !after.has(visitor.id))
      .map((visitor) => ({ kind: 'departure', visitor })),
    ...[...after.values()]
      .filter((visitor) => !before.has(visitor.id))
      .map((visitor) => ({ kind: 'arrival', visitor })),
  ];
}
