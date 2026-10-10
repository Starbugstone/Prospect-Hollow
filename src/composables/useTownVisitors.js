import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { cloud } from '../services/cloudProfile';
import { townStorage } from '../services/townStorage';
import { createVisitorPoller } from '../services/visitorPresence';
import { townVisitors } from '../services/visitorApi';
import { visitorChanges } from '../data/liveVisitors';

export function useTownVisitors(
  active,
  { collectSaloon = () => null, redeemHelmet = () => null, recordSocial = () => false } = {},
) {
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
  function enqueue(changes) {
    // A tap hint that is still waiting to be read is not queued again for every tap.
    changes = changes.filter(
      (change) =>
        Object.keys(change).length > 1 || !notices.value.some((n) => n.kind === change.kind),
    );
    if (!changes.length) return;
    const wasEmpty = notices.value.length === 0;
    notices.value = [...notices.value, ...changes];
    if (wasEmpty) scheduleNotice();
  }
  function applyCollection(at) {
    if (!Number.isSafeInteger(at) || at <= 0) return;
    const coins = collectSaloon(at);
    if (coins > 0) enqueue([{ kind: 'collection', coins }]);
  }
  // Space helmets found while visiting as this town: the campaign skips redeemed ones.
  function applyHelmets(finds) {
    for (const find of Array.isArray(finds) ? finds : []) {
      const coins = redeemHelmet(find);
      if (coins !== null && coins !== undefined) enqueue([{ kind: 'helmet', coins }]);
    }
  }
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
      poller = createVisitorPoller({
        load: () => townVisitors(id),
        apply(result) {
          const changes = visitorChanges(confirmed, result.present);
          confirmed = result.present;
          enqueue(changes);
          applyCollection(result.saloonCollectedAt);
          applyHelmets(result.helmetFinds);
          // Town Honours count different signed-in visitors and villages visited from this
          // town; the campaign keeps the highest of each.
          recordSocial({ visitors: result.uniqueVisitors, travels: result.townsVisited });
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
  // Cached account receipts still work on reconnect, even if live polling fails.
  // The campaign's saved timestamp deduplicates both sources and later polls.
  watch(
    () => [townId.value, active(), cloud.towns],
    ([id, enabled]) => {
      if (id && enabled)
        applyCollection(cloud.towns?.find((entry) => entry.townId === id)?.saloonCollectedAt);
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
    enqueue,
  };
}
