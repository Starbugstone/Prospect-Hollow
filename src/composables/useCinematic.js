import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Shared lifecycle of the full-screen town cinematics: a modal dialog that returns
 * focus when it closes, and a real-time clock (milliseconds) that advances only while
 * the scene is `running()` and the page is visible. A hidden tab never jumps ahead.
 *
 * @param {object} options
 * @param {() => number} options.duration Total length in milliseconds.
 * @param {() => boolean} options.running Scene ready and not paused.
 * @param {number} [options.maxStep] Longest single advance, so a stalled frame cannot skip.
 * @param {() => void} options.onOpen Called once the dialog is shown: start() or complete().
 * @param {(advanced: boolean) => void} [options.onTick] Called on every animation frame.
 * @param {() => void} [options.onFinish] Called when the clock reaches the end.
 * @param {() => void} [options.onHidden] Called when the page is hidden.
 * @param {() => void} [options.onClose] Called before the dialog closes.
 */
export function useCinematic({
  duration,
  running,
  maxStep = Infinity,
  onOpen,
  onTick,
  onFinish,
  onHidden,
  onClose,
}) {
  const dialog = ref(null);
  const elapsed = ref(0);
  const finished = computed(() => elapsed.value >= duration());
  let frame, previous, previousFocus;
  function tick(now) {
    const advanced = previous !== undefined && running() && !document.hidden && !finished.value;
    if (advanced)
      elapsed.value = Math.min(duration(), elapsed.value + Math.min(maxStep, now - previous));
    previous = now;
    onTick?.(advanced);
    if (finished.value) onFinish?.();
    else frame = requestAnimationFrame(tick);
  }
  function start() {
    cancelAnimationFrame(frame);
    previous = undefined;
    frame = requestAnimationFrame(tick);
  }
  // Show the final state immediately, for reduced motion or a skipped cinematic.
  function complete() {
    cancelAnimationFrame(frame);
    elapsed.value = duration();
  }
  const visibilityChanged = () => {
    previous = undefined;
    if (document.hidden) onHidden?.();
  };
  onMounted(() => {
    previousFocus = document.activeElement;
    document.addEventListener('visibilitychange', visibilityChanged);
    dialog.value.showModal();
    onOpen();
  });
  onBeforeUnmount(() => {
    onClose?.();
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', visibilityChanged);
    dialog.value?.close();
    if (previousFocus?.isConnected) previousFocus.focus();
  });
  return { dialog, elapsed, finished, start, complete };
}
