<template>
  <section>
    <header class="admin-heading"><h1>Admins</h1></header>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <div v-if="issued" class="admin-issued" role="status">
      <p>
        Temporary password for <strong>{{ issued.username }}</strong
        >. It is shown only once: send it privately. They choose their own password and set up an
        authenticator when they sign in.
      </p>
      <code class="admin-secret">{{ issued.password }}</code>
      <button type="button" class="admin-button quiet" @click="issued = null">Done</button>
    </div>
    <table v-if="admins" class="admin-table">
      <thead>
        <tr>
          <th scope="col">Username</th>
          <th scope="col">Two-step sign-in</th>
          <th scope="col">Last sign-in</th>
          <th scope="col">Added</th>
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="admin in admins" :key="admin.id">
          <td>
            {{ admin.username }}
            <span v-if="admin.username === self" class="admin-badge">You</span>
          </td>
          <td>
            {{ admin.authenticator ? 'On' : 'Not set up yet' }}
            <span v-if="admin.mustChangePassword" class="admin-badge">Temporary password</span>
          </td>
          <td :title="dateTime(admin.lastLoginAt)">{{ relativeTime(admin.lastLoginAt) }}</td>
          <td>
            {{ date(admin.createdAt)
            }}<template v-if="admin.createdBy"> by {{ admin.createdBy }}</template>
          </td>
          <td class="admin-actions">
            <template v-if="admin.username !== self">
              <ConfirmAction
                label="Reset password"
                :title="`Reset ${admin.username}’s password?`"
                message="They are signed out and get a temporary password to replace. Their authenticator stays."
                :run="() => issue(admin, 'reset-password')"
              />
              <ConfirmAction
                label="Reset authenticator"
                :title="`Reset ${admin.username}’s authenticator?`"
                message="Use this when they lost their phone. They are signed out and set up a new authenticator at their next sign-in."
                :run="() => act(admin, 'reset-authenticator')"
              />
              <ConfirmAction
                danger
                label="Remove"
                :title="`Remove ${admin.username}?`"
                message="They lose access to this panel at once."
                :confirm-text="admin.username"
                :run="() => remove(admin)"
              />
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Add an admin</h2>
    <form class="admin-inline-form" @submit.prevent="add">
      <label>
        Username
        <input
          v-model="username"
          autocomplete="off"
          pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,31}"
          required
        />
      </label>
      <button class="admin-button" :disabled="busy">Add admin</button>
    </form>
    <p class="admin-muted">
      Every admin has the same access, including adding and removing admins.
    </p>

    <h2>Change my password</h2>
    <form class="admin-inline-form" @submit.prevent="changePassword">
      <input :value="self" autocomplete="username" readonly hidden />
      <label
        >Current password
        <input v-model="current" type="password" autocomplete="current-password" required
      /></label>
      <label>
        New password
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          minlength="12"
          required
        />
      </label>
      <button class="admin-button" :disabled="busy">Change password</button>
    </form>
    <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { adminApi } from '../api';
import { date, dateTime, relativeTime } from '../format';
import ConfirmAction from '../components/ConfirmAction.vue';
const admins = ref(null),
  self = ref(''),
  issued = ref(null),
  username = ref(''),
  current = ref(''),
  password = ref(''),
  busy = ref(false),
  error = ref(''),
  notice = ref('');
async function load() {
  const data = await adminApi('GET', 'admins');
  admins.value = data.admins;
  self.value = data.self;
}
async function guarded(action) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await action();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
const add = () =>
  guarded(async () => {
    issued.value = await adminApi('POST', 'admins', { body: { username: username.value } });
    username.value = '';
    await load();
  });
async function issue(admin, action) {
  issued.value = await adminApi('POST', `admins/${admin.id}/${action}`);
  await load();
}
async function act(admin, action) {
  await adminApi('POST', `admins/${admin.id}/${action}`);
  notice.value = `${admin.username} sets up a new authenticator at their next sign-in.`;
  await load();
}
async function remove(admin) {
  await adminApi('DELETE', `admins/${admin.id}`);
  await load();
}
const changePassword = () =>
  guarded(async () => {
    await adminApi('POST', 'password', {
      body: { current: current.value, password: password.value },
    });
    current.value = '';
    password.value = '';
    notice.value = 'Password changed. Your other sessions were signed out.';
  });
onMounted(() => guarded(load));
</script>
