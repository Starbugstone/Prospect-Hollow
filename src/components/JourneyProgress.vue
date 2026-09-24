<template>
  <div
    v-if="journey"
    class="journey-trail"
    :aria-label="t('Chapter gift in {count} puzzles', { count: journey.remaining })"
  >
    <div class="journey-promise">
      <span>{{
        journey.remaining === 1
          ? t('Chapter reward in 1 puzzle')
          : t('Chapter reward in {count} puzzles', { count: journey.remaining })
      }}</span>
    </div>
    <div class="journey-stamps" aria-hidden="true">
      <i v-for="level in journey.levels" :key="level.id" :class="{ complete: level.complete }"></i>
    </div>
    <img :src="rewardArt(journey.gift)" :alt="t(journey.gift.label)" />
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { t } from '../i18n';
import { useCampaignStore } from '../stores/campaignStore';
import { journeyProgress } from '../data/journey';
import { rewardArt } from '../data/rewards';
const campaign = useCampaignStore();
const journey = computed(() => journeyProgress(campaign.records));
</script>
<style scoped>
.journey-trail {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0 2px;
  color: inherit;
}
.journey-promise {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-right: auto;
}
.journey-promise > svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.journey-promise > svg:nth-child(2) {
  width: 12px;
}
.journey-promise span {
  font-size: 11px;
  font-weight: 700;
  margin-left: 5px;
}
.journey-promise small {
  display: block;
  font-size: 9px;
  font-weight: 400;
  margin-top: 2px;
}
.journey-stamps {
  display: flex;
  gap: 3px;
}
.journey-stamps i {
  display: grid;
  place-items: center;
  width: 16px;
  height: 8px;
  border: 1px solid currentColor;
  border-radius: 5px;
  font: 800 12px sans-serif;
  opacity: 0.45;
}
.journey-stamps i.complete {
  background: #64866a;
  color: #fff6dc;
  border: 1px solid #64866a;
  opacity: 1;
}
.journey-trail > img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}
@media (max-width: 420px) {
  .journey-trail {
    gap: 6px;
  }
  .journey-promise > svg:first-child,
  .journey-promise > svg:nth-child(2) {
    display: none;
  }
  .journey-promise span {
    font-size: 9px;
  }
  .journey-promise small {
    font-size: 8px;
  }
  .journey-stamps i {
    width: 13px;
    height: 8px;
  }
  .journey-trail > img {
    width: 27px;
    height: 27px;
  }
}
@media (max-height: 500px) and (min-width: 480px) {
  .journey-trail {
    display: none;
  }
}
</style>
