<template>
  <article
    class="honour-card"
    :class="[
      model.metal ? `honour-card-${model.metal}` : 'is-locked',
      { 'is-earned': model.earned, 'has-new': isNew || newRank },
    ]"
    :data-honour="model.id"
  >
    <div class="honour-card-top">
      <HonourBadge :definition="model.definition" :size="58" :locked="!model.earned" />
      <div class="honour-card-title">
        <HonourKicker :metal="model.definition.metal" :text="model.kicker" />
        <h3>
          <!-- The whole card opens the detail; the link below stays a separate target. -->
          <button class="honour-card-open" type="button" @click="$emit('open', model.id)">
            {{ model.name
            }}<span class="town-sr-only">
              · {{ model.earned ? model.track.text : t('Not yet earned') }}</span
            >
          </button>
        </h3>
      </div>
      <span v-if="isNew || newRank" class="honour-markers">
        <span v-if="isNew" class="honour-new">{{ t('New') }}</span>
        <span v-if="newRank" class="honour-new honour-new-rank">{{ t('New rank') }}</span>
      </span>
    </div>
    <HonourRankTrack :track="model.track" />
    <p class="honour-requirement">{{ model.requirement }}</p>
    <div
      v-if="model.progress || model.chips || model.checks"
      :class="{ 'honour-progress-next': model.nextRank }"
    >
      <p v-if="model.nextRank" class="honour-next-rank">{{ model.nextRank }}</p>
      <HonourProgress :model="model" />
    </div>
    <p v-if="model.mine" class="honour-where">
      {{ model.mine.summary
      }}<template v-if="!model.mine.reached"> · {{ t('not reached yet') }}</template>
    </p>
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
import { t } from '../../i18n';
import HonourBadge from './HonourBadge.vue';
import HonourKicker from './HonourKicker.vue';
import HonourProgress from './HonourProgress.vue';
import HonourRankTrack from './HonourRankTrack.vue';
// One collection card: framed in the metal of its highest earned rank with its date,
// otherwise greyed with a readable requirement; every rank on a track, then progress
// toward the next rank and where to make it.
defineProps({
  model: { type: Object, required: true },
  isNew: Boolean,
  // A rank added by an update since the player last looked at the collection.
  newRank: Boolean,
  links: Boolean,
});
defineEmits(['open', 'link']);
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
  padding-right: 64px;
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
.honour-markers {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  justify-items: end;
  gap: 4px;
}
.honour-new {
  padding: 2px 8px;
  border-radius: 99px;
  background: #9b5a25;
  color: #fffaf0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.honour-new-rank {
  background: #3f6b5a;
}
.honour-progress-next {
  display: grid;
  gap: 6px;
  padding-top: 9px;
  border-top: 1px dashed #d9c58f;
}
.honour-next-rank {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #6b5524;
}
.honour-requirement {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #4f5747;
}
.honour-where {
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
/* The frame follows the highest earned metal; the badge shape and track name it too. */
.honour-card-bronze {
  border-color: #d2a77a;
}
.honour-card-silver {
  border-color: #aab7be;
}
.honour-card-gold {
  border-color: #dcbd6b;
}
.honour-card-diamond {
  border-color: #8fc3d6;
}
.honour-card-bronze,
.honour-card-silver,
.honour-card-gold,
.honour-card-diamond {
  border-top-width: 3px;
  padding-top: 14px;
}
.honour-contrast .honour-card {
  border-color: #626b50;
}
.honour-contrast .honour-card,
.honour-contrast .honour-card .honour-requirement,
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
