<template>
  <div class="admin-editable" :class="{ editing }">
    <dt>{{ label }}</dt>
    <dd v-if="!editing">
      <span>{{ whole(value) }}</span>
      <small v-if="saved" class="admin-editable-saved" role="status">Saved</small>
      <button
        v-if="field"
        type="button"
        class="admin-icon-button"
        :aria-label="`Edit ${label}`"
        :title="`Edit ${label}`"
        @click="open"
      >
        ✎
      </button>
    </dd>
    <dd v-else>
      <form class="admin-editable-form" novalidate @submit.prevent="submit" @keydown.esc="close">
        <input
          ref="input"
          v-model="typed"
          inputmode="numeric"
          autocomplete="off"
          :aria-label="`New ${label}`"
          :aria-invalid="Boolean(error)"
          :disabled="busy"
        />
        <button
          class="admin-icon-button confirm"
          :disabled="busy"
          :aria-label="`Save ${label}`"
          title="Save (Enter)"
        >
          ✓
        </button>
        <button
          type="button"
          class="admin-icon-button"
          :disabled="busy"
          aria-label="Cancel"
          title="Cancel (Esc)"
          @click="close"
        >
          ✕
        </button>
      </form>
      <small v-if="error" class="admin-editable-error" role="alert">{{ error }}</small>
      <small v-else>{{ hint }}</small>
    </dd>
  </div>
</template>
<script setup>
import { computed, nextTick, ref } from 'vue';
import { whole } from '../format';
import { typedValue, validValue } from '../inventory';
// A fact with a pencil for support's quick fixes; without a field it is read only.
const props = defineProps({
  label: { type: String, required: true },
  value: Number,
  field: Object,
  // Resolves false when the admin backs out (the online-player warning).
  beforeEdit: { type: Function, default: async () => true },
  save: { type: Function, required: true },
});
const editing = ref(false),
  typed = ref(''),
  error = ref(''),
  busy = ref(false),
  saved = ref(false),
  input = ref(null);
let savedTimer;
// The coin ceiling is technical, not a limit worth showing.
const shownMax = computed(() => (props.field.max < 1e6 ? whole(props.field.max) : ''));
const hint = computed(() =>
  [shownMax.value && `0 to ${shownMax.value}`, props.field.note, 'Enter saves · Esc cancels']
    .filter(Boolean)
    .join(' · '),
);
async function open() {
  if (!(await props.beforeEdit())) return;
  typed.value = String(props.field.current);
  error.value = '';
  saved.value = false;
  editing.value = true;
  await nextTick();
  input.value?.select();
}
function close() {
  if (!busy.value) editing.value = false;
}
async function submit() {
  const value = typedValue(typed.value);
  if (!validValue(props.field, value)) {
    error.value = shownMax.value
      ? `Enter a whole number from 0 to ${shownMax.value}.`
      : 'Enter a whole number, 0 or more.';
    return;
  }
  if (value === props.field.current) return close();
  busy.value = true;
  error.value = '';
  try {
    await props.save(props.field, value);
    editing.value = false;
    saved.value = true;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (saved.value = false), 6000);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
    if (editing.value) nextTick(() => input.value?.focus());
  }
}
</script>
