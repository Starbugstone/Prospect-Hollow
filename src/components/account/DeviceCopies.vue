<template>
  <details v-if="towns.length" class="account-fold">
    <summary>{{ t('Towns stored on this device') }}</summary>
    <p class="account-hint">
      {{
        t(
          'These copies are playable offline. Removing a device copy does not delete its cloud town.',
        )
      }}
    </p>
    <section v-for="town in towns" :key="town.id" class="account-section">
      <strong>{{ town.name }}</strong>
      <p
        v-if="townStorage.selectedKey() === townKey(town.id, cloud.account.id)"
        class="account-hint"
      >
        {{ t('Current town') }}
      </p>
      <template v-else>
        <div class="account-row">
          <button :disabled="busy || game.sessionActive" @click="act(() => open(town))">
            {{ t('Open device copy') }}
          </button>
          <button
            :disabled="busy"
            @click="
              removing = town.id;
              confirmation = '';
            "
          >
            {{ t('Remove device copy') }}
          </button>
        </div>
        <form
          v-if="removing === town.id"
          class="account-stack"
          @submit.prevent="act(() => remove(town))"
        >
          <p>
            {{
              t(
                'This removes this device’s copy and its preserved saves. Any unsynced progress will be lost. Export anything you want to keep first.',
              )
            }}
          </p>
          <label class="account-field"
            >{{ t('Type the town name to confirm') }}<input v-model="confirmation" required
          /></label>
          <button class="account-destructive" :disabled="busy || confirmation !== town.name">
            {{ t('Remove device copy') }}
          </button>
          <button type="button" @click="removing = null">{{ t('Cancel') }}</button>
        </form>
      </template>
    </section>
  </details>
</template>
<script setup>
import { computed, ref } from 'vue';
import { cloud, deleteCachedTown } from '../../services/cloudProfile';
import { townStorage, townKey } from '../../services/townStorage';
import { useGameStore } from '../../stores/gameStore';
import { useAccountContext } from './accountContext';
import { t } from '../../i18n';
const { busy, act, changed, close } = useAccountContext();
const game = useGameStore(),
  removing = ref(null),
  confirmation = ref('');
const towns = computed(() => {
  void cloud.storageVersion;
  return cloud.account ? townStorage.records(cloud.account.id).map(({ meta }) => meta) : [];
});
function open(town) {
  if (game.sessionActive) return;
  townStorage.select(town.id, cloud.account.id);
  changed();
  close();
}
async function remove(town) {
  if (confirmation.value !== town.name) return;
  await deleteCachedTown(town.id);
  removing.value = null;
}
</script>
