<template>
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
        @click="!readOnly && $emit('play', id)"
      >
        <span class="museum-level-number">{{ String(id).padStart(2, '0') }}</span>
        <img :src="`/art/${gems[index % gems.length]}.svg`" alt="" />
        <strong>{{ t(LEVEL_NAMES[id - 1]) }}</strong>
        <span v-if="continuous" class="museum-stars">∞</span>
        <span
          v-else-if="records[id]"
          class="museum-stars"
          :aria-label="t('{value0} of 3 stars', { value0: records[id].stars })"
          >{{ '✦'.repeat(records[id].stars) }}{{ '✧'.repeat(3 - records[id].stars) }}</span
        >
        <small v-else>{{ t('Not completed yet') }}</small>
        <slot :id="id" />
        <span v-if="!readOnly" class="museum-play"
          >{{ t(continuous ? 'Keep matching' : 'Play again') }} →</span
        >
      </component>
    </div>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { t } from '../../i18n';
import { CHAPTERS, LEVEL_COUNT } from '../../data/campaign';
import { chapterLevelIds } from '../../data/chapters';
import { LEVEL_NAMES } from '../../data/levelNames';
const props = defineProps({
  levelIds: { type: Array, required: true },
  records: { type: Object, required: true },
  readOnly: Boolean,
  continuous: Boolean,
});
defineEmits(['play']);
const chapters = computed(() => {
  const visible = new Set(props.levelIds);
  return CHAPTERS.map((chapter, index) => ({
    chapter,
    index,
    ids: chapterLevelIds(index).filter((id) => id <= LEVEL_COUNT && visible.has(id)),
  })).filter(({ ids }) => ids.length);
});
const gems = ['emerald', 'sapphire', 'topaz', 'amethyst', 'ruby', 'moonstone'];
</script>
