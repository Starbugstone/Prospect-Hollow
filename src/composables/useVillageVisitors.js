import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { createVisitorPoller } from '../services/visitorPresence';
import { villageVisitors } from '../services/visitorApi';

// Public guestbook and scene share one snapshot; no owner campaign or save is loaded.
export function useVillageVisitors(villageId) {
  const snapshot = shallowRef(null),
    error = ref('');
  let poller;
  watch(
    villageId,
    (id) => {
      poller?.stop();
      snapshot.value = null;
      error.value = '';
      if (!id) return;
      poller = createVisitorPoller({
        load: () => villageVisitors(id),
        apply(result) {
          snapshot.value = result;
          error.value = '';
        },
        failed() {
          if (snapshot.value) snapshot.value = { ...snapshot.value, present: [] };
          error.value = 'Visitor updates are temporarily unavailable.';
        },
      });
      poller.start();
    },
    { immediate: true },
  );
  const resume = () => poller?.resume();
  onMounted(() => {
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
  });
  onBeforeUnmount(() => {
    poller?.stop();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
  });
  return { snapshot, error };
}
