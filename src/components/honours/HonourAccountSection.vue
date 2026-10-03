<template>
  <section
    class="account-section honour-account"
    :class="{ 'honour-contrast': settings.highContrastMode }"
    :aria-labelledby="`${uid}-title`"
  >
    <h2 :id="`${uid}-title`">{{ t('Honours') }}</h2>
    <p class="honour-account-summary">
      <strong>{{ t('{earned} of {total} honours earned', summary) }}</strong>
      <span v-if="fresh" class="honour-account-new">{{
        t(fresh === 1 ? '1 new' : '{count} new', { count: fresh })
      }}</span>
    </p>
    <HonourShowcaseSlots
      :ids="showcase"
      :earned="campaign.honours.earned"
      addable
      @add="managing = true"
    />
    <div class="account-row">
      <button type="button" :aria-expanded="managing" @click="managing = !managing">
        {{ t('Manage showcase') }}
      </button>
      <button type="button" @click="openCollection()">{{ t('Open collection') }}</button>
    </div>
    <HonourShowcaseEditor v-if="managing" />
    <div class="honour-account-preview">
      <small>{{ t('What visitors see') }}</small>
      <p>
        <strong>{{ town }}</strong>
        <HonourShowcaseSlots
          v-if="showcase.length"
          compact
          :ids="showcase"
          :earned="campaign.honours.earned"
          :size="30"
        />
        <span v-else>{{ t('No honours on show yet') }}</span>
      </p>
      <small v-if="!shared">{{ t('Visitors see this once sharing is on.') }}</small>
    </div>
  </section>
</template>
<script setup>
import { computed, ref, useId } from 'vue';
import { t } from '../../i18n';
import { useHonourNavigation } from '../../composables/useHonourNavigation';
import { useCampaignStore } from '../../stores/campaignStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { validShowcase } from '../../data/honours';
import HonourShowcaseEditor from './HonourShowcaseEditor.vue';
import HonourShowcaseSlots from './HonourShowcaseSlots.vue';
import { honourSummary } from './honourDisplay';
// Town management: the showcase beside the town name, what visitors see, and the way
// into the collection. The collection opens over this panel, signed in or not.
defineProps({ town: { type: String, default: '' }, shared: Boolean });
const campaign = useCampaignStore(),
  settings = useSettingsStore();
const { openCollection } = useHonourNavigation();
const uid = `honour-account-${useId()}`;
const managing = ref(false);
const summary = computed(() => honourSummary(campaign.honours));
const fresh = computed(() => (settings.honourNotices === 'off' ? 0 : summary.value.fresh));
const showcase = computed(() => validShowcase(campaign.honours.showcase, campaign.honours));
</script>
<style>
.honour-account-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
}
.honour-account-new {
  padding: 1px 8px;
  border-radius: 99px;
  background: #9b5a25;
  color: #fffaf0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.honour-account .honour-slots > li {
  min-height: 60px;
}
.honour-account-preview {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px dashed #c9c3ad;
  border-radius: 10px;
}
.honour-account-preview small {
  color: #5c5f4f;
  font-size: 12px;
}
.honour-account-preview p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
}
.honour-account-preview strong {
  font:
    400 19px Georgia,
    serif;
}
.honour-account-preview span {
  color: #5c5f4f;
  font-size: 13px;
}
.honour-account.honour-contrast .honour-account-preview {
  border-color: #626b50;
}
</style>
