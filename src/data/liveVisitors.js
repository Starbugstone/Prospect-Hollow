import { t } from '../i18n';

// Names are public profile snapshots, never account identifiers or email addresses.
export function visitorName(visitor) {
  return (
    visitor.name ||
    (visitor.townName ? t('Mayor of {town}', { town: visitor.townName }) : t('Visitor'))
  );
}

export function visitorTitle(visitor) {
  return visitor.name && visitor.townName ? t('Mayor of {town}', { town: visitor.townName }) : '';
}

export function visitorLabel(visitor) {
  return [visitorName(visitor), visitorTitle(visitor)].filter(Boolean).join(' · ');
}
