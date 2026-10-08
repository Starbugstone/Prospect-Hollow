<template>
  <dialog ref="dialog" class="admin-dialog" @close="settle(dialog.returnValue === 'edit')">
    <form method="dialog">
      <h2>The player is online</h2>
      <p>
        Their game was last seen {{ relativeTime(seenAt) }} and may sync while you edit. If it does,
        the value you save is refused until you check the new one.
      </p>
      <p>
        Once you save, whatever they play before their game loads the correction is replaced, and
        kept only as a backup on their device. If you can, ask them to close the game first.
      </p>
      <div class="admin-dialog-actions">
        <button value="cancel" class="admin-button quiet">Cancel</button>
        <button value="edit" class="admin-button">Edit anyway</button>
      </div>
    </form>
  </dialog>
</template>
<script setup>
import { ref } from 'vue';
import { relativeTime } from '../format';
defineProps({ seenAt: Number });
const dialog = ref(null);
let settle = () => {};
// Resolves true when the admin chooses to edit anyway.
function ask() {
  dialog.value.returnValue = '';
  dialog.value.showModal();
  return new Promise((resolve) => (settle = resolve));
}
defineExpose({ ask });
</script>
