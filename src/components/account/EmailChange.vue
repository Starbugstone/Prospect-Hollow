<template>
  <section class="account-section" aria-labelledby="email-change-title">
    <h2 id="email-change-title">{{ t('Email address') }}</h2>
    <p>
      <strong>{{ cloud.account?.email }}</strong>
      <span class="account-hint">
        · {{ t('Private. Used only to sign in and to tell you about your account.') }}</span
      >
    </p>
    <p v-if="pending" class="account-message" role="status">
      {{ t('Open the link we sent to {email} to finish the change.', { email: pending }) }}
    </p>
    <button v-if="!editing" type="button" :disabled="busy" @click="editing = true">
      <GameIcon name="mail" />{{ t('Change email') }}
    </button>
    <form v-else class="account-stack" @submit.prevent="act(send)">
      <label class="account-field"
        >{{ t('New email address')
        }}<input v-model="email" type="email" autocomplete="email" maxlength="254" required
      /></label>
      <p class="account-hint">
        {{ t('We email a link to the new address. Your email changes only once you open it.') }}
      </p>
      <div class="account-row">
        <button class="account-primary" :disabled="busy">
          {{ t('Send confirmation link') }}
        </button>
        <button type="button" @click="editing = false">{{ t('Cancel') }}</button>
      </div>
    </form>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { cloud } from '../../services/cloudProfile';
import { requestEmailChange } from '../../services/playerData';
import { useAccountContext } from './accountContext';
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';
defineProps({ pending: { type: String, default: null } });
const emit = defineEmits(['requested']);
const { busy, act } = useAccountContext();
const editing = ref(false),
  email = ref('');
async function send() {
  await requestEmailChange(email.value);
  editing.value = false;
  email.value = '';
  emit('requested');
}
</script>
