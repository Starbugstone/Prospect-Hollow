<template>
  <section class="honour-gallery" :aria-labelledby="`${uid}-title`">
    <p class="town-kicker">{{ town }}</p>
    <h2 :id="`${uid}-title`" class="honour-gallery-title">{{ t('Town Honours') }}</h2>
    <p class="honour-gallery-lead">
      {{
        items.length
          ? t(items.length === 1 ? '1 honour earned' : '{count} honours earned', {
              count: items.length,
            })
          : t('No honours earned yet. They appear here as the town earns them.')
      }}
    </p>
    <HonourShowcaseSlots
      v-if="honours.showcase.length"
      compact
      :ids="honours.showcase"
      :earned="honours.earned"
      :size="48"
    />
    <section v-for="group in groups" :key="group.id" class="honour-gallery-group">
      <h3>
        {{ t(TAB_LABELS[group.id]) }} <span>{{ group.items.length }}</span>
      </h3>
      <ul>
        <li v-for="item in group.items" :key="item.familyId">
          <HonourBadge :definition="item.definition" :size="52" />
          <span>
            <HonourKicker :metal="item.definition.metal" :text="item.track.text" />
            <strong>{{ t(item.definition.name) }}</strong>
            <small>{{ earnedText(item.entry) }}</small>
            <small v-if="item.entry.evidence">{{ evidenceText(item.entry.evidence) }}</small>
            <small v-if="honours.showcase.includes(item.familyId)" class="honour-gallery-shown">{{
              t('In the showcase')
            }}</small>
          </span>
        </li>
      </ul>
    </section>
  </section>
</template>
<script setup>
import { computed, useId } from 'vue';
import { t } from '../../i18n';
import HonourBadge from './HonourBadge.vue';
import HonourKicker from './HonourKicker.vue';
import HonourShowcaseSlots from './HonourShowcaseSlots.vue';
import { HONOUR_TABS } from '../../data/honours';
import { TAB_LABELS, earnedFamilies, earnedText, evidenceText } from './honourDisplay';
// A visitor's earned-only gallery from the owner's public honours: each family at its
// best earned rank and metal. It never reads the visitor's own save: progress, counts
// and locked goals stay private.
const props = defineProps({
  honours: { type: Object, required: true },
  town: { type: String, default: '' },
});
const uid = `honour-gallery-${useId()}`;
const items = computed(() => earnedFamilies(props.honours.earned));
const groups = computed(() =>
  HONOUR_TABS.map((id) => ({
    id,
    items: items.value.filter((item) => item.definition.tab === id),
  })).filter((group) => group.items.length),
);
</script>
<style>
/* The visit dialog widens for the gallery grid; on phones it stays a sheet. */
.town-dialog:has(.honour-gallery) {
  width: min(820px, calc(100vw - 32px));
}
@media (max-width: 550px) {
  .town-dialog:has(.honour-gallery) {
    width: 100%;
  }
}
.honour-gallery {
  display: grid;
  gap: 10px;
  color: #3f5545;
}
.honour-gallery .honour-gallery-title {
  margin: 0;
  font:
    400 26px/1.15 Georgia,
    serif;
}
.honour-gallery-lead {
  margin: 0;
  font-size: 13px;
  color: #4f5747;
}
.honour-gallery-group h3 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 10px 0 8px;
  font:
    400 19px Georgia,
    serif;
}
.honour-gallery-group h3 span {
  font:
    700 12px 'Segoe UI',
    sans-serif;
  color: #6f5317;
}
.honour-gallery-group ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.honour-gallery-group li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e0cd9b;
  border-radius: 12px;
  background: #fffcf2;
}
.honour-gallery-group li > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.honour-gallery-group strong {
  font:
    400 17px/1.25 Georgia,
    serif;
}
.honour-gallery-group small {
  font-size: 12px;
  color: #4f5747;
}
.honour-gallery .honour-gallery-shown {
  color: #6f5317;
  font-weight: 600;
}
.honour-contrast .honour-gallery-group li {
  border-color: #626b50;
}
.honour-contrast .honour-gallery-lead,
.honour-contrast .honour-gallery-group small {
  color: #253f2f;
}
</style>
