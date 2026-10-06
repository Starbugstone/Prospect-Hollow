import { computed, hasInjectionContext, inject, ref } from 'vue';
import { validShowcase } from '../data/honours';
import { distinctionKey, distinctionList } from '../data/playerDistinctions';
import { useCampaignStore } from '../stores/campaignStore';

// What this device has shown of each account's distinctions, one key per event and per
// time step (distinctionKey), so a new step reads as new: `seen` once the Player tab was
// open, `announced` once its popup appeared (or was skipped by the notice preference).
// Presentation only; the server decides what a player holds.
const STORES = {
  seen: 'prospect-distinctions-seen-v1',
  announced: 'prospect-distinctions-announced-v1',
};
const marks = { seen: ref(null), announced: ref(null) };
const readMarks = (key) => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(key) ?? '{}');
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
  const cloudAccount = hasInjectionContext() ? inject('cloudAccount', null) : null;
  const received = computed(() => cloudAccount?.distinctions?.value ?? {});
  const accountTown = computed(() => !!cloudAccount?.accountTown?.value);
  const showcaseable = computed(() => (accountTown.value ? received.value : {}));
  const accountId = computed(() => cloudAccount?.accountId?.value ?? null);
  const list = computed(() => distinctionList(received.value));
  for (const [name, key] of Object.entries(STORES)) marks[name].value ??= readMarks(key);
  // Received distinctions this account has not had marked `name` on this device.
  const unmarked = (name) =>
    computed(() => {
      const known = new Set(marks[name].value[accountId.value] ?? []);
      return list.value.filter((item) => !known.has(distinctionKey(item.id, item)));
    });
  const unseenItems = unmarked('seen');
  const unannounced = unmarked('announced');
  // Marks keys (default: everything received now); older steps are forgotten.
  function mark(name, keys = list.value.map((item) => distinctionKey(item.id, item))) {
    if (!accountId.value || !keys.length) return;
    const current = new Set(marks[name].value[accountId.value] ?? []);
    const live = new Set(list.value.map((item) => distinctionKey(item.id, item)));
    const next = [...new Set([...current, ...keys])].filter((key) => live.has(key));
    if (next.length === current.size && next.every((key) => current.has(key))) return;
    marks[name].value = { ...marks[name].value, [accountId.value]: next };
    try {
      globalThis.localStorage?.setItem(STORES[name], JSON.stringify(marks[name].value));
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
    unseen: computed(() => unseenItems.value.map((item) => item.id)),
    unannounced,
    markSeen: (keys) => mark('seen', keys),
    markAnnounced: (keys) => mark('announced', keys),
  };
}
