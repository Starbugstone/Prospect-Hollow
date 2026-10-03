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
      <p class="museum-progress" role="status">
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
      <div class="museum-show">
        <span id="museum-show-label" class="museum-show-label">{{ t('Show') }}</span>
        <div class="museum-show-options" role="group" aria-labelledby="museum-show-label">
          <button :aria-pressed="show === 'all'" @click="show = 'all'">
            {{ t('All completed') }} <b>{{ number(completedIds.length) }}</b>
          </button>
          <button
            :aria-pressed="show === 'below'"
            :aria-label="
              t('Below three stars, {count} levels', {
                count: number(campaign.completion.replayIds.length),
              })
            "
            @click="show = 'below'"
          >
            {{ t('Below ✦✦✦') }} <b>{{ number(campaign.completion.replayIds.length) }}</b>
          </button>
          <button v-if="selected" :aria-pressed="show === 'honour'" @click="show = 'honour'">
            {{ t('For an honour') }}
          </button>
        </div>
        <label v-if="show === 'honour' && selected" class="museum-honour-picker">
          <HonourBadge :definition="selected.definition" :size="30" />
          <select v-model="picked" :aria-label="t('Honour')">
            <option v-for="option in honourOptions" :key="option.id" :value="option.id">
              {{ optionLabel(option) }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="show === 'honour' && selected" class="museum-honour-note" role="status">
        <span aria-hidden="true">◆ </span>{{ honourNote }}
      </p>
      <p v-else-if="show === 'below' && campaign.completion.unplayed" class="museum-unplayed">
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
      v-if="mode === 'normal' && showsStars && !campaign.completion.replayIds.length"
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
    <MuseumLevelGrid
      :level-ids="visibleLevels"
      :records="campaign.records"
      :continuous="mode === 'continuous'"
      @play="mode === 'normal' ? $emit('replay', $event) : $emit('continuous', $event)"
    >
      <template #default="{ id }">
        <template v-if="mode === 'normal'">
          <small>{{
            t('Best score: {score}', { score: number(campaign.records[id].score) })
          }}</small>
          <small v-if="campaign.records[id].bestTimeMs">{{
            t('Best time: {time}', { time: formatTime(campaign.records[id].bestTimeMs) })
          }}</small>
          <template v-if="show === 'honour' && selected">
            <span
              v-for="tag in honourTags(id)"
              :key="tag.text"
              class="museum-tag"
              :class="{ 'museum-tag-secondary': tag.secondary }"
              ><span aria-hidden="true">{{ `${tag.glyph} ` }}</span
              >{{ tag.text }}</span
            >
          </template>
        </template>
        <template v-else>
          <small>{{
            t('Best score: {score}', { score: number(campaign.continuousRecords[id]?.score ?? 0) })
          }}</small>
          <small>{{
            t('{earned}/{cap} coins collected', {
              earned: campaign.continuousRecords[id]?.coins ?? 0,
              cap: CONTINUOUS_COIN_CAP,
            })
          }}</small>
        </template>
      </template>
    </MuseumLevelGrid>
  </dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import MuseumLevelGrid from './MuseumLevelGrid.vue';
import HonourBadge from '../honours/HonourBadge.vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { useHonourNavigation } from '../../composables/useHonourNavigation';
import { t, number } from '../../i18n';
import { useCampaignStore } from '../../stores/campaignStore';
import { LEVEL_COUNT, formatTime } from '../../data/campaign';
import { CONTINUOUS_COIN_CAP } from '../../data/rewards';
import { HONOURS, MINE_ELEMENTS, SCORE_FROM_LEVEL } from '../../data/honours';
import { levelHonourElements } from '../../data/honourLevels';
import { getLevelStarTarget } from '../../data/starRating';
const emit = defineEmits(['close', 'replay', 'continuous']);
const campaign = useCampaignStore();
const navigation = useHonourNavigation();
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const mode = ref('normal');
const show = ref('all');
const familyId = ref(null);
const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, index) => index + 1);

// Honours a replay advances, by their registry link: which levels qualify for each.
const QUALIFIES = {
  'museum-element': (definition, id) => levelHonourElements(id)[definition.element] > 0,
  'museum-stars': () => true,
  'museum-score': (definition, id) => id >= SCORE_FROM_LEVEL && getLevelStarTarget(id, null) > 0,
};
const LINKS = Object.keys(QUALIFIES);
const linkOf = (family) => family.ranks[0].link;
const LINKED = HONOURS.families
  .filter((family) => LINKS.includes(linkOf(family)))
  .sort((a, b) => LINKS.indexOf(linkOf(a)) - LINKS.indexOf(linkOf(b)));
// Tag wording per mine element; one without its own wording shows its label and count.
const ELEMENT_COUNTS = {
  relics: ['1 relic', '{count} relics'],
  lanterns: ['1 lantern', '{count} lanterns'],
  surveys: ['1 survey trail', '{count} survey trails'],
  oreOrders: ['1 ore order', '{count} ore orders'],
  cores: ['1 charge core', '{count} charge cores'],
  gates: ['1 blast gate', '{count} blast gates'],
};
function elementCount(elementId, count) {
  const forms = ELEMENT_COUNTS[elementId];
  if (forms) return t(forms[count === 1 ? 0 : 1], { count: number(count) });
  const label = MINE_ELEMENTS.find((element) => element.id === elementId)?.label ?? elementId;
  return t('{label}: {count}', { label: t(label), count: number(count) });
}

// Unfinished honours only, each at its next rank. A deep-linked honour that is
// already earned stays selectable, marked as earned.
const honourOptions = computed(() =>
  LINKED.map((family) => {
    const next = family.ranks.find((definition) => !campaign.honours.earned[definition.id]);
    if (next)
      return {
        id: family.id,
        link: linkOf(family),
        definition: next,
        progress: next.progress({ records: campaign.records, honours: campaign.honours }),
      };
    return family.id === familyId.value
      ? { id: family.id, link: linkOf(family), definition: family.ranks.at(-1), earned: true }
      : null;
  }).filter(Boolean),
);
const selected = computed(
  () =>
    honourOptions.value.find((option) => option.id === familyId.value) ?? honourOptions.value[0],
);
const picked = computed({
  get: () => selected.value?.id,
  set: (id) => (familyId.value = id),
});
const starsOption = computed(() =>
  honourOptions.value.find((option) => option.link === 'museum-stars' && !option.earned),
);
const showsStars = computed(
  () =>
    show.value === 'below' || (show.value === 'honour' && selected.value?.link === 'museum-stars'),
);
function optionLabel(option) {
  const name = t(option.definition.name);
  if (option.earned) return t('{honour} · earned', { honour: name });
  const { value, goal } = option.progress;
  return option.link === 'museum-score'
    ? `${name} · ${number(value)}× / ${number(goal)}×`
    : `${name} · ${number(value)}/${number(goal)}`;
}
const advances = (option, id) =>
  QUALIFIES[option.link](option.definition, id) &&
  (option.link !== 'museum-stars' || campaign.records[id].stars < 3);

const completedIds = computed(() => LEVELS.filter((id) => campaign.records[id]));
const visibleLevels = computed(() => {
  if (mode.value === 'continuous') return LEVELS.filter((id) => campaign.isUnlocked(id));
  if (show.value === 'below') return campaign.completion.replayIds;
  if (show.value === 'honour' && selected.value)
    return completedIds.value.filter((id) => advances(selected.value, id));
  return completedIds.value;
});

// Replay lists completed levels only, so the note also counts those still ahead.
const honourNote = computed(() => {
  const option = selected.value;
  const qualifying = LEVELS.filter((id) => QUALIFIES[option.link](option.definition, id));
  const done = qualifying.filter((id) => campaign.records[id]).length;
  const ahead = qualifying.length - done;
  const lines = [
    t('{honour}: {done} of {total} levels completed.', {
      honour: t(option.definition.name),
      done: number(done),
      total: number(qualifying.length),
    }),
  ];
  if (option.link === 'museum-element') lines.push(t('Each replay you complete counts again.'));
  if (option.link === 'museum-score')
    lines.push(t('Levels from {level} onward count.', { level: SCORE_FROM_LEVEL }));
  if (ahead)
    lines.push(
      t(
        ahead === 1
          ? '1 more level is still ahead at the mine.'
          : '{count} more levels are still ahead at the mine.',
        { count: number(ahead) },
      ),
    );
  return lines.join(' ');
});
function honourTags(id) {
  const option = selected.value;
  const record = campaign.records[id];
  const tags = [];
  if (option.link === 'museum-element')
    tags.push({
      glyph: '◆',
      text: `${t(option.definition.name)} · ${elementCount(
        option.definition.element,
        levelHonourElements(id)[option.definition.element],
      )}`,
    });
  if (option.link === 'museum-score')
    tags.push({
      glyph: '◆',
      text: t('{rank} at {target} · your best {score}', {
        rank: t(option.definition.name),
        target: number(getLevelStarTarget(id, null) * option.definition.params().multiple),
        score: number(record.score),
      }),
    });
  if (starsOption.value && record.stars < 3)
    tags.push({
      glyph: '✦',
      text: `${t(starsOption.value.definition.name)} · ${t('needs 3 stars')}`,
      secondary: option.link !== 'museum-stars',
    });
  return tags;
}

// The collection or a popup can ask for the museum pre-filtered for one honour.
watch(
  () => navigation.requests.museum,
  (request) => {
    if (!request) return;
    if (LINKED.some((family) => family.id === request.familyId)) {
      mode.value = 'normal';
      show.value = 'honour';
      familyId.value = request.familyId;
    }
    navigation.clearMuseumRequest();
  },
  { immediate: true },
);
</script>
