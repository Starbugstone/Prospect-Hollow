<template>
  <main class="admin-sign-in">
    <form class="admin-card" @submit.prevent="submit">
      <h1>Prospect Hollow admin</h1>
      <p class="admin-muted">{{ host }}</p>
      <template v-if="!adminSession.stage">
        <label
          >Username <input v-model="username" autocomplete="username" required autofocus
        /></label>
        <label>
          Password
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="admin-button" :disabled="busy">Sign in</button>
      </template>
      <template v-else-if="adminSession.stage === 'totp'">
        <p>Enter the 6-digit code from your authenticator app.</p>
        <label>Code <input v-model="code" v-bind="codeInput" autofocus /></label>
        <button class="admin-button" :disabled="busy">Verify</button>
      </template>
      <template v-else-if="adminSession.stage === 'change'">
        <p>Replace your temporary password with your own: at least 12 characters.</p>
        <input :value="adminSession.username" autocomplete="username" readonly hidden />
        <label>
          New password
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            minlength="12"
            required
            autofocus
          />
        </label>
        <label>
          Repeat it
          <input
            v-model="repeat"
            type="password"
            autocomplete="new-password"
            minlength="12"
            required
          />
        </label>
        <button class="admin-button" :disabled="busy">Save password</button>
      </template>
      <template v-else-if="adminSession.stage === 'enroll'">
        <p>
          Two-step sign-in is required. Scan this code with an authenticator app (for example Google
          Authenticator, Microsoft Authenticator, 1Password or Aegis), then enter the 6-digit code
          it shows.
        </p>
        <template v-if="enrollment">
          <QrCode :text="enrollment.uri" label="Authenticator setup code" />
          <p class="admin-muted">
            Can’t scan it? Enter this key instead:
            <code class="admin-secret">{{ enrollment.secret.match(/.{1,4}/g).join(' ') }}</code>
          </p>
        </template>
        <label>Code <input v-model="code" v-bind="codeInput" /></label>
        <button class="admin-button" :disabled="busy || !enrollment">
          Turn on two-step sign-in
        </button>
      </template>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <button v-if="adminSession.stage" type="button" class="admin-link" @click="startOver">
        Start over
      </button>
    </form>
  </main>
</template>
<script setup>
import { ref, watch } from 'vue';
import { adminApi, adminSession, restoreSession, signOut } from '../api';
import QrCode from '../components/QrCode.vue';
const host = location.host;
const codeInput = {
  inputmode: 'numeric',
  autocomplete: 'one-time-code',
  pattern: '[0-9 ]{6,7}',
  maxlength: 7,
  required: true,
};
const username = ref(''),
  password = ref(''),
  repeat = ref(''),
  code = ref(''),
  enrollment = ref(null),
  busy = ref(false),
  error = ref('');
async function loadEnrollment() {
  enrollment.value = null;
  try {
    enrollment.value = await adminApi('GET', 'login/authenticator');
  } catch (e) {
    error.value = e.message;
  }
}
watch(
  () => adminSession.stage,
  (stage) => {
    code.value = '';
    password.value = '';
    repeat.value = '';
    if (stage === 'enroll') loadEnrollment();
  },
  { immediate: true },
);
const steps = {
  '': () =>
    adminApi('POST', 'login', { body: { username: username.value, password: password.value } }),
  totp: () => adminApi('POST', 'login/code', { body: { code: code.value } }),
  enroll: () => adminApi('POST', 'login/authenticator', { body: { code: code.value } }),
  change() {
    if (password.value !== repeat.value) throw new Error('The two passwords are different.');
    return adminApi('POST', 'password', { body: { password: password.value } });
  },
};
async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await steps[adminSession.stage]();
    await restoreSession();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function startOver() {
  error.value = '';
  await signOut().catch(() => {});
}
</script>
