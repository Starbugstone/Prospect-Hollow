<template>
  <aside ref="bar" class="cloud-bar" :aria-label="t('Account and cloud save')">
    <span role="status">{{ t(cloud.status) }}</span>
    <button v-if="cloud.account" :disabled="cloud.busy" @click="syncNow">
      {{ t('Sync now') }}
    </button>
    <button :disabled="campaign.readOnly" @click="accountOpen = true">
      {{ t(cloud.account ? 'My towns' : 'Protect my progress') }}
    </button>
  </aside>
  <App :key="viewVersion" :suspended="accountOpen || communityOpen" />
  <AccountPanel
    v-if="accountOpen"
    :login-link="loginLink"
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
import { cloud, configureSync, refreshAccount, syncNow } from '../services/cloudProfile';
import { townStorage, townViewChanged, TOWN_CHANGED, SAVE_KEY } from '../services/townStorage';
import { t } from '../i18n';
import { localProfile } from '../services/localProfile';
const AccountPanel = defineAsyncComponent(() => import('./account/AccountPanel.vue'));
const CommunityPanel = defineAsyncComponent(() => import('./community/CommunityPanel.vue'));
const campaign = useCampaignStore(),
  game = useGameStore();
const accountOpen = ref(false),
  communityOpen = ref(false),
  viewVersion = ref(0),
  loginLink = ref(''),
  bar = ref(null);
const visitId = ref(new URLSearchParams(location.hash.slice(1)).get('town') ?? '');
let timer, observer;
function reload() {
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
    canApply: (id) => townStorage.active()?.meta.id !== id || !game.sessionActive,
    applied: (id) => {
      if (townStorage.active()?.meta.id === id) reload();
    },
  });
}
try {
  if (!campaign.readOnly) townStorage.ensure(JSON.parse(campaign.exportSave()).profile);
  configureTownSync();
} catch (error) {
  cloud.error = error.message;
}
function schedule() {
  cloud.storageVersion++;
  clearTimeout(timer);
  if (cloud.account) timer = setTimeout(syncNow, 1200);
}
function resume() {
  if (!document.hidden && cloud.account) syncNow();
}
function fromOtherTab(event) {
  if (event.key !== SAVE_KEY) return;
  try {
    if (townViewChanged(event.oldValue, event.newValue)) reload();
    else {
      // Keep elapsed income time shared without rebuilding the renderer or saving.
      const checkpoint = townStorage.active()?.profile.town?.income?.at;
      if (Number.isSafeInteger(checkpoint) && campaign.town.income)
        campaign.town.income.at = Math.max(campaign.town.income.at ?? 0, checkpoint);
    }
    if (townStorage.state()?.account?.id !== cloud.account?.id) configureTownSync();
    schedule();
  } catch (error) {
    cloud.error = error.message;
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
    if (previous && !next) {
      communityOpen.value = false;
      reload();
    }
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
      .then(syncNow)
      .catch((error) => {
        cloud.error = error.message;
        cloud.status = 'Offline — cloud backup pending';
      });
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  observer?.disconnect();
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
