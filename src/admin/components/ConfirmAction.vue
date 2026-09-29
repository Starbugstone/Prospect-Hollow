<template>
  <button type="button" class="admin-button" :class="{ danger }" :disabled="disabled" @click="open">
    {{ label }}
  </button>
  <dialog ref="dialog" class="admin-dialog" @close="reset">
    <form @submit.prevent="confirm">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <label v-if="confirmText">
        Type {{ confirmHint ?? `“${confirmText}”` }} to confirm
        <input v-model="typed" autocomplete="off" spellcheck="false" />
      </label>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <div class="admin-dialog-actions">
        <button type="button" class="admin-button quiet" @click="dialog.close()">Cancel</button>
        <button
          class="admin-button"
          :class="{ danger }"
          :disabled="busy || (confirmText && typed !== confirmText)"
        >
          {{ busy ? 'Working…' : label }}
        </button>
      </div>
    </form>
  </dialog>
</template>
<script setup>
import { ref } from 'vue';
// A destructive action behind a dialog; "confirmText" asks the admin to type a value first.
const props = defineProps({
  label: String,
  title: String,
  message: String,
  confirmText: String,
  confirmHint: String,
  danger: Boolean,
  disabled: Boolean,
  run: { type: Function, required: true },
});
const dialog = ref(null),
  typed = ref(''),
  busy = ref(false),
  error = ref('');
const open = () => dialog.value.showModal();
function reset() {
  typed.value = '';
  error.value = '';
}
async function confirm() {
  busy.value = true;
  error.value = '';
  try {
    await props.run();
    dialog.value.close();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
