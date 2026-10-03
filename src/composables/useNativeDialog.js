import { onBeforeUnmount, onMounted, ref } from 'vue';

// A modal dialog makes the page inert. A sheet opens without the top layer, so the
// controls around it (the village tab bar) stay usable; Escape still closes it.
export function useNativeDialog(close, { modal = true } = {}) {
  const dialog = ref(null),
    closeButton = ref(null);
  const previousFocus = document.activeElement;
  let backdropPressed = false;
  const escape = (event) => event.key === 'Escape' && close();
  onMounted(() => {
    dialog.value.addEventListener('pointerdown', rememberBackdropPress);
    if (modal) dialog.value.showModal();
    else {
      dialog.value.show();
      document.addEventListener('keydown', escape);
    }
    closeButton.value.focus({ preventScroll: true });
  });
  onBeforeUnmount(() => {
    dialog.value?.removeEventListener('pointerdown', rememberBackdropPress);
    if (!modal) document.removeEventListener('keydown', escape);
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
