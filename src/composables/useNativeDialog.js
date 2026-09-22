import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useNativeDialog(close) {
  const dialog = ref(null),
    closeButton = ref(null);
  const previousFocus = document.activeElement;
  let backdropPressed = false;
  onMounted(() => {
    dialog.value.addEventListener('pointerdown', rememberBackdropPress);
    dialog.value.showModal();
    closeButton.value.focus({ preventScroll: true });
  });
  onBeforeUnmount(() => {
    dialog.value?.removeEventListener('pointerdown', rememberBackdropPress);
    dialog.value?.close();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  });
  function isBackdrop(event) {
    if (event.target !== dialog.value) return false;
    const box = dialog.value.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  }
  function rememberBackdropPress(event) {
    backdropPressed = isBackdrop(event);
  }
  function dismissBackdrop(event) {
    // A town tap can open this dialog on pointerup. Its following touch click
    // must not dismiss the newly opened dialog; require a fresh backdrop press.
    const pressed = backdropPressed;
    backdropPressed = false;
    if (pressed && isBackdrop(event)) close();
  }
  return { dialog, closeButton, dismissBackdrop };
}
