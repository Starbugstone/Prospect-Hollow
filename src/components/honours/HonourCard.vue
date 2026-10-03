<template>
  <article
    class="honour-card"
    :class="{
      'is-earned': model.earned,
      'is-locked': !model.earned,
      'is-medal': medal,
      'is-current': model.current && !model.earned,
      'has-new': isNew,
    }"
    :data-honour="model.id"
  >
    <div class="honour-card-top">
      <HonourBadge :definition="model.definition" :size="medal ? 54 : 58" :locked="!model.earned" />
      <div class="honour-card-title">
        <HonourKicker :shape="model.shape" :text="model.kicker" />
        <h3>
          <!-- The whole card opens the detail; the link below stays a separate target. -->
          <button class="honour-card-open" type="button" @click="$emit('open', model.id)">
            {{ model.name
            }}<span class="town-sr-only">
              · {{ model.earned ? t('Earned') : t('Not yet earned') }}</span
            >
          </button>
        </h3>
      </div>
      <span v-if="isNew" class="honour-new">{{ t('New') }}</span>
    </div>
    <p v-if="!medal" class="honour-requirement">{{ model.requirement }}</p>
    <HonourProgress
      v-if="model.progress || model.chips || model.checks || model.nextRank"
      :model="model"
    />
    <p v-if="model.mine" class="honour-where">
      {{ model.mine.summary
      }}<template v-if="!model.mine.reached"> · {{ t('not reached yet') }}</template>
    </p>
    <p v-if="model.status" class="honour-status">{{ model.status }}</p>
    <p v-if="model.earned" class="honour-earned">
      <span v-if="model.earned.dated" aria-hidden="true">✓ </span>{{ model.earned.text
      }}<template v-if="model.earned.evidence"> · {{ model.earned.evidence }}</template>
    </p>
    <button
      v-if="links && model.link"
      class="honour-link"
      type="button"
      @click="$emit('link', model)"
    >
      {{ model.link.label }} <span aria-hidden="true">→</span>
    </button>
  </article>
</template>
<script setup>
import { computed } from 'vue';
import { t } from '../../i18n';
import HonourBadge from './HonourBadge.vue';
import HonourKicker from './HonourKicker.vue';
import HonourProgress from './HonourProgress.vue';
// One collection card: earned in full colour with its date, otherwise greyed with a
// readable requirement, progress and where to make it.
const props = defineProps({
  model: { type: Object, required: true },
  isNew: Boolean,
  links: Boolean,
});
defineEmits(['open', 'link']);
const medal = computed(() => props.model.category === 'defence');
</script>
<style>
.honour-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  border: 1px solid #dedbcc;
  border-radius: 12px;
  background: #efeee6;
  color: #4f5747;
}
.honour-card.is-earned {
  border-color: #e0cd9b;
  background: #fffcf2;
  box-shadow:
    0 1px 0 #fff inset,
    0 3px 10px #8a6d2a14;
}
.honour-card:hover {
  border-color: #a9b798;
}
.honour-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.honour-card-title {
  min-width: 0;
}
.honour-card.has-new .honour-card-title {
  padding-right: 44px;
}
.honour-card h3 {
  margin: 2px 0 0;
  font:
    400 18px/1.25 Georgia,
    serif;
  color: #3f5545;
}
.honour-card.is-locked h3 {
  color: #4a5346;
}
.honour-card-open {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;
}
.honour-card-open::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
}
.honour-card-open:focus-visible {
  outline: none;
}
.honour-card-open:focus-visible::after {
  outline: 3px solid #496d60;
  outline-offset: 2px;
}
.honour-new {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 8px;
  border-radius: 99px;
  background: #9b5a25;
  color: #fffaf0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.honour-requirement {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #4f5747;
}
.honour-where,
.honour-status {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #555c4c;
}
.honour-earned {
  margin: auto 0 0;
  padding-top: 2px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: #6f5317;
}
.honour-card .honour-link {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  min-height: 44px;
  margin: -6px 0 -10px;
  padding: 0;
  border: 0;
  background: none;
  color: #335a40;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.honour-card .honour-link:hover {
  text-decoration: underline;
}
.honour-card .honour-link:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 2px;
}
.honour-card.is-medal {
  align-items: center;
  gap: 3px;
  padding: 16px 10px;
  text-align: center;
}
.honour-card.is-medal .honour-card-top {
  flex-direction: column;
  gap: 6px;
}
.honour-card.is-medal .honour-card-title {
  padding: 0;
}
.honour-card.is-medal h3 {
  font-size: 16px;
}
.honour-card.is-medal .honour-earned,
.honour-card.is-medal .honour-status {
  margin-top: 4px;
  font-size: 11.5px;
}
.honour-card.is-medal.is-current {
  border: 1.5px solid #6f9670;
  background: #f1f5ea;
}
.honour-contrast .honour-card {
  border-color: #626b50;
}
.honour-contrast .honour-card,
.honour-contrast .honour-card .honour-requirement,
.honour-contrast .honour-card .honour-status,
.honour-contrast .honour-card .honour-where {
  color: #253f2f;
}
@media (max-width: 600px) {
  .honour-card {
    padding: 13px;
  }
  .honour-card h3 {
    font-size: 17px;
  }
}
</style>
