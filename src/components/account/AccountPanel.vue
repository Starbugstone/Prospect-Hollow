<template>
  <dialog
    ref="dialog"
    class="account-panel"
    :aria-label="t('My towns')"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <header>
      <h1>{{ t(cloud.account ? 'My towns' : 'Protect my progress') }}</h1>
      <button ref="closeButton" :aria-label="t('Close account settings')" @click="$emit('close')">
        ×
      </button>
    </header>
    <p v-if="message || cloud.error" role="status">{{ t(message || cloud.error) }}</p>
    <template v-if="!cloud.account">
      <p>
        {{
          t(
            'Play and save one town on this device. Sign in to keep up to three towns backed up across devices.',
          )
        }}
      </p>
      <form
        @submit.prevent="
          act(async () => {
            message = (await sendLogin(email)).message;
          })
        "
      >
        <label
          >{{ t('Email address')
          }}<input v-model="email" type="email" autocomplete="email" maxlength="254" required
        /></label>
        <button :disabled="busy">{{ t('Send sign-in link') }}</button>
      </form>
      <form @submit.prevent="act(signIn)">
        <label>{{ t('Sign-in link') }}<input v-model="proof" autocomplete="off" required /></label>
        <button :disabled="busy">{{ t('Confirm sign-in') }}</button>
      </form>
      <p>
        {{
          t(
            'Open your email link, or paste it here. Links expire after 15 minutes and are used only when you confirm.',
          )
        }}
      </p>
    </template>
    <template v-else>
      <p>
        {{ cloud.account.email }} ·
        {{ t('{count} of 3 town slots', { count: cloud.towns.length }) }}
      </p>
      <button :disabled="busy" @click="act(refreshAccount)">{{ t('Refresh towns') }}</button>
      <p v-if="game.sessionActive">
        {{ t('Leave the mine before switching towns or resolving saves.') }}
      </p>
      <section v-if="writable && active && !active.meta.owner">
        <h2>{{ t('Town on this device') }}</h2>
        <p>{{ summary(active.profile) }}</p>
        <label
          >{{ t('Town name') }}<input v-model="localName" minlength="3" maxlength="24"
        /></label>
        <button
          :disabled="
            busy ||
            (cloud.towns.length >= 3 && !cloud.towns.some((t) => t.townId === active.meta.id))
          "
          @click="act(() => attachLocal(localName))"
        >
          {{ t('Add this town to my account') }}
        </button>
        <p v-if="cloud.towns.length >= 3">
          {{
            t(
              'Your account is full. This local town stays playable. Remove a cloud town to free a slot.',
            )
          }}
        </p>
      </section>
      <ul class="town-slots">
        <li v-for="town in cloud.towns" :key="town.townId">
          <strong>{{ town.name }}</strong
          ><small>{{ t('Cloud saved') }}: {{ date(town.updatedAt * 1000) }}</small>
          <span v-if="writable && active?.meta.id === town.townId">{{ t('Current town') }}</span>
          <button v-else :disabled="busy || game.sessionActive" @click="act(() => openTown(town))">
            {{ t('Open town') }}
          </button>
          <a :href="townUrl(town.townId)" target="_blank" rel="noopener">{{
            t('Open in a new tab')
          }}</a>
        </li>
      </ul>
      <form v-if="cloud.towns.length < 3" @submit.prevent="act(createTown)">
        <label
          >{{ t('New town name')
          }}<input v-model="newName" :disabled="busy" minlength="3" maxlength="24" required
        /></label>
        <button :disabled="busy || game.sessionActive">{{ t('Create account town') }}</button>
      </form>
      <section v-if="writable && active?.meta.owner === cloud.account.id">
        <h2>{{ active.meta.name }}</h2>
        <form @submit.prevent="act(() => townAction(active.meta.id, updateSettings))">
          <label
            >{{ t('Town name') }}<input v-model="editName" minlength="3" maxlength="24" required
          /></label>
          <label><input v-model="isPublic" type="checkbox" />{{ t('Share this town') }}</label>
          <p>
            {{
              t(
                'Public names are checked in English and French. Private names do not need a profanity check.',
              )
            }}
          </p>
          <button
            :disabled="busy || active.meta.dirty || !!active.meta.conflict || !!active.meta.pending"
          >
            {{ t('Save town details') }}
          </button>
        </form>
        <p v-if="active.meta.isPublic">
          <a :href="shareUrl" target="_blank" rel="noopener">{{ t('Town share link') }}</a>
        </p>
        <button :disabled="busy" @click="act(loadHistory)">{{ t('Previous saves') }}</button>
        <ul v-if="history.length">
          <li v-for="save in history" :key="save.revision">
            {{ date(save.updatedAt * 1000) }} · {{ summary(save.profile)
            }}<button :disabled="busy || game.sessionActive" @click="historyChoice = save">
              {{ t('Review this save') }}
            </button>
          </li>
        </ul>
        <div v-if="historyChoice">
          <p>
            {{
              t('Restore this previous save? Your current cloud copy will remain in save history.')
            }}
          </p>
          <button :disabled="busy || game.sessionActive" @click="act(restoreHistory)">
            {{ t('Restore previous save') }}</button
          ><button @click="historyChoice = null">{{ t('Cancel') }}</button>
        </div>
        <details>
          <summary>{{ t('Delete this cloud town') }}</summary>
          <p>
            {{
              t(
                'This frees an account slot and removes the public listing. The local copy is kept.',
              )
            }}
          </p>
          <label>{{ t('Type the town name to confirm') }}<input v-model="deleteName" /></label
          ><button
            :disabled="busy || game.sessionActive || deleteName !== active.meta.name"
            @click="act(() => townAction(active.meta.id, deleteTown))"
          >
            {{ t('Delete cloud town') }}
          </button>
        </details>
        <p v-if="active.meta.missing">
          {{
            t(
              'This cloud town was deleted or is unavailable. Its local copy has been kept; it will not be uploaded automatically.',
            )
          }}
        </p>
        <button v-if="active.meta.recovery" @click="downloadRecovery">
          {{ t('Download previous device save') }}
        </button>
      </section>
      <section v-for="entry in conflicts" :key="entry.meta.id" class="save-conflict">
        <h2>{{ t('{town} changed on two devices', { town: entry.meta.name }) }}</h2>
        <div class="save-comparison">
          <div>
            <h3>{{ t('This device') }}</h3>
            <p>{{ summary(entry.profile) }}</p>
            <p>{{ date(entry.meta.updatedAt) }}</p>
          </div>
          <div>
            <h3>{{ t('Cloud save') }}</h3>
            <p>{{ summary(entry.meta.conflict.profile) }}</p>
            <p>{{ date(entry.meta.conflict.updatedAt * 1000) }}</p>
          </div>
        </div>
        <button
          :disabled="busy || game.sessionActive"
          @click="act(() => resolveConflict(entry.meta.id, 'local'))"
        >
          {{ t('Keep this device') }}
        </button>
        <button
          :disabled="busy || game.sessionActive"
          @click="act(() => resolveConflict(entry.meta.id, 'cloud'))"
        >
          {{ t('Keep cloud save') }}
        </button>
      </section>
      <button @click="$emit('community')">{{ t('Visit shared towns') }}</button>
      <button :disabled="busy" @click="act(() => logout())">{{ t('Sign out') }}</button>
      <button :disabled="busy" @click="act(() => logout(true))">
        {{ t('Sign out all devices') }}
      </button>
      <details>
        <summary>{{ t('Delete account') }}</summary>
        <label
          >{{ t('Type DELETE MY ACCOUNT to confirm') }}<input v-model="deleteAccountText" /></label
        ><button
          :disabled="busy || deleteAccountText !== 'DELETE MY ACCOUNT'"
          @click="act(deleteAccount)"
        >
          {{ t('Delete my account') }}
        </button>
      </details>
    </template>
  </dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import {
  cloud,
  sendLogin,
  confirmLogin,
  refreshAccount,
  syncNow,
  request,
  attachLocal,
  logout,
  disconnect,
  resolveConflict,
  restoreSave,
  townAction,
  cacheTown,
} from '../../services/cloudProfile';
import { townCoordinator } from '../../services/townCoordinator';
import { townStorage } from '../../services/townStorage';
import { createSaveFile } from '../../services/saveTransfer';
import { freshProfile } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';
import { t } from '../../i18n';
import { ERA_BY_ID } from '../../data/eras';
const props = defineProps({ loginLink: String, writable: Boolean });
const emit = defineEmits(['close', 'changed', 'community']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const game = useGameStore(),
  busy = ref(false),
  message = ref(''),
  email = ref(''),
  proof = ref(props.loginLink ?? ''),
  newName = ref(''),
  localName = ref(townStorage.active()?.meta.name ?? 'My town'),
  editName = ref(''),
  isPublic = ref(false),
  deleteName = ref(''),
  deleteAccountText = ref(''),
  history = ref([]),
  historyChoice = ref(null);
const active = computed(() => {
  void cloud.storageVersion;
  return townStorage.active();
});
const conflicts = computed(() => {
  void cloud.storageVersion;
  return props.writable && active.value?.meta.conflict ? [active.value] : [];
});
const shareUrl = computed(
  () =>
    `${import.meta.env.VITE_PUBLIC_ORIGIN || (import.meta.env.VITE_API_BASE?.startsWith('https://') ? new URL(import.meta.env.VITE_API_BASE).origin : location.origin + location.pathname)}#town=${active.value?.meta.publicId}`,
);
watch(
  () => active.value?.meta.id + ':' + active.value?.meta.baseRevision,
  () => {
    editName.value = active.value?.meta.name ?? '';
    isPublic.value = active.value?.meta.isPublic ?? false;
  },
  { immediate: true },
);
watch(
  () => active.value?.meta.id,
  () => {
    history.value = [];
    historyChoice.value = null;
    deleteName.value = '';
  },
);
const townUrl = (id) => `${location.origin}${location.pathname}?play=${encodeURIComponent(id)}`;
const date = (value) => (value ? new Date(value).toLocaleString() : t('Not synced yet'));
const summary = (profile) =>
  `${t(ERA_BY_ID[profile.town?.era]?.label ?? profile.town?.era ?? '')} · ${Object.keys(profile.records ?? {}).length} ${t('Mines completed')} · ${Object.values(profile.records ?? {}).reduce((sum, r) => sum + (r.stars ?? 0), 0)} ★ · ${profile.town?.coins ?? 0} ${t('Coins')}`;
async function act(operation) {
  if (busy.value) return;
  busy.value = true;
  message.value = '';
  cloud.error = '';
  try {
    await operation();
  } catch (error) {
    message.value = error.message;
  } finally {
    busy.value = false;
    cloud.storageVersion++;
  }
}
async function signIn() {
  await confirmLogin(proof.value);
  proof.value = '';
  message.value = 'Signed in. Choose a town or add this device’s town.';
}
async function openTown(town) {
  if (game.sessionActive) return;
  await cacheTown(town);
  if (props.writable) await syncNow({ pull: false });
  townStorage.select(town.townId, cloud.account.id);
  emit('changed');
}
async function createTown() {
  return townCoordinator.run(`account-creation:${cloud.account.id}`, createTownLocked);
}
async function createTownLocked() {
  const previous = townStorage.state()?.creation;
  const body =
    previous?.owner === cloud.account.id && previous.body.name === newName.value
      ? previous.body
      : {
          townId: crypto.randomUUID(),
          name: newName.value,
          baseRevision: 0,
          uploadId: crypto.randomUUID(),
          profile: freshProfile(),
        };
  townStorage.creation({ owner: cloud.account.id, body });
  const town = await request('towns', body);
  townStorage.creation(null);
  await cacheTown(town);
  await refreshAccount();
  await openTown(town);
  newName.value = '';
}
async function updateSettings() {
  const local = active.value;
  if (local.meta.dirty || local.meta.conflict || local.meta.pending)
    throw new Error('Sync or resolve this town before changing its details.');
  const town = await request(
    `towns/${local.meta.id}/settings`,
    { baseRevision: local.meta.baseRevision, name: editName.value, isPublic: isPublic.value },
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
}
async function loadHistory() {
  history.value = (await request(`towns/${active.value.meta.id}/history`)).revisions;
}
async function restoreHistory() {
  await restoreSave(active.value.meta.id, historyChoice.value.profile);
  historyChoice.value = null;
  await loadHistory();
}
async function deleteTown() {
  const local = active.value;
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
}
async function deleteAccount() {
  await request('account', { confirmation: deleteAccountText.value }, 'DELETE');
  disconnect();
  emit('changed');
}
function downloadRecovery() {
  const url = URL.createObjectURL(
    new Blob([createSaveFile(active.value.meta.recovery.profile)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prospect-hollow-recovery.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
<style>
.account-panel {
  color-scheme: light;
  width: min(640px, calc(100vw - 24px));
  max-height: 90dvh;
  padding: 1.3rem;
  border: 1px solid #ded5bd;
  border-radius: 16px;
  background: #fbf8ef;
  color: #294139;
  font: 1rem/1.5 system-ui;
  overflow: auto;
}
.account-panel::backdrop {
  background: #102923bb;
}
.account-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.account-panel h1 {
  font:
    1.6rem Georgia,
    serif;
  margin: 0;
}
.account-panel h2 {
  font-size: 1.15rem;
}
.account-panel section,
.account-panel details {
  border-top: 1px solid #ded5bd;
  margin-top: 1rem;
  padding-top: 1rem;
}
.account-panel label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  margin: 0.6rem 0;
}
.account-panel input {
  max-width: 100%;
  min-width: 0;
  padding: 0.6rem;
  font: inherit;
  border: 1px solid #78918a;
  border-radius: 6px;
}
.account-panel input:not([type='checkbox']) {
  width: 100%;
  box-sizing: border-box;
}
.account-panel button {
  cursor: pointer;
  font: inherit;
  padding: 0.6rem 0.8rem;
  margin: 0.3rem;
  background: #ffdc99;
  color: #193d30;
  border: 1px solid #c4bea9;
  border-radius: 8px;
}
.account-panel button:disabled {
  opacity: 0.5;
  cursor: default;
}
.town-slots {
  list-style: none;
  padding: 0;
}
.town-slots li {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  border-bottom: 1px solid #ded5bd;
  padding: 0.6rem 0;
}
.town-slots small {
  flex-basis: 100%;
}
.save-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.save-comparison > div {
  padding: 0.7rem;
  background: #eee9d9;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  .save-comparison {
    grid-template-columns: 1fr;
  }
}
</style>
