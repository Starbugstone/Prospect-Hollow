<template>
  <aside ref="bar" class="cloud-bar" :aria-label="t('Account and cloud save')">
    <span role="status">{{ t(cloud.status) }}</span>
    <button v-if="cloud.account" :disabled="cloud.busy || !ready" @click="syncNow()">
      {{ t('Sync now') }}
    </button>
    <button :disabled="campaign.readOnly" @click="accountOpen = true">
      {{ t(cloud.account ? 'My towns' : 'Protect my progress') }}
    </button>
  </aside>
  <main v-if="!ready" class="town-tab-notice" role="status">
    <h1>{{ t('Prospect Hollow') }}</h1>
    <p>{{ t(opening ? 'Opening town…' : notice) }}</p>
    <p v-if="!opening">
      {{
        t(
          'Different towns can be played in separate tabs. Close the other tab to open this town here.',
        )
      }}
    </p>
    <button v-if="!opening" @click="activate">{{ t('Try opening this town again') }}</button>
    <button @click="accountOpen = true">
      {{ t(cloud.account ? 'Choose another town' : 'Protect my progress') }}
    </button>
  </main>
  <App v-if="ready" :key="viewVersion" :suspended="accountOpen || communityOpen" />
  <AccountPanel
    v-if="accountOpen"
    :login-link="loginLink"
    :writable="ready"
    @close="accountOpen = false"
    @changed="reload"
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
import { ref, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent, watch } from 'vue';
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
import { createSyncScheduler } from '../services/syncScheduler';
const AccountPanel = defineAsyncComponent(() => import('./account/AccountPanel.vue'));
const CommunityPanel = defineAsyncComponent(() => import('./community/CommunityPanel.vue'));
townStorage.setWriteGuard(townCoordinator.owns);
const campaign = useCampaignStore(),
  game = useGameStore();
const accountOpen = ref(false),
  communityOpen = ref(false),
  viewVersion = ref(0),
  loginLink = ref(''),
  bar = ref(null),
  ready = ref(false),
  opening = ref(true),
  notice = ref('This town is open in another tab.');
const visitId = ref(new URLSearchParams(location.hash.slice(1)).get('town') ?? '');
let observer,
  loadedKey,
  activation = Promise.resolve(),
  lastResume = 0;
const scheduler = createSyncScheduler({
  pending: () => {
    if (!ready.value || !cloud.account || !townStorage.canWrite()) return false;
    const meta = townStorage.active()?.meta;
    return (
      meta?.owner === cloud.account.id &&
      !meta.missing &&
      (meta.pending || (meta.dirty && !meta.conflict))
    );
  },
  sync: syncNow,
});
function activate() {
  activation = activation
    .catch(() => {})
    .then(async () => {
      if (ready.value && loadedKey === townStorage.selectedKey()) return;
      opening.value = true;
      ready.value = false;
      const release = localProfile.suspendWrites();
      try {
        // Dispose renderers before releasing ownership. Cleanup cannot write a stale save.
        await nextTick();
        await townCoordinator.release();
        loadedKey = townStorage.selectedKey();
        if (!(await townCoordinator.acquire(loadedKey))) return;
        if (loadedKey !== townStorage.selectedKey()) {
          activate();
          return;
        }
        release();
        campaign.reloadLocal();
        if (!campaign.readOnly) townStorage.ensure(JSON.parse(campaign.exportSave()).profile);
        ready.value = true;
        const url = new URL(location.href),
          meta = townStorage.active()?.meta;
        if (meta?.owner) url.searchParams.set('play', meta.id);
        else url.searchParams.delete('play');
        history.replaceState(null, '', url);
        if (cloud.account) await syncNow();
      } catch (error) {
        notice.value = error.message;
      } finally {
        release();
        opening.value = false;
        schedule();
      }
    });
  return activation;
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
function configureTownSync() {
  configureSync({
    targets: (owner) => {
      const active = townStorage.active();
      return active?.meta.owner === owner ? [active] : [];
    },
    eligible: (id, owner) => ready.value && townStorage.selectedKey() === townKey(id, owner),
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
  if (loadedKey && loadedKey !== townStorage.selectedKey()) activate();
  scheduler.schedule();
}
function resume() {
  if (document.hidden || !cloud.account || !ready.value) return;
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
}
async function openRequestedTown() {
  const id = new URL(location.href).searchParams.get('play');
  if (id && cloud.account && townStorage.active()?.meta.id !== id) {
    await cacheTown({ townId: id });
    townStorage.select(id, cloud.account.id);
  }
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
  observer = new ResizeObserver(() =>
    document.documentElement.style.setProperty('--cloud-bar-height', `${bar.value.offsetHeight}px`),
  );
  observer.observe(bar.value);
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
  if (cloud.account)
    refreshAccount()
      .then(openRequestedTown)
      .then(activate)
      .catch((error) => {
        cloud.error = error.message;
        cloud.status = 'Offline — cloud backup pending';
        activate();
      });
  else activate();
});
onBeforeUnmount(() => {
  scheduler.dispose();
  observer?.disconnect();
  townCoordinator.release();
  window.removeEventListener(TOWN_CHANGED, schedule);
  window.removeEventListener('storage', fromOtherTab);
  window.removeEventListener('online', resume);
  window.removeEventListener('pageshow', resume);
  window.removeEventListener('hashchange', readLink);
  document.removeEventListener('visibilitychange', resume);
  document.documentElement.classList.remove('cloud-mode');
});
</script>
<style>
.town-tab-notice {
  max-width: 42rem;
  margin: 3rem auto;
  padding: 1.5rem;
  font: 1rem/1.6 system-ui;
  background: #fbf8ef;
  color: #294139;
  border-radius: 16px;
}
.town-tab-notice button {
  padding: 0.7rem;
  margin: 0.3rem;
  cursor: pointer;
  background: #ffdc99;
  color: #193d30;
  border: 1px solid #c4bea9;
  border-radius: 8px;
}
.cloud-mode .town-map-frame.town-fullscreen {
  top: var(--cloud-bar-height, 54px);
  height: calc(100dvh - var(--cloud-bar-height, 54px));
}
.cloud-bar {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  padding: 0.55rem 1rem;
  background: #183832;
  color: #fff7df;
  font: 0.85rem system-ui;
  position: sticky;
  top: 0;
  z-index: 95;
}
.cloud-bar button {
  background: #ffdc99;
  color: #192c2b;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.55rem 0.8rem;
  cursor: pointer;
  font: inherit;
}
.cloud-bar button:disabled {
  opacity: 0.5;
}
</style>
