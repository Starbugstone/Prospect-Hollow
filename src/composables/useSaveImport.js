import { ref } from 'vue';
import { useCampaignStore } from '../stores/campaignStore';
import { MAX_SAVE_FILE_BYTES, parseSaveFile } from '../services/saveTransfer';
import { OTHER_TOWN_BACKUP } from '../services/townStorage';

/**
 * Choose, validate and confirm a JSON backup before it replaces the current village.
 * Shared by every place that offers "Load a backup file" so they all validate,
 * word errors and commit the import the same way.
 * @param {() => void} [onImported] Called after the backup replaced saved progress.
 */
export function useSaveImport(onImported = () => {}) {
  const campaign = useCampaignStore();
  const pendingSave = ref(null);
  const readingFile = ref(false);
  const saveError = ref('');
  const saveStatus = ref('');
  let selectionVersion = 0;
  function reset() {
    selectionVersion++;
    pendingSave.value = null;
    readingFile.value = false;
    saveError.value = '';
    saveStatus.value = '';
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
      if (file.size > MAX_SAVE_FILE_BYTES)
        throw new Error('Choose a backup file smaller than 5 MB.');
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
      onImported();
    } catch (error) {
      saveError.value =
        error.message === 'The save could not be stored. Your current progress has not changed.'
          ? error.message
          : error.message?.startsWith(OTHER_TOWN_BACKUP)
            ? OTHER_TOWN_BACKUP
            : 'That file is not a Prospect Hollow backup.';
    }
  }
  return {
    pendingSave,
    readingFile,
    saveError,
    saveStatus,
    reset,
    selectSave,
    importProgress,
    cancel: () => (pendingSave.value = null),
  };
}
