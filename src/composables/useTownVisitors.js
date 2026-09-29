import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { cloud } from '../services/cloudProfile';
import { townStorage } from '../services/townStorage';
import { createOwnerVisitorPoller } from '../services/visitorPresence';
import { townVisitors } from '../services/visitorApi';
import { visitorChanges } from '../data/liveVisitors';

export function useTownVisitors(active) {
  const snapshot = shallowRef(null),
    notices = shallowRef([]),
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
  let poller, noticeTimer;
  function scheduleNotice() {
    clearTimeout(noticeTimer);
    if (notices.value.length) noticeTimer = setTimeout(dismissNotice, 6000);
  }
  function dismissNotice() {
    notices.value = notices.value.slice(1);
    scheduleNotice();
  }
  watch(
    () => [townId.value, active()],
    ([id, enabled]) => {
      poller?.stop();
      clearTimeout(noticeTimer);
      notices.value = [];
      snapshot.value = null;
      error.value = '';
      if (!id || !enabled) return;
      let confirmed = null;
      poller = createOwnerVisitorPoller({
        load: () => townVisitors(id),
        apply(result) {
          const changes = visitorChanges(confirmed, result.present);
          confirmed = result.present;
          if (changes.length) {
            const wasEmpty = notices.value.length === 0;
            notices.value = [...notices.value, ...changes];
            if (wasEmpty) scheduleNotice();
          }
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
    clearTimeout(noticeTimer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
  });
  return {
    townId,
    snapshot,
    error,
    present: computed(() => snapshot.value?.present ?? []),
    notice: computed(() => notices.value[0] ?? null),
    dismissNotice,
  };
}
