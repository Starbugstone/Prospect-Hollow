<template>
  <dialog
    ref="dialog"
    class="account-panel"
    aria-labelledby="account-title"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <header class="account-heading">
      <button
        v-if="view !== 'towns'"
        class="account-round"
        :aria-label="t('Back to my towns')"
        @click="view = 'towns'"
      >
        <GameIcon name="back" />
      </button>
      <img v-else src="/art/amethyst.svg" alt="" />
      <h1 id="account-title">{{ title }}</h1>
      <button
        v-if="cloud.account && view === 'towns'"
        class="account-round"
        :aria-label="t('Account')"
        :title="t('Account')"
        @click="view = 'account'"
      >
        <GameIcon name="user" />
      </button>
      <button
        ref="closeButton"
        class="account-round"
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
      <template v-if="!cloud.account || cloud.sessionExpired">
        <p v-if="cloud.sessionExpired" class="account-message">
          {{
            t('Your session expired. Keep playing offline; sign in again to resume cloud saving.')
          }}
        </p>
        <AccountSignIn :login-link="loginLink" />
      </template>
      <TownManage v-else-if="view === 'manage'" :active="active" :focus="focus" />
      <template v-else-if="view === 'account'">
        <PublicProfile />
        <section class="account-section">
          <div class="account-identity">
            <span class="account-avatar"><GameIcon name="user" /></span>
            <span
              ><strong>{{ t('Signed in') }}</strong
              ><small>{{
                t('{count} of 3 slots used', { count: cloud.towns.length })
              }}</small></span
            >
          </div>
          <div class="account-row">
            <button :disabled="busy" @click="act(() => logout())">{{ t('Sign out') }}</button>
            <button :disabled="busy" @click="act(() => logout(true))">
              {{ t('Sign out on every device') }}
            </button>
          </div>
        </section>
        <details class="account-danger">
          <summary><GameIcon name="trash" />{{ t('Delete my account…') }}</summary>
          <p>
            {{
              t(
                'This deletes the account and its cached towns and preserved saves on this device. Export any progress you want to keep first.',
              )
            }}
          </p>
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
      </template>
      <TownSlots v-else :writable="writable" @manage="manage" />
      <DeviceCopies v-if="cloud.account" />
    </div>
  </dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { cloud, logout, deleteAccount as removeAccount } from '../../services/cloudProfile';
import { townStorage } from '../../services/townStorage';
import { provideAccountContext } from './accountContext';
import AccountSignIn from './AccountSignIn.vue';
import PublicProfile from './PublicProfile.vue';
import TownSlots from './TownSlots.vue';
import TownManage from './TownManage.vue';
import DeviceCopies from './DeviceCopies.vue';
import GameIcon from '../GameIcon.vue';
import { t } from '../../i18n';
import '../../styles/account.css';
const props = defineProps({ loginLink: String, writable: Boolean });
const emit = defineEmits(['close', 'changed', 'community', 'recovery', 'signed-in']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const { busy, message, act } = provideAccountContext({
  changed: () => emit('changed'),
  close: () => emit('close'),
  community: () => emit('community'),
  recovery: () => emit('recovery'),
  signedIn: () => emit('signed-in'),
});
const requestedView = ref('towns'),
  focus = ref(''),
  deleteAccountText = ref('');
const active = computed(() => {
  void cloud.storageVersion;
  return townStorage.active();
});
const canManage = computed(
  () =>
    props.writable &&
    !!cloud.account &&
    !cloud.sessionExpired &&
    active.value?.meta.owner === cloud.account.id &&
    !active.value.meta.missing,
);
// Signing out, switching or deleting a town returns to the town list.
const view = computed({
  get: () =>
    !cloud.account || cloud.sessionExpired || (requestedView.value === 'manage' && !canManage.value)
      ? 'towns'
      : requestedView.value,
  set: (next) => {
    requestedView.value = next;
  },
});
watch(
  () => active.value?.meta.id,
  () => {
    if (requestedView.value === 'manage') requestedView.value = 'towns';
  },
);
const title = computed(() =>
  !cloud.account
    ? t('Protect my progress')
    : view.value === 'manage'
      ? active.value.meta.name
      : t(view.value === 'account' ? 'Account' : 'My towns'),
);
function manage(section) {
  focus.value = section;
  view.value = 'manage';
}
async function deleteAccount() {
  await removeAccount(deleteAccountText.value);
  emit('changed');
}
</script>
