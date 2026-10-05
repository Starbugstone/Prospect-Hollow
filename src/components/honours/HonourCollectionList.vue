<template>
  <div class="honour-list">
    <section class="honour-showcase" :aria-labelledby="`${uid}-showcase`">
      <div class="honour-showcase-copy">
        <h3 :id="`${uid}-showcase`">{{ t('Showcase') }}</h3>
        <p>{{ t('Visitors see these three beside your town name.') }}</p>
      </div>
      <HonourShowcaseSlots
        :ids="showcase"
        :earned="state.honours?.earned ?? {}"
        addable
        @add="$emit('manage')"
      />
      <button class="honour-manage" type="button" @click="$emit('manage')">
        {{ t('Manage showcase') }}
      </button>
    </section>
    <div
      ref="tablist"
      class="honour-tabs"
      role="tablist"
      :aria-label="t('Honour categories')"
      @keydown="moveTab"
    >
      <button
        v-for="entry in tabs"
        :id="`${uid}-tab-${entry.id}`"
        :key="entry.id"
        type="button"
        role="tab"
        :aria-selected="entry.id === tab"
        :aria-controls="`${uid}-panel`"
        :tabindex="entry.id === tab ? 0 : -1"
        @click="tab = entry.id"
      >
        <span>{{ t(TAB_LABELS[entry.id]) }}</span>
        <b>{{ entry.earned }}/{{ entry.total }}</b>
        <i v-if="showNew && entry.fresh" class="honour-dot"
          ><span class="town-sr-only">{{ t('New honours') }}</span></i
        >
      </button>
    </div>
    <div :id="`${uid}-panel`" role="tabpanel" :aria-labelledby="`${uid}-tab-${tab}`">
      <div class="honour-toolbar">
        <div class="honour-filter" role="group" :aria-label="t('Show honours')">
          <button
            v-for="option in FILTERS"
            :key="option.id"
            type="button"
            :aria-pressed="filter === option.id"
            @click="filter = option.id"
          >
            {{ t(option.label) }}
          </button>
        </div>
        <p>{{ note }}</p>
      </div>
      <p v-if="!cards.length" class="honour-empty" role="status">
        {{
          t(
            filter === 'earned'
              ? 'Nothing earned here yet. Every honour stays open to earn.'
              : 'Every honour here is earned.',
          )
        }}
      </p>
      <div class="honour-grid">
        <HonourCard
          v-for="card in cards"
          :key="card.id"
          :model="card"
          :is-new="showNew && fresh.includes(card.id)"
          :new-rank="showNew && newRanks.includes(card.id)"
          :links="links"
          @open="$emit('open', $event)"
          @link="$emit('link', $event)"
        />
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, useId } from 'vue';
import { t } from '../../i18n';
import HonourCard from './HonourCard.vue';
import HonourShowcaseSlots from './HonourShowcaseSlots.vue';
import { TAB_LABELS, describeFamily } from './honourDisplay';
// The collection body: showcase, Mine / Town / Friends tabs, filter and cards (earned first).
const props = defineProps({
  tabs: { type: Array, required: true },
  state: { type: Object, required: true },
  showcase: { type: Array, default: () => [] },
  // Families that were new when the collection opened keep their label while it is open.
  fresh: { type: Array, default: () => [] },
  // Families with a rank added by an update, as they were when the collection opened.
  newRanks: { type: Array, default: () => [] },
  showNew: Boolean,
  links: Boolean,
  canReplay: Boolean,
  canTravel: Boolean,
});
defineEmits(['open', 'manage', 'link']);
const tab = defineModel('tab', { type: String, default: 'mine' });
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'open', label: 'Not yet' },
];
const NOTES = {
  mine: 'Completed puzzles count, including museum replays. Each honour climbs from bronze to gold.',
  town: '{earned} of {total} earned · earned first, then goals still to reach',
  friends: 'Each different player counts once, for visits to your town and from it.',
};
const uid = `honours-${useId()}`;
const filter = defineModel('filter', { type: String, default: 'all' });
const tablist = ref(null);
const current = computed(() => props.tabs.find((entry) => entry.id === tab.value) ?? props.tabs[0]);
const cards = computed(() =>
  current.value.families
    .filter((family) => filter.value === 'all' || !!family.earned === (filter.value === 'earned'))
    .map((family) =>
      describeFamily(family, props.state, {
        canReplay: props.canReplay,
        canTravel: props.canTravel,
      }),
    ),
);
const note = computed(() =>
  t(NOTES[current.value.id], { earned: current.value.earned, total: current.value.total }),
);
// Arrow keys, Home and End move between tabs, as in a native tab list.
function moveTab(event) {
  const index = props.tabs.findIndex((entry) => entry.id === tab.value);
  const last = props.tabs.length - 1;
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  tab.value = props.tabs[next].id;
  tablist.value?.querySelectorAll('[role="tab"]')[next]?.focus();
}
</script>
<style>
.honour-showcase {
  display: grid;
  grid-template-columns: minmax(150px, 200px) minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  margin: 18px 0 6px;
  padding: 14px 18px;
  border: 1px solid #e2d3a8;
  border-radius: 12px;
  background: linear-gradient(180deg, #fbf5e4, #f3ecd6);
}
.honour-showcase-copy h3 {
  margin: 0;
  font:
    400 19px Georgia,
    serif;
  color: #3f5545;
}
.honour-showcase-copy p {
  margin: 2px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #4f5747;
}
.honour-list .honour-manage {
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid #536e5e;
  border-radius: 7px;
  background: #fffdf6;
  color: #3f5845;
  font-size: 13px;
  cursor: pointer;
}
.honour-list .honour-manage:hover {
  background: #eef0e4;
}
.honour-tabs {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  gap: 5px;
  margin: 18px 0 12px;
  padding: 5px;
  border-radius: 10px;
  background: #e8e9dc;
  box-shadow: 0 -8px 0 #faf7ed;
}
.honour-tabs [role='tab'] {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4f5a49;
  font-size: 13px;
  cursor: pointer;
}
.honour-tabs [role='tab'][aria-selected='true'] {
  background: #fffdf6;
  color: #34483d;
  font-weight: 600;
  box-shadow: 0 2px 6px #4b503c10;
}
.honour-tabs b {
  color: #6f5317;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.honour-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9b5a25;
}
.honour-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 4px 0 16px;
}
.honour-toolbar p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #4f5747;
}
.honour-filter {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 4px;
  border-radius: 9px;
  background: #e8e9dc;
}
.honour-filter button {
  min-height: 40px;
  padding: 8px 13px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4f5a49;
  font-size: 12.5px;
  cursor: pointer;
}
.honour-filter button[aria-pressed='true'] {
  background: #fffdf6;
  color: #34483d;
  font-weight: 600;
  box-shadow: 0 2px 6px #4b503c14;
}
.honour-list button:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 2px;
}
.honour-empty {
  margin: 0 0 16px;
  font-size: 13px;
  color: #4f5747;
}
.honour-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.honour-contrast .honour-showcase,
.honour-contrast .honour-tabs,
.honour-contrast .honour-filter {
  outline: 1px solid #626b50;
}
.honour-contrast .honour-toolbar p,
.honour-contrast .honour-showcase-copy p,
.honour-contrast .honour-tabs [role='tab'] {
  color: #253f2f;
}
@media (max-width: 860px) {
  .honour-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .honour-showcase {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .honour-list .honour-manage {
    width: 100%;
  }
}
@media (max-width: 600px) {
  .honour-showcase {
    padding: 12px;
  }
  .honour-tabs [role='tab'] {
    flex-wrap: wrap;
    gap: 0 5px;
    padding: 6px 4px;
    font-size: 12px;
    line-height: 1.3;
  }
  .honour-tabs [role='tab'] > span {
    flex-basis: 100%;
  }
  .honour-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .honour-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
</style>
