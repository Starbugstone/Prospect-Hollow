<template>
  <section class="account-section" aria-labelledby="office-data-title">
    <h2 id="office-data-title">{{ t('What we keep about you') }}</h2>
    <p class="account-hint">
      {{ t('This is everything the server stores for your account, as it is right now.') }}
    </p>
    <dl class="office-facts">
      <div v-for="fact in facts" :key="fact.label">
        <dt>{{ t(fact.label) }}</dt>
        <dd>
          {{ fact.value }}<small v-if="fact.note">{{ fact.note }}</small>
        </dd>
      </div>
    </dl>
    <p class="account-hint">
      {{ t('Not kept: passwords (there are none), payment details, your location or contacts.') }}
      <a :href="privacyUrl()" target="_blank" rel="noopener">{{ t('How we use this data') }}</a>
    </p>
  </section>
  <section class="account-section" aria-labelledby="office-download-title">
    <h2 id="office-download-title">{{ t('Download my data') }}</h2>
    <p>
      {{
        t(
          'Get a copy in a readable file (JSON): your account, towns with their earlier saves, public profile, last connection and the towns you visited.',
        )
      }}
    </p>
    <div class="account-row">
      <button class="account-primary" :disabled="busy" @click="act(downloadAccountData)">
        <GameIcon name="download" />{{ t('Download account data') }}
      </button>
      <button :disabled="busy" @click="act(downloadDeviceData)">
        <GameIcon name="devices" />{{ t('This device only') }}
      </button>
    </div>
    <p class="account-hint">
      {{ t('“This device only” holds the saves, settings and backups kept in this browser.') }}
    </p>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { useAccountContext } from './accountContext';
import {
  describeBrowser,
  downloadAccountData,
  downloadDeviceData,
} from '../../services/playerData';
import { privacyUrl } from '../../services/appRoute';
import { RETENTION } from '../../data/privacy';
import { t, number, locale } from '../../i18n';
import GameIcon from '../GameIcon.vue';
const props = defineProps({ summary: { type: Object, required: true } });
const { busy, act } = useAccountContext();
const when = (at) =>
  at
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(at)
    : t('Never');
const facts = computed(() => {
  const s = props.summary;
  return [
    { label: 'Email address', value: s.email, note: t('Only you can see it') },
    { label: 'Public name', value: s.publicName || t('None') },
    { label: 'Private visits', value: s.anonymousVisits ? t('On') : t('Off') },
    {
      label: 'Cloud towns',
      value: number(s.towns),
      note: [
        t('Saved versions: {count}', { count: number(s.savedVersions) }),
        s.deletedTowns
          ? t('Deleted towns: {count}, removed after {days}', {
              count: number(s.deletedTowns),
              days: t(RETENTION.deletedTown),
            })
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: 'Honours and distinctions',
      value: t('Town Honours: {honours} · player distinctions: {distinctions}', {
        honours: number(s.honours),
        distinctions: number(s.distinctions),
      }),
    },
    {
      label: 'Last connection',
      value: [
        when(s.lastSeenAt),
        describeBrowser(s.lastBrowser),
        { app: t('mobile app'), web: t('website') }[s.platform] ?? '',
      ]
        .filter(Boolean)
        .join(' · '),
      note: t('Replaced at each visit'),
    },
    { label: 'Last IP address', value: s.lastIp ?? t('None'), note: t('Kept for security') },
    {
      label: 'Email sign-ins',
      value: number(s.emailSignIns),
      note: s.lastSignInAt ? t('Latest: {when}', { when: when(s.lastSignInAt) }) : '',
    },
    {
      label: 'Active days',
      value: number(s.activeDays),
      note: t('Kept {days}', { days: t(RETENTION.activeDays) }),
    },
    { label: 'Signed-in devices', value: number(s.sessions) },
    {
      label: 'Guestbooks you signed',
      value: number(s.townsVisited),
      note: t('Visits: {count}', { count: number(s.visits) }),
    },
    { label: 'Favourite towns', value: number(s.favourites) },
  ];
});
</script>
