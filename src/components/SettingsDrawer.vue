<template>
  <dialog
    ref="dialog"
    class="settings-drawer"
    @cancel.prevent="$emit('close')"
    @click="closeBackdrop"
  >
    <header>
      <div>
        <h2>{{ t('Settings') }}</h2>
      </div>
      <button class="icon-button" :aria-label="t('Close settings')" @click="$emit('close')">
        <GameIcon name="close" />
      </button>
    </header>
    <label
      ><span>
        {{ t('Music') }} <small>{{ t(Math.round(settings.musicVolume * 100)) }}%</small></span
      ><input
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="settings.musicVolume"
        @input="settings.setMusicVolume($event.target.value)"
    /></label>
    <label
      ><span>
        {{ t('Sound effects') }} <small>{{ t(Math.round(settings.sfxVolume * 100)) }}%</small></span
      ><input
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="settings.sfxVolume"
        @input="settings.setSfxVolume($event.target.value)"
    /></label>
    <label class="toggle-row"
      ><span>
        {{ t('Reduced motion') }}
        <small> {{ t('Gentler movement, without bursts or flashes.') }} </small></span
      ><input
        type="checkbox"
        :checked="settings.reducedMotion"
        @change="settings.setReducedMotion($event.target.checked)"
    /></label>
    <label class="toggle-row"
      ><span>
        {{ t('High contrast') }}
        <small> {{ t('Stronger outlines and brighter text.') }} </small></span
      ><input
        type="checkbox"
        :checked="settings.highContrastMode"
        @change="settings.setHighContrast($event.target.checked)"
    /></label>
    <label class="toggle-row"
      ><span>{{ t('Building labels') }}</span
      ><input
        type="checkbox"
        :checked="settings.showVillageLabels"
        @change="settings.setVillageLabels($event.target.checked)"
    /></label>
    <section v-if="allowSaveTransfer" class="save-transfer" :aria-label="t('Save your village')">
      <h3>{{ t('Save your village') }}</h3>
      <p>
        {{ t('Keep a backup of your village, or load it on another device.') }}
      </p>
      <div class="save-actions">
        <button type="button" @click="exportProgress">{{ t('Save a backup file') }}</button>
        <button type="button" :disabled="readingFile" @click="saveInput.click()">
          {{ t('Load a backup file') }}
        </button>
      </div>
      <input
        ref="saveInput"
        type="file"
        accept=".json,application/json"
        hidden
        :aria-label="t('Load a backup file')"
        @change="selectSave"
      />
      <div v-if="pendingSave" class="import-confirmation">
        <p class="save-filename">{{ pendingSave.name }}</p>
        <p>
          {{
            t(
              'Replace your current village with this backup? Save a backup first if you want to keep it.',
            )
          }}
        </p>
        <div class="save-actions">
          <button type="button" @click="importProgress">{{ t('Replace and continue') }}</button>
          <button type="button" @click="pendingSave = null">{{ t('Cancel') }}</button>
        </div>
      </div>
      <p v-if="saveError" role="alert" class="save-error">{{ t(saveError) }}</p>
      <p v-if="saveStatus" role="status">{{ t(saveStatus) }}</p>
    </section>
    <p class="audio-credits">
      <a :href="audioCreditsUrl" target="_blank" rel="noopener">{{ t('Audio credits') }}</a>
    </p>
    <div class="keyboard-guide">
      <h3>{{ t('Keyboard controls') }}</h3>
      <p>
        {{ t('Swipe or tap neighboring gems.') }} <br />
        {{ t('Keyboard: arrows to explore, Enter to select.') }} <br />
        {{ t('Shift + arrow to swap. Esc to cancel.') }}
      </p>
    </div>
    <div class="testing-reset">
      <button v-if="!confirmReset" class="text-button" @click="confirmReset = true">
        {{ t('Start a new village') }}
      </button>
      <template v-else>
        <p>
          {{
            t(
              'Reset all progress on this device? Your town, completed levels, and power-ups will start over.',
            )
          }}
        </p>
        <div>
          <button @click="resetProgress">{{ t('Reset all progress') }}</button
          ><button @click="confirmReset = false">{{ t('Cancel') }}</button>
        </div>
      </template>
    </div>
  </dialog>
</template>
<script setup>
import { t } from '../i18n';
import { ref, watch } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import { useCampaignStore } from '../stores/campaignStore';
import { MAX_SAVE_FILE_BYTES, parseSaveFile } from '../services/saveTransfer';
import GameIcon from './GameIcon.vue';
const props = defineProps({ open: Boolean, allowSaveTransfer: Boolean });
const emit = defineEmits(['close', 'reset-progress', 'import-progress']);
const campaign = useCampaignStore();
const saveInput = ref(null);
const pendingSave = ref(null);
const readingFile = ref(false);
const saveError = ref('');
const saveStatus = ref('');
let selectionVersion = 0;
function exportProgress() {
  saveError.value = '';
  saveStatus.value = '';
  try {
    const blob = new Blob([campaign.exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospect-hollow-save-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saveStatus.value = 'Save file download started.';
  } catch {
    saveError.value = 'Your save could not be exported. Please try again.';
  }
}
async function selectSave(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const version = ++selectionVersion;
  pendingSave.value = null;
  saveError.value = '';
  saveStatus.value = '';
  readingFile.value = true;
  try {
    if (file.size > MAX_SAVE_FILE_BYTES) throw new Error('Choose a backup file smaller than 5 MB.');
    const text = await file.text();
    if (version !== selectionVersion) return;
    parseSaveFile(text);
    pendingSave.value = { name: file.name, text };
  } catch (error) {
    if (version === selectionVersion)
      saveError.value =
        error.message?.startsWith('Choose a backup') ||
        error.message?.startsWith('This save format')
          ? error.message
          : 'That file is not a Prospect Hollow backup.';
  } finally {
    if (version === selectionVersion) readingFile.value = false;
  }
}
function importProgress() {
  saveError.value = '';
  try {
    campaign.importSave(pendingSave.value.text);
    pendingSave.value = null;
    saveStatus.value = 'Save imported. Your village is ready to continue.';
    emit('import-progress');
  } catch (error) {
    saveError.value =
      error.message === 'The save could not be stored. Your current progress has not changed.'
        ? error.message
        : 'That file is not a Prospect Hollow backup.';
  }
}
const confirmReset = ref(false);
function resetProgress() {
  emit('reset-progress');
  confirmReset.value = false;
  emit('close');
}
const dialog = ref(null);
const settings = useSettingsStore();
const audioCreditsUrl = `${import.meta.env.BASE_URL}sound/village/credits.html`;
watch(
  () => props.open,
  (open) => {
    confirmReset.value = false;
    selectionVersion++;
    pendingSave.value = null;
    readingFile.value = false;
    saveError.value = '';
    saveStatus.value = '';
    if (open) dialog.value?.showModal();
    else dialog.value?.close();
  },
  { flush: 'post' },
);
const closeBackdrop = (event) => {
  if (event.target === dialog.value) {
    const r = dialog.value.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      emit('close');
  }
};
</script>
<style scoped>
.save-transfer {
  margin-bottom: 30px;
  padding: 18px;
  border: 1px solid #84619e88;
  border-radius: 10px;
  background: #c29ae80a;
}
.save-transfer h3 {
  margin: 0;
  font-size: 15px;
}
.save-transfer p {
  margin: 12px 0;
  color: #d6c4db;
  font-size: 12px;
  line-height: 1.7;
}
.save-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.save-actions button {
  flex: 1 1 110px;
  min-height: 44px;
  padding: 10px;
  border: 1px solid #93789c;
  border-radius: 6px;
  background: #33233f;
  color: #f4e6f0;
  font-size: 12px;
}
.save-actions button:disabled {
  opacity: 0.5;
}
.save-actions button:focus-visible {
  outline: 2px solid #e4c1ff;
  outline-offset: 3px;
}
.save-filename {
  overflow-wrap: anywhere;
  font-weight: 600;
}
.save-transfer .save-error {
  color: #ffc4b8;
}
.import-confirmation {
  border-top: 1px solid #84619e55;
  margin-top: 18px;
}
.audio-credits a {
  color: inherit;
  font-size: 12px;
  text-underline-offset: 3px;
}
.testing-reset {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #84619e55;
}
.testing-reset p {
  color: #d6c4db;
  font-size: 12px;
  line-height: 1.7;
}
.testing-reset > div {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.testing-reset button {
  padding: 10px;
  border: 1px solid #93789c;
  border-radius: 6px;
  background: transparent;
  color: #ead3e4;
  font-size: 12px;
}
.settings-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  width: min(390px, 92vw);
  height: 100dvh;
  max-height: 100dvh;
  overflow-y: auto;
  margin: 0;
  padding: 34px 27px;
  background: #1d1629;
  color: var(--color-foreground);
  border: 0;
  border-left: 1px solid #84619e;
  box-shadow: -20px 0 70px #09050d88;
}
.settings-drawer::backdrop {
  background: #090612ad;
  backdrop-filter: blur(4px);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
h2 {
  font-family: var(--font-heading);
  font-size: 25px;
  font-weight: 400;
  margin-top: 8px;
}
.settings-intro {
  color: #b5a3c4;
  font-size: 12px;
  line-height: 1.6;
  margin: 20px 0 35px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 30px;
  font-size: 13px;
}
label > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
small {
  color: #ae9dbd;
  font-size: 11px;
}
input {
  accent-color: #c29ae8;
}
input[type='range'] {
  width: 100%;
}
.toggle-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  padding-top: 24px;
}
.toggle-row > span {
  display: block;
}
.toggle-row small {
  display: block;
  margin-top: 9px;
  line-height: 1.6;
}
input[type='checkbox'] {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
}
.keyboard-guide {
  border-top: 1px solid var(--line);
  padding-top: 24px;
}
.keyboard-guide p {
  font-size: 11px;
  line-height: 2;
  color: #ac98bc;
  margin-top: 12px;
}
</style>
