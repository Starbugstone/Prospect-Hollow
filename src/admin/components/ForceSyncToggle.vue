<template>
  <div>
    <p v-if="town.syncApproval" class="admin-muted" role="status">
      {{ pending ? 'Approved' : expired ? 'Expired approval' : 'Stale approval' }}: rejection
      <code>{{ town.syncApproval.rejectionId }}</code
      >, revision {{ town.syncApproval.revision }}, rejected
      {{ dateTime(town.syncApproval.rejectedAt) }}.
      {{ pending ? 'Accepts this exact upload once until' : 'Expiry' }}
      {{ dateTime(town.forceSyncUntil) }}.
      <span :title="town.syncApproval.profileHash"
        >Profile SHA-256: {{ town.syncApproval.profileHash }}</span
      >
    </p>
    <button
      v-if="rejection"
      type="button"
      class="admin-button quiet"
      :disabled="!!town.deletedAt || saving || rejection.revision !== town.revision"
      @click="change(true)"
    >
      Approve compared upload for 24 hours
    </button>
    <p v-else-if="!town.deletedAt" class="admin-muted">Select Compare below to review an upload.</p>
    <button
      v-if="town.syncApproval && !town.deletedAt"
      type="button"
      class="admin-button quiet"
      :disabled="saving"
      @click="change(false)"
    >
      Clear approval
    </button>
  </div>
</template>
<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { adminApi } from '../api';
import { dateTime } from '../format';
const props = defineProps({ town: { type: Object, required: true }, rejection: Object });
const emit = defineEmits(['error', 'updated']);
const saving = ref(false);
const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => clearInterval(timer));
const expired = computed(() => props.town.forceSyncUntil * 1000 <= now.value);
const pending = computed(() => props.town.forceSync && !expired.value);
async function change(approve) {
  saving.value = true;
  emit('error', '');
  try {
    const reply = await adminApi('PATCH', `towns/${props.town.id}/sync`, {
      body: { forceSync: approve, ...(approve ? { rejectionId: props.rejection.id } : {}) },
    });
    emit('updated', reply);
  } catch (e) {
    emit('error', e.message);
  } finally {
    saving.value = false;
  }
}
</script>
