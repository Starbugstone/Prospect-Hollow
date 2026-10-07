<template>
  <section class="admin-sync-compare" aria-label="Sync comparison">
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <template v-if="data">
      <header class="admin-sync-compare-heading">
        <h3>
          Rejected {{ dateTime(data.rejection.at) }} against revision {{ data.rejection.revision }}
        </h3>
        <button type="button" class="admin-button quiet" @click="$emit('close')">Close</button>
      </header>
      <p class="admin-sync-reason" role="status">
        <span aria-hidden="true">⚠</span>
        {{ codeLabel(data.rejection.code)
        }}<template v-if="data.rejection.field">
          at <code>{{ data.rejection.field }}</code></template
        >. {{ data.rejection.message }}
      </p>
      <p v-if="!data.expected" class="admin-muted">
        The server stopped before replaying this upload, so there is no expected state. The cloud
        save and the upload are compared directly.
      </p>
      <div class="admin-actions">
        <button
          v-for="side in downloads.filter((item) => data[item.id])"
          :key="side.id"
          type="button"
          class="admin-button quiet"
          @click="downloadJson(`${townName}-${side.id}-r${data.rejection.revision}`, data[side.id])"
        >
          Download {{ side.label }} (JSON)
        </button>
      </div>
      <div class="admin-filters">
        <label>
          Start from
          <select v-model="base" :disabled="!data.current">
            <option value="cloud">Cloud save</option>
            <option value="upload">Rejected upload</option>
          </select>
        </label>
        <label>
          <input v-model="everything" type="checkbox" />
          Also show values that only changed since the cloud save
        </label>
      </div>
      <table class="admin-table compact admin-sync-table">
        <thead>
          <tr>
            <th scope="col">Value</th>
            <th scope="col">Cloud save</th>
            <th v-if="data.expected" scope="col">Server expected</th>
            <th scope="col">Rejected upload</th>
            <th scope="col">New value</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in shown"
            :key="row.key"
            :class="{
              'admin-sync-rejected': row.rejected,
              'admin-sync-mismatch': row.mismatch && !row.rejected,
              'admin-sync-edited': edited.has(row.key),
            }"
          >
            <th scope="row">
              <span
                v-if="row.rejected"
                class="admin-sync-flag"
                title="The server rejected this value"
                >⚠</span
              >
              <code>{{ row.label }}</code>
            </th>
            <td>
              <button type="button" class="admin-sync-value" title="Use" @click="use(row, 'cloud')">
                {{ shownValue(row.cloud) }}
              </button>
            </td>
            <td v-if="data.expected">
              <button
                type="button"
                class="admin-sync-value"
                title="Use"
                @click="use(row, 'expected')"
              >
                {{ shownValue(row.expected) }}
              </button>
            </td>
            <td>
              <button
                type="button"
                class="admin-sync-value"
                title="Use"
                @click="use(row, 'upload')"
              >
                {{ shownValue(row.upload) }}
              </button>
            </td>
            <td>
              <input
                v-model="inputs[row.key]"
                :aria-label="`New value of ${row.label}`"
                :disabled="!data.current"
                spellcheck="false"
              />
            </td>
          </tr>
          <tr v-if="!shown.length">
            <td :colspan="data.expected ? 5 : 4" class="admin-empty">No differences.</td>
          </tr>
        </tbody>
      </table>
      <p class="admin-muted">
        Click a value to copy it into New value, or type one (JSON: numbers, true, "text"). The
        server checks the edited save before saving it.
      </p>
      <p v-if="!data.current" class="admin-notice" role="status">
        The town saved again since this rejection, so it cannot be reset from here.
      </p>
      <div v-else class="admin-actions">
        <ConfirmAction
          label="Save and reset the player’s game"
          title="Reset the player’s game to this save?"
          :message="`The ${base === 'cloud' ? 'cloud save' : 'rejected upload'} with ${changes.length} edited value(s) is saved as revision ${data.rejection.revision + 1}. The owner’s game loads it on its next sync without asking and keeps its own copy as a backup.`"
          :run="reset"
        />
      </div>
    </template>
  </section>
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { adminApi } from '../api';
import { codeLabel, dateTime } from '../format';
import { downloadJson } from '../download';
import { compareRows, editedValues, isEdited, shownValue } from '../syncCompare';
import ConfirmAction from './ConfirmAction.vue';
const props = defineProps({ townId: String, townName: String, rejectionId: String });
const emit = defineEmits(['close', 'reset']);
const downloads = [
  { id: 'cloud', label: 'cloud save' },
  { id: 'expected', label: 'server expected' },
  { id: 'upload', label: 'rejected upload' },
];
const data = ref(null),
  error = ref(''),
  base = ref('cloud'),
  everything = ref(false),
  inputs = reactive({});
const rows = computed(() =>
  data.value
    ? compareRows({
        cloud: data.value.cloud,
        expected: data.value.expected,
        upload: data.value.upload,
        field: data.value.rejection.field,
      })
    : [],
);
const shown = computed(() =>
  rows.value.filter((row) => everything.value || row.rejected || row.mismatch),
);
const changes = computed(() => editedValues(rows.value, base.value, inputs));
const edited = computed(
  () =>
    new Set(rows.value.filter((row) => isEdited(row, base.value, inputs)).map((row) => row.key)),
);
// Every input starts from the save the admin chose to edit.
function fill() {
  for (const row of rows.value)
    inputs[row.key] = row[base.value] === undefined ? '' : JSON.stringify(row[base.value]);
}
watch(base, fill);
const use = (row, side) => {
  if (data.value.current) inputs[row.key] = shownValue(row[side]).replace(/^—$/, '');
};
async function load() {
  error.value = '';
  try {
    data.value = await adminApi('GET', `towns/${props.townId}/sync/${props.rejectionId}`);
    fill();
  } catch (e) {
    error.value = e.message;
  }
}
async function reset() {
  emit(
    'reset',
    await adminApi('POST', `towns/${props.townId}/sync/${props.rejectionId}/reset`, {
      body: { base: base.value, changes: changes.value },
    }),
  );
}
watch(() => props.rejectionId, load, { immediate: true });
</script>
