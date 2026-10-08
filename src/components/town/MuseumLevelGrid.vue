<template>
  <p v-if="legend.length" class="museum-legend">
    <span>{{ t('Elements:') }}</span>
    <span v-for="element in legend" :key="element.id"
      ><img :src="element.art" alt="" />{{ t(element.label) }}</span
    >
  </p>
  <section v-for="{ chapter, index, ids } in chapters" :key="chapter.name" class="museum-chapter">
    <h3>
      <span>{{ String(index + 1).padStart(2, '0') }}</span
      >{{ t(chapter.name) }}
    </h3>
    <div class="museum-grid">
      <component
        :is="readOnly ? 'article' : 'button'"
        v-for="id in ids"
        :key="id"
        class="museum-level"
        :aria-label="
          t(
            readOnly
              ? 'Level {level}: {name}'
              : continuous
                ? 'Continuous play, level {level}: {name}'
                : 'Replay level {level}: {name}',
            { level: id, name: t(LEVEL_NAMES[id - 1]) },
          )
        "
        :aria-describedby="readOnly ? undefined : describedBy(id)"
        @click="!readOnly && $emit('play', id)"
      >
        <span class="museum-level-number">{{ String(id).padStart(2, '0') }}</span>
        <span v-if="elements[id]" :id="`${uid}-${id}-elements`" class="museum-level-elements">
          <img
            v-for="element in elements[id]"
            :key="element.id"
            :src="element.art"
            :alt="t(element.label)"
            :title="t(element.label)"
          />
        </span>
        <img :src="`/art/${cardGem(id, index)}.svg`" alt="" />
        <strong>{{ t(LEVEL_NAMES[id - 1]) }}</strong>
        <span v-if="continuous" class="museum-stars">∞</span>
        <span
          v-else-if="records[id]"
          :id="`${uid}-${id}-stars`"
          class="museum-stars"
          role="img"
          :aria-label="t('{value0} of 3 stars', { value0: records[id].stars })"
          >{{ '✦'.repeat(records[id].stars) }}{{ '✧'.repeat(3 - records[id].stars) }}</span
        >
        <small v-else>{{ t('Not completed yet') }}</small>
        <span :id="`${uid}-${id}-about`" class="museum-level-about"><slot :id="id" /></span>
        <span v-if="!readOnly" class="museum-play"
          >{{ t(continuous ? 'Keep matching' : 'Play again') }} →</span
        >
      </component>
    </div>
  </section>
</template>
<script setup>
import { computed, useId } from 'vue';
import { t } from '../../i18n';
import { CHAPTERS, LEVEL_COUNT, getLevelGemTypes } from '../../data/campaign';
import { chapterLevelIds } from '../../data/chapters';
import { LEVEL_NAMES } from '../../data/levelNames';
import { MINE_ELEMENTS, elementArt } from '../../data/honours';
import { levelHonourElements } from '../../data/honourLevels';
const props = defineProps({
  levelIds: { type: Array, required: true },
  records: { type: Object, required: true },
  readOnly: Boolean,
  continuous: Boolean,
});
defineEmits(['play']);
const uid = `museum-${useId()}`;
const chapters = computed(() => {
  const visible = new Set(props.levelIds);
  return CHAPTERS.map((chapter, index) => ({
    chapter,
    index,
    ids: chapterLevelIds(index).filter((id) => id <= LEVEL_COUNT && visible.has(id)),
  })).filter(({ ids }) => ids.length);
});
const gems = ['emerald', 'sapphire', 'topaz', 'amethyst', 'ruby', 'moonstone'];
// From the floating seam on, a card shows one of the level's own later gems.
const cardGem = (id, index) =>
  id > 402 ? getLevelGemTypes(id)[3 + (index % 2)] : gems[index % gems.length];
// Mine mastery elements per level, in registry order, from the generated index.
const ELEMENTS = MINE_ELEMENTS.map((element) => ({ ...element, art: elementArt(element) }));
const elements = computed(() =>
  Object.fromEntries(
    props.levelIds
      .map((id) => [id, ELEMENTS.filter((element) => levelHonourElements(id)[element.id] > 0)])
      .filter(([, list]) => list.length),
  ),
);
// A button's content is not read out, so its stars, elements and details describe it.
const describedBy = (id) =>
  [!props.continuous && props.records[id] && 'stars', elements.value[id] && 'elements', 'about']
    .filter(Boolean)
    .map((part) => `${uid}-${id}-${part}`)
    .join(' ');
const legend = computed(() => {
  const shown = new Set(Object.values(elements.value).flat());
  return ELEMENTS.filter((element) => shown.has(element));
});
</script>
