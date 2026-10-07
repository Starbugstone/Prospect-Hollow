<template>
  <aside
    v-if="ready && !handingOver && !game.sessionActive && cloud.sessionExpired"
    class="save-recovery-toast"
    role="status"
  >
    <GameIcon name="cloud" />
    <p>
      {{ t('Your session expired. Keep playing offline; sign in again to resume cloud saving.') }}
    </p>
    <button class="save-recovery-compare" @click="accountOpen = true">
      {{ t('Sign in again') }}
    </button>
  </aside>
  <aside
    v-else-if="ready && !handingOver && !game.sessionActive && blockedUpload"
    class="save-recovery-toast"
    role="alert"
  >
    <GameIcon name="cloud" />
    <p>
      {{ t('Cloud saving is paused. Your progress is saved on this device.') }}
      {{ t(activeMeta.uploadError.message) }}
    </p>
    <button
      class="save-recovery-compare"
      @click="syncNow({ retryRejected: true })"
      :disabled="cloud.busy"
    >
      {{ t('Retry cloud saving') }}
    </button>
  </aside>
  <aside
    v-else-if="ready && !handingOver && recoveryToast"
    class="save-recovery-toast"
    role="status"
  >
    <GameIcon name="devices" />
    <p>
      {{
        t(
          activeMeta.conflict
            ? 'You played {town} on another device. That save will load when you return to the village.'
            : 'You played {town} on another device, so we loaded that save.',
          { town: townName },
        )
      }}
    </p>
    <button v-if="!activeMeta.conflict" class="save-recovery-compare" @click="recoveryOpen = true">
      {{ t('Compare saves') }}
    </button>
    <button
      v-if="!activeMeta.conflict"
      class="save-recovery-dismiss"
      :aria-label="t('Dismiss')"
      :title="t('Dismiss')"
      @click="dismissRecovery"
    >
      <GameIcon name="close" />
    </button>
  </aside>
  <main v-if="!ready" class="town-launch-screen">
    <section class="town-tab-notice" aria-live="polite" :aria-busy="opening">
      <img class="town-tab-gem" src="/art/amethyst.svg" alt="" />
      <p class="town-tab-brand">PROSPECT HOLLOW</p>
      <h1>
        {{
          opening
            ? t(takingOver ? 'Moving {town} here…' : 'Opening {town}…', { town: townName })
            : blocked
              ? t(moved ? 'Play moved to another window' : '{town} is open in another tab', {
                  town: townName,
                })
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
                ? 'This window is paused while you play in the other one.'
                : 'Only one tab plays a town at a time, so no progress gets lost.',
            )
          }}
        </p>
        <p v-if="transferError" role="alert">{{ t(transferError) }}</p>
        <div class="town-tab-actions">
          <button class="town-tab-primary" @click="activate({ takeOver: true })">
            {{ t('Play here instead') }}
          </button>
          <button v-if="cloud.account" @click="accountOpen = true">
            {{ t('Play another town') }}
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
  <SaveRecoveryDialog
    v-if="recoveryOpen && ready"
    @close="recoveryOpen = false"
    @keep="
      recoveryOpen = false;
      dismissRecovery();
    "
  />
  <AccountPanel
    v-if="accountOpen"
    :login-link="loginLink"
    :email-link="emailLink"
    :section="accountSection"
    :writable="ready"
    @close="accountOpen = false"
    @changed="reload"
    @signed-in="loginLink = ''"
    @email-confirmed="emailLink = ''"
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
    v-if="communityOpen && cloud.account"
    @close="communityOpen = false"
    @share="openSharing"
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
import { describeSaveState } from '../services/saveStatus';
import { uploadBlocked } from '../services/syncService';
import { syncTownParam } from '../services/appRoute';
import { receivedDistinctions } from '../data/playerDistinctions';
import GameIcon from './GameIcon.vue';
const AccountPanel = defineAsyncComponent(() => import('./account/AccountPanel.vue'));
const CommunityPanel = defineAsyncComponent(() => import('./community/CommunityPanel.vue'));
const SaveRecoveryDialog = defineAsyncComponent(() => import('./account/SaveRecoveryDialog.vue'));
townStorage.setWriteGuard(townCoordinator.owns);
const campaign = useCampaignStore(),
  game = useGameStore();
const accountOpen = ref(false),
  // The town section the account panel opens on, such as 'sharing'; cleared on close.
  accountSection = ref(''),
  recoveryOpen = ref(false),
  communityOpen = ref(false),
  viewVersion = ref(0),
  loginLink = ref(''),
  emailLink = ref(''),
  ready = ref(false),
  opening = ref(true),
  blocked = ref(false),
  moved = ref(false),
  takingOver = ref(false),
  handingOver = ref(false),
  transferError = ref(''),
  notice = ref('This town is open in another tab.');
// Metadata only, parsed once per stored save (see townStorage.activeMeta).
const activeMeta = computed(() => {
  void cloud.storageVersion;
  return townStorage.activeMeta();
});
const blockedUpload = computed(() => uploadBlocked(activeMeta.value));
const accountTown = computed(() => !!cloud.account && activeMeta.value?.owner === cloud.account.id);
const townName = computed(() => activeMeta.value?.name || t('Your town'));
const shared = computed(() => accountTown.value && !!activeMeta.value?.isPublic);
watch(accountOpen, (open) => {
  if (!open) accountSection.value = '';
});
// Every "Share my town" button opens the sharing switch of the town being played.
function openSharing() {
  communityOpen.value = false;
  accountSection.value = 'sharing';
  accountOpen.value = true;
}
const saveState = computed(() =>
  describeSaveState({
    signedIn: !!cloud.account,
    sessionExpired: cloud.sessionExpired,
    accountTown: accountTown.value,
    status: cloud.status,
    meta: activeMeta.value,
  }),
);
// Never cover an active puzzle; the notice waits for the village.
const recoveryToast = computed(
  () =>
    accountTown.value &&
    !game.sessionActive &&
    (activeMeta.value.conflict || activeMeta.value.desyncNotice) &&
    !recoveryOpen.value,
);
// Account controls live in the village save pill and the settings drawer.
provide('cloudAccount', {
  townName,
  accountTown,
  // Whether the town being played is backed up and open to visitors.
  shared,
  saveState,
  cloudAt: computed(() => (activeMeta.value?.cloudAt ?? 0) * 1000),
  signedIn: computed(() => !!cloud.account),
  accountId: computed(() => cloud.account?.id ?? null),
  // The player's own distinctions, kept with the account record for offline play.
  distinctions: computed(() => receivedDistinctions(cloud.account)),
  canSync: computed(
    () =>
      accountTown.value &&
      ready.value &&
      !handingOver.value &&
      !cloud.busy &&
      !cloud.sessionExpired,
  ),
  canOpen: computed(() => !campaign.readOnly),
  canReview: computed(() => ready.value && !handingOver.value && !game.sessionActive),
  sync: () => syncNow({ retryRejected: true }),
  open: () => {
    accountOpen.value = true;
  },
  // The player's profile, data, devices and account deletion.
  openOffice: () => {
    accountSection.value = 'office';
    accountOpen.value = true;
  },
  openRecovery: () => {
    if (!game.sessionActive) recoveryOpen.value = true;
  },
  openCommunity: () => {
    communityOpen.value = true;
  },
  openSharing,
});
watch(
  townName,
  (name) => {
    document.title = `${name} · Prospect Hollow`;
  },
  { immediate: true },
);
let handoff,
  loadedKey,
  activation = Promise.resolve(),
  lastResume = 0;
const scheduler = createSyncScheduler({
  pending: () => {
    if (
      !ready.value ||
      handingOver.value ||
      !cloud.account ||
      cloud.sessionExpired ||
      blockedUpload.value ||
      !townStorage.canWrite()
    )
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
        if (!campaign.readOnly) townStorage.ensure(campaign.profile());
        const puzzle = townStorage.handoff();
        if (puzzle) {
          game.restoreHandoff(puzzle);
          townStorage.handoff(null);
        }
        moved.value = false;
        ready.value = true;
        syncTownParam();
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
    campaign.accrueSaloonIncome();
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
  const meta = activeMeta.value;
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
  if (
    document.hidden ||
    !cloud.account ||
    cloud.sessionExpired ||
    !ready.value ||
    handingOver.value
  )
    return;
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
      if (cloud.sessionExpired) updateSaveStatus();
      else cloud.status = 'offline';
    });
}
// Sign-in (#login=) and email change (#email=) links open the account panel.
function readLink() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const login = hash.get('login'),
    email = hash.get('email');
  if (!login && !email) return;
  if (login) loginLink.value = login;
  if (email) emailLink.value = email;
  accountOpen.value = true;
  history.replaceState(null, '', location.pathname + location.search);
}
watch(
  () => cloud.account?.id,
  (next, previous) => {
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
  if (typeof BroadcastChannel === 'function')
    handoff = createTownHandoff({ coordinator: townCoordinator, prepare: prepareHandoff });
  window.addEventListener(TOWN_CHANGED, schedule);
  window.addEventListener('storage', fromOtherTab);
  window.addEventListener('online', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('hashchange', readLink);
  document.addEventListener('visibilitychange', resume);
  readLink();
  start();
});
onBeforeUnmount(() => {
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
.save-recovery-toast {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  z-index: 150;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: max-content;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
  padding: 0.55rem 0.6rem 0.55rem 1rem;
  color: #fff7df;
  background: #183832;
  border-radius: 14px;
  box-shadow: 0 10px 30px #0005;
  font: 0.9rem/1.4 system-ui;
}
.save-recovery-toast > svg {
  width: 20px;
  height: 20px;
}
.save-recovery-toast p {
  margin: 0;
}
.save-recovery-toast button {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  min-height: 36px;
  padding: 0.4rem 0.9rem;
  font: 600 0.85rem system-ui;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.save-recovery-compare {
  background: #e9c46a;
  color: #183832;
}
.save-recovery-dismiss {
  width: 36px;
  padding: 0;
  background: #ffffff1a;
  color: #fff7df;
}
.save-recovery-dismiss svg {
  width: 16px;
  height: 16px;
}
.save-recovery-toast button:disabled {
  opacity: 0.6;
  cursor: default;
}
.save-recovery-toast button:focus-visible {
  outline: 3px solid #e9c46a;
  outline-offset: 2px;
}
@media (max-width: 560px) {
  .save-recovery-toast {
    flex-wrap: wrap;
    width: calc(100vw - 24px);
  }
  .save-recovery-toast p {
    flex: 1 1 12rem;
  }
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
</style>
