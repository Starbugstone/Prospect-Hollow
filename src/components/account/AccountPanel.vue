<template>
  <dialog
    ref="dialog"
    class="account-panel"
    :aria-label="t('My towns')"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <header class="account-heading">
      <img src="/art/amethyst.svg" alt="" />
      <h1>{{ t(cloud.account ? 'My towns' : 'Protect my progress') }}</h1>
      <button
        ref="closeButton"
        class="account-close"
        :aria-label="t('Close account settings')"
        @click="$emit('close')"
      >
        <GameIcon name="close" />
      </button>
    </header>
    <div class="account-body">
      <p v-if="message || cloud.error" class="account-message" role="status">
        {{ t(message || cloud.error) }}
      </p>
      <template v-if="!cloud.account">
        <p class="account-lead">
          {{
            t(
              'Play and save one town on this device. Sign in to keep up to three towns backed up across devices.',
            )
          }}
        </p>
        <form
          class="account-card"
          @submit.prevent="
            act(async () => {
              message = (await sendLogin(email)).message;
              email = '';
            })
          "
        >
          <label class="account-field"
            >{{ t('Email address')
            }}<input v-model="email" type="email" autocomplete="email" maxlength="254" required
          /></label>
          <button class="account-primary" :disabled="busy">{{ t('Send sign-in link') }}</button>
        </form>
        <form class="account-card" @submit.prevent="act(signIn)">
          <label class="account-field"
            >{{ t('Sign-in link') }}<input v-model="proof" autocomplete="off" required
          /></label>
          <button :disabled="busy">{{ t('Confirm sign-in') }}</button>
          <p class="account-hint">
            {{
              t(
                'Open your email link, or paste it here. Links expire after 15 minutes and are used only when you confirm.',
              )
            }}
          </p>
        </form>
      </template>
      <template v-else>
        <div class="account-summary">
          <span class="account-avatar" aria-hidden="true"><GameIcon name="cloud" /></span>
          <div>
            <strong>{{ t('Cloud account') }}</strong>
            <span class="account-slots">
              <span
                v-for="slot in 3"
                :key="slot"
                class="account-pip"
                :class="{ 'is-used': slot <= cloud.towns.length }"
                aria-hidden="true"
              ></span>
              {{ t('{count} of 3 town slots', { count: cloud.towns.length }) }}
            </span>
          </div>
          <button
            class="account-icon"
            :class="{ 'is-busy': busy }"
            :disabled="busy"
            :aria-label="t('Refresh towns')"
            :title="t('Refresh towns')"
            @click="act(refreshAccount)"
          >
            <GameIcon name="sync" />
          </button>
        </div>
        <p v-if="game.sessionActive" class="account-message">
          {{ t('Leave the mine before switching towns or resolving saves.') }}
        </p>
        <section v-if="writable && active && !active.meta.owner" class="account-card">
          <h2>{{ t('Town on this device') }}</h2>
          <p class="account-hint">{{ summary(active.profile) }}</p>
          <p v-if="registeredLocal">
            {{
              t(
                'This is a separate local copy. Open your account town to continue its saved progress; this local copy will be kept.',
              )
            }}
          </p>
          <button
            v-if="registeredLocal"
            class="account-primary"
            :disabled="busy || game.sessionActive"
            @click="act(() => openTown(registeredLocal))"
          >
            {{ t('Open my account town') }}
          </button>
          <label v-if="!registeredLocal" class="account-field"
            >{{ t('Town name') }}<input v-model="localName" minlength="3" maxlength="24"
          /></label>
          <button
            v-if="!registeredLocal"
            class="account-primary"
            :disabled="
              busy ||
              (cloud.towns.length >= 3 && !cloud.towns.some((t) => t.townId === active.meta.id))
            "
            @click="act(() => attachLocal(localName))"
          >
            {{ t('Add this town to my account') }}
          </button>
          <p v-if="cloud.towns.length >= 3" class="account-hint">
            {{
              t(
                'Your account is full. This local town stays playable. Remove a cloud town to free a slot.',
              )
            }}
          </p>
        </section>
        <ul class="town-slots">
          <li
            v-for="town in cloud.towns"
            :key="town.townId"
            :class="{ 'is-current': isCurrent(town) }"
          >
            <img src="/art/amethyst.svg" alt="" />
            <div class="town-slot-info">
              <strong>{{ town.name }}</strong
              ><small>{{ t('Cloud saved') }}: {{ date(town.updatedAt * 1000) }}</small>
            </div>
            <div class="town-slot-actions">
              <span v-if="isCurrent(town)" class="town-slot-badge">{{ t('Current town') }}</span>
              <button
                v-else
                class="account-primary"
                :disabled="busy || game.sessionActive"
                @click="act(() => openTown(town))"
              >
                {{ t('Open town') }}
              </button>
              <a
                class="town-slot-tab"
                :href="townUrl(town.townId)"
                target="_blank"
                rel="noopener"
                :aria-label="t('Open in a new tab')"
                :title="t('Open in a new tab')"
                ><GameIcon name="external"
              /></a>
            </div>
          </li>
        </ul>
        <form
          v-if="cloud.towns.length < 3"
          class="account-card account-create"
          @submit.prevent="act(createTown)"
        >
          <label class="account-field"
            >{{ t('New town name')
            }}<input v-model="newName" :disabled="busy" minlength="3" maxlength="24" required
          /></label>
          <button class="account-primary" :disabled="busy || game.sessionActive">
            {{ t('Create account town') }}
          </button>
        </form>
        <section v-if="writable && active?.meta.owner === cloud.account.id" class="account-card">
          <h2>
            <small>{{ t('Town settings') }}</small
            >{{ active.meta.name }}
          </h2>
          <form @submit.prevent="act(() => townAction(active.meta.id, updateSettings))">
            <label class="account-field"
              >{{ t('Town name') }}<input v-model="editName" minlength="3" maxlength="24" required
            /></label>
            <label class="account-check"
              ><input v-model="isPublic" type="checkbox" />{{ t('Share this town') }}</label
            >
            <p class="account-hint">
              {{
                t(
                  'Public names are checked in English and French. Private names do not need a profanity check.',
                )
              }}
            </p>
            <button
              class="account-primary"
              :disabled="
                busy || active.meta.dirty || !!active.meta.conflict || !!active.meta.pending
              "
            >
              {{ t('Save town details') }}
            </button>
          </form>
          <p v-if="active.meta.isPublic">
            <a :href="shareUrl" target="_blank" rel="noopener">{{ t('Town share link') }}</a>
          </p>
          <details :key="active.meta.id" class="account-history" @toggle="loadHistoryOnOpen">
            <summary>{{ t('Previous saves') }}</summary>
            <ul v-if="history.length">
              <li v-for="save in history" :key="save.revision">
                <span
                  ><strong>{{ date(save.updatedAt * 1000) }}</strong
                  ><small>{{ summary(save.profile) }}</small></span
                ><button :disabled="busy || game.sessionActive" @click="historyChoice = save">
                  {{ t('Review this save') }}
                </button>
              </li>
            </ul>
            <div v-if="historyChoice" class="account-confirm">
              <p>
                {{
                  t(
                    'Restore this previous save? Your current cloud copy will remain in save history.',
                  )
                }}
              </p>
              <button
                class="account-primary"
                :disabled="busy || game.sessionActive"
                @click="act(restoreHistory)"
              >
                {{ t('Restore previous save') }}</button
              ><button @click="historyChoice = null">{{ t('Cancel') }}</button>
            </div>
          </details>
          <details class="account-danger">
            <summary>{{ t('Delete this cloud town') }}</summary>
            <p>
              {{
                t(
                  'This frees an account slot and removes the public listing. The local copy is kept.',
                )
              }}
            </p>
            <label class="account-field"
              >{{ t('Type the town name to confirm') }}<input v-model="deleteName" /></label
            ><button
              class="account-destructive"
              :disabled="busy || game.sessionActive || deleteName !== active.meta.name"
              @click="act(() => townAction(active.meta.id, deleteTown))"
            >
              {{ t('Delete cloud town') }}
            </button>
          </details>
          <p v-if="active.meta.missing" class="account-message">
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
        <section v-for="entry in conflicts" :key="entry.meta.id" class="account-card save-conflict">
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
        <button class="account-community" @click="$emit('community')">
          <GameIcon name="eye" />{{ t('Visit shared towns') }}<GameIcon name="arrow" />
        </button>
        <footer class="account-footer">
          <button :disabled="busy" @click="act(() => logout())">{{ t('Sign out') }}</button>
          <button :disabled="busy" @click="act(() => logout(true))">
            {{ t('Sign out all devices') }}
          </button>
          <details class="account-danger">
            <summary>{{ t('Delete account') }}</summary>
            <label class="account-field"
              >{{ t('Type DELETE MY ACCOUNT to confirm') }}<input v-model="deleteAccountText"
            /></label>
            <button
              class="account-destructive"
              :disabled="busy || deleteAccountText !== 'DELETE MY ACCOUNT'"
              @click="act(deleteAccount)"
            >
              {{ t('Delete my account') }}
            </button>
          </details>
        </footer>
      </template>
    </div>
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
import GameIcon from '../GameIcon.vue';
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
const registeredLocal = computed(() =>
  active.value && !active.value.meta.owner
    ? cloud.towns.find((town) => town.townId === active.value.meta.id)
    : null,
);
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
const isCurrent = (town) =>
  props.writable &&
  active.value?.meta.owner === cloud.account.id &&
  active.value?.meta.id === town.townId;
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
function loadHistoryOnOpen(event) {
  if (event.target.open && !history.value.length) act(loadHistory);
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
  width: min(600px, calc(100vw - 24px));
  max-height: min(88dvh, 860px);
  padding: 0;
  border: 1px solid #ded5bd;
  border-radius: 20px;
  background: #fbf8ef;
  color: #294139;
  font:
    0.95rem/1.5 system-ui,
    sans-serif;
  box-shadow: 0 24px 100px #10292380;
  overflow: auto;
  overscroll-behavior: contain;
}
.account-panel::backdrop {
  background: #102923bb;
  backdrop-filter: blur(2px);
}
.account-heading {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem 0.9rem 1.4rem;
  background: #183832;
  color: #fff7df;
}
.account-heading img {
  width: 1.6rem;
  height: 1.6rem;
}
.account-heading h1 {
  flex: 1;
  margin: 0;
  font:
    1.5rem Georgia,
    serif;
}
.account-panel .account-close {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  margin: 0;
  color: #fff7df;
  background: #ffffff12;
  border: 1px solid #ffffff2b;
  border-radius: 50%;
}
.account-panel .account-close:hover {
  background: #ffffff26;
}
.account-close svg {
  width: 1.1rem;
  height: 1.1rem;
}
.account-body {
  display: grid;
  gap: 1rem;
  padding: 1.25rem 1.4rem 1.4rem;
}
.account-body p {
  margin: 0;
}
.account-lead {
  font:
    1.1rem/1.45 Georgia,
    serif;
}
.account-hint {
  color: #64756a;
  font-size: 0.85rem;
}
.account-message {
  padding: 0.7rem 0.9rem;
  background: #fff1cf;
  border: 1px solid #ecd49a;
  border-radius: 10px;
}
.account-card {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  padding: 1rem 1.1rem;
  background: #fffdf6;
  border: 1px solid #e3dbc7;
  border-radius: 14px;
}
.account-card > *,
.account-card form > * {
  max-width: 100%;
}
.account-card form {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  width: 100%;
}
.account-panel h2 {
  margin: 0;
  font:
    1.3rem Georgia,
    serif;
  overflow-wrap: anywhere;
}
.account-panel h2 small {
  display: block;
  color: #896b38;
  font: 600 0.7rem system-ui;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.account-field {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4d6156;
}
.account-check {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  cursor: pointer;
}
.account-check input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: #315940;
}
.account-panel input:not([type='checkbox']) {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.8rem;
  font: 400 0.95rem system-ui;
  color: #294139;
  background: #fff;
  border: 1px solid #cfc8b3;
  border-radius: 10px;
}
.account-panel input:focus-visible {
  outline: 2px solid #ab813e;
  outline-offset: 1px;
  border-color: #ab813e;
}
.account-panel button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  cursor: pointer;
  font: 600 0.9rem system-ui;
  padding: 0.6rem 1rem;
  background: #fffdf6;
  color: #294139;
  border: 1px solid #c9c3ad;
  border-radius: 999px;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.account-panel button:hover:not(:disabled) {
  background: #f1ecdd;
}
.account-panel button:focus-visible,
.account-panel summary:focus-visible,
.account-panel a:focus-visible {
  outline: 3px solid #ab813e;
  outline-offset: 2px;
}
.account-panel button:disabled {
  opacity: 0.5;
  cursor: default;
}
.account-panel .account-primary {
  background: #315940;
  color: #fffdf6;
  border-color: #315940;
}
.account-panel .account-primary:hover:not(:disabled) {
  background: #264a34;
}
.account-panel .account-destructive {
  background: #fff;
  color: #a53a2a;
  border-color: #e0a79c;
}
.account-panel .account-destructive:hover:not(:disabled) {
  background: #fbe9e5;
}
.account-panel a {
  color: #315940;
  font-weight: 600;
}
.account-summary {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.account-summary > div {
  flex: 1;
  min-width: 0;
  display: grid;
}
.account-summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
}
.account-avatar {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: #e9efdf;
  color: #315940;
}
.account-avatar svg {
  width: 1.3rem;
  height: 1.3rem;
}
.account-slots {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #64756a;
  font-size: 0.82rem;
}
.account-pip {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  border: 1.5px solid #9fb09f;
}
.account-pip.is-used {
  background: #315940;
  border-color: #315940;
}
.account-pip:last-of-type {
  margin-right: 0.3rem;
}
.account-panel .account-icon {
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  border-radius: 50%;
}
.account-icon svg {
  width: 1.1rem;
  height: 1.1rem;
}
.account-icon.is-busy svg {
  animation: cloud-spin 0.9s linear infinite;
}
.town-slots {
  display: grid;
  gap: 0.6rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.town-slots li {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  padding: 0.85rem 1rem;
  background: #fffdf6;
  border: 1px solid #e3dbc7;
  border-radius: 14px;
}
.town-slots li.is-current {
  background: #eef3e6;
  border-color: #b9ccb0;
}
.town-slots img {
  width: 2rem;
  height: 2rem;
}
.town-slot-info {
  flex: 1;
  min-width: 10rem;
  display: grid;
  overflow-wrap: anywhere;
}
.town-slot-info strong {
  font:
    1.1rem Georgia,
    serif;
}
.town-slot-info small {
  color: #64756a;
}
.town-slot-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
.account-panel .town-slot-tab {
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  color: #4d6156;
  border: 1px solid #c9c3ad;
  border-radius: 50%;
}
.town-slot-tab:hover {
  background: #f1ecdd;
}
.town-slot-tab svg {
  width: 1rem;
  height: 1rem;
}
.town-slot-badge {
  padding: 0.3rem 0.7rem;
  background: #315940;
  color: #fffdf6;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.8rem;
}
.account-create {
  background: transparent;
  border-style: dashed;
  border-color: #cfc5a8;
}
.account-panel details {
  width: 100%;
}
.account-panel summary {
  cursor: pointer;
  font-weight: 600;
  color: #4d6156;
}
.account-panel details[open] > summary {
  margin-bottom: 0.75rem;
}
.account-panel details > :not(summary) + :not(summary) {
  margin-top: 0.75rem;
}
.account-history ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.account-history li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid #ebe4d2;
}
.account-history li > span {
  display: grid;
  min-width: 0;
}
.account-history small {
  color: #64756a;
}
.account-confirm {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.8rem;
  background: #fff1cf;
  border-radius: 10px;
}
.account-confirm p {
  flex-basis: 100%;
}
.account-danger summary {
  color: #a53a2a;
}
.account-panel .account-community {
  width: 100%;
  justify-content: flex-start;
  padding: 0.9rem 1.1rem;
  background: #183832;
  color: #fff7df;
  border-color: #183832;
  border-radius: 14px;
  font:
    1.05rem Georgia,
    serif;
}
.account-panel .account-community:hover:not(:disabled) {
  background: #22493f;
}
.account-community svg {
  width: 1.2rem;
  height: 1.2rem;
}
.account-community svg:last-child {
  margin-left: auto;
}
.account-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e3dbc7;
}
.account-footer details {
  flex-basis: 100%;
}
.save-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
}
.save-comparison > div {
  padding: 0.7rem;
  background: #eee9d9;
  border-radius: 10px;
  overflow-wrap: anywhere;
}
.save-comparison h3 {
  margin: 0 0 0.3rem;
  font-size: 0.95rem;
}
.save-conflict {
  border-color: #ecd49a;
}
@keyframes cloud-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 480px) {
  .account-body {
    padding: 1rem;
  }
  .save-comparison {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .account-icon.is-busy svg {
    animation: none;
  }
}
</style>
