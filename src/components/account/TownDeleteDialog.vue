<template>
  <dialog
    ref="dialog"
    class="account-panel town-delete-dialog"
    aria-labelledby="town-delete-title"
    aria-describedby="town-delete-warning"
    @cancel.prevent="close"
    @click="dismissBackdrop"
  >
    <header class="account-heading">
      <GameIcon name="trash" />
      <h1 id="town-delete-title">{{ t('Delete “{town}”?', { town: town.name }) }}</h1>
      <button ref="closeButton" class="account-round" :aria-label="t('Close')" @click="close">
        <GameIcon name="close" />
      </button>
    </header>
    <form class="account-body" @submit.prevent="act(remove)">
      <aside id="town-delete-warning" class="account-callout is-danger" role="alert">
        <GameIcon name="trash" />
        <p>
          <strong>{{ t('This cannot be undone.') }}</strong>
          {{
            t(
              'The town leaves your account with its cloud saves and save history. Its public page and share link stop working, and its name becomes free for other players.',
            )
          }}
        </p>
      </aside>
      <p v-if="summary" class="account-hint">{{ summary }}</p>
      <p v-if="hasDeviceCopy">
        {{ t('This device keeps a copy you can still play, but it will no longer be backed up.') }}
      </p>
      <p v-else>
        {{
          t(
            'This device has no copy of this town. Save a backup file first if you might want it back.',
          )
        }}
      </p>
      <div class="account-row">
        <button type="button" :disabled="busy || inMine" @click="act(backup)">
          <GameIcon name="download" />{{ t('Save a backup file') }}
        </button>
      </div>
      <p v-if="inMine" class="account-message">
        {{ t('Leave the mine before deleting the town you are playing.') }}
      </p>
      <label class="account-field"
        >{{ t('Type the town name to confirm')
        }}<input
          v-model="confirmation"
          autocomplete="off"
          spellcheck="false"
          :placeholder="town.name"
      /></label>
      <p v-if="error" role="alert" class="account-message">{{ t(error) }}</p>
      <div class="account-row">
        <button
          class="account-destructive"
          :disabled="busy || inMine || confirmation !== town.name"
        >
          <GameIcon name="trash" />{{ t('Delete this town forever') }}
        </button>
        <button type="button" :disabled="busy" @click="close">{{ t('Cancel') }}</button>
      </div>
    </form>
  </dialog>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { cloud, deleteAccountTown, request } from '../../services/cloudProfile';
import { townStorage, townKey } from '../../services/townStorage';
import { createSaveFile, downloadSaveFile, saveFileName } from '../../services/saveTransfer';
import { useCampaignStore } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';
import { useAccountContext, eraName } from './accountContext';
import GameIcon from '../GameIcon.vue';
import { t, number } from '../../i18n';
// `town` is a town card: the account listing entry with its `card` summary.
const props = defineProps({ town: { type: Object, required: true } });
const emit = defineEmits(['close', 'deleted']);
const close = () => emit('close');
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(close);
const { busy, act } = useAccountContext();
const campaign = useCampaignStore(),
  game = useGameStore(),
  confirmation = ref(''),
  error = ref('');
const owner = cloud.account.id;
const playing = townStorage.selectedKey() === townKey(props.town.townId, owner);
const hasDeviceCopy = !!townStorage.get(props.town.townId, owner);
const inMine = computed(() => playing && game.sessionActive);
const summary = computed(() => {
  const card = props.town.card;
  if (!card) return '';
  return [
    eraName(card.era),
    t('{count} buildings', { count: card.buildings }),
    t('{coins} coins', { coins: number(card.coins) }),
  ]
    .filter(Boolean)
    .join(' · ');
});
// The town being played saves its live progress; any other its device copy or cloud save.
async function backup() {
  error.value = '';
  const { townId, name } = props.town;
  try {
    const text = playing
      ? campaign.exportSave()
      : createSaveFile(
          townStorage.get(townId, owner)?.profile ?? (await request(`towns/${townId}`)).profile,
          { id: townId, name },
        );
    downloadSaveFile(text, saveFileName(name));
  } catch (e) {
    error.value = e.message || 'Your save could not be exported. Please try again.';
  }
}
async function remove() {
  error.value = '';
  try {
    await deleteAccountTown(props.town, confirmation.value);
  } catch (e) {
    error.value = e.message;
    return;
  }
  emit('deleted');
}
</script>
<style>
.town-delete-dialog {
  width: min(480px, calc(100vw - 24px));
}
.town-delete-dialog .account-heading > svg {
  width: 1.4rem;
  height: 1.4rem;
}
.town-delete-dialog .account-heading h1 {
  white-space: normal;
  font-size: 1.3rem;
}
.town-delete-dialog .account-body {
  display: grid;
  gap: 0.8rem;
}
.account-callout.is-danger {
  background: #fbe9e5;
  border-color: #e0a79c;
}
.account-callout.is-danger > svg {
  color: #a53a2a;
}
</style>
