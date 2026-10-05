import { computed, inject, ref } from 'vue';
import { validShowcase } from '../data/honours';
import { distinctionKey, distinctionList } from '../data/playerDistinctions';
import { useCampaignStore } from '../stores/campaignStore';

// What this device has shown of each account's distinctions: one key per event and per
// time step (distinctionKey), so a new step reads as new. Presentation only.
const SEEN_KEY = 'prospect-distinctions-seen-v1';
const seen = ref(null);
const readSeen = () => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(SEEN_KEY) ?? '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
};

/**
 * The signed-in player's distinctions (`received`, from the cloud account) and this
 * town's showcase. A town shows player distinctions only when it is on the player's
 * account (`showcaseable`), at most one of them. Every showcase change goes through
 * `saveShowcase`, so editing the town honours never drops the distinction on show.
 */
export function usePlayerDistinctions({ campaign = useCampaignStore() } = {}) {
  const cloudAccount = inject('cloudAccount', null);
  const received = computed(() => cloudAccount?.distinctions?.value ?? {});
  const accountTown = computed(() => !!cloudAccount?.accountTown?.value);
  const showcaseable = computed(() => (accountTown.value ? received.value : {}));
  const accountId = computed(() => cloudAccount?.accountId?.value ?? null);
  const list = computed(() => distinctionList(received.value));
  seen.value ??= readSeen();
  const keys = computed(() => list.value.map((item) => distinctionKey(item.id, item)));
  const unseen = computed(() => {
    const known = new Set(seen.value[accountId.value] ?? []);
    return list.value
      .filter((item) => !known.has(distinctionKey(item.id, item)))
      .map((item) => item.id);
  });
  function markSeen() {
    if (!accountId.value || !unseen.value.length) return;
    seen.value = { ...seen.value, [accountId.value]: keys.value };
    try {
      globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(seen.value));
    } catch {
      // Private browsing: the marker clears for this session only.
    }
  }
  const showcase = computed(() =>
    validShowcase(campaign.honours.showcase, campaign.honours, { received: showcaseable.value }),
  );
  return {
    received,
    list,
    accountTown,
    signedIn: computed(() => !!cloudAccount?.signedIn?.value),
    showcaseable,
    showcase,
    saveShowcase: (ids) => campaign.setHonourShowcase(ids, showcaseable.value),
    unseen,
    markSeen,
  };
}
