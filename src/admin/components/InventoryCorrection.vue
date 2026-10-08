<template>
  <form class="admin-correction" @submit.prevent>
    <label
      v-for="field in fields"
      :key="field.key"
      :class="{ 'admin-correction-changed': changed.has(field.key) }"
    >
      {{ field.label }}
      <input
        v-model.number="values[field.key]"
        type="number"
        min="0"
        :max="field.max"
        step="1"
        required
        :aria-invalid="!validValue(field, values[field.key])"
      />
      <small>
        now {{ whole(field.current)
        }}<template v-if="field.max < MAX_SHOWN_LIMIT"> · up to {{ whole(field.max) }}</template
        ><template v-if="field.note"> · {{ field.note }}</template>
      </small>
    </label>
  </form>
  <div class="admin-actions">
    <ConfirmAction
      label="Save and reset the player’s game"
      title="Correct this town?"
      :message="`${summary}. Saved as revision ${revision + 1}. The owner’s game loads it on its next sync without asking and keeps its own copy as a backup.`"
      :disabled="!changed.size || invalid"
      :run="save"
    />
    <button type="button" class="admin-button quiet" :disabled="!changed.size" @click="fill">
      Undo changes
    </button>
  </div>
</template>
<script setup>
import { computed, reactive } from 'vue';
import { adminApi } from '../api';
import { whole } from '../format';
import {
  changedFields,
  correctionBody,
  correctionSummary,
  inventoryFields,
  validValue,
} from '../inventory';
import ConfirmAction from './ConfirmAction.vue';
const props = defineProps({
  townId: String,
  revision: Number,
  inventory: { type: Object, required: true },
});
const emit = defineEmits(['saved']);
// The coin ceiling is technical, not a rule worth showing.
const MAX_SHOWN_LIMIT = 1e6;
const fields = computed(() => inventoryFields(props.inventory));
const values = reactive({});
function fill() {
  for (const field of fields.value) values[field.key] = field.current;
}
fill();
const changed = computed(
  () => new Set(changedFields(fields.value, values).map((field) => field.key)),
);
const invalid = computed(() => fields.value.some((field) => !validValue(field, values[field.key])));
const summary = computed(() => correctionSummary(fields.value, values));
async function save() {
  emit(
    'saved',
    await adminApi('PATCH', `towns/${props.townId}/inventory`, {
      body: correctionBody(fields.value, values, props.revision),
    }),
  );
}
</script>
