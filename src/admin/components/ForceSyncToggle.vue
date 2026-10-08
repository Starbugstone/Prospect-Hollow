<template>
  <label>
    <input
      type="checkbox"
      :checked="town.forceSync"
      :disabled="!!town.deletedAt || saving"
      :aria-label="labelled ? undefined : `Accept the next sync of ${town.name}`"
      @change="change($event.target)"
    />
    <template v-if="labelled">Accept the next sync without the desync check</template>
  </label>
</template>
<script setup>
import { ref } from 'vue';
import { adminApi } from '../api';
// One upload of the town skips the desync check, then the flag clears itself.
const props = defineProps({ town: { type: Object, required: true }, labelled: Boolean });
const emit = defineEmits(['error', 'update:forceSync']);
const saving = ref(false);
async function change(box) {
  saving.value = true;
  emit('error', '');
  try {
    const reply = await adminApi('PATCH', `towns/${props.town.id}/sync`, {
      body: { forceSync: box.checked },
    });
    emit('update:forceSync', reply.forceSync);
  } catch (e) {
    emit('error', e.message);
    box.checked = props.town.forceSync;
  } finally {
    saving.value = false;
  }
}
</script>
