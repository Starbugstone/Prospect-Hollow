<template>
  <Transition name="honour-toast">
    <article
      v-if="notice"
      v-show="visible"
      ref="card"
      :key="notice.key"
      class="honour-toast"
      :class="{
        'honour-toast-summary': summary,
        'honour-toast-paused': paused,
        'honour-toast-player': kind === 'player',
      }"
      @pointerenter="hold('hover', true)"
      @pointerleave="hold('hover', false)"
      @focusin="focusIn"
      @focusout="focusOut"
      @keydown.esc="close"
    >
      <div class="honour-toast-art" aria-hidden="true">
        <HonourBadge
          v-for="{ id, definition } in notice.entries.slice(0, 3)"
          :key="id"
          :definition="definition"
          :size="summary ? 46 : 68"
        />
      </div>
      <div class="honour-toast-text">
        <span class="honour-toast-kicker">{{ copy.kicker }}</span>
        <strong class="honour-toast-title">{{ copy.title }}</strong>
        <span class="honour-toast-line">{{ copy.line }}</span>
        <span v-if="copy.promotion" class="honour-toast-promotion">
          <span aria-hidden="true">{{ copy.promotion.visual }}</span>
          <span class="town-sr-only">{{ copy.promotion.spoken }}</span>
        </span>
        <div class="honour-toast-foot">
          <span v-if="!summary && kind === 'town'" class="honour-toast-difficulty">
            <HonourMetalIcon :metal="first.metal" />
            {{ difficultyLabel(first) }}
          </span>
          <button type="button" class="honour-toast-view" @click="view">
            {{ t(summary ? 'View all' : 'Open') }}<span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <button
        type="button"
        class="honour-toast-close"
        :aria-label="t('Dismiss')"
        :title="t('Dismiss')"
        @click="close"
      >
        <span aria-hidden="true">×</span>
      </button>
      <span class="honour-toast-timer" aria-hidden="true"></span>
    </article>
  </Transition>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import { useHonourAnnouncements } from '../../composables/useHonourAnnouncements';
import HonourBadge from './HonourBadge.vue';
import HonourMetalIcon from './HonourMetalIcon.vue';
import {
  difficultyLabel,
  distinctionPopup,
  metalLabel,
  popupText,
  rankName,
} from './honourDisplay';

// One popup card and its own queue: town honours (`town`, the village green) or player
// distinctions (`player`, night violet), so a player reward never reads as a town one.
// Several of the same kind share one card. Non-modal; it never takes focus and pauses
// while hovered or focused.
const props = defineProps({
  active: Boolean,
  kind: { type: String, default: 'town' },
});
const emit = defineEmits(['shown']);
const { notice, visible, paused, hold, dismiss, view } = useHonourAnnouncements(
  () => props.active,
  { kind: props.kind },
);

const summary = computed(() => notice.value?.entries.length > 1);
const first = computed(() => notice.value?.entries[0].definition ?? {});
const names = (entries) => {
  const [a, b] = entries.map(({ definition }) => t(definition.name));
  if (entries.length === 2) return t('{first} and {second}', { first: a, second: b });
  const more = entries.length - 2;
  return t(more === 1 ? '{first}, {second} and 1 more' : '{first}, {second} and {count} more', {
    first: a,
    second: b,
    count: more,
  });
};
// Player distinctions from the server: Alpha Player, or a new time step.
function playerCopy(shown) {
  return shown.entries.length === 1
    ? {
        kicker: t('Player distinction'),
        title: rankName(first.value),
        line: distinctionPopup(first.value),
      }
    : {
        kicker: t('{count} player distinctions', { count: shown.entries.length }),
        title: names(shown.entries),
        line: t('Added to your collection'),
      };
}
const copy = computed(() => {
  const shown = notice.value;
  if (!shown) return {};
  if (props.kind === 'player') return playerCopy(shown);
  const count = shown.entries.length;
  if (count === 1) {
    // A family moving up names both metals: "Bronze → Silver".
    const from = !shown.backfilled && shown.entries[0].from;
    const metals = from && { from: metalLabel(from.metal), to: metalLabel(first.value.metal) };
    return {
      kicker: t(
        shown.backfilled ? 'Honour recorded' : from ? 'New rank earned' : 'Achievement earned',
      ),
      title: rankName(first.value),
      line: shown.backfilled ? t('From your progress so far') : popupText(first.value),
      promotion: metals && {
        visual: `${metals.from} → ${metals.to}`,
        spoken: t('Promoted from {from} to {to}', metals),
      },
    };
  }
  return {
    kicker: t(shown.backfilled ? '{count} honours recorded' : '{count} achievements earned', {
      count,
    }),
    title: names(shown.entries),
    line: t(
      shown.backfilled
        ? 'From your progress so far'
        : shown.fromPuzzle
          ? 'From your last puzzle'
          : 'Added to your collection',
    ),
  };
});

// Keyboard users return to where they were when they close the card.
const card = ref(null);
let returnFocus = null;
function focusIn(event) {
  if (!card.value?.contains(event.relatedTarget)) returnFocus = event.relatedTarget;
  hold('focus', true);
}
function focusOut(event) {
  if (!card.value?.contains(event.relatedTarget)) hold('focus', false);
}
function close() {
  const inside = card.value?.contains(document.activeElement);
  dismiss();
  if (inside && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}
// A card that closes under the pointer or focus never sends leave events.
watch(notice, () => {
  hold('focus', false);
  hold('hover', false);
});
watch(visible, (shown) => shown && emit('shown'), { flush: 'post' });
</script>
