<template>
  <section v-if="model" class="honour-detail" :data-honour="model.id">
    <HonourBadge :definition="model.definition" :size="112" :locked="!model.earned" />
    <HonourKicker
      :metal="model.definition.metal"
      :text="`${model.kicker} · ${t(TAB_LABELS[model.tab])}`"
    />
    <h2>{{ model.name }}</h2>
    <HonourRankTrack class="honour-detail-track" :track="model.track" />
    <!-- The ladder: every rank, its date once earned, progress on the next one. -->
    <ol class="honour-detail-ranks" :aria-label="t('Ranks')">
      <li
        v-for="rank in model.ranks"
        :key="rank.id"
        :class="{ 'is-earned': rank.earned, 'is-next': rank.next }"
        :data-rank="rank.definition.metal"
      >
        <HonourBadge :definition="rank.definition" :size="40" :locked="!rank.earned" />
        <span class="honour-detail-rank">
          <HonourKicker
            :metal="rank.definition.metal"
            :text="`${rank.metal} · ${rank.difficulty}`"
          />
          <strong>{{ rank.name }}</strong>
          <small>{{ rank.requirement }}</small>
          <small v-if="rank.earned" class="honour-earned"
            ><span v-if="rank.earned.dated" aria-hidden="true">✓ </span>{{ rank.earned.text
            }}<template v-if="rank.earned.evidence"> · {{ rank.earned.evidence }}</template></small
          >
          <small v-else-if="rank.next" class="honour-detail-next">{{ t('Next rank') }}</small>
          <small v-else>{{ t('Not yet earned') }}</small>
        </span>
        <HonourProgress
          v-if="rank.next && (model.progress || model.chips || model.checks)"
          class="honour-detail-progress"
          :class="{ 'honour-progress-next': model.earned }"
          :model="model"
        />
      </li>
    </ol>
    <p v-if="best" class="honour-detail-note">
      {{ t('Best run so far: {run}', { run: evidenceText(best) }) }}
    </p>
    <div v-if="model.mine" class="honour-where-box">
      <h3>{{ t('Where to make progress') }}</h3>
      <ul>
        <li>{{ model.mine.summary }}</li>
        <li>
          {{
            model.mine.reached
              ? model.mine.completed
              : t('Not reached yet: these levels are further into the mine.')
          }}
        </li>
        <li>{{ t('Completed puzzles count, including museum replays.') }}</li>
      </ul>
    </div>
    <button
      v-if="links && model.link"
      class="town-primary"
      type="button"
      @click="$emit('link', model)"
    >
      {{ model.link.label }} <span aria-hidden="true">→</span>
    </button>
    <button
      class="town-secondary"
      type="button"
      :disabled="!model.earned || (full && !showcased)"
      @click="toggleShowcase"
    >
      {{ t(showcased ? 'Remove from showcase' : 'Add to showcase') }}
    </button>
    <p class="honour-detail-hint" role="status">{{ hint }}</p>
  </section>
</template>
<script setup>
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import { useCampaignStore } from '../../stores/campaignStore';
import { SHOWCASE_SLOTS, bestScoreRun, honourCollection } from '../../data/honours';
import { usePlayerDistinctions } from '../../composables/usePlayerDistinctions';
import HonourBadge from './HonourBadge.vue';
import HonourKicker from './HonourKicker.vue';
import HonourProgress from './HonourProgress.vue';
import HonourRankTrack from './HonourRankTrack.vue';
import { TAB_LABELS, describeFamily, evidenceText } from './honourDisplay';
// The player's own honour in detail: the ladder of ranks with each metal, requirement,
// date and score evidence, progress toward the next rank, where to progress and the
// showcase choice.
const props = defineProps({
  familyId: { type: String, required: true },
  links: Boolean,
  canTravel: Boolean,
});
defineEmits(['link']);
const campaign = useCampaignStore();
const family = computed(() =>
  honourCollection(campaign)
    .flatMap((tab) => tab.families)
    .find((entry) => entry.id === props.familyId),
);
const model = computed(
  () =>
    family.value &&
    describeFamily(family.value, campaign, {
      canReplay: campaign.canReplay,
      canTravel: props.canTravel,
    }),
);
const best = computed(() =>
  model.value?.definition.measure.kind === 'score' && family.value.next
    ? bestScoreRun(campaign.records)
    : null,
);
const { showcase, saveShowcase } = usePlayerDistinctions({ campaign });
const showcased = computed(() => showcase.value.includes(props.familyId));
const full = computed(() => showcase.value.length >= SHOWCASE_SLOTS);
const saved = ref('');
const hint = computed(() => {
  if (saved.value) return saved.value;
  if (!model.value?.earned) return t('Earn this honour to show it to visitors.');
  if (full.value && !showcased.value)
    return t('Your showcase is full. Remove an honour from it to add this one.');
  return t(
    showcased.value
      ? 'Visitors see this honour beside your town name.'
      : 'Show this honour to visitors beside your town name.',
  );
});
function toggleShowcase() {
  const adding = !showcased.value;
  const next = adding
    ? [...showcase.value, props.familyId]
    : showcase.value.filter((id) => id !== props.familyId);
  saved.value = saveShowcase(next)
    ? t(adding ? 'Added to your showcase.' : 'Removed from your showcase.')
    : t('Your showcase could not be saved.');
}
</script>
<style>
.honour-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  color: #3f5545;
}
.honour-detail h2 {
  margin: 0;
  font:
    400 28px/1.15 Georgia,
    serif;
}
.honour-detail-note {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: #4a5346;
}
.honour-detail-track {
  align-self: stretch;
  justify-content: center;
}
.honour-detail-progress {
  grid-column: 2;
  text-align: left;
}
.honour-detail-progress .honour-bar {
  height: 10px;
}
.honour-detail-progress .honour-progress-text {
  font-size: 13px;
  text-align: center;
}
.honour-detail-ranks {
  display: grid;
  gap: 8px;
  align-self: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
}
.honour-detail-ranks li {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 8px 10px;
  padding: 8px 10px;
  border: 1px solid #e0d9c4;
  border-radius: 10px;
  background: #f6f4ea;
}
.honour-detail-ranks li.is-earned {
  background: #fffcf2;
}
.honour-detail-ranks li.is-next {
  border-style: dashed;
  border-color: #c9b278;
}
.honour-detail-rank {
  display: grid;
  gap: 1px;
  font-size: 13px;
}
.honour-detail-ranks small.honour-detail-next {
  font-weight: 700;
  color: #6b5524;
}
.honour-detail-ranks small {
  font-size: 12px;
  color: #4f5747;
}
.honour-detail-ranks small.honour-earned {
  margin: 0;
  padding: 0;
  color: #6f5317;
}
.honour-where-box {
  align-self: stretch;
  padding: 12px 14px;
  border: 1px solid #ded9c8;
  border-radius: 10px;
  background: #f3f1e3;
  text-align: left;
}
.honour-where-box h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
}
.honour-where-box ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.5;
  color: #4a5346;
}
.honour-detail .town-primary,
.honour-detail .town-secondary {
  min-height: 47px;
}
.honour-detail .town-secondary {
  color: #3f5c3d;
}
.honour-detail button:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 3px;
}
.honour-detail-hint {
  min-height: 1.5em;
  margin: 0;
  font-size: 12px;
  color: #555c4c;
}
.honour-contrast .honour-detail-note,
.honour-contrast .honour-where-box ul,
.honour-contrast .honour-detail-hint {
  color: #253f2f;
}
.honour-contrast .honour-where-box,
.honour-contrast .honour-detail-ranks li {
  border-color: #626b50;
}
</style>
