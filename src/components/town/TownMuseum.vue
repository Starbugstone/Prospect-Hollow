<template>
  <dialog
    ref="dialog"
    class="town-museum"
    aria-labelledby="museum-title"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <div class="museum-heading">
      <div>
        <p class="town-kicker">{{ t('PROSPECT HOLLOW · THE COLLECTION') }}</p>
        <h2 id="museum-title">{{ t('The Frontier Museum') }}</h2>
        <p>{{ t('Revisit a discovery. Set a new personal best.') }}</p>
      </div>
      <button
        ref="closeButton"
        class="town-secondary"
        :aria-label="t('Close museum')"
        @click="$emit('close')"
      >
        ×
      </button>
    </div>
    <div class="museum-modes" role="group" :aria-label="t('Choose a museum mode')">
      <button :aria-pressed="mode === 'normal'" @click="mode = 'normal'">
        {{ t('Replay levels') }}</button
      ><button :aria-pressed="mode === 'continuous'" @click="mode = 'continuous'">
        ∞ {{ t('Continuous play') }}
      </button>
    </div>
    <p class="museum-mode-note" role="status">
      {{
        t(
          mode === 'normal'
            ? 'Replay completed puzzles for better scores, stars, and chests. Each completion advances your construction.'
            : 'Play any unlocked level without stopping at the objectives. No chests or construction progress. Earn 1 coin per 10 jewels, up to 25 coins per level across all continuous visits. Your best continuous score is saved separately.',
        )
      }}
    </p>
    <div v-if="mode === 'normal'" class="museum-completion">
      <p role="status">
        <strong>✦ {{ t('{perfect}/{total} levels at three stars', campaign.completion) }}</strong>
        <span>{{
          t(
            campaign.completion.remaining === 1
              ? '1 level left to perfect'
              : '{count} levels left to perfect',
            { count: campaign.completion.remaining },
          )
        }}</span>
      </p>
      <label class="museum-filter">
        <input v-model="needsStars" type="checkbox" />
        {{ t('Below three stars only') }}
      </label>
      <p v-if="needsStars && campaign.completion.unplayed" class="museum-unplayed">
        {{
          t(
            campaign.completion.unplayed === 1
              ? '1 level still awaits its first completion at the mine.'
              : '{count} levels still await their first completion at the mine.',
            {
              count: campaign.completion.unplayed,
            },
          )
        }}
      </p>
    </div>
    <p
      v-if="mode === 'normal' && needsStars && !campaign.completion.replayIds.length"
      class="museum-empty"
      role="status"
    >
      {{
        t(
          campaign.completion.complete
            ? 'Every level has three stars. Your collection is 100% complete!'
            : 'Every completed level has three stars. Continue at the mine to discover the rest.',
        )
      }}
    </p>
    <p v-else-if="!campaign.completedCount && mode === 'normal'" class="museum-empty">
      {{
        t('Your first display is waiting. Complete a puzzle at the mine, then return to replay it.')
      }}
    </p>
    <section
      v-for="(chapter, index) in CHAPTERS"
      :key="chapter.name"
      v-show="chapterLevels(index).length"
      class="museum-chapter"
    >
      <h3>
        <span>{{ String(index + 1).padStart(2, '0') }}</span
        >{{ t(chapter.name) }}
      </h3>
      <div class="museum-grid">
        <button
          v-for="id in chapterLevels(index)"
          :key="id"
          :aria-label="
            t(
              mode === 'normal'
                ? 'Replay level {level}: {name}'
                : 'Continuous play, level {level}: {name}',
              { level: id, name: t(LEVEL_NAMES[id - 1]) },
            )
          "
          @click="mode === 'normal' ? $emit('replay', id) : $emit('continuous', id)"
        >
          <span class="museum-level-number">{{ String(id).padStart(2, '0') }}</span
          ><img :src="`/art/${gems[index % gems.length]}.svg`" alt="" /><strong>{{
            t(LEVEL_NAMES[id - 1])
          }}</strong>
          <template v-if="mode === 'normal'"
            ><span
              class="museum-stars"
              :aria-label="t('{value0} of 3 stars', { value0: campaign.records[id].stars })"
              >{{ '✦'.repeat(campaign.records[id].stars)
              }}{{ '✧'.repeat(3 - campaign.records[id].stars) }}</span
            ><small>{{
              t('Best score: {score}', { score: number(campaign.records[id].score) })
            }}</small
            ><small v-if="campaign.records[id].bestTimeMs">{{
              t('Best time: {time}', { time: formatTime(campaign.records[id].bestTimeMs) })
            }}</small></template
          >
          <template v-else
            ><span class="museum-stars">∞</span
            ><small>{{
              t('Best score: {score}', {
                score: number(campaign.continuousRecords[id]?.score ?? 0),
              })
            }}</small
            ><small>{{
              t('{earned}/{cap} coins collected', {
                earned: campaign.continuousRecords[id]?.coins ?? 0,
                cap: CONTINUOUS_COIN_CAP,
              })
            }}</small></template
          >
          <span class="museum-play"
            >{{ t(mode === 'normal' ? 'Play again' : 'Keep matching') }} →</span
          >
        </button>
      </div>
    </section>
  </dialog>
</template>
<script setup>
import { ref } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { t, number } from '../../i18n';
import { useCampaignStore } from '../../stores/campaignStore';
import { CHAPTERS, LEVEL_COUNT, formatTime } from '../../data/campaign';
import { LEVEL_NAMES } from '../../data/levelNames';
import { CONTINUOUS_COIN_CAP } from '../../data/rewards';
const emit = defineEmits(['close', 'replay', 'continuous']);
const campaign = useCampaignStore();
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const mode = ref('normal');
const needsStars = ref(false);
const chapterLevels = (index) =>
  Array.from({ length: 6 }, (_, i) => index * 6 + i + 1).filter(
    (id) =>
      id <= LEVEL_COUNT &&
      (mode.value === 'continuous'
        ? campaign.isUnlocked(id)
        : campaign.records[id] && (!needsStars.value || campaign.records[id].stars < 3)),
  );
const gems = ['emerald', 'sapphire', 'topaz', 'amethyst', 'ruby', 'moonstone'];
</script>
