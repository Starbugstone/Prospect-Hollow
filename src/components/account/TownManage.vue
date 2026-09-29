<template>
  <div class="account-manage">
    <p v-if="locked" class="account-hint">
      {{ t('Waiting for the latest backup before details can change…') }}
    </p>
    <section ref="details" class="account-section">
      <h2>{{ t('Name') }}</h2>
      <form
        class="account-inline"
        @submit.prevent="act(() => saveSettings(editName, meta.isPublic))"
      >
        <input
          v-model="editName"
          :aria-label="t('Town name')"
          minlength="3"
          maxlength="24"
          required
        />
        <button v-if="editName !== meta.name" class="account-primary" :disabled="busy || locked">
          {{ t('Save') }}
        </button>
      </form>
    </section>
    <section class="account-section">
      <h2>{{ t('Sharing') }}</h2>
      <label class="account-toggle">
        <span>
          <strong>{{ t('Let other players visit') }}</strong>
          <small>{{ t("Visitors can look around but can't change anything.") }}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          :checked="meta.isPublic"
          :disabled="busy || locked"
          @change="act(() => saveSettings(meta.name, $event.target.checked))"
        />
      </label>
      <p v-if="meta.isPublic && meta.publicId" class="account-share">
        <GameIcon name="share" /><code>{{ shareUrl }}</code>
        <button type="button" @click="copyShareLink">
          <GameIcon :name="copied ? 'check' : 'copy'" />{{ t(copied ? 'Copied' : 'Copy link') }}
        </button>
      </p>
      <p v-else class="account-hint">
        {{ t('Shared town names are checked in English and French.') }}
      </p>
    </section>
    <section ref="historySection" class="account-section">
      <h2>{{ t('Save history') }}</h2>
      <ul class="account-timeline">
        <li>
          <i class="is-now"></i>
          <span
            ><strong>{{ when(meta.cloudAt * 1000) }}</strong
            ><small>{{ townSummary(active.profile) }}</small></span
          >
          <small>{{ t('Current') }}</small>
        </li>
        <li v-if="meta.recovery" class="is-kept">
          <i></i>
          <span
            ><strong>{{ t('Kept from this device') }}</strong
            ><small
              >{{ when(meta.recovery.updatedAt) }} · {{ townSummary(meta.recovery.profile) }}</small
            ></span
          >
          <span class="account-row">
            <button
              v-if="meta.recovery.id"
              :disabled="busy || game.sessionActive"
              @click="recovery()"
            >
              {{ t('Compare') }}
            </button>
            <button
              class="account-icon"
              :aria-label="t('Download this device’s save')"
              :title="t('Download this device’s save')"
              @click="downloadRecovery"
            >
              <GameIcon name="download" />
            </button>
          </span>
        </li>
        <li v-for="save in history" :key="save.revision">
          <i></i>
          <span
            ><strong>{{ when(save.updatedAt * 1000) }}</strong
            ><small>{{ townSummary(save.profile) }}</small></span
          >
          <button
            :disabled="busy || game.sessionActive"
            :aria-expanded="choice === save"
            @click="choice = choice === save ? null : save"
          >
            {{ t('Restore') }}
          </button>
          <div v-if="choice === save" class="account-confirm">
            <p>{{ t('Restore this save? Your current save will be preserved on this device.') }}</p>
            <button
              class="account-primary"
              :disabled="busy || game.sessionActive"
              @click="act(restoreHistory)"
            >
              {{ t('Restore this save') }}</button
            ><button @click="choice = null">{{ t('Cancel') }}</button>
          </div>
        </li>
        <li v-if="!historyLoaded && !loadingHistory">
          <button :disabled="busy" @click="act(loadHistory)">{{ t('Load earlier saves') }}</button>
        </li>
        <li v-if="loadingHistory" class="account-hint">{{ t('Loading saves…') }}</li>
      </ul>
      <p class="account-hint">
        {{ t('Your current save is preserved on this device before replacement.') }}
      </p>
    </section>
    <section class="account-section">
      <h2>{{ t('Backup file') }}</h2>
      <p class="account-hint">
        {{
          t('Keep a copy of {town} on your device, or load one of its backups.', {
            town: meta.name,
          })
        }}
      </p>
      <div class="account-row">
        <button :disabled="busy || game.sessionActive" @click="exportBackup">
          <GameIcon name="download" />{{ t('Save a backup file') }}
        </button>
        <button :disabled="busy || game.sessionActive || readingFile" @click="backupInput.click()">
          {{ t('Load a backup file') }}
        </button>
      </div>
      <input
        ref="backupInput"
        type="file"
        accept=".json,application/json"
        hidden
        :aria-label="t('Load a backup file')"
        @change="selectSave"
      />
      <div v-if="pendingSave" class="account-confirm">
        <p>
          <strong>{{ pendingSave.name }}</strong
          ><br />{{
            t(
              'Replace your current village with this backup? Save a backup first if you want to keep it.',
            )
          }}
        </p>
        <button
          class="account-primary"
          :disabled="busy || game.sessionActive"
          @click="importProgress"
        >
          {{ t('Replace and continue') }}</button
        ><button @click="cancel">{{ t('Cancel') }}</button>
      </div>
      <p v-if="saveError" role="alert" class="account-hint">{{ t(saveError) }}</p>
      <p v-if="saveStatus" role="status" class="account-hint">{{ t(saveStatus) }}</p>
    </section>
    <details ref="deleteSection" class="account-danger" :open="focus === 'delete'">
      <summary>
        <GameIcon name="trash" />{{ t('Delete {town} from the cloud…', { town: meta.name }) }}
      </summary>
      <p>
        {{
          t('This frees an account slot and removes the public listing. The local copy is kept.')
        }}
      </p>
      <label class="account-field"
        >{{ t('Type the town name to confirm') }}<input v-model="deleteName" /></label
      ><button
        class="account-destructive"
        :disabled="busy || game.sessionActive || deleteName !== meta.name"
        @click="act(deleteTown)"
      >
        {{ t('Delete cloud town') }}
      </button>
    </details>
  </div>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  cloud,
  refreshAccount,
  request,
  restoreSave,
  townAction,
  getRecovery,
} from '../../services/cloudProfile';
import { townStorage } from '../../services/townStorage';
import { visitUrl } from '../../services/appRoute';
import { createSaveFile, downloadSaveFile, saveFileName } from '../../services/saveTransfer';
import { useSaveImport } from '../../composables/useSaveImport';
import { useCampaignStore } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';
import { useAccountContext, townSummary } from './accountContext';
import GameIcon from '../GameIcon.vue';
import { t } from '../../i18n';
const props = defineProps({ active: { type: Object, required: true }, focus: String });
const { busy, act, recovery, changed } = useAccountContext();
const campaign = useCampaignStore(),
  game = useGameStore(),
  editName = ref(''),
  deleteName = ref(''),
  history = ref([]),
  loadingHistory = ref(false),
  historyLoaded = ref(false),
  choice = ref(null),
  copied = ref(false),
  details = ref(null),
  historySection = ref(null),
  deleteSection = ref(null),
  backupInput = ref(null);
const meta = computed(() => props.active.meta);
const locked = computed(() => !!(meta.value.dirty || meta.value.conflict || meta.value.pending));
const shareUrl = computed(() => visitUrl(meta.value.publicId));
const when = (at) =>
  at
    ? new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : t('Not synced yet');
watch(
  () => [meta.value.id, meta.value.baseRevision, meta.value.name, meta.value.isPublic].join(':'),
  () => {
    editName.value = meta.value.name;
  },
  { immediate: true },
);
// Metadata changes run in the same per-town queue as uploads and resolutions.
function saveSettings(name, isPublic) {
  const local = props.active;
  return townAction(local.meta.id, async () => {
    if (locked.value) throw new Error('Sync or resolve this town before changing its details.');
    const town = await request(
      `towns/${local.meta.id}/settings`,
      { baseRevision: local.meta.baseRevision, name, isPublic },
      'PATCH',
    );
    townStorage.mutate(local.meta.id, cloud.account.id, (r) => {
      if (town.revision < r.meta.baseRevision) return false;
      r.meta.name = town.name;
      r.meta.baseRevision = town.revision;
      r.meta.cloudAt = town.updatedAt;
      r.meta.isPublic = town.isPublic;
      r.meta.publicId = town.publicId;
    });
    await refreshAccount();
  });
}
async function loadHistory() {
  loadingHistory.value = true;
  try {
    history.value = (await request(`towns/${meta.value.id}/history`)).revisions;
    historyLoaded.value = true;
  } finally {
    loadingHistory.value = false;
  }
}
async function restoreHistory() {
  await restoreSave(meta.value.id, choice.value.profile);
  choice.value = null;
  await loadHistory();
}
function deleteTown() {
  const local = props.active;
  return townAction(local.meta.id, async () => {
    await request(
      `towns/${local.meta.id}`,
      { baseRevision: local.meta.baseRevision, confirmation: deleteName.value },
      'DELETE',
    );
    townStorage.mutate(local.meta.id, cloud.account.id, (r) => {
      r.meta.missing = true;
      r.meta.conflict = null;
    });
    deleteName.value = '';
    await refreshAccount();
  });
}
async function copyShareLink() {
  await navigator.clipboard?.writeText(shareUrl.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
// The panel only manages the town being played, so its live progress is this town's backup.
const { pendingSave, readingFile, saveError, saveStatus, selectSave, importProgress, cancel } =
  useSaveImport(changed);
function exportBackup() {
  saveError.value = '';
  saveStatus.value = '';
  try {
    downloadSaveFile(campaign.exportSave(), saveFileName(meta.value.name));
    saveStatus.value = 'Save file download started.';
  } catch {
    saveError.value = 'Your save could not be exported. Please try again.';
  }
}
async function downloadRecovery() {
  await act(async () => {
    const saved = await getRecovery(meta.value.id, meta.value.recovery.id);
    const profile = saved?.profile ?? meta.value.recovery.profile;
    if (!profile) throw new Error('This preserved save is unavailable.');
    downloadSaveFile(createSaveFile(profile), saveFileName(`${meta.value.name} recovery`));
  });
}
onMounted(() => {
  if (props.focus === 'history') act(loadHistory);
  const target = { history: historySection, delete: deleteSection }[props.focus] ?? details;
  target.value?.scrollIntoView({ block: 'nearest' });
});
</script>
