<template>
  <dialog
    ref="dialog"
    class="obstacle-guide"
    :aria-label="t(introduction ? 'New in this mine' : 'Mining guide')"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <header>
      <div>
        <h2>{{ t(introduction ? 'New in this mine' : 'Know your obstacles') }}</h2>
      </div>
      <button
        ref="closeButton"
        class="icon-button"
        :aria-label="t('Close guide')"
        @click="$emit('close')"
      >
        <GameIcon name="close" />
      </button>
    </header>
    <p v-if="!introduction">
      {{
        t(
          'Clear every ice layer and obstacle, and collect all relics. The score and clock earn extra chests.',
        )
      }}
    </p>
    <ul>
      <li v-for="obstacle in obstacles" :key="obstacle.id">
        <div class="obstacle-art">
          <img :src="obstacle.art" alt="" /><b v-if="obstacle.id === 'double-ice'">2</b>
        </div>
        <div>
          <h3>{{ t(obstacle.name) }}</h3>
          <div class="obstacle-demo" aria-hidden="true">
            <template v-if="obstacle.id === 'relic'">
              <img src="/art/relic.svg" alt="" /><b>↓</b
              ><img src="/art/obstacles/exit.svg" alt="" /><b class="demo-check">✓</b>
            </template>
            <template v-else>
              <span class="demo-matches"
                ><span
                  v-for="n in 3"
                  :key="n"
                  :class="{ 'demo-frost': n === 2 && ['ice', 'double-ice'].includes(obstacle.id) }"
                  ><img
                    :src="`/art/${obstacle.id.startsWith('seal-') ? obstacle.id.slice(5) : 'ruby'}.svg`"
                    alt="" /><img
                    v-if="n === 2 && obstacle.id === 'chain'"
                    class="demo-chain"
                    src="/art/obstacles/chain.svg"
                    alt="" /></span
              ></span>
              <img
                v-if="!['ice', 'double-ice', 'chain'].includes(obstacle.id)"
                :src="obstacle.art"
                alt=""
              />
              <b>→</b
              ><span class="demo-check">{{
                ['double-ice', 'reinforced'].includes(obstacle.id) ? '2× ✓' : '✓'
              }}</span>
            </template>
          </div>
          <p>{{ t(obstacle.instruction) }}</p>
        </div>
      </li>
    </ul>
    <p v-if="!introduction">
      {{ t('Match 4 · Blast a 3 × 3 area') }}<br />{{ t('Match 5 · Clear a color') }}<br />{{
        t('T or L · Clear row + column')
      }}
    </p>
    <p v-if="!introduction" class="guide-bonus-note">
      {{
        t(
          'Swipe a bonus gem, or double-tap it to activate in place. A rainbow clears the swapped color, or the most common color when double-tapped. Toolbar powers trigger bonuses they hit; swapping two bonuses creates a fusion.',
        )
      }}
    </p>
    <button v-if="introduction" class="mine-play-button" @click="$emit('close')">
      {{ t('Play') }}
    </button>
  </dialog>
</template>
<script setup>
import { t } from '../i18n';
import GameIcon from './GameIcon.vue';
import { useNativeDialog } from '../composables/useNativeDialog';
defineProps({ obstacles: Array, introduction: Boolean });
const emit = defineEmits(['close']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
</script>
<style scoped>
.obstacle-demo {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin: 7px 0;
  color: #f1d9a5;
}
.obstacle-demo img {
  width: 27px;
  height: 27px;
  object-fit: contain;
}
.demo-matches {
  display: flex;
  padding: 3px;
  border: 1px solid #b8c0a0;
  border-radius: 7px;
  background: #493452;
}
.demo-matches > span {
  position: relative;
  display: flex;
  border-radius: 4px;
}
.demo-chain {
  position: absolute;
  inset: 0;
}
.demo-matches .demo-frost {
  background: #afdcea;
  box-shadow: 0 0 0 2px #e0f6ff;
}
.obstacle-demo .demo-check {
  color: #bce5a6;
  font-weight: 800;
  font-size: 20px;
}
.obstacle-guide {
  width: min(560px, calc(100% - 24px));
  max-height: 85dvh;
  padding: 24px;
  border: 1px solid #927db1;
  border-radius: 18px;
  color: #eee5ff;
  background: #211831;
  box-shadow: 0 24px 90px #0008;
}
.obstacle-guide::backdrop {
  background: #0b081bc9;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
h2 {
  margin: 8px 0;
  font-size: 24px;
}
p {
  font-size: 13px;
  line-height: 1.6;
  color: #cbbddc;
}
ul {
  list-style: none;
  padding: 0;
  margin: 18px 0;
}
li {
  display: flex;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #86739740;
}
h3 {
  margin: 0;
  font-size: 16px;
}
li p {
  margin: 6px 0 0;
}
.obstacle-art {
  position: relative;
  flex: 0 0 64px;
  height: 64px;
  background: #110d21;
  border-radius: 9px;
}
.obstacle-art img {
  width: 100%;
  height: 100%;
}
.obstacle-art b {
  position: absolute;
  right: 0;
  bottom: 0;
  background: #e0f4ff;
  color: #263749;
  padding: 2px 6px;
  border-radius: 5px;
}
</style>
