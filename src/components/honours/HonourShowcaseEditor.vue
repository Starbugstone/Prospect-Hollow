<template>
  <section class="honour-editor" :aria-label="t('Manage showcase')">
    <p class="honour-editor-hint">
      {{ t('Visitors see up to three earned honours beside your town name, in this order.') }}
      <template v-if="distinctions.length">{{
        t('One of them can be a player distinction.')
      }}</template>
    </p>
    <ol ref="list" class="honour-editor-slots" tabindex="-1" :aria-label="t('Showcase order')">
      <li
        v-for="(slot, index) in slots"
        :key="slot?.familyId ?? `empty-${index}`"
        :class="{ 'is-empty': !slot }"
        :data-family="slot?.familyId"
      >
        <span class="honour-editor-number" aria-hidden="true">{{ index + 1 }}</span>
        <template v-if="slot">
          <HonourBadge :definition="slot.definition" :size="44" />
          <strong>{{ slot.name }}</strong>
          <span class="honour-editor-actions">
            <button
              v-for="action in ACTIONS"
              :key="action.id"
              type="button"
              :data-action="action.id"
              :aria-disabled="!allowed(action, index)"
              :aria-label="t(action.label, { name: t(slot.definition.name) })"
              :title="t(action.label, { name: t(slot.definition.name) })"
              @click="run(action, index)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path :d="action.icon" />
              </svg>
            </button>
          </span>
        </template>
        <span v-else class="honour-editor-empty">{{ t('Empty slot') }}</span>
      </li>
    </ol>
    <h3>{{ t('Earned honours') }}</h3>
    <p v-if="!choices.length" class="honour-editor-hint">
      {{
        t(
          families.length
            ? 'Every earned honour is already in the showcase.'
            : 'Earn an honour to show it to visitors.',
        )
      }}
    </p>
    <ul v-else class="honour-editor-choices">
      <li v-for="choice in choices" :key="choice.familyId">
        <button type="button" :aria-disabled="full" @click="add(choice)">
          <HonourBadge :definition="choice.definition" :size="36" />
          <span class="honour-editor-name">{{ choice.name }}</span>
          <small>{{ t(full ? 'Showcase full' : 'Add') }}</small>
        </button>
      </li>
    </ul>
    <template v-if="distinctions.length">
      <h3>{{ t('Player distinctions') }}</h3>
      <p class="honour-editor-hint">
        {{
          t(
            accountTown
              ? 'Your town can show one player distinction. Choosing another one replaces it.'
              : 'Only towns on your account can show player distinctions.',
          )
        }}
      </p>
      <ul v-if="accountTown" class="honour-editor-choices">
        <li v-for="choice in distinctions" :key="choice.familyId">
          <button
            type="button"
            :aria-disabled="choice.shown || (full && !shownDistinction)"
            @click="showDistinction(choice)"
          >
            <HonourBadge :definition="choice.definition" :size="36" />
            <span class="honour-editor-name">{{ choice.name }}</span>
            <small>{{
              t(
                choice.shown
                  ? 'In the showcase'
                  : shownDistinction
                    ? 'Replace'
                    : full
                      ? 'Showcase full'
                      : 'Add',
              )
            }}</small>
          </button>
        </li>
      </ul>
    </template>
    <p v-if="full && choices.length" class="honour-editor-hint">
      {{ t('Remove an honour from the showcase to make room for another.') }}
    </p>
    <p class="town-sr-only" role="status">{{ announcement }}</p>
  </section>
</template>
<script setup>
import { computed, nextTick, ref } from 'vue';
import { t } from '../../i18n';
import { useCampaignStore } from '../../stores/campaignStore';
import { usePlayerDistinctions } from '../../composables/usePlayerDistinctions';
import { SHOWCASE_SLOTS } from '../../data/honours';
import { isPlayerDistinction } from '../../data/playerDistinctions';
import HonourBadge from './HonourBadge.vue';
import { earnedFamilies, moveSlot, showcaseSlots } from './honourDisplay';
// Showcase order, removal and additions from earned families and at most one player
// distinction. Presentation only: it never changes buildings, rewards or progress.
const ACTIONS = [
  { id: 'earlier', offset: -1, label: 'Move {name} earlier', icon: 'M12 19V5m-6 6 6-6 6 6' },
  { id: 'later', offset: 1, label: 'Move {name} later', icon: 'M12 5v14m-6-6 6 6 6-6' },
  { id: 'remove', label: 'Remove {name} from the showcase', icon: 'm6 6 12 12M6 18 18 6' },
];
const campaign = useCampaignStore();
const {
  showcase: ids,
  saveShowcase,
  received,
  showcaseable,
  accountTown,
} = usePlayerDistinctions({ campaign });
const list = ref(null),
  announcement = ref('');
const slots = computed(() => showcaseSlots(ids.value, campaign.honours.earned, received.value));
const shownDistinction = computed(() => ids.value.find(isPlayerDistinction) ?? null);
const distinctions = computed(() =>
  Object.keys(received.value)
    .map((id) => showcaseSlots([id], {}, received.value)[0])
    .filter(Boolean)
    .map((choice) => ({ ...choice, shown: choice.familyId === shownDistinction.value })),
);
const families = computed(() => earnedFamilies(campaign.honours.earned));
const choices = computed(() =>
  families.value.filter((family) => !ids.value.includes(family.familyId)),
);
const full = computed(() => ids.value.length >= SHOWCASE_SLOTS);
const allowed = (action, index) =>
  !action.offset || (index + action.offset >= 0 && index + action.offset < ids.value.length);
function save(next, message) {
  announcement.value = saveShowcase(next) ? message : t('Your showcase could not be saved.');
}
// Keyed slots may be re-inserted when they move, so focus follows the same control.
async function focus(familyId, action) {
  await nextTick();
  const slot = familyId && list.value?.querySelector(`[data-family="${familyId}"]`);
  (slot?.querySelector(`[data-action="${action}"]`) ?? list.value)?.focus();
}
function run(action, index) {
  if (!allowed(action, index)) return;
  const slot = slots.value[index];
  const name = t(slot.definition.name);
  if (action.id === 'remove') {
    save(
      ids.value.filter((id) => id !== slot.familyId),
      t('{name} removed from the showcase', { name }),
    );
    focus(ids.value[index] ?? ids.value[index - 1], 'remove');
    return;
  }
  save(
    moveSlot(ids.value, index, action.offset),
    t('{name} moved to position {position}', { name, position: index + action.offset + 1 }),
  );
  focus(slot.familyId, action.id);
}
// One player distinction per town: another one takes the same slot.
function showDistinction(choice) {
  if (choice.shown || !Object.hasOwn(showcaseable.value, choice.familyId)) return;
  const current = shownDistinction.value;
  if (!current) return add(choice);
  save(
    ids.value.map((id) => (id === current ? choice.familyId : id)),
    t('{name} replaces your player distinction', { name: choice.name }),
  );
  focus(choice.familyId, 'remove');
}
function add(choice) {
  if (full.value) return;
  save(
    [...ids.value, choice.familyId],
    t('{name} added at position {position}', {
      name: t(choice.definition.name),
      position: ids.value.length + 1,
    }),
  );
  focus(choice.familyId, 'remove');
}
</script>
<style>
.honour-editor {
  display: grid;
  gap: 10px;
  color: #3f5545;
}
.honour-editor h3 {
  margin: 8px 0 0;
  font:
    400 19px Georgia,
    serif;
}
.honour-editor-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #4f5747;
}
.honour-editor-slots,
.honour-editor-choices {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.honour-editor-slots:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 3px;
  border-radius: 10px;
}
.honour-editor-slots li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 60px;
  padding: 6px 8px;
  border: 1px solid #e0d4b2;
  border-radius: 10px;
  background: #fffdf6;
}
.honour-editor-slots li.is-empty {
  border: 1.5px dashed #b9b090;
  background: transparent;
  color: #5f6352;
}
.honour-editor-number {
  flex: 0 0 22px;
  font:
    600 13px Georgia,
    serif;
  color: #6f5317;
  text-align: center;
}
.honour-editor-slots strong {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
}
.honour-editor-actions {
  display: flex;
  gap: 4px;
}
.honour-editor .honour-editor-actions button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  border: 1px solid #c9c3ad;
  border-radius: 50%;
  background: #f3f4e8;
  color: #3f5545;
  cursor: pointer;
}
.honour-editor .honour-editor-actions svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.honour-editor .honour-editor-choices button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 6px 12px 6px 8px;
  border: 1px solid #ded9c8;
  border-radius: 10px;
  background: #f6f4ea;
  color: #3f5545;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.honour-editor .honour-editor-name {
  flex: 1;
}
/* Badges keep their size inside buttons styled by the host (the account panel). */
.honour-editor .honour-badge > svg {
  width: 100%;
  height: 100%;
}
.honour-editor .honour-editor-choices small {
  font-size: 12px;
  font-weight: 600;
  color: #335a40;
}
.honour-editor button:hover:not([aria-disabled='true']) {
  border-color: #7e9778;
  background: #e9eddd;
}
.honour-editor button[aria-disabled='true'] {
  opacity: 0.45;
  cursor: not-allowed;
}
.honour-editor button:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 2px;
}
.honour-contrast .honour-editor li,
.honour-contrast .honour-editor button {
  border-color: #626b50;
}
</style>
