<template>
  <div class="distinction-list">
    <p class="distinction-note">
      {{ t('Player distinctions belong to you, not to a town. Each town can show one of them.') }}
    </p>
    <p v-if="!cards.length" class="honour-empty" role="status">
      {{
        t(
          signedIn
            ? 'Your first player distinction arrives one week after your first sign-in.'
            : 'Sign in to receive player distinctions. They mark special moments of the game and your time in Prospect Hollow.',
        )
      }}
    </p>
    <ul class="distinction-grid">
      <li
        v-for="card in cards"
        :key="card.id"
        class="distinction-card"
        :class="{ 'is-showcased': card.shown }"
        :data-distinction="card.id"
      >
        <HonourBadge :definition="card.badge" :size="76" />
        <div class="distinction-body">
          <p class="distinction-kicker">
            {{ t('Player distinction') }}
            <span v-if="showNew && fresh.includes(card.id)" class="honour-new">{{ t('New') }}</span>
          </p>
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
          <p v-if="card.received" class="distinction-date">{{ card.received }}</p>
          <p v-if="card.next" class="distinction-date">{{ card.next }}</p>
          <button
            class="distinction-toggle"
            type="button"
            :aria-disabled="!card.action.enabled"
            @click="toggle(card)"
          >
            {{ card.action.label }}
          </button>
          <p v-if="card.action.hint" class="distinction-hint">{{ card.action.hint }}</p>
        </div>
      </li>
    </ul>
    <p class="town-sr-only" role="status">{{ announcement }}</p>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import { SHOWCASE_SLOTS } from '../../data/honours';
import { isPlayerDistinction } from '../../data/playerDistinctions';
import { usePlayerDistinctions } from '../../composables/usePlayerDistinctions';
import HonourBadge from './HonourBadge.vue';
import { describeDistinction } from './honourDisplay';
// The Player tab: only the distinctions this player received, each with its date, the
// next time step and the showcase choice. A town shows one of them at most, so choosing
// another one replaces it in the same slot.
defineProps({
  // Distinctions that were new when the collection opened keep their label.
  fresh: { type: Array, default: () => [] },
  showNew: Boolean,
});
const { list, signedIn, accountTown, showcase, saveShowcase } = usePlayerDistinctions();
const announcement = ref('');
const shown = computed(() => showcase.value.find(isPlayerDistinction) ?? null);
function action(id) {
  if (shown.value === id) return { enabled: true, label: t('Remove from showcase') };
  if (!accountTown.value)
    return {
      enabled: false,
      label: t('Add to showcase'),
      hint: t('Only towns on your account can show player distinctions.'),
    };
  if (shown.value) return { enabled: true, label: t('Show this one instead') };
  if (showcase.value.length >= SHOWCASE_SLOTS)
    return {
      enabled: false,
      label: t('Add to showcase'),
      hint: t('Your showcase is full. Remove an honour from it to add this one.'),
    };
  return { enabled: true, label: t('Add to showcase') };
}
const cards = computed(() =>
  list.value.map((item) => ({
    ...describeDistinction(item),
    shown: shown.value === item.id,
    action: action(item.id),
  })),
);
function toggle(card) {
  if (!card.action.enabled) return;
  const ids = showcase.value;
  const next = card.shown
    ? ids.filter((id) => id !== card.id)
    : shown.value
      ? ids.map((id) => (id === shown.value ? card.id : id))
      : [...ids, card.id];
  announcement.value = saveShowcase(next)
    ? t(card.shown ? 'Removed from your showcase.' : 'Added to your showcase.')
    : t('Your showcase could not be saved.');
}
</script>
<style>
.distinction-note {
  margin: 4px 0 16px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #4f5747;
}
.distinction-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.distinction-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
  padding: 16px;
  border: 1px solid #d9cdee;
  border-radius: 12px;
  background: linear-gradient(160deg, #fffdf8, #f6f1fd);
}
.distinction-card.is-showcased {
  border-color: #8a6bc4;
  box-shadow: 0 0 0 1px #8a6bc4 inset;
}
.distinction-body {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.distinction-body h3 {
  margin: 0;
  font:
    400 19px Georgia,
    serif;
  color: #34483d;
}
.distinction-body p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #4f5747;
}
.distinction-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px !important;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #4d3384 !important;
}
.distinction-body .distinction-date {
  font-size: 12px;
  font-weight: 600;
  color: #4d3384;
}
.distinction-list .distinction-toggle {
  justify-self: start;
  min-height: 44px;
  margin-top: 6px;
  padding: 10px 16px;
  border: 1px solid #536e5e;
  border-radius: 7px;
  background: #fffdf6;
  color: #3f5845;
  font-size: 13px;
  cursor: pointer;
}
.distinction-list .distinction-toggle:hover:not([aria-disabled='true']) {
  background: #eef0e4;
}
.distinction-list .distinction-toggle[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}
.distinction-list .distinction-toggle:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 2px;
}
.distinction-body .distinction-hint {
  font-size: 12px;
}
.honour-contrast .distinction-card {
  border-color: #626b50;
}
.honour-contrast .distinction-note,
.honour-contrast .distinction-body p {
  color: #253f2f;
}
@media (max-width: 860px) {
  .distinction-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .distinction-card {
    padding: 12px;
    gap: 12px;
  }
}
</style>
