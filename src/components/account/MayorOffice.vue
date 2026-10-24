<template>
  <div class="mayor-office">
    <section class="office-card" aria-labelledby="office-name">
      <span class="office-badge"><GameIcon name="user" /></span>
      <div>
        <h2 id="office-name">{{ summary?.publicName || t('Mayor without a public name') }}</h2>
        <p v-if="summary">
          {{ t('Member since {date}', { date: since }) }} ·
          {{ maskEmail(summary.email) }}
        </p>
      </div>
    </section>
    <div class="office-tabs" role="tablist" :aria-label="t('Mayor’s Office')">
      <button
        v-for="(entry, index) in TABS"
        :id="`office-tab-${entry.id}`"
        :key="entry.id"
        ref="tabButtons"
        type="button"
        role="tab"
        :class="{ 'is-danger': entry.id === 'delete' }"
        :aria-selected="tab === entry.id"
        :aria-controls="`office-panel-${entry.id}`"
        :tabindex="tab === entry.id ? 0 : -1"
        @click="tab = entry.id"
        @keydown.right.prevent="move(index, 1)"
        @keydown.left.prevent="move(index, -1)"
      >
        <GameIcon :name="entry.icon" />{{ t(entry.label) }}
      </button>
    </div>
    <div
      :id="`office-panel-${tab}`"
      class="office-panel"
      role="tabpanel"
      :aria-labelledby="`office-tab-${tab}`"
    >
      <p v-if="problem" class="account-message" role="alert">
        {{ t(problem) }}
        <button type="button" class="account-link" @click="load">{{ t('Try again') }}</button>
      </p>
      <template v-if="tab === 'profile'">
        <PublicProfile />
        <EmailChange :pending="summary?.pendingEmail" @requested="load" />
      </template>
      <template v-else-if="tab === 'data'">
        <p v-if="!summary && !problem" role="status">{{ t('Loading…') }}</p>
        <OfficeData v-else-if="summary" :summary="summary" />
      </template>
      <section v-else-if="tab === 'devices'" class="account-section">
        <h2>{{ t('Signed-in devices') }}</h2>
        <p v-if="summary">
          {{ t('Signed-in devices and browsers: {count}', { count: number(summary.sessions) }) }}
        </p>
        <p class="account-hint">
          {{
            t(
              'Signing out everywhere ends every session, including this one. Each device keeps playing offline.',
            )
          }}
        </p>
        <div class="account-row">
          <button :disabled="busy" @click="act(() => logout())">{{ t('Sign out') }}</button>
          <button :disabled="busy" @click="act(() => logout(true))">
            {{ t('Sign out on every device') }}
          </button>
        </div>
      </section>
      <AccountDeletion v-else :summary="summary" @towns="$emit('towns')" />
      <p class="office-privacy">
        <a :href="privacyUrl()" target="_blank" rel="noopener">{{ t('Privacy notice') }}</a>
      </p>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { logout } from '../../services/cloudProfile';
import { loadDataSummary, maskEmail } from '../../services/playerData';
import { privacyUrl } from '../../services/appRoute';
import { useAccountContext } from './accountContext';
import { t, number, locale } from '../../i18n';
import GameIcon from '../GameIcon.vue';
import PublicProfile from './PublicProfile.vue';
import EmailChange from './EmailChange.vue';
import OfficeData from './OfficeData.vue';
import AccountDeletion from './AccountDeletion.vue';
const TABS = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'data', label: 'Your data', icon: 'eye' },
  { id: 'devices', label: 'Devices', icon: 'devices' },
  { id: 'delete', label: 'Delete', icon: 'trash' },
];
defineEmits(['towns']);
const { busy, act } = useAccountContext();
const tab = ref('profile'),
  tabButtons = ref([]),
  summary = ref(null),
  problem = ref('');
const since = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    summary.value.createdAt,
  ),
);
// Arrow keys move between tabs, as in any tab list.
function move(index, step) {
  const next = (index + step + TABS.length) % TABS.length;
  tab.value = TABS[next].id;
  tabButtons.value[next]?.focus();
}
async function load() {
  problem.value = '';
  try {
    summary.value = await loadDataSummary();
  } catch (error) {
    problem.value = error.message;
  }
}
onMounted(load);
</script>
<style>
.mayor-office {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}
.office-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  background: linear-gradient(135deg, #f2eaf4, #fff7df);
  border: 1px solid #e3dbc7;
  border-radius: 16px;
}
.office-card p {
  color: #64756a;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.office-badge {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  background: #82518b;
  color: #fff7df;
}
.office-badge svg {
  width: 1.6rem;
  height: 1.6rem;
}
.office-tabs {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
}
.account-panel .office-tabs button {
  flex-shrink: 0;
  padding: 0.5rem 0.85rem;
}
.account-panel .office-tabs button[aria-selected='true'] {
  background: #183832;
  color: #fff7df;
  border-color: #183832;
}
.account-panel .office-tabs button.is-danger:not([aria-selected='true']) {
  color: #a53a2a;
}
.office-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}
.office-facts {
  display: grid;
  margin: 0;
}
.office-facts > div {
  display: grid;
  grid-template-columns: minmax(8rem, 2fr) 3fr;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px dashed #e3dbc7;
}
.office-facts dt {
  color: #64756a;
  font-size: 0.85rem;
}
.office-facts dd {
  display: grid;
  margin: 0;
  overflow-wrap: anywhere;
}
.office-facts small,
.office-privacy {
  color: #64756a;
  font-size: 0.8rem;
}
.office-losses {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding-left: 1.2rem;
}
.account-deletion {
  border-color: #e0a79c;
}
@media (max-width: 480px) {
  .office-facts > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.1rem;
  }
}
</style>
