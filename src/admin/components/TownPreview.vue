<template>
  <section class="admin-town-preview" aria-label="Town view">
    <div class="admin-town-toolbar">
      <span>{{ connected ? 'Connected · view only' : 'Simulation disconnected' }}</span>
      <button v-if="connected" type="button" class="admin-button" @click="disconnect">
        Disconnect
      </button>
    </div>
    <div class="admin-town-frame">
      <component v-if="connected && viewer" :is="viewer" :appearance="appearance" />
      <div v-else class="admin-town-placeholder">
        <p v-if="connected" role="status">Loading town view…</p>
        <template v-else>
          <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
          <p>Connect to view the saved town and run its simulation.</p>
          <p class="admin-muted">View only. You will not appear as a visitor or in visitor logs.</p>
          <button type="button" class="admin-button primary" @click="error ? reload() : connect()">
            {{ error ? 'Reload page' : 'Connect to town' }}
          </button>
        </template>
      </div>
    </div>
  </section>
</template>
<script setup>
import { onErrorCaptured, ref, shallowRef } from 'vue';

defineProps({ appearance: { type: Object, required: true } });
const connected = ref(false);
const error = ref('');
const viewer = shallowRef(null);
const reload = () => location.reload();

// Only import and mount the renderer after an explicit connection. Unmounting it
// disposes the animation loop and graphics; no player/visitor session is opened.
async function connect() {
  error.value = '';
  connected.value = true;
  try {
    viewer.value = (await import('../views/TownViewer.vue')).default;
  } catch {
    failed();
  }
}
function disconnect() {
  connected.value = false;
}
function failed() {
  disconnect();
  error.value = 'The town view could not load. Reload the page to try again.';
}
onErrorCaptured(() => {
  failed();
  return false;
});
</script>
