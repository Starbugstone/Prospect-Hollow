<template>
  <dialog
    ref="dialog"
    class="save-recovery-dialog"
    aria-labelledby="save-recovery-title"
    @cancel.prevent="close"
    @click="dismissBackdrop"
  >
    <button ref="closeButton" class="recovery-close" :aria-label="t('Close')" @click="close">
      ×
    </button>
    <h2 id="save-recovery-title">{{ t('Review preserved local save') }}</h2>
    <p>
      {{
        t(
          'The cloud save is the default. You can explicitly replace it with the local version kept before synchronization.',
        )
      }}
    </p>
    <template v-if="copies.length">
      <label
        >{{ t('Preserved saves') }}
        <select v-model="selected" :disabled="busy" @change="load">
          <option v-for="entry in copies" :key="entry.id" :value="entry.id">
            {{ date(entry.updatedAt) }} · {{ entry.coins ?? 0 }} {{ t('Coins') }}
          </option>
        </select>
      </label>
      <div class="recovery-actions">
        <button :disabled="busy" @click="download">{{ t('Download preserved save') }}</button>
        <button :disabled="busy" @click="confirmDelete = true">
          {{ t('Remove this preserved copy') }}
        </button>
      </div>
      <p v-if="confirmDelete" class="recovery-warning">
        {{ t('Permanently remove this preserved copy? Your current town will not change.') }}
        <button :disabled="busy" @click="remove">{{ t('Remove copy') }}</button>
        <button @click="confirmDelete = false">{{ t('Cancel') }}</button>
      </p>
    </template>
    <p v-if="busy" role="status">{{ t('Checking the latest cloud save…') }}</p>
    <p v-if="error" role="alert">{{ t(error) }}</p>
    <template v-if="review">
      <table>
        <thead>
          <tr>
            <th scope="col">{{ t('Village') }}</th>
            <th scope="col">{{ t('Cloud') }}</th>
            <th scope="col">{{ t('Local copy') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.label">
            <th scope="row">{{ t(row.label) }}</th>
            <td>{{ row.cloud }}</td>
            <td>{{ row.local }}</td>
          </tr>
        </tbody>
      </table>
      <p class="recovery-warning">
        {{
          t(
            'This replaces the entire village, money, buildings and bonuses on this device and in the cloud. Progress is not combined.',
          )
        }}
      </p>
      <p>{{ t('The previous version remains available in cloud save history.') }}</p>
      <div class="recovery-actions">
        <button @click="close">{{ t('Keep cloud save') }}</button>
        <button class="recovery-replace" :disabled="busy" @click="replace">
          {{ t('Replace cloud save with this local save') }}
        </button>
      </div>
    </template>
    <button v-else-if="!busy" @click="load">{{ t('Review latest cloud save') }}</button>
  </dialog>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { townStorage } from '../../services/townStorage';
import {
  reviewRecovery,
  overwriteRecovery,
  listRecoveries,
  getRecovery,
  deleteRecovery,
} from '../../services/cloudProfile';
import { createSaveFile } from '../../services/saveTransfer';
import { ERA_BY_ID } from '../../data/eras';
import { t } from '../../i18n';
const emit = defineEmits(['close']);
const close = () => emit('close');
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(close);
const townId = townStorage.active()?.meta.id;
const copies = ref([]),
  selected = ref(null),
  confirmDelete = ref(false);
const review = ref(null),
  busy = ref(false),
  error = ref('');
const countBuildings = (p) =>
  Object.values(p.town?.buildings ?? {}).filter((level) => level > 0).length;
const countBonuses = (p) => (p.powers ?? []).reduce((sum, power) => sum + (power.quantity ?? 0), 0);
const era = (p) => t(ERA_BY_ID[p.town?.era]?.label ?? p.town?.era ?? '');
const date = (at) => (at ? new Date(at).toLocaleString() : t('Not synced yet'));
const rows = computed(() => {
  const server = review.value.cloud.profile,
    local = review.value.recovery.profile;
  return [
    { label: 'Era', cloud: era(server), local: era(local) },
    { label: 'Coins', cloud: server.town?.coins ?? 0, local: local.town?.coins ?? 0 },
    { label: 'Buildings', cloud: countBuildings(server), local: countBuildings(local) },
    { label: 'Bonuses', cloud: countBonuses(server), local: countBonuses(local) },
    {
      label: 'Hammers',
      cloud: server.builderHammers ?? 0,
      local: local.builderHammers ?? 0,
    },
    {
      label: 'Saved',
      cloud: date(review.value.cloud.updatedAt * 1000),
      local: date(review.value.recovery.updatedAt),
    },
  ];
});
async function load() {
  confirmDelete.value = false;
  busy.value = true;
  error.value = '';
  review.value = null;
  try {
    copies.value = await listRecoveries(townId);
    if (!copies.value.some((entry) => entry.id === selected.value))
      selected.value = copies.value[0]?.id;
    if (selected.value) review.value = await reviewRecovery(townId, selected.value);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function download() {
  busy.value = true;
  try {
    const entry = await getRecovery(townId, selected.value);
    if (!entry) throw new Error('This preserved save is unavailable.');
    const url = URL.createObjectURL(
      new Blob([createSaveFile(entry.profile)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospect-preserved-${entry.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function remove() {
  busy.value = true;
  try {
    await deleteRecovery(townId, selected.value);
    confirmDelete.value = false;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function replace() {
  if (busy.value || !review.value) return;
  busy.value = true;
  error.value = '';
  try {
    await overwriteRecovery(townId, review.value);
    close();
  } catch (e) {
    error.value = e.message;
    review.value = null; // A new revision requires a fresh review and explicit click.
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style>
.save-recovery-dialog {
  box-sizing: border-box;
  width: min(42rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  padding: clamp(1rem, 4vw, 2rem);
  border: 1px solid #c9bc98;
  border-radius: 1.25rem;
  color: #294139;
  background: #fbf8ee;
  font: 1rem/1.5 system-ui;
}
.save-recovery-dialog::backdrop {
  background: #122f2bb3;
}
.save-recovery-dialog h2 {
  margin-top: 0;
  padding-right: 2rem;
  font-size: clamp(1.2rem, 4vw, 1.5rem);
  line-height: 1.3;
}
.save-recovery-dialog .recovery-close {
  float: right;
}
.save-recovery-dialog label {
  display: block;
  margin: 0.75rem 0;
}
.save-recovery-dialog select {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem;
  border: 1px solid #bdc5af;
  border-radius: 0.6rem;
  background: #fffdf6;
  color: #294139;
  font: inherit;
}
.save-recovery-dialog table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.9rem;
}
.save-recovery-dialog th,
.save-recovery-dialog td {
  padding: 0.6rem 0.3rem;
  border-bottom: 1px solid #dcd5bf;
  text-align: left;
  overflow-wrap: anywhere;
}
.save-recovery-dialog .recovery-warning {
  padding: 0.8rem;
  background: #fff0ca;
  border-radius: 0.5rem;
}
.save-recovery-dialog button {
  font: inherit;
  padding: 0.65rem 0.8rem;
  border: 1px solid #bdc5af;
  border-radius: 0.6rem;
  background: #fffdf6;
  color: #294139;
  cursor: pointer;
}
.save-recovery-dialog button:disabled {
  opacity: 0.6;
  cursor: default;
}
.save-recovery-dialog .recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.save-recovery-dialog .recovery-replace {
  background: #80482c;
  color: #fff;
  border-color: #80482c;
}
</style>
