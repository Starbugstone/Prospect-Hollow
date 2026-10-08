<template>
  <div v-if="risk.stale" class="admin-warning" role="alert">
    <p>
      The player’s game saved revision {{ status.revision }}
      {{ relativeTime(status.savedAt, now) }}, while you were editing. These values come from
      revision {{ revision }}, so they cannot be saved.
    </p>
    <button type="button" class="admin-button" @click="$emit('reload')">
      Load the latest values
    </button>
    <span class="admin-muted"> Your changes here are cleared.</span>
  </div>
  <div v-else-if="risk.online" class="admin-warning" role="status">
    <p>
      <strong>The player is online</strong> (last seen {{ relativeTime(status.ownerSeenAt, now) }}).
      Their game may save while you edit; this page then asks you to load the latest values. Ask
      them to close the game first if you can.
    </p>
  </div>
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
        :disabled="risk.stale"
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
      :message="confirmMessage"
      :disabled="!changed.size || invalid || risk.stale"
      :run="save"
    />
    <button type="button" class="admin-button quiet" :disabled="!changed.size" @click="fill">
      Undo changes
    </button>
  </div>
  <dialog ref="warning" class="admin-dialog">
    <form method="dialog">
      <h2>The player is online</h2>
      <p>
        Their game was last seen {{ relativeTime(status.ownerSeenAt, now) }} and may sync while you
        edit. If it does, this correction cannot be saved until you load the latest values.
      </p>
      <p>
        Once you save, whatever they play before their game loads the correction is replaced, and
        kept only as a backup on their device. If you can, ask them to close the game first.
      </p>
      <div class="admin-dialog-actions">
        <button type="button" class="admin-button quiet" @click="undo">Undo my change</button>
        <button class="admin-button">Edit anyway</button>
      </div>
    </form>
  </dialog>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { adminApi } from '../api';
import { relativeTime, whole } from '../format';
import {
  changedFields,
  correctionBody,
  correctionSummary,
  editingRisk,
  inventoryFields,
  STATUS_POLL_MS,
  validValue,
} from '../inventory';
import ConfirmAction from './ConfirmAction.vue';
const props = defineProps({
  townId: String,
  revision: Number,
  savedAt: Number,
  ownerSeenAt: Number,
  inventory: { type: Object, required: true },
});
const emit = defineEmits(['saved', 'reload']);
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

// Polled while the page is open, so a sync from the player's game shows up during an edit.
const status = ref({
  revision: props.revision,
  savedAt: props.savedAt,
  ownerSeenAt: props.ownerSeenAt,
});
const now = ref(Date.now() / 1000);
const risk = computed(() => editingRisk(props.revision, status.value, now.value));
let timer;
async function check() {
  now.value = Date.now() / 1000;
  if (document.hidden) return;
  try {
    status.value = await adminApi('GET', `towns/${props.townId}/status`);
  } catch {
    /* The last known status stands; saving still checks the revision. */
  }
}
onMounted(() => (timer = setInterval(check, STATUS_POLL_MS)));
onBeforeUnmount(() => clearInterval(timer));

// The first edit while the player is online opens a warning.
const warning = ref(null);
let warned = false;
watch(
  () => changed.value.size > 0,
  (editing) => {
    if (!editing || warned || !risk.value.online) return;
    warned = true;
    warning.value.showModal();
  },
);
function undo() {
  fill();
  warning.value.close();
}
const confirmMessage = computed(
  () =>
    `${summary.value}. Saved as revision ${props.revision + 1}. The owner’s game loads it on its next sync without asking and keeps its own copy as a backup.` +
    (risk.value.online
      ? ' The player is online: what they play before their game loads this is replaced.'
      : ''),
);
async function save() {
  emit(
    'saved',
    await adminApi('PATCH', `towns/${props.townId}/inventory`, {
      body: correctionBody(fields.value, values, props.revision),
    }),
  );
}
</script>
