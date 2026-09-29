import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { cloud } from '../services/cloudProfile';
import { townStorage } from '../services/townStorage';
import { createOwnerVisitorPoller } from '../services/visitorPresence';
import { townVisitors } from '../services/visitorApi';

export function useTownVisitors(active) {
  const snapshot = shallowRef(null),
    error = ref('');
  const townId = computed(() => {
    void cloud.storageVersion;
    const meta = townStorage.active()?.meta;
    return cloud.account &&
      !cloud.sessionExpired &&
      meta?.owner === cloud.account.id &&
      !meta.missing
      ? meta.id
      : null;
  });
  let poller;
  watch(
    () => [townId.value, active()],
    ([id, enabled]) => {
      poller?.stop();
      snapshot.value = null;
      error.value = '';
      if (!id || !enabled) return;
      poller = createOwnerVisitorPoller({
        load: () => townVisitors(id),
        apply(result) {
          snapshot.value = result;
          error.value = '';
        },
        failed() {
          // Do not keep claiming somebody is here after losing the server connection.
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
  return { townId, snapshot, error, present: computed(() => snapshot.value?.present ?? []) };
}
