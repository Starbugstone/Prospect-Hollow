<template>
  <div class="account-sign-in">
    <p v-if="step !== 'confirm'" class="account-step">
      {{ t('Step {step} of 2', { step: step === 'email' ? 1 : 2 }) }}
      <span class="is-done"></span><span :class="{ 'is-done': step === 'sent' }"></span>
    </p>
    <template v-if="step === 'email'">
      <p class="account-lead">
        {{ t('Keep {town} safe and play it on any device.', { town: townName }) }}
      </p>
      <ul class="account-benefits">
        <li>
          <span><GameIcon name="devices" /></span
          >{{ t('Continue on your phone, tablet or computer') }}
        </li>
        <li>
          <span><GameIcon name="layers" /></span>{{ t('Keep up to three towns') }}
        </li>
        <li>
          <span><GameIcon name="history" /></span
          >{{ t('Go back to an earlier save if something goes wrong') }}
        </li>
      </ul>
      <form class="account-stack" @submit.prevent="act(send)">
        <label class="account-field"
          >{{ t('Email address')
          }}<input
            ref="emailInput"
            v-model="email"
            type="email"
            autocomplete="email"
            maxlength="254"
            required
        /></label>
        <button class="account-primary account-wide" :disabled="busy">
          <GameIcon name="mail" />{{ t('Email me a sign-in link') }}
        </button>
      </form>
      <p class="account-hint account-center">
        {{ t('No password needed. Your town keeps playing on this device either way.') }}
      </p>
      <p class="account-hint account-center">
        {{ t('We use your email only to sign you in and never share it.') }}
        <a :href="privacyUrl()" target="_blank" rel="noopener">{{ t('Privacy notice') }}</a>
      </p>
    </template>
    <div v-else-if="step === 'sent'" class="account-sent">
      <span class="account-envelope"><GameIcon name="mail" /></span>
      <h2>{{ t('Check your inbox') }}</h2>
      <p>
        {{ t("We sent you a sign-in link. Open it on this device and you'll be signed in.") }}
      </p>
      <p class="account-hint">{{ t('The link works for 15 minutes.') }}</p>
      <div class="account-row">
        <button :disabled="busy || cooldown > 0" @click="act(send)">
          {{ cooldown > 0 ? t('Resend in {seconds}s', { seconds: cooldown }) : t('Resend link') }}
        </button>
        <button class="account-link" @click="restart">{{ t('Use a different email') }}</button>
      </div>
      <details class="account-fold">
        <summary>{{ t('Opened the email on another device?') }}</summary>
        <form class="account-stack" @submit.prevent="act(signIn)">
          <label class="account-field"
            >{{ t('Copy the link from that email and paste it here.')
            }}<input v-model="proof" autocomplete="off" required
          /></label>
          <button class="account-primary" :disabled="busy">{{ t('Sign in') }}</button>
        </form>
      </details>
    </div>
    <div v-else class="account-sent">
      <span class="account-envelope"><GameIcon name="mail" /></span>
      <h2>{{ t('Finish signing in') }}</h2>
      <p>{{ t('You opened a sign-in link. Confirm to sign in on this device.') }}</p>
      <button class="account-primary account-wide" :disabled="busy" @click="act(signIn)">
        {{ t('Sign in') }}
      </button>
      <button class="account-link" @click="restart">{{ t('Not now') }}</button>
    </div>
  </div>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { sendLogin, confirmLogin } from '../../services/cloudProfile';
import { privacyUrl } from '../../services/appRoute';
import { useAccountContext } from './accountContext';
import GameIcon from '../GameIcon.vue';
import { t } from '../../i18n';
const props = defineProps({ loginLink: String });
const { busy, message, act, signedIn } = useAccountContext();
const account = inject('cloudAccount', null);
const townName = computed(() => account?.townName.value ?? t('Your town'));
// The address stays in memory for resending only; it is never shown on screen.
const email = ref(''),
  proof = ref(props.loginLink ?? ''),
  step = ref(props.loginLink ? 'confirm' : 'email'),
  cooldown = ref(0);
watch(
  () => props.loginLink,
  (link) => {
    if (link) {
      proof.value = link;
      step.value = 'confirm';
    }
  },
);
let timer;
async function send() {
  await sendLogin(email.value);
  step.value = 'sent';
  cooldown.value = 30;
  clearInterval(timer);
  timer = setInterval(() => {
    if (--cooldown.value <= 0) clearInterval(timer);
  }, 1000);
}
async function signIn() {
  await confirmLogin(proof.value);
  signedIn();
  proof.value = '';
  email.value = '';
  message.value = 'Signed in. Choose a town or add this device’s town.';
}
function restart() {
  email.value = '';
  proof.value = '';
  step.value = 'email';
}
onBeforeUnmount(() => clearInterval(timer));
</script>
