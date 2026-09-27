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
        v-if="view !== 'towns' && !deleted"
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
      <p v-if="!deleted && (message || cloud.error)" class="account-message" role="status">
        {{ t(message || cloud.error) }}
      </p>
      <section v-if="deleted" class="account-stack" role="status">
        <h2>{{ t('Your account has been deleted') }}</h2>
        <p>{{ t('Your cloud towns have been deleted and all account sessions have ended.') }}</p>
        <p v-if="deleted.localCleanupComplete">
          {{ t('This account’s cached towns and preserved saves were removed from this device.') }}
        </p>
        <p v-else class="account-message">
          {{
            t(
              'Some local copies could not be removed. Clear this site’s storage in your browser or this app’s data in your device settings. This also removes the separate device town and preferences.',
            )
          }}
        </p>
        <p class="account-hint">
          {{ t('Downloaded exports and copies on other devices must be removed separately.') }}
        </p>
        <button class="account-primary" @click="$emit('close')">{{ t('Close') }}</button>
      </section>
      <template v-else-if="!cloud.account || cloud.sessionExpired">
        <p v-if="cloud.sessionExpired" class="account-message">
          {{
            t('Your session expired. Keep playing offline; sign in again to resume cloud saving.')
          }}
        </p>
        <AccountSignIn :login-link="loginLink" />
      </template>
      <TownManage v-else-if="view === 'manage'" :active="active" :focus="focus" />
      <template v-else-if="view === 'account'">
        <section class="account-section">
          <div class="account-identity">
            <span class="account-avatar"><GameIcon name="user" /></span>
            <span
              ><strong>{{ t('Signed in') }}</strong
              ><small v-if="cloud.account.email">{{ cloud.account.email }}</small
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
        <details class="account-danger" @toggle="resetDeleteConfirmation">
          <summary><GameIcon name="trash" />{{ t('Delete my account…') }}</summary>
          <p>
            {{
              t(
                'Permanently delete your account, email address, cloud towns, save history and public town listings. All account sessions will end. This cannot be undone.',
              )
            }}
          </p>
          <p>
            {{
              t(
                'This account’s cached towns and preserved saves on this device will also be removed. Your separate device town, preferences and other accounts’ saves are kept.',
              )
            }}
          </p>
          <p class="account-hint">
            {{
              t(
                'Export any progress you want to keep first. Downloaded exports and copies on other devices are not erased remotely. Hosting backups expire under the operator’s retention policy.',
              )
            }}
          </p>
          <label class="account-field"
            >{{ t('Type DELETE MY ACCOUNT to confirm')
            }}<input
              v-model="deleteAccountText"
              :disabled="busy"
              autocomplete="off"
              autocapitalize="off"
              :spellcheck="false"
          /></label>
          <button
            class="account-destructive"
            :disabled="busy || deleteAccountText !== 'DELETE MY ACCOUNT'"
            @click="act(deleteAccount)"
          >
            {{ t(deleting ? 'Deleting account…' : 'Delete my account') }}
          </button>
        </details>
      </template>
      <TownSlots v-else :writable="writable" @manage="manage" />
      <DeviceCopies v-if="cloud.account && !deleted" />
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
import TownSlots from './TownSlots.vue';
import TownManage from './TownManage.vue';
import DeviceCopies from './DeviceCopies.vue';
import GameIcon from '../GameIcon.vue';
import { t } from '../../i18n';
import '../../styles/account.css';
const props = defineProps({
  loginLink: String,
  writable: Boolean,
  initialView: { type: String, default: 'towns' },
});
const emit = defineEmits(['close', 'changed', 'community', 'recovery', 'signed-in']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const { busy, message, act } = provideAccountContext({
  changed: () => emit('changed'),
  close: () => emit('close'),
  community: () => emit('community'),
  recovery: () => emit('recovery'),
  signedIn: () => emit('signed-in'),
});
const requestedView = ref(props.initialView === 'account' ? 'account' : 'towns'),
  focus = ref(''),
  deleting = ref(false),
  deleted = ref(null),
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
watch([view, () => cloud.account?.id], () => {
  deleteAccountText.value = '';
});
const title = computed(() =>
  deleted.value
    ? t('Account deleted')
    : !cloud.account
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
  deleting.value = true;
  try {
    deleted.value = await removeAccount(deleteAccountText.value);
    deleteAccountText.value = '';
    emit('changed');
  } finally {
    deleting.value = false;
  }
}
function resetDeleteConfirmation(event) {
  if (!event.target.open) deleteAccountText.value = '';
}
</script>
