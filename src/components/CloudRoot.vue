<template>
  <div ref="recoveryBar" class="cloud-header">
    <aside
      v-if="ready && (activeTown?.meta.conflict || activeTown?.meta.desyncNotice)"
      class="save-recovery-notice"
      role="status"
    >
      <p>
        {{
          t(
            activeTown?.meta.conflict
              ? 'This town changed on another device. The latest cloud save will load when you return to the village. Your local progress will be kept.'
              : 'This town changed on another device. The latest cloud save has been loaded. Your local save has been kept.',
          )
        }}
      </p>
      <button
        :disabled="game.sessionActive || !!activeTown?.meta.conflict"
        @click="recoveryOpen = true"
      >
        {{ t('Review preserved local save') }}
      </button>
      <button v-if="!activeTown?.meta.conflict" @click="dismissRecovery">{{ t('Dismiss') }}</button>
    </aside>
  </div>
  <main v-if="!ready" class="town-launch-screen">
    <section class="town-tab-notice" aria-live="polite" :aria-busy="opening">
      <img class="town-tab-gem" src="/art/amethyst.svg" alt="" />
      <p class="town-tab-brand">PROSPECT HOLLOW</p>
      <h1>
        {{
          opening
            ? t(takingOver ? 'Moving {town} here…' : 'Opening {town}…', { town: townName })
            : blocked
              ? t(moved ? 'Play moved to another window' : 'This town is already open')
              : t('Unable to open this town')
        }}
      </h1>
      <template v-if="opening">
        <p>
          {{
            t(
              takingOver
                ? 'Waiting for the other window to finish its move and save your progress.'
                : 'Preparing your saved town on this device.',
            )
          }}
        </p>
      </template>
      <template v-else-if="blocked">
        <p>
          {{
            t(
              moved
                ? 'This window is paused. Your town is now being played in another tab or window.'
                : '{town} is open in another tab or window.',
              { town: townName },
            )
          }}
        </p>
        <p class="town-tab-hint">
          {{
            t(
              'Open it here to move your game to this window and pause the other one. Different towns can stay open at the same time.',
            )
          }}
        </p>
        <p v-if="transferError" role="alert">{{ t(transferError) }}</p>
        <div class="town-tab-actions">
          <button class="town-tab-primary" @click="activate({ takeOver: true })">
            {{ t('Open my town here') }}
          </button>
          <button @click="accountOpen = true">
            {{ t(cloud.account ? 'My towns' : 'Protect my progress') }}
          </button>
        </div>
      </template>
      <template v-else>
        <p role="alert">{{ t(notice) }}</p>
        <p>{{ t('Your saved progress has been kept.') }}</p>
        <div class="town-tab-actions">
          <button class="town-tab-primary" @click="start">{{ t('Try again') }}</button>
          <button @click="accountOpen = true">
            {{ t(cloud.account ? 'My towns' : 'Protect my progress') }}
          </button>
        </div>
      </template>
    </section>
  </main>
  <div v-if="handingOver" class="town-handoff-overlay" role="status">
    {{ t('Saving your game for the other window…') }}
  </div>
  <App
    v-if="ready"
    :key="viewVersion"
    :suspended="handingOver || accountOpen || communityOpen || recoveryOpen"
  />
  <SaveRecoveryDialog v-if="recoveryOpen && ready" @close="recoveryOpen = false" />
  <AccountPanel
    v-if="accountOpen"
    :login-link="loginLink"
    :writable="ready"
    @close="accountOpen = false"
    @changed="reload"
    @recovery="
      accountOpen = false;
      recoveryOpen = true;
    "
    @community="
      communityOpen = true;
      accountOpen = false;
    "
  />
  <CommunityPanel
    :visit-id="visitId"
    v-if="communityOpen && cloud.account"
    @close="communityOpen = false"
  />
</template>
<script setup>
import {
  computed,
  ref,
  nextTick,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent,
  provide,
  watch,
} from 'vue';
import App from '../App.vue';
import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import {
  cloud,
  configureSync,
  refreshAccount,
  syncNow,
  cacheTown,
  updateSaveStatus,
} from '../services/cloudProfile';
import { townStorage, townKey, TOWN_CHANGED, ACCOUNT_KEY } from '../services/townStorage';
import { t } from '../i18n';
import { localProfile } from '../services/localProfile';
import { townCoordinator } from '../services/townCoordinator';
import { createTownHandoff } from '../services/townHandoff';
import { createSyncScheduler } from '../services/syncScheduler';
const AccountPanel = defineAsyncComponent(() => import('./account/AccountPanel.vue'));
const CommunityPanel = defineAsyncComponent(() => import('./community/CommunityPanel.vue'));
const SaveRecoveryDialog = defineAsyncComponent(() => import('./account/SaveRecoveryDialog.vue'));
townStorage.setWriteGuard(townCoordinator.owns);
const campaign = useCampaignStore(),
  game = useGameStore();
const recoveryBar = ref(null);
let recoveryObserver;
const accountOpen = ref(false),
  recoveryOpen = ref(false),
  communityOpen = ref(false),
  viewVersion = ref(0),
  loginLink = ref(''),
  ready = ref(false),
  opening = ref(true),
  blocked = ref(false),
  moved = ref(false),
  takingOver = ref(false),
  handingOver = ref(false),
  transferError = ref(''),
  notice = ref('This town is open in another tab.');
const activeTown = computed(() => {
  void cloud.storageVersion;
  return townStorage.active();
});
const accountTown = computed(
  () => !!cloud.account && activeTown.value?.meta.owner === cloud.account.id,
);
const STATUS_TONES = {
  'Cloud saved': 'saved',
  'Syncing…': 'busy',
  'Saved locally — cloud backup pending': 'pending',
  'Offline — cloud backup pending': 'pending',
  'Cloud update pending — local save kept': 'alert',
  'Cloud town unavailable — local copy kept': 'alert',
};
const statusTone = computed(() => STATUS_TONES[cloud.status] ?? 'local');
const townName = computed(() => activeTown.value?.meta.name || t('Your town'));
// Account controls live in the settings drawer instead of a permanent top bar.
provide('cloudAccount', {
  townName,
  accountTown,
  statusTone,
  status: computed(() => cloud.status),
  signedIn: computed(() => !!cloud.account),
  canSync: computed(() => accountTown.value && ready.value && !handingOver.value && !cloud.busy),
  canOpen: computed(() => !campaign.readOnly),
  sync: () => syncNow(),
  open: () => {
    accountOpen.value = true;
  },
});
watch(
  townName,
  (name) => {
    document.title = `${name} · Prospect Hollow`;
  },
  { immediate: true },
);
const visitId = ref(new URLSearchParams(location.hash.slice(1)).get('town') ?? '');
let handoff,
  loadedKey,
  activation = Promise.resolve(),
  lastResume = 0;
const scheduler = createSyncScheduler({
  pending: () => {
    if (!ready.value || handingOver.value || !cloud.account || !townStorage.canWrite())
      return false;
    const meta = townStorage.active()?.meta;
    return (
      meta?.owner === cloud.account.id &&
      !meta.missing &&
      (meta.pending || (meta.conflict ? !game.sessionActive : meta.dirty))
    );
  },
  sync: syncNow,
});
function activate({ takeOver = false } = {}) {
  activation = activation
    .catch(() => {})
    .then(async () => {
      if (ready.value && loadedKey === townStorage.selectedKey()) return;
      opening.value = true;
      takingOver.value = takeOver;
      transferError.value = '';
      blocked.value = false;
      ready.value = false;
      const release = localProfile.suspendWrites();
      try {
        // Dispose renderers before releasing ownership. Cleanup cannot write a stale save.
        await nextTick();
        await townCoordinator.release();
        loadedKey = townStorage.selectedKey();
        const acquired =
          takeOver && handoff
            ? await handoff.openHere(loadedKey)
            : await townCoordinator.acquire(loadedKey);
        if (!acquired) {
          blocked.value = true;
          if (takeOver && !handoff)
            transferError.value =
              'This browser cannot transfer between windows. Close the other window, then try again.';
          return;
        }
        if (loadedKey !== townStorage.selectedKey()) {
          activate();
          return;
        }
        release();
        campaign.reloadLocal();
        if (!campaign.readOnly) townStorage.ensure(JSON.parse(campaign.exportSave()).profile);
        const puzzle = townStorage.handoff();
        if (puzzle) {
          game.restoreHandoff(puzzle);
          townStorage.handoff(null);
        }
        moved.value = false;
        ready.value = true;
        const url = new URL(location.href),
          meta = townStorage.active()?.meta;
        if (meta?.owner) url.searchParams.set('play', meta.id);
        else url.searchParams.delete('play');
        history.replaceState(null, '', url);
        // Cloud latency must never delay local play or the duplicate-tab notice.
        if (cloud.account) void syncNow();
      } catch (error) {
        notice.value = error.message;
        if (takeOver) {
          blocked.value = true;
          transferError.value = error.message;
        }
      } finally {
        release();
        opening.value = false;
        takingOver.value = false;
        schedule();
      }
    });
  return activation;
}
async function prepareHandoff(key, checkDeadline) {
  const check = () => {
    checkDeadline();
    if (!ready.value || key !== townStorage.selectedKey() || !townCoordinator.owns(key))
      throw new Error('The selected town changed. Try opening it again.');
  };
  check();
  handingOver.value = true;
  accountOpen.value = false;
  recoveryOpen.value = false;
  communityOpen.value = false;
  scheduler.schedule();
  try {
    await nextTick(); // Pause inputs; a move already accepted may finish normally.
    if (game.animationInProgress || game.pendingBoardState) {
      await new Promise((resolve, reject) => {
        const stop = watch(
          () => game.animationInProgress || !!game.pendingBoardState,
          (busy) => {
            if (!busy) {
              clearTimeout(timer);
              stop();
              resolve();
            }
          },
          { flush: 'post' },
        );
        const timer = setTimeout(() => {
          stop();
          reject(new Error('The current move is still finishing. Try again shortly.'));
        }, 5000);
      });
    }
    await townCoordinator.drain(key);
    check();
    game.syncContinuous();
    campaign.accrueSaloonIncome(Date.now(), false);
    const puzzle = game.captureHandoff();
    if (!campaign.save())
      throw new Error('Your progress could not be saved. Keep playing in the original window.');
    townStorage.handoff(puzzle);
    const resumeWrites = localProfile.suspendWrites();
    try {
      ready.value = false;
      blocked.value = true;
      moved.value = true;
      transferError.value = '';
      await nextTick(); // Dispose renderers and invalidate old asynchronous moves before unlock.
    } finally {
      resumeWrites();
    }
  } finally {
    handingOver.value = false;
    schedule();
  }
}
function reload() {
  if (loadedKey !== townStorage.selectedKey() || !ready.value) {
    activate();
    return;
  }
  const release = localProfile.suspendWrites();
  try {
    game.exitLevel();
    campaign.reloadLocal();
    viewVersion.value++;
  } finally {
    // Vue unmounts the old view and mounts the replacement on its next flush.
    // Their income/cleanup hooks must not echo a stale snapshot into another tab.
    nextTick(release);
  }
}
function dismissRecovery() {
  const meta = activeTown.value?.meta;
  if (meta?.owner && ready.value)
    townStorage.mutate(meta.id, meta.owner, (entry) => {
      entry.meta.desyncNotice = false;
    });
}
function configureTownSync() {
  configureSync({
    targets: (owner) => {
      const active = townStorage.active();
      return active?.meta.owner === owner ? [active] : [];
    },
    eligible: (id, owner) =>
      ready.value && !handingOver.value && townStorage.selectedKey() === townKey(id, owner),
    run: (id, owner, operation) => townCoordinator.run(townKey(id, owner), operation),
    canApply: (id) => townStorage.active()?.meta.id !== id || !game.sessionActive,
    applied: (id) => {
      if (townStorage.active()?.meta.id === id) reload();
    },
  });
}
try {
  configureTownSync();
} catch (error) {
  cloud.error = error.message;
}
function schedule() {
  cloud.storageVersion++;
  if (!cloud.busy) updateSaveStatus();
  if (loadedKey && loadedKey !== townStorage.selectedKey()) {
    handoff?.cancel();
    activate();
  }
  scheduler.schedule();
}
function resume() {
  if (document.hidden || !cloud.account || !ready.value || handingOver.value) return;
  scheduler.resume();
  // A clean town may have changed on another device. Check only on return,
  // at most once per minute, never on every local checkpoint or storage event.
  const meta = townStorage.active()?.meta;
  if (!meta?.dirty && !meta?.pending && Date.now() - lastResume > 60000) {
    lastResume = Date.now();
    syncNow();
  }
}
function fromOtherTab(event) {
  if (event.key === ACCOUNT_KEY || event.key === null) {
    configureTownSync();
    if (loadedKey !== townStorage.selectedKey()) activate();
    scheduler.schedule();
    if (cloud.account)
      refreshAccount().catch((error) => {
        cloud.error = error.message;
      });
  }
  // Another town's writes never reload this renderer or schedule its uploads.
  cloud.storageVersion++;
  if (!cloud.busy) updateSaveStatus();
}
async function openRequestedTown(initial = false) {
  let id = new URL(location.href).searchParams.get('play');
  if (!id && initial && cloud.account && !townStorage.hasSelection())
    id = townStorage.preferredTown(cloud.account.id)?.meta.id;
  if (id && cloud.account && townStorage.selectedKey() !== townKey(id, cloud.account.id)) {
    await cacheTown({ townId: id });
    townStorage.select(id, cloud.account.id);
  }
  townStorage.pinSelection();
}
function start() {
  opening.value = true;
  blocked.value = false;
  // A cached selection (including a URL opened in another tab) is entirely local.
  openRequestedTown(true)
    .then(activate)
    .catch((error) => {
      opening.value = false;
      notice.value = error.message;
    });
  if (cloud.account)
    refreshAccount().catch((error) => {
      cloud.error = error.message;
      cloud.status = 'Offline — cloud backup pending';
    });
}
function readLink() {
  const token = new URLSearchParams(location.hash.slice(1)).get('login');
  if (!token) return;
  loginLink.value = token;
  accountOpen.value = true;
  history.replaceState(null, '', location.pathname + location.search);
}
watch(
  () => cloud.account?.id,
  (next, previous) => {
    if (next && visitId.value) {
      communityOpen.value = true;
      accountOpen.value = false;
    }
    if (previous && !next) communityOpen.value = false;
    openRequestedTown()
      .then(activate)
      .catch((error) => {
        cloud.error = error.message;
      });
  },
);
watch(
  () => game.sessionActive,
  (active) => {
    if (!active) schedule();
  },
);
onMounted(() => {
  document.documentElement.classList.add('cloud-mode');
  recoveryObserver = new ResizeObserver(() =>
    document.documentElement.style.setProperty(
      '--cloud-bar-height',
      `${recoveryBar.value.offsetHeight}px`,
    ),
  );
  recoveryObserver.observe(recoveryBar.value);
  if (typeof BroadcastChannel === 'function')
    handoff = createTownHandoff({ coordinator: townCoordinator, prepare: prepareHandoff });
  window.addEventListener(TOWN_CHANGED, schedule);
  window.addEventListener('storage', fromOtherTab);
  window.addEventListener('online', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('hashchange', readLink);
  document.addEventListener('visibilitychange', resume);
  readLink();
  if (visitId.value) {
    if (cloud.account) communityOpen.value = true;
    else accountOpen.value = true;
  }
  start();
});
onBeforeUnmount(() => {
  recoveryObserver?.disconnect();
  document.documentElement.classList.remove('cloud-mode');
  document.documentElement.style.removeProperty('--cloud-bar-height');
  handoff?.dispose();
  scheduler.dispose();
  townCoordinator.release();
  window.removeEventListener(TOWN_CHANGED, schedule);
  window.removeEventListener('storage', fromOtherTab);
  window.removeEventListener('online', resume);
  window.removeEventListener('pageshow', resume);
  window.removeEventListener('hashchange', readLink);
  document.removeEventListener('visibilitychange', resume);
});
</script>
<style>
.save-recovery-notice {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #294139;
  background: #fff0ca;
  border-bottom: 1px solid #c9b781;
  font: 0.95rem/1.5 system-ui;
}
.save-recovery-notice p {
  flex: 1 1 24rem;
  margin: 0;
}
.save-recovery-notice button {
  font: inherit;
  padding: 0.65rem 0.8rem;
  border: 1px solid #bdc5af;
  border-radius: 0.6rem;
  background: #fffdf6;
  color: #294139;
  cursor: pointer;
}
.save-recovery-notice button:disabled {
  opacity: 0.6;
  cursor: default;
}
.cloud-header {
  position: sticky;
  top: 0;
  z-index: 95;
}
.town-handoff-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: #fffdf6e8;
  color: #294139;
  text-align: center;
  font: 1.2rem/1.5 system-ui;
}
.town-launch-screen {
  min-height: 100dvh;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 4vw, 3rem);
  background: radial-gradient(ellipse at top, #e9eddc, #f6f1e6 65%);
  color: #294139;
}
.town-tab-notice {
  width: min(100%, 36rem);
  box-sizing: border-box;
  padding: clamp(1.4rem, 4vw, 3rem);
  text-align: center;
  font: 1rem/1.65 system-ui;
  background: #fffdf6;
  border: 1px solid #d9d6c1;
  border-radius: 1.5rem;
  box-shadow: 0 1rem 3rem #1838320d;
}
.town-tab-gem {
  width: 3.5rem;
  height: 3.5rem;
}
.town-tab-brand {
  color: #896b38;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
}
.town-tab-notice h1 {
  font:
    clamp(1.6rem, 4vw, 2.1rem)/1.25 Georgia,
    serif;
  margin: 1rem 0;
}
.town-tab-hint {
  color: #596b5f;
  font-size: 0.9rem;
}
.town-tab-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.5rem;
}
.town-tab-actions button {
  padding: 0.8rem 1rem;
  cursor: pointer;
  font: inherit;
  background: #fffdf6;
  color: #294139;
  border: 1px solid #bdc6b4;
  border-radius: 0.65rem;
}
.town-tab-actions .town-tab-primary {
  background: #315940;
  color: #fffdf6;
  border-color: #315940;
}
.town-tab-actions button:focus-visible {
  outline: 3px solid #ab813e;
  outline-offset: 3px;
}
.cloud-mode .town-map-frame.town-fullscreen {
  top: var(--cloud-bar-height, 0px);
  height: calc(100dvh - var(--cloud-bar-height, 0px));
}
</style>
