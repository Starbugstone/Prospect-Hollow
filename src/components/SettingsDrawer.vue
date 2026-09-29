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
    <section v-if="account" class="account-settings" :aria-label="t('Your town')">
      <h3>{{ t('Your town') }}</h3>
      <div class="account-town">
        <img src="/art/amethyst.svg" alt="" />
        <span>
          <strong>{{ account.townName.value }}</strong>
          <small class="account-status" :data-tone="account.saveState.value.tone" role="status">{{
            t(account.saveState.value.label)
          }}</small>
        </span>
      </div>
      <button
        type="button"
        class="account-open"
        :disabled="!account.canOpen.value"
        @click="openAccount"
      >
        {{ t(account.signedIn.value ? 'My towns & saves' : 'Protect my progress') }}
        <GameIcon name="arrow" />
      </button>
    </section>
    <button v-if="showHome" type="button" class="settings-home" @click="$emit('home')">
      <GameIcon name="home" />{{ t('Home page and news') }}
    </button>
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
    <p class="audio-credits">
      <a :href="audioCreditsUrl" target="_blank" rel="noopener">{{ t('Audio credits') }}</a>
    </p>
    <details class="settings-more">
      <summary>
        {{ t('More options')
        }}<small>{{
          t(backupHere ? 'Backup file, keyboard controls' : 'Keyboard controls')
        }}</small>
      </summary>
      <section v-if="backupHere" class="save-transfer" :aria-label="t('Save your village')">
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
            <button type="button" @click="cancel">{{ t('Cancel') }}</button>
          </div>
        </div>
        <p v-if="saveError" role="alert" class="save-error">{{ t(saveError) }}</p>
        <p v-if="saveStatus" role="status">{{ t(saveStatus) }}</p>
      </section>
      <div class="keyboard-guide">
        <h3>{{ t('Keyboard controls') }}</h3>
        <p>
          {{ t('Swipe or tap neighboring gems.') }} <br />
          {{ t('Keyboard: arrows to explore, Enter to select.') }} <br />
          {{ t('Shift + arrow to swap. Esc to cancel.') }}
        </p>
      </div>
      <div v-if="!campaign.readOnly && !townStorage.state()?.active.owner" class="testing-reset">
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
    </details>
  </dialog>
</template>
<script setup>
import { t } from '../i18n';
import { townStorage } from '../services/townStorage';
import { computed, inject, ref, watch } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import { useCampaignStore } from '../stores/campaignStore';
import { downloadSaveFile, saveFileName } from '../services/saveTransfer';
import { useSaveImport } from '../composables/useSaveImport';
import GameIcon from './GameIcon.vue';
const props = defineProps({ open: Boolean, allowSaveTransfer: Boolean, showHome: Boolean });
const emit = defineEmits(['close', 'home', 'reset-progress', 'import-progress']);
const campaign = useCampaignStore();
// Provided by CloudRoot; absent when the game runs without account support.
const account = inject('cloudAccount', null);
// Account towns are backed up and loaded from their management page in My towns instead.
const backupHere = computed(() => props.allowSaveTransfer && !account?.accountTown.value);
function openAccount() {
  emit('close');
  account.open();
}
const saveInput = ref(null);
const {
  pendingSave,
  readingFile,
  saveError,
  saveStatus,
  reset,
  selectSave,
  importProgress,
  cancel,
} = useSaveImport(() => emit('import-progress'));
function exportProgress() {
  saveError.value = '';
  saveStatus.value = '';
  try {
    downloadSaveFile(campaign.exportSave(), saveFileName(townStorage.state()?.active.name));
    saveStatus.value = 'Save file download started.';
  } catch {
    saveError.value = 'Your save could not be exported. Please try again.';
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
    reset();
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
.account-settings {
  margin: 22px 0 30px;
  padding: 16px 18px 18px;
  border: 1px solid #84619e88;
  border-radius: 10px;
  background: #c29ae80a;
}
.account-settings h3 {
  margin: 0 0 12px;
  color: #cdb4e6;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.account-town {
  display: flex;
  align-items: center;
  gap: 12px;
}
.account-town img {
  width: 30px;
  height: 30px;
}
.account-town span {
  display: grid;
  min-width: 0;
  overflow-wrap: anywhere;
}
.account-town strong {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 400;
}
.account-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
  color: #d6c4db;
  font-size: 12px;
}
.account-status::before {
  content: '';
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #a99db5;
}
.account-status[data-tone='saved']::before {
  background: #7fd18f;
  box-shadow: 0 0 0 3px #7fd18f2e;
}
.account-status[data-tone='busy']::before,
.account-status[data-tone='pending']::before {
  background: #f0b35e;
}
.account-status[data-tone='alert']::before {
  background: #ff8a70;
  box-shadow: 0 0 0 3px #ff8a7040;
}
.account-settings .account-open {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid #b48cdd;
  border-radius: 8px;
  background: #6d527e;
  color: #fff5e1;
  font-size: 14px;
  font-weight: 600;
}
.account-open svg {
  width: 18px;
  height: 18px;
}
.account-open:disabled {
  opacity: 0.5;
}
.settings-home {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  margin: 14px 0 22px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.settings-home svg {
  width: 18px;
  height: 18px;
}
.account-open:focus-visible,
.settings-home:focus-visible,
.settings-more summary:focus-visible {
  outline: 2px solid #e4c1ff;
  outline-offset: 3px;
}
.settings-more {
  margin-top: 8px;
  border-top: 1px solid var(--line);
}
.settings-more summary {
  position: relative;
  display: grid;
  padding: 16px 28px 16px 0;
  cursor: pointer;
  list-style: none;
  font-size: 14px;
}
.settings-more summary::-webkit-details-marker {
  display: none;
}
.settings-more summary::after {
  content: '';
  position: absolute;
  right: 6px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 2px solid #cdb4e6;
  border-bottom: 2px solid #cdb4e6;
  transform: translateY(-70%) rotate(45deg);
}
.settings-more[open] summary::after {
  transform: translateY(-30%) rotate(-135deg);
}
.settings-more summary small {
  margin-top: 2px;
  color: #cbbdd8;
  font-size: 12px;
}
.settings-more[open] summary {
  margin-bottom: 8px;
}
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
