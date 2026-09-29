import { t } from '../i18n';

// Names are public profile snapshots, never account identifiers or email addresses.
export function visitorName(visitor) {
  const name =
    visitor.name ||
    (visitor.townName ? t('Mayor of {town}', { town: visitor.townName }) : t('Visitor'));
  return visitor.self ? t('{name} (you)', { name }) : name;
}

export function visitorTitle(visitor) {
  return visitor.name && visitor.townName ? t('Mayor of {town}', { town: visitor.townName }) : '';
}

export function visitorLabel(visitor) {
  return [visitorName(visitor), visitorTitle(visitor)].filter(Boolean).join(' · ');
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
