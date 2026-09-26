<template>
  <aside ref="bar" class="cloud-bar" :aria-label="t('Account and cloud save')">
    <div class="cloud-town-name">
      <img src="/art/amethyst.svg" alt="" />
      <div>
        <strong>{{ townName }}</strong
        ><small>{{ t(accountTown ? 'Account town' : 'Local town · this device only') }}</small>
      </div>
    </div>
    <span role="status">{{ t(cloud.status) }}</span>
    <button v-if="accountTown" :disabled="cloud.busy || !ready" @click="syncNow()">
      {{ t('Sync now') }}
    </button>
    <button :disabled="campaign.readOnly" @click="accountOpen = true">
      {{ t(cloud.account ? 'My towns' : 'Protect my progress') }}
    </button>
  </aside>
  <main v-if="!ready" class="town-launch-screen">
    <section class="town-tab-notice" aria-live="polite" :aria-busy="opening">
      <img class="town-tab-gem" src="/art/amethyst.svg" alt="" />
      <p class="town-tab-brand">PROSPECT HOLLOW</p>
      <h1>
        {{
          opening
            ? t('Opening {town}…', { town: townName })
            : blocked
              ? t('This town is already open')
              : t('Unable to open this town')
        }}
      </h1>
      <template v-if="opening">
        <p>{{ t('Preparing your saved town on this device.') }}</p>
      </template>
      <template v-else-if="blocked">
        <p>
          {{
            t('{town} is safe in your other tab. You can keep playing there.', { town: townName })
          }}
        </p>
        <p class="town-tab-hint">
          {{
            t(
              'To play here, close the other tab, then open your town below. Different towns can stay open in separate tabs.',
            )
          }}
        </p>
        <div class="town-tab-actions">
          <button class="town-tab-primary" @click="activate">{{ t('Open my town here') }}</button>
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
import {
  computed,
  ref,
  nextTick,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent,
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
  blocked = ref(false),
  notice = ref('This town is open in another tab.');
const activeTown = computed(() => {
  void cloud.storageVersion;
  return townStorage.active();
});
const accountTown = computed(
  () => !!cloud.account && activeTown.value?.meta.owner === cloud.account.id,
);
const townName = computed(() => activeTown.value?.meta.name || t('Your town'));
watch(
  townName,
  (name) => {
    document.title = `${name} · Prospect Hollow`;
  },
  { immediate: true },
);
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
      blocked.value = false;
      ready.value = false;
      const release = localProfile.suspendWrites();
      try {
        // Dispose renderers before releasing ownership. Cleanup cannot write a stale save.
        await nextTick();
        await townCoordinator.release();
        loadedKey = townStorage.selectedKey();
        if (!(await townCoordinator.acquire(loadedKey))) {
          blocked.value = true;
          return;
        }
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
        // Cloud latency must never delay local play or the duplicate-tab notice.
        if (cloud.account) void syncNow();
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
  start();
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
.town-launch-screen {
  min-height: calc(100dvh - var(--cloud-bar-height, 54px));
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
.cloud-town-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: auto;
  overflow-wrap: anywhere;
}
.cloud-town-name small {
  display: block;
  color: #e1d9bd;
  font-size: 0.68rem;
  line-height: 1.25;
}
.cloud-town-name img {
  width: 1.5rem;
  height: 1.5rem;
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
