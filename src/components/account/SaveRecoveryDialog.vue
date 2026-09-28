<template>
  <dialog
    ref="dialog"
    class="account-panel save-recovery-dialog"
    aria-labelledby="save-recovery-title"
    @cancel.prevent="close"
    @click="dismissBackdrop"
  >
    <header class="account-heading">
      <img src="/art/amethyst.svg" alt="" />
      <h1 id="save-recovery-title">
        {{ t('Which {town} do you want to keep?', { town: townName }) }}
      </h1>
      <button ref="closeButton" class="account-round" :aria-label="t('Close')" @click="close">
        <GameIcon name="close" />
      </button>
    </header>
    <div class="account-body">
      <p>
        {{
          t(
            'You played on another device, so we loaded that save. The save from this device was kept. Pick the one to keep playing.',
          )
        }}
      </p>
      <template v-if="copies.length">
        <label class="account-field"
          >{{ t('Preserved saves') }}
          <select v-model="selected" :disabled="busy" @change="load">
            <option v-for="entry in copies" :key="entry.id" :value="entry.id">
              {{ when(entry.updatedAt) }} · {{ number(entry.coins ?? 0) }} {{ t('Coins') }}
            </option>
          </select>
        </label>
        <button class="account-link" :disabled="busy" @click="confirmDelete = true">
          {{ t('Remove this preserved copy') }}
        </button>
        <div v-if="confirmDelete" class="account-confirm">
          <p>
            {{ t('Permanently remove this preserved copy? Your current town will not change.') }}
          </p>
          <button :disabled="busy" @click="remove">{{ t('Remove copy') }}</button>
          <button :disabled="busy" @click="confirmDelete = false">{{ t('Cancel') }}</button>
        </div>
      </template>
      <p v-if="busy && !review" role="status" class="account-hint">
        {{ t('Checking the latest cloud save…') }}
      </p>
      <p v-if="error" role="alert" class="account-message">{{ t(error) }}</p>
      <div v-if="review" class="recovery-choices">
        <section class="recovery-choice is-current">
          <span class="recovery-tag">{{ t('In use now') }}</span>
          <h2><GameIcon name="cloud" />{{ t('Cloud save') }}</h2>
          <p class="account-hint">{{ t('Saved {time}', { time: when(cloudAt) }) }}</p>
          <dl>
            <template v-for="row in changed" :key="row.label">
              <dt>{{ t(row.label) }}</dt>
              <dd>{{ row.cloud }}</dd>
            </template>
          </dl>
          <p v-if="same" class="recovery-same">{{ same }}</p>
          <button class="account-primary account-wide" :disabled="busy" @click="$emit('keep')">
            {{ t('Keep playing this one') }}
          </button>
        </section>
        <section class="recovery-choice">
          <span class="recovery-tag">{{ t('This device') }}</span>
          <h2><GameIcon name="phone" />{{ t('This device’s save') }}</h2>
          <p class="account-hint">
            {{ t('Saved {time}', { time: when(review.recovery.updatedAt) }) }}
          </p>
          <dl>
            <template v-for="row in changed" :key="row.label">
              <dt>{{ t(row.label) }}</dt>
              <dd :class="row.trend">
                {{ row.local
                }}<span v-if="row.trend" aria-hidden="true">{{
                  row.trend === 'up' ? ' ▲' : ' ▼'
                }}</span>
              </dd>
            </template>
          </dl>
          <p v-if="same" class="recovery-same">{{ same }}</p>
          <button
            v-if="!confirming"
            class="account-wide"
            :disabled="busy"
            @click="confirming = true"
          >
            {{ t('Switch to this save') }}
          </button>
          <div v-else class="account-confirm">
            <p>
              {{
                t(
                  'This replaces the whole village in your account and on this device. Saves are never combined.',
                )
              }}
            </p>
            <button class="account-primary" :disabled="busy" @click="replace">
              {{ t('Switch save') }}</button
            ><button :disabled="busy" @click="confirming = false">{{ t('Cancel') }}</button>
          </div>
        </section>
      </div>
      <button v-else-if="!busy" @click="load">{{ t('Try again') }}</button>
      <p class="account-hint">
        {{ t('Your preserved copies stay on this device until you remove them.') }}
      </p>
      <footer class="recovery-footer">
        <button class="account-link" @click="close">{{ t('Decide later') }}</button>
        <button v-if="selected" class="account-link" :disabled="busy" @click="download">
          <GameIcon name="download" />{{ t('Download this device’s save') }}
        </button>
      </footer>
    </div>
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
import { createSaveFile, downloadSaveFile } from '../../services/saveTransfer';
import { countBuildings, eraLabel } from './accountContext';
import GameIcon from '../GameIcon.vue';
import { t, number, locale } from '../../i18n';
import '../../styles/account.css';
const emit = defineEmits(['close', 'keep']);
const close = () => emit('close');
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(close);
const town = townStorage.active();
const townId = town?.meta.id,
  townName = town?.meta.name ?? t('Your town');
const copies = ref([]),
  selected = ref(null),
  confirmDelete = ref(false);
const review = ref(null),
  busy = ref(false),
  error = ref(''),
  confirming = ref(false);
const countBonuses = (p) => (p.powers ?? []).reduce((sum, power) => sum + (power.quantity ?? 0), 0);
const when = (at) =>
  at
    ? new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : t('Not synced yet');
const cloudAt = computed(() => review.value.cloud.updatedAt * 1000);
const rows = computed(() => {
  const server = review.value.cloud.profile,
    local = review.value.recovery.profile;
  const count = (label, read) => ({
    label,
    cloud: read(server),
    local: read(local),
    numeric: true,
  });
  return [
    { label: 'Era', cloud: eraLabel(server), local: eraLabel(local) },
    count('Coins', (p) => p.town?.coins ?? 0),
    count('Buildings', countBuildings),
    count('Bonuses', countBonuses),
    count('Builder hammers', (p) => p.builderHammers ?? 0),
  ];
});
const changed = computed(() =>
  rows.value
    .filter((row) => row.cloud !== row.local)
    .map((row) => ({
      ...row,
      trend: row.numeric ? (row.local > row.cloud ? 'up' : 'down') : '',
      cloud: row.numeric ? number(row.cloud) : row.cloud,
      local: row.numeric ? number(row.local) : row.local,
    })),
);
const same = computed(() => {
  const labels = rows.value.filter((row) => row.cloud === row.local).map((row) => t(row.label));
  return labels.length
    ? t('Same in both: {items}', {
        items: new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(labels),
      })
    : '';
});
async function load() {
  confirming.value = false;
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
async function replace() {
  if (busy.value || !review.value) return;
  busy.value = true;
  error.value = '';
  try {
    await overwriteRecovery(townId, review.value);
    emit('keep');
  } catch (e) {
    error.value = e.message;
    review.value = null; // A new revision requires a fresh review and explicit click.
    confirming.value = false;
  } finally {
    busy.value = false;
  }
}
async function download() {
  busy.value = true;
  error.value = '';
  try {
    const entry = await getRecovery(townId, selected.value);
    if (!entry) throw new Error('This preserved save is unavailable.');
    downloadSaveFile(createSaveFile(entry.profile), `prospect-preserved-${entry.id}.json`);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function remove() {
  busy.value = true;
  error.value = '';
  try {
    await deleteRecovery(townId, selected.value);
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style>
.save-recovery-dialog {
  width: min(680px, calc(100vw - 24px));
}
.save-recovery-dialog .account-heading h1 {
  white-space: normal;
  font-size: 1.35rem;
}
.recovery-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}
.recovery-choice {
  display: grid;
  align-content: start;
  gap: 0.55rem;
  padding: 1rem;
  background: #fffdf6;
  border: 1px solid #e3dbc7;
  border-radius: 16px;
}
.recovery-choice.is-current {
  background: #f6f9f0;
  border-color: #315940;
  box-shadow: 0 0 0 1px #315940;
}
.recovery-tag {
  justify-self: start;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: #eee9d9;
  color: #4d6156;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.is-current .recovery-tag {
  background: #315940;
  color: #fff;
}
.save-recovery-dialog .recovery-choice h2 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 1.15rem;
}
.recovery-choice h2 svg {
  width: 1.2rem;
  height: 1.2rem;
}
.recovery-choice dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.7rem;
  margin: 0;
  font-size: 0.88rem;
}
.recovery-choice dt {
  color: #64756a;
}
.recovery-choice dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
.recovery-choice dd.up {
  color: #2f7d47;
}
.recovery-choice dd.down {
  color: #b4542f;
}
.recovery-same {
  color: #64756a;
  font-size: 0.8rem;
}
.recovery-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.8rem;
  border-top: 1px solid #e3dbc7;
}
@media (max-width: 560px) {
  .recovery-choices {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
