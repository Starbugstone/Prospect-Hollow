<template>
  <div v-if="sheet" class="town-sheet-scrim" aria-hidden="true" @click="$emit('close')"></div>
  <dialog
    ref="dialog"
    class="town-dialog"
    :class="{ 'town-sheet': sheet }"
    :aria-label="title"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <header class="town-dialog-heading">
      <span>{{ title }}</span>
      <button
        ref="closeButton"
        class="town-dialog-close"
        :aria-label="t(closeLabel)"
        @click="$emit('close')"
      >
        ×
      </button>
    </header>
    <div class="town-dialog-content"><slot /></div>
  </dialog>
</template>
<script setup>
import { useNativeDialog } from '../../composables/useNativeDialog';
import { t } from '../../i18n';
const props = defineProps({
  title: String,
  closeLabel: { type: String, default: 'Close building details' },
  // A sheet sits above the village tab bar and leaves it usable.
  sheet: Boolean,
});
const emit = defineEmits(['close']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'), {
  modal: !props.sheet,
});
</script>
