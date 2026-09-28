<template>
  <!-- Temporary: lets beta testers bring a village saved by the old game (main)
       to this address, where its local save is not visible. Remove this component
       and its slot in LandingView.vue once testers have moved their saves. -->
  <section class="landing-old-save" aria-labelledby="landing-old-save-title">
    <h2 id="landing-old-save-title">
      <GameIcon name="history" />{{ t('Played the earlier beta?') }}
    </h2>
    <p>
      {{
        t(
          'Bring your village with you. In the old game, open Settings and choose “Save a backup file”, then load that file here.',
        )
      }}
    </p>
    <button
      v-if="!pendingSave"
      type="button"
      class="town-secondary"
      :disabled="readingFile"
      @click="saveInput.click()"
    >
      <GameIcon name="download" />{{ t('Load my old save') }}
    </button>
    <input
      ref="saveInput"
      type="file"
      accept=".json,application/json"
      hidden
      :aria-label="t('Load my old save')"
      @change="selectSave"
    />
    <div v-if="pendingSave" class="landing-old-save-confirm">
      <p class="landing-old-save-file">{{ pendingSave.name }}</p>
      <p>
        {{
          t(
            campaign.hasVisitedVillage
              ? 'Replace the town you have here with this old save?'
              : 'Continue with the village from this old save?',
          )
        }}
      </p>
      <div>
        <button type="button" class="town-primary" @click="importProgress">
          {{ t('Load and continue') }}
        </button>
        <button type="button" class="town-secondary" @click="cancel">{{ t('Cancel') }}</button>
      </div>
    </div>
    <p v-if="saveError" role="alert" class="landing-old-save-error">{{ t(saveError) }}</p>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { t } from '../i18n';
import { useCampaignStore } from '../stores/campaignStore';
import { useSaveImport } from '../composables/useSaveImport';
import GameIcon from './GameIcon.vue';
const emit = defineEmits(['imported']);
const campaign = useCampaignStore();
const saveInput = ref(null);
const { pendingSave, readingFile, saveError, selectSave, importProgress, cancel } = useSaveImport(
  () => emit('imported'),
);
</script>
<style scoped>
.landing-old-save {
  margin-top: 16px;
  width: min(100%, 360px);
  box-sizing: border-box;
  padding: 14px 18px;
  border: 1px dashed #c9a45c;
  border-radius: 10px;
  background: #fffaf0b3;
}
.landing-old-save h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font:
    400 17px Georgia,
    serif;
  color: #40594b;
}
.landing-old-save h2 svg {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: #b0843e;
}
.landing-old-save p {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #5f6a58;
}
.landing-old-save .town-secondary {
  border-color: #c9a45c;
  background: #f5e2b4;
  color: #4a3b1c;
  font-size: 13px;
  font-weight: 600;
}
.landing-old-save .town-secondary:hover:not(:disabled) {
  background: #efd598;
}
.landing-old-save-confirm > div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.landing-old-save-confirm .town-primary {
  font-size: 13px;
  font-weight: 600;
}
.landing-old-save .landing-old-save-file {
  margin-bottom: 6px;
  font-weight: 600;
  color: #40594b;
  overflow-wrap: anywhere;
}
.landing-old-save .landing-old-save-error {
  margin: 10px 0 0;
  color: #a4442c;
}
</style>
