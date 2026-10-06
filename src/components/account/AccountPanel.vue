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
        :aria-label="t('Mayor’s Office')"
        :title="t('Mayor’s Office')"
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
      <MayorOffice v-else-if="view === 'account'" @towns="view = 'towns'" />
      <TownSlots v-else :writable="writable" @manage="manage" />
      <DeviceCopies v-if="cloud.account" />
    </div>
  </dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { cloud, refreshAccount } from '../../services/cloudProfile';
import { confirmEmailChange } from '../../services/playerData';
import { townStorage } from '../../services/townStorage';
import { provideAccountContext } from './accountContext';
import AccountSignIn from './AccountSignIn.vue';
import MayorOffice from './MayorOffice.vue';
import TownSlots from './TownSlots.vue';
import TownManage from './TownManage.vue';
import DeviceCopies from './DeviceCopies.vue';
import GameIcon from '../GameIcon.vue';
import { t } from '../../i18n';
import '../../styles/account.css';
const props = defineProps({
  loginLink: String,
  emailLink: String,
  writable: Boolean,
  section: String,
});
const emit = defineEmits([
  'close',
  'changed',
  'community',
  'recovery',
  'signed-in',
  'email-confirmed',
]);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const { message, act } = provideAccountContext({
  changed: () => emit('changed'),
  close: () => emit('close'),
  community: () => emit('community'),
  recovery: () => emit('recovery'),
  signedIn: () => emit('signed-in'),
});
const requestedView = ref('towns'),
  focus = ref('');
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
      : view.value === 'account'
        ? t('Mayor’s Office')
        : t('My towns'),
);
function manage(section) {
  focus.value = section;
  view.value = 'manage';
}
// Opened on the Mayor's Office, or on a section of the town being played, e.g. from a
// "Share my town" button.
if (props.section === 'office') view.value = 'account';
else if (props.section) manage(props.section);
// An email change link proves the new address, on this device or any other.
async function confirmEmail(token) {
  const { email } = await confirmEmailChange(token);
  emit('email-confirmed');
  message.value = t('Your account now uses {email}.', { email });
  if (cloud.account && !cloud.sessionExpired) await refreshAccount();
}
watch(
  () => props.emailLink,
  (token) => {
    if (token) act(() => confirmEmail(token));
  },
  { immediate: true },
);
</script>
