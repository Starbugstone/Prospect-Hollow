<template>
  <section>
    <header class="admin-heading"><h1>Settings</h1></header>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <h2>Privacy contact</h2>
    <p class="admin-muted">
      The address players write to about their data. It appears on the
      <a :href="privacyUrl()" target="_blank" rel="noopener">privacy notice</a> and in the emails
      sent after an account deletion or an email change. Leave it empty to ask players to reply to a
      game email instead, so the sender address must then reach a monitored mailbox.
    </p>
    <form v-if="loaded" class="admin-inline-form" @submit.prevent="save">
      <label>
        Email address
        <input
          v-model="contact"
          type="email"
          autocomplete="off"
          maxlength="254"
          placeholder="privacy@example.com"
        />
      </label>
      <button class="admin-button" :disabled="busy || contact.trim() === saved">Save</button>
    </form>
    <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup>
import { onMounted, ref } from 'vue';
import { adminApi } from '../api';
import { privacyUrl } from '../../services/appRoute';
const contact = ref(''),
  saved = ref(''),
  loaded = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref('');
async function save() {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await adminApi('PATCH', 'settings/privacy', {
      body: { privacyContact: contact.value.trim() },
    });
    contact.value = saved.value = result.privacyContact;
    notice.value = result.privacyContact
      ? `Players now write to ${result.privacyContact}.`
      : 'No contact address: players reply to a game email.';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  try {
    contact.value = saved.value = (await adminApi('GET', 'settings')).privacyContact;
    loaded.value = true;
  } catch (e) {
    error.value = e.message;
  }
});
</script>
